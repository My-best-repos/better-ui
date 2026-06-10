import fs from "fs";
import path from "path";
import { FileReport, ScanReport, HealthReport, LintMessage, HotspotEntry } from "./types";

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

function getLineCount(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

export function buildHotspots(report: ScanReport, projectRoot?: string, limit = 10, sortBy: "score" | "density" = "score", minScore = 0): HotspotEntry[] {
  const entries: HotspotEntry[] = [];

  for (const f of report.files) {
    if (f.errorCount + f.warningCount === 0) continue;

    const fixableCount = f.messages.filter(m => m.fixable).length;
    const categoryCounts = new Map<string, number>();
    for (const m of f.messages) {
      const cat = m.category || "maintainability";
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }
    const topCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "maintainability";
    const score = f.errorCount * 3 + f.warningCount;
    if (score < minScore) continue;

    let lineCount = 0;
    if (projectRoot) {
      lineCount = getLineCount(path.resolve(projectRoot, f.filePath));
    }

    entries.push({
      filePath: f.filePath,
      score,
      errors: f.errorCount,
      warnings: f.warningCount,
      fixableCount,
      lineCount,
      density: lineCount > 0 ? Math.round(((f.errorCount + f.warningCount) / lineCount) * 100) : 0,
      topCategory
    });
  }

  if (sortBy === "density") {
    entries.sort((a, b) => b.density - a.density || b.score - a.score);
  } else {
    entries.sort((a, b) => b.score - a.score || b.density - a.density);
  }

  return entries.slice(0, limit);
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

  const hotspots = buildHotspots(report, undefined, 10);

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


