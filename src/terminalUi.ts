import chalk from "chalk";
import Table from "cli-table3";
import { COMMANDS } from "./commandCatalog";
import { formatRelatedCommands } from "./relatedCommands";

type PanelColor = "magenta" | "cyan" | "yellow" | "green" | "blue" | "red";

// Replaced the previous brush art with the larger ASCII title requested by the user.
const BRUSH_ART = [
  "/$$$$$$$  /$$$$$$$$ /$$$$$$$$ /$$$$$$$$ /$$$$$$$$ /$$$$$$$          /$$   /$$ /$$$$$$",
  "| $$__  $$| $$_____/|__  $$__/|__  $$__/| $$_____/| $$__  $$        | $$  | $$|_  $$_/",
  "| $$  \\ $$| $$         | $$      | $$   | $$      | $$  \\ $$        | $$  | $$  | $$  ",
  "| $$$$$$$ | $$$$$      | $$      | $$   | $$$$$   | $$$$$$$/ /$$$$$$| $$  | $$  | $$  ",
  "| $$__  $$| $$__/      | $$      | $$   | $$__/   | $$__  $$|______/| $$  | $$  | $$  ",
  "| $$  \\ $$| $$         | $$      | $$   | $$      | $$  \\ $$        | $$  | $$  | $$  ",
  "| $$$$$$$/| $$$$$$$$   | $$      | $$   | $$$$$$$$| $$  | $$        |  $$$$$$/ /$$$$$$",
  "|_______/ |________/   |__/      |__/   |________/|__/  |__/         \\______/ |______/"
];

export function printBanner() {
  // Print only the ASCII title art. We intentionally omit the "project: <label>" line
  // to keep the banner compact and focused on branding.
  const lines = BRUSH_ART.map((line, index) => index < 6 ? chalk.hex("#C084FC")(line) : chalk.hex("#22D3EE")(line));

  console.log(`\n${lines.join("\n")}\n`);
}

function getPaint(color: PanelColor = "magenta") {
  return color === "cyan" ? chalk.cyan : color === "yellow" ? chalk.yellow : color === "green" ? chalk.green : color === "blue" ? chalk.blue : color === "red" ? chalk.red : chalk.magenta;
}

export function printPanel(title: string, lines: string[], color: PanelColor = "magenta") {
  const maxWidth = Math.min(process.stdout.columns || 100, 100);
  const striptAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');
  const width = Math.min(maxWidth, Math.max(42, title.length + 4, ...lines.map(line => striptAnsi(line).length + 4)));
  const paint = getPaint(color);
  const top = `╭${"─".repeat(width - 2)}╮`;
  const bottom = `╰${"─".repeat(width - 2)}╯`;
  console.log(paint(top));
  console.log(paint(`│ ${chalk.bold(title)}${" ".repeat(Math.max(0, width - title.length - 3))}│`));
  for (const line of lines) {
    const visibleLength = striptAnsi(line).length;
    console.log(paint(`│ `) + line + paint(`${" ".repeat(Math.max(0, width - visibleLength - 3))}│`));
  }
  console.log(paint(bottom));
}

export function printGrid(panels: { title: string; lines: string[]; color?: PanelColor }[]) {
  if (panels.length === 0) return;
  
  const striptAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');
  const maxWidth = Math.min(process.stdout.columns || 100, 100);

  // Use cli-table3 to create a borderless grid
  const table = new Table({
    chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
         , 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
         , 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
         , 'right': '' , 'right-mid': '' , 'middle': '   ' },
    style: { 'padding-left': 0, 'padding-right': 0 }
  });

  const row: string[] = [];
  for (const p of panels) {
    const width = Math.min(maxWidth, Math.max(38, p.title.length + 4, ...p.lines.map(line => striptAnsi(line).length + 4)));
    const paint = getPaint(p.color);
    let box = paint(`╭${"─".repeat(width - 2)}╮\n`);
    box += paint(`│ ${chalk.bold(p.title)}${" ".repeat(Math.max(0, width - p.title.length - 3))}│\n`);
    for (const line of p.lines) {
      const visibleLength = striptAnsi(line).length;
      box += paint(`│ `) + line + paint(`${" ".repeat(Math.max(0, width - visibleLength - 3))}│\n`);
    }
    box += paint(`╰${"─".repeat(width - 2)}╯`);
    row.push(box);

    if (row.length === 2) {
      table.push([...row]);
      row.length = 0;
    }
  }
  if (row.length > 0) {
    row.push(""); // empty cell
    table.push([...row]);
  }

  console.log(table.toString());
}


