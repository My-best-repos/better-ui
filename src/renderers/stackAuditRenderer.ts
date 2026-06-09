import chalk from "chalk";
import { printPanel } from "../terminalUi";
import type { StackAuditReport } from "../scanners/stackAuditScanner";

export function renderStackAuditReport(result: StackAuditReport): void {
  printPanel("Frameworks & Tools", [
    `${chalk.cyan("Frameworks:")} ${result.frameworks.length > 0 ? result.frameworks.join(", ") : chalk.dim("none detected")}`,
    `${chalk.cyan("Build tool:")} ${result.buildTool || chalk.dim("not detected")}`,
    `${chalk.cyan("CSS framework:")} ${result.cssFramework || chalk.dim("none")}`,
    `${chalk.cyan("Package manager:")} ${result.packageManager || chalk.dim("not detected")}`,
    `${chalk.cyan("Node.js:")} ${result.nodeVersion || chalk.dim("not specified")}`,
    `${chalk.cyan("TypeScript:")} ${result.typescriptVersion || chalk.dim("not used")}`,
  ], "blue");

  printPanel("Tooling", [
    `${result.testRunner ? chalk.green("✓ Test: " + result.testRunner) : chalk.red("✗ No test runner")}`,
    `${result.linter ? chalk.green("✓ Linter: " + result.linter) : chalk.red("✗ No linter")}`,
    `${result.formatter ? chalk.green("✓ Formatter: " + result.formatter) : chalk.yellow("✗ No formatter")}`,
    `${result.hasCiConfig ? chalk.green("✓ CI config") : chalk.yellow("✗ No CI config")}`,
    `${result.hasPreCommitHooks ? chalk.green("✓ Pre-commit hooks") : chalk.yellow("✗ No pre-commit hooks")}`,
    `${result.hasDockerfile ? chalk.green("✓ Dockerfile") : chalk.dim("No Dockerfile")}`,
  ], "cyan");

  printPanel("Extras", [
    `${result.hasStorybook ? chalk.green("✓ Storybook") : chalk.dim("No Storybook")}`,
    `${result.hasMonorepoConfig ? chalk.green("✓ Monorepo") : chalk.dim("Not a monorepo")}`,
    `${result.hasBundleAnalyzer ? chalk.green("✓ Bundle analyzer") : chalk.dim("No bundle analyzer")}`,
  ], "magenta");

  printPanel("Stack Score", [
    `${chalk.bold(String(result.score))}/100  ${result.score >= 80 ? chalk.green("👍") : result.score >= 50 ? chalk.yellow("⚠") : chalk.red("🔴")}`,
  ], result.score >= 80 ? "green" : result.score >= 50 ? "yellow" : "red");

  if (result.recommendations.length > 0) {
    printPanel("Recommendations", result.recommendations.map(r => `  ${chalk.green("→")} ${r}`), "yellow");
  }
}
