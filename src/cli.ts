import { Command } from "commander";
import path from "path";
import chalk from "chalk";
import { prompt } from "enquirer";
import fs from "fs";
import { exec } from "child_process";
import { COMMANDS } from "./commandCatalog";

const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const VERSION = pkgJson.version;
import {
  applyInteractiveHunkSelection,
  runAccessibilityWorkflow,
  runFixWorkflow,
  runHealthWorkflow,
  runInteractiveFixWorkflow,
  runScanWorkflow
} from "./cli/workflows";
import { explainMessage } from "./explanations";
import { buildHotspots } from "./insights";
import { printSummary } from "./reporters/terminalReporter";
import { detectFramework } from "./config";
import { scanImages, generateWebP } from "./scanners/imageScanner";
import { normalizeSlashArgv } from "./slashCommands";
import { printBanner, printCommandCatalog, printPanel, formatDelta, formatElapsed, formatTimestamp, printGrid, printRunSummary, printFooter, groupMessages, groupMessagesByRule, printRelatedCommands, categoryRecommendations } from "./terminalUi";
import { runTui } from "./tui/app";
import { scanDependencies } from "./scanners/dependencyScanner";
import { scanColors, scanStandards, scanTypography, scanSpacing } from "./uiTools";
import { renderSeoReport } from "./renderers/seoRenderer";
import { renderTechDebtReport } from "./renderers/techDebtRenderer";
import { renderPerformanceReport } from "./renderers/performanceRenderer";
import { renderStackAuditReport } from "./renderers/stackAuditRenderer";
import { renderMigrationReport } from "./renderers/migrationRenderer";
import { renderFeScoreReport } from "./renderers/feScoreRenderer";
import {
  runSeoWorkflow,
  runTechDebtWorkflow,
  runPerformanceWorkflow,
  runStackAuditWorkflow,
  runMigrationWorkflow,
  runFeScoreWorkflow,
} from "./cli/workflows";


function parseExtensions(value?: string) {
  return value ? value.split(",").map(segment => segment.trim()).filter(Boolean) : undefined;
}

function addScopeOptions(command: Command) {
  return command
    .option("--changed", "Limit the command to modified and untracked git files")
    .option("--staged", "Limit the command to staged git files");
}

function printCommandIntro(commandText: string) {
  printBanner();
  printRunSummary(commandText);
}

const program = new Command();

program
  .name("better-ui")
  .description("Frontend command center for scans, health insights, reviews, and image optimization")
  .version(VERSION)
  .showHelpAfterError();

