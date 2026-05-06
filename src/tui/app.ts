import { prompt } from "enquirer";
// Use runtime require to access the Input prompt class without TypeScript type errors
const Enquirer: any = require("enquirer");
const Input: any = Enquirer.Input;
import path from "path";
import fs from "fs";
import chalk from "chalk";
import { runInit } from "../cli/initCommand";
import { COMMANDS } from "../commandCatalog";
import { loadConfig, getExtensions, getReportFile, detectFramework } from "../config";
import { explainMessage } from "../explanations";
import { getCurrentBranch, isGitRepository } from "../gitUtils";
// snapshot/history removed from TUI
import { buildHotspots } from "../insights";
import { printSummary } from "../reporters/terminalReporter";
import { scanDependencies } from "../scanners/dependencyScanner";
import { generateWebP, scanImages } from "../scanners/imageScanner";
import { parseSlashCommand } from "../slashCommands";
import { printBanner, printPanel, printGrid } from "../terminalUi";
import {
  applyInteractiveHunkSelection,
  runAccessibilityWorkflow,
  runCompareWorkflow,
  runDoctorWorkflow,
  runExplainWorkflow,
  runFixWorkflow,
  runHealthWorkflow,
  runInteractiveFixWorkflow,
  runPrSummaryWorkflow,
  runReviewWorkflow,
  runScanWorkflow
} from "../cli/workflows";

// presentFollowupMenu returns a command string when the user selects a follow-up
// to execute. The main loop will then run that command and avoid clearing the
// screen so the command output remains visible.
let forceFreshDashboard = false;

async function promptCustomCommand() {
  const inputPrompt = new (Enquirer as any).Input({
    name: "command",
    message: chalk.bold("Command") + chalk.gray(" (or 'a' to exit):"),
    initial: "/",
    prefix: function() { return " "; }
  });

  let interceptedA = false;
  inputPrompt.on("keypress", (ch: string, key: any) => {
    // If the user presses 'a' and the input is empty or just '/', cancel and go back
    if ((ch === "a" || (key && key.name === "a")) && (inputPrompt.input === "" || inputPrompt.input === "/")) {
      interceptedA = true;
      inputPrompt.cancel();
    }
  });

  try {
    const answer = await inputPrompt.run();
    if (answer === "a" || answer === "/a") {
      forceFreshDashboard = true;
      return null;
    }
    return answer;
  } catch {
    forceFreshDashboard = true;
    return null; // Cancelled
  }
}

async function pause(message = "Press 'a' to return to the main menu, or '/' to type another command:") {
  process.stdout.write("\n" + chalk.dim(message) + " ");
  
  const firstChar = await new Promise<string>(resolve => {
    const { stdin } = process;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();

    const onData = (data: Buffer) => {
      const key = data.toString();
      if (key.toLowerCase() === "a" || key === "\u0003") {
        stdin.off("data", onData);
        if (stdin.isTTY) stdin.setRawMode(wasRaw);
        resolve(key);
      } else if (key === "/") {
        stdin.off("data", onData);
        if (stdin.isTTY) stdin.setRawMode(wasRaw);
        resolve("/");
      }
    };

    stdin.on("data", onData);
  });

  if (firstChar.toLowerCase() === "a" || firstChar === "\u0003") {
    forceFreshDashboard = true;
    console.log();
    return null;
  }

  // If '/' was pressed, prompt the user for a command using Enquirer
  console.log();
  return await promptCustomCommand();
}

