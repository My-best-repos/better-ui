import { describe, it, expect } from "vitest";
import { buildCategoryCounts, buildScanScore, buildHotspots, inferCategory, inferImpact, buildHealthReport, buildMarkdownSummary, compareReports } from "../src/insights";
import type { FileReport, ScanReport, LintMessage } from "../src/types";

function makeFile(filePath: string, errors: number, warnings: number, messages: LintMessage[] = []): FileReport {
  return { filePath, errorCount: errors, warningCount: warnings, messages };
}

function makeMsg(overrides: Partial<LintMessage> = {}): LintMessage {
  return { ruleId: null, message: "test", line: 1, column: 1, severity: 1, ...overrides };
}

describe("buildCategoryCounts", () => {
  it("counts issues per category", () => {
    const files = [
      makeFile("a.ts", 0, 0, [makeMsg({ category: "correctness" }), makeMsg({ category: "correctness" })]),
      makeFile("b.ts", 0, 0, [makeMsg({ category: "maintainability" })]),
    ];
    const counts = buildCategoryCounts(files);
    expect(counts.correctness).toBe(2);
    expect(counts.maintainability).toBe(1);
    expect(counts.accessibility).toBe(0);
  });

  it("defaults to code-quality when no category", () => {
    const files = [makeFile("a.ts", 0, 0, [makeMsg({})])];
    const counts = buildCategoryCounts(files);
    expect(counts["code-quality"]).toBe(1);
  });

  it("returns all categories even when empty", () => {
    const counts = buildCategoryCounts([]);
    expect(counts.correctness).toBe(0);
    expect(counts.maintainability).toBe(0);
    expect(counts.accessibility).toBe(0);
    expect(counts.performance).toBe(0);
    expect(counts.dx).toBe(0);
    expect(counts["code-quality"]).toBe(0);
  });
});

describe("buildScanScore", () => {
  it("returns 100 for clean files", () => {
    expect(buildScanScore([])).toBe(100);
  });

  it("deducts 1 point per error", () => {
    expect(buildScanScore([makeFile("a.ts", 10, 0)])).toBe(90);
  });

  it("deducts 1 point per 2 warnings (floor)", () => {
    expect(buildScanScore([makeFile("a.ts", 0, 4)])).toBe(98);
    expect(buildScanScore([makeFile("a.ts", 0, 5)])).toBe(98);
  });

  it("does not go below 0", () => {
    expect(buildScanScore([makeFile("a.ts", 200, 0)])).toBe(0);
    expect(buildScanScore([makeFile("a.ts", 0, 300)])).toBe(0);
  });

  it("combines errors and warnings", () => {
    const files = [makeFile("a.ts", 5, 4)];
    expect(buildScanScore(files)).toBe(93);
  });

  it("handles multiple files", () => {
    const files = [
      makeFile("a.ts", 3, 2),
      makeFile("b.ts", 1, 0),
    ];
    expect(buildScanScore(files)).toBe(95);
  });
});

describe("buildHotspots", () => {
  it("sorts by weighted score (errors*3 + warnings)", () => {
    const report: ScanReport = {
      generatedAt: "",
      summary: {} as any,
      files: [
        makeFile("a.ts", 5, 0),
        makeFile("b.ts", 1, 10),
        makeFile("c.ts", 0, 2),
      ]
    };
    const hotspots = buildHotspots(report);
    expect(hotspots[0].filePath).toBe("a.ts");
    expect(hotspots[1].filePath).toBe("b.ts");
    expect(hotspots[2].filePath).toBe("c.ts");
  });

  it("respects the limit parameter", () => {
    const report: ScanReport = {
      generatedAt: "",
      summary: {} as any,
      files: [
        makeFile("a.ts", 1, 0),
        makeFile("b.ts", 1, 0),
        makeFile("c.ts", 1, 0),
        makeFile("d.ts", 1, 0),
      ]
    };
    expect(buildHotspots(report, undefined, 2)).toHaveLength(2);
    expect(buildHotspots(report, undefined, 10)).toHaveLength(4);
  });
});

describe("inferCategory", () => {
  it("returns accessibility for aria rules", () => {
    expect(inferCategory(makeMsg({ ruleId: "aria-role" }))).toBe("accessibility");
  });

  it("returns dx for jsx-a11y rules", () => {
    expect(inferCategory(makeMsg({ ruleId: "jsx-a11y/alt-text" }))).toBe("dx");
  });

  it("returns code-quality for no-console, no-unused-vars, eqeqeq", () => {
    expect(inferCategory(makeMsg({ ruleId: "no-console" }))).toBe("code-quality");
    expect(inferCategory(makeMsg({ ruleId: "no-unused-vars" }))).toBe("code-quality");
    expect(inferCategory(makeMsg({ ruleId: "eqeqeq" }))).toBe("code-quality");
  });

  it("returns dx for jsx/react rules", () => {
    expect(inferCategory(makeMsg({ ruleId: "react/jsx-key" }))).toBe("dx");
    expect(inferCategory(makeMsg({ ruleId: "jsx-no-target-blank" }))).toBe("dx");
  });

  it("returns maintainability as default", () => {
    expect(inferCategory(makeMsg({ ruleId: "some-random-rule" }))).toBe("maintainability");
    expect(inferCategory(makeMsg({ ruleId: null }))).toBe("maintainability");
  });
});