addScopeOptions(
  program
    .command("scan")
    .description("Scan the project and produce a report with scoring and categories")
    .option("--out <file>", "Report file")
    .option("--ext <exts>", "Comma-separated extensions (eg. .js,.ts)")
    .option("--format <format>", "json or markdown", "json")
    .option("--no-save", "Do not write the report file to disk (still produce a result in memory)")
    .option("--top <n>", "Number of hotspots to show", (v) => parseInt(v, 10), 5)
    .option("--scan-images", "Also scan images and show an image summary")
    .option("--verbose", "Show extended output after the scan")
    .action(async (opts: any) => {
      // opts is 'any' here to avoid over-specific typing for the extended options
      try {
        const projectRoot = process.cwd();
        const start = Date.now();

        const result = await runScanWorkflow(projectRoot, {
          out: opts.out,
          ext: parseExtensions(opts.ext),
          changed: opts.changed,
          staged: opts.staged,
          format: opts.format,
          command: "scan",
          writeReport: opts.save === false ? false : undefined
        });

        const durationMs = Date.now() - start;

        // compute extra metrics
        const fixableCount = result.report.files.reduce((sum, f) => sum + f.messages.filter((m: any) => m.fixable).length, 0);
        const top = Number.isFinite(opts.top) ? Math.max(1, opts.top) : 5;
        const hotspots = buildHotspots(result.report, process.cwd(), top);

        const fixableFiles = result.report.files
          .map(f => ({ filePath: f.filePath, fixables: f.messages.filter((m: any) => m.fixable).length }))
          .filter(x => x.fixables > 0)
          .sort((a, b) => b.fixables - a.fixables)
          .slice(0, Math.max(5, top));

        const categories = Object.entries(result.report.summary.categories || {}).sort((a: any, b: any) => (b[1] as number) - (a[1] as number));

        // report file size (if written)
        let reportSizeText = "unknown";
        try {
          if (result.reportPath && fs.existsSync(result.reportPath)) {
            const st = fs.statSync(result.reportPath);
            reportSizeText = `${Math.round(st.size / 1024)} KB`;
          }
        } catch {
          // ignore
        }

        printBanner();
        printSummary(result.report);

        printPanel("Scan Output", [
          `${chalk.cyan("Scope:")} ${result.report.scope || "all"}`,
          `${chalk.cyan("Saved report:")} ${result.reportPath ? path.resolve(result.reportPath) : opts.save === false ? chalk.dim("(skipped via --no-save)") : "(not written)"}`,
          `${chalk.cyan("Report size:")} ${reportSizeText}`,
          `${chalk.cyan("Duration:")} ${formatElapsed(durationMs)}`,
          `${chalk.cyan("Files with issues:")} ${result.report.summary.filesWithIssues}`,
          `${chalk.cyan("Total issues:")} ${result.report.summary.totalIssues}`,
          `${chalk.cyan("Autofixable issues:")} ${fixableCount}`,
          "",
          chalk.dim("Reports are saved under the configured defaults.reportFile path. To disable saving, pass --no-save.")
        ], "cyan");

        // Category breakdown
        printPanel("Category Breakdown", categories.length > 0 ? categories.map(([name, count]) => `${chalk.cyan(String(name) + ":")} ${String(count)}`) : ["No categorized issues detected."], "blue");

        // Hotspots
        const hotspotLines: string[] = [];
        if (hotspots.length > 0) {
          for (const h of hotspots) {
            const densityStr = h.density > 10 ? chalk.red(String(h.density)) : h.density > 3 ? chalk.yellow(String(h.density)) : chalk.white(String(h.density));
            const lineStr = h.lineCount > 0 ? chalk.dim(`${h.lineCount} lines`) : "";
            hotspotLines.push(`  ${chalk.white(h.filePath)}`);
            hotspotLines.push(`    ${chalk.cyan("Score:")} ${h.score}  ${chalk.red("Errors:")} ${h.errors}  ${chalk.yellow("Warnings:")} ${h.warnings}  ${chalk.dim(h.topCategory)}  ${lineStr}  ${chalk.dim("density:")} ${densityStr}`);
            hotspotLines.push("");
          }
          hotspotLines.pop(); // remove trailing blank line
        } else {
          hotspotLines.push("No hotspots found.");
        }
        printPanel("Hotspots", hotspotLines, "red");

        // Fixable files
        printPanel("Top Fixable Files", fixableFiles.length > 0 ? fixableFiles.map(f => `${f.filePath} (${f.fixables} autofixable)`) : ["No autofixable files found in this scan."], "yellow");

        // Optionally scan images
        if (opts.scanImages) {
          try {
            const images = await scanImages(projectRoot);
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
        printRelatedCommands(opts.changed ? "scan-changed" : opts.staged ? "scan-staged" : "scan");
        printFooter();

        if (opts.verbose) {
          printPanel("Raw Report Path", [String(result.reportPath)], "cyan");
        }
      } catch (err) {
        console.error("Scan failed:", err);
        process.exitCode = 2;
      }
    })
);

addScopeOptions(
  program
    .command("fix")
    .description("Preview or apply ESLint autofixes, optionally only on changed or staged files")
    .option("--apply", "Actually write fixes to disk")
    .option("--interactive", "Preview fixable files and choose which ones to update")
    .action(async (opts: { apply?: boolean; interactive?: boolean; changed?: boolean; staged?: boolean }) => {
      try {
        const projectRoot = process.cwd();

        if (opts.interactive) {
          const interactive = await runInteractiveFixWorkflow(projectRoot, opts);
           printCommandIntro(process.argv.slice(2).join(" ") || "/fix --interactive");

          if (interactive.previews.length === 0) {
            printPanel("Interactive Fix", ["No ESLint autofixes are currently available for the selected scope."], "green");
            printRelatedCommands("fix-interactive");
            printFooter();
            return;
          }

          printPanel("Interactive Fix Preview", [
            `${chalk.cyan("Scope:")} ${interactive.scope}`,
            `${chalk.cyan("Files with autofixes:")} ${interactive.previews.length}`,
            ...interactive.previews.slice(0, 4).map(preview => `${preview.filePath} (${preview.changedLines} changed lines)`)
          ], "yellow");

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
            printPanel("Interactive Fix", ["No files were selected."], "yellow");
            printRelatedCommands("fix-interactive");
            printFooter();
            return;
          }

          const selectedPreviewLines = interactive.previews.flatMap(preview => preview.hunks.filter(hunk => selectedHunks.includes(hunk.id)).flatMap(hunk => [
            `${chalk.cyan(hunk.label)}`,
            ...hunk.preview.slice(0, 6)
          ]));
          printPanel("Selected Diff Preview", selectedPreviewLines.slice(0, 24), "cyan");

          const confirmation: any = await prompt({
            type: "confirm",
            name: "approved",
            message: `Apply ${selectedHunks.length} selected diff blocks?`,
            initial: false
          } as any);

          if (!confirmation.approved) {
            printPanel("Interactive Fix", ["Cancelled before writing changes."], "yellow");
            printRelatedCommands("fix-interactive");
            printFooter();
            return;
          }

          const report = await applyInteractiveHunkSelection(projectRoot, interactive.previews, selectedHunks, opts);
          const touchedFiles = [...new Set(interactive.previews.filter(preview => preview.hunks.some(hunk => selectedHunks.includes(hunk.id))).map(preview => preview.filePath))];
          const fixedParts: string[] = [];
          for (const tf of touchedFiles) {
            const fileAfter = report.files.find(f => f.filePath === tf);
            if (fileAfter) {
              fixedParts.push(`  ${chalk.white(tf)}  ${chalk.red(String(fileAfter.errorCount))} errors, ${chalk.yellow(String(fileAfter.warningCount))} warnings`);
            }
          }
          printPanel("Interactive Fix Applied", [
            `${chalk.cyan("Files updated:")} ${touchedFiles.length}`,
            `${chalk.cyan("Blocks applied:")} ${selectedHunks.length}`,
            `${chalk.cyan("Remaining errors:")} ${report.summary.errors}`,
            `${chalk.cyan("Remaining warnings:")} ${report.summary.warnings}`,
            `${chalk.cyan("Score:")} ${report.summary.score}/100`,
            "",
            ...fixedParts
          ], "green");
          printRelatedCommands("fix-interactive");
          printFooter();
          return;
        }

        const result = await runFixWorkflow(projectRoot, opts);
        printCommandIntro(process.argv.slice(2).join(" ") || "/fix");

        if (result.previews.length === 0) {
          printPanel("Fix", ["No ESLint autofixes are currently available for the selected scope."], "green");
          printRelatedCommands("fix");
          printFooter();
          return;
        }

        if (!result.report) {
          const previewLines: string[] = [
            `${chalk.cyan("Scope:")} ${opts.staged ? "staged" : opts.changed ? "changed" : "all"}`,
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
          printFooter();
          return;
        }

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
        printPanel("Fix Completed", fixResultLines, "green");
        printRelatedCommands("fix-apply");
        printFooter();
      } catch (err) {
        console.error("Fix failed:", err);
        process.exitCode = 2;
      }
    })
);

program
  .command("health")
  .description("Show a frontend health score with categories, priorities, and image weight")
  .action(async () => {
    try {
      const result = await runHealthWorkflow(process.cwd());
      printCommandIntro(process.argv.slice(2).join(" ") || "/health");

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
          for (const { first, count } of groupMessagesByRule(cf.messages)) {
            const loc = first.line !== null ? chalk.gray(`:${first.line}${first.column !== null ? `:${first.column}` : ""}`) : "";
            const rule = first.ruleId ? chalk.cyan(first.ruleId) : "";
            const text = first.message.length > 100 ? first.message.slice(0, 100) + "…" : first.message;
            const suffix = count > 1 ? chalk.yellow(`  +${count - 1} more`) : "";
            lines.push(`  ${chalk.white(cf.filePath)}${loc}  ${rule}  ${chalk.dim(text)}${suffix}`);
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
        const titleLabel = catInfo.label || catName;
        const titleStr = `${titleLabel.charAt(0).toUpperCase() + titleLabel.slice(1)}`;
        printPanel(titleStr, lines.length > 0 ? lines : ["No issues found in this category."], "blue");
      }

      if (result.health.summary.images > 0) {
        printPanel("Image Payload", [
          `${chalk.cyan("Files:")} ${result.health.summary.images}`,
          `${chalk.cyan("Total size:")} ${Math.round(result.health.summary.imageBytes / 1024)} KB`,
          chalk.dim("Run better-ui-cli /images --generate to optimize images.")
        ], "magenta");
      }

      printRelatedCommands("health");
      printFooter();
    } catch (error) {
      console.error(chalk.red("Health check failed:"), error);
      process.exit(1);
    }
  });

program
  .command("deps")
  .description("Find unused dependencies and heavy packages")
  .action(async () => {
    try {
      const [pkgRaw, { unusedDependencies, heavyDependencies }] = await Promise.all([
        fs.promises.readFile(path.join(process.cwd(), "package.json"), "utf8").then(d => JSON.parse(d)).catch(() => null) as Promise<Record<string, unknown> | null>,
        scanDependencies(process.cwd())
      ]);
      const pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; peerDependencies?: Record<string, string> } = pkgRaw ?? {};
      const runtimeDeps = Object.keys(pkg.dependencies || {});
      const devDeps = Object.keys(pkg.devDependencies || {});
      const peerDeps = Object.keys(pkg.peerDependencies || {});
      const allKnownHeavy = ["lodash", "moment", "moment-timezone", "rxjs", "three", "echarts", "d3"];
      const heavySet = new Set(heavyDependencies.map(d => d.name));
      printCommandIntro(process.argv.slice(2).join(" ") || "/deps");

      const summaryLines: string[] = [
        `${chalk.cyan("Runtime dependencies:")} ${runtimeDeps.length}`,
        `${chalk.cyan("Dev dependencies:")} ${devDeps.length}`,
        `${chalk.cyan("Peer dependencies:")} ${peerDeps.length}`,
        `${chalk.cyan("Total:")} ${runtimeDeps.length + devDeps.length + peerDeps.length}`,
        "",
        `${chalk.cyan("Unused dependencies:")} ${unusedDependencies.length > 0 ? chalk.red(unusedDependencies.length) : chalk.green("0")}`,
        `${chalk.cyan("Heavy dependencies:")} ${heavySet.size > 0 ? chalk.yellow(heavySet.size) : chalk.green("0")}`
      ];
      printPanel("Dependency Scan", summaryLines, "blue");

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
          const isKnown = allKnownHeavy.includes(d.name);
          const extra = isKnown ? chalk.dim("(known large package — consider smaller alternatives)") : "";
          return `  ${chalk.yellow(d.name)}  ${d.sizeKb > 0 ? Math.round(d.sizeKb) + " KB" : ""}  ${extra}`;
        });

        const altMap: Record<string, string> = {
          "lodash": "native Array/Map/Set methods or radashi",
          "moment": "Day.js (2kB) or date-fns",
          "moment-timezone": "Day.js + utc plugin (2kB)",
          "rxjs": "native async/await + AbortController",
          "three": "you may actually need this — if not, try regl or twgl",
          "echarts": "Chart.js (1/3 the size) or uPlot",
          "d3": "d3-selection only instead of full d3"
        };
        const altLines: string[] = [];
        for (const d of heavyDependencies) {
          const alt = altMap[d.name];
          if (alt) {
            altLines.push(`  ${chalk.green("→")} ${chalk.bold(d.name)}: ${alt}`);
          }
        }
        if (altLines.length > 0) {
          heavyLines.push("", chalk.dim("Suggested lighter alternatives:"), ...altLines);
        }
        printPanel("Heavy Dependencies", heavyLines, "yellow");
      }

      printRelatedCommands("deps");
      printFooter();
    } catch (error) {
      console.error(chalk.red("Dependency scan failed:"), error);
      process.exit(1);
    }
  });

