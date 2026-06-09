import fs from "fs";
import path from "path";
import { getExtensions, getProjectLabel, getReportFile, loadConfig } from "../config";
import { getCurrentBranch, getChangedFiles, isGitRepository } from "../gitUtils";
import { buildHealthReport, buildMarkdownSummary, buildReviewBody } from "../insights";
import { resolveProjectPath } from "../projectPaths";
import { writeHtmlReport } from "../reporters/htmlReporter";
import { writeJsonReport } from "../reporters/jsonReporter";
import { writeMarkdownReport } from "../reporters/markdownWriter";
import { buildScanReport } from "../reporters/reportUtils";
import { scanImages } from "../scanners/imageScanner";
import { applyEslintFixes, applyFixHunks, applyFixPreviews, previewEslintFixes, scanProject } from "../scanners/eslintScanner";
import { ScanReport } from "../types";
import { buildExplainSummary, explainMessage } from "../explanations";

interface ScopeOptions {
  changed?: boolean;
  staged?: boolean;
}

function resolveScope(options?: ScopeOptions): "all" | "changed" | "staged" {
  if (options?.staged) {
    return "staged";
  }
  if (options?.changed) {
    return "changed";
  }
  return "all";
}

function resolveScopedFiles(projectRoot: string, options?: ScopeOptions) {
  const scope = resolveScope(options);
  if (scope === "changed") {
    return getChangedFiles(projectRoot, "changed");
  }
  if (scope === "staged") {
    return getChangedFiles(projectRoot, "staged");
  }
  return undefined;
}

export async function runScanWorkflow(projectRoot: string, options?: ScopeOptions & { out?: string; ext?: string[]; format?: "json" | "markdown" | "html"; writeReport?: boolean; command?: string }) {
  const config = loadConfig(projectRoot);
  const exts = getExtensions(config, options?.ext);
  const reportPath = options?.writeReport === false ? undefined : getReportFile(projectRoot, config, options?.out, options?.format, options?.command, true);
  const projectLabel = getProjectLabel(projectRoot, config);
  const scope = resolveScope(options);
  const scopedFiles = resolveScopedFiles(projectRoot, options);
  const files = await scanProject(projectRoot, exts, { files: scopedFiles });
  const report = buildScanReport(files, {
    scope,
    metadata: {
      projectName: projectLabel,
      reportFile: reportPath ? path.relative(projectRoot, reportPath) : "(not written)",
      extensions: exts
    }
  });

  let actualReportPath = reportPath;
  if (options?.writeReport !== false && reportPath) {
    if (options?.format === "html") {
      await writeHtmlReport(projectRoot, reportPath, report);
      actualReportPath = reportPath;
    } else if (options?.format !== "markdown") {
      actualReportPath = writeJsonReport(projectRoot, reportPath, report);
    } else {
      actualReportPath = await writeMarkdownReport(projectRoot, reportPath, buildMarkdownSummary(report, `${projectLabel} Report`));
    }
  }

  return { projectLabel, reportPath: actualReportPath, report, scopedFiles, isGitRepo: isGitRepository(projectRoot) };
}

export async function runFixWorkflow(projectRoot: string, options?: ScopeOptions & { apply?: boolean }) {
  const config = loadConfig(projectRoot);
  const exts = getExtensions(config);
  const scopedFiles = resolveScopedFiles(projectRoot, options);

  if (!options?.apply) {
    const files = await scanProject(projectRoot, exts, { files: scopedFiles });
    return { preview: true, report: buildScanReport(files, { scope: resolveScope(options) }) };
  }

  await applyEslintFixes(projectRoot, exts, { files: scopedFiles });
  const files = await scanProject(projectRoot, exts, { files: scopedFiles });
  return { preview: false, report: buildScanReport(files, { scope: resolveScope(options) }) };
}

export async function runInteractiveFixWorkflow(projectRoot: string, options?: ScopeOptions) {
  const config = loadConfig(projectRoot);
  const exts = getExtensions(config);
  const scopedFiles = resolveScopedFiles(projectRoot, options);
  const previews = await previewEslintFixes(projectRoot, exts, { files: scopedFiles });
  return { previews, scope: resolveScope(options) };
}

