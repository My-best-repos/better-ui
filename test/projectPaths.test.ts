import { describe, it, expect } from "vitest";
import path from "path";
import { resolveProjectPath, toProjectRelativePath } from "../src/projectPaths";

const ROOT = path.resolve("/test/project");

describe("resolveProjectPath", () => {
  it("resolves a path inside the project root", () => {
    const result = resolveProjectPath(ROOT, "src/index.ts", "Test file");
    expect(result).toBe(path.join(ROOT, "src/index.ts"));
  });

  it("resolves nested paths correctly", () => {
    const result = resolveProjectPath(ROOT, "src/deep/nested/file.ts", "Nested");
    expect(result).toBe(path.join(ROOT, "src/deep/nested/file.ts"));
  });

  it("throws when path escapes the project root via ..", () => {
    expect(() => resolveProjectPath(ROOT, "../outside.txt", "Escaped path"))
      .toThrow("Escaped path must stay inside the project root");
  });

  it("throws on deeply nested escape", () => {
    expect(() => resolveProjectPath(ROOT, "src/../../outside.txt", "Deep escape"))
      .toThrow("Deep escape must stay inside the project root");
  });

  it("resolves absolute paths that are inside the project root", () => {
    const inside = path.join(ROOT, "lib/utils.ts");
    const result = resolveProjectPath(ROOT, inside, "Absolute inside");
    expect(result).toBe(inside);
  });

  it("throws on absolute paths outside the project root", () => {
    const outside = path.resolve("/other/project/file.ts");
    expect(() => resolveProjectPath(ROOT, outside, "Absolute outside"))
      .toThrow("Absolute outside must stay inside the project root");
  });

  it("resolves the project root itself", () => {
    const result = resolveProjectPath(ROOT, ROOT, "Root itself");
    expect(result).toBe(ROOT);
  });

  it("resolves dot to project root", () => {
    const result = resolveProjectPath(ROOT, ".", "Dot path");
    expect(result).toBe(ROOT);
  });

  it("handles Windows-style paths on all platforms", () => {
    const normalised = path.resolve("/test/project");
    const result = resolveProjectPath(normalised, "dist/output.json", "Output");
    expect(result).toBe(path.join(normalised, "dist/output.json"));
  });
});

describe("toProjectRelativePath", () => {
  it("returns relative path for file inside project", () => {
    const target = path.join(ROOT, "src/main.ts");
    const result = toProjectRelativePath(ROOT, target);
    expect(result).toBe(path.normalize("src/main.ts"));
  });

  it("returns path for file at root level", () => {
    const target = path.join(ROOT, "package.json");
    const result = toProjectRelativePath(ROOT, target);
    expect(result).toBe("package.json");
  });

  it("returns '..' prefixed for paths outside project", () => {
    const target = path.resolve("/other/file.ts");
    const result = toProjectRelativePath(ROOT, target);
    expect(result.startsWith("..")).toBe(true);
  });

  it("handles deeply nested paths", () => {
    const target = path.join(ROOT, "a", "b", "c", "d.ts");
    const result = toProjectRelativePath(ROOT, target);
    expect(result).toBe(path.normalize("a/b/c/d.ts"));
  });
});