program
  .command("advanced")
  .description("Show advanced subcommands, flags, and hidden pro-tips")
  .action(() => {
    printCommandIntro(process.argv.slice(2).join(" ") || "/advanced");

    const pad = (rows: string[][]) => {
      const maxLen = Math.max(...rows.map(r => r[0].length));
      return rows.map(([k, v]) => `  ${chalk.yellow(k.padEnd(maxLen))}  ${chalk.dim(v)}`);
    };

    printGrid([
      {
        title: "Supercharged Scan",
        color: "cyan",
        lines: pad([
          ["--changed", "Scan only modified/untracked files"],
          ["--staged", "Scan only files ready to commit"],
          ["--scan-images", "Discover heavy images during scan"],
          ["--format markdown", "Generate a Markdown report"],
          ["--verbose", "Show extended scan details"],
          ["--top <n>", "Show top N hotspots (default: 5)"]
        ])
      },
      {
        title: "Surgical Fixes",
        color: "green",
        lines: pad([
          ["/fix --interactive", "Pick hunks one by one"],
          ["/fix --apply", "Auto-fix everything safely"],
          ["/fix --changed", "Fix only changed files"],
          ["/fix --staged", "Fix only staged files"]
        ])
      },
      {
        title: "Reports & Review",
        color: "magenta",
        lines: pad([
          ["/health", "Category scores and priorities"],
          ["/doctor", "Full project diagnostic"]
        ])
      },
      {
        title: "Image Optimization",
        color: "blue",
        lines: pad([
          ["/images", "List all project images"],
          ["/images --generate", "Convert to WebP"],
          ["--quality <n>", "WebP quality 1-100 (default 75)"],
          ["Ctrl+Shift+S", "Command Palette in TUI"]
        ])
      }
    ]);
    printPanel("Tip", [
      `${chalk.dim("Most commands accept ")}${chalk.white("--changed")}${chalk.dim(" and ")}${chalk.white("--staged")}${chalk.dim(" to scope to git changes.")}`,
      `${chalk.dim("Use ")}${chalk.white("better-ui-cli /menu")}${chalk.dim(" to open the full TUI dashboard.")}`
    ], "cyan");
    printRelatedCommands("advanced");
    printFooter();
  });

