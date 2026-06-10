import chalk from "chalk";

type RelatedEntry = {
  command: string;
  description: string;
};

function intentLabel(command: string) {
  if (command.includes("fix")) return "Repair";
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
    { command: "/commands", description: "Browse every slash command" }
  ],
  "scan-changed": [
    { command: "/fix --changed", description: "Preview fixes for modified files" },
    { command: "/scan", description: "Re-scan the project" },
    { command: "/health", description: "Check updated health score" },
    { command: "/hotspots", description: "Spot riskiest changed files" }
  ],
  "scan-staged": [
    { command: "/fix --staged", description: "Preview fixes for staged files" },
    { command: "/scan --staged", description: "Re-scan staged files" },
    { command: "/health", description: "Check staged health impact" },
    { command: "/commands", description: "Browse every slash command" }
  ],
  "fix": [
    { command: "/scan", description: "Run a full project scan" },
    { command: "/health", description: "Check updated health score" },
    { command: "/fix --apply", description: "Write all safe autofixes" },
    { command: "/fix --interactive", description: "Pick hunks manually" }
  ],
  "fix-preview": [
    { command: "/fix --apply", description: "Write all safe autofixes" },
    { command: "/fix --interactive", description: "Pick hunks manually" },
    { command: "/health", description: "Check updated health score" },
    { command: "/scan", description: "Re-scan after previewing" }
  ],
  "fix-apply": [
    { command: "/scan", description: "Measure the new score" },
    { command: "/health", description: "Check updated health score" },
    { command: "/fix --interactive", description: "Pick remaining hunks" },
    { command: "/commands", description: "Browse every slash command" }
  ],
  "fix-interactive": [
    { command: "/fix --apply", description: "Apply all remaining safe fixes" },
    { command: "/scan", description: "Re-scan after selected hunks" },
    { command: "/health", description: "Check updated health score" },
    { command: "/commands", description: "Browse every slash command" }
  ],
  "health": [
    { command: "/hotspots", description: "Focus the riskiest files first" },
    { command: "/fix", description: "Preview autofixes for health issues" },
    { command: "/images", description: "Inspect image payload weight" },
    { command: "/commands", description: "Browse every slash command" }
  ],
  "deps": [
    { command: "/scan", description: "Run a full quality scan" },
    { command: "/health", description: "See dependency impact in the score" },
    { command: "/advanced", description: "Review more high-leverage flows" },
    { command: "/commands", description: "Browse every slash command" }
  ],
  "advanced": [
    { command: "/commands", description: "Browse every slash command" },
    { command: "/scan", description: "Run the main analysis flow" },
    { command: "/menu", description: "Open the interactive command center" },
    { command: "/images --generate", description: "Optimize large assets" }
  ],
  "hotspots": [
    { command: "/fix", description: "Preview fixes in risky files" },
    { command: "/health", description: "See category-level priorities" },
    { command: "/commands", description: "Browse every slash command" }
  ],
  "check-accessibility": [
    { command: "/fix", description: "Preview safe fixes in the same scope" },
    { command: "/health", description: "Check accessibility score impact" },
    { command: "/commands", description: "Browse every slash command" }
  ],
  "images": [
    { command: "/images --generate", description: "Create WebP versions" },
    { command: "/scan --scan-images", description: "Include images in project scan" },
    { command: "/health", description: "See image payload in health score" },
    { command: "/commands", description: "Browse every slash command" }
  ],
  "images-generate": [
    { command: "/scan --scan-images", description: "Re-scan image payload" },
    { command: "/health", description: "See updated image weight impact" },
    { command: "/images", description: "List all project images" },
    { command: "/commands", description: "Browse every slash command" }
  ],
  "commands": [
    { command: "/advanced", description: "See high-leverage flags and flows" },
    { command: "/scan", description: "Run the main analysis command" },
    { command: "/menu", description: "Use the interactive command center" },
    { command: "/commands", description: "Browse every slash command" }
  ],
  "ui-colors": [
    { command: "/images", description: "Check image weight alongside colors" },
    { command: "/health", description: "See color complexity in health context" },
    { command: "/scan --scan-images", description: "Include images in full scan" },
    { command: "/commands", description: "Browse every slash command" }
  ],
  "ui-standards": [
    { command: "/scan --changed", description: "Scan standards for modified files" },
    { command: "/health", description: "Review health alongside standards" },
    { command: "/hotspots", description: "Spot riskiest files" },
    { command: "/commands", description: "Browse every slash command" }
  ],
  "ui-typography": [
    { command: "/ui-colors", description: "Scan color palette" },
    { command: "/ui-spacing", description: "Check spacing patterns" },
    { command: "/images", description: "Inspect font file weight" },
    { command: "/commands", description: "Browse every slash command" }
  ],
  "ui-spacing": [
    { command: "/ui-typography", description: "Audit typography alongside spacing" },
    { command: "/ui-standards", description: "Check component organization" },
    { command: "/health", description: "Review health score impact" },
    { command: "/commands", description: "Browse every slash command" }
  ],
  "seo": [
    { command: "/performance", description: "Check performance alongside SEO" },
    { command: "/scan", description: "Run a full project scan" },
    { command: "/health", description: "Check overall project health" },
    { command: "/commands", description: "Browse every slash command" }
  ],
  "tech-debt": [
    { command: "/scan", description: "Run full scan after fixing debt" },
    { command: "/health", description: "Check updated health score" },
    { command: "/fix", description: "Preview autofixes" },
    { command: "/migration", description: "Check legacy patterns" }
  ],
  "performance": [
    { command: "/images --generate", description: "Optimize heavy images" },
    { command: "/scan --scan-images", description: "Include images in scan" },
    { command: "/seo", description: "Check SEO performance" },
    { command: "/health", description: "Check updated health score" }
  ],
  "stack-audit": [
    { command: "/health", description: "Check project health" },
    { command: "/deps", description: "Check dependency health" },
    { command: "/scan", description: "Run a full scan" },
    { command: "/commands", description: "Browse every slash command" }
  ],
  "migration": [
    { command: "/tech-debt", description: "Scan code smells before migrating" },
    { command: "/scan", description: "Run full scan after migration" },
    { command: "/fix", description: "Preview autofixes" },
    { command: "/health", description: "Check updated health score" }
  ],
  "fe-score": [
    { command: "/seo", description: "Deep-dive SEO audit" },
    { command: "/performance", description: "Deep-dive performance audit" },
    { command: "/tech-debt", description: "Deep-dive tech debt scan" },
    { command: "/stack-audit", description: "Deep-dive stack analysis" }
  ]
};

export function formatRelatedCommands(key: string): string[] {
  const entries = RELATED_COMMANDS[key] || DEFAULT_RELATED;
  return entries.map(({ command, description }) => {
    const badge = chalk.cyan(`[${intentLabel(command).padEnd(8)}]`);
    return `${chalk.bold(command.padEnd(22))} ${badge} ${chalk.dim(description)}`;
  });
}