async function presentFollowupMenu(cwd: string, followups: Array<{ name: string; message: string; value: string | null }>) {
  let current = followups || [];
  while (true) {
    const followupChoices = [
      { name: "return-dashboard", message: "Return to main menu (press 'a')", value: null },
      { name: "custom-command", message: "Type another command (press '/')", value: "custom" },
      ...current.map(f => ({ name: f.name, message: f.message, value: f.value }))
    ];

    try {
      const selectPrompt = new (Enquirer as any).Select({
        name: "follow",
        message: "Choose an action. Press 'a' for the main menu or '/' for another command:",
        choices: followupChoices
      });

      let interceptedAction: string | null = null;
      selectPrompt.on("keypress", (ch: string, key: any) => {
        if (ch === "a" || (key && key.name === "a")) {
          interceptedAction = "a";
          selectPrompt.submit(); // Force submission to break out
        } else if (ch === "/" || (key && key.name === "/")) {
          interceptedAction = "/";
          selectPrompt.submit();
        }
      });

      const selectedResult = await selectPrompt.run();

      // Enquirer returns the choice's `value` by default, but older code assumed
      // it returned the `name`. Match either one so we handle both shapes.
      const selectedChoice = followupChoices.find(c => c.name === selectedResult || c.value === selectedResult);

      // Honor intercepted shortcuts first
      if (interceptedAction === "a") {
        forceFreshDashboard = true;
        return null;
      }
      if (interceptedAction === "/") {
        console.log();
        return await promptCustomCommand();
      }

      // If the user explicitly chose the "return-dashboard" or "custom-command" items
      // the selectedChoice will be present; handle them by name to keep behaviour stable.
      if (selectedChoice && selectedChoice.name === "return-dashboard") {
        forceFreshDashboard = true;
        return null;
      }
      if (selectedChoice && selectedChoice.name === "custom-command") {
        console.log();
        return await promptCustomCommand();
      }

      const cmd = selectedChoice ? selectedChoice.value : null;
      if (!cmd) break;

      // Return the selected follow-up command to the caller (runTui). The main
      // loop will execute it and intentionally avoid clearing the screen so
      // the command's output remains visible to the user.
      return cmd as string;
    } catch (err) {
      if (isPromptCloseError(err) || (err === "")) {
        hardClear();
        console.log(chalk.dim("Leaving better-ui. Bye see you soon 😊"));
        process.exit(0);
      }
      console.error("Error running subcommand:", err);
      break;
    }
  }

  return null;
}

function hardClear() {
  // PowerShell/Windows can be inconsistent with ANSI-only clears, so use both
  // console.clear() and ANSI escape sequences for a reliable fresh screen.
  console.clear();
  process.stdout.write("\x1B[2J\x1B[3J\x1B[H");
}

function isPromptCloseError(error: unknown) {
  const maybeError = error as { code?: string; message?: string } | undefined;
  return maybeError?.code === "ERR_USE_AFTER_CLOSE"
    || maybeError?.message?.includes("readline was closed")
    || false;
}

async function showCommandPalette() {
  try {
    const header = chalk.magenta.bold("Command Palette") + chalk.gray(" — Type to filter, Enter to select, 'a' to close");

    const boxWidth = 90;
    const slashWidth = 22;
    
    const topBorder = chalk.cyan("╭" + "─".repeat(boxWidth) + "╮");
    const bottomBorder = chalk.cyan("╰" + "─".repeat(boxWidth) + "╯");

    const choices = COMMANDS
      .filter(command => command.slash !== "/commands" && command.slash !== "/help")
      .map(command => {
        const slashPad = command.slash.padEnd(slashWidth, " ");
        return {
          name: command.slash,
          message: `  ${chalk.bold.white(slashPad)} ${chalk.gray("-")} ${chalk.dim(command.description)}`,
          value: command.slash
        };
      });

    const palettePrompt = new (Enquirer as any).AutoComplete({
      name: "command",
      message: header,
      limit: 12,
      header: topBorder,
      footer: bottomBorder,
      // @ts-ignore
      prefix: function() { return " "; },
      choices,
      // @ts-ignore
      format: function() { return chalk.cyan(this.input); },
      result: function(name: string) {
        return name;
      }
    });

    let interceptedA = false;
    palettePrompt.on("keypress", (ch: string, key: any) => {
      if ((ch === "a" || (key && key.name === "a")) && !palettePrompt.input) {
        interceptedA = true;
        palettePrompt.cancel();
      }
    });

    const answer = await palettePrompt.run();

    return { shouldExit: false, commandInput: answer as string };
  } catch {
    // If cancelled (e.g. via 'a' or Esc)
    forceFreshDashboard = true; // Force clear screen
    return { shouldExit: false, commandInput: undefined };
  }
}

function readFlag(tokens: string[], flag: string) {
  return tokens.includes(flag);
}

function readOption(tokens: string[], option: string) {
  const index = tokens.indexOf(option);
  return index >= 0 ? tokens[index + 1] : undefined;
}

