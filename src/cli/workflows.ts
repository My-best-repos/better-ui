import fs from "fs";
import path from "path";
import { getExtensions, getProjectLabel, getReportFile, loadConfig } from "../config";
import { getCurrentBranch, getChangedFiles, isGitRepository } from "../gitUtils";
import { loadLatestSnapshot, saveSnapshot } from "../history";
import { buildHealthReport, buildMarkdownSummary, buildReviewBody, compareReports } from "../insights";
import { resolveProjectPath } from "../projectPaths";
import { writeHtmlReport } from "../reporters/htmlReporter";
import { writeJsonReport } from "../reporters/jsonReporter";
import { buildScanReport } from "../reporters/reportUtils";
import { scanImages } from "../scanners/imageScanner";
import { applyEslintFixes, applyFixHunks, applyFixPreviews, previewEslintFixes, scanProject } from "../scanners/eslintScanner";
import { ScanReport } from "../types";
import { buildExplainSummary } from "../explanations";

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

export async function runScanWorkflow(projectRoot: string, options?: ScopeOptions & { out?: string; ext?: string[]; format?: "json" | "markdown" | "html"; saveHistory?: boolean }) {
  const config = loadConfig(projectRoot);
  const exts = getExtensions(config, options?.ext);
  const reportPath = getReportFile(projectRoot, config, options?.out, options?.format);
  const projectLabel = getProjectLabel(projectRoot, config);
  const scope = resolveScope(options);
  const scopedFiles = resolveScopedFiles(projectRoot, options);
  const files = await scanProject(projectRoot, exts, { files: scopedFiles });
  const report = buildScanReport(files, {
    scope,
    metadata: {
      projectName: projectLabel,
      reportFile: path.relative(projectRoot, reportPath),
      extensions: exts
    }
  });

  if (options?.format === "html") {
    writeHtmlReport(projectRoot, reportPath, report);
  } else if (options?.format !== "markdown") {
    writeJsonReport(projectRoot, reportPath, report);
  } else {
    fs.writeFileSync(resolveProjectPath(projectRoot, reportPath, "Markdown report output"), buildMarkdownSummary(report, `${projectLabel} Report`), "utf8");
  }

  const snapshotPath = options?.saveHistory === false ? null : saveSnapshot(projectRoot, report);
  return { projectLabel, reportPath, report, snapshotPath, scopedFiles, isGitRepo: isGitRepository(projectRoot) };
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
  const scan = await runScanWorkflow(projectRoot);
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

export async function runCompareWorkflow(projectRoot: string) {
  const previous = loadLatestSnapshot(projectRoot);
  const current = await runScanWorkflow(projectRoot);
  if (!previous) {
    return { current, previous: null, delta: null };
  }
  return { current, previous, delta: compareReports(previous.report, current.report) };
}

export async function runReviewWorkflow(projectRoot: string, options?: ScopeOptions & { out?: string }) {
  const scope = resolveScope(options);
  const scan = await runScanWorkflow(projectRoot, { ...options, saveHistory: false });
  const branch = getCurrentBranch(projectRoot) || undefined;
  const body = buildReviewBody(scan.report, branch);
  if (options?.out) {
    fs.writeFileSync(resolveProjectPath(projectRoot, options.out, "Review output"), body, "utf8");
  }
  return { ...scan, scope, body };
}

export async function runPrSummaryWorkflow(projectRoot: string, options?: ScopeOptions & { out?: string }) {
  const review = await runReviewWorkflow(projectRoot, { changed: options?.changed ?? !options?.staged, staged: options?.staged, out: options?.out });
  return review;
}

export async function runAccessibilityWorkflow(projectRoot: string, options?: ScopeOptions) {
  const scan = await runScanWorkflow(projectRoot, { ...options, saveHistory: false });
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

export async function runExplainWorkflow(projectRoot: string, target?: string) {
  if (target) {
    const resolvedTarget = resolveProjectPath(projectRoot, target, "Explain target");
    if (fs.existsSync(resolvedTarget) && path.extname(resolvedTarget).toLowerCase() === ".json") {
      const report = readReportFile(resolvedTarget);
      return { summary: buildExplainSummary(report), report, target: resolvedTarget };
    }

    const scan = await runScanWorkflow(projectRoot, { saveHistory: false });
    return {
      summary: buildExplainSummary(scan.report, path.relative(projectRoot, resolvedTarget)),
      report: scan.report,
      target: resolvedTarget
    };
  }

  const defaultReportPath = getReportFile(projectRoot, loadConfig(projectRoot));
  if (fs.existsSync(defaultReportPath)) {
    const report = readReportFile(defaultReportPath);
    return { summary: buildExplainSummary(report), report, target: defaultReportPath };
  }

  const scan = await runScanWorkflow(projectRoot, { saveHistory: false });
  return { summary: buildExplainSummary(scan.report), report: scan.report, target: defaultReportPath };
}
