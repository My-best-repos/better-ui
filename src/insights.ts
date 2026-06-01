import { FileReport, ScanReport, HealthReport, LintMessage } from "./types";

export function buildCategoryCounts(files: FileReport[]) {
  const counts: Record<string, number> = {
    correctness: 0,
    maintainability: 0,
    accessibility: 0,
    performance: 0,
    dx: 0,
    "code-quality": 0
  };

  for (const file of files) {
    for (const msg of file.messages) {
      const cat = (msg.category as string) || "code-quality";
      counts[cat] = (counts[cat] || 0) + 1;
    }
  }

  return counts as Record<any, number>;
}

export function buildScanScore(files: FileReport[]) {
  const total = files.reduce((s, f) => s + f.errorCount + Math.max(0, Math.floor(f.warningCount / 2)), 0);
  const score = Math.max(0, 100 - Math.min(100, total));
  return score;
}

export function buildHotspots(report: ScanReport, limit = 10) {
  const hotspots = report.files.map(f => ({ filePath: f.filePath, score: f.errorCount * 3 + f.warningCount, errors: f.errorCount, warnings: f.warningCount }));
  hotspots.sort((a, b) => b.score - a.score);
  return hotspots.slice(0, limit);
}

export function inferCategory(message: LintMessage): LintMessage["category"] {
  if (message.ruleId && message.ruleId.includes("aria")) return "accessibility";
  if (message.ruleId && /no-console|no-unused-vars|eqeqeq/.test(message.ruleId)) return "code-quality";
  if (message.ruleId && /jsx|react|fragment/.test(message.ruleId)) return "dx";
  return message.category || "maintainability";
}

export function inferImpact(message: LintMessage) {
  if (message.severity === 2) return "high" as const;
  return "medium" as const;
}

export function buildHealthReport(report: ScanReport, images: { file: string; size: number }[]): HealthReport {
  const categories: HealthReport["categories"] = {} as any;
  const keys = Object.keys(report.summary.categories) as Array<keyof typeof report.summary.categories>;
  for (const key of keys) {
    const count = (report.summary.categories as any)[key] || 0;
    categories[key] = { count, score: Math.max(0, 100 - count * 10), label: String(key) } as any;
  }

  const safeAutofixes = report.files.reduce((sum, f) => sum + f.messages.filter(m => m.fixable).length, 0);
  const highImpactIssues = report.files.reduce((sum, f) => sum + f.messages.filter(m => m.severity === 2).length, 0);

  const priorities = [] as HealthReport["priorities"];
  if (report.summary.errors > 0) {
    priorities.push({ label: "Fix errors", detail: `${report.summary.errors} errors detected`, impact: "high" });
  }
  if (safeAutofixes > 0) {
    priorities.push({ label: "Apply autofixes", detail: `${safeAutofixes} issues can be auto-fixed`, impact: "medium" });
  }
  if (report.summary.warnings > 0) {
    priorities.push({ label: "Address warnings", detail: `${report.summary.warnings} warnings to review`, impact: "medium" });
  }
  const categoriesWithIssues = Object.entries(categories).filter(([, c]) => c.count > 0).sort(([, a], [, b]) => b.count - a.count);
  for (const [cat, info] of categoriesWithIssues) {
    priorities.push({ label: `Improve ${cat}`, detail: `${info.count} issues in ${cat}`, impact: info.score < 70 ? "high" : "low" });
  }

  const hotspots = buildHotspots(report, 10);

  return {
    generatedAt: new Date().toISOString(),
    score: report.summary.score,
    summary: {
      errors: report.summary.errors,
      warnings: report.summary.warnings,
      filesWithIssues: report.summary.filesWithIssues,
      safeAutofixes,
      highImpactIssues,
      images: images.length,
      imageBytes: images.reduce((s, i) => s + i.size, 0)
    },
    categories,
    priorities,
    hotspots
  };
}

export function buildMarkdownSummary(report: ScanReport, title = "Scan Report") {
  const lines = [] as string[];
  lines.push(`# ${title}`);
  lines.push(`Score: ${report.summary.score}/100`);
  lines.push("");
  for (const file of report.files.slice(0, 20)) {
    lines.push(`- ${file.filePath}: ${file.errorCount} errors, ${file.warningCount} warnings`);
  }
  return lines.join("\n");
}

export function buildReviewBody(report: ScanReport, branchName?: string) {
  return buildMarkdownSummary(report, `Review for ${branchName || "changes"}`);
}

export function compareReports(previous: ScanReport, current: ScanReport) {
  return {
    scoreDelta: current.summary.score - previous.summary.score,
    errorDelta: current.summary.errors - previous.summary.errors,
    warningDelta: current.summary.warnings - previous.summary.warnings,
    fileDelta: current.summary.filesWithIssues - previous.summary.filesWithIssues
  };
}
