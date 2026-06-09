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
import { printBanner, printPanel, printGrid, formatDelta, formatElapsed, printRunSummary, groupMessages, groupMessagesByRule } from "../terminalUi";
import { INIT_NOTE, IMAGES_WEBP_NOTE } from "../commandText";
import {
  applyInteractiveHunkSelection,
  runAccessibilityWorkflow,
  runDoctorWorkflow,
  runExplainWorkflow,
  runFixWorkflow,
  runHealthWorkflow,
  runInteractiveFixWorkflow,
  runScanWorkflow,
  runSeoWorkflow,
  runTechDebtWorkflow,
  runPerformanceWorkflow,
  runStackAuditWorkflow,
  runMigrationWorkflow,
  runFeScoreWorkflow,
} from "../cli/workflows";
import { renderSeoReport } from "../renderers/seoRenderer";
import { renderTechDebtReport } from "../renderers/techDebtRenderer";
import { renderPerformanceReport } from "../renderers/performanceRenderer";
import { renderStackAuditReport } from "../renderers/stackAuditRenderer";
import { renderMigrationReport } from "../renderers/migrationRenderer";
import { renderFeScoreReport } from "../renderers/feScoreRenderer";
import { formatRelatedCommands } from "../relatedCommands";
import { scanColors, scanStandards, scanTypography, scanSpacing } from "../uiTools";

const altMap: Record<string, string> = {
  "lodash": "native Array/Map/Set methods or radashi",
  "moment": "Day.js (2kB) or date-fns",
  "moment-timezone": "Day.js + utc plugin (2kB)",
  "rxjs": "native async/await + AbortController",
  "three": "you may actually need this — if not, try regl or twgl",
  "echarts": "Chart.js (1/3 the size) or uPlot",
  "d3": "d3-selection only instead of full d3"
};

function categoryRecommendations(category: string): string[] {
  const recs: Record<string, string[]> = {
    "maintainability": ["Split large files into smaller modules", "Extract repeated logic into shared utilities", "Use consistent file naming conventions"],
    "accessibility": ["Add aria-* attributes to interactive elements", "Ensure sufficient color contrast", "Add keyboard navigation support", "Use semantic HTML elements"],
    "performance": ["Optimize and compress images", "Lazy-load heavy components", "Tree-shake unused exports", "Avoid unnecessary re-renders"],
    "code-quality": ["Remove unused variables and imports", "Use strict equality (===) over loose (==)", "Add JSDoc/TSDoc to public APIs", "Fix console.log statements"],
    "correctness": ["Fix all errors before deployment", "Add proper error boundaries", "Validate edge cases in conditionals"],
    "dx": ["Standardize import paths with aliases", "Add pre-commit hooks for linting", "Create consistent component patterns"]
  };
  return recs[category] || [];
}

function printRelatedCommands(key: string) {
  printPanel("Next Best Moves", formatRelatedCommands(key), "cyan");
}

