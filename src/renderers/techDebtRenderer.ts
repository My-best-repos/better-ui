import chalk from "chalk";
import { printPanel } from "../terminalUi";
import type { TechDebtReport } from "../scanners/techDebtScanner";

type PanelColor = "red" | "yellow" | "green" | "blue" | "magenta" | "cyan";

function td(items: { file: string; line: number; detail?: string }[], label: string, color: PanelColor = "yellow"): string {
  return items.length > 0
    ? `${chalk[color](label + ":")} ${chalk.white(items.length)}`
    : chalk.green(`✓ 0 ${label}`);
}

export function renderTechDebtReport(result: TechDebtReport): void {
  printPanel("Code Smells Summary", [
    td(result.todos, "TODO"),
    td(result.fixmes, "FIXME"),
    td(result.hacks, "HACK"),
    td(result.xxxs, "XXX"),
    td(result.consoleLogs, "console.log()"),
    td(result.debuggers, "debugger;", "red"),
    td(result.anyTypes, ":any types"),
    td(result.nonStrictEqualities, "Loose equality (==)"),
    td(result.varDeclarations, "var declarations"),
    td(result.commentedCode, "Commented code"),
    td(result.emptyCatches, "Empty catch blocks", "red"),
    `${chalk.cyan("Large files (>300 lines):")} ${result.largeFiles.length > 0 ? chalk.yellow(result.largeFiles.length) : chalk.green("0")}`,
  ], "yellow");

  const detailPanels: [string, { file: string; line: number; detail?: string }[], PanelColor][] = [
    ["TODOs", result.todos, "yellow"],
    ["FIXMEs", result.fixmes, "yellow"],
    ["HACKs", result.hacks, "yellow"],
    ["XXXs", result.xxxs, "yellow"],
    ["console.log()", result.consoleLogs, "yellow"],
    ["debugger;", result.debuggers, "red"],
    [":any types", result.anyTypes, "yellow"],
    ["Loose equality (==)", result.nonStrictEqualities, "yellow"],
    ["var declarations", result.varDeclarations, "yellow"],
    ["Commented code", result.commentedCode, "yellow"],
    ["Empty catch blocks", result.emptyCatches, "red"],
  ];

  for (const [label, items, color] of detailPanels) {
    if (items.length > 0) {
      printPanel(label, items.slice(0, 10).map(d => `  ${chalk.white(d.file)}:${chalk.yellow(d.line)}  ${chalk.dim(d.detail || "")}`), color);
    }
  }

  if (result.largeFiles.length > 0) {
    printPanel("Large Files", result.largeFiles.slice(0, 10).map(f => `  ${chalk.white(f.file)}  ${chalk.dim(f.lines + " lines")}`), "yellow");
  }

  printPanel("Tech Debt Score", [
    `${chalk.bold(String(result.score))}/100  ${result.score >= 80 ? chalk.green("👍") : result.score >= 50 ? chalk.yellow("⚠") : chalk.red("🔴")}`,
  ], result.score >= 80 ? "green" : result.score >= 50 ? "yellow" : "red");

  if (result.recommendations.length > 0) {
    printPanel("Recommendations", result.recommendations.map(r => `  ${chalk.green("→")} ${r}`), "yellow");
  }
}
