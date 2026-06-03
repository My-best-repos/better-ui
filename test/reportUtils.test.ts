import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { buildScanReport } from "../src/reporters/reportUtils";
import type { FileReport } from "../src/types";

function makeFile(filePath: string, errors: number, warnings: number): FileReport {
  const messages: FileReport["messages"] = [];
  for (let i = 0; i < errors; i++) messages.push({ ruleId: "error-rule", message: "error", line: i + 1, column: 1, severity: 2 });
  for (let i = 0; i < warnings; i++) messages.push({ ruleId: "warn-rule", message: "warn", line: i + 1, column: 1, severity: 1 });
  return { filePath, errorCount: errors, warningCount: warnings, messages };
}

describe("buildScanReport", () => {
  it("builds a complete ScanReport from files", () => {
    const files = [makeFile("src/a.ts", 2, 3), makeFile("src/b.ts", 1, 0)];
    const report = buildScanReport(files);
    expect(report.summary.errors).toBe(3);
    expect(report.summary.warnings).toBe(3);
    expect(report.summary.totalIssues).toBe(6);
    expect(report.summary.filesWithIssues).toBe(2);
    expect(typeof report.summary.score).toBe("number");
    expect(report.files).toBe(files);
    expect(report.generatedAt).toBeTruthy();
  });

  it("handles empty files array", () => {
    const report = buildScanReport([]);
    expect(report.summary.errors).toBe(0);
    expect(report.summary.warnings).toBe(0);
    expect(report.summary.totalIssues).toBe(0);
    expect(report.summary.filesWithIssues).toBe(0);
  });

  it("includes scope from options", () => {
    const report = buildScanReport([], { scope: "changed" });
    expect(report.scope).toBe("changed");
  });

  it("includes metadata from options", () => {
    const report = buildScanReport([], { metadata: { projectName: "Test" } });
    expect(report.metadata?.projectName).toBe("Test");
  });

  it("computes categories from messages", () => {
    const files = [
      {
        filePath: "a.ts",
        errorCount: 0,
        warningCount: 0,
        messages: [
          { ruleId: "no-console", message: "x", line: 1, column: 1, severity: 1, category: "code-quality" as const },
          { ruleId: "jsx-a11y/alt-text", message: "x", line: 2, column: 1, severity: 1, category: "accessibility" as const },
        ]
      }
    ];
    const report = buildScanReport(files);
    expect(report.summary.categories["code-quality"]).toBe(1);
    expect(report.summary.categories.accessibility).toBe(1);
  });
});
