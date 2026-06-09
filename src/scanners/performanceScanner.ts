import fs from "fs";
import path from "path";
import { walk, readFileSafe, FileDetail } from "./scannerUtils";

export interface PerformanceReport {
  imageStats: {
    totalImages: number;
    totalSizeKb: number;
    oversized: { file: string; sizeKb: number; maxRecommended: number }[];
    withoutDimensions: FileDetail[];
    withoutLazy: FileDetail[];
  };
  bundleHints: {
    heavyImports: { name: string; line: string }[];
    missingCodeSplitting: boolean;
    missingCodeSplittingFiles: string[];
  };
  renderBlocking: {
    scriptsInHead: number;
    stylesheetsInHead: number;
    scriptsWithDefer: number;
    scriptsWithAsync: number;
    blockingScriptFiles: FileDetail[];
    blockingCssFiles: FileDetail[];
  };
  resourceHints: {
    preconnect: number;
    preload: number;
    prefetch: number;
  };
  caching: {
    hasServiceWorker: boolean;
    hasCachePolicy: boolean;
  };
  recommendations: string[];
  score: number;
}

export async function scanPerformance(projectRoot: string): Promise<PerformanceReport> {
  const imageFiles = walk(projectRoot, new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]));
  const htmlFiles = walk(projectRoot, new Set([".html", ".htm"]));
  const scriptFiles = walk(projectRoot, new Set([".js", ".jsx", ".ts", ".tsx"]));

  let totalImages = 0;
  let totalSizeKb = 0;
  const oversized: { file: string; sizeKb: number; maxRecommended: number }[] = [];
  const withoutDimensions: FileDetail[] = [];
  const withoutLazy: FileDetail[] = [];

  for (const imgFile of imageFiles) {
    try {
      const stat = fs.statSync(imgFile);
      const sizeKb = stat.size / 1024;
      totalSizeKb += sizeKb;
      totalImages++;
      if (sizeKb > 200) {
        oversized.push({
          file: path.relative(projectRoot, imgFile),
          sizeKb: Math.round(sizeKb * 10) / 10,
          maxRecommended: 200,
        });
      }
    } catch {
      // permission denied
    }
  }

  const imgTagRe = /<img[\s>][^>]*>/gi;
  for (const file of [...htmlFiles, ...scriptFiles]) {
    const content = readFileSafe(file);
    if (!content) continue;
    const rel = path.relative(projectRoot, file);

    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const tagMatch = lines[i].match(imgTagRe);
      if (!tagMatch) continue;
      for (const tag of tagMatch) {
        const hasWidth = /\bwidth\s*=\s*["']?\d+["']?/i.test(tag);
        const hasHeight = /\bheight\s*=\s*["']?\d+["']?/i.test(tag);
        if (!hasWidth || !hasHeight) {
          withoutDimensions.push({ file: rel, line: i + 1, detail: tag.slice(0, 80) });
        }
        if (!/loading\s*=\s*["']lazy["']/i.test(tag)) {
          withoutLazy.push({ file: rel, line: i + 1, detail: tag.slice(0, 80) });
        }
      }
    }
  }

  const heavyImports: { name: string; line: string }[] = [];
  const heavyPatterns: { name: string; pattern: RegExp }[] = [
    { name: "lodash", pattern: /import\s+\*\s+as\s+_\s+from\s+['"]lodash['"]/ },
    { name: "moment", pattern: /import\s+moment\s+from\s+['"]moment['"]/ },
    { name: "d3", pattern: /import\s+\*\s+as\s+d3\s+from\s+['"]d3['"]/ },
    { name: "rxjs", pattern: /from\s+['"]rxjs['"]/ },
    { name: "three", pattern: /import\s+\*\s+as\s+THREE\s+from\s+['"]three['"]/ },
  ];

  let dynamicImportCount = 0;
  const missingCodeSplittingFiles: string[] = [];

  for (const file of scriptFiles) {
    const content = readFileSafe(file);
    if (!content) continue;

    for (const hp of heavyPatterns) {
      const match = content.match(hp.pattern);
      if (match) {
        const lines = content.split(/\r?\n/);
        const lineNum = lines.findIndex(l => hp.pattern.test(l)) + 1;
        heavyImports.push({ name: hp.name, line: `${path.relative(projectRoot, file)}:${lineNum}` });
      }
    }

    const dynMatches = content.match(/import\s*\(/g);
    if (dynMatches) dynamicImportCount += dynMatches.length;
  }

  const dedupedHeavy = heavyImports.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);

  const seenScripts = new Set<string>();

  let scriptsInHead = 0;
  let stylesheetsInHead = 0;
  let scriptsWithDefer = 0;
  let scriptsWithAsync = 0;
  let preconnect = 0;
  let preload = 0;
  let prefetch = 0;
  const blockingScriptFiles: FileDetail[] = [];
  const blockingCssFiles: FileDetail[] = [];

  for (const file of htmlFiles) {
    const content = readFileSafe(file);
    if (!content) continue;
    const rel = path.relative(projectRoot, file);

    const headMatch = content.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    if (headMatch) {
      const head = headMatch[1];
      const headContent = headMatch[0];

      const scriptTags = head.matchAll(/<script[\s>][^>]*>/gi);
      for (const st of scriptTags) {
        const tag = st[0];
        if (/src=/i.test(tag)) {
          const srcMatch = tag.match(/src=["']([^"']+)["']/i);
          const src = srcMatch ? srcMatch[1] : "inline";
          const key = `${rel}:${src}`;
          if (seenScripts.has(key)) continue;
          seenScripts.add(key);

          if (/defer/i.test(tag)) {
            scriptsWithDefer++;
          } else if (/async/i.test(tag)) {
            scriptsWithAsync++;
          } else {
            scriptsInHead++;
            const lineNum = headContent.substring(0, st.index!).split(/\r?\n/).length;
            blockingScriptFiles.push({ file: rel, line: lineNum, detail: src });
          }
        }
      }

      let cssLineOffset = 0;
      const cssLinks = head.matchAll(/<link[\s>][^>]*rel=["']stylesheet["'][^>]*>/gi);
      for (const cl of cssLinks) {
        stylesheetsInHead++;
        const hrefMatch = cl[0].match(/href=["']([^"']+)["']/i);
        const href = hrefMatch ? hrefMatch[1] : "unknown";
        const cssLineNum = headContent.substring(0, cl.index!).split(/\r?\n/).length;
        blockingCssFiles.push({ file: rel, line: cssLineNum, detail: href });
        cssLineOffset++;
      }
    }

    const linkTags = content.matchAll(/<link[\s>][^>]*>/gi);
    for (const lt of linkTags) {
      const tag = lt[0];
      if (/rel=["']preconnect["']/i.test(tag)) preconnect++;
      if (/rel=["']preload["']/i.test(tag)) preload++;
      if (/rel=["']prefetch["']/i.test(tag)) prefetch++;
    }
  }

  if (dynamicImportCount < 2) {
    const noDynImports = scriptFiles.filter(f => {
      const content = readFileSafe(f);
      return content && !content.includes("import(");
    });
    missingCodeSplittingFiles.push(...noDynImports.map(f => path.relative(projectRoot, f)).slice(0, 15));
  }

  const hasServiceWorker = fs.existsSync(path.join(projectRoot, "service-worker.js")) || fs.existsSync(path.join(projectRoot, "sw.js"));
  const hasCachePolicy = fs.existsSync(path.join(projectRoot, ".htaccess"))
    || fs.existsSync(path.join(projectRoot, "_headers"))
    || fs.existsSync(path.join(projectRoot, "netlify.toml"))
    || fs.existsSync(path.join(projectRoot, "vercel.json"));

  const recommendations: string[] = [];
  let deductions = 0;

  if (withoutDimensions.length > 0) {
    const top = withoutDimensions.slice(0, 3).map(d => `${d.file}:${d.line}`).join(", ");
    recommendations.push(`Add width/height to ${withoutDimensions.length} image(s) — e.g. ${top}${withoutDimensions.length > 3 ? ` +${withoutDimensions.length - 3} more` : ""}`);
    deductions += Math.ceil(withoutDimensions.length / 5);
  }
  if (withoutLazy.length > 0) {
    const top = withoutLazy.slice(0, 3).map(d => `${d.file}:${d.line}`).join(", ");
    recommendations.push(`Add loading="lazy" to ${withoutLazy.length} image(s) — e.g. ${top}${withoutLazy.length > 3 ? ` +${withoutLazy.length - 3} more` : ""}`);
    deductions += Math.ceil(withoutLazy.length / 5);
  }
  if (oversized.length > 0) {
    recommendations.push(`Optimize ${oversized.length} oversized image(s) (total: ${Math.round(oversized.reduce((s, o) => s + o.sizeKb, 0))} KB) — compress or use WebP/AVIF`);
    deductions += oversized.length;
  }
  if (dedupedHeavy.length > 0) {
    const details = dedupedHeavy.map(h => `${h.name} (${h.line})`).join("; ");
    recommendations.push(`Replace heavy imports with tree-shakeable alternatives: ${details}`);
    deductions += dedupedHeavy.length * 2;
  }
  if (dynamicImportCount < 2) {
    recommendations.push(`Missing code splitting — only ${dynamicImportCount} dynamic import(s) found. Use React.lazy() or dynamic import() for route-level chunks`);
    deductions += 5;
  }
  if (blockingScriptFiles.length > 0) {
    const top = blockingScriptFiles.slice(0, 3).map(d => `${d.file}:${d.line} (${d.detail})`).join(", ");
    recommendations.push(`Defer ${blockingScriptFiles.length} render-blocking script(s) — e.g. ${top}${blockingScriptFiles.length > 3 ? ` +${blockingScriptFiles.length - 3} more` : ""}`);
    deductions += blockingScriptFiles.length;
  }
  if (blockingCssFiles.length > 0) {
    const top = blockingCssFiles.slice(0, 3).map(d => `${d.file}:${d.line} (${d.detail})`).join(", ");
    recommendations.push(`Inline critical CSS for ${blockingCssFiles.length} stylesheet(s) — e.g. ${top}${blockingCssFiles.length > 3 ? ` +${blockingCssFiles.length - 3} more` : ""}`);
    deductions += Math.ceil(blockingCssFiles.length / 2);
  }
  if (preconnect === 0 && preload === 0 && prefetch === 0) {
    recommendations.push("Use resource hints (preconnect, preload, prefetch) to optimize resource delivery");
    deductions += 3;
  }
  if (!hasServiceWorker) {
    recommendations.push("Add a service worker for offline support and cache-first strategies");
    deductions += 5;
  }
  if (!hasCachePolicy) {
    recommendations.push("Set cache-control headers via .htaccess, _headers, or platform config for static assets");
    deductions += 3;
  }

  const score = Math.max(0, 100 - deductions);

  return {
    imageStats: {
      totalImages,
      withoutDimensions,
      withoutLazy,
      totalSizeKb: Math.round(totalSizeKb * 10) / 10,
      oversized,
    },
    bundleHints: {
      heavyImports: dedupedHeavy,
      missingCodeSplitting: dynamicImportCount < 2,
      missingCodeSplittingFiles,
    },
    renderBlocking: {
      scriptsInHead,
      stylesheetsInHead,
      scriptsWithDefer,
      scriptsWithAsync,
      blockingScriptFiles,
      blockingCssFiles,
    },
    resourceHints: {
      preconnect,
      preload,
      prefetch,
    },
    caching: {
      hasServiceWorker,
      hasCachePolicy,
    },
    recommendations,
    score,
  };
}
