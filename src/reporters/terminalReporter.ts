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

  const MAX_EXAMPLES_PER_GROUP = 5;

  for (const f of report.files as FileReport[]) {
    if (f.messages.length === 0) continue;
    console.log(chalk.dim(`\n${f.filePath}:`));

    const groups = new Map<string, typeof f.messages>();
    for (const msg of f.messages) {
      const key = `${msg.severity}|${msg.ruleId ?? "(general)"}|${msg.message}`;
      const existing = groups.get(key);
      if (existing) existing.push(msg);
      else groups.set(key, [msg]);
    }

    for (const group of groups.values()) {
      const first = group[0];
      const tag = severityLabel(first.severity);
      const rule = first.ruleId ? chalk.cyan(first.ruleId) : chalk.gray("(general)");
      const text = first.message.length > 120 ? first.message.slice(0, 120) + "..." : first.message;

      if (group.length === 1) {
        const loc = first.line !== null ? chalk.gray(`:${first.line}${first.column !== null ? `:${first.column}` : ""}`) : "";
        console.log(`  ${tag} ${rule}${loc}  ${chalk.dim(text)}`);
      } else {
        const example = first.line !== null ? chalk.gray(`:${first.line}:${first.column ?? ""}`) : "";
        const extra = group.length - 1;
        console.log(`  ${tag} ${rule}${example}  ${chalk.dim(text)}  ${chalk.yellow(`+${extra} more`)}`);
      }
    }
  }

  const categories = Object.entries(report.summary.categories)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => `${category}:${count}`)
    .join("  ");
  if (categories) {
    console.log(chalk.dim(`\nCategories: ${categories}`));
  }

  console.log(chalk.dim("\nUse `better-ui-cli /health` or `better-ui-cli /menu` for richer workflows."));
}
