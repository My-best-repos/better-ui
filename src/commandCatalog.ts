interface CommandDefinition {
  name: string;
  slash: string;
  description: string;
  example: string;
}

export const COMMANDS: CommandDefinition[] = [
  {
    name: "scan",
    slash: "/scan",
    description: "Scan the whole project and save a structured report.",
    example: "better-ui-cli /scan --format html --out report.html"
  },
  {
    name: "scan --changed (alias)",
    slash: "/changed",
    description: "Alias for /scan --changed. Scan only modified and untracked files.",
    example: "better-ui-cli /changed"
  },
  {
    name: "scan --staged (alias)",
    slash: "/staged",
    description: "Alias for /scan --staged. Scan only staged files before a commit.",
    example: "better-ui-cli /staged"
  },
  {
    name: "fix",
    slash: "/fix",
    description: "Preview fixes or apply ESLint autofixes when requested.",
    example: "better-ui-cli /fix --apply"
  },
  {
    name: "fix --preview (alias)",
    slash: "/fix-preview",
    description: "Alias for /fix. Dry-run preview of ESLint autofixes.",
    example: "better-ui-cli /fix-preview"
  },
  {
    name: "fix --apply (alias)",
    slash: "/fix-apply",
    description: "Alias for /fix --apply. Apply ESLint autofixes directly.",
    example: "better-ui-cli /fix-apply"
  },
  {
    name: "fix --interactive (alias)",
    slash: "/fix-interactive",
    description: "Alias for /fix --interactive. Pick hunks one by one.",
    example: "better-ui-cli /fix --interactive"
  },
  {
    name: "health",
    slash: "/health",
    description: "Build a frontend health score with category breakdowns and priorities.",
    example: "better-ui-cli /health"
  },
  {
    name: "deps",
    slash: "/deps",
    description: "Find unused dependencies and heavy packages.",
    example: "better-ui-cli /deps"
  },
  {
    name: "advanced",
    slash: "/advanced",
    description: "Show advanced subcommands, flags, and hidden pro-tips.",
    example: "better-ui-cli /advanced"
  },
  {
    name: "doctor",
    slash: "/doctor",
    description: "Run the broad project doctor view including config and script checks.",
    example: "better-ui-cli /doctor"
  },
  {
    name: "hotspots",
    slash: "/hotspots",
    description: "Show the files with the highest issue density and risk. Flags: --density (sort by issues/line), --min-score <n> (filter).",
    example: "better-ui-cli /hotspots --density --min-score 3"
  },
  {
    name: "check-accessibility (alias)",
    slash: "/a11y",
    description: "Alias for /check-accessibility. Show only a11y findings.",
    example: "better-ui-cli /a11y --changed"
  },
  {
    name: "review",
    slash: "/review",
    description: "Generate a PR-style summary for changed or staged files.",
    example: "better-ui-cli /review --changed"
  },
  {
    name: "review --changed (alias)",
    slash: "/review-changed",
    description: "Alias for /review --changed. Review only modified files.",
    example: "better-ui-cli /review-changed"
  },
  {
    name: "review --staged (alias)",
    slash: "/review-staged",
    description: "Alias for /review --staged. Review only staged files.",
    example: "better-ui-cli /review-staged"
  },
  {
    name: "pr-summary",
    slash: "/pr-summary",
    description: "Generate a pull-request summary, defaulting to changed files.",
    example: "better-ui-cli /pr-summary --out pr-summary.md"
  },
  {
    name: "explain",
    slash: "/explain",
    description: "Explain why findings matter and how to fix them.",
    example: "better-ui-cli /explain src/components/App.tsx"
  },
  {
    name: "images",
    slash: "/images",
    description: "Inspect image weight and optionally create WebP versions.",
    example: "better-ui-cli /images --generate"
  },
  {
    name: "init",
    slash: "/init",
    description: "Create `better-ui.config.json` with optional project presets and helper scripts.",
    example: "better-ui-cli /init --preset next"
  },
  {
    name: "tui",
    slash: "/menu",
    description: "Open the full-screen command menu and dashboard.",
    example: "better-ui-cli /menu"
  },
  {
    name: "commands",
    slash: "/commands",
    description: "Alias for the full command catalog from inside the TUI palette.",
    example: "better-ui-cli /commands"
  },
  {
    name: "exit",
    slash: "/exit",
    description: "Leave the TUI directly from the slash-command palette.",
    example: "better-ui-cli /menu"
  },
  {
    name: "ui-audit",
    slash: "/ui-audit",
    description: "Audit UI surface: file distribution, CSS methodology, semantic HTML, responsive breakpoints, and font loading.",
    example: "better-ui-cli /ui-audit"
  },
  {
    name: "ui-colors",
    slash: "/ui-colors",
    description: "Scan all color declarations across CSS and components. Detects hex, rgb, hsl, and Tailwind color classes.",
    example: "better-ui-cli /ui-colors"
  },
  {
    name: "ui-standards",
    slash: "/ui-standards",
    description: "Analyze component file organization, naming conventions, export patterns, props interfaces, and complexity.",
    example: "better-ui-cli /ui-standards"
  },
  {
    name: "ui-typography",
    slash: "/ui-typography",
    description: "Audit typography: font families, sizes, line-heights, weights, and custom @font-face declarations.",
    example: "better-ui-cli /ui-typography"
  },
  {
    name: "ui-spacing",
    slash: "/ui-spacing",
    description: "Scan spacing patterns: margins, paddings, gaps, and Tailwind spacing utilities.",
    example: "better-ui-cli /ui-spacing"
  }
];

function getCommandBySlash(slash: string) {
  return COMMANDS.find(command => command.slash === slash);
}
