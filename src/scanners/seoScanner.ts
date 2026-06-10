import fs from "fs";
import path from "path";
import { walk, readFileSafe, FileDetail } from "./scannerUtils";

export interface SeoReport {
  score: number;
  meta: {
    hasCharset: boolean;
    hasViewport: boolean;
    hasDescription: boolean;
    hasThemeColor: boolean;
    hasLang: boolean;
    hasCanonical: boolean;
    hasFavicon: boolean;
    hasRobotsTxt: boolean;
    hasSitemapXml: boolean;
    hasKeywords: boolean;
    hasAuthor: boolean;
    hasHreflang: boolean;
    hasRobotsMeta: boolean;
    viewportQuality: "good" | "missing" | "poor";
  };
  openGraph: {
    hasTitle: boolean;
    hasDescription: boolean;
    hasImage: boolean;
    hasUrl: boolean;
    hasType: boolean;
  };
  twitterCard: {
    hasCard: boolean;
    hasTitle: boolean;
    hasDescription: boolean;
    hasImage: boolean;
  };
  structuredData: {
    jsonLdCount: number;
    hasJsonLdParseErrors: boolean;
    jsonLdErrors: FileDetail[];
  };
  content: {
    h1Count: number;
    hasMultipleH1: boolean;
    semanticElements: string[];
    totalImages: number;
    lazyLoadedImages: number;
    imagesWithDimension: number;
    imagesWithoutAlt: FileDetail[];
    headings: { h1: number; h2: number; h3: number; h4: number; h5: number; h6: number };
    hasHeadingGaps: boolean;
    wordCount: number;
  };
  links: {
    externalLinks: number;
    internalLinks: number;
    linksWithoutNoopener: FileDetail[];
    hashLinks: FileDetail[];
  };
  performance: {
    preloadHints: number;
    preconnectHints: number;
    renderBlockingScripts: number;
    renderBlockingCss: number;
    blockingScriptFiles: FileDetail[];
    blockingCssFiles: FileDetail[];
  };
  recommendations: string[];
}

