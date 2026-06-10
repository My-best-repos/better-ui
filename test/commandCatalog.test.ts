import { describe, it, expect } from "vitest";
import { COMMANDS } from "../src/commandCatalog";

describe("COMMANDS", () => {
  it("catalog has at least 20 entries", () => {
    expect(COMMANDS.length).toBeGreaterThanOrEqual(20);
  });

  it("every entry has required fields", () => {
    for (const cmd of COMMANDS) {
      expect(cmd.name).toBeTruthy();
      expect(cmd.slash).toBeTruthy();
      expect(cmd.description).toBeTruthy();
      expect(cmd.example).toBeTruthy();
    }
  });

  it("all slashes start with /", () => {
    for (const cmd of COMMANDS) {
      expect(cmd.slash.startsWith("/")).toBe(true);
    }
  });

  it("each slash is unique", () => {
    const slashes = COMMANDS.map(c => c.slash);
    expect(new Set(slashes).size).toBe(slashes.length);
  });

  it("covers all core commands", () => {
    const slashes = COMMANDS.map(c => c.slash);
    const required = ["/scan", "/fix", "/health", "/deps", "/doctor", "/hotspots", "/advanced", "/explain", "/images", "/init", "/menu", "/commands", "/exit", "/ui-typography", "/ui-spacing"];
    for (const r of required) {
      expect(slashes).toContain(r);
    }
  });

  it("covers alias commands", () => {
    const slashes = COMMANDS.map(c => c.slash);
    const aliases = ["/changed", "/staged", "/fix-apply", "/fix-interactive", "/a11y"];
    for (const a of aliases) {
      expect(slashes).toContain(a);
    }
  });

  it("fix aliases point to the correct intention", () => {
    const fixApply = COMMANDS.find(c => c.slash === "/fix-apply");
    const fixInteractive = COMMANDS.find(c => c.slash === "/fix-interactive");
    expect(fixApply).toBeDefined();
    expect(fixInteractive).toBeDefined();
    expect(fixApply!.description.toLowerCase()).toContain("apply");
    expect(fixInteractive!.description.toLowerCase()).toContain("hunk");
  });

  it("scan-related aliases exist", () => {
    const changed = COMMANDS.find(c => c.slash === "/changed");
    const staged = COMMANDS.find(c => c.slash === "/staged");
    expect(changed).toBeDefined();
    expect(staged).toBeDefined();
    expect(changed!.description.toLowerCase()).toContain("changed");
    expect(staged!.description.toLowerCase()).toContain("staged");
  });
});
