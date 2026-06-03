import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { scanDependencies } from "../../src/scanners/dependencyScanner";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "better-ui-dep-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writePackage(deps: Record<string, string> = {}, devDeps: Record<string, string> = {}) {
  fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
    name: "test-project",
    version: "1.0.0",
    dependencies: deps,
    devDependencies: devDeps
  }, null, 2), "utf8");
}

function writeSource(filePath: string, content: string) {
  const fullPath = path.join(tmpDir, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

const HEAVY_DEPS = ["lodash", "moment", "moment-timezone", "rxjs", "three", "echarts", "d3"];

describe("scanDependencies", () => {
  it("reports unused dependencies", async () => {
    writePackage({ moment: "^2.29.4", lodash: "^4.17.21" });
    writeSource("src/index.ts", "export const a = 1;\n");
    const result = await scanDependencies(tmpDir);
    expect(result.unusedDependencies).toContain("moment");
    expect(result.unusedDependencies).toContain("lodash");
  });

  it("does not report used dependencies", async () => {
    writePackage({ moment: "^2.29.4" });
    writeSource("src/index.ts", "import moment from 'moment';\n");
    const result = await scanDependencies(tmpDir);
    expect(result.unusedDependencies).not.toContain("moment");
  });

  it("ignores @types/, typescript, react-scripts, and eslint packages", async () => {
    writePackage({}, {
      typescript: "^5.0.0",
      "@types/react": "^18.0.0",
      "react-scripts": "^5.0.0",
      eslint: "^8.0.0",
      "eslint-plugin-react": "^7.0.0"
    });
    writeSource("src/index.ts", "export const a = 1;\n");
    const result = await scanDependencies(tmpDir);
    expect(result.unusedDependencies).toHaveLength(0);
  });

  it("detects require usage", async () => {
    writePackage({ lodash: "^4.17.21" });
    writeSource("src/index.ts", "const _ = require('lodash');\n");
    const result = await scanDependencies(tmpDir);
    expect(result.unusedDependencies).not.toContain("lodash");
  });

  it("reports heavy dependencies by name when node_modules exist", async () => {
    writePackage(Object.fromEntries(HEAVY_DEPS.map(d => [d, "^1.0.0"])));
    for (const dep of HEAVY_DEPS) {
      const depDir = path.join(tmpDir, "node_modules", dep);
      fs.mkdirSync(depDir, { recursive: true });
      fs.writeFileSync(path.join(depDir, "index.js"), "module.exports = {};\n");
    }
    writeSource("src/index.ts", "export const a = 1;\n");
    const result = await scanDependencies(tmpDir);
    for (const dep of HEAVY_DEPS) {
      const heavy = result.heavyDependencies.find(h => h.name === dep);
      expect(heavy).toBeDefined();
    }
  });

  it("does not crash on missing src/ directory", async () => {
    writePackage({ moment: "^2.29.4" });
    const result = await scanDependencies(tmpDir);
    expect(result.unusedDependencies).toContain("moment");
  });

  it("throws on invalid package.json", async () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), "invalid json", "utf8");
    await expect(scanDependencies(tmpDir)).rejects.toThrow();
  });
});
