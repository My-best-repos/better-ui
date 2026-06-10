import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { writeJsonReport } from "../src/reporters/jsonReporter";
import type { ScanReport, FileReport, LintMessage } from "../src/types";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "better-ui-reporter-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const sampleReport: ScanReport = {
  generatedAt: "2026-06-01T10:00:00.000Z",
  summary: {
    errors: 2, warnings: 3, totalIssues: 5, filesWithIssues: 1, score: 80,
    categories: { correctness: 0, maintainability: 2, accessibility: 0, performance: 0, dx: 0, "code-quality": 3 }
  },
  files: [
    {
      filePath: "src/test.ts",
      errorCount: 2,
      warningCount: 3,
      messages: [
        { ruleId: "no-console", message: "Unexpected console", line: 1, column: 1, severity: 1, category: "code-quality" } as LintMessage,
        { ruleId: "no-unused-vars", message: "Unused var", line: 5, column: 3, severity: 2, category: "code-quality" } as LintMessage,
      ]
    }
  ]
};

describe("writeJsonReport", () => {
  it("writes a valid JSON file", () => {
    const outPath = path.join(tmpDir, "report.json");
    writeJsonReport(tmpDir, outPath, sampleReport);
    expect(fs.existsSync(outPath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(outPath, "utf8"));
    expect(parsed.summary.errors).toBe(2);
    expect(parsed.files).toHaveLength(1);
  });

  it("creates parent directories", () => {
    const outPath = path.join(tmpDir, "nested", "dir", "report.json");
    writeJsonReport(tmpDir, outPath, sampleReport);
    expect(fs.existsSync(outPath)).toBe(true);
  });

  it("accepts FileReport[] and builds a ScanReport", () => {
    const files: FileReport[] = [
      { filePath: "a.ts", errorCount: 1, warningCount: 0, messages: [{ ruleId: "no-console", message: "msg", line: 1, column: 1, severity: 1 }] }
    ];
    const outPath = path.join(tmpDir, "report.json");
    writeJsonReport(tmpDir, outPath, files);
    const parsed = JSON.parse(fs.readFileSync(outPath, "utf8"));
    expect(parsed.summary.totalIssues).toBe(1);
    expect(parsed.files).toHaveLength(1);
  });

  it("writes formatted JSON with indentation", () => {
    const outPath = path.join(tmpDir, "report.json");
    writeJsonReport(tmpDir, outPath, sampleReport);
    const content = fs.readFileSync(outPath, "utf8");
    expect(content).toContain("\n  ");
  });

  it("throws when path escapes project root", () => {
    expect(() => writeJsonReport(tmpDir, path.resolve("/outside/report.json"), sampleReport))
      .toThrow();
  });
});