describe("inferImpact", () => {
  it("returns high for severity 2", () => {
    expect(inferImpact(makeMsg({ severity: 2 }))).toBe("high");
  });

  it("returns medium for severity 1", () => {
    expect(inferImpact(makeMsg({ severity: 1 }))).toBe("medium");
  });
});

describe("buildHealthReport", () => {
  const baseReport: ScanReport = {
    generatedAt: "",
    summary: {
      errors: 3, warnings: 5, totalIssues: 8, filesWithIssues: 2, score: 80,
      categories: { correctness: 2, maintainability: 1, accessibility: 0, performance: 0, dx: 0, "code-quality": 0 }
    },
    files: [
      makeFile("a.ts", 2, 2, [makeMsg({ severity: 2, fixable: true }), makeMsg({ severity: 2, fixable: false })]),
      makeFile("b.ts", 1, 3, [makeMsg({ severity: 1, fixable: false })]),
    ]
  };

  it("generates a valid health report", () => {
    const result = buildHealthReport(baseReport, []);
    expect(result.score).toBe(80);
    expect(result.summary.errors).toBe(3);
    expect(result.summary.warnings).toBe(5);
    expect(result.summary.filesWithIssues).toBe(2);
  });

  it("counts autofixable issues", () => {
    const result = buildHealthReport(baseReport, []);
    expect(result.summary.safeAutofixes).toBe(1);
  });

  it("counts high impact issues (severity 2)", () => {
    const result = buildHealthReport(baseReport, []);
    expect(result.summary.highImpactIssues).toBe(2);
  });

  it("includes image info", () => {
    const images = [{ file: "a.png", size: 50000 }, { file: "b.png", size: 30000 }];
    const result = buildHealthReport(baseReport, images);
    expect(result.summary.images).toBe(2);
    expect(result.summary.imageBytes).toBe(80000);
  });

  it("builds priorities starting with errors", () => {
    const result = buildHealthReport(baseReport, []);
    expect(result.priorities[0].label).toContain("Fix errors");
    expect(result.priorities[0].impact).toBe("high");
  });

  it("includes category scores", () => {
    const result = buildHealthReport(baseReport, []);
    expect(result.categories.correctness.count).toBe(2);
  });

  it("includes hotspots", () => {
    const result = buildHealthReport(baseReport, []);
    expect(result.hotspots.length).toBeGreaterThan(0);
  });
});

describe("buildMarkdownSummary", () => {
  it("generates markdown with title", () => {
    const report: ScanReport = {
      generatedAt: "",
      summary: { errors: 1, warnings: 2, totalIssues: 3, filesWithIssues: 1, score: 85, categories: {} as any },
      files: [makeFile("src/index.ts", 1, 2)]
    };
    const result = buildMarkdownSummary(report);
    expect(result).toContain("# Scan Report");
    expect(result).toContain("Score: 85/100");
    expect(result).toContain("src/index.ts");
  });

  it("limits to 20 files", () => {
    const files = Array.from({ length: 30 }, (_, i) => makeFile(`src/file${i}.ts`, 0, 1));
    const report: ScanReport = { generatedAt: "", summary: { errors: 0, warnings: 30, totalIssues: 30, filesWithIssues: 30, score: 85, categories: {} as any }, files };
    const result = buildMarkdownSummary(report);
    const matches = result.match(/- src\/file/g);
    expect(matches?.length).toBe(20);
  });
});

describe("compareReports", () => {
  it("computes positive deltas correctly", () => {
    const prev: ScanReport = { generatedAt: "", summary: { errors: 5, warnings: 10, totalIssues: 15, filesWithIssues: 3, score: 70, categories: {} as any }, files: [] };
    const curr: ScanReport = { generatedAt: "", summary: { errors: 3, warnings: 8, totalIssues: 11, filesWithIssues: 2, score: 80, categories: {} as any }, files: [] };
    const d = compareReports(prev, curr);
    expect(d.scoreDelta).toBe(10);
    expect(d.errorDelta).toBe(-2);
    expect(d.warningDelta).toBe(-2);
    expect(d.fileDelta).toBe(-1);
  });

  it("returns zero deltas for identical reports", () => {
    const r: ScanReport = { generatedAt: "", summary: { errors: 0, warnings: 0, totalIssues: 0, filesWithIssues: 0, score: 100, categories: {} as any }, files: [] };
    const d = compareReports(r, r);
    expect(d.scoreDelta).toBe(0);
    expect(d.errorDelta).toBe(0);
    expect(d.warningDelta).toBe(0);
    expect(d.fileDelta).toBe(0);
  });
});