export async function scanSeo(projectRoot: string): Promise<SeoReport> {
  const htmlFiles = walk(projectRoot, new Set([".html", ".htm"]));
  const tsxFiles = walk(projectRoot, new Set([".tsx", ".jsx"]));
  const componentFiles = [...htmlFiles, ...tsxFiles];

  const meta = {
    hasCharset: false,
    hasViewport: false,
    hasDescription: false,
    hasThemeColor: false,
    hasLang: false,
    hasCanonical: false,
    hasFavicon: false,
    hasRobotsTxt: false,
    hasSitemapXml: false,
    hasKeywords: false,
    hasAuthor: false,
    hasHreflang: false,
    hasRobotsMeta: false,
    viewportQuality: "missing" as "good" | "missing" | "poor",
  };

  const openGraph = {
    hasTitle: false,
    hasDescription: false,
    hasImage: false,
    hasUrl: false,
    hasType: false,
  };

  const twitterCard = {
    hasCard: false,
    hasDescription: false,
    hasTitle: false,
    hasImage: false,
  };

  let jsonLdCount = 0;
  let hasJsonLdParseErrors = false;
  const jsonLdErrors: FileDetail[] = [];
  let h1Count = 0;
  let hasMultipleH1 = false;
  const semanticElements = new Set<string>();
  const imagesWithoutAlt: FileDetail[] = [];
  let totalImages = 0;
  let lazyLoadedImages = 0;
  let imagesWithDimension = 0;
  let externalLinks = 0;
  const linksWithoutNoopener: FileDetail[] = [];
  let internalLinks = 0;
  const hashLinks: FileDetail[] = [];
  let preloadHints = 0;
  let preconnectHints = 0;
  const blockingScriptFiles: FileDetail[] = [];
  const blockingCssFiles: FileDetail[] = [];
  const headings = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  let wordCount = 0;

  const SEMANTIC_TAGS = ["header", "nav", "main", "article", "section", "aside", "footer"];

  for (const file of componentFiles) {
    const content = readFileSafe(file);
    if (!content) continue;
    const rel = path.relative(projectRoot, file);
    const lines = content.split(/\r?\n/);

    if (/<meta\s+[^>]*charset/i.test(content)) meta.hasCharset = true;
    if (/name=["']viewport["']/i.test(content)) meta.hasViewport = true;
    if (/name=["']description["']/i.test(content)) meta.hasDescription = true;
    if (/name=["']theme-color["']/i.test(content)) meta.hasThemeColor = true;
    if (/<html[^>]*\slang=/i.test(content)) meta.hasLang = true;
    if (/rel=["']canonical["']/i.test(content)) meta.hasCanonical = true;
    if (/rel=["'](?:shortcut )?icon["']/i.test(content)) meta.hasFavicon = true;
    if (/name=["']keywords["']/i.test(content)) meta.hasKeywords = true;
    if (/name=["']author["']/i.test(content)) meta.hasAuthor = true;
    if (/rel=["']alternate["'][^>]*hreflang=/i.test(content)) meta.hasHreflang = true;
    if (/name=["']robots["']/i.test(content)) meta.hasRobotsMeta = true;

    const vpMatch = content.match(/name=["']viewport["'][^>]*content=["']([^"']*)["']/i);
    if (vpMatch) {
      const vp = vpMatch[1];
      const hasWidthDevice = /\bwidth=device-width\b/.test(vp);
      const hasInitScale = /\binitial-scale=1\b/.test(vp);
      meta.viewportQuality = hasWidthDevice && hasInitScale ? "good" : "poor";
    }

    if (/property=["']og:title["']/i.test(content)) openGraph.hasTitle = true;
    if (/property=["']og:description["']/i.test(content)) openGraph.hasDescription = true;
    if (/property=["']og:image["']/i.test(content)) openGraph.hasImage = true;
    if (/property=["']og:url["']/i.test(content)) openGraph.hasUrl = true;
    if (/property=["']og:type["']/i.test(content)) openGraph.hasType = true;

    if (/name=["']twitter:card["']/i.test(content)) twitterCard.hasCard = true;
    if (/name=["']twitter:title["']/i.test(content)) twitterCard.hasTitle = true;
    if (/name=["']twitter:description["']/i.test(content)) twitterCard.hasDescription = true;
    if (/name=["']twitter:image["']/i.test(content)) twitterCard.hasImage = true;

    const ldMatches = content.matchAll(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const scriptTag of ldMatches) {
      jsonLdCount++;
      const fullMatch = scriptTag[0];
      const jsonMatch = fullMatch.match(/type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (jsonMatch) {
        const lineNum = fullMatch.substring(0, fullMatch.indexOf(jsonMatch[1])).split(/\r?\n/).length;
        try {
          JSON.parse(jsonMatch[1].trim());
        } catch {
          hasJsonLdParseErrors = true;
          jsonLdErrors.push({ file: rel, line: lineNum, detail: "Invalid JSON-LD syntax" });
        }
      }
    }

    const h1Matches = content.match(/<h1[\s>]/gi);
    if (h1Matches) {
      h1Count += h1Matches.length;
      if (h1Matches.length > 1) hasMultipleH1 = true;
    }

    for (let i = 1; i <= 6; i++) {
      const re = new RegExp(`<h${i}[\\s>]`, "gi");
      const matches = content.match(re);
      if (matches) (headings as any)[`h${i}`] += matches.length;
    }

    for (const tag of SEMANTIC_TAGS) {
      const re = new RegExp(`<${tag}[\\s>]`, "gi");
      if (re.test(content)) semanticElements.add(tag);
    }

    const imgMatches = content.matchAll(/<img[\s>][^>]*>/gi);
    for (const img of imgMatches) {
      totalImages++;
      const lineNum = content.substring(0, img.index!).split(/\r?\n/).length;
      const hasAlt = /\salt\s*=\s*["']/i.test(img[0]) || /\salt\s*=\s*\{/i.test(img[0]);
      if (!hasAlt) {
        imagesWithoutAlt.push({ file: rel, line: lineNum, detail: img[0].slice(0, 80) });
      }
      if (/loading\s*=\s*["']lazy["']/i.test(img[0])) lazyLoadedImages++;
      const hasWidth = /\bwidth\s*=\s*["']?\d+["']?\s/i.test(img[0]) || /width:\s*\d+/i.test(img[0]);
      const hasHeight = /\bheight\s*=\s*["']?\d+["']?\s/i.test(img[0]) || /height:\s*\d+/i.test(img[0]);
      if (hasWidth && hasHeight) imagesWithDimension++;
    }

    const striped = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    wordCount += striped.split(/\s+/).filter(Boolean).length;

    const linkMatches = content.matchAll(/<a[\s>][^>]*href=["']([^"']*)["']/gi);
    for (const link of linkMatches) {
      const href = link[1];
      const lineNum = content.substring(0, link.index!).split(/\r?\n/).length;
      if (/^https?:\/\//i.test(href)) {
        externalLinks++;
        const fullTag = content.slice(link.index!, link.index! + link[0].length + 200).split(">")[0];
        if (!/rel=["'][^"']*noopener[^"']*["']/i.test(fullTag)) {
          linksWithoutNoopener.push({ file: rel, line: lineNum, detail: href.slice(0, 80) });
        }
      } else if (href.startsWith("/") || href.startsWith("#")) {
        internalLinks++;
      }
      if (href === "#" || href.startsWith("#") && href.length > 1 && !/^#[a-z]/i.test(href)) {
        hashLinks.push({ file: rel, line: lineNum, detail: href });
      }
    }

    if (/\.html?$/i.test(file)) {
      const headContent = content.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
      if (headContent) {
        const head = headContent[1];
        const headBlock = headContent[0];
        const scriptTags = head.matchAll(/<script[\s>][^>]*src=["']/gi);
        for (const st of scriptTags) {
          const tag = head.slice(st.index!, st.index! + 500).split(">")[0];
          if (!/defer/i.test(tag) && !/async/i.test(tag)) {
            const lineNum = headBlock.substring(0, st.index! + headContent.index!).split(/\r?\n/).length;
            const srcMatch = tag.match(/src=["']([^"']+)["']/i);
            blockingScriptFiles.push({ file: rel, line: lineNum, detail: srcMatch ? srcMatch[1] : "inline" });
          }
        }
        const cssLinks = head.matchAll(/<link[\s>][^>]*rel=["']stylesheet["'][^>]*>/gi);
        for (const cl of cssLinks) {
          const lineNum = headBlock.substring(0, cl.index! + headContent.index!).split(/\r?\n/).length;
          const hrefMatch = cl[0].match(/href=["']([^"']+)["']/i);
          blockingCssFiles.push({ file: rel, line: lineNum, detail: hrefMatch ? hrefMatch[1] : "unknown" });
        }
      }
    }

    const preloads = content.match(/rel=["']preload["']/gi);
    if (preloads) preloadHints += preloads.length;

    const preconnects = content.match(/rel=["']preconnect["']/gi);
    if (preconnects) preconnectHints += preconnects.length;
  }

  meta.hasRobotsTxt = fs.existsSync(path.join(projectRoot, "robots.txt"));
  meta.hasSitemapXml = fs.existsSync(path.join(projectRoot, "sitemap.xml"));

  const headingLevels = [headings.h1, headings.h2, headings.h3, headings.h4, headings.h5, headings.h6];
  let highestFound = -1;
  let hasHeadingGaps = false;
  for (let i = 0; i < headingLevels.length; i++) {
    if (headingLevels[i] > 0) {
      if (highestFound >= 0 && i > highestFound + 1) hasHeadingGaps = true;
      if (highestFound < 0) highestFound = i;
    }
  }

  const recommendations: string[] = [];
  const hasAnyHtml = htmlFiles.length > 0 || tsxFiles.length > 0;

  if (!meta.hasCharset && hasAnyHtml) recommendations.push(`Add <meta charset="utf-8"> to <head> — checked ${componentFiles.length} file(s)`);
  if (meta.viewportQuality === "missing" && hasAnyHtml) recommendations.push(`Add <meta name="viewport" content="width=device-width, initial-scale=1"> — checked ${componentFiles.length} file(s)`);
  if (meta.viewportQuality === "poor") recommendations.push("Fix viewport meta tag — must include width=device-width and initial-scale=1");
  if (!meta.hasDescription && hasAnyHtml) recommendations.push("Add <meta name=\"description\"> with a concise page summary");
  if (!meta.hasThemeColor && hasAnyHtml) recommendations.push("Add <meta name=\"theme-color\"> for browser chrome theming");
  if (!meta.hasLang && hasAnyHtml) recommendations.push("Set lang attribute on <html> (e.g. <html lang=\"en\">)");
  if (!meta.hasCanonical && hasAnyHtml) recommendations.push("Add <link rel=\"canonical\"> to prevent duplicate content issues");
  if (!meta.hasFavicon && hasAnyHtml) recommendations.push("Add a favicon via <link rel=\"icon\">");
  if (!meta.hasRobotsTxt) recommendations.push("Create robots.txt to control crawler access");
  if (!meta.hasSitemapXml) recommendations.push("Create sitemap.xml for better search engine indexing");
  if (!meta.hasKeywords && hasAnyHtml) recommendations.push("Add <meta name=\"keywords\"> with relevant keywords");
  if (!meta.hasAuthor && hasAnyHtml) recommendations.push("Add <meta name=\"author\"> for authorship attribution");
  if (!meta.hasHreflang && hasAnyHtml) recommendations.push("Add <link rel=\"alternate\" hreflang=\"...\"> for multilingual content");
  if (!meta.hasRobotsMeta && hasAnyHtml) recommendations.push("Add <meta name=\"robots\"> to control crawler indexing behavior");

  const ogCount = [openGraph.hasTitle, openGraph.hasDescription, openGraph.hasImage, openGraph.hasUrl, openGraph.hasType].filter(Boolean).length;
  if (ogCount < 3 && hasAnyHtml) recommendations.push("Add Open Graph meta tags (og:title, og:description, og:image) for social sharing");

  const twCount = [twitterCard.hasCard, twitterCard.hasTitle, twitterCard.hasDescription, twitterCard.hasImage].filter(Boolean).length;
  if (twCount < 2 && hasAnyHtml) recommendations.push("Add Twitter Card meta tags for rich tweet previews");

  if (jsonLdCount === 0 && hasAnyHtml) recommendations.push("Add structured data (JSON-LD) for rich search results");
  if (hasJsonLdParseErrors) {
    const errFiles = jsonLdErrors.slice(0, 3).map(e => `${e.file}:${e.line}`).join(", ");
    recommendations.push(`Fix JSON-LD parse errors in ${jsonLdErrors.length} block(s) — ${errFiles}${jsonLdErrors.length > 3 ? ` +${jsonLdErrors.length - 3} more` : ""}`);
  }
  if (h1Count === 0 && hasAnyHtml) recommendations.push("Each page should have exactly one <h1>");
  if (hasMultipleH1) recommendations.push("Avoid multiple <h1> on the same page — use one per page");
  if (hasHeadingGaps) recommendations.push("Fix heading level gaps (e.g. h1→h3 without h2) for proper document outline");
  if (semanticElements.size < 3 && hasAnyHtml) recommendations.push("Use semantic HTML elements (<header>, <nav>, <main>, <article>, <footer>)");
  if (imagesWithoutAlt.length > 0) {
    const top = imagesWithoutAlt.slice(0, 3).map(d => `${d.file}:${d.line}`).join(", ");
    recommendations.push(`Add alt text to ${imagesWithoutAlt.length} image(s) — e.g. ${top}${imagesWithoutAlt.length > 3 ? ` +${imagesWithoutAlt.length - 3} more` : ""}`);
  }
  if (totalImages > 0 && totalImages > imagesWithDimension) {
    recommendations.push(`Add width/height to ${totalImages - imagesWithDimension} image(s) to prevent CLS`);
  }
  if (totalImages > 0 && lazyLoadedImages < totalImages) recommendations.push("Add loading=\"lazy\" to below-the-fold images");
  if (linksWithoutNoopener.length > 0) {
    const top = linksWithoutNoopener.slice(0, 3).map(d => `${d.file}:${d.line}`).join(", ");
    recommendations.push(`Add rel="noopener noreferrer" to ${linksWithoutNoopener.length} external link(s) — e.g. ${top}${linksWithoutNoopener.length > 3 ? ` +${linksWithoutNoopener.length - 3} more` : ""}`);
  }
  if (hashLinks.length > 0) {
    const top = hashLinks.slice(0, 3).map(d => `${d.file}:${d.line}`).join(", ");
    recommendations.push(`Avoid empty hash links (#) in ${hashLinks.length} place(s) — e.g. ${top}${hashLinks.length > 3 ? ` +${hashLinks.length - 3} more` : ""}`);
  }
  if (preloadHints === 0 && hasAnyHtml) recommendations.push("Use <link rel=\"preload\"> for critical resources (fonts, hero images)");
  if (preconnectHints === 0 && hasAnyHtml) recommendations.push("Use <link rel=\"preconnect\"> for third-party origins");
  if (blockingScriptFiles.length > 0) {
    const top = blockingScriptFiles.slice(0, 3).map(d => `${d.file}:${d.line} (${d.detail})`).join(", ");
    recommendations.push(`Defer ${blockingScriptFiles.length} render-blocking script(s) — e.g. ${top}${blockingScriptFiles.length > 3 ? ` +${blockingScriptFiles.length - 3} more` : ""}`);
  }
  if (blockingCssFiles.length > 0) {
    const top = blockingCssFiles.slice(0, 3).map(d => `${d.file}:${d.line} (${d.detail})`).join(", ");
    recommendations.push(`Inline critical CSS for ${blockingCssFiles.length} stylesheet(s) — e.g. ${top}${blockingCssFiles.length > 3 ? ` +${blockingCssFiles.length - 3} more` : ""}`);
  }

  const passedChecks = [
    meta.hasCharset, meta.hasViewport, meta.hasDescription, meta.hasThemeColor,
    meta.hasLang, meta.hasCanonical, meta.hasFavicon, meta.hasRobotsTxt, meta.hasSitemapXml,
    meta.hasKeywords, meta.hasAuthor, meta.hasHreflang, meta.hasRobotsMeta,
    meta.viewportQuality === "good",
    ogCount >= 3, twCount >= 2, jsonLdCount > 0, !hasJsonLdParseErrors,
    h1Count > 0 && !hasMultipleH1, !hasHeadingGaps,
    semanticElements.size >= 3,
    totalImages === 0 || imagesWithoutAlt.length === 0,
    totalImages === 0 || imagesWithDimension === totalImages,
    linksWithoutNoopener.length === 0, hashLinks.length === 0,
    preloadHints > 0, preconnectHints > 0,
    blockingScriptFiles.length === 0, blockingCssFiles.length === 0
  ].filter(Boolean).length;

  const totalChecks = 25;
  const score = hasAnyHtml ? Math.round((passedChecks / totalChecks) * 100) : 0;

  return {
    score,
    meta,
    openGraph,
    twitterCard,
    structuredData: { jsonLdCount, hasJsonLdParseErrors, jsonLdErrors },
    content: {
      h1Count,
      hasMultipleH1,
      semanticElements: [...semanticElements].sort(),
      totalImages,
      lazyLoadedImages,
      imagesWithDimension,
      imagesWithoutAlt,
      headings,
      hasHeadingGaps,
      wordCount,
    },
    links: {
      externalLinks,
      internalLinks,
      linksWithoutNoopener,
      hashLinks,
    },
    performance: {
      preloadHints,
      preconnectHints,
      renderBlockingScripts: blockingScriptFiles.length,
      renderBlockingCss: blockingCssFiles.length,
      blockingScriptFiles,
      blockingCssFiles,
    },
    recommendations,
  };
}
