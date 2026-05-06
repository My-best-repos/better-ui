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
    name: "scan --changed",
    slash: "/changed",
    description: "Scan only modified and untracked files in the current git worktree.",
    example: "better-ui-cli /changed"
  },
  {
    name: "scan --staged",
    slash: "/staged",
    description: "Scan only staged files before a commit.",
    example: "better-ui-cli /staged"
  },
  {
    name: "fix",
    slash: "/fix",
    description: "Preview fixes or apply ESLint autofixes when requested.",
    example: "better-ui-cli /fix --apply"
  },
  {
    name: "fix",
    slash: "/fix-preview",
    description: "Run the same dry-run fix preview shown by the TUI preview action.",
    example: "better-ui-cli /fix-preview"
  },
  {
    name: "fix --apply",
    slash: "/fix-apply",
    description: "Apply ESLint autofixes directly, matching the TUI apply-fixes action.",
    example: "better-ui-cli /fix-apply"
  },
  {
    name: "fix --interactive",
    slash: "/fix-interactive",
    description: "Preview autofixes and choose which files to update.",
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
    description: "Show the files with the highest issue density and risk.",
    example: "better-ui-cli /hotspots"
  },
  {
    name: "check-accessibility",
    slash: "/a11y",
    description: "Show only accessibility-related findings for the selected scope.",
    example: "better-ui-cli /a11y --changed"
  },
  {
    name: "review",
    slash: "/review",
    description: "Generate a PR-style summary for changed or staged files.",
    example: "better-ui-cli /review --changed"
  },
  {
    name: "review --changed",
    slash: "/review-changed",
    description: "Run the same changed-files review action exposed in the TUI.",
    example: "better-ui-cli /review-changed"
  },
  {
    name: "review --staged",
    slash: "/review-staged",
    description: "Run the same staged-files review action exposed in the TUI.",
    example: "better-ui-cli /review-staged"
  },
  {
    name: "pr-summary",
    slash: "/pr-summary",
    description: "Generate a pull-request summary, defaulting to changed files.",
    example: "better-ui-cli /pr-summary --out pr-summary.md"
  },
  {
    name: "compare",
    slash: "/compare",
    description: "Compare the current scan with the last saved snapshot.",
    example: "better-ui-cli /compare"
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
    slash: "/help",
    description: "List every command, slash alias, and what it does.",
    example: "better-ui-cli /commands"
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
  }
];

function getCommandBySlash(slash: string) {
  return COMMANDS.find(command => command.slash === slash);
}
