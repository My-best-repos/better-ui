import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { expect, test } from "vitest";

const repoRoot = process.cwd();
const tsNodeBin = path.join(repoRoot, "node_modules", "ts-node", "dist", "bin.js");
const cliEntry = path.join(repoRoot, "src", "cli.ts");

function runCli(args: string[], cwd = repoRoot, timeout = 120_000) {
  return spawnSync(process.execPath, [tsNodeBin, cliEntry, ...args], {
    cwd,
    encoding: "utf8",
    timeout
  });
}

function createTempProject() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "better-ui-cli-smoke-"));
  fs.mkdirSync(path.join(tempRoot, "src"), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, "package.json"), JSON.stringify({
    name: "better-ui-smoke-project",
    version: "1.0.0",
    private: true
  }, null, 2));
  return tempRoot;
}

test("advanced command renders the advanced cheat sheet", () => {
  const result = runCli(["/advanced"]);
  if (result.error) throw result.error;

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Supercharged Scan");
  expect(result.stdout).toContain("/fix --interactive");
});

test("deps command reports an unused dependency from package.json", () => {
  const tempRoot = createTempProject();
  fs.writeFileSync(path.join(tempRoot, "package.json"), JSON.stringify({
    name: "better-ui-smoke-project",
    version: "1.0.0",
    private: true,
    dependencies: {
      moment: "^2.29.4"
    }
  }, null, 2));
  fs.writeFileSync(path.join(tempRoot, "src", "index.ts"), "export const value = 1;\n");

  const result = runCli(["/deps"], tempRoot);
  if (result.error) throw result.error;

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Unused Dependencies");
  expect(result.stdout).toContain("moment");
});

test("scan command writes a JSON report for a temporary project", () => {
  const tempRoot = createTempProject();
  fs.writeFileSync(path.join(tempRoot, "src", "index.ts"), "console.log('hello');\n");

  const result = runCli(["/scan", "--format", "json", "--out", "tmp-report.json", "--top", "3"], tempRoot);
  if (result.error) throw result.error;

  expect(result.status).toBe(0);
  const reportPath = path.join(tempRoot, "tmp-report.json");
  expect(fs.existsSync(reportPath)).toBeTruthy();

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as { summary?: { totalIssues?: number } };
  expect(typeof report.summary?.totalIssues).toBe("number");
});

test("images command can generate a webp variant", () => {
  const tempRoot = createTempProject();
  const imagePath = path.join(tempRoot, "src", "pixel.png");
  const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nK9sAAAAASUVORK5CYII=";
  fs.writeFileSync(imagePath, Buffer.from(tinyPng, "base64"));

  const result = runCli(["/images", "--generate", "--quality", "80"], tempRoot, 180_000);
  if (result.error) throw result.error;

  expect(result.status).toBe(0);
  expect(fs.existsSync(`${imagePath}.webp`)).toBeTruthy();
});
