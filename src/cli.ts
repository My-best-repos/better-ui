import { Command } from "commander";
import path from "path";
import chalk from "chalk";
import { prompt } from "enquirer";
import fs from "fs";
import { exec } from "child_process";
import { COMMANDS } from "./commandCatalog";
import { runInit } from "./cli/initCommand";
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
} from "./cli/workflows";
import { explainMessage } from "./explanations";
import { loadLatestSnapshot } from "./history";
import { buildHotspots } from "./insights";
import { printSummary } from "./reporters/terminalReporter";
import { detectFramework } from "./config";
import { scanImages, generateWebP } from "./scanners/imageScanner";
import { normalizeSlashArgv } from "./slashCommands";
import { printBanner, printCommandCatalog, printPanel, formatDelta, formatElapsed, formatTimestamp, printGrid, printRunSummary, printFooter } from "./terminalUi";
import { runTui } from "./tui/app";
import { scanDependencies } from "./scanners/dependencyScanner";
import { formatRelatedCommands } from "./relatedCommands";

function parseExtensions(value?: string) {
  return value ? value.split(",").map(segment => segment.trim()).filter(Boolean) : undefined;
}

function addScopeOptions(command: Command) {
  return command
    .option("--changed", "Limit the command to modified and untracked git files")
    .option("--staged", "Limit the command to staged git files");
}

function printRelatedCommands(key: string) {
  printPanel("Next Best Moves", formatRelatedCommands(key), "cyan");
}

function printCommandIntro(commandText: string) {
  printBanner();
  printRunSummary(commandText);
}

const program = new Command();

program
  .name("better-ui")
  .description("Frontend command center for scans, health insights, reviews, and image optimization")
  .version("0.2.0")
  .showHelpAfterError();

