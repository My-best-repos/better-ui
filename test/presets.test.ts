import { describe, it, expect } from "vitest";
import { PRESETS, getPresetById } from "../src/presets";

describe("PRESETS", () => {
  it("has exactly 5 presets", () => {
    expect(PRESETS).toHaveLength(5);
  });

  it("each preset has required fields", () => {
    for (const preset of PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.label).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.reportFile).toBeTruthy();
      expect(Array.isArray(preset.extensions)).toBe(true);
      expect(preset.extensions.length).toBeGreaterThan(0);
      expect(preset.scanCommand).toBeTruthy();
      expect(preset.fixCommand).toBeTruthy();
    }
  });

  it("each preset has a unique id", () => {
    const ids = PRESETS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each preset has a unique label", () => {
    const labels = PRESETS.map(p => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("all presets have non-empty extensions arrays", () => {
    for (const preset of PRESETS) {
      expect(preset.extensions.length).toBeGreaterThan(0);
      for (const ext of preset.extensions) {
        expect(ext.startsWith(".")).toBe(true);
      }
    }
  });

  it("includes expected presets by id", () => {
    const ids = PRESETS.map(p => p.id);
    expect(ids).toContain("react");
    expect(ids).toContain("next");
    expect(ids).toContain("vite");
    expect(ids).toContain("landing-page");
    expect(ids).toContain("typescript-library");
  });
});

describe("getPresetById", () => {
  it("returns the matching preset", () => {
    const preset = getPresetById("react");
    expect(preset).toBeDefined();
    expect(preset!.id).toBe("react");
    expect(preset!.label).toBe("React");
    expect(preset!.extensions).toEqual([".js", ".jsx", ".ts", ".tsx"]);
  });

  it("returns undefined for unknown id", () => {
    expect(getPresetById("nonexistent")).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(getPresetById(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(getPresetById("")).toBeUndefined();
  });

  it("find each preset by id", () => {
    for (const preset of PRESETS) {
      expect(getPresetById(preset.id)).toBe(preset);
    }
  });
});
