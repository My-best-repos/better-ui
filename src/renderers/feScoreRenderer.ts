import chalk from "chalk";
import { printPanel } from "../terminalUi";
import type { FeScoreResult } from "../cli/workflows";

export function renderFeScoreReport(result: FeScoreResult): void {
  printPanel("Frontend Score", [
    `${chalk.bold(String(result.totalScore))}/100`,
    "",
    ...result.scores.map(s => {
      const bar = chalk.cyan("■".repeat(Math.round(s.score / 10))) + chalk.gray("□".repeat(10 - Math.round(s.score / 10)));
      return `  ${chalk.white(s.name.padEnd(16))} ${bar} ${chalk.bold(s.score)}`;
    }),
  ], result.totalScore >= 80 ? "green" : result.totalScore >= 50 ? "yellow" : "red");

  if (result.recommendations.length > 0) {
    printPanel("Top Recommendations", result.recommendations.map(r => `  ${chalk.green("→")} ${r}`), "yellow");
  }
}
