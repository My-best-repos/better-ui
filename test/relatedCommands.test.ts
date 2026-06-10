import { describe, it, expect } from "vitest";
import { formatRelatedCommands } from "../src/relatedCommands";

describe("formatRelatedCommands", () => {
  it("returns an array of strings", () => {
    const result = formatRelatedCommands("scan");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns exactly 4 entries for known keys", () => {
    const keys = ["scan", "health", "deps", "images", "commands", "stack-audit"];
    for (const key of keys) {
      expect(formatRelatedCommands(key)).toHaveLength(4);
    }
  });

  it("returns default commands for unknown keys", () => {
    const result = formatRelatedCommands("nonexistent-key");
    expect(result).toHaveLength(3);
    expect(result[0]).toContain("/scan");
    expect(result[1]).toContain("/commands");
    expect(result[2]).toContain("/advanced");
  });

  it("returns default commands for removed doctor key", () => {
    expect(formatRelatedCommands("doctor")).toHaveLength(3);
  });

  it("returns default commands for removed init key", () => {
    expect(formatRelatedCommands("init")).toHaveLength(3);
  });

  it("returns default commands for removed explain key", () => {
    expect(formatRelatedCommands("explain")).toHaveLength(3);
  });

  it("returns 3 entries for hotspots (explain removed)", () => {
    expect(formatRelatedCommands("hotspots")).toHaveLength(3);
  });

  it("returns 3 entries for check-accessibility (explain removed)", () => {
    expect(formatRelatedCommands("check-accessibility")).toHaveLength(3);
  });

  it("includes a category badge on each line", () => {
    const result = formatRelatedCommands("scan");
    for (const line of result) {
      expect(line).toContain("[");
      expect(line).toContain("]");
    }
  });

  it("uses intent 'Repair' for fix commands", () => {
    const result = formatRelatedCommands("fix-interactive");
    expect(result[0]).toContain("[Repair");
  });

  it("uses intent 'Optimize' for images", () => {
    const result = formatRelatedCommands("images");
    expect(result[0]).toContain("[Optimize");
  });

  it("uses intent 'Navigate' for menu/commands/advanced", () => {
    const result = formatRelatedCommands("commands");
    expect(result[0]).toContain("[Navigate");
  });

  it("uses intent 'Inspect' for scan and similar", () => {
    const result = formatRelatedCommands("scan");
    expect(result[0]).toContain("[Inspect");
  });

  it("each line contains a bold command name", () => {
    const result = formatRelatedCommands("scan");
    expect(result[0]).toContain("/health");
  });
});
