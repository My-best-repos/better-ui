import fs from "fs";
import path from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runScanWorkflow } from "../../src/cli/workflows";

const ROOT = path.resolve(__dirname, "../../");

describe("Report format smoke", () => {
  const outJson = "tmp/test-report.json";
  const outMd = "tmp/test-report.txt";

  beforeAll(() => {
    if (!fs.existsSync(path.join(ROOT, "tmp"))) fs.mkdirSync(path.join(ROOT, "tmp"), { recursive: true });
  });

  afterAll(() => {
    try { fs.rmSync(path.join(ROOT, "tmp"), { recursive: true, force: true }); } catch {}
  });

  it("generates json report when format=json", async () => {
    const r = await runScanWorkflow(ROOT, { out: outJson, format: "json" });
    expect(r.reportPath).toBeDefined();
    const rp = r.reportPath!;
    const reportFull = path.isAbsolute(rp) ? rp : path.join(ROOT, rp);
    expect(fs.existsSync(reportFull)).toBe(true);
    const content = fs.readFileSync(reportFull, "utf8");
    expect(() => JSON.parse(content)).not.toThrow();
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("files");
  });

  it("converts .txt out path to .md when writing markdown", async () => {
    const r = await runScanWorkflow(ROOT, { out: outMd, format: "markdown" });
    expect(r.reportPath).toBeDefined();
    const rp = r.reportPath!;
    const reportFull = path.isAbsolute(rp) ? rp : path.join(ROOT, rp);
    expect(reportFull.endsWith(".md")).toBe(true);
    expect(fs.existsSync(reportFull)).toBe(true);
    const content = fs.readFileSync(reportFull, "utf8");
    expect(content.includes("#")).toBe(true);
  });
});
