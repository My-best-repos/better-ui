import fs from "fs";
import path from "path";
import { getExtensions, getProjectLabel, getReportFile, loadConfig } from "../config";
import { getCurrentBranch, getChangedFiles, isGitRepository } from "../gitUtils";
import { buildHealthReport, buildMarkdownSummary } from "../insights";
import { resolveProjectPath } from "../projectPaths";
import { writeHtmlReport } from "../reporters/htmlReporter";
import { writeJsonReport } from "../reporters/jsonReporter";
import { writeMarkdownReport } from "../reporters/markdownWriter";
import { buildScanReport } from "../reporters/reportUtils";
import { scanImages } from "../scanners/imageScanner";
import { scanSeo } from "../scanners/seoScanner";
import { scanTechDebt } from "../scanners/techDebtScanner";
import { scanPerformance } from "../scanners/performanceScanner";
import { scanStackAudit } from "../scanners/stackAuditScanner";
import { scanMigrationIssues } from "../scanners/migrationScanner";
import { applyFixPreviews, previewEslintFixes, scanProject } from "../scanners/eslintScanner";
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

  const previews = await previewEslintFixes(projectRoot, exts, { files: scopedFiles });

  if (previews.length === 0) {
    return { previews: [], report: buildScanReport([], { scope: resolveScope(options) }) };
  }

  if (!options?.apply) {
    return { previews, report: null };
  }

  const allFilePaths = previews.map(p => p.filePath);
  await applyFixPreviews(projectRoot, previews, allFilePaths);
  const files = await scanProject(projectRoot, exts, { files: allFilePaths });
  const report = buildScanReport(files, { scope: resolveScope(options) });
  return { previews, report };
}

export async function runInteractiveFixWorkflow(projectRoot: string, options?: ScopeOptions) {
  const config = loadConfig(projectRoot);
  const exts = getExtensions(config);
  const scopedFiles = resolveScopedFiles(projectRoot, options);
  const previews = await previewEslintFixes(projectRoot, exts, { files: scopedFiles });
  return { previews, scope: resolveScope(options) };
}

export async function applyInteractiveHunkSelection(projectRoot: string, previews: Awaited<ReturnType<typeof runInteractiveFixWorkflow>>["previews"], selectedHunks: string[], options?: ScopeOptions) {
  const { applyFixHunks } = await import("../scanners/eslintScanner");
  await applyFixHunks(projectRoot, previews, selectedHunks);
  const config = loadConfig(projectRoot);
  const exts = getExtensions(config);
  const touchedFiles = [...new Set(previews.filter(preview => preview.hunks.some(hunk => selectedHunks.includes(hunk.id))).map(preview => preview.filePath))];
  const files = await scanProject(projectRoot, exts, { files: touchedFiles });
  return buildScanReport(files, { scope: resolveScope(options) });
}

export async function runHealthWorkflow(projectRoot: string) {
  const scan = await runScanWorkflow(projectRoot, { command: "health", writeReport: false });
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
  const scriptChecks = ["better-ui:scan", "better-ui:fix", "better-ui:tui", "better-ui:health", "better-ui:doctor", "better-ui:a11y", "better-ui:init"];
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

export async function runSeoWorkflow(projectRoot: string) {
  return scanSeo(projectRoot);
}

export async function runTechDebtWorkflow(projectRoot: string) {
  return scanTechDebt(projectRoot);
}

export async function runPerformanceWorkflow(projectRoot: string) {
  return scanPerformance(projectRoot);
}

export async function runStackAuditWorkflow(projectRoot: string) {
  return scanStackAudit(projectRoot);
}

export async function runMigrationWorkflow(projectRoot: string) {
  return scanMigrationIssues(projectRoot);
}

export interface FeScoreResult {
  totalScore: number;
  scores: { name: string; score: number; weight: number }[];
  recommendations: string[];
  seo: Awaited<ReturnType<typeof scanSeo>>;
  techDebt: Awaited<ReturnType<typeof scanTechDebt>>;
  performance: Awaited<ReturnType<typeof scanPerformance>>;
  stack: Awaited<ReturnType<typeof scanStackAudit>>;
  migration: Awaited<ReturnType<typeof scanMigrationIssues>>;
}

export async function runFeScoreWorkflow(projectRoot: string): Promise<FeScoreResult> {
  const [seo, debt, perf, stack, migration] = await Promise.all([
    scanSeo(projectRoot),
    scanTechDebt(projectRoot),
    scanPerformance(projectRoot),
    scanStackAudit(projectRoot),
    scanMigrationIssues(projectRoot),
  ]);

  const scores = [
    { name: "SEO", score: seo.score, weight: 0.2 },
    { name: "Tech Debt", score: debt.score, weight: 0.2 },
    { name: "Performance", score: perf.score, weight: 0.2 },
    { name: "Stack & Tooling", score: stack.score, weight: 0.15 },
    { name: "Migration Readiness", score: migration.score, weight: 0.15 },
  ];

  const totalScore = Math.round(scores.reduce((sum, s) => sum + s.score * s.weight, 0));
  const allRecs = [
    ...seo.recommendations.slice(0, 3),
    ...debt.recommendations.slice(0, 3),
    ...perf.recommendations.slice(0, 3),
    ...stack.recommendations.slice(0, 2),
    ...migration.recommendations.slice(0, 2),
  ];

  return {
    totalScore,
    scores,
    recommendations: allRecs.slice(0, 10),
    seo,
    techDebt: debt,
    performance: perf,
    stack,
    migration,
  };
}