export function printCommandCatalog() {
  const table = new Table({
    head: [chalk.cyan("Command"), chalk.cyan("Slash"), chalk.cyan("Description")],
    style: { head: [], border: ["gray"] },
    wordWrap: true,
    colWidths: [24, 14, 70]
  });

  for (const command of COMMANDS) {
    table.push([command.name, command.slash, command.description]);
  }

  console.log(table.toString());
}

export function printScoreBar(score: number, total = 100, width = 20) {
  const filled = Math.round((score / total) * width);
  const empty = width - filled;
  const barColor = score >= 70 ? chalk.green : score >= 40 ? chalk.yellow : chalk.red;
  const bar = barColor("█".repeat(filled)) + chalk.gray("░".repeat(empty));
  console.log(`  ${bar}  ${chalk.bold(String(score))}/${total}`);
}

const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

export function formatTimestamp(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return TIMESTAMP_FORMATTER.format(date).replace(",", "");
}

export function formatElapsed(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function printRunSummary(commandText: string) {
  printPanel("Run Summary", [
    `${chalk.cyan("Command:")} ${chalk.bold(commandText)}`,
    `${chalk.cyan("Started:")} ${formatTimestamp(new Date())}`
  ], "blue");
}

export function formatDelta(value: number) {
  if (value === 0) {
    return chalk.gray("0");
  }

  return value > 0 ? chalk.red(`+${value}`) : chalk.green(String(value));
}

export function groupMessages<T extends { severity: number; ruleId?: string | null; message: string }>(
  messages: T[]
): { first: T; count: number }[] {
  const groups = new Map<string, T[]>();
  for (const msg of messages) {
    const key = `${msg.severity}|${msg.ruleId ?? ""}|${msg.message}`;
    const existing = groups.get(key);
    if (existing) existing.push(msg);
    else groups.set(key, [msg]);
  }
  return [...groups.values()].map(g => ({ first: g[0], count: g.length }));
}

export function groupMessagesByRule<T extends { severity: number; ruleId?: string | null; message: string }>(
  messages: T[]
): { first: T; count: number }[] {
  const groups = new Map<string, T[]>();
  for (const msg of messages) {
    const key = `${msg.severity}|${msg.ruleId ?? ""}`;
    const existing = groups.get(key);
    if (existing) existing.push(msg);
    else groups.set(key, [msg]);
  }
  return [...groups.values()].map(g => ({ first: g[0], count: g.length }));
}

export function printFooter() {
  console.log(chalk.dim("\n──────────────────────────────────────────"));
  console.log(chalk.dim("better-ui-cli /menu — Open command center"));
  console.log(chalk.dim("better-ui-cli /commands — All commands\n"));
}

export function printRelatedCommands(key: string) {
  printPanel("Next Best Moves", formatRelatedCommands(key), "cyan");
}

export function categoryRecommendations(category: string): string[] {
  const recs: Record<string, string[]> = {
    "maintainability": ["Split large files into smaller modules", "Extract repeated logic into shared utilities", "Use consistent file naming conventions"],
    "accessibility": ["Add aria-* attributes to interactive elements", "Ensure sufficient color contrast", "Add keyboard navigation support", "Use semantic HTML elements"],
    "performance": ["Optimize and compress images", "Lazy-load heavy components", "Tree-shake unused exports", "Avoid unnecessary re-renders"],
    "code-quality": ["Remove unused variables and imports", "Use strict equality (===) over loose (==)", "Add JSDoc/TSDoc to public APIs", "Fix console.log statements"],
    "correctness": ["Fix all errors before deployment", "Add proper error boundaries", "Validate edge cases in conditionals"],
    "dx": ["Standardize import paths with aliases", "Add pre-commit hooks for linting", "Create consistent component patterns"]
  };
  return recs[category] || [];
}
