import { describe, it, expect, vi } from "vitest";
import { normalizeSlashArgv, parseSlashCommand, SLASH_ALIASES } from "../src/slashCommands";

const BASE = ["node", "cli"];

describe("SLASH_ALIASES", () => {
  it("defines some aliases", () => {
    expect(Object.keys(SLASH_ALIASES).length).toBeGreaterThan(0);
  });

  it("each alias maps to a non-empty array", () => {
    for (const [key, value] of Object.entries(SLASH_ALIASES)) {
      expect(key.startsWith("/")).toBe(true);
      expect(Array.isArray(value)).toBe(true);
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe("normalizeSlashArgv", () => {
  it("returns argv unchanged when no subcommand given", () => {
    expect(normalizeSlashArgv(["node", "cli"])).toEqual(["node", "cli"]);
  });

  it("maps known aliases", () => {
    expect(normalizeSlashArgv([...BASE, "/menu"])).toEqual([...BASE, "tui"]);
    expect(normalizeSlashArgv([...BASE, "/help"])).toEqual([...BASE, "commands"]);
    expect(normalizeSlashArgv([...BASE, "/changed"])).toEqual([...BASE, "scan", "--changed"]);
    expect(normalizeSlashArgv([...BASE, "/staged"])).toEqual([...BASE, "scan", "--staged"]);
    expect(normalizeSlashArgv([...BASE, "/fix-apply"])).toEqual([...BASE, "fix", "--apply"]);
    expect(normalizeSlashArgv([...BASE, "/fix-interactive"])).toEqual([...BASE, "fix", "--interactive"]);
  });

  it("passes unknown slashes through after stripping /", () => {
    expect(normalizeSlashArgv([...BASE, "/custom-command"])).toEqual([...BASE, "custom-command"]);
  });

  it("preserves additional arguments after slash", () => {
    const result = normalizeSlashArgv([...BASE, "/scan", "--format", "json", "--out", "report.json"]);
    expect(result).toEqual([...BASE, "scan", "--format", "json", "--out", "report.json"]);
  });

  it("preserves additional args through alias expansion", () => {
    const result = normalizeSlashArgv([...BASE, "/changed", "--format", "json"]);
    expect(result).toEqual([...BASE, "scan", "--changed", "--format", "json"]);
  });

  it("exits with code 2 when arg does not start with /", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    normalizeSlashArgv([...BASE, "scan"]);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("slash command"));
    expect(exitSpy).toHaveBeenCalledWith(2);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe("parseSlashCommand", () => {
  it("parses a basic slash command", () => {
    const result = parseSlashCommand("/scan");
    expect(result).toEqual(["scan"]);
  });

  it("parses a slash command with flags", () => {
    const result = parseSlashCommand("/scan --format json --out report.json");
    expect(result).toEqual(["scan", "--format", "json", "--out", "report.json"]);
  });

  it("resolves aliases", () => {
    expect(parseSlashCommand("/menu")).toEqual(["tui"]);
    expect(parseSlashCommand("/changed --verbose")).toEqual(["scan", "--changed", "--verbose"]);
    expect(parseSlashCommand("/deps")).toEqual(["deps"]);
  });

  it("passes unknown slashes through after stripping /", () => {
    const result = parseSlashCommand("/unknown --flag value");
    expect(result![0]).toBe("unknown");
    expect(result).toContain("--flag");
    expect(result).toContain("value");
  });

  it("returns null for non-slash input", () => {
    expect(parseSlashCommand("scan")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseSlashCommand("")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(parseSlashCommand("   ")).toBeNull();
  });

  it("strips leading whitespace", () => {
    const result = parseSlashCommand("  /scan");
    expect(result).toEqual(["scan"]);
  });

  it("handles single-quoted arguments", () => {
    const result = parseSlashCommand("/scan --out 'my report.json'");
    expect(result).toEqual(["scan", "--out", "my report.json"]);
  });

  it("handles double-quoted arguments", () => {
    const result = parseSlashCommand('/fix --out "my report.json"');
    expect(result).toEqual(["fix", "--out", "my report.json"]);
  });

  it("handles mixed quotes", () => {
    const result = parseSlashCommand('/scan --ext ".ts,.tsx" --format "json"');
    expect(result).toEqual(["scan", "--ext", ".ts,.tsx", "--format", "json"]);
  });

  it("handles flags with no value as separate tokens", () => {
    const result = parseSlashCommand("/scan --verbose --open");
    expect(result).toEqual(["scan", "--verbose", "--open"]);
  });
});
