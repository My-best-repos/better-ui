import { describe, it, expect } from "vitest";
import { explainMessage, buildExplainSummary } from "../src/explanations";
import type { LintMessage, ScanReport } from "../src/types";

describe("explainMessage", () => {
  it("uses ruleId as title when present", () => {
    const msg: LintMessage = { ruleId: "no-console", message: "Unexpected console", line: 1, column: 1, severity: 1 };
    const result = explainMessage(msg);
    expect(result.title).toBe("Rule: no-console");
  });

  it("uses message as title when ruleId is null", () => {
    const msg: LintMessage = { ruleId: null, message: "Unexpected console", line: 1, column: 1, severity: 1 };
    const result = explainMessage(msg);
    expect(result.title).toBe("Unexpected console");
  });

  it("sets why from category when present", () => {
    const msg: LintMessage = { ruleId: "no-console", message: "msg", line: 1, column: 1, severity: 1, category: "code-quality" };
    const result = explainMessage(msg);
    expect(result.why).toBe("This is related to code-quality.");
  });

  it("sets generic why when no category", () => {
    const msg: LintMessage = { ruleId: "no-console", message: "msg", line: 1, column: 1, severity: 1 };
    const result = explainMessage(msg);
    expect(result.why).toContain("linter or heuristic");
  });

  it("indicates auto-fixable when fixable is true", () => {
    const msg: LintMessage = { ruleId: "no-console", message: "msg", line: 1, column: 1, severity: 1, fixable: true };
    const result = explainMessage(msg);
    expect(result.fix).toContain("auto-fixed");
    expect(result.autofix).toBe(true);
  });

  it("indicates manual review when not fixable", () => {
    const msg: LintMessage = { ruleId: "no-console", message: "msg", line: 1, column: 1, severity: 1, fixable: false };
    const result = explainMessage(msg);
    expect(result.fix).toContain("Manual review");
    expect(result.autofix).toBe(false);
  });

  it("defaults risk to medium when no impact", () => {
    const msg: LintMessage = { ruleId: "no-console", message: "msg", line: 1, column: 1, severity: 1 };
    const result = explainMessage(msg);
    expect(result.risk).toBe("medium");
  });

  it("uses impact when present", () => {
    const msg: LintMessage = { ruleId: "no-console", message: "msg", line: 1, column: 1, severity: 2, impact: "high" };
    const result = explainMessage(msg);
    expect(result.risk).toBe("high");
  });
});

describe("buildExplainSummary", () => {
  const baseReport: ScanReport = {
    generatedAt: "2026-01-01",
    summary: { errors: 2, warnings: 3, totalIssues: 5, filesWithIssues: 2, score: 80, categories: {} as any },
    files: [
      { filePath: "src/a.ts", errorCount: 1, warningCount: 1, messages: [{ ruleId: "no-console", message: "Unexpected console", line: 1, column: 1, severity: 1 }] },
      { filePath: "src/b.ts", errorCount: 0, warningCount: 1, messages: [{ ruleId: "no-unused-vars", message: "Unused var", line: 5, column: 3, severity: 1 }] }
    ]
  };

  it("includes total issues and files in header", () => {
    const result = buildExplainSummary(baseReport);
    expect(result).toContain("5 issue(s) across 2 file(s)");
  });

  it("includes top findings", () => {
    const result = buildExplainSummary(baseReport);
    expect(result).toContain("src/a.ts");
    expect(result).toContain("src/b.ts");
  });

  it("appends target path when provided", () => {
    const result = buildExplainSummary(baseReport, "src/a.ts");
    expect(result).toContain("Target: src/a.ts");
  });

  it("handles empty report", () => {
    const empty: ScanReport = { generatedAt: "", summary: { errors: 0, warnings: 0, totalIssues: 0, filesWithIssues: 0, score: 100, categories: {} as any }, files: [] };
    const result = buildExplainSummary(empty);
    expect(result).toContain("0 issue(s) across 0 file(s)");
  });
});
