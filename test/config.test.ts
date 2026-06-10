import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { getConfigPath, loadConfig, getProjectLabel, getReportFile, getExtensions, detectFramework } from "../src/config";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "better-ui-config-test-"));
  fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "test-project", version: "1.0.0" }), "utf8");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeConfig(data: Record<string, unknown>) {
  fs.writeFileSync(path.join(tmpDir, "better-ui.config.json"), JSON.stringify(data, null, 2), "utf8");
}

describe("getConfigPath", () => {
  it("returns path inside project root", () => {
    const result = getConfigPath(tmpDir);
    expect(result).toBe(path.join(tmpDir, "better-ui.config.json"));
  });
});

describe("loadConfig", () => {
  it("returns empty object when no config file exists", () => {
    const config = loadConfig(tmpDir);
    expect(config).toEqual({});
  });

  it("parses existing config file", () => {
    writeConfig({ projectName: "MyApp", preset: "react" });
    const config = loadConfig(tmpDir);
    expect(config.projectName).toBe("MyApp");
    expect(config.preset).toBe("react");
  });

  it("returns empty object when config file has invalid JSON", () => {
    fs.writeFileSync(path.join(tmpDir, "better-ui.config.json"), "{ invalid", "utf8");
    const config = loadConfig(tmpDir);
    expect(config).toEqual({});
  });

  it("reads all optional fields", () => {
    writeConfig({
      projectName: "Test",
      preset: "next",
      defaults: { reportFile: "custom-report.json", extensions: [".ts", ".tsx"] },
      scripts: { scan: "npx better-ui /scan", fix: "npx better-ui /fix" }
    });
    const config = loadConfig(tmpDir);
    expect(config.defaults?.reportFile).toBe("custom-report.json");
    expect(config.defaults?.extensions).toEqual([".ts", ".tsx"]);
    expect(config.scripts?.scan).toBe("npx better-ui /scan");
  });
});

describe("getProjectLabel", () => {
  it("uses config.projectName when available", () => {
    expect(getProjectLabel(tmpDir, { projectName: "MyApp" })).toBe("MyApp");
  });

  it("falls back to directory basename", () => {
    const config = {};
    const label = getProjectLabel(tmpDir, config);
    expect(label).toBe(path.basename(tmpDir));
  });

  it("trims whitespace from projectName", () => {
    expect(getProjectLabel(tmpDir, { projectName: "  MyApp  " })).toBe("MyApp");
  });
});

describe("getReportFile", () => {
  it("uses explicit out path when provided", () => {
    const result = getReportFile(tmpDir, {}, "custom.json");
    expect(path.basename(result)).toBe("custom.json");
  });

  it("defaults to report.txt when no format specified", () => {
    const result = getReportFile(tmpDir, {});
    expect(path.basename(result)).toBe("report.txt");
  });

  it("defaults to report.md for markdown format", () => {
    const result = getReportFile(tmpDir, {}, undefined, "markdown");
    expect(path.basename(result)).toBe("report.md");
  });

  it("uses configured default reportFile", () => {
    const result = getReportFile(tmpDir, { defaults: { reportFile: "my-report.json" } });
    expect(path.basename(result)).toBe("my-report.json");
  });

  it("swaps .json extension to .md when format is markdown", () => {
    const result = getReportFile(tmpDir, { defaults: { reportFile: "my-report.json" } }, undefined, "markdown");
    expect(path.basename(result)).toBe("my-report.md");
  });

  it("resolves path inside project root", () => {
    const result = getReportFile(tmpDir, {}, "reports/out.json");
    expect(path.dirname(result)).toBe(path.join(tmpDir, "reports"));
  });
});

describe("getExtensions", () => {
  it("returns explicit extensions when provided", () => {
    expect(getExtensions({}, [".ts"])).toEqual([".ts"]);
  });

  it("returns configured defaults when no explicit", () => {
    expect(getExtensions({ defaults: { extensions: [".js", ".ts"] } })).toEqual([".js", ".ts"]);
  });

  it("returns undefined when nothing is set", () => {
    expect(getExtensions({})).toBeUndefined();
  });
});

describe("detectFramework", () => {
  it("returns vanilla when no package.json", () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "better-ui-empty-"));
    try {
      const result = detectFramework(emptyDir);
      expect(result).toEqual(["vanilla"]);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it("detects React from dependencies", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ dependencies: { react: "^18.0.0" } }), "utf8");
    const result = detectFramework(tmpDir);
    expect(result).toContain("React");
  });

  it("detects Next.js (and not React separately)", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ dependencies: { next: "^13.0.0", react: "^18.0.0" } }), "utf8");
    const result = detectFramework(tmpDir);
    expect(result).toContain("Next.js");
    expect(result).not.toContain("React");
  });

  it("detects Vue", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ dependencies: { vue: "^3.0.0" } }), "utf8");
    expect(detectFramework(tmpDir)).toContain("Vue");
  });

  it("detects Svelte", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ dependencies: { svelte: "^3.0.0" } }), "utf8");
    expect(detectFramework(tmpDir)).toContain("Svelte");
  });

  it("detects Vite", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ devDependencies: { vite: "^4.0.0" } }), "utf8");
    expect(detectFramework(tmpDir)).toContain("Vite");
  });

  it("detects Tailwind", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ devDependencies: { tailwindcss: "^3.0.0" } }), "utf8");
    expect(detectFramework(tmpDir)).toContain("Tailwind");
  });

  it("detects TypeScript", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ devDependencies: { typescript: "^5.0.0" } }), "utf8");
    expect(detectFramework(tmpDir)).toContain("TypeScript");
  });

  it("detects multiple frameworks simultaneously", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
      dependencies: { react: "^18.0.0", vue: "^3.0.0" },
      devDependencies: { vite: "^4.0.0", typescript: "^5.0.0", tailwindcss: "^3.0.0" }
    }), "utf8");
    const result = detectFramework(tmpDir);
    expect(result).toContain("React");
    expect(result).toContain("Vue");
    expect(result).toContain("Vite");
    expect(result).toContain("Tailwind");
    expect(result).toContain("TypeScript");
  });
});