function normalizeCommandText(value: string) {
  return value.toLowerCase().replace(/^\//, "");
}

function suggestCommands(input: string, limit = 4) {
  const query = normalizeCommandText(input).trim();
  if (!query) {
    return ["/scan", "/health", "/fix --interactive", "/commands"];
  }

  const ranked = COMMANDS
    .map((command) => {
      const slash = normalizeCommandText(command.slash);
      const name = normalizeCommandText(command.name);
      let score = 0;
      if (slash === query || name === query) score += 10;
      if (slash.startsWith(query) || name.startsWith(query)) score += 6;
      if (slash.includes(query) || name.includes(query)) score += 3;
      return { slash: command.slash, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return [...new Set(ranked.map((entry) => entry.slash))].slice(0, limit);
}

function printCommandSuggestions(input: string, title = "Suggested Commands") {
  const suggestions = suggestCommands(input);
  if (suggestions.length === 0) return;
  printPanel(title, suggestions.map((command) => `${chalk.bold(command)} ${chalk.dim("Try this next")}`), "cyan");
}

function resolveCommandVariant(tokens: string[]) {
  const [command] = tokens;
  if (command === "scan") {
    if (readFlag(tokens, "--changed")) return "scan-changed";
    if (readFlag(tokens, "--staged")) return "scan-staged";
    return "scan";
  }
  if (command === "fix") {
    if (readFlag(tokens, "--interactive")) return "fix-interactive";
    if (readFlag(tokens, "--apply")) return "fix-apply";
    return "fix-preview";
  }
  if (command === "images") {
    return readFlag(tokens, "--generate") ? "images-generate" : "images";
  }
  return command;
}

const COMMAND_HEADLINES: Record<string, { title: string; tone: string; color: "magenta" | "cyan" | "yellow" | "green" | "blue" | "red" }> = {
  "scan": { title: "Scan Mission", tone: "Full sweep running. Use this as the baseline for quality, risk, and fixability.", color: "cyan" },
  "scan-changed": { title: "Change Lens", tone: "Focused on the files you are actively moving. Fast feedback, less noise.", color: "cyan" },
  "scan-staged": { title: "Commit Gate", tone: "Only staged work is under inspection. Ideal right before commit or PR.", color: "cyan" },
  "fix-preview": { title: "Repair Preview", tone: "Nothing is written yet. Review the safe fixes before you commit to them.", color: "yellow" },
  "fix-apply": { title: "Repair Pass", tone: "Safe fixes are being written. Re-scan afterwards to prove the improvement.", color: "green" },
  "fix-interactive": { title: "Surgical Fix Mode", tone: "Choose hunks carefully. Precision beats bulk changes in legacy code.", color: "green" },
  "doctor": { title: "Project Readiness", tone: "Configuration, scripts, and foundations first. Build on solid ground.", color: "magenta" },
  "health": { title: "Health Brief", tone: "This is the strategic view: category scores, pressure points, and next priorities.", color: "blue" },
  "deps": { title: "Dependency Audit", tone: "Trim dead weight, spot oversized packages, and keep the frontend lean.", color: "yellow" },
  "advanced": { title: "Operator Guide", tone: "High-leverage flags and faster workflows for people who want the sharp tools.", color: "magenta" },
  "hotspots": { title: "Priority Queue", tone: "These files are your leverage points. Fix them first to move the score fastest.", color: "red" },
  "check-accessibility": { title: "Accessibility Pass", tone: "Accessibility is not decoration. This pass isolates barriers before they ship.", color: "blue" },

  "explain": { title: "Rule Translator", tone: "Turn raw findings into intent, impact, and the shortest correct fix.", color: "yellow" },
  "seo": { title: "SEO Audit", tone: "Meta tags, Open Graph, structured data, and content quality — find what search engines see.", color: "blue" },
  "images": { title: "Asset Pass", tone: "Image weight is frontend performance. Audit the payload before it hurts users.", color: "blue" },
  "images-generate": { title: "Asset Optimization", tone: "Compression is being turned into concrete bytes saved, not just good intentions.", color: "green" },
  "init": { title: "Setup Concierge", tone: "Bootstrapping the project so the rest of the toolchain has something solid to stand on.", color: "green" },
  "commands": { title: "Command Index", tone: "This is the operating surface. Know the tools, then move with intent.", color: "magenta" },
  "ui-colors": { title: "Color Palette Scan", tone: "Every hex, rgb, and Tailwind color class across the project. Know your palette.", color: "magenta" },
  "ui-standards": { title: "Standards Review", tone: "Naming, exports, props, and complexity — component hygiene matters.", color: "cyan" },
  "ui-typography": { title: "Typography Audit", tone: "Font families, sizes, line-heights, weights — the typography DNA of the project.", color: "magenta" },
  "ui-spacing": { title: "Spacing Scan", tone: "Margins, paddings, gaps — find spacing inconsistencies across the UI.", color: "blue" },
  "tech-debt": { title: "Tech Debt Scan", tone: "TODOs, FIXMEs, console.log, any types — find the hidden cost of speed.", color: "yellow" },
  "performance": { title: "Performance Audit", tone: "Images, render-blocking, bundle hints, and caching — find what slows down the UX.", color: "magenta" },
  "stack-audit": { title: "Stack Analysis", tone: "Frameworks, build tools, test runners, and CI — know your toolchain.", color: "cyan" },
  "migration": { title: "Migration Readiness", tone: "Legacy patterns, deprecated APIs, and upgrade paths — plan your next migration.", color: "yellow" },
  "fe-score": { title: "Frontend Score", tone: "Consolidated health score combining SEO, tech debt, performance, stack, and migration.", color: "green" }
};

function printCommandHeadline(key: string) {
  const entry = COMMAND_HEADLINES[key];
  if (!entry) return;
  printPanel(entry.title, [entry.tone], entry.color);
}

function formatDiagnosticLine(msg: { ruleId?: string | null; line?: number | null; column?: number | null; message: string }, filePath?: string): string {
  const rule = msg.ruleId ? chalk.cyan(msg.ruleId) : chalk.dim("general");
  const loc = msg.line !== null ? chalk.gray(`:${msg.line}${msg.column !== null ? `:${msg.column}` : ""}`) : "";
  const text = msg.message.length > 100 ? msg.message.slice(0, 100) + "…" : msg.message;
  const pathPart = filePath ? `${chalk.white(filePath)}${loc}  ` : "";
  return `  ${pathPart}${rule}  ${chalk.dim(text)}`;
}

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
    return null;
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
        resolve(key);
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
      .sort((a, b) => a.slash.localeCompare(b.slash))
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

    const originalUp = palettePrompt.up.bind(palettePrompt);
    const originalDown = palettePrompt.down.bind(palettePrompt);

    palettePrompt.up = function() {
      const firstVisible = this.visible[0];
      if (this.index === 0 && firstVisible?.name === "/a11y") {
        return this.alert();
      }
      return originalUp();
    };

    palettePrompt.down = function() {
      const lastVisible = this.visible[this.visible.length - 1];
      if (this.index === this.visible.length - 1 && lastVisible?.name === "/ui-typography") {
        return this.alert();
      }
      return originalDown();
    };

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

// Always ask the user for output format (markdown | json | html).
// If the command includes --format, use it as the initial selection but
// still prompt in the TUI and prefer the interactive response.
async function askForFormat(tokensOrProvided: string[] | string | undefined,
  maybeProvided?: string) {
  let provided: string | undefined;
  if (Array.isArray(tokensOrProvided)) provided = (readOption(tokensOrProvided, "--format") as string | undefined);
  else provided = (tokensOrProvided as string | undefined) || maybeProvided;
  provided = provided || "json";
  const choices = ["markdown", "json", "html"];
  const initial = (typeof provided === "string" && choices.indexOf(provided) >= 0) ? provided : "json";
  try {
    const answer: any = await prompt({
      type: "select",
      name: "format",
      message: "Output format:",
      choices,
      initial
    } as any);
    return (answer.format || initial) as "json" | "markdown" | "html";
  } catch (err) {
    return provided as "json" | "markdown" | "html";
  }
}

async function _runSlashCommand(cwd: string, input: string) {
  const tokens = parseSlashCommand(input);
  if (!tokens || tokens.length === 0) {
    printPanel("Slash Command", ["Command not recognized. Try /commands or /menu."], "yellow");
    printCommandSuggestions(input, "Closest Matches");
    return { shouldExit: false };
  }

  const [command] = tokens;
  const variant = resolveCommandVariant(tokens);

  if (command !== "commands" && command !== "tui" && command !== "exit") {
    printCommandHeadline(variant);
  }

  if (command === "scan") {
    const start = Date.now();
    const outProvided = readOption(tokens, "--out");
    const noSaveFlag = readFlag(tokens, "--no-save");
    let outPath: string | undefined = outProvided;
    let chosenFormat: "json" | "markdown" | "html" | undefined = undefined;

    if (!outProvided && !noSaveFlag) {
      try {
        const cfg = loadConfig(cwd);
        const defaultPreviewPath = getReportFile(cwd, cfg, undefined, undefined as any, "scan", false);
        const saveAnswer: any = await prompt({ type: "confirm", name: "save", message: `Save report? (default path: ${defaultPreviewPath})`, initial: true } as any);
        if (saveAnswer.save) {
          chosenFormat = await askForFormat(tokens, readOption(tokens, "--format"));
          outPath = getReportFile(cwd, cfg, undefined, chosenFormat, "scan");
        } else {
          outPath = undefined;
        }
      } catch (err) {
        chosenFormat = await askForFormat(tokens, readOption(tokens, "--format"));
        const cfg = loadConfig(cwd);
        outPath = getReportFile(cwd, cfg, undefined, chosenFormat, "scan");
      }
    } else if (noSaveFlag) {
      outPath = undefined;
    } else if (outProvided) {
      chosenFormat = await askForFormat(tokens, readOption(tokens, "--format"));
    }

    const result = await runScanWorkflow(cwd, {
      changed: readFlag(tokens, "--changed"),
      staged: readFlag(tokens, "--staged"),
      out: outPath,
      format: chosenFormat,
      command: "scan",
      writeReport: typeof outPath === "string"
    });

    const durationMs = Date.now() - start;
    printSummary(result.report);

    // compute extras
    const fixableCount = (result.report.files || []).reduce((sum, f) => sum + (f.messages || []).filter((m: any) => m.fixable).length, 0);
    let top = parseInt(readOption(tokens, "--top") || "5", 10);
    if (!Number.isFinite(top) || top < 1) top = 5;
    const hotspots = buildHotspots(result.report, cwd, top);

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
      `${chalk.cyan("Report size:")} ${reportSizeText}`,
      `${chalk.cyan("Duration:")} ${formatElapsed(durationMs)}`,
      `${chalk.cyan("Files with issues:")} ${result.report.summary.filesWithIssues}`,
      `${chalk.cyan("Total issues:")} ${result.report.summary.totalIssues}`,
      `${chalk.cyan("Autofixable issues:")} ${fixableCount}`,
      "",
      chalk.dim("Reports are saved under the shown path. To disable saving, run with --no-save or set defaults.reportFile to an empty value in your better-ui config.")
    ], "cyan");

    if (categories.length > 0) {
      for (const [catName, count] of categories) {
        const catFiles = result.report.files
          .map(f => ({ filePath: f.filePath, messages: f.messages.filter((m: any) => (m.category || "maintainability") === catName) }))
          .filter(f => f.messages.length > 0);
        if (catFiles.length === 0) continue;
        const catLines: string[] = [`${chalk.cyan("Issues:")} ${String(count)}`];
        for (const cf of catFiles) {
          for (const { first, count: gCount } of groupMessagesByRule(cf.messages)) {
            const line = formatDiagnosticLine(first, cf.filePath);
            const suffix = gCount > 1 ? chalk.yellow(`  +${gCount - 1} more`) : "";
            catLines.push(line + suffix);
          }
        }
        const titleStr = String(catName).charAt(0).toUpperCase() + String(catName).slice(1);
        printPanel(titleStr, catLines, "blue");
      }
    } else {
      printPanel("Category Breakdown", ["No categorized issues detected."], "blue");
    }

    const hotspotLines: string[] = [];
    if (hotspots.length > 0) {
      for (const h of hotspots) {
        const densityBadge = h.density > 10 ? chalk.red(`🔥${h.density}`) : h.density > 3 ? chalk.yellow(`⚡${h.density}`) : `${h.density}`;
        const lineStr = h.lineCount > 0 ? chalk.dim(`${h.lineCount} lines`) : "";
        hotspotLines.push(`  ${chalk.white(h.filePath)}`);
        hotspotLines.push(`    ${chalk.cyan("Score:")} ${h.score}  ${chalk.red("Errors:")} ${h.errors}  ${chalk.yellow("Warnings:")} ${h.warnings}  ${chalk.dim(h.topCategory)}  ${lineStr}  ${chalk.dim("density:")} ${densityBadge}`);
        hotspotLines.push("");
      }
      hotspotLines.pop();
    } else {
      hotspotLines.push("No hotspots found.");
    }
    printPanel("Hotspots", hotspotLines, "red");

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

    // Related commands
    printRelatedCommands(readFlag(tokens, "--changed") ? "scan-changed" : readFlag(tokens, "--staged") ? "scan-staged" : "scan");

    return { shouldExit: false };
  }

    if (command === "fix") {
    if (readFlag(tokens, "--interactive")) {
      const interactive = await runInteractiveFixWorkflow(cwd, {
        changed: readFlag(tokens, "--changed"),
        staged: readFlag(tokens, "--staged")
      });
      if (interactive.previews.length === 0) {
        printPanel("Interactive Fix", ["No autofixes are available for this scope."], "green");
        printRelatedCommands("fix-interactive");
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
        printRelatedCommands("fix-interactive");
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
        printRelatedCommands("fix-interactive");
        return { shouldExit: false };
      }
      const report = await applyInteractiveHunkSelection(cwd, interactive.previews, selectedHunks, {
        changed: readFlag(tokens, "--changed"),
        staged: readFlag(tokens, "--staged")
      });
      const touchedFiles = [...new Set(interactive.previews.filter(preview => preview.hunks.some(hunk => selectedHunks.includes(hunk.id))).map(preview => preview.filePath))];
      const fixParts: string[] = [];
      for (const tf of touchedFiles) {
        const fileAfter = report.files.find(f => f.filePath === tf);
        if (fileAfter) {
          fixParts.push(`  ${chalk.white(tf)}  ${chalk.red(String(fileAfter.errorCount))} errors, ${chalk.yellow(String(fileAfter.warningCount))} warnings`);
        }
      }
      printPanel("Interactive Fix Applied", [
        `${chalk.cyan("Files updated:")} ${touchedFiles.length}`,
        `${chalk.cyan("Blocks applied:")} ${selectedHunks.length}`,
        `${chalk.cyan("Remaining errors:")} ${report.summary.errors}`,
        `${chalk.cyan("Remaining warnings:")} ${report.summary.warnings}`,
        `${chalk.cyan("Score:")} ${report.summary.score}/100`,
        "",
        ...fixParts
      ], "green");
      printRelatedCommands("fix-interactive");
      return { shouldExit: false };
    }

    const result = await runFixWorkflow(cwd, {
      apply: readFlag(tokens, "--apply"),
      changed: readFlag(tokens, "--changed"),
      staged: readFlag(tokens, "--staged")
    });

    if (result.previews.length === 0) {
      printPanel("Fix", ["No ESLint autofixes are currently available for the selected scope."], "green");
      printRelatedCommands("fix");
      return { shouldExit: false };
    }

    if (!result.report) {
      const previewLines: string[] = [
        `${chalk.cyan("Scope:")} ${readFlag(tokens, "--staged") ? "staged" : readFlag(tokens, "--changed") ? "changed" : "all"}`,
        `${chalk.cyan("Files with autofixes:")} ${result.previews.length}`,
        ""
      ];
      for (const preview of result.previews) {
        const changedDesc = preview.changedLines > 0 ? `${preview.changedLines} lines changed` : `${preview.hunks.length} change(s)`;
        previewLines.push(`  ${chalk.white(preview.filePath)}  ${chalk.dim(`(${changedDesc})`)}`);
        for (const hunk of preview.hunks.slice(0, 3)) {
          for (const line of hunk.preview.slice(0, 4)) {
            previewLines.push(`    ${line}`);
          }
          if (hunk.preview.length > 4) {
            previewLines.push(`    ${chalk.dim(`… ${hunk.preview.length - 4} more lines`)}`);
          }
        }
      }
      previewLines.push("", chalk.dim("Re-run with --apply to write autofixes or --interactive for hunk-level selection."));
      printPanel("Fix Preview", previewLines, "yellow");
      printRelatedCommands("fix-preview");
    } else {
      const remaining = result.report.summary.errors + result.report.summary.warnings;
      const fixedFiles = result.report.files.filter(f => f.messages.some(m => m.fixable)).length;
      const fixedCount = result.report.files.reduce((sum, f) => sum + f.messages.filter(m => m.fixable).length, 0);
      const fixResultLines = [
        `${chalk.cyan("Remaining errors:")} ${chalk.red(String(result.report.summary.errors))}`,
        `${chalk.cyan("Remaining warnings:")} ${chalk.yellow(String(result.report.summary.warnings))}`,
        `${chalk.cyan("Score:")} ${result.report.summary.score}/100`,
        remaining === 0 ? chalk.green("✓ All issues resolved!") : chalk.dim("Review the updated files before committing."),
        "",
        chalk.dim(`Files with remaining fixable issues: ${fixedFiles} (${fixedCount} issues)`)
      ];
      if (fixedFiles > 0) {
        for (const file of result.report.files) {
          const fixable = file.messages.filter(m => m.fixable);
          if (fixable.length === 0) continue;
          fixResultLines.push(`  ${chalk.white(file.filePath)}  ${chalk.dim("(" + fixable.length + " remaining)")}`);
        }
      }
      printPanel("Fix Applied", fixResultLines, "green");
      printRelatedCommands("fix-apply");
    }
    return { shouldExit: false };
  }

  if (command === "doctor") {
    const result = await runDoctorWorkflow(cwd);
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8")) as { name?: string; scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const projectName = pkg.name || path.basename(cwd);

    const cfgFields: Record<string, { recommended: string; hint: string }> = {
      "projectName": { recommended: `"${projectName}"`, hint: "Used in report headers and metadata" },
      "preset": { recommended: `"react", "next", "vite", "vue", "landing-page", "typescript-library"`, hint: "Enables preset-specific rules and defaults" },
      "defaults.reportFile": { recommended: `"report.txt"`, hint: "Default output path for scan reports" },
      "defaults.extensions": { recommended: `[".js", ".jsx", ".ts", ".tsx"]`, hint: "File extensions the scanner will process" }
    };
    const cfgLines: string[] = [];
    for (const [field, info] of Object.entries(cfgFields)) {
      if (result.doctor.missingConfig.includes(field)) {
        cfgLines.push(`  ${chalk.red("✗")} ${chalk.bold(field)}  ${chalk.dim("→ " + info.recommended)}`);
        cfgLines.push(`    ${chalk.dim(info.hint)}`);
      } else {
        cfgLines.push(`  ${chalk.green("✓")} ${chalk.bold(field)}`);
      }
    }
    if (cfgLines.length > 0) {
      printPanel("Config Audit", cfgLines, "yellow");
    }

    const scriptLines: string[] = [];
    const scriptChecks = ["better-ui:scan", "better-ui:fix", "better-ui:tui", "better-ui:health", "better-ui:doctor", "better-ui:a11y", "better-ui:init"];
    for (const script of scriptChecks) {
      const existing = pkg.scripts?.[script];
      if (existing) {
        scriptLines.push(`  ${chalk.green("✓")} ${chalk.bold(script)}  ${chalk.dim("→ " + existing)}`);
      } else {
        scriptLines.push(`  ${chalk.red("✗")} ${chalk.bold(script)}  ${chalk.dim("(not configured)")}`);
      }
    }
    const scriptPanelTitle = `Scripts  (${scriptChecks.length - result.doctor.missingScripts.length}/${scriptChecks.length} present)`;
    printPanel(scriptPanelTitle, scriptLines, "blue");

    const eslintPath = path.join(cwd, "eslint.config.mjs");
    let eslintLines: string[] = [];
    if (fs.existsSync(eslintPath)) {
      const eslintContent = fs.readFileSync(eslintPath, "utf8");
      const enableRules = [...eslintContent.matchAll(/"([^"]+)":\s*"(error|warn)"/g)].map(m => `${m[1]} (${m[2]})`);
      const disableRules = [...eslintContent.matchAll(/"([^"]+)":\s*"off"/g)].map(m => m[1]);
      const ignoredPaths = [...eslintContent.matchAll(/ignores:\s*\[([^\]]+)\]/g)].flatMap(m => m[1].split(",").map(s => s.trim().replace(/['"]/g, "")));
      if (enableRules.length > 0) eslintLines.push(`  ${chalk.green("Enabled:")} ${enableRules.join(", ")}`);
      if (disableRules.length > 0) eslintLines.push(`  ${chalk.yellow("Disabled:")} ${disableRules.join(", ")}`);
      if (ignoredPaths.length > 0) eslintLines.push(`  ${chalk.dim("Ignored:")} ${ignoredPaths.join(", ")}`);
      eslintLines.push(`  ${chalk.dim("Files:")} **/*.{js,cjs,mjs,ts,tsx}  ${chalk.dim("Parser:")} @typescript-eslint/parser`);
    } else {
      eslintLines.push("  No ESLint configuration found.");
    }
    printPanel("ESLint Config", eslintLines, "cyan");

    const tsconfigPath = path.join(cwd, "tsconfig.json");
    let tsLines: string[] = [];
    if (fs.existsSync(tsconfigPath)) {
      try {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8")) as { compilerOptions?: Record<string, unknown> };
        const co = tsconfig.compilerOptions || {};
        tsLines.push(`  ${chalk.cyan("Target:")} ${String(co.target || "not set")}`);
        tsLines.push(`  ${chalk.cyan("Module:")} ${String(co.module || "not set")}`);
        tsLines.push(`  ${co.strict === true ? chalk.green("✓ Strict mode enabled") : chalk.red("✗ Strict mode NOT enabled")}`);
      } catch {
        tsLines.push("  Could not parse tsconfig.json");
      }
    } else {
      tsLines.push("  No TypeScript config found.");
    }
    printPanel("TypeScript Config", tsLines, "cyan");

    const frameworks = detectFramework(cwd);
    let depCount = 0;
    if (pkg.dependencies) depCount += Object.keys(pkg.dependencies).length;
    if (pkg.devDependencies) depCount += Object.keys(pkg.devDependencies).length;
    printPanel("Project Profile", [
      `${chalk.cyan("Name:")} ${chalk.bold(projectName)}`,
      `${chalk.cyan("Stack:")} ${frameworks.join(", ")}`,
      `${chalk.cyan("Dependencies:")} ${depCount} packages (${Object.keys(pkg.dependencies || {}).length} runtime + ${Object.keys(pkg.devDependencies || {}).length} dev)`,
      `${chalk.cyan("Images:")} ${result.health.summary.images} assets (${Math.round(result.health.summary.imageBytes / 1024)} KB)`,
      `${chalk.cyan("Autofixable:")} ${result.health.summary.safeAutofixes} issues  ${chalk.cyan("High impact:")} ${result.health.summary.highImpactIssues}`
    ], "magenta");
    printRelatedCommands("doctor");
    return { shouldExit: false };
  }

  if (command === "health") {
    const result = await runHealthWorkflow(cwd);

    const activeCategories = Object.entries(result.health.categories)
      .filter(([, cat]) => cat.count > 0)
      .sort(([, a], [, b]) => b.count - a.count);

    for (const [catName, catInfo] of activeCategories) {
      const catFiles = result.report.files
        .map(f => ({ filePath: f.filePath, messages: f.messages.filter(m => (m.category || "maintainability") === catName) }))
        .filter(f => f.messages.length > 0);
      const lines: string[] = [
        `${chalk.cyan("Score:")} ${catInfo.score}/100  ${chalk.cyan("Issues:")} ${catInfo.count}`,
        ""
      ];
      for (const cf of catFiles) {
        for (const { first, count: gCount } of groupMessagesByRule(cf.messages)) {
          const line = formatDiagnosticLine(first, cf.filePath);
          const suffix = gCount > 1 ? chalk.yellow(`  +${gCount - 1} more`) : "";
          lines.push(line + suffix);
        }
      }
      if (lines.length > 0) {
        const recs = categoryRecommendations(catName);
        if (recs.length > 0) {
          lines.push("", chalk.dim("Recommendations:"));
          for (const rec of recs) {
            lines.push(`  ${chalk.green("→")} ${rec}`);
          }
        }
      }
      const titleStr = (catInfo.label || catName).charAt(0).toUpperCase() + (catInfo.label || catName).slice(1);
      printPanel(titleStr, lines.length > 0 ? lines : ["No issues found in this category."], "blue");
    }

    if (result.health.summary.images > 0) {
      printPanel("Image Payload", [
        `${chalk.cyan("Files:")} ${result.health.summary.images}`,
        `${chalk.cyan("Total size:")} ${Math.round(result.health.summary.imageBytes / 1024)} KB`,
        chalk.dim("Run /images --generate to optimize images.")
      ], "magenta");
    }
    printRelatedCommands("health");
    return { shouldExit: false };
  }

  if (command === "deps") {
    const [pkgRaw, { unusedDependencies, heavyDependencies }] = await Promise.all([
      fs.promises.readFile(path.join(cwd, "package.json"), "utf8").then(d => JSON.parse(d)).catch(() => null) as Promise<Record<string, unknown> | null>,
      scanDependencies(cwd)
    ]);
    const pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; peerDependencies?: Record<string, string> } = pkgRaw ?? {};
    const runtimeDeps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    const peerDeps = Object.keys(pkg.peerDependencies || {});
    printPanel("Dependency Scan", [
      `${chalk.cyan("Runtime dependencies:")} ${runtimeDeps.length}`,
      `${chalk.cyan("Dev dependencies:")} ${devDeps.length}`,
      `${chalk.cyan("Peer dependencies:")} ${peerDeps.length}`,
      `${chalk.cyan("Total:")} ${runtimeDeps.length + devDeps.length + peerDeps.length}`,
      "",
      `${chalk.cyan("Unused dependencies:")} ${unusedDependencies.length > 0 ? chalk.red(unusedDependencies.length) : chalk.green("0")}`,
      `${chalk.cyan("Heavy dependencies:")} ${heavyDependencies.length > 0 ? chalk.yellow(heavyDependencies.length) : chalk.green("0")}`
    ], "blue");
    if (unusedDependencies.length > 0) {
      const unusedLines = unusedDependencies.map(d => {
        const version = pkg.dependencies?.[d] || "";
        return `  ${chalk.red(d)}${version ? chalk.dim("@" + version) : ""}`;
      });
      printPanel("Unused Dependencies", [
        chalk.dim("Not imported in any source file. Consider removing:"),
        "",
        ...unusedLines,
        "",
        chalk.dim("Run npm uninstall " + unusedDependencies.join(" ") + " to remove.")
      ], "red");
    } else {
      printPanel("Unused Dependencies", [
        chalk.green("✓ All dependencies appear to be in use."),
        chalk.dim("Scanned import statements across src/ for each runtime dependency.")
      ], "green");
    }
    if (heavyDependencies.length > 0) {
      const heavyLines = heavyDependencies.map(d => {
        const extra = altMap[d.name] ? `  ${chalk.dim("(consider " + altMap[d.name] + ")")}` : "";
        return `  ${chalk.yellow(d.name)}  ${d.sizeKb > 0 ? Math.round(d.sizeKb) + " KB" : ""}${extra}`;
      });
      printPanel("Heavy Dependencies", heavyLines, "yellow");
    }
    printRelatedCommands("deps");
    return { shouldExit: false };
  }

  if (command === "advanced") {
    const scanLines = [
      ["--changed", "Scan only modified/untracked files"],
      ["--staged", "Scan only files ready to commit"],
      ["--scan-images", "Discover heavy images during scan"],
      ["--format html", "Generate a visual dashboard"],
      ["--open", "Open the HTML report in your browser"]
    ];
    const fixLines = [
      ["/fix --interactive", "Pick diffs one by one"],
      ["/fix --apply", "Auto-fix everything safely"]
    ];
    const hiddenLines = [
      ["Ctrl+Shift+S", "Open the Command Palette from anywhere"],
      ["/images --generate", "Auto-convert heavy images to webp"]
    ];

    const pad = (rows: string[][]) => {
      const maxLen = Math.max(...rows.map(r => r[0].length));
      return rows.map(([k, v]) => `  ${chalk.yellow(k.padEnd(maxLen))}  ${chalk.dim(v)}`);
    };

    printGrid([
      { title: "Supercharged Scan", color: "cyan", lines: pad(scanLines) },
      { title: "Surgical Fixes", color: "green", lines: pad(fixLines) },
      { title: "Hidden Features", color: "blue", lines: pad(hiddenLines) }
    ]);
    printRelatedCommands("advanced");
    return { shouldExit: false };
  }

  if (command === "hotspots") {
    const sortByDensity = readFlag(tokens, "--density");
    const minScore = parseInt(readOption(tokens, "--min-score") || "0", 10);
    const result = await runScanWorkflow(cwd, { command: "hotspots", writeReport: false });

    const topN = 10;
    const hotspots = buildHotspots(result.report, cwd, topN, sortByDensity ? "density" : "score", Number.isFinite(minScore) ? minScore : 0);
    if (hotspots.length === 0) {
      printPanel("Hotspots", ["No hotspots found — no files with issues."], "green");
    } else {
      const totalFiles = result.report.files.length;
      const headerFile = "  File";
      const headerErr = "Err";
      const headerWarn = "Warn";
      const headerScore = "Score";
      const headerDensity = "Dens";
      const colFile = Math.max(...hotspots.map(h => h.filePath.length), headerFile.length - 2);
      const colErr = Math.max(...hotspots.map(h => String(h.errors).length), headerErr.length);
      const colWarn = Math.max(...hotspots.map(h => String(h.warnings).length), headerWarn.length);
      const sortedLabel = sortByDensity ? "density" : "score";
      printPanel("Hotspots", [
        `${chalk.dim(`Top ${Math.min(topN, hotspots.length)} of ${totalFiles} files — sorted by ${sortedLabel}${minScore > 0 ? `  min-score: ${minScore}` : ""}`)}`,
        "",
        `${chalk.cyan(headerFile)} ${chalk.dim("".padEnd(colFile - headerFile.length + 2, " ") + headerErr.padEnd(colErr + 2) + headerWarn.padEnd(colWarn + 2) + headerScore.padEnd(7) + headerDensity + "  Category")}`,
        ...hotspots.map(h => {
          const densityStr = h.density > 10 ? chalk.red(String(h.density)) : h.density > 3 ? chalk.yellow(String(h.density)) : chalk.white(String(h.density));
          const lineStr = h.lineCount > 0 ? chalk.dim(`${h.lineCount}L`) : "";
          return `  ${chalk.white(h.filePath.padEnd(colFile + 2))} ${chalk.red(String(h.errors).padStart(colErr))}  ${chalk.yellow(String(h.warnings).padStart(colWarn))}  ${chalk.bold(String(h.score).padStart(headerScore.length))}   ${densityStr.padStart(4)}  ${chalk.dim(h.topCategory)}${lineStr ? " " + lineStr : ""}`;
        })
      ], "red");

      for (const hotspot of hotspots) {
        const file = result.report.files.find(f => f.filePath === hotspot.filePath);
        if (!file || file.messages.length === 0) continue;
        const msgLines: string[] = [];
        let fixableCount = 0;
        for (const { first, count: gCount } of groupMessages(file.messages)) {
          if (first.fixable) fixableCount++;
          const tag = first.severity === 2 ? chalk.red("error") : first.severity === 1 ? chalk.yellow("warn") : chalk.gray("info");
          const line = `  ${tag} ${formatDiagnosticLine(first)}`;
          const suffix = gCount > 1 ? chalk.yellow(`  +${gCount - 1} more`) : "";
          msgLines.push(line + suffix);
        }
        const summary = [`${chalk.cyan("Score:")} ${hotspot.score}  ${chalk.red("Errors:")} ${hotspot.errors}  ${chalk.yellow("Warnings:")} ${hotspot.warnings}${fixableCount > 0 ? `  ${chalk.green("Fixable:")} ${fixableCount}` : ""}${hotspot.lineCount > 0 ? chalk.dim(`  ${hotspot.lineCount} lines`) : ""}${chalk.dim(`  ${hotspot.topCategory}`)}`];
        printPanel(`  ${hotspot.filePath}`, [...summary, "", ...msgLines], "yellow");
      }
    }
    printRelatedCommands("hotspots");
    return { shouldExit: false };
  }

  if (command === "check-accessibility") {
    const report = await runAccessibilityWorkflow(cwd, {
      changed: readFlag(tokens, "--changed"),
      staged: readFlag(tokens, "--staged")
    });
    const a11yMessages = report.files.flatMap(f => f.messages);
    const errorCount = a11yMessages.filter(m => m.severity === 2).length;
    const warningCount = a11yMessages.filter(m => m.severity === 1).length;
    const filesAffected = report.files.length;

    printPanel("Accessibility Summary", [
      `${chalk.cyan("Total issues:")} ${a11yMessages.length}  ${chalk.red("Errors:")} ${errorCount}  ${chalk.yellow("Warnings:")} ${warningCount}`,
      `${chalk.cyan("Files affected:")} ${filesAffected}`
    ], "blue");

    const ruleBreakdown = new Map<string, number>();
    for (const m of a11yMessages) {
      const rule = m.ruleId || "unknown";
      ruleBreakdown.set(rule, (ruleBreakdown.get(rule) || 0) + 1);
    }
    if (ruleBreakdown.size > 0) {
      const sortedRules = [...ruleBreakdown.entries()].sort((a, b) => b[1] - a[1]);
      printPanel("By Rule", sortedRules.slice(0, 8).map(([rule, count]) =>
        `  ${chalk.white(rule.padEnd(35))} ${chalk.cyan(String(count) + " issues")}`
      ), "cyan");
    }

    for (const file of report.files) {
      const fileErrors = file.messages.filter(m => m.severity === 2).length;
      const fileWarnings = file.messages.filter(m => m.severity === 1).length;
      const fileLines: string[] = [];

      if (fileErrors > 0) {
        fileLines.push(`  ${chalk.red(`${fileErrors} errors`)}`);
      }
      if (fileWarnings > 0) {
        fileLines.push(`  ${chalk.yellow(`${fileWarnings} warnings`)}`);
      }

      for (const { first, count } of groupMessages(file.messages)) {
        const expl = explainMessage(first);
        const lineRef = first.line ? ` at :${first.line}` : "";
        const countStr = count > 1 ? chalk.yellow(` (${count} issues)`) : "";
        fileLines.push(`  ${chalk.dim(first.ruleId)}${chalk.dim(lineRef)}  ${expl.title}${countStr}`);
        fileLines.push(`    ${chalk.dim("→")} ${expl.fix}`);
      }

      const color: "red" | "yellow" | "green" = fileErrors > 0 ? "red" : fileWarnings > 0 ? "yellow" : "green";
      const shortPath = file.filePath.length > 50 ? `...${file.filePath.slice(-47)}` : file.filePath;
      printPanel(shortPath, fileLines, color);
    }

    if (report.files.length === 0) {
      printPanel("No files", [chalk.dim("No files with accessibility issues found.")], "blue");
    }

    printRelatedCommands("check-accessibility");
    return { shouldExit: false };
  }

  if (command === "explain") {
    const result = await runExplainWorkflow(cwd, tokens[1]);
    printPanel("Explain", [
      `${chalk.cyan("Target:")} ${result.target}`,
      `${chalk.cyan("Files with issues:")} ${result.report.summary.filesWithIssues}`,
      `${chalk.cyan("Errors:")} ${chalk.red(String(result.report.summary.errors))}  ${chalk.cyan("Warnings:")} ${chalk.yellow(String(result.report.summary.warnings))}`,
      `${chalk.cyan("Total issues:")} ${result.report.summary.totalIssues}`
    ], "magenta");

    const shortSummary = result.summary || (result.body ? String(result.body).split("\n")[0] : "");
    if (shortSummary) console.log(`${chalk.cyan("Short summary:")} ${chalk.dim(shortSummary)}\n`);

    const seenRules = new Set<string>();
    const explainLines: string[] = [];
    for (const file of result.report.files) {
      for (const msg of file.messages) {
        const ruleKey = msg.ruleId || "general";
        if (seenRules.has(ruleKey)) continue;
        seenRules.add(ruleKey);
        const explanation = explainMessage(msg);
        explainLines.push(`  ${chalk.bold(msg.ruleId || "General issue")}`);
        explainLines.push(`    ${chalk.dim("Why:")} ${explanation.why}`);
        explainLines.push(`    ${chalk.green("Fix:")} ${explanation.fix}`);
        explainLines.push("");
      }
    }
    if (explainLines.length > 0) {
      printPanel("Rule Explanations", explainLines, "cyan");
    }

    if (result.summary) {
      console.log(chalk.dim("\nSummary:"));
      console.log(`  ${result.summary}`);
    }
    printRelatedCommands("explain");
    return { shouldExit: false };
  }

  if (command === "images") {
    const images = await scanImages(cwd);
    if (images.length === 0) {
      printPanel("Images", ["No PNG, JPG, or JPEG assets were found."], "green");
      printRelatedCommands("images");
      return { shouldExit: false };
    }
    const sorted = [...images].sort((a, b) => b.size - a.size);
    const totalKb = Math.round(images.reduce((sum, i) => sum + i.size, 0) / 1024);
    const pngCount = images.filter(i => i.file.endsWith(".png")).length;
    const jpgCount = images.filter(i => /\.jpe?g$/i.test(i.file)).length;
    printPanel("Image Inventory", [
      `${chalk.cyan("Total files:")} ${String(images.length)}`,
      `${chalk.cyan("Total size:")} ${String(totalKb)} KB`,
      `${chalk.cyan("PNG:")} ${pngCount}  ${chalk.cyan("JPG/JPEG:")} ${jpgCount}`,
      "",
      chalk.dim("Largest images:"),
      ...sorted.slice(0, 8).map(i => `  ${chalk.white(i.file)}  ${chalk.yellow(Math.round(i.size / 1024) + " KB")}`)
    ], "blue");
    if (readFlag(tokens, "--generate")) {
      const qualityOption = parseInt(readOption(tokens, "--quality") || "75", 10);
      const quality = Number.isFinite(qualityOption) ? qualityOption : 75;
      const generated: string[] = [];
      let totalOriginal = 0;
      let totalWebP = 0;
      for (const image of sorted) {
        try {
          const g = await generateWebP(cwd, image.file, quality);
          generated.push(`${chalk.green("✓")} ${g.out}  ${chalk.yellow(Math.round(g.size / 1024) + " KB")}`);
          totalOriginal += image.size;
          totalWebP += g.size;
        } catch (err) {
          generated.push(`${chalk.red("✗")} ${image.file} (failed: ${String(err)})`);
        }
      }
      if (totalOriginal > 0) {
        const savings = Math.round((1 - totalWebP / totalOriginal) * 100);
        generated.push("", `${chalk.cyan("Total savings:")} ${Math.round(totalOriginal / 1024)} KB → ${Math.round(totalWebP / 1024)} KB (${chalk.green("-" + savings + "%")})`);
      }
      printPanel("Generated WebP", generated.slice(0, 14), "magenta");
    }
    printRelatedCommands(readFlag(tokens, "--generate") ? "images-generate" : "images");
    return { shouldExit: false };
  }

  if (command === "init") {
    const result = await runInit(cwd, { preset: readOption(tokens, "--preset") });
    const config = loadConfig(cwd);
    printPanel("Setup Complete", [
      `${chalk.cyan("Project:")} ${chalk.bold(config.projectName || path.basename(cwd))}`,
      `${chalk.cyan("Preset:")} ${config.preset || "custom"}`,
      `${chalk.cyan("Report file:")} ${config.defaults?.reportFile || "report.txt"}`,
      result.openTui ? "The command center is already open here." : `Run ${chalk.bold("/scan")} to generate a report.`
    ], "green");
    printPanel("Note", [chalk.dim(INIT_NOTE)], "cyan");
    printRelatedCommands("init");
    return { shouldExit: false };
  }

  if (command === "ui-colors") {
    const start = performance.now();
    const r = await scanColors(cwd);
    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    const topColors = r.allColors.slice(0, 10).map(c =>
      `  ${chalk.white(c.value)}  ×${c.count}  ${chalk.dim("(" + c.files.length + " files)")}`
    );
    const inconsistency = r.hasColorInconsistencies ? chalk.yellow("Detected") : "None";
    printPanel("Color Palette", [
      `${chalk.cyan("Unique colors:")} ${r.totalUnique}`,
      `${chalk.cyan("Total declarations:")} ${r.totalDeclarations}`,
      `${chalk.cyan("Tailwind classes:")} ${r.tailwindColors}`,
      `${chalk.cyan("CSS custom props:")} ${r.cssCustomProperties}`,
      `${chalk.cyan("Inconsistencies:")} ${inconsistency}`,
      "",
      chalk.dim("Top colors:"),
      ...topColors,
      r.allColors.length > 10 ? chalk.dim(`  … and ${r.allColors.length - 10} more`) : "",
      "",
      chalk.dim(`Completed in ${elapsed}s`)
    ], "magenta");
    printRelatedCommands("ui-colors");
    return { shouldExit: false };
  }

  if (command === "seo") {
    const result = await runSeoWorkflow(cwd);
    renderSeoReport(result);
    printRelatedCommands("seo");
    return { shouldExit: false };
  }

  if (command === "ui-standards") {
    const start = performance.now();
    const r = await scanStandards(cwd);
    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    const largeFileLines = r.largeFiles.length > 0
      ? [chalk.dim("Large files:"), ...r.largeFiles.slice(0, 10).map(f => `  ${chalk.white(f)}`)]
      : [];
    printPanel("Standards Review", [
      `${chalk.cyan("Component files:")} ${r.totalComponentFiles}`,
      `${chalk.cyan("PascalCase:")} ${r.pascalCaseFiles}  ${chalk.cyan("kebab-case:")} ${r.kebabCaseFiles}`,
      `${chalk.cyan("Default exports:")} ${r.defaultExports}  ${chalk.cyan("Named exports:")} ${r.namedExports}`,
      `${chalk.cyan("Props interface:")} ${r.hasPropsInterface ? chalk.green("✓") : chalk.red("✗")}`,
      `${chalk.cyan("Index files:")} ${r.hasIndexFiles}`,
      `${chalk.cyan("Avg lines/component:")} ${r.avgLinesPerComponent.toFixed(1)}`,
      `${chalk.cyan("Organization:")} ${r.organizationType}`,
      "",
      ...largeFileLines,
      "",
      chalk.dim(`Completed in ${elapsed}s`)
    ], "cyan");
    printRelatedCommands("ui-standards");
    return { shouldExit: false };
  }

  if (command === "ui-typography") {
    const start = performance.now();
    const r = await scanTypography(cwd);
    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    const topSizes = r.fontSizes.slice(0, 6).map(s => `  ${chalk.white(s.value)}  ×${s.count}`);
    const topHeights = r.lineHeights.slice(0, 4).map(h => `  ${chalk.white(h.value)}  ×${h.count}`);
    printPanel("Typography Audit", [
      `${chalk.cyan("Files with typography:")} ${r.filesWithTypography}`,
      `${chalk.cyan("Total declarations:")} ${r.totalFontDeclarations}`,
      `${chalk.cyan("Unique font families:")} ${r.uniqueFontFamilies.length > 0 ? r.uniqueFontFamilies.join(", ") : "none detected"}`,
      `${chalk.cyan("Custom @font-face:")} ${r.customFonts.length > 0 ? r.customFonts.join(", ") : "none"}`,
      `${chalk.cyan("Missing line-height:")} ${r.missingLineHeight > 0 ? chalk.yellow(r.missingLineHeight + " files") : chalk.green("none")}`,
      `${chalk.cyan("Tailwind typography:")} ${r.tailwindTypographyCount}`,
      `${chalk.cyan("Inline typography:")} ${r.inlineTypographyCount}`,
      "",
      chalk.dim("Top font sizes:"),
      ...topSizes,
      r.fontSizes.length > 6 ? chalk.dim(`  … and ${r.fontSizes.length - 6} more`) : "",
      "",
      chalk.dim(`Completed in ${elapsed}s`)
    ], "magenta");
    if (topHeights.length > 0) {
      printPanel("Line Heights", topHeights, "blue");
    }
    if (r.fontWeights.length > 0) {
      const topWeights = r.fontWeights.slice(0, 6).map(w => `  ${chalk.white(w.value)}  ×${w.count}`);
      printPanel("Font Weights", topWeights, "cyan");
    }
    if (r.letterSpacing.length > 0) {
      const topSpacing = r.letterSpacing.slice(0, 4).map(l => `  ${chalk.white(l.value)}  ×${l.count}`);
      printPanel("Letter Spacing", topSpacing, "yellow");
    }
    if (r.textTransform.length > 0) {
      const topTransforms = r.textTransform.slice(0, 4).map(t => `  ${chalk.white(t.value)}  ×${t.count}`);
      printPanel("Text Transform", topTransforms, "blue");
    }
    if (r.textDecoration.length > 0) {
      const topDecor = r.textDecoration.slice(0, 4).map(d => `  ${chalk.white(d.value)}  ×${d.count}`);
      printPanel("Text Decoration", topDecor, "blue");
    }
    if (r.recommendations.length > 0) {
      const recLines = r.recommendations.map(rec => `  ${chalk.yellow("→")} ${rec}`);
      printPanel("Recommendations", recLines, "yellow");
    }
    printRelatedCommands("ui-typography");
    return { shouldExit: false };
  }

  if (command === "ui-spacing") {
    const start = performance.now();
    const r = await scanSpacing(cwd);
    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    const topMargins = r.marginValues.slice(0, 6).map(m => `  ${chalk.white(m.value)}  ×${m.count}`);
    const topPaddings = r.paddingValues.slice(0, 6).map(p => `  ${chalk.white(p.value)}  ×${p.count}`);
    const topGaps = r.gapValues.slice(0, 4).map(g => `  ${chalk.white(g.value)}  ×${g.count}`);
    const topPos = r.positionValues.slice(0, 4).map(p => `  ${chalk.white(p.value)}  ×${p.count}`);
    printPanel("Spacing Scan", [
      `${chalk.cyan("Files with spacing:")} ${r.filesWithSpacing}`,
      `${chalk.cyan("Total declarations:")} ${r.totalSpacingDeclarations}`,
      `${chalk.cyan("Tailwind spacing:")} ${r.tailwindSpacingCount}`,
      `${chalk.cyan("Inline spacing:")} ${r.inlineSpacingCount}`,
      `${chalk.cyan("Position properties:")} ${r.positionValues.length > 0 ? r.positionValues.reduce((s, p) => s + p.count, 0) : 0}`,
      "",
      chalk.dim("Unit consistency:"),
      r.unitInconsistencies.length > 0
        ? `  ${chalk.yellow(r.unitInconsistencies.length + " files mix units")}`
        : `  ${chalk.green("consistent")}`,
      ...(r.filesWithExcessiveUniqueValues.length > 0
        ? [`  ${chalk.yellow(r.filesWithExcessiveUniqueValues.length + " files with >10 unique spacing values")}`]
        : []),
      "",
      chalk.dim("Recommendations:"),
      ...(r.recommendations.length > 0 ? r.recommendations.map(rec => `  ${chalk.yellow("→")} ${rec}`) : ["  " + chalk.green("none")]),
      "",
      chalk.dim(`Completed in ${elapsed}s`)
    ], "blue");
    if (topMargins.length > 0) {
      printPanel("Top Margin Values", topMargins, "yellow");
    }
    if (topPaddings.length > 0) {
      printPanel("Top Padding Values", topPaddings, "cyan");
    }
    if (topGaps.length > 0) {
      printPanel("Gap Values", topGaps, "green");
    }
    if (topPos.length > 0) {
      printPanel("Position Values", topPos, "red");
    }
    if (r.unitInconsistencies.length > 0) {
      const files = r.unitInconsistencies.slice(0, 5).map(f => `  ${chalk.white(f)}`);
      printPanel("Files with Mixed Units (sample)", files, "yellow");
    }
    printRelatedCommands("ui-spacing");
    return { shouldExit: false };
  }

  if (command === "commands") {
    return { shouldExit: false, showCatalog: true };
  }

  if (command === "tui") {
    forceFreshDashboard = true;
    return { shouldExit: false, showDashboard: true };
  }

  if (command === "tech-debt") {
    const result = await runTechDebtWorkflow(cwd);
    renderTechDebtReport(result);
    printRelatedCommands("tech-debt");
    return { shouldExit: false };
  }

  if (command === "performance") {
    const result = await runPerformanceWorkflow(cwd);
    renderPerformanceReport(result);
    printRelatedCommands("performance");
    return { shouldExit: false };
  }

  if (command === "stack-audit") {
    const result = await runStackAuditWorkflow(cwd);
    renderStackAuditReport(result);
    printRelatedCommands("stack-audit");
    return { shouldExit: false };
  }

  if (command === "migration") {
    const result = await runMigrationWorkflow(cwd);
    renderMigrationReport(result);
    printRelatedCommands("migration");
    return { shouldExit: false };
  }

  if (command === "fe-score") {
    const result = await runFeScoreWorkflow(cwd);
    renderFeScoreReport(result);
    printRelatedCommands("fe-score");
    return { shouldExit: false };
  }

  if (command === "exit") {
    printPanel("Command Center", ["Leaving better-ui. Bye see you soon 😊"], "green");
    return { shouldExit: true };
  }

  printPanel("Slash Command", [`Unsupported command: /${command}`], "red");
  printCommandSuggestions(`/${command}`, "Closest Matches");
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
  if (command !== "scan") {
    printRunSummary(input);
  }

  let result: Awaited<ReturnType<typeof _runSlashCommand>>;
  try {
    result = await _runSlashCommand(cwd, input);
  } catch {
    // Prompt cancelled (Ctrl+C) — restore stdin for the dashboard
    try { process.stdin.resume(); } catch {}
    try { if (process.stdin.isTTY) process.stdin.setRawMode(false); } catch {}
    result = { shouldExit: false, showDashboard: true };
  }

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
            `${chalk.cyan("Git:")} ${gitEnabled ? getCurrentBranch(cwd) || "attached" : "not a repository"}`,
            `${chalk.cyan("Config:")} ${config.preset || "custom"} preset`
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
        },
        {
          title: "Popular Flows",
          color: "green",
          lines: [
            `${chalk.bold("/scan")} ${chalk.dim("Full project scan")}`,
            `${chalk.bold("/fix --interactive")} ${chalk.dim("Pick fix hunks safely")}`,
            `${chalk.bold("/images --generate")} ${chalk.dim("Create WebP assets")}`
          ]
        },
        {
          title: "Keyboard Shortcuts",
          color: "yellow",
          lines: [
            `${chalk.bold("Ctrl+Shift+S")} ${chalk.dim("Open command palette")}`,
            `${chalk.bold("/")} ${chalk.dim("Type next command after any result")}`,
            `${chalk.bold("a")} ${chalk.dim("Return to dashboard")}`,
            `${chalk.bold("Esc / Ctrl+C")} ${chalk.dim("Exit cleanly")}`
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
            nextCommandToRun = await pause();
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
              nextCommandToRun = await pause();
            }
            continue;
          }
  
        if (isPromptCloseError(err)) {
          forceFreshDashboard = true;
          continue;
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
      printCommandSuggestions(commandInput);
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
          nextCommandToRun = await pause();
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

      nextCommandToRun = await pause();
  }
}