async function _runSlashCommand(cwd: string, input: string) {
  const tokens = parseSlashCommand(input);
  if (!tokens || tokens.length === 0) {
    printPanel("Slash Command", ["Command not recognized. Try /help or /menu."], "yellow");
    return { shouldExit: false };
  }

  const [command] = tokens;

  if (command === "scan") {
    const start = Date.now();
    const skipHistory = readFlag(tokens, "--skip-history");
    const format = (readOption(tokens, "--format") as "json" | "markdown" | "html" | undefined) || "json";
    const out = readOption(tokens, "--out");

    const result = await runScanWorkflow(cwd, {
      changed: readFlag(tokens, "--changed"),
      staged: readFlag(tokens, "--staged"),
      out,
      format,
      saveHistory: skipHistory ? false : undefined
    });

    const durationMs = Date.now() - start;
    printSummary(result.report);

    // compute extras
    const fixableCount = (result.report.files || []).reduce((sum, f) => sum + (f.messages || []).filter((m: any) => m.fixable).length, 0);
    let top = parseInt(readOption(tokens, "--top") || "5", 10);
    if (!Number.isFinite(top) || top < 1) top = 5;
    const hotspots = buildHotspots(result.report, top);

    const fixableFiles = (result.report.files || [])
      .map(f => ({ filePath: f.filePath, fixables: (f.messages || []).filter((m: any) => m.fixable).length }))
      .filter(x => x.fixables > 0)
      .sort((a, b) => b.fixables - a.fixables)
      .slice(0, Math.max(5, top));

    const categories = Object.entries(result.report.summary?.categories || {}).sort((a: any, b: any) => (b[1] as number) - (a[1] as number));

    // report size
    let reportSizeText = "unknown";
    try {
      if (result.reportPath) {
        const full = path.resolve(cwd, result.reportPath);
        if (fs.existsSync(full)) {
          const st = fs.statSync(full);
          reportSizeText = `${Math.round(st.size / 1024)} KB`;
        }
      }
    } catch {
      // ignore
    }

    printPanel("Scan Output", [
      `${chalk.cyan("Scope:")} ${result.report.scope || "all"}`,
      `${chalk.cyan("Saved report:")} ${result.reportPath ? result.reportPath : "(not written)"}`,
      `${chalk.cyan("History snapshot:")} ${result.snapshotPath ? result.snapshotPath : "disabled"}`,
      `${chalk.cyan("Report size:")} ${reportSizeText}`,
      `${chalk.cyan("Duration:")} ${(durationMs / 1000).toFixed(2)}s`,
      `${chalk.cyan("Files with issues:")} ${result.report.summary.filesWithIssues}`,
      `${chalk.cyan("Total issues:")} ${result.report.summary.totalIssues}`,
      `${chalk.cyan("Autofixable issues:")} ${fixableCount}`
    ], "cyan");

    printPanel("Category Breakdown", categories.length > 0 ? categories.map(([name, count]) => `${chalk.cyan(String(name) + ":")} ${String(count)}`) : ["No categorized issues detected."], "blue");

    printPanel("Hotspots", hotspots.length > 0 ? hotspots.map(h => `${h.filePath}  score=${h.score}  errors=${h.errors}  warnings=${h.warnings}`) : ["No hotspots found."], "red");

    printPanel("Top Fixable Files", fixableFiles.length > 0 ? fixableFiles.map(f => `${f.filePath} (${f.fixables} autofixable)`) : ["No autofixable files found in this scan."], "yellow");

    if (readFlag(tokens, "--scan-images")) {
      try {
        const images = await scanImages(cwd);
        const totalKb = Math.round(images.reduce((s, i) => s + i.size, 0) / 1024);
        printPanel("Image Inventory", [
          `${chalk.cyan("Files:")} ${String(images.length)}`,
          `${chalk.cyan("Total size:")} ${String(totalKb)} KB`,
          ...images.slice(0, 8).map(image => `${image.file} (${Math.round(image.size / 1024)} KB)`)
        ], "magenta");
      } catch (err) {
        console.warn("Image scan failed:", err);
      }
    }

    // Show available flags and follow-up subcommands in the TUI for the user
    const flagLines = [
      "--out <file>    : Report file path (json|md|html)",
      "--format <fmt>  : json, markdown, or html",
      "--scan-images   : Also run image inventory",
      "--skip-history  : Do not save a snapshot to .better-ui/history",
      "--top <n>       : Number of hotspots to display (default 5)",
      "--open          : Open HTML report after generation",
      "--verbose       : Show extended output (paths)"
    ];
    printPanel("Scan Flags", flagLines, "cyan");

    const followups = [
      "/fix --interactive    : Preview autofixes and pick hunks",
      "/fix --apply          : Apply all ESLint autofixes",
      "/review --changed     : Generate PR-style review for modified files",
      "/pr-summary --out pr-summary.md : Generate PR summary markdown",
      "/compare              : Compare with last saved snapshot",
      "/health               : Show health score and category breakdown",
      "/doctor               : Run project doctor checks",
      "/images --generate    : Generate WebP variants for images",
      "/explain <file|report>: Explain findings and suggested fixes"
    ];
    printPanel("Suggested Follow-up Commands", followups, "green");

    // Build follow-up subcommands (do not run them here). These will be offered
    // to the user as an alternative to pressing Enter when pausing the TUI.
    const baseCmd = "/" + tokens.join(" ");
    const choices: Array<{ name: string; message: string; value: string | null }> = [];

    // Re-run scan variants
    if (!readFlag(tokens, "--scan-images")) {
      choices.push({ name: "rerun-images", message: "Re-run scan with images (--scan-images)", value: baseCmd + " --scan-images" });
    }
    if (!readFlag(tokens, "--skip-history")) {
      choices.push({ name: "rerun-skip", message: "Re-run scan skipping history (--skip-history)", value: baseCmd + " --skip-history" });
    }
    if ((readOption(tokens, "--format") || "") !== "html") {
      choices.push({ name: "rerun-html", message: "Re-run and generate HTML and open (--format html --open)", value: baseCmd + " --format html --open" });
    }
    choices.push({ name: "rerun-top10", message: "Re-run scan with top=10 (--top 10)", value: baseCmd + " --top 10" });

    // Common follow-ups
    choices.push({ name: "fix-interactive", message: "Preview autofixes and pick hunks (/fix --interactive)", value: "/fix --interactive" });
    choices.push({ name: "fix-apply", message: "Apply all autofixes (/fix --apply)", value: "/fix --apply" });
    choices.push({ name: "review-changed", message: "Generate PR-style review for changed files (/review --changed)", value: "/review --changed --out review.md" });
    choices.push({ name: "pr-summary", message: "Generate PR summary (/pr-summary --out pr-summary.md)", value: "/pr-summary --out pr-summary.md" });
    choices.push({ name: "compare", message: "Compare with last snapshot (/compare)", value: "/compare" });
    choices.push({ name: "health", message: "Show health and priorities (/health)", value: "/health" });
    choices.push({ name: "doctor", message: "Run project doctor checks (/doctor)", value: "/doctor" });
    choices.push({ name: "images-generate", message: "Generate WebP for images (/images --generate)", value: "/images --generate" });
    choices.push({ name: "explain-report", message: "Explain current report (/explain)", value: "/explain " + (result.reportPath || "") });

    // Return followups to the caller so the TUI can present them as an optional
    // action under the pause prompt (instead of forcing them immediately).
    return { shouldExit: false, followups: choices } as any;
  }

  if (command === "fix") {
    if (readFlag(tokens, "--interactive")) {
      const interactive = await runInteractiveFixWorkflow(cwd, {
        changed: readFlag(tokens, "--changed"),
        staged: readFlag(tokens, "--staged")
      });
      if (interactive.previews.length === 0) {
        printPanel("Interactive Fix", ["No autofixes are available for this scope."], "green");
        return { shouldExit: false };
      }
      const selection: any = await prompt({
        type: "multiselect",
        name: "hunks",
        message: "Select diff blocks to apply",
        choices: interactive.previews.flatMap(preview => preview.hunks.map(hunk => ({
          name: hunk.id,
          message: `${hunk.label} | ${hunk.preview.slice(0, 2).join(" ")}`
        })))
      } as any);
      const selectedHunks = (selection.hunks || []) as string[];
      if (selectedHunks.length === 0) {
        printPanel("Interactive Fix", ["No diff blocks were selected."], "yellow");
        return { shouldExit: false };
      }
      printPanel("Selected Diff Preview", interactive.previews.flatMap(preview => preview.hunks.filter(hunk => selectedHunks.includes(hunk.id)).flatMap(hunk => [hunk.label, ...hunk.preview.slice(0, 4)])).slice(0, 24), "cyan");
      const confirm: any = await prompt({
        type: "confirm",
        name: "approved",
        message: `Apply ${selectedHunks.length} selected diff blocks?`,
        initial: false
      } as any);
      if (!confirm.approved) {
        printPanel("Interactive Fix", ["Cancelled before writing changes."], "yellow");
        return { shouldExit: false };
      }
      const report = await applyInteractiveHunkSelection(cwd, interactive.previews, selectedHunks, {
        changed: readFlag(tokens, "--changed"),
        staged: readFlag(tokens, "--staged")
      });
      printPanel("Interactive Fix Applied", [
        `${chalk.cyan("Blocks applied:")} ${selectedHunks.length}`,
        `${chalk.cyan("Remaining errors:")} ${report.summary.errors}`,
        `${chalk.cyan("Remaining warnings:")} ${report.summary.warnings}`
      ], "green");
      return { shouldExit: false };
    }

    const result = await runFixWorkflow(cwd, {
      apply: readFlag(tokens, "--apply"),
      changed: readFlag(tokens, "--changed"),
      staged: readFlag(tokens, "--staged")
    });
    printPanel(result.preview ? "Fix Preview" : "Fix Applied", [
      `${chalk.cyan("Scope:")} ${result.report.scope || "all"}`,
      `${chalk.cyan("Errors:")} ${result.report.summary.errors}`,
      `${chalk.cyan("Warnings:")} ${result.report.summary.warnings}`
    ], result.preview ? "yellow" : "green");
    return { shouldExit: false };
  }

  if (command === "doctor") {
    const result = await runDoctorWorkflow(cwd);
    printPanel("Doctor Overview", [
      `${chalk.cyan("Score:")} ${result.health.score}/100`,
      `${chalk.cyan("Config completeness:")} ${result.doctor.configCompleteness}`,
      `${chalk.cyan("Scripts present:")} ${result.doctor.scriptsPresent}/${result.doctor.scriptChecks}`
    ], "magenta");
    printPanel("Doctor Findings", [
      result.doctor.missingConfig.length > 0 ? `Missing config fields: ${result.doctor.missingConfig.join(", ")}` : "Config file looks complete.",
      result.doctor.missingScripts.length > 0 ? `Missing helper scripts: ${result.doctor.missingScripts.join(", ")}` : "Helper scripts are present."
    ], "yellow");
    return { shouldExit: false };
  }

  if (command === "health") {
    const result = await runHealthWorkflow(cwd);
    printPanel("Project Health", [
      `${chalk.cyan("Score:")} ${result.health.score}/100`,
      `${chalk.cyan("High impact issues:")} ${result.health.summary.highImpactIssues}`,
      `${chalk.cyan("Safe autofixes:")} ${result.health.summary.safeAutofixes}`
    ], "magenta");
    printPanel("Priorities", result.health.priorities.map(priority => `${priority.label} - ${priority.detail}`), "blue");
    return { shouldExit: false };
  }

  if (command === "deps") {
    printPanel("Dependencies", ["Scanning project for unused and heavy dependencies..."], "yellow");
    const { unusedDependencies, heavyDependencies } = await scanDependencies(cwd);
    
    if (unusedDependencies.length > 0) {
      printPanel("Dead Code / Unused Dependencies", unusedDependencies.map(d => chalk.red(`- ${d}`)), "red");
    } else {
      printPanel("Dead Code / Unused Dependencies", ["All package.json dependencies seem to be used!"], "green");
    }

    if (heavyDependencies.length > 0) {
      printPanel("Heavy Dependencies Detected", heavyDependencies.map(d => chalk.yellow(`- ${d.name}`)), "yellow");
    }
    return { shouldExit: false };
  }

  if (command === "advanced") {
    printGrid([
      {
        title: "Supercharged Scan",
        color: "cyan",
        lines: [
          chalk.yellow("--changed") + "       : Scan only modified/untracked files",
          chalk.yellow("--staged") + "        : Scan only files ready to commit",
          chalk.yellow("--scan-images") + "   : Discover heavy images during scan",
          chalk.yellow("--format html") + "   : Generate a visual dashboard",
          chalk.yellow("--open") + "          : Open the HTML report in your browser"
        ]
      },
      {
        title: "Surgical Fixes",
        color: "green",
        lines: [
          chalk.yellow("/fix --interactive") + " : Pick diffs one by one (Space to select)",
          chalk.yellow("/fix --apply") + "       : Auto-fix everything safely"
        ]
      },
      {
        title: "Pull Requests & Git",
        color: "magenta",
        lines: [
          chalk.yellow("/review --changed") + "  : Generate a Code Review for your diff",
          chalk.yellow("/pr-summary") + "        : Drafts the markdown for your GitHub PR"
        ]
      },
      {
        title: "Hidden Features",
        color: "blue",
        lines: [
          chalk.yellow("Ctrl+Shift+S") + "       : Open the Command Palette from anywhere",
          chalk.yellow("/images --generate") + " : Auto-convert heavy images to .webp"
        ]
      }
    ]);
    return { shouldExit: false };
  }

  if (command === "hotspots") {
    const result = await runScanWorkflow(cwd);
    const hotspots = buildHotspots(result.report, 8);
    printPanel("Hotspots", hotspots.length > 0 ? hotspots.map(hotspot => `${hotspot.filePath}  score=${hotspot.score}`) : ["No hotspots found."], "red");
    return { shouldExit: false };
  }

  if (command === "review") {
    const result = await runReviewWorkflow(cwd, {
      changed: readFlag(tokens, "--changed"),
      staged: readFlag(tokens, "--staged"),
      out: readOption(tokens, "--out")
    });
    printPanel("Review Summary", [
      `${chalk.cyan("Scope:")} ${result.scope}`,
      `${chalk.cyan("Score:")} ${result.report.summary.score}/100`
    ], "cyan");
    console.log(`\n${result.body}\n`);
    return { shouldExit: false };
  }

  if (command === "pr-summary") {
    const result = await runPrSummaryWorkflow(cwd, {
      changed: readFlag(tokens, "--changed"),
      staged: readFlag(tokens, "--staged"),
      out: readOption(tokens, "--out")
    });
    printPanel("PR Summary", [
      `${chalk.cyan("Scope:")} ${result.scope}`,
      `${chalk.cyan("Score:")} ${result.report.summary.score}/100`
    ], "cyan");
    console.log(`\n${result.body}\n`);
    return { shouldExit: false };
  }

  if (command === "check-accessibility") {
    const report = await runAccessibilityWorkflow(cwd, {
      changed: readFlag(tokens, "--changed"),
      staged: readFlag(tokens, "--staged")
    });
    printSummary(report);
    printPanel("Accessibility Guidance", report.files.flatMap(file => file.messages.slice(0, 2).map(message => {
      const explanation = explainMessage(message);
      return `${file.filePath}: ${explanation.fix}`;
    })).slice(0, 12), "blue");
    return { shouldExit: false };
  }

  if (command === "compare") {
    const result = await runCompareWorkflow(cwd);
    if (!result.delta) {
      printPanel("Comparison", ["No previous snapshot exists yet. A baseline has now been saved."], "yellow");
      return { shouldExit: false };
    }
    printPanel("Comparison", [
      `${chalk.cyan("Score delta:")} ${result.delta.scoreDelta}`,
      `${chalk.cyan("Error delta:")} ${result.delta.errorDelta}`,
      `${chalk.cyan("Warning delta:")} ${result.delta.warningDelta}`
    ], "green");
    return { shouldExit: false };
  }

  if (command === "explain") {
    const result = await runExplainWorkflow(cwd, tokens[1]);
    printPanel("Explain", [
      `${chalk.cyan("Target:")} ${result.target}`,
      `${chalk.cyan("Total issues:")} ${result.report.summary.totalIssues}`
    ], "magenta");
    console.log(`\n${result.summary}\n`);
    return { shouldExit: false };
  }

  if (command === "images") {
    const images = await scanImages(cwd);
    printPanel("Image Inventory", images.length > 0 ? images.slice(0, 10).map(image => `${image.file} (${Math.round(image.size / 1024)} KB)`) : ["No images found."], "blue");
    if (readFlag(tokens, "--generate")) {
      const qualityOption = parseInt(readOption(tokens, "--quality") || "75", 10);
      const quality = Number.isFinite(qualityOption) ? qualityOption : 75;
      const generated: string[] = [];
      for (const image of images) {
        try {
          const result = await generateWebP(cwd, image.file, quality);
          generated.push(`${result.out} (${Math.round(result.size / 1024)} KB)`);
        } catch (err) {
          generated.push(`${image.file} (failed: ${String(err)})`);
        }
      }
      printPanel("Generated WebP", generated.slice(0, 12), "magenta");
    }
    return { shouldExit: false };
  }

  if (command === "init") {
    const result = await runInit(cwd, { preset: readOption(tokens, "--preset") });
    printPanel("Setup", ["Configuration updated.", result.openTui ? "The command center is already open here." : "Run /menu later to reopen the TUI."], "green");
    return { shouldExit: false };
  }

  if (command === "commands") {
    return { shouldExit: false, showCatalog: true };
  }

  if (command === "tui") {
    forceFreshDashboard = true;
    return { shouldExit: false, showDashboard: true };
  }

  if (command === "exit") {
    printPanel("Command Center", ["Leaving better-ui. Bye see you soon 😊"], "green");
    return { shouldExit: true };
  }

  printPanel("Slash Command", [`Unsupported command: /${command}`], "red");
  return { shouldExit: false };
}