program
  .command("hotspots")
  .description("List the files with the highest issue density")
  .option("--density", "Sort by issue density (issues/line) instead of absolute score")
  .option("--min-score <n>", "Minimum score to include", (v) => parseInt(v, 10), 0)
  .option("--top <n>", "Number of hotspots to show", (v) => parseInt(v, 10), 10)
  .action(async (opts) => {
    try {
      const cwd = process.cwd();
      const result = await runScanWorkflow(cwd, { command: "hotspots", writeReport: false });
      printCommandIntro(process.argv.slice(2).join(" ") || "/hotspots");

      const topN = Number.isFinite(opts.top) ? opts.top : 10;
      const sortBy = opts.density ? "density" as const : "score" as const;
      const minScore = Number.isFinite(opts.minScore) ? opts.minScore : 0;
      const hotspots = buildHotspots(result.report, cwd, topN, sortBy, minScore);
      if (hotspots.length === 0) {
        printPanel("Hotspots", ["No hotspots found — no files with issues."], "green");
        printRelatedCommands("hotspots");
        printFooter();
      } else {
        const totalFiles = result.report.files.length;
        const sortedLabel = sortBy === "density" ? "density" : "score";
        printPanel("Hotspots", [
          `${chalk.dim(`Top ${Math.min(topN, hotspots.length)} of ${totalFiles} files — sorted by ${sortedLabel}${minScore > 0 ? `  min-score: ${minScore}` : ""}`)}`,
          "",
          chalk.cyan("  File") + chalk.dim("                          Err  Warn  Score  Dens  Category    Lines"),
          ...hotspots.map(h => {
            const densityStr = h.density > 10 ? chalk.red(String(h.density)) : h.density > 3 ? chalk.yellow(String(h.density)) : chalk.white(String(h.density));
            const lineStr = h.lineCount > 0 ? chalk.dim(String(h.lineCount)) : "?";
            return `  ${chalk.white(h.filePath.padEnd(38))} ${chalk.red(String(h.errors).padStart(3))}  ${chalk.yellow(String(h.warnings).padStart(4))}  ${chalk.bold(String(h.score).padStart(4))}  ${densityStr.padStart(4)}  ${chalk.dim(h.topCategory.padEnd(12))} ${lineStr}`;
          })
        ], "red");

        // Per-hotspot message detail
        for (const hotspot of hotspots) {
          const file = result.report.files.find(f => f.filePath === hotspot.filePath);
          if (!file || file.messages.length === 0) continue;
          const msgLines: string[] = [];
          let fixableCount = 0;
          for (const { first, count } of groupMessages(file.messages)) {
            if (first.fixable) fixableCount++;
            const loc = first.line !== null ? chalk.gray(`:${first.line}${first.column !== null ? `:${first.column}` : ""}`) : "";
            const tag = first.severity === 2 ? chalk.red("error") : first.severity === 1 ? chalk.yellow("warn") : chalk.gray("info");
            const rule = first.ruleId ? chalk.cyan(first.ruleId) : "";
            const text = first.message.length > 100 ? first.message.slice(0, 100) + "…" : first.message;
            const suffix = count > 1 ? chalk.yellow(`  +${count - 1} more`) : "";
            msgLines.push(`  ${tag} ${rule}${loc}  ${chalk.dim(text)}${suffix}`);
          }
          const summary = [`${chalk.cyan("Score:")} ${hotspot.score}  ${chalk.red("Errors:")} ${hotspot.errors}  ${chalk.yellow("Warnings:")} ${hotspot.warnings}${fixableCount > 0 ? `  ${chalk.green("Fixable:")} ${fixableCount}` : ""}${hotspot.lineCount > 0 ? chalk.dim(`  ${hotspot.lineCount} lines`) : ""}${chalk.dim(`  ${hotspot.topCategory}`)}`];
          printPanel(`  ${hotspot.filePath}`, [...summary, "", ...msgLines], "yellow");
        }
        printRelatedCommands("hotspots");
        printFooter();
      }
    } catch (err) {
      console.error("Hotspots command failed:", err);
      process.exitCode = 2;
    }
  });

addScopeOptions(
  program
    .command("check-accessibility")
    .description("Show only accessibility-related findings for the selected scope")
    .action(async (opts: { changed?: boolean; staged?: boolean }) => {
      try {
        const report = await runAccessibilityWorkflow(process.cwd(), opts);
        printCommandIntro(process.argv.slice(2).join(" ") || "/a11y");

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
            `  ${chalk.white(rule.padEnd(35))} ${chalk.cyan(String(count))}`
          ), "cyan");
        }

        for (const file of report.files) {
          const fileErrors = file.messages.filter(m => m.severity === 2).length;
          const fileWarnings = file.messages.filter(m => m.severity === 1).length;
          const fileLines: string[] = [];

          if (fileErrors > 0) {
            fileLines.push(`  ${chalk.red(`${fileErrors} error(s)`)}`);
          }
          if (fileWarnings > 0) {
            fileLines.push(`  ${chalk.yellow(`${fileWarnings} warning(s)`)}`);
          }

          for (const { first, count } of groupMessages(file.messages)) {
            const expl = explainMessage(first);
            const lineRef = first.line ? `:${first.line}` : "";
            const countStr = count > 1 ? chalk.yellow(` (${count} issues)`) : "";
            fileLines.push(`  ${chalk.dim(first.ruleId + lineRef)}  ${expl.title}${countStr}`);
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
        printFooter();
      } catch (err) {
        console.error("Accessibility command failed:", err);
        process.exitCode = 2;
      }
    })
);