async function applyInteractiveFixSelection(projectRoot: string, previews: Awaited<ReturnType<typeof runInteractiveFixWorkflow>>["previews"], selectedFiles: string[], options?: ScopeOptions) {
  await applyFixPreviews(projectRoot, previews, selectedFiles);
  const config = loadConfig(projectRoot);
  const exts = getExtensions(config);
  const files = await scanProject(projectRoot, exts, { files: selectedFiles });
  return buildScanReport(files, { scope: resolveScope(options) });
}

export async function applyInteractiveHunkSelection(projectRoot: string, previews: Awaited<ReturnType<typeof runInteractiveFixWorkflow>>["previews"], selectedHunks: string[], options?: ScopeOptions) {
  await applyFixHunks(projectRoot, previews, selectedHunks);
  const config = loadConfig(projectRoot);
  const exts = getExtensions(config);
  const touchedFiles = [...new Set(previews.filter(preview => preview.hunks.some(hunk => selectedHunks.includes(hunk.id))).map(preview => preview.filePath))];
  const files = await scanProject(projectRoot, exts, { files: touchedFiles });
  return buildScanReport(files, { scope: resolveScope(options) });
}

export async function runHealthWorkflow(projectRoot: string) {
  const scan = await runScanWorkflow(projectRoot, { command: "health" });
  const images = await scanImages(projectRoot);
  const health = buildHealthReport(scan.report, images);
  return { ...scan, images, health };
}

export async function runDoctorWorkflow(projectRoot: string) {
  const config = loadConfig(projectRoot);
  const healthResult = await runHealthWorkflow(projectRoot);
  const packageJsonPath = resolveProjectPath(projectRoot, "package.json", "package.json");
  const packageJson = fs.existsSync(packageJsonPath)
    ? JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as { scripts?: Record<string, string> }
    : null;
  const scripts = packageJson?.scripts || {};
  const scriptChecks = ["better-ui:scan", "better-ui:fix", "better-ui:tui", "better-ui:health", "better-ui:doctor", "better-ui:a11y", "better-ui:pr-summary"];
  const missingScripts = scriptChecks.filter(script => !scripts[script]);
  const missingConfig = [
    !config.projectName ? "projectName" : null,
    !config.preset ? "preset" : null,
    !config.defaults?.reportFile ? "defaults.reportFile" : null,
    !config.defaults?.extensions?.length ? "defaults.extensions" : null
  ].filter(Boolean) as string[];

  return {
    ...healthResult,
    doctor: {
      configCompleteness: missingConfig.length === 0 ? "good" : missingConfig.length === 1 ? "partial" : "weak",
      missingConfig,
      missingScripts,
      scriptsPresent: scriptChecks.length - missingScripts.length,
      scriptChecks: scriptChecks.length
    }
  };
}

export async function runReviewWorkflow(projectRoot: string, options?: ScopeOptions & { out?: string; format?: "json" | "markdown" | "html"; writeReport?: boolean }) {
  const scope = resolveScope(options);
  const scan = await runScanWorkflow(projectRoot, { ...options, command: "review" });
  const branch = getCurrentBranch(projectRoot) || undefined;
  const body = buildReviewBody(scan.report, branch);

  if (options?.out) {
    const reportPath = options.out;
    if (options.format === "html") {
      await writeHtmlReport(projectRoot, reportPath, scan.report as any);
    } else if (options.format !== "markdown") {
      await writeJsonReport(projectRoot, reportPath, scan.report as any);
    } else {
      await writeMarkdownReport(projectRoot, reportPath, body, { keepTxt: true });
    }
  }

  return { ...scan, scope, body };
}

export async function runPrSummaryWorkflow(projectRoot: string, options?: ScopeOptions & { out?: string; format?: "json" | "markdown" | "html"; writeReport?: boolean }) {
  const review = await runReviewWorkflow(projectRoot, { changed: options?.changed ?? !options?.staged, staged: options?.staged, out: options?.out, format: options?.format, writeReport: options?.writeReport });
  return review;
}

