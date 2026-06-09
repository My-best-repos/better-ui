import chalk from "chalk";
import { printPanel } from "../terminalUi";
import type { MigrationReport } from "../scanners/migrationScanner";

export function renderMigrationReport(result: MigrationReport): void {
  if (result.legacyPatterns.every(p => p.count === 0)) {
    printPanel("Migration", [chalk.green("✓ No legacy patterns detected — your codebase looks modern!")], "green");
  } else {
    for (const pattern of result.legacyPatterns) {
      if (pattern.count === 0) continue;
      const sampleFiles = pattern.files.slice(0, 3).map(f => `    ${chalk.dim(f)}`).join("\n");
      printPanel(pattern.type, [
        `${chalk.cyan("Occurrences:")} ${pattern.count}`,
        `${chalk.dim(pattern.description)}`,
        "",
        `${chalk.green("→")} ${pattern.migration}`,
        ...(pattern.files.length > 0 ? ["", chalk.dim("Sample files:"), sampleFiles] : []),
      ], "yellow");
    }
  }

  printPanel("Migration Score", [
    `${chalk.bold(String(result.score))}/100  ${result.score >= 80 ? chalk.green("👍") : result.score >= 50 ? chalk.yellow("⚠") : chalk.red("🔴")}`,
  ], result.score >= 80 ? "green" : result.score >= 50 ? "yellow" : "red");

  if (result.recommendations.length > 0) {
    printPanel("Recommendations", result.recommendations.map(r => `  ${chalk.green("→")} ${r}`), "yellow");
  }
}