program
  .command("commands")
  .description("Show the full command catalog and slash aliases")
  .action(() => {
    printCommandIntro(process.argv.slice(2).join(" ") || "/commands");
    printCommandCatalog();
    const uiCommands = COMMANDS.filter(c => c.slash.startsWith("/ui-"));
    const featured = [...COMMANDS.slice(0, 4), ...uiCommands];
    printPanel("Examples", featured.map(command => `${chalk.cyan(command.slash)} -> ${command.example}`), "magenta");
    printRelatedCommands("commands");
    printFooter();
  });

program
  .command("tui")
  .description("Start the interactive command center")
  .action(async () => {
    try {
      await runTui();
    } catch (err) {
      console.error("TUI failed:", err);
      process.exitCode = 2;
    }
  });

program
  .command("images")
  .description("Scan images and optionally generate WebP versions")
  .option("--generate", "Generate WebP files for detected images")
  .option("--quality <n>", "WebP quality from 1 to 100", (value) => parseInt(value, 10))
  .action(async (opts: { generate?: boolean; quality?: number }) => {
    try {
      const projectRoot = process.cwd();
      const images = await scanImages(projectRoot);
      printCommandIntro(process.argv.slice(2).join(" ") || "/images");

      if (images.length === 0) {
        printPanel("Images", ["No PNG, JPG, or JPEG assets were found."], "green");
        printRelatedCommands("images");
        printFooter();
        return;
      }

      const sorted = [...images].sort((a, b) => b.size - a.size);
      const totalKb = Math.round(images.reduce((sum, image) => sum + image.size, 0) / 1024);
      const pngCount = images.filter(i => i.file.endsWith(".png")).length;
      const jpgCount = images.filter(i => /\.jpe?g$/i.test(i.file)).length;
      printPanel("Image Inventory", [
        `${chalk.cyan("Total files:")} ${String(images.length)}`,
        `${chalk.cyan("Total size:")} ${String(totalKb)} KB`,
        `${chalk.cyan("PNG:")} ${pngCount}  ${chalk.cyan("JPG/JPEG:")} ${jpgCount}`,
        "",
        chalk.dim("Largest images:"),
        ...sorted.slice(0, 8).map(image => `  ${chalk.white(image.file)}  ${chalk.yellow(Math.round(image.size / 1024) + " KB")}`)
      ], "blue");

      if (opts.generate) {
        const results: string[] = [];
        let totalOriginal = 0;
        let totalWebP = 0;
        for (const image of sorted) {
          try {
            const generated = await generateWebP(projectRoot, image.file, opts.quality);
            results.push(`${chalk.green("✓")} ${generated.out}  ${chalk.yellow(Math.round(generated.size / 1024) + " KB")}`);
            totalOriginal += image.size;
            totalWebP += generated.size;
          } catch (err) {
            results.push(`${chalk.red("✗")} ${image.file} (failed: ${String(err)})`);
          }
        }
        if (totalOriginal > 0) {
          const savings = Math.round((1 - totalWebP / totalOriginal) * 100);
          results.push("", `${chalk.cyan("Total savings:")} ${Math.round(totalOriginal / 1024)} KB → ${Math.round(totalWebP / 1024)} KB (${chalk.green("-" + savings + "%")})`);
        }
      printPanel("Generated WebP", results.slice(0, 14), "magenta");
      }
      // UX note: prefer 'WebP' capitalization in user-visible strings (no leading dot)
      // Add advisory note about WebP filenames in user-facing text (use 'WebP' capitalization)
      printRelatedCommands(opts.generate ? "images-generate" : "images");
      printFooter();
    } catch (err) {
      console.error("Image scan failed:", err);
      process.exitCode = 2;
    }
  });

