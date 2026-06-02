import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { runScanWorkflow } from "../src/cli/workflows";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "better-ui-no-save-test-"));
  fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "no-save-test", version: "1.0.0" }, null, 2), "utf8");
  fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, "src", "sample.ts"), "export const value = 1;\n");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("runScanWorkflow writeReport option", () => {
  it("writes the report file by default when format=json and no explicit out", async () => {
    const result = await runScanWorkflow(tmpDir, { format: "json", command: "test" });
    expect(result.reportPath).toBeTruthy();
    expect(fs.existsSync(result.reportPath as string)).toBe(true);
  });

  it("does not write the report file when writeReport=false", async () => {
    const result = await runScanWorkflow(tmpDir, { format: "json", writeReport: false, command: "test" });
    expect(result.reportPath).toBeFalsy();
    expect(result.report).toBeTruthy();
    expect(result.report.summary).toBeTruthy();
  });

  it("still keeps the in-memory report when writeReport=false", async () => {
    const result = await runScanWorkflow(tmpDir, { format: "json", writeReport: false, command: "test" });
    expect(result.report.files).toBeDefined();
    expect(Array.isArray(result.report.files)).toBe(true);
    expect(typeof result.report.summary.score).toBe("number");
  });

  it("does not create the .better-ui directory when history is disabled", async () => {
    await runScanWorkflow(tmpDir, { format: "json", writeReport: false, command: "test" });
    const betterUiDir = path.join(tmpDir, ".better-ui");
    expect(fs.existsSync(betterUiDir)).toBe(false);
  });

  it("respects explicit out path even when writeReport=true", async () => {
    const out = path.join("nested", "explicit.json");
    const result = await runScanWorkflow(tmpDir, { out, format: "json", command: "test" });
    expect(result.reportPath).toBeTruthy();
    expect(fs.existsSync(result.reportPath as string)).toBe(true);
  });
});