addScopeOptions(
  program
    .command("scan")
    .description("Scan the project and produce a report with scoring, categories, and history")
    .option("--out <file>", "Report file")
    .option("--ext <exts>", "Comma-separated extensions (eg. .js,.ts)")
    .option("--format <format>", "json, markdown, or html", "json")
    .option("--skip-history", "Do not save a history snapshot to .better-ui/history")
    .option("--top <n>", "Number of hotspots to show", (v) => parseInt(v, 10), 5)
    .option("--open", "Open the generated HTML report with the system default application")
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
          // only pass saveHistory=false when user explicitly asked to skip
          saveHistory: opts.skipHistory ? false : undefined
        });

        const durationMs = Date.now() - start;

        // compute extra metrics
        const fixableCount = result.report.files.reduce((sum, f) => sum + f.messages.filter((m: any) => m.fixable).length, 0);
        const top = Number.isFinite(opts.top) ? Math.max(1, opts.top) : 5;
        const hotspots = buildHotspots(result.report, top);

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
          `${chalk.cyan("Saved report:")} ${result.reportPath ? path.resolve(result.reportPath) : "(not written)"}`,
          `${chalk.cyan("History snapshot:")} ${result.snapshotPath ? path.resolve(result.snapshotPath) : "disabled"}`,
          `${chalk.cyan("Report size:")} ${reportSizeText}`,
          `${chalk.cyan("Duration:")} ${formatElapsed(durationMs)}`,
          `${chalk.cyan("Files with issues:")} ${result.report.summary.filesWithIssues}`,
          `${chalk.cyan("Total issues:")} ${result.report.summary.totalIssues}`,
          `${chalk.cyan("Autofixable issues:")} ${fixableCount}`
        ], "cyan");

        // Category breakdown
        printPanel("Category Breakdown", categories.length > 0 ? categories.map(([name, count]) => `${chalk.cyan(String(name) + ":")} ${String(count)}`) : ["No categorized issues detected."], "blue");

        // Hotspots
        printPanel("Hotspots", hotspots.length > 0 ? hotspots.map(h => `${h.filePath}  score=${h.score}  errors=${h.errors}  warnings=${h.warnings}`) : ["No hotspots found."], "red");

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

        // Optionally open generated HTML report
        if (opts.open) {
          if (result.reportPath && String(result.reportPath).toLowerCase().endsWith(".html")) {
            try {
              // platform-specific open
              if (process.platform === "win32") {
                exec(`start "" "${result.reportPath}"`);
              } else if (process.platform === "darwin") {
                exec(`open "${result.reportPath}"`);
              } else {
                exec(`xdg-open "${result.reportPath}"`);
              }
              printPanel("Opened Report", ["The HTML report was opened in your default application."], "magenta");
            } catch (err) {
              printPanel("Open Report", ["Could not open the report automatically. Please open the file manually:" , String(result.reportPath)], "yellow");
            }
          } else {
            printPanel("Open Report", ["The --open option works only for HTML reports. Re-run with --format html or open the file manually."], "yellow");
          }
        }

        if (opts.verbose) {
          printPanel("Raw Report Path", [String(result.reportPath)], "cyan");
          if (result.snapshotPath) printPanel("Snapshot Path", [String(result.snapshotPath)], "cyan");
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

        if (result.preview) {
          const fixableCount = result.report.files.reduce((sum, f) => sum + f.messages.filter(m => m.fixable).length, 0);
          const fixableFiles = result.report.files.filter(f => f.messages.some(m => m.fixable)).length;
          const previewLines: string[] = [
            `${chalk.cyan("Scope:")} ${result.report.scope || "all"}`,
            `${chalk.cyan("Autofixable:")} ${chalk.green(String(fixableCount))} issues in ${fixableFiles} file(s)`,
            ""
          ];
          // Per-file fixable issue list
          for (const file of result.report.files) {
            const fixable = file.messages.filter(m => m.fixable);
            if (fixable.length === 0) continue;
            previewLines.push(`  ${chalk.white(file.filePath)}`);
            for (const msg of fixable) {
              const loc = msg.line !== null ? chalk.gray(`:${msg.line}${msg.column !== null ? `:${msg.column}` : ""}`) : "";
              const rule = msg.ruleId ? chalk.cyan(msg.ruleId) : "";
              previewLines.push(`    ${chalk.green("→")}${loc}  ${rule}  ${chalk.dim(msg.message.length > 90 ? msg.message.slice(0, 90) + "…" : msg.message)}`);
            }
          }
          if (fixableCount === 0) {
            previewLines.push("  " + chalk.dim("No autofixable issues detected in the current scope."));
          }
          previewLines.push("", chalk.dim("Re-run with --apply to write autofixes or --interactive for hunk-level selection."));
          printPanel("Fix Preview", previewLines, "yellow");
          printRelatedCommands("fix-preview");
          printFooter();
          return;
        }

        const remaining = result.report.summary.errors + result.report.summary.warnings;
        const fixedCount = result.report.files.reduce((sum, f) => sum + f.messages.filter(m => m.fixable).length, 0);
        const fixedFiles = result.report.files.filter(f => f.messages.some(m => m.fixable)).length;
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
  .command("doctor")
  .description("Run a broad project doctor view with health, config, and script checks")
  .action(async () => {
    try {
      const result = await runDoctorWorkflow(process.cwd());
      printCommandIntro(process.argv.slice(2).join(" ") || "/doctor");

      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as { name?: string; scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      const projectName = pkg.name || path.basename(process.cwd());

      // Config analysis
      const cfgLines: string[] = [];
      const cfgFields: Record<string, { recommended: string; hint: string }> = {
        "projectName": { recommended: `"${projectName}"`, hint: "Used in report headers and metadata" },
        "preset": { recommended: `"react", "next", "vite", "vue", "landing-page", "typescript-library"`, hint: "Enables preset-specific rules and defaults" },
        "defaults.reportFile": { recommended: `"report.json"`, hint: "Default output path for scan reports" },
        "defaults.extensions": { recommended: `[".js", ".jsx", ".ts", ".tsx"]`, hint: "File extensions the scanner will process" }
      };
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

      // Script analysis
      const scriptLines: string[] = [];
      const scriptChecks = ["better-ui:scan", "better-ui:fix", "better-ui:tui", "better-ui:health", "better-ui:doctor", "better-ui:a11y", "better-ui:pr-summary", "better-ui:review", "better-ui:init"];
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

      // ESLint config analysis
      const eslintPath = path.join(process.cwd(), "eslint.config.mjs");
      let eslintLines: string[] = [];
      if (fs.existsSync(eslintPath)) {
        const eslintContent = fs.readFileSync(eslintPath, "utf8");
        const enableRules = [...eslintContent.matchAll(/"([^"]+)":\s*"(error|warn)"/g)].map(m => `${m[1]} (${m[2]})`);
        const disableRules = [...eslintContent.matchAll(/"([^"]+)":\s*"off"/g)].map(m => m[1]);
        const ignoredPaths = [...eslintContent.matchAll(/ignores:\s*\[([^\]]+)\]/g)].flatMap(m => m[1].split(",").map(s => s.trim().replace(/['"]/g, "")));
        if (enableRules.length > 0) {
          eslintLines.push(`  ${chalk.green("Enabled:")} ${enableRules.join(", ")}`);
        }
        if (disableRules.length > 0) {
          eslintLines.push(`  ${chalk.yellow("Disabled:")} ${disableRules.join(", ")}`);
        }
        if (ignoredPaths.length > 0) {
          eslintLines.push(`  ${chalk.dim("Ignored:")} ${ignoredPaths.join(", ")}`);
        }
        eslintLines.push(`  ${chalk.dim("Files:")} **/*.{js,cjs,mjs,ts,tsx}  ${chalk.dim("Parser:")} @typescript-eslint/parser`);
      } else {
        eslintLines.push("  No ESLint configuration found.");
      }
      printPanel("ESLint Config", eslintLines, "cyan");

      // tsconfig analysis
      const tsconfigPath = path.join(process.cwd(), "tsconfig.json");
      let tsLines: string[] = [];
      if (fs.existsSync(tsconfigPath)) {
        try {
          const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8")) as { compilerOptions?: Record<string, unknown> };
          const co = tsconfig.compilerOptions || {};
          const target = co.target || "not set";
          const strictMode = co.strict === true;
          const moduleType = co.module || "not set";
          tsLines.push(`  ${chalk.cyan("Target:")} ${String(target)}`);
          tsLines.push(`  ${chalk.cyan("Module:")} ${String(moduleType)}`);
          tsLines.push(`  ${strictMode ? chalk.green("✓ Strict mode enabled") : chalk.red("✗ Strict mode NOT enabled")}`);
          if (typeof co.skipLibCheck !== "undefined") {
            tsLines.push(`  ${chalk.dim("skipLibCheck:")} ${String(co.skipLibCheck)}`);
          }
        } catch {
          tsLines.push("  Could not parse tsconfig.json");
        }
      } else {
        tsLines.push("  No TypeScript config found.");
      }
      printPanel("TypeScript Config", tsLines, "cyan");

      // Framework detection
      const frameworks = detectFramework(process.cwd());
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
      printFooter();
    } catch (err) {
      console.error("Doctor command failed:", err);
      process.exitCode = 2;
    }
  });

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
          for (const msg of cf.messages) {
            const loc = msg.line !== null ? chalk.gray(`:${msg.line}${msg.column !== null ? `:${msg.column}` : ""}`) : "";
            const rule = msg.ruleId ? chalk.cyan(msg.ruleId) : "";
            lines.push(`  ${chalk.white(cf.filePath)}${loc}  ${rule}  ${chalk.dim(msg.message.length > 100 ? msg.message.slice(0, 100) + "…" : msg.message)}`);
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
        `${chalk.cyan("Runtime deps:")} ${runtimeDeps.length}`,
        `${chalk.cyan("Dev deps:")} ${devDeps.length}`,
        `${chalk.cyan("Peer deps:")} ${peerDeps.length}`,
        `${chalk.cyan("Total:")} ${runtimeDeps.length + devDeps.length + peerDeps.length}`,
        "",
        `${chalk.cyan("Unused:")} ${unusedDependencies.length > 0 ? chalk.red(unusedDependencies.length) : chalk.green("0")}`,
        `${chalk.cyan("Heavy:")} ${heavySet.size > 0 ? chalk.yellow(heavySet.size) : chalk.green("0")}`
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
    printGrid([
      {
        title: "Supercharged Scan",
        color: "cyan",
        lines: [
          chalk.yellow("--changed") + "      : Scan only modified/untracked files",
          chalk.yellow("--staged") + "       : Scan only files ready to commit",
          chalk.yellow("--scan-images") + "  : Discover heavy images during scan",
          chalk.yellow("--format html") + "  : Generate a visual dashboard",
          chalk.yellow("--open") + "         : Open the HTML report in your browser",
          chalk.yellow("--verbose") + "      : Show extended scan details",
          chalk.yellow("--top <n>") + "      : Show top N hotspots (default: 5)"
        ]
      },
      {
        title: "Surgical Fixes",
        color: "green",
        lines: [
          chalk.yellow("/fix --interactive") + " : Pick hunks one by one",
          chalk.yellow("/fix --apply") + "       : Auto-fix everything safely",
          chalk.yellow("/fix --changed") + "     : Fix only changed files",
          chalk.yellow("/fix --staged") + "      : Fix only staged files"
        ]
      },
      {
        title: "Reports & Review",
        color: "magenta",
        lines: [
          chalk.yellow("/review --changed") + "  : Generate a code review body",
          chalk.yellow("/pr-summary") + "        : Draft PR markdown summary",
          chalk.yellow("/health") + "            : Category scores and priorities",
          chalk.yellow("/doctor") + "            : Full project diagnostic",
          chalk.yellow("/compare") + "           : Diff against last snapshot"
        ]
      },
      {
        title: "Image Optimization",
        color: "blue",
        lines: [
          chalk.yellow("/images") + "            : List all project images",
          chalk.yellow("/images --generate") + " : Convert to WebP",
          chalk.yellow("--quality <n>") + "      : WebP quality 1-100 (default 75)",
          chalk.yellow("") + "",
          chalk.yellow("Ctrl+Shift+S") + "       : Command Palette in TUI"
        ]
      }
    ]);
    printPanel("Tip", [
      `${chalk.dim("Most commands accept --changed and --staged to scope to git changes.")}`,
      `${chalk.dim("Use better-ui-cli /menu to open the full TUI dashboard.")}`
    ], "cyan");
    printRelatedCommands("advanced");
    printFooter();
  });

program
  .command("hotspots")
  .description("List the files with the highest issue density")
  .action(async () => {
    try {
      const result = await runScanWorkflow(process.cwd());
      printCommandIntro(process.argv.slice(2).join(" ") || "/hotspots");

      const topN = 10;
      const hotspots = buildHotspots(result.report, topN);
      if (hotspots.length === 0) {
        printPanel("Hotspots", ["No hotspots found — no files with issues."], "green");
        printRelatedCommands("hotspots");
        printFooter();
      } else {
        const totalFiles = result.report.files.length;
        printPanel("Hotspots", [
          `${chalk.dim(`Top ${Math.min(topN, hotspots.length)} of ${totalFiles} files`)}`,
          "",
          chalk.cyan("  File") + chalk.dim("                          Errors  Warnings  Score"),
          ...hotspots.map(h =>
            `  ${chalk.white(h.filePath.padEnd(38))} ${chalk.red(String(h.errors).padStart(4))}   ${chalk.yellow(String(h.warnings).padStart(5))}  ${chalk.bold(String(h.score).padStart(5))}`
          )
        ], "red");

        // Per-hotspot message detail
        const hotspotPaths = new Set(hotspots.map(h => h.filePath));
        for (const hotspot of hotspots) {
          const file = result.report.files.find(f => f.filePath === hotspot.filePath);
          if (!file || file.messages.length === 0) continue;
          const msgLines: string[] = [];
          for (const msg of file.messages) {
            const loc = msg.line !== null ? chalk.gray(`:${msg.line}${msg.column !== null ? `:${msg.column}` : ""}`) : "";
            const tag = msg.severity === 2 ? chalk.red("error") : msg.severity === 1 ? chalk.yellow("warn") : chalk.gray("info");
            const rule = msg.ruleId ? chalk.cyan(msg.ruleId) : "";
            const text = msg.message.length > 100 ? msg.message.slice(0, 100) + "…" : msg.message;
            msgLines.push(`  ${tag} ${rule}${loc}  ${chalk.dim(text)}`);
          }
          printPanel(`  ${hotspot.filePath}`, msgLines, "yellow");
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
        const a11yCount = report.files.reduce((sum, f) => sum + f.messages.filter(m => m.category === "accessibility").length, 0);
        const explanationLines = report.files.flatMap(file => file.messages.slice(0, 3).map(message => {
          const explanation = explainMessage(message);
          return `${chalk.white(file.filePath)}  ${explanation.title}  ${chalk.dim("→ " + explanation.fix)}`;
        }));
        printPanel("Accessibility", [
          `${chalk.cyan("Accessibility issues:")} ${a11yCount}`,
          "",
          ...(explanationLines.length > 0 ? explanationLines.slice(0, 12) : ["No accessibility issues were detected in the selected scope."])
        ], "blue");
        printRelatedCommands("check-accessibility");
        printFooter();
      } catch (err) {
        console.error("Accessibility command failed:", err);
        process.exitCode = 2;
      }
    })
);

addScopeOptions(
  program
    .command("review")
    .description("Generate a PR-style summary for the selected scope")
    .option("--out <file>", "Optional file to write the markdown summary to")
    .action(async (opts: { changed?: boolean; staged?: boolean; out?: string }) => {
      try {
        const result = await runReviewWorkflow(process.cwd(), opts);
        printCommandIntro(process.argv.slice(2).join(" ") || "/review");

        printPanel("Review Scope", [
          `${chalk.cyan("Scope:")} ${result.scope}`,
          `${chalk.cyan("Score:")} ${result.report.summary.score}/100`,
          `${chalk.cyan("Errors:")} ${chalk.red(String(result.report.summary.errors))}  ${chalk.cyan("Warnings:")} ${chalk.yellow(String(result.report.summary.warnings))}`,
          `${chalk.cyan("Files with issues:")} ${result.report.summary.filesWithIssues}`,
          opts.out ? `${chalk.cyan("Written to:")} ${path.resolve(opts.out)}` : chalk.dim("Use --out review.md to save this summary.")
        ], "cyan");
        console.log(`\n${result.body}\n`);
        printRelatedCommands(opts.changed ? "review-changed" : opts.staged ? "review-staged" : "review");
        printFooter();
      } catch (err) {
        console.error("Review command failed:", err);
        process.exitCode = 2;
      }
    })
);

addScopeOptions(
  program
    .command("pr-summary")
    .description("Generate a pull-request summary, defaulting to changed files")
    .option("--out <file>", "Optional file to write the markdown summary to")
    .action(async (opts: { changed?: boolean; staged?: boolean; out?: string }) => {
      try {
        const result = await runPrSummaryWorkflow(process.cwd(), opts);
        printCommandIntro(process.argv.slice(2).join(" ") || "/pr-summary");

        printPanel("PR Summary", [
          `${chalk.cyan("Scope:")} ${result.scope}`,
          `${chalk.cyan("Score:")} ${result.report.summary.score}/100`,
          `${chalk.cyan("Issues:")} ${result.report.summary.totalIssues} (${chalk.red(result.report.summary.errors)} errors, ${chalk.yellow(result.report.summary.warnings)} warnings)`,
          opts.out ? `${chalk.cyan("Written to:")} ${path.resolve(opts.out)}` : chalk.dim("Use --out pr-summary.md to save this summary.")
        ], "cyan");
        console.log(`\n${result.body}\n`);
        printRelatedCommands("pr-summary");
        printFooter();
      } catch (err) {
        console.error("PR summary command failed:", err);
        process.exitCode = 2;
      }
    })
);

program
  .command("compare")
  .description("Compare the current scan with the most recent saved snapshot")
  .action(async () => {
    try {
      const previous = loadLatestSnapshot(process.cwd());
      const result = await runCompareWorkflow(process.cwd());
      printCommandIntro(process.argv.slice(2).join(" ") || "/compare");

      if (!previous || !result.delta) {
        printPanel("Compare", ["No previous snapshot was found. A new snapshot has been saved for future comparisons."], "yellow");
        printRelatedCommands("compare");
        printFooter();
        return;
      }

      const previousTime = previous.savedAt ? formatTimestamp(previous.savedAt) : "unknown";
      printPanel("Comparison", [
        `${chalk.dim("Previous: " + previousTime)}`,
        `${chalk.cyan("Score:")} ${result.current.report.summary.score}/100 ${chalk.dim("(prev: " + previous.report.summary.score + ")")}  ${formatDelta(result.delta.scoreDelta)}`,
        `${chalk.cyan("Errors:")} ${chalk.red(String(result.current.report.summary.errors))}  ${formatDelta(result.delta.errorDelta)}`,
        `${chalk.cyan("Warnings:")} ${chalk.yellow(String(result.current.report.summary.warnings))}  ${formatDelta(result.delta.warningDelta)}`,
        `${chalk.cyan("Files:")} ${result.current.report.summary.filesWithIssues}  ${formatDelta(result.delta.fileDelta)}`
      ], "green");

      // Per-file delta
      const prevFiles = new Map(previous.report.files.map(f => [f.filePath, f]));
      const currFiles = new Map(result.current.report.files.map(f => [f.filePath, f]));
      const allPaths = new Set([...prevFiles.keys(), ...currFiles.keys()]);
      const fileDeltas: { path: string; errors: number; warnings: number }[] = [];
      for (const fp of allPaths) {
        const prev = prevFiles.get(fp);
        const curr = currFiles.get(fp);
        const prevErrors = prev?.errorCount ?? 0;
        const prevWarnings = prev?.warningCount ?? 0;
        const currErrors = curr?.errorCount ?? 0;
        const currWarnings = curr?.warningCount ?? 0;
        if (prevErrors !== currErrors || prevWarnings !== currWarnings) {
          fileDeltas.push({ path: fp, errors: currErrors - prevErrors, warnings: currWarnings - prevWarnings });
        }
      }
      if (fileDeltas.length > 0) {
        const sorted = fileDeltas.sort((a, b) => Math.abs(b.errors) + Math.abs(b.warnings) - (Math.abs(a.errors) + Math.abs(a.warnings)));
        const diffLines = sorted.slice(0, 15).map(d => {
          const errStr = d.errors !== 0 ? formatDelta(d.errors) : "";
          const warnStr = d.warnings !== 0 ? formatDelta(d.warnings) : "";
          const parts = [chalk.white(d.path)];
          if (errStr) parts.push(chalk.dim("errors:") + errStr);
          if (warnStr) parts.push(chalk.dim("warnings:") + warnStr);
          return `  ${parts.join("  ")}`;
        });
        if (sorted.length > 15) {
          diffLines.push(chalk.dim(`  … and ${sorted.length - 15} more files`));
        }
        printPanel("File Changes", diffLines, "yellow");
      } else {
        printPanel("File Changes", ["No individual file changes detected between snapshots."], "green");
      }
      printRelatedCommands("compare");
      printFooter();
    } catch (err) {
      console.error("Compare command failed:", err);
      process.exitCode = 2;
    }
  });

program
  .command("explain [target]")
  .description("Explain why findings matter and how to fix them for a report or file")
  .action(async (target?: string) => {
    try {
      const result = await runExplainWorkflow(process.cwd(), target);
      printCommandIntro(process.argv.slice(2).join(" ") || "/explain");

      printPanel("Explain", [
        `${chalk.cyan("Target:")} ${result.target}`,
        `${chalk.cyan("Files with issues:")} ${result.report.summary.filesWithIssues}`,
        `${chalk.cyan("Errors:")} ${chalk.red(String(result.report.summary.errors))}  ${chalk.cyan("Warnings:")} ${chalk.yellow(String(result.report.summary.warnings))}`,
        `${chalk.cyan("Total issues:")} ${result.report.summary.totalIssues}`
      ], "magenta");

      // Per-message explanation detail
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
        printPanel("Rule Explanations", explainLines.slice(0, 24), "cyan");
      }

      if (result.summary) {
        console.log(chalk.dim("\nSummary:"));
        console.log(`  ${result.summary}`);
      }
      printRelatedCommands("explain");
      printFooter();
    } catch (err) {
      console.error("Explain command failed:", err);
      process.exitCode = 2;
    }
  });

program
  .command("commands")
  .description("Show the full command catalog and slash aliases")
  .action(() => {
    printCommandIntro(process.argv.slice(2).join(" ") || "/commands");
    printCommandCatalog();
    printPanel("Examples", COMMANDS.slice(0, 5).map(command => `${chalk.cyan(command.slash)} -> ${command.example}`), "magenta");
    printRelatedCommands("commands");
    printFooter();
  });

program
  .command("init")
  .description("Interactive assistant to set up better-ui in your project")
  .option("--preset <name>", "Preset: react, next, vite, vue, design-system, landing-page, typescript-library")
  .action(async (opts: { preset?: string }) => {
    try {
      const result = await runInit(process.cwd(), opts);
      const pkgJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as { name?: string };
      printCommandIntro(process.argv.slice(2).join(" ") || "/init");
      printPanel("Setup Complete", [
        `${chalk.cyan("Project:")} ${chalk.bold(pkgJson.name || path.basename(process.cwd()))}`,
        `${chalk.cyan("Try:")} ${chalk.bold("better-ui-cli /scan")} to generate a report or ${chalk.bold("better-ui-cli /health")} for project health.`
      ], "green");
      printRelatedCommands("init");
      if (result?.openTui) {
        await runTui();
      }
    } catch (err) {
      console.error("Init failed:", err);
      process.exitCode = 2;
    }
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
      printRelatedCommands(opts.generate ? "images-generate" : "images");
      printFooter();
    } catch (err) {
      console.error("Image scan failed:", err);
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