program
  .command("ui-colors")
  .description("Scan all color declarations in CSS, JSX, and TSX files to analyze the palette")
  .option("--out <file>", "Save report to file")
  .action(async (opts: { out?: string }) => {
    try {
      const result = await scanColors(process.cwd());
      printCommandIntro(process.argv.slice(2).join(" ") || "/ui-colors");

      const summary = [
        `${chalk.cyan("Unique colors:")} ${chalk.bold(String(result.totalUnique))}`,
        `${chalk.cyan("Total declarations:")} ${result.totalDeclarations}`,
        `${chalk.cyan("Tailwind color classes:")} ${result.tailwindColors}`,
        `${chalk.cyan("CSS custom properties:")} ${result.cssCustomProperties}`,
        `${result.hasColorInconsistencies ? chalk.yellow("⚠ Near-duplicate colors detected") : chalk.green("✓ No color inconsistencies found")}`
      ];
      printPanel("Color Palette Summary", summary, "magenta");

      if (result.allColors.length > 0) {
        const topColors = result.allColors.slice(0, 12).map(c =>
          `  ${chalk.bold(c.value.padEnd(22))} ${chalk.cyan(String(c.count).padStart(4))} ${chalk.dim("occurrences")}${c.files.length > 1 ? chalk.yellow(" (shared)") : ""}`
        );
        printPanel(`Top Colors (${Math.min(12, result.allColors.length)} of ${result.totalUnique})`, topColors, "blue");
      }

      if (result.hasColorInconsistencies) {
        const groups = new Map<string, string[]>();
        for (const c of result.allColors) {
          const rgbMatch = c.value.match(/^#([0-9a-f]{6})$/i);
          if (rgbMatch) {
            const n = rgbMatch[1];
            const r = Math.floor(parseInt(n.slice(0, 2), 16) / 32) * 32;
            const g = Math.floor(parseInt(n.slice(2, 4), 16) / 32) * 32;
            const b = Math.floor(parseInt(n.slice(4, 6), 16) / 32) * 32;
            const key = `${r},${g},${b}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(c.value);
          }
        }
        const inconsistent = [...groups.entries()].filter(([, vals]) => vals.length > 1);
        if (inconsistent.length > 0) {
          const lines = inconsistent.slice(0, 6).map(([bucket, vals]) =>
            `  ${chalk.yellow(vals.join(", "))} ${chalk.dim("(hue bucket: " + bucket + ")")}`
          );
          printPanel("Near-Duplicate Colors", [
            chalk.dim("These colors are visually similar but use different hex values:"),
            "",
            ...lines,
            inconsistent.length > 6 ? chalk.dim(`  … and ${inconsistent.length - 6} more groups`) : ""
          ], "yellow");
        }
      }

      if (result.cssCustomProperties > 0) {
        printPanel("CSS Custom Properties", [`${chalk.green("✓")} ${result.cssCustomProperties} color-related custom properties defined — good for maintainability.`], "green");
      }

      if (opts.out) {
        const top = result.allColors.slice(0, 20).map(c => `${c.value} (${c.count} uses, ${c.files.length} files)`).join("\n");
        const lines = [
          `Color Palette Scan for ${process.cwd()}`,
          "",
          `Unique colors: ${result.totalUnique}`,
          `Total declarations: ${result.totalDeclarations}`,
          `Tailwind color classes: ${result.tailwindColors}`,
          `CSS custom properties: ${result.cssCustomProperties}`,
          `Color inconsistencies: ${result.hasColorInconsistencies}`,
          "",
          `Top colors:`,
          top,
          result.allColors.length > 20 ? `... and ${result.allColors.length - 20} more` : ""
        ].join("\n");
        const writeModule = await import("./reporters/markdownWriter");
        const safePath = await writeModule.writeMarkdownReport(process.cwd(), opts.out || "colors.txt", lines, { keepTxt: true });
        console.log(chalk.dim(`\nReport saved to ${safePath}`));
      }

      printRelatedCommands("ui-colors");
      printFooter();
    } catch (err) {
      console.error("Color scan failed:", err);
      process.exitCode = 2;
    }
  });

program
  .command("seo")
  .description("Audit SEO: meta tags, Open Graph, Twitter Cards, structured data, and content quality")
  .action(async () => {
    try {
      const result = await runSeoWorkflow(process.cwd());
      printCommandIntro(process.argv.slice(2).join(" ") || "/seo");
      renderSeoReport(result);
      printRelatedCommands("seo");
      printFooter();
    } catch (err) {
      console.error("SEO audit failed:", err);
      process.exitCode = 2;
    }
  });

program
  .command("tech-debt")
  .description("Scan technical debt: TODOs, FIXMEs, console.log, any types, and code smells")
  .action(async () => {
    try {
      const result = await runTechDebtWorkflow(process.cwd());
      printCommandIntro(process.argv.slice(2).join(" ") || "/tech-debt");
      renderTechDebtReport(result);
      printRelatedCommands("tech-debt");
      printFooter();
    } catch (err) {
      console.error("Tech debt scan failed:", err);
      process.exitCode = 2;
    }
  });

program
  .command("performance")
  .description("Audit frontend performance: images, render-blocking, bundle hints, and resource hints")
  .action(async () => {
    try {
      const result = await runPerformanceWorkflow(process.cwd());
      printCommandIntro(process.argv.slice(2).join(" ") || "/performance");
      renderPerformanceReport(result);
      printRelatedCommands("performance");
      printFooter();
    } catch (err) {
      console.error("Performance audit failed:", err);
      process.exitCode = 2;
    }
  });

program
  .command("stack-audit")
  .description("Analyze the full technology stack: frameworks, build tools, testing, and CI")
  .action(async () => {
    try {
      const result = await runStackAuditWorkflow(process.cwd());
      printCommandIntro(process.argv.slice(2).join(" ") || "/stack-audit");
      renderStackAuditReport(result);
      printRelatedCommands("stack-audit");
      printFooter();
    } catch (err) {
      console.error("Stack audit failed:", err);
      process.exitCode = 2;
    }
  });

program
  .command("migration")
  .description("Detect legacy patterns and suggest migration paths")
  .action(async () => {
    try {
      const result = await runMigrationWorkflow(process.cwd());
      printCommandIntro(process.argv.slice(2).join(" ") || "/migration");
      renderMigrationReport(result);
      printRelatedCommands("migration");
      printFooter();
    } catch (err) {
      console.error("Migration scan failed:", err);
      process.exitCode = 2;
    }
  });

program
  .command("fe-score")
  .description("Consolidated frontend health score combining SEO, tech debt, performance, stack, and migration readiness")
  .action(async () => {
    try {
      const result = await runFeScoreWorkflow(process.cwd());
      printCommandIntro(process.argv.slice(2).join(" ") || "/fe-score");
      renderFeScoreReport(result);
      printRelatedCommands("fe-score");
      printFooter();
    } catch (err) {
      console.error("Frontend score failed:", err);
      process.exitCode = 2;
    }
  });

program
  .command("ui-standards")
  .description("Analyze component file organization, naming, exports, props, and complexity")
  .option("--out <file>", "Save report to file")
  .action(async (opts: { out?: string }) => {
    try {
      const result = await scanStandards(process.cwd());
      printCommandIntro(process.argv.slice(2).join(" ") || "/ui-standards");

      if (result.totalComponentFiles === 0) {
        printPanel("UI Standards", ["No component files (.jsx, .tsx) found in the project."], "yellow");
        if (opts.out) {
          const content = `UI Standards Scan for ${process.cwd()}\n\nNo component files (.jsx, .tsx) found.`;
          const writeModule = await import("./reporters/markdownWriter");
          const safePath = await writeModule.writeMarkdownReport(process.cwd(), opts.out || "standards.txt", content, { keepTxt: true });
          console.log(chalk.dim(`\nReport saved to ${safePath}`));
        }
        printRelatedCommands("ui-standards");
        printFooter();
        return;
      }

      const namingLines = [
        `${chalk.cyan("PascalCase files:")} ${result.pascalCaseFiles}  ${result.pascalCaseFiles > 0 ? chalk.green("✓") : chalk.yellow("⚠")}`,
        `${chalk.cyan("kebab-case files:")} ${result.kebabCaseFiles}  ${result.kebabCaseFiles === 0 ? chalk.green("✓") : chalk.yellow("⚠ Use PascalCase for components")}`,
        `${chalk.cyan("Organization:")} ${result.organizationType === "feature-folders" ? chalk.green("feature folders ✓") : result.organizationType === "flat" ? chalk.yellow("flat — consider feature folders") : result.organizationType}`
      ];
      printPanel("Naming & Organization", namingLines, "blue");

      const exportLines = [
        `${chalk.cyan("Default exports:")} ${result.defaultExports}`,
        `${chalk.cyan("Named exports:")} ${result.namedExports}`,
        `${chalk.cyan("Barrel files (index):")} ${result.hasIndexFiles}  ${result.hasIndexFiles > 0 ? chalk.green("✓") : chalk.dim("none found")}`,
        `${chalk.cyan("Props interface/type:")} ${result.hasPropsInterface ? chalk.green("✓ detected") : chalk.yellow("⚠ not detected")}`
      ];
      printPanel("Export & Props Patterns", exportLines, "cyan");

      printPanel("Complexity", [
        `${chalk.cyan("Avg lines per file:")} ${result.avgLinesPerComponent}`,
        result.avgLinesPerComponent > 200 ? chalk.yellow("⚠ Average is above 200 lines — consider splitting components") : chalk.green("✓ Healthy average"),
        ...(result.largeFiles.length > 0 ? [`${chalk.cyan("Files > 400 lines:")} ${chalk.yellow(String(result.largeFiles.length))}`, "", ...result.largeFiles.slice(0, 10).map(f => `  ${chalk.white(f)}`)] : [])
      ], result.largeFiles.length > 0 ? "yellow" : "green");

      if (result.organizationType === "flat" || !result.hasPropsInterface || result.kebabCaseFiles > 0) {
        const recs: string[] = [];
        if (result.kebabCaseFiles > 0) recs.push("Rename kebab-case component files to PascalCase");
        if (!result.hasPropsInterface && result.totalComponentFiles > 3) recs.push("Define TypeScript interfaces or types for component props");
        if (result.organizationType === "flat" && result.totalComponentFiles > 10) recs.push("Group components into feature folders");
        if (result.avgLinesPerComponent > 200) recs.push("Extract large components into smaller composable units");
        if (result.hasIndexFiles === 0 && result.totalComponentFiles > 5) recs.push("Add barrel (index.ts) files for cleaner imports");
        printPanel("Recommendations", recs.map(r => `  ${chalk.green("→")} ${r}`), "yellow");
      }

      if (opts.out) {
        const large = result.largeFiles.length > 0 ? `\nLarge files (>400 lines):\n${result.largeFiles.join("\n")}` : "";
        const lines = [
          `UI Standards Scan for ${process.cwd()}`,
          "",
          `Component files: ${result.totalComponentFiles}`,
          `PascalCase: ${result.pascalCaseFiles}  kebab-case: ${result.kebabCaseFiles}`,
          `Default exports: ${result.defaultExports}  Named exports: ${result.namedExports}`,
          `Props interface/type: ${result.hasPropsInterface}`,
          `Index/barrel files: ${result.hasIndexFiles}`,
          `Avg lines per component: ${result.avgLinesPerComponent}`,
          `Organization: ${result.organizationType}`,
          large
        ].join("\n");
        const writeModule = await import("./reporters/markdownWriter");
        const safePath = await writeModule.writeMarkdownReport(process.cwd(), opts.out || "standards.txt", lines, { keepTxt: true });
        console.log(chalk.dim(`\nReport saved to ${safePath}`));
      }

      printRelatedCommands("ui-standards");
      printFooter();
    } catch (err) {
      console.error("UI standards scan failed:", err);
      process.exitCode = 2;
    }
  });

program
  .command("ui-typography")
  .description("Audit typography: families, sizes, line-heights, weights, letter-spacing, transforms, and inline/Tailwind usage")
  .action(async () => {
    try {
      const result = await scanTypography(process.cwd());
      printCommandIntro(process.argv.slice(2).join(" ") || "/ui-typography");

      if (result.filesWithTypography === 0) {
        printPanel("Typography Audit", ["No typography declarations found."], "yellow");
        printRelatedCommands("ui-typography");
        printFooter();
        return;
      }

      const topSizes = result.fontSizes.slice(0, 6).map(s => `  ${chalk.bold(s.value.padEnd(12))} ${chalk.cyan(String(s.count))} occurrences`);
      printPanel("Typography Audit", [
        `${chalk.cyan("Files with typography:")} ${result.filesWithTypography}`,
        `${chalk.cyan("Total declarations:")} ${result.totalFontDeclarations}`,
        `${chalk.cyan("Unique font families:")} ${result.uniqueFontFamilies.length > 0 ? result.uniqueFontFamilies.join(", ") : "none detected"}`,
        `${chalk.cyan("Custom @font-face:")} ${result.customFonts.length > 0 ? result.customFonts.join(", ") : "none"}`,
        `${result.missingLineHeight > 0 ? chalk.yellow("⚠ " + result.missingLineHeight + " files missing line-height") : chalk.green("✓ All sizes have line-height")}`,
        `${chalk.cyan("Tailwind typography classes:")} ${result.tailwindTypographyCount}`,
        `${chalk.cyan("Inline typography styles:")} ${result.inlineTypographyCount}`
      ], "magenta");

      if (result.fontSizes.length > 0) {
        printPanel(`Top Font Sizes (${Math.min(6, result.fontSizes.length)} of ${result.fontSizes.length})`, topSizes, "blue");
      }
      if (result.lineHeights.length > 0) {
        const topHeights = result.lineHeights.slice(0, 4).map(h => `  ${chalk.bold(h.value.padEnd(12))} ${chalk.cyan(String(h.count))} occurrences`);
        printPanel("Line Heights", topHeights, "cyan");
      }
      if (result.fontWeights.length > 0) {
        const topWeights = result.fontWeights.slice(0, 4).map(w => `  ${chalk.bold(w.value.padEnd(12))} ${chalk.cyan(String(w.count))} occurrences`);
        printPanel("Font Weights", topWeights, "green");
      }
      if (result.letterSpacing.length > 0) {
        const topSpacing = result.letterSpacing.slice(0, 4).map(l => `  ${chalk.bold(l.value.padEnd(12))} ${chalk.cyan(String(l.count))} occurrences`);
        printPanel("Letter Spacing", topSpacing, "yellow");
      }
      if (result.textTransform.length > 0) {
        const topTransforms = result.textTransform.slice(0, 4).map(t => `  ${chalk.bold(t.value.padEnd(12))} ${chalk.cyan(String(t.count))} occurrences`);
        printPanel("Text Transform", topTransforms, "blue");
      }
      if (result.textDecoration.length > 0) {
        const topDecor = result.textDecoration.slice(0, 4).map(d => `  ${chalk.bold(d.value.padEnd(12))} ${chalk.cyan(String(d.count))} occurrences`);
        printPanel("Text Decoration", topDecor, "blue");
      }
      if (result.recommendations.length > 0) {
        const recLines = result.recommendations.map(r => `  ${chalk.yellow("→")} ${r}`);
        printPanel("Recommendations", recLines, "yellow");
      }

      printRelatedCommands("ui-typography");
      printFooter();
    } catch (err) {
      console.error("Typography scan failed:", err);
      process.exitCode = 2;
    }
  });

program
  .command("ui-spacing")
  .description("Scan spacing patterns: margins, paddings, gaps, position properties, and unit consistency")
  .action(async () => {
    try {
      const result = await scanSpacing(process.cwd());
      printCommandIntro(process.argv.slice(2).join(" ") || "/ui-spacing");

      if (result.filesWithSpacing === 0) {
        printPanel("Spacing Scan", ["No spacing declarations found."], "yellow");
        printRelatedCommands("ui-spacing");
        printFooter();
        return;
      }

      printPanel("Spacing Scan", [
        `${chalk.cyan("Files with spacing:")} ${result.filesWithSpacing}`,
        `${chalk.cyan("Total declarations:")} ${result.totalSpacingDeclarations}`,
        `${chalk.cyan("Tailwind spacing:")} ${result.tailwindSpacingCount}`,
        `${chalk.cyan("Inline spacing:")} ${result.inlineSpacingCount}`,
        `${chalk.cyan("Position properties:")} ${result.positionValues.length > 0 ? result.positionValues.reduce((s, p) => s + p.count, 0) : 0}`,
        ...(result.unitInconsistencies.length > 0 ? [`${chalk.yellow("⚠ " + result.unitInconsistencies.length + " files mix spacing units")}`] : [`${chalk.green("✓ No unit inconsistencies")}`]),
        ...(result.filesWithExcessiveUniqueValues.length > 0 ? [`${chalk.yellow("⚠ " + result.filesWithExcessiveUniqueValues.length + " files with >10 unique spacing values")}`] : [])
      ], "blue");

      if (result.marginValues.length > 0) {
        const topMargins = result.marginValues.slice(0, 6).map(m => `  ${chalk.bold(m.value.padEnd(14))} ${chalk.cyan(String(m.count))} occurrences`);
        printPanel(`Top Margin Values (${Math.min(6, result.marginValues.length)} of ${result.marginValues.length})`, topMargins, "yellow");
      }
      if (result.paddingValues.length > 0) {
        const topPaddings = result.paddingValues.slice(0, 6).map(p => `  ${chalk.bold(p.value.padEnd(14))} ${chalk.cyan(String(p.count))} occurrences`);
        printPanel(`Top Padding Values (${Math.min(6, result.paddingValues.length)} of ${result.paddingValues.length})`, topPaddings, "cyan");
      }
      if (result.gapValues.length > 0) {
        const topGaps = result.gapValues.slice(0, 4).map(g => `  ${chalk.bold(g.value.padEnd(14))} ${chalk.cyan(String(g.count))} occurrences`);
        printPanel("Gap Values", topGaps, "green");
      }
      if (result.positionValues.length > 0) {
        const topPos = result.positionValues.slice(0, 4).map(p => `  ${chalk.bold(p.value.padEnd(14))} ${chalk.cyan(String(p.count))} occurrences`);
        printPanel("Top Position Values", topPos, "red");
      }
      if (result.unitInconsistencies.length > 0) {
        const files = result.unitInconsistencies.slice(0, 5).map(f => `  ${chalk.white(f)}`);
        printPanel("Unit Inconsistencies", files, "yellow");
      }
      if (result.recommendations.length > 0) {
        const recLines = result.recommendations.map(r => `  ${chalk.yellow("→")} ${r}`);
        printPanel("Recommendations", recLines, "yellow");
      }

      printRelatedCommands("ui-spacing");
      printFooter();
    } catch (err) {
      console.error("Spacing scan failed:", err);
      process.exitCode = 2;
    }
  });

const normalizedArgv = normalizeSlashArgv(process.argv);

// Bare `better-ui-cli` opens the command center. Any explicit action beyond that must still use
// a slash-prefixed command so the public CLI stays slash-first.
if (normalizedArgv.length <= 2) {
  program.parseAsync([process.argv[0], process.argv[1], "tui"]);
} else {
  program.parseAsync(normalizedArgv);
}
