import { describe, it, expect } from "vitest";
import { explainMessage } from "../src/explanations";
import type { LintMessage } from "../src/types";

describe("explainMessage", () => {
  it("uses ruleId as title when present", () => {
    const msg: LintMessage = { ruleId: "no-console", message: "Unexpected console", line: 1, column: 1, severity: 1 };
    const result = explainMessage(msg);
    expect(result.title).toBe("Rule: no-console");
  });

  it("uses message as title when ruleId is null", () => {
    const msg: LintMessage = { ruleId: null, message: "Unexpected console", line: 1, column: 1, severity: 1 };
    const result = explainMessage(msg);
    expect(result.title).toBe("Unexpected console");
  });

  it("sets why from category when present", () => {
    const msg: LintMessage = { ruleId: "no-console", message: "msg", line: 1, column: 1, severity: 1, category: "code-quality" };
    const result = explainMessage(msg);
    expect(result.why).toBe("This is related to code-quality.");
  });

  it("sets generic why when no category", () => {
    const msg: LintMessage = { ruleId: "no-console", message: "msg", line: 1, column: 1, severity: 1 };
    const result = explainMessage(msg);
    expect(result.why).toContain("linter or heuristic");
  });

  it("indicates auto-fixable when fixable is true", () => {
    const msg: LintMessage = { ruleId: "no-console", message: "msg", line: 1, column: 1, severity: 1, fixable: true };
    const result = explainMessage(msg);
    expect(result.fix).toContain("auto-fixed");
    expect(result.autofix).toBe(true);
  });

  it("indicates manual review when not fixable", () => {
    const msg: LintMessage = { ruleId: "no-console", message: "msg", line: 1, column: 1, severity: 1, fixable: false };
    const result = explainMessage(msg);
    expect(result.fix).toContain("Manual review");
    expect(result.autofix).toBe(false);
  });

  it("defaults risk to medium when no impact", () => {
    const msg: LintMessage = { ruleId: "no-console", message: "msg", line: 1, column: 1, severity: 1 };
    const result = explainMessage(msg);
    expect(result.risk).toBe("medium");
  });

  it("uses impact when present", () => {
    const msg: LintMessage = { ruleId: "no-console", message: "msg", line: 1, column: 1, severity: 2, impact: "high" };
    const result = explainMessage(msg);
    expect(result.risk).toBe("high");
  });
});


