import chalk from "chalk";
import { printPanel } from "../terminalUi";
import type { PerformanceReport } from "../scanners/performanceScanner";

export function renderPerformanceReport(result: PerformanceReport): void {
  printPanel("Images", [
    `${chalk.cyan("Total images:")} ${result.imageStats.totalImages}`,
    `${chalk.cyan("Total size:")} ${result.imageStats.totalSizeKb} KB`,
    `${chalk.cyan("Without dimensions:")} ${result.imageStats.withoutDimensions.length > 0 ? chalk.yellow(result.imageStats.withoutDimensions.length) : chalk.green("0")}`,
    `${chalk.cyan("Without lazy loading:")} ${result.imageStats.withoutLazy.length > 0 ? chalk.yellow(result.imageStats.withoutLazy.length) : chalk.green("0")}`,
    result.imageStats.oversized.length > 0 ? `${chalk.red("Oversized:")} ${result.imageStats.oversized.length} files > 200KB` : chalk.green("✓ No oversized images"),
  ], "blue");

  if (result.imageStats.withoutDimensions.length > 0) {
    printPanel("Images Without Dimensions", result.imageStats.withoutDimensions.slice(0, 10).map(d => `  ${chalk.white(d.file)}:${chalk.yellow(d.line)}  ${chalk.dim(d.detail)}`), "yellow");
  }

  if (result.imageStats.withoutLazy.length > 0) {
    printPanel("Images Without Lazy Loading", result.imageStats.withoutLazy.slice(0, 10).map(d => `  ${chalk.white(d.file)}:${chalk.yellow(d.line)}  ${chalk.dim(d.detail)}`), "yellow");
  }

  if (result.imageStats.oversized.length > 0) {
    printPanel("Oversized Images", result.imageStats.oversized.slice(0, 8).map(i => `  ${chalk.white(i.file)}  ${chalk.yellow(i.sizeKb + " KB")}  ${chalk.dim("(max: " + i.maxRecommended + " KB)")}`), "red");
  }

  if (result.bundleHints.heavyImports.length > 0) {
    printPanel("Heavy Imports", result.bundleHints.heavyImports.slice(0, 8).map(i => `  ${chalk.yellow(i.name)}  ${chalk.dim(i.line)}`), "yellow");
  }

  if (result.bundleHints.missingCodeSplitting && result.bundleHints.missingCodeSplittingFiles.length > 0) {
    printPanel("Missing Code Splitting", result.bundleHints.missingCodeSplittingFiles.slice(0, 10).map(f => `  ${chalk.white(f)}`), "yellow");
  }

  printPanel("Render Blocking", [
    `${chalk.cyan("Blocking scripts in <head>:")} ${result.renderBlocking.blockingScriptFiles.length > 0 ? chalk.yellow(result.renderBlocking.blockingScriptFiles.length) : chalk.green("0")}`,
    `${chalk.cyan("Blocking stylesheets in <head>:")} ${result.renderBlocking.blockingCssFiles.length > 0 ? chalk.yellow(result.renderBlocking.blockingCssFiles.length) : chalk.green("0")}`,
    `${chalk.cyan("Scripts with defer:")} ${result.renderBlocking.scriptsWithDefer}`,
    `${chalk.cyan("Scripts with async:")} ${result.renderBlocking.scriptsWithAsync}`,
  ], "magenta");

  if (result.renderBlocking.blockingScriptFiles.length > 0) {
    printPanel("Blocking Scripts", result.renderBlocking.blockingScriptFiles.slice(0, 8).map(d => `  ${chalk.white(d.file)}:${chalk.yellow(d.line)}  ${chalk.dim(d.detail)}`), "red");
  }

  if (result.renderBlocking.blockingCssFiles.length > 0) {
    printPanel("Blocking Stylesheets", result.renderBlocking.blockingCssFiles.slice(0, 8).map(d => `  ${chalk.white(d.file)}:${chalk.yellow(d.line)}  ${chalk.dim(d.detail)}`), "red");
  }

  printPanel("Resource Hints", [
    `${chalk.cyan("Preconnect:")} ${result.resourceHints.preconnect}`,
    `${chalk.cyan("Preload:")} ${result.resourceHints.preload}`,
    `${chalk.cyan("Prefetch:")} ${result.resourceHints.prefetch}`,
  ], "cyan");

  printPanel("Caching", [
    result.caching.hasServiceWorker ? chalk.green("✓ Service worker detected") : chalk.yellow("✗ No service worker"),
    result.caching.hasCachePolicy ? chalk.green("✓ Cache policy found") : chalk.yellow("✗ No cache policy detected"),
  ], "yellow");

  printPanel("Performance Score", [
    `${chalk.bold(String(result.score))}/100  ${result.score >= 80 ? chalk.green("👍") : result.score >= 50 ? chalk.yellow("⚠") : chalk.red("🔴")}`,
  ], result.score >= 80 ? "green" : result.score >= 50 ? "yellow" : "red");

  if (result.recommendations.length > 0) {
    printPanel("Recommendations", result.recommendations.map(r => `  ${chalk.green("→")} ${r}`), "yellow");
  }
}
