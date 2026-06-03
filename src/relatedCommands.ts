import chalk from "chalk";

type RelatedEntry = {
  command: string;
  description: string;
};

function intentLabel(command: string) {
  if (command.includes("fix")) return "Repair";
  if (command.includes("review") || command.includes("pr-summary")) return "Ship";
  if (command.includes("images")) return "Optimize";
  if (command.includes("menu") || command.includes("commands") || command.includes("advanced")) return "Navigate";
  return "Inspect";
}

const DEFAULT_RELATED: RelatedEntry[] = [
  { command: "/scan", description: "Run a full project scan" },
  { command: "/commands", description: "Browse the full command catalog" },
  { command: "/advanced", description: "See flags and power-user flows" }
];

const RELATED_COMMANDS: Record<string, RelatedEntry[]> = {
  "scan": [
    { command: "/health", description: "Category scores and priorities" },
    { command: "/fix", description: "Preview or apply autofixes" },
    { command: "/hotspots", description: "Worst files by issue density" },
    { command: "/ui-audit", description: "Audit the UI surface" }
  ],
  "scan-changed": [
    { command: "/review --changed", description: "Review only modified files" },
    { command: "/fix --changed", description: "Preview fixes for modified files" },
    { command: "/pr-summary", description: "Draft a PR summary from changes" },
    { command: "/scan", description: "Re-scan the project" }
  ],
  "scan-staged": [
    { command: "/review --staged", description: "Review only staged files" },
    { command: "/fix --staged", description: "Preview fixes for staged files" },
    { command: "/pr-summary --staged", description: "Draft summary for staged work" },
    { command: "/scan --staged", description: "Re-scan staged files" }
  ],
  "fix-preview": [
    { command: "/fix --apply", description: "Write the safe autofixes" },
    { command: "/fix --interactive", description: "Pick hunks one by one" },
    { command: "/review --changed", description: "Review current diff before commit" },
    { command: "/scan", description: "Re-scan the project after review" }
  ],
  "fix-apply": [
    { command: "/scan", description: "Measure the new score" },
    { command: "/review --changed", description: "Review the written changes" },
    { command: "/pr-summary", description: "Summarize the updated branch" },
    { command: "/health", description: "Check updated health score" }
  ],
  "fix-interactive": [
    { command: "/fix --apply", description: "Apply all remaining safe fixes" },
    { command: "/scan", description: "Re-scan after selected hunks" },
    { command: "/review --changed", description: "Review the chosen edits" },
    { command: "/health", description: "Check updated health score" }
  ],
  "doctor": [
    { command: "/init", description: "Generate or refresh config" },
    { command: "/health", description: "See issue categories and priorities" },
    { command: "/scan", description: "Run a full scan after setup fixes" },
    { command: "/deps", description: "Inspect dependency weight and dead code" }
  ],
  "health": [
    { command: "/doctor", description: "Inspect config and script gaps" },
    { command: "/hotspots", description: "Focus the riskiest files first" },
    { command: "/fix", description: "Preview autofixes for health issues" },
    { command: "/images", description: "Inspect image payload weight" }
  ],
  "deps": [
    { command: "/doctor", description: "Check project readiness after cleanup" },
    { command: "/scan", description: "Run a full quality scan" },
    { command: "/health", description: "See dependency impact in the score" },
    { command: "/advanced", description: "Review more high-leverage flows" }
  ],
  "advanced": [
    { command: "/commands", description: "Browse every slash command" },
    { command: "/scan", description: "Run the main analysis flow" },
    { command: "/menu", description: "Open the interactive command center" },
    { command: "/images --generate", description: "Optimize large assets" }
  ],
  "hotspots": [
    { command: "/fix", description: "Preview fixes in risky files" },
    { command: "/explain", description: "Understand the highest-impact rules" },
    { command: "/health", description: "See category-level priorities" },
    { command: "/review --changed", description: "Prepare a review after cleanup" }
  ],
  "review": [
    { command: "/pr-summary", description: "Draft the PR body from findings" },
    { command: "/fix", description: "Address issues before committing" },
    { command: "/scan", description: "Run a full scan outside git scope" },
    { command: "/ui-audit", description: "Audit the UI surface" }
  ],
  "review-changed": [
    { command: "/fix --changed", description: "Preview fixes only for current diff" },
    { command: "/pr-summary", description: "Turn the diff into PR markdown" },
    { command: "/scan --changed", description: "Re-scan only changed files" },
    { command: "/ui-standards", description: "Check component standards" }
  ],
  "review-staged": [
    { command: "/fix --staged", description: "Preview fixes only for staged files" },
    { command: "/pr-summary --staged", description: "Summarize staged work" },
    { command: "/scan --staged", description: "Re-scan only staged files" },
    { command: "/ui-colors", description: "Scan color palette" }
  ],
  "pr-summary": [
    { command: "/review --changed", description: "Generate a review-style companion" },
    { command: "/scan", description: "Rebuild the report after edits" },
    { command: "/commands", description: "Browse more automation flows" },
    { command: "/ui-audit", description: "Audit the UI surface" }
  ],
  "check-accessibility": [
    { command: "/explain", description: "See why the a11y rules matter" },
    { command: "/fix", description: "Preview safe fixes in the same scope" },
    { command: "/health", description: "Check accessibility score impact" },
    { command: "/review --changed", description: "Review the current accessibility diff" }
  ],
  "explain": [
    { command: "/fix", description: "Preview fixes for explained issues" },
    { command: "/health", description: "See category impact of the rules" },
    { command: "/review --changed", description: "Review the files after edits" },
    { command: "/scan", description: "Re-scan after applying changes" }
  ],
  "images": [
    { command: "/images --generate", description: "Create WebP versions" },
    { command: "/scan --scan-images", description: "Include images in project scan" },
    { command: "/health", description: "See image payload in health score" },
    { command: "/doctor", description: "Check wider project readiness" }
  ],
  "images-generate": [
    { command: "/scan --scan-images", description: "Re-scan image payload" },
    { command: "/health", description: "See updated image weight impact" },
    { command: "/review --changed", description: "Review generated assets" },
    { command: "/ui-audit", description: "Audit the UI surface" }
  ],
  "init": [
    { command: "/scan", description: "Generate the first report" },
    { command: "/doctor", description: "Validate config and scripts" },
    { command: "/health", description: "Check the initial score" },
    { command: "/menu", description: "Open the interactive dashboard" }
  ],
  "commands": [
    { command: "/advanced", description: "See high-leverage flags and flows" },
    { command: "/scan", description: "Run the main analysis command" },
    { command: "/menu", description: "Use the interactive command center" },
    { command: "/review --changed", description: "Open a review-oriented branch flow" }
  ],
  "ui-audit": [
    { command: "/ui-colors", description: "Scan color palette alongside the audit" },
    { command: "/ui-standards", description: "Check component organization next" },
    { command: "/health", description: "Cross-reference UI score with health" },
    { command: "/scan", description: "Run full ESLint scan for deeper issues" }
  ],
  "ui-colors": [
    { command: "/ui-audit", description: "Full UI surface audit" },
    { command: "/images", description: "Check image weight alongside colors" },
    { command: "/health", description: "See color complexity in health context" },
    { command: "/scan --scan-images", description: "Include images in full scan" }
  ],
  "ui-standards": [
    { command: "/ui-audit", description: "Audit the full UI surface" },
    { command: "/doctor", description: "Check config and scripts for standards" },
    { command: "/scan --changed", description: "Scan standards for modified files" },
    { command: "/health", description: "Review health alongside standards" }
  ],
  "ui-typography": [
    { command: "/ui-audit", description: "Full UI surface audit" },
    { command: "/ui-colors", description: "Scan color palette" },
    { command: "/ui-spacing", description: "Check spacing patterns" },
    { command: "/images", description: "Inspect font file weight" }
  ],
  "ui-spacing": [
    { command: "/ui-typography", description: "Audit typography alongside spacing" },
    { command: "/ui-standards", description: "Check component organization" },
    { command: "/ui-audit", description: "Full UI surface audit" },
    { command: "/health", description: "Review health score impact" }
  ]
};

export function formatRelatedCommands(key: string): string[] {
  const entries = RELATED_COMMANDS[key] || DEFAULT_RELATED;
  return entries.map(({ command, description }) => {
    const badge = chalk.cyan(`[${intentLabel(command).padEnd(8)}]`);
    return `${chalk.bold(command.padEnd(22))} ${badge} ${chalk.dim(description)}`;
  });
}