export async function runAccessibilityWorkflow(projectRoot: string, options?: ScopeOptions) {
  const scan = await runScanWorkflow(projectRoot, { ...options, command: "check-accessibility", writeReport: false });
  const files = scan.report.files
    .map(file => ({
      ...file,
      messages: file.messages.filter(message => message.category === "accessibility")
    }))
    .filter(file => file.messages.length > 0)
    .map(file => ({
      filePath: file.filePath,
      errorCount: file.messages.filter(message => message.severity === 2).length,
      warningCount: file.messages.filter(message => message.severity === 1).length,
      messages: file.messages
    }));

  return buildScanReport(files, { scope: resolveScope(options) });
}

function readReportFile(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as ScanReport;
}

export async function runExplainWorkflow(projectRoot: string, target?: string): Promise<import("../types").ExplainResult> {
  if (target) {
    const resolvedTarget = resolveProjectPath(projectRoot, target, "Explain target");
      if (fs.existsSync(resolvedTarget) && /\.(json|txt)$/i.test(path.extname(resolvedTarget))) {
        const report = readReportFile(resolvedTarget);
      const summary = buildExplainSummary(report);
      // Build expanded per-rule explanations
      const explained = new Map<string, string>();
      for (const file of report.files) {
        for (const msg of file.messages) {
          const key = msg.ruleId || `general:${msg.message.slice(0, 40)}`;
          if (explained.has(key)) continue;
          const ex = explainMessage(msg);
          const block = `${ex.title}\nWhy: ${ex.why}\nFix: ${ex.fix}\n`;
          explained.set(key, block);
        }
      }
      const details = [...explained.values()].join("\n");
      const body = summary + "\n\n" + details;
      return { summary, report, target: resolvedTarget, body };
      }

    const scan = await runScanWorkflow(projectRoot, { command: "explain", writeReport: false });
    const summary = buildExplainSummary(scan.report, path.relative(projectRoot, resolvedTarget));
    const explained = new Map<string, string>();
    for (const file of scan.report.files) {
      for (const msg of file.messages) {
        const key = msg.ruleId || `general:${msg.message.slice(0, 40)}`;
        if (explained.has(key)) continue;
        const ex = explainMessage(msg);
        const block = `${ex.title}\nWhy: ${ex.why}\nFix: ${ex.fix}\n`;
        explained.set(key, block);
      }
    }
    const details = [...explained.values()].join("\n");
    const body = summary + "\n\n" + details;
    return { summary, report: scan.report, target: resolvedTarget, body };
  }

  const defaultReportPath = getReportFile(projectRoot, loadConfig(projectRoot));
  if (fs.existsSync(defaultReportPath)) {
    const report = readReportFile(defaultReportPath);
    const summary = buildExplainSummary(report);
    const explained = new Map<string, string>();
    for (const file of report.files) {
      for (const msg of file.messages) {
        const key = msg.ruleId || `general:${msg.message.slice(0, 40)}`;
        if (explained.has(key)) continue;
        const ex = explainMessage(msg);
        const block = `${ex.title}\nWhy: ${ex.why}\nFix: ${ex.fix}\n`;
        explained.set(key, block);
      }
    }
    const details = [...explained.values()].join("\n");
    const body = summary + "\n\n" + details;
    return { summary, report, target: defaultReportPath, body };
  }

  const scan = await runScanWorkflow(projectRoot, { command: "explain", writeReport: false });
  const summary = buildExplainSummary(scan.report);
  const explained = new Map<string, string>();
  for (const file of scan.report.files) {
    for (const msg of file.messages) {
      const key = msg.ruleId || `general:${msg.message.slice(0, 40)}`;
      if (explained.has(key)) continue;
      const ex = explainMessage(msg);
      const block = `${ex.title}\nWhy: ${ex.why}\nFix: ${ex.fix}\n`;
      explained.set(key, block);
    }
  }
  const details = [...explained.values()].join("\n");
  const body = summary + "\n\n" + details;
  return { summary, report: scan.report, target: defaultReportPath, body };
}
