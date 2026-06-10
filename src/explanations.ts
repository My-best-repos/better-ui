import { LintMessage, IssueExplanation } from "./types";

const RULE_KNOWLEDGE: Record<string, { why: string; fix: string }> = {
  "better-ui/clickable-div": {
    why: "A <div> with onClick lacks keyboard accessibility and ARIA semantics. Screen readers don't recognize it as interactive, and it can't be focused or activated with the keyboard natively. Users with motor disabilities or keyboard-only navigation are left out.",
    fix: "Replace with <button> for click actions or <a> for navigation. If the HTML structure prevents changing the element, add role=\"button\", tabindex=\"0\", and handle onKeyDown for Enter/Space."
  },
  "better-ui/input-label": {
    why: "Inputs without an associated <label> are invisible to screen readers. Users relying on assistive technology won't know what data each field expects, which is a WCAG 4.1.2 failure.",
    fix: "Add a <label htmlFor=\"...\"> pointing to the input's id, or wrap the input inside the label. For icon-only inputs use aria-label directly on the element."
  },
  "better-ui/heading-order": {
    why: "Skipping heading levels (e.g., h1 → h3) creates a confusing navigation structure for screen reader users who rely on headings to navigate. This violates WCAG 2.4.10.",
    fix: "Ensure headings follow a logical hierarchy (h1 → h2 → h3). If a heading's appearance is the only concern, use CSS instead of skipping levels, or hide decorative headings with aria-hidden."
  }
};

export function explainMessage(message: LintMessage): IssueExplanation {
  const title = message.ruleId ? `Rule: ${message.ruleId}` : message.message;

  const known = message.ruleId ? RULE_KNOWLEDGE[message.ruleId] : undefined;
  if (known) {
    return { title, why: known.why, fix: known.fix, risk: "high", autofix: false };
  }

  const why = message.category
    ? `This is related to ${message.category}.`
    : "This issue was detected by a linter or heuristic.";
  const fix = message.fixable
    ? "This can often be auto-fixed with the --apply option or ESLint.fix."
    : "Manual review required to fix this issue.";
  return { title, why, fix, risk: message.impact || "medium", autofix: Boolean(message.fixable) };
}


