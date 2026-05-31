import Table from "cli-table3";
import chalk from "chalk";
import { ScanReport, FileReport } from "../types";
import { printScoreBar } from "../terminalUi";

function severityLabel(sev: number) {
  if (sev === 2) return chalk.red("error");
  if (sev === 1) return chalk.yellow("warn");
  return chalk.gray("info");
}

export function printSummary(report: ScanReport) {
  console.log(chalk.magenta.bold("\nScan Summary"));
  console.log(`${chalk.cyan("Score:")} ${chalk.bold(report.summary.score + "/100")}  ${chalk.cyan("Errors:")} ${chalk.red(report.summary.errors)}  ${chalk.cyan("Warnings:")} ${chalk.yellow(report.summary.warnings)}  ${chalk.cyan("Files:")} ${report.summary.filesWithIssues}\n`);
  printScoreBar(report.summary.score);

  if (report.files.length === 0) {
    console.log(chalk.green("No issues found. Great job!"));
    return;
  }

  const table = new Table({
    head: [chalk.cyan("File"), chalk.cyan("Errors"), chalk.cyan("Warnings"), chalk.cyan("Top Issue")],
    style: { head: [], border: ["gray"] }
  });

  for (const f of report.files as FileReport[]) {
    const top = f.messages.length > 0 ? `${severityLabel(f.messages[0].severity)}: ${f.messages[0].ruleId ?? "?"}` : "-";
    table.push([chalk.gray(f.filePath), chalk.red(f.errorCount), chalk.yellow(f.warningCount), top]);
  }

  console.log(table.toString());

  for (const f of report.files as FileReport[]) {
    if (f.messages.length === 0) continue;
    console.log(chalk.dim(`\n${f.filePath}:`));
    for (const msg of f.messages) {
      const loc = msg.line !== null ? chalk.gray(`:${msg.line}${msg.column !== null ? `:${msg.column}` : ""}`) : "";
      const tag = severityLabel(msg.severity);
      const rule = msg.ruleId ? chalk.cyan(msg.ruleId) : chalk.gray("(general)");
      const text = msg.message.length > 120 ? msg.message.slice(0, 120) + "..." : msg.message;
      console.log(`  ${tag} ${rule}${loc}  ${chalk.dim(text)}`);
    }
  }

  const categories = Object.entries(report.summary.categories)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => `${category}:${count}`)
    .join("  ");
  if (categories) {
    console.log(chalk.dim(`\nCategories: ${categories}`));
  }

  console.log(chalk.dim("\nUse `better-ui-cli /health`, `better-ui-cli /review --changed`, or `better-ui-cli /menu` for richer workflows."));
}