async function runSlashCommand(cwd: string, input: string) {
  const tokens = parseSlashCommand(input);
  const command = tokens?.[0];
  
  // Do not draw boxes for structural commands
  if (command === "commands" || command === "tui" || command === "exit") {
    return await _runSlashCommand(cwd, input);
  }

  // Draw Top Border
  const termWidth = Math.min(process.stdout.columns || 80, 100);
  const title = ` ${input} `;
  const padLength = Math.max(0, termWidth - 3 - title.length);
  console.log(`\n${chalk.blue("┏━━")}${chalk.bold.yellow(title)}${chalk.blue("━".repeat(padLength) + "┓")}`);

  const result = await _runSlashCommand(cwd, input);

  // Draw Bottom Border
  console.log(`${chalk.blue("┗" + "━".repeat(termWidth - 2) + "┛")}\n`);

  return result;
}

export async function runTui() {
  process.on("uncaughtException", (err: any) => {
    if (isPromptCloseError(err)) {
      hardClear();
      console.log(chalk.dim("Leaving better-ui. Bye see you soon 😊"));
      process.exit(0);
    }
  });

  process.on("unhandledRejection", (err: any) => {
    if (isPromptCloseError(err)) {
      hardClear();
      console.log(chalk.dim("Leaving better-ui. Bye see you soon 😊"));
      process.exit(0);
    }
  });

  const cwd = process.cwd();
  let nextCommandToRun: string | null = null;
  let skipClearOnNextDashboard = false;
  let hasRenderedDashboard = false;

  while (true) {
    let commandInput = "";
    
    if (!nextCommandToRun) {
      const config = loadConfig(cwd);
      const defaultExts = getExtensions(config) || [".js", ".jsx", ".ts", ".tsx"];
      const reportPath = getReportFile(cwd, config);
      const gitEnabled = isGitRepository(cwd);
      const stack = detectFramework(cwd);

      if (!hasRenderedDashboard || forceFreshDashboard) {
        hardClear();
      }
      skipClearOnNextDashboard = false;
      forceFreshDashboard = false;
      hasRenderedDashboard = true;
      printBanner();
      
      printGrid([
        {
          title: "Workspace Dashboard",
          color: "magenta",
          lines: [
            `${chalk.cyan("Path:")} ${cwd}`,
            `${chalk.cyan("Stack:")} ${stack.join(" + ")}`,
            `${chalk.cyan("Report:")} ${path.basename(reportPath)}`,
            `${chalk.cyan("Extensions:")} ${defaultExts.join(", ")}`,
            `${chalk.cyan("Git:")} ${gitEnabled ? getCurrentBranch(cwd) || "attached" : "not a repository"}`
          ]
        },
        {
          title: "Quick Actions",
          color: "cyan",
          lines: [
            "Type a slash command below (e.g. /scan, /deps).",
            "Type /advanced to see pro-tips and subcommands.",
            "Type /commands or press Ctrl+Shift+S for the palette."
          ]
        }
      ]);

      const input = new Input({
        name: "action",
        message: chalk.bold("What do you want to do? Type a slash command starting with '/'."),
        initial: "/"
      });

      let showCatalog = false;
      let exitFromPrompt = false;
      const onCatalogData = (chunk: Buffer) => {
        if (chunk[0] === 19) {
          showCatalog = true;
          try { (input as any).cancel(); } catch (_) {}
          return;
        }

        if (chunk[0] === 3) {
          exitFromPrompt = true;
          try { (input as any).cancel(); } catch (_) {}
          return;
        }

        if (chunk[0] === 27 && chunk.length === 1) {
          exitFromPrompt = true;
          try { (input as any).cancel(); } catch (_) {}
        }
      };

      input.on("keypress", (_ch: any, key: any) => {
        if (key && key.ctrl && key.name === "s") {
          showCatalog = true;
          try { (input as any).cancel(); } catch (_) {}
          return;
        }

        if (key && key.ctrl && key.name === "c") {
          exitFromPrompt = true;
          try { (input as any).cancel(); } catch (_) {}
        }
      });

      if (process.stdin) {
        process.stdin.on("data", onCatalogData);
      }

      try {
        const answer = await input.run();
        if (process.stdin) {
          process.stdin.off("data", onCatalogData);
        }

        if (showCatalog) {
          const catalog = await showCommandPalette();
          showCatalog = false;
          if (catalog.commandInput) {
            const selected = await runSlashCommand(cwd, catalog.commandInput);
            if (selected.showCatalog) {
              continue;
            }
            if (selected.shouldExit) {
              hardClear();
              console.log(chalk.dim("Leaving better-ui. Bye see you soon 😊"));
              process.exit(0);
            }
            if (selected.showDashboard) {
              nextCommandToRun = null;
              continue;
            }
            if (selected.followups && Array.isArray(selected.followups) && selected.followups.length > 0) {
              const followup = await presentFollowupMenu(cwd, selected.followups);
              if (followup) {
                nextCommandToRun = followup;
                skipClearOnNextDashboard = true;
              } else {
                nextCommandToRun = null;
              }
            } else {
              nextCommandToRun = await pause();
            }
          }
          continue;
        }

        if (exitFromPrompt) {
          hardClear();
          console.log(chalk.dim("Leaving better-ui. Bye see you soon 😊"));
          process.exit(0);
        }

        commandInput = (answer || "").toString().trim();
      } catch (err) {
        if (process.stdin) {
          process.stdin.off("data", onCatalogData);
        }
  
        if (exitFromPrompt) {
          hardClear();
          console.log(chalk.dim("Leaving better-ui. Bye see you soon 😊"));
          process.exit(0);
        }
  
          if (showCatalog) {
            const catalog = await showCommandPalette();
            showCatalog = false;
            if (catalog.commandInput) {
              const selected = await runSlashCommand(cwd, catalog.commandInput);
              if (selected.shouldExit) {
                hardClear();
                console.log(chalk.dim("Leaving better-ui. Bye see you soon 😊"));
                process.exit(0);
              }
              if (selected.showDashboard) {
                nextCommandToRun = null;
                continue;
              }
              if (selected.followups && Array.isArray(selected.followups) && selected.followups.length > 0) {
                const followup = await presentFollowupMenu(cwd, selected.followups);
                if (followup) {
                  nextCommandToRun = followup;
                  skipClearOnNextDashboard = true;
                } else {
                  nextCommandToRun = null;
                }
              } else {
                nextCommandToRun = await pause();
              }
            }
            continue;
          }
  
        if (isPromptCloseError(err)) {
          hardClear();
          console.log(chalk.dim("Leaving better-ui. Bye see you soon 😊"));
          process.exit(0);
        }
  
        console.error("TUI error:", err);
        nextCommandToRun = await pause("An error occurred. Press 'a' to return to the main menu, or '/' to type another command:");
        continue;
      }
    } else {
      commandInput = nextCommandToRun;
      nextCommandToRun = null;
      // We don't clear the screen here so chained commands
      // appear below the previous output.
    }

    if (!commandInput.startsWith("/")) {
      printPanel("Slash Command", ["Please type a command that starts with '/' (e.g. /scan --format json)"], "yellow");
      nextCommandToRun = await pause();
      continue;
    }

     const result = await runSlashCommand(cwd, commandInput);
      if (result.showCatalog) {
        const catalog = await showCommandPalette();
        if (catalog.commandInput) {
          const selected = await runSlashCommand(cwd, catalog.commandInput);
          if (selected.shouldExit) {
            hardClear();
            console.log(chalk.dim("Leaving better-ui. Bye see you soon 😊"));
            process.exit(0);
          }
          if (selected.showDashboard) {
            nextCommandToRun = null;
            continue;
          }
          if (selected.followups && Array.isArray(selected.followups) && selected.followups.length > 0) {
            const followup = await presentFollowupMenu(cwd, selected.followups);
            if (followup) {
              nextCommandToRun = followup;
              skipClearOnNextDashboard = true;
            } else {
              nextCommandToRun = null;
            }
          } else {
            nextCommandToRun = await pause();
          }
          }
        continue;
      }

     if (result.showDashboard) {
       nextCommandToRun = null;
       continue;
     }

     if (result.shouldExit) {
       hardClear();
       console.log(chalk.dim("Leaving better-ui. Bye see you soon 😊"));
       process.exit(0);
     }

      // If the command returned followups, offer the execute-subcommand menu
      if (result.followups && Array.isArray(result.followups) && result.followups.length > 0) {
        const followup = await presentFollowupMenu(cwd, result.followups);
        if (followup) {
          nextCommandToRun = followup;
          skipClearOnNextDashboard = true;
        } else {
          nextCommandToRun = null;
        }
      } else {
        nextCommandToRun = await pause();
      }
  }
}
