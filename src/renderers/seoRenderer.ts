import chalk from "chalk";
import { printPanel } from "../terminalUi";
import type { SeoReport } from "../scanners/seoScanner";

export function renderSeoReport(result: SeoReport): void {
  const ok = (b: boolean) => b ? chalk.green("✓") : chalk.red("✗");

  const metaLines = [
    ok(result.meta.hasCharset) + " charset",
    ok(result.meta.hasViewport) + " viewport" + (result.meta.viewportQuality === "poor" ? chalk.yellow(" (poor quality)") : ""),
    ok(result.meta.hasDescription) + " description",
    ok(result.meta.hasKeywords) + " keywords",
    ok(result.meta.hasAuthor) + " author",
    ok(result.meta.hasThemeColor) + " theme-color",
    ok(result.meta.hasLang) + " html lang",
    ok(result.meta.hasCanonical) + " canonical",
    ok(result.meta.hasFavicon) + " favicon",
    ok(result.meta.hasRobotsMeta) + " robots meta",
    ok(result.meta.hasRobotsTxt) + " robots.txt",
    ok(result.meta.hasSitemapXml) + " sitemap.xml",
    ok(result.meta.hasHreflang) + " hreflang",
  ];
  printPanel("Meta & Technical", metaLines, "blue");

  const ogCount = [result.openGraph.hasTitle, result.openGraph.hasDescription, result.openGraph.hasImage, result.openGraph.hasUrl, result.openGraph.hasType].filter(Boolean).length;
  printPanel("Open Graph", [
    `${ok(result.openGraph.hasTitle)} og:title`,
    `${ok(result.openGraph.hasDescription)} og:description`,
    `${ok(result.openGraph.hasImage)} og:image`,
    `${ok(result.openGraph.hasUrl)} og:url`,
    `${ok(result.openGraph.hasType)} og:type`,
    "", chalk.dim(`${ogCount}/5 tags present`),
  ], "magenta");

  const twCount = [result.twitterCard.hasCard, result.twitterCard.hasTitle, result.twitterCard.hasDescription, result.twitterCard.hasImage].filter(Boolean).length;
  printPanel("Twitter Cards", [
    `${ok(result.twitterCard.hasCard)} twitter:card`,
    `${ok(result.twitterCard.hasTitle)} twitter:title`,
    `${ok(result.twitterCard.hasDescription)} twitter:description`,
    `${ok(result.twitterCard.hasImage)} twitter:image`,
    "", chalk.dim(`${twCount}/4 tags present`),
  ], "cyan");

  printPanel("Structured Data", [
    `${chalk.cyan("JSON-LD blocks:")} ${result.structuredData.jsonLdCount}`,
    result.structuredData.hasJsonLdParseErrors ? chalk.yellow(`⚠ ${result.structuredData.jsonLdErrors.length} block(s) with parse errors`) : chalk.green("✓ All valid JSON"),
  ], "yellow");

  if (result.structuredData.jsonLdErrors.length > 0) {
    printPanel("JSON-LD Errors", result.structuredData.jsonLdErrors.slice(0, 5).map(e => `  ${chalk.white(e.file)}:${chalk.yellow(e.line)}  ${chalk.dim(e.detail)}`), "red");
  }

  const headingParts = [
    `H1:${result.content.headings.h1}`, `H2:${result.content.headings.h2}`, `H3:${result.content.headings.h3}`,
    `H4:${result.content.headings.h4}`, `H5:${result.content.headings.h5}`, `H6:${result.content.headings.h6}`,
  ];
  const headingStr = headingParts.filter(h => !h.endsWith(":0")).join("  ") || "no headings";
  const contentLines = [
    `${chalk.cyan("Headings:")} ${headingStr}`,
    result.content.hasHeadingGaps ? chalk.yellow("⚠ Heading hierarchy has gaps (e.g. h1→h3 without h2)") : chalk.green("✓ Clean heading hierarchy"),
    result.content.hasMultipleH1 ? chalk.red("✗ Multiple H1 detected") : chalk.green("✓ Single H1"),
    `${chalk.cyan("Semantic elements:")} ${result.content.semanticElements.length > 0 ? result.content.semanticElements.join(", ") : chalk.red("none")}`,
    `${chalk.cyan("Images:")} ${result.content.totalImages} total, ${result.content.imagesWithoutAlt.length > 0 ? chalk.yellow(result.content.imagesWithoutAlt.length + " without alt") : chalk.green("all have alt")}`,
    `${chalk.cyan("With dimensions:")} ${result.content.imagesWithDimension}/${result.content.totalImages}`,
    `${chalk.cyan("Lazy loaded:")} ${result.content.lazyLoadedImages}/${result.content.totalImages}`,
    `${chalk.cyan("Approx. word count:")} ${result.content.wordCount > 0 ? result.content.wordCount.toLocaleString() : "N/A"}`,
  ];
  printPanel("Content", contentLines, "green");

  if (result.content.imagesWithoutAlt.length > 0) {
    printPanel("Images Missing Alt Text", result.content.imagesWithoutAlt.slice(0, 10).map(d => `  ${chalk.white(d.file)}:${chalk.yellow(d.line)}  ${chalk.dim(d.detail)}`), "yellow");
  }

  printPanel("Links", [
    `${chalk.cyan("External links:")} ${result.links.externalLinks}`,
    `${chalk.cyan("Internal links:")} ${result.links.internalLinks}`,
    result.links.hashLinks.length > 0 ? chalk.yellow(`⚠ ${result.links.hashLinks.length} empty hash link(s) (<a href="#">)`) : chalk.green("✓ No empty hash links"),
    result.links.linksWithoutNoopener.length > 0 ? chalk.yellow(`${result.links.linksWithoutNoopener.length} missing rel="noopener noreferrer"`) : chalk.green("✓ All external links secured"),
  ], "cyan");

  if (result.links.linksWithoutNoopener.length > 0) {
    printPanel("Links Without Noopener", result.links.linksWithoutNoopener.slice(0, 10).map(d => `  ${chalk.white(d.file)}:${chalk.yellow(d.line)}  ${chalk.dim(d.detail)}`), "yellow");
  }

  if (result.links.hashLinks.length > 0) {
    printPanel("Empty Hash Links", result.links.hashLinks.slice(0, 10).map(d => `  ${chalk.white(d.file)}:${chalk.yellow(d.line)}  ${chalk.dim(d.detail)}`), "yellow");
  }

  printPanel("Performance SEO", [
    `${chalk.cyan("Preload:")} ${result.performance.preloadHints}`,
    `${chalk.cyan("Preconnect:")} ${result.performance.preconnectHints}`,
    `${chalk.cyan("Render-blocking scripts:")} ${result.performance.blockingScriptFiles.length > 0 ? chalk.yellow(result.performance.blockingScriptFiles.length) : chalk.green("0")}`,
    `${chalk.cyan("Render-blocking CSS:")} ${result.performance.blockingCssFiles.length}`,
  ], "yellow");

  if (result.performance.blockingScriptFiles.length > 0) {
    printPanel("SEO Blocking Scripts", result.performance.blockingScriptFiles.slice(0, 8).map(d => `  ${chalk.white(d.file)}:${chalk.yellow(d.line)}  ${chalk.dim(d.detail)}`), "red");
  }

  if (result.performance.blockingCssFiles.length > 0) {
    printPanel("SEO Blocking Stylesheets", result.performance.blockingCssFiles.slice(0, 8).map(d => `  ${chalk.white(d.file)}:${chalk.yellow(d.line)}  ${chalk.dim(d.detail)}`), "red");
  }

  printPanel("SEO Score", [
    `${chalk.bold(String(result.score))}/100  ${result.score >= 80 ? chalk.green("👍") : result.score >= 50 ? chalk.yellow("⚠") : chalk.red("🔴")}`,
  ], result.score >= 80 ? "green" : result.score >= 50 ? "yellow" : "red");

  if (result.recommendations.length > 0) {
    printPanel("Recommendations", result.recommendations.map(r => `  ${chalk.green("→")} ${r}`), "yellow");
  }
}
