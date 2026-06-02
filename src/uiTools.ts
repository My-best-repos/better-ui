import fs from "fs";
import path from "path";

export interface UIAuditReport {
  totalFiles: number;
  htmlCount: number;
  cssCount: number;
  jsxTsxCount: number;
  imageCount: number;
  fontCount: number;
  hasViewportMeta: boolean;
  hasThemeColorMeta: boolean;
  cssMethodology: string[];
  semanticElements: string[];
  hasInlineStyles: boolean;
  allBreakpoints: string[];
  hasFontLoading: boolean;
  uiScore: number;
}

export interface ColorEntry {
  value: string;
  count: number;
  files: string[];
}

export interface ColorReport {
  totalUnique: number;
  totalDeclarations: number;
  allColors: ColorEntry[];
  tailwindColors: number;
  cssCustomProperties: number;
  hasColorInconsistencies: boolean;
}

export interface StandardsReport {
  totalComponentFiles: number;
  pascalCaseFiles: number;
  kebabCaseFiles: number;
  defaultExports: number;
  namedExports: number;
  hasPropsInterface: boolean;
  hasIndexFiles: number;
  avgLinesPerComponent: number;
  largeFiles: string[];
  organizationType: "flat" | "feature-folders" | "mixed" | "unknown";
}

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico"]);
const FONT_EXTS = new Set([".woff", ".woff2", ".ttf", ".otf", ".eot"]);
const COMPONENT_EXTS = new Set([".jsx", ".tsx"]);
const CSS_EXTS = new Set([".css", ".scss", ".less", ".sass"]);

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "build", ".next", ".cache", "coverage"]);

function walk(root: string, exts: Set<string>, skipDirs = SKIP_DIRS): string[] {
  const results: string[] = [];
  if (!fs.existsSync(root)) return results;
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(root, e.name);
      if (e.isDirectory()) {
        if (!skipDirs.has(e.name)) results.push(...walk(full, exts, skipDirs));
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (exts.size === 0 || exts.has(ext)) results.push(full);
      }
    }
  } catch {
    // permission denied, skip
  }
  return results;
}

function readFileSafe(filePath: string): string | null {
  try {
    if (fs.statSync(filePath).size > 500_000) return null;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

const SEMANTIC_ELEMENTS = ["header", "nav", "main", "article", "section", "aside", "footer", "figure", "figcaption", "time", "mark"];
const TAILWIND_PATTERN = /className=["'`][^"'`]*(?:text|bg|border|ring|shadow|outline|ring-offset|from|via|to|divide|placeholder|space|translate|rotate|scale|skew|origin|transition|duration|ease|delay|animate|font|tracking|leading|whitespace|break|truncate|underline|line-clamp|prose|container|grid|flex|col|row|gap|p|m|h|w|min|max|inset|top|right|bottom|left|z|order|float|clear|display|overflow|overscroll|visibility|opacity|mix-blend|bg-blend|box|object|isolation|appearance|pointer|cursor|resize|select|snap|scroll|touch|user|fill|stroke)[a-z-]+[ "'`]/;

export async function auditUI(projectRoot: string): Promise<UIAuditReport> {
  const htmlFiles = walk(projectRoot, new Set([".html", ".htm"]));
  const cssFiles = walk(projectRoot, CSS_EXTS);
  const componentFiles = walk(projectRoot, COMPONENT_EXTS);
  const imageFiles = walk(projectRoot, IMAGE_EXTS);
  const fontFiles = walk(projectRoot, FONT_EXTS);
  const allFiles = [...htmlFiles, ...cssFiles, ...componentFiles, ...imageFiles, ...fontFiles];

  let hasViewportMeta = false;
  let hasThemeColorMeta = false;
  let hasFontLoading = false;
  let hasInlineStyles = false;
  const semanticFound = new Set<string>();
  const allBreakpoints = new Set<string>();
  const methods = new Set<string>();

  for (const html of htmlFiles) {
    const content = readFileSafe(html);
    if (!content) continue;
    if (/name=["']viewport["']/i.test(content)) hasViewportMeta = true;
    if (/name=["']theme-color["']/i.test(content)) hasThemeColorMeta = true;
    if (/(?:https:)?\/\/fonts\.googleapis\.com/i.test(content)) hasFontLoading = true;
    const bpMatches = content.matchAll(/@media\s*\([^)]*(?:min|max)-width\s*:\s*(\d+)\s*px\)/gi);
    for (const m of bpMatches) allBreakpoints.add(`${m[1]}px`);
  }

  for (const css of cssFiles) {
    const content = readFileSafe(css);
    if (!content) continue;
    const bpMatches = content.matchAll(/@media\s*\([^)]*(?:min|max)-width\s*:\s*(\d+)\s*px\)/gi);
    for (const m of bpMatches) allBreakpoints.add(`${m[1]}px`);
    if (/@import\s+['"](?:tailwind|@tailwind)/i.test(content)) methods.add("PostCSS / Tailwind (direct)");
    if (/\.module\.(css|scss|sass|less)/i.test(css)) methods.add("CSS Modules");
    if (/font-face\s*\{/i.test(content)) hasFontLoading = true;
    if (/style\s*=\s*["']/i.test(content)) hasInlineStyles = true;
  }

  for (const comp of componentFiles) {
    const content = readFileSafe(comp);
    if (!content) continue;
    if (/style\s*=\s*\{[^}]*\}/i.test(content) || /style\s*=\s*["']/i.test(content)) hasInlineStyles = true;
    if (TAILWIND_PATTERN.test(content)) methods.add("Tailwind CSS");
    if (/import\s+.*\bstyled\b/i.test(content) || /from\s+['"]styled-components['"]/i.test(content) || /from\s+['"]@emotion/i.test(content)) methods.add("CSS-in-JS (styled)");
    if (/from\s+['"].*\.module\.(css|scss|sass)['"]/i.test(content)) methods.add("CSS Modules");
    for (const el of SEMANTIC_ELEMENTS) {
      if (new RegExp(`<${el}[\\s>]`, "i").test(content)) semanticFound.add(el);
    }
    if (/<[A-Z][a-zA-Z]*\s+[^>]*fontFamily/i.test(content)) hasFontLoading = true;
    if (hasFontLoading) continue;
  }

  const bpArray = [...allBreakpoints].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  const semanticArray = [...semanticFound].sort();

  if (methods.size === 0 && cssFiles.length > 0) methods.add("Plain CSS");
  if (methods.size === 0 && componentFiles.length > 0) methods.add("None detected");
  if (methods.size === 0 && cssFiles.length === 0 && componentFiles.length === 0) methods.add("No UI files to analyze");

  let score = 100;
  if (!hasViewportMeta && htmlFiles.length > 0) score -= 15;
  if (hasInlineStyles) score -= 10;
  if (!semanticFound.size && componentFiles.length > 5) score -= 10;
  if (!hasFontLoading && (fontFiles.length > 0 || htmlFiles.length > 0)) score -= 5;
  if (!hasThemeColorMeta && htmlFiles.length > 0) score -= 5;
  if (bpArray.length === 0 && cssFiles.length > 0) score -= 5;
  if (htmlFiles.length === 0 && componentFiles.length === 0) score = 0;

  return {
    totalFiles: allFiles.length,
    htmlCount: htmlFiles.length,
    cssCount: cssFiles.length,
    jsxTsxCount: componentFiles.length,
    imageCount: imageFiles.length,
    fontCount: fontFiles.length,
    hasViewportMeta,
    hasThemeColorMeta,
    cssMethodology: [...methods],
    semanticElements: semanticArray,
    hasInlineStyles,
    allBreakpoints: bpArray,
    hasFontLoading,
    uiScore: Math.max(0, score)
  };
}

const HEX_COLOR = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const RGB_COLOR = /rgba?\s*\([^)]+\)/gi;
const HSL_COLOR = /hsla?\s*\([^)]+\)/gi;
const TAILWIND_COLOR_CLASS = /className=["'`][^"'`]*(?:text|bg|border|outline|ring|from|via|to|divide|placeholder|shadow-accent|ring-offset)-(?:[a-z]+)-(?:50|100|200|300|400|500|600|700|800|900|950)\b[^"'`]*["'`]/g;

export async function scanColors(projectRoot: string): Promise<ColorReport> {
  const cssFiles = walk(projectRoot, CSS_EXTS);
  const componentFiles = walk(projectRoot, COMPONENT_EXTS);
  const jsFiles = walk(projectRoot, new Set([".js", ".jsx", ".ts", ".tsx"]));
  const relevantFiles = [...cssFiles, ...componentFiles, ...jsFiles];

  const colorMap = new Map<string, { count: number; files: Set<string> }>();
  let tailwindColorCount = 0;
  const cssCustomProps = new Set<string>();
  let hasInconsistencies = false;

  const closeVariants = new Map<string, string[]>();
  const addColor = (value: string, file: string) => {
    const key = value.toLowerCase().trim();
    const entry = colorMap.get(key) || { count: 0, files: new Set() };
    entry.count++;
    entry.files.add(file);
    colorMap.set(key, entry);
  };

  for (const file of relevantFiles) {
    const content = readFileSafe(file);
    if (!content) continue;
    const rel = path.relative(projectRoot, file).replace(/\\/g, "/");

    if (CSS_EXTS.has(path.extname(file).toLowerCase())) {
      const propMatches = content.matchAll(/--[a-zA-Z][\w-]*\s*:\s*(#[0-9a-fA-F]+|rgba?\([^)]+\)|hsla?\([^)]+\))/g);
      for (const m of propMatches) cssCustomProps.add(m[1]);
    }

    const hexes = content.matchAll(HEX_COLOR);
    for (const m of hexes) {
      const val = m[0].toLowerCase();
      if (val === "#000" || val === "#fff" || val === "#ffffff" || val === "#000000") continue;
      addColor(val, rel);
    }

    const rgbs = content.matchAll(RGB_COLOR);
    for (const m of rgbs) addColor(m[0].toLowerCase(), rel);

    const hsls = content.matchAll(HSL_COLOR);
    for (const m of hsls) addColor(m[0].toLowerCase(), rel);

    const tailwinds = content.matchAll(TAILWIND_COLOR_CLASS);
    for (const _ of tailwinds) tailwindColorCount++;
  }

  const allColors = [...colorMap.entries()]
    .map(([value, data]) => ({ value, count: data.count, files: [...data.files] }))
    .sort((a, b) => b.count - a.count);

  if (allColors.length > 0) {
    const groups = new Map<string, string[]>();
    for (const c of allColors) {
      const rgbMatch = c.value.match(/^#([0-9a-f]{6})$/i);
      if (rgbMatch) {
        const normalized = rgbMatch[1];
        const r = parseInt(normalized.slice(0, 2), 16);
        const g = parseInt(normalized.slice(2, 4), 16);
        const b = parseInt(normalized.slice(4, 6), 16);
        const bucket = `${Math.floor(r / 32) * 32},${Math.floor(g / 32) * 32},${Math.floor(b / 32) * 32}`;
        const existing = groups.get(bucket) || [];
        existing.push(c.value);
        groups.set(bucket, existing);
      }
    }
    for (const [, group] of groups) {
      if (group.length > 1) {
        hasInconsistencies = true;
        break;
      }
    }
  }

  return {
    totalUnique: allColors.length,
    totalDeclarations: allColors.reduce((s, c) => s + c.count, 0),
    allColors,
    tailwindColors: tailwindColorCount,
    cssCustomProperties: cssCustomProps.size,
    hasColorInconsistencies: hasInconsistencies
  };
}

export interface TypographyReport {
  totalFontDeclarations: number;
  uniqueFontFamilies: string[];
  fontSizes: { value: string; count: number }[];
  lineHeights: { value: string; count: number }[];
  fontWeights: { value: string; count: number }[];
  letterSpacing: { value: string; count: number }[];
  textTransform: { value: string; count: number }[];
  textDecoration: { value: string; count: number }[];
  customFonts: string[];
  missingLineHeight: number;
  tailwindTypographyCount: number;
  inlineTypographyCount: number;
  filesWithTypography: number;
  recommendations: string[];
}

export interface SpacingReport {
  totalSpacingDeclarations: number;
  marginValues: { value: string; count: number }[];
  paddingValues: { value: string; count: number }[];
  gapValues: { value: string; count: number }[];
  positionValues: { value: string; count: number }[];
  tailwindSpacingCount: number;
  inlineSpacingCount: number;
  filesWithSpacing: number;
  unitInconsistencies: string[];
  filesWithExcessiveUniqueValues: { file: string; uniqueCount: number }[];
  recommendations: string[];
}

const FONT_FAMILY_RE = /font-family\s*:\s*['"]?([^;}'"]+)['"]?/gi;
const FONT_SIZE_RE = /font-size\s*:\s*([^;}'"]+)/gi;
const LINE_HEIGHT_RE = /line-height\s*:\s*([^;}'"]+)/gi;
const FONT_WEIGHT_RE = /font-weight\s*:\s*([^;}'"]+)/gi;
const FONT_FACE_RE = /@font-face\s*\{([^}]+)\}/gi;
const MARGIN_RE = /margin\s*:\s*([^;}'"]+)/gi;
const MARGIN_LONG_RE = /margin-(?:top|right|bottom|left|inline|block)\s*:\s*([^;}'"]+)/gi;
const PADDING_RE = /padding\s*:\s*([^;}'"]+)/gi;
const PADDING_LONG_RE = /padding-(?:top|right|bottom|left|inline|block)\s*:\s*([^;}'"]+)/gi;
const GAP_RE = /gap\s*:\s*([^;}'"]+)/gi;
const POSITION_RE = /(?<=^|[;{])\s*(?:top|right|bottom|left)\s*:\s*([^;}'"]+)/gmi;
const INSET_RE = /inset\s*:\s*([^;}'"]+)/gi;
const TAILWIND_SPACING_RE = /className=["'`][^"'`]*\b([mpg](?:[trblxy]|s|e)?-[\w./]+)\b[^"'`]*["'`]/g;
const LETTER_SPACING_RE = /letter-spacing\s*:\s*([^;}'"]+)/gi;
const TEXT_TRANSFORM_RE = /text-transform\s*:\s*([^;}'"]+)/gi;
const TEXT_DECORATION_RE = /text-decoration\s*:\s*([^;}'"]+)/gi;
const TAILWIND_TYPOGRAPHY_RE = /className=["'`][^"'`]*\b(?:text-|font-|leading-|tracking-)[a-z0-9./]+[^"'`]*["'`]/g;
const INLINE_TYPOGRAPHY_RE = /(?:fontFamily|fontSize|lineHeight|fontWeight|letterSpacing|textTransform|textDecoration)\s*[:=]/gi;

function extractDeclarations(content: string, regex: RegExp): string[] {
  const results: string[] = [];
  const matches = content.matchAll(regex);
  for (const m of matches) {
    results.push(m[1].trim());
  }
  return results;
}

function extractFontFamilies(content: string): string[] {
  const families: string[] = [];
  const matches = content.matchAll(FONT_FAMILY_RE);
  for (const m of matches) {
    const parts = m[1].split(",").map(s => s.trim().replace(/['"]/g, ""));
    for (const p of parts) {
      if (p && !families.includes(p)) families.push(p);
    }
  }
  return families;
}

function extractCustomFonts(content: string): string[] {
  const fonts: string[] = [];
  const matches = content.matchAll(FONT_FACE_RE);
  for (const m of matches) {
    const familyMatch = m[1].match(/font-family\s*:\s*['"]?([^;}'"]+)['"]?/i);
    if (familyMatch) fonts.push(familyMatch[1].trim().replace(/['"]/g, ""));
  }
  return fonts;
}

function countValues(values: string[]): { value: string; count: number }[] {
  const map = new Map<string, number>();
  for (const v of values) {
    const normalized = v.replace(/\s+/g, " ").trim();
    map.set(normalized, (map.get(normalized) || 0) + 1);
  }
  return [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

export async function scanTypography(projectRoot: string): Promise<TypographyReport> {
  const cssFiles = walk(projectRoot, CSS_EXTS);
  const componentFiles = walk(projectRoot, COMPONENT_EXTS);
  const relevantFiles = [...cssFiles, ...componentFiles];

  const allFamilies: string[] = [];
  const allSizes: string[] = [];
  const allLineHeights: string[] = [];
  const allWeights: string[] = [];
  const allLetterSpacings: string[] = [];
  const allTextTransforms: string[] = [];
  const allTextDecorations: string[] = [];
  const customFonts: string[] = [];
  let missingLineHeight = 0;
  let tailwindTypCount = 0;
  let inlineTypCount = 0;
  const filesWithType = new Set<string>();
  const recommendations: string[] = [];

  for (const file of relevantFiles) {
    const content = readFileSafe(file);
    if (!content) continue;
    const rel = path.relative(projectRoot, file).replace(/\\/g, "/");

    const families = extractFontFamilies(content);
    const sizes = extractDeclarations(content, FONT_SIZE_RE);
    const lineHeights = extractDeclarations(content, LINE_HEIGHT_RE);
    const weights = extractDeclarations(content, FONT_WEIGHT_RE);
    const letterSpacings = extractDeclarations(content, LETTER_SPACING_RE);
    const textTransforms = extractDeclarations(content, TEXT_TRANSFORM_RE);
    const textDecorations = extractDeclarations(content, TEXT_DECORATION_RE);
    const custom = extractCustomFonts(content);

    const hasAny = families.length > 0 || sizes.length > 0 || lineHeights.length > 0 || weights.length > 0;
    if (hasAny || letterSpacings.length > 0 || textTransforms.length > 0 || textDecorations.length > 0) {
      filesWithType.add(rel);
    }

    allFamilies.push(...families);
    allSizes.push(...sizes);
    allLineHeights.push(...lineHeights);
    allWeights.push(...weights);
    allLetterSpacings.push(...letterSpacings);
    allTextTransforms.push(...textTransforms);
    allTextDecorations.push(...textDecorations);
    customFonts.push(...custom);

    if (sizes.length > 0 && lineHeights.length === 0) {
      missingLineHeight++;
    }

    const twTypMatches = content.matchAll(TAILWIND_TYPOGRAPHY_RE);
    for (const _ of twTypMatches) tailwindTypCount++;

    const inlineTypMatches = content.matchAll(INLINE_TYPOGRAPHY_RE);
    for (const _ of inlineTypMatches) inlineTypCount++;
  }

  const uniqueFamilies = [...new Set(allFamilies)];
  const uniqueCustom = [...new Set(customFonts)];

  if (missingLineHeight > 0) {
    recommendations.push(`Set explicit line-height on ${missingLineHeight} files that define font-size without line-height`);
  }
  if (allLetterSpacings.length === 0 && uniqueFamilies.length > 0) {
    recommendations.push("No letter-spacing found — consider using tracking utilities for heading hierarchy");
  }
  const pxSizes = allSizes.filter(s => s.endsWith("px"));
  if (pxSizes.length > 0) {
    recommendations.push(`Found ${pxSizes.length} font-size values in px — prefer rem for scalable typography`);
  }
  if (allTextTransforms.length === 0 && uniqueFamilies.length > 0) {
    recommendations.push("No text-transform usage detected — consider uppercase utilities for labels and badges");
  }

  return {
    totalFontDeclarations: allFamilies.length + allSizes.length + allLineHeights.length + allWeights.length + allLetterSpacings.length + allTextTransforms.length + allTextDecorations.length,
    uniqueFontFamilies: uniqueFamilies,
    fontSizes: countValues(allSizes),
    lineHeights: countValues(allLineHeights),
    fontWeights: countValues(allWeights),
    letterSpacing: countValues(allLetterSpacings),
    textTransform: countValues(allTextTransforms),
    textDecoration: countValues(allTextDecorations),
    customFonts: uniqueCustom,
    missingLineHeight,
    tailwindTypographyCount: tailwindTypCount,
    inlineTypographyCount: inlineTypCount,
    filesWithTypography: filesWithType.size,
    recommendations
  };
}

export async function scanSpacing(projectRoot: string): Promise<SpacingReport> {
  const cssFiles = walk(projectRoot, CSS_EXTS);
  const componentFiles = walk(projectRoot, COMPONENT_EXTS);
  const jsFiles = walk(projectRoot, new Set([".js", ".jsx", ".ts", ".tsx"]));
  const relevantFiles = [...cssFiles, ...componentFiles, ...jsFiles];

  const allMargins: string[] = [];
  const allPaddings: string[] = [];
  const allGaps: string[] = [];
  const allPositions: string[] = [];
  let tailwindCount = 0;
  let inlineCount = 0;
  const filesWithSpace = new Set<string>();
  const unitInconsistencies: string[] = [];
  const excessiveUnique: { file: string; uniqueCount: number }[] = [];
  const recommendations: string[] = [];

  for (const file of relevantFiles) {
    const content = readFileSafe(file);
    if (!content) continue;
    const rel = path.relative(projectRoot, file).replace(/\\/g, "/");

    const margins = [
      ...extractDeclarations(content, MARGIN_RE),
      ...extractDeclarations(content, MARGIN_LONG_RE)
    ];
    const paddings = [
      ...extractDeclarations(content, PADDING_RE),
      ...extractDeclarations(content, PADDING_LONG_RE)
    ];
    const gaps = extractDeclarations(content, GAP_RE);
    const positions = [
      ...extractDeclarations(content, POSITION_RE),
      ...extractDeclarations(content, INSET_RE)
    ];

    if (margins.length > 0 || paddings.length > 0 || gaps.length > 0 || positions.length > 0) {
      filesWithSpace.add(rel);
    }

    allMargins.push(...margins);
    allPaddings.push(...paddings);
    allGaps.push(...gaps);
    allPositions.push(...positions);

    const spaceVals = [...margins, ...paddings, ...gaps];
    const uniqueUnits = new Set(spaceVals.map(v => {
      const m = v.match(/(px|rem|em|%|vw|vh)\b/);
      return m ? m[1] : "other";
    }));
    if (uniqueUnits.size > 1) unitInconsistencies.push(rel);

    const uniqueCount = new Set(spaceVals.map(v => v.replace(/\s+/g, " ").trim())).size;
    if (uniqueCount > 10) excessiveUnique.push({ file: rel, uniqueCount });

    const twMatches = content.matchAll(TAILWIND_SPACING_RE);
    for (const _ of twMatches) tailwindCount++;

    const inlineStyleMatches = content.matchAll(/style\s*=\s*\{[^}]*\b(?:margin|padding|gap)\s*[:=][^}]*\}/gi);
    for (const _ of inlineStyleMatches) inlineCount++;
  }

  if (allMargins.length === 0 && allPaddings.length === 0 && allGaps.length === 0 && tailwindCount === 0) {
    recommendations.push("No spacing declarations found — consider establishing a spacing scale");
  }
  if (unitInconsistencies.length > 0) {
    recommendations.push(`${unitInconsistencies.length} files mix spacing units (px/rem/em/%) — standardize on rem for consistency`);
  }
  if (excessiveUnique.length > 0) {
    recommendations.push(`${excessiveUnique.length} files have more than 10 unique spacing values — consider using a constrained spacing scale`);
  }
  if (allPositions.length > 0) {
    recommendations.push(`Found ${allPositions.length} absolute positioning declarations — ensure they are intentional and documented`);
  }
  if (tailwindCount === 0 && (allMargins.length > 0 || allPaddings.length > 0)) {
    recommendations.push("No Tailwind spacing utilities detected — consider using them for consistent spacing");
  }

  return {
    totalSpacingDeclarations: allMargins.length + allPaddings.length + allGaps.length + allPositions.length,
    marginValues: countValues(allMargins),
    paddingValues: countValues(allPaddings),
    gapValues: countValues(allGaps),
    positionValues: countValues(allPositions),
    tailwindSpacingCount: tailwindCount,
    inlineSpacingCount: inlineCount,
    filesWithSpacing: filesWithSpace.size,
    unitInconsistencies,
    filesWithExcessiveUniqueValues: excessiveUnique,
    recommendations
  };
}

export async function scanStandards(projectRoot: string): Promise<StandardsReport> {
  const componentFiles = walk(projectRoot, COMPONENT_EXTS);
  const tsFiles = walk(projectRoot, new Set([".ts", ".tsx", ".js", ".jsx"]));
  const allRelevant = new Set([...componentFiles, ...tsFiles]);

  let pascalCase = 0;
  let kebabCase = 0;
  let defaultExports = 0;
  let namedExports = 0;
  let hasPropsInterface = false;
  const indexFiles: string[] = [];
  let totalLines = 0;
  const largeFiles: string[] = [];

  for (const file of allRelevant) {
    const content = readFileSafe(file);
    if (!content) continue;
    const lines = content.split("\n").length;
    totalLines += lines;

    const basename = path.basename(file);
    const isIndex = basename === "index.ts" || basename === "index.tsx" || basename === "index.js" || basename === "index.jsx";
    if (isIndex) {
      indexFiles.push(file);
      continue;
    }

    const nameWithoutExt = basename.replace(/\.[^.]+$/, "");
    if (/^[A-Z]/.test(nameWithoutExt)) pascalCase++;
    else if (/-/.test(nameWithoutExt)) kebabCase++;

    if (/export\s+default\s+(function|const|class|let|var)\s/i.test(content) || /export\s+{\s*\w+\s+as\s+default\s*}/.test(content)) {
      defaultExports++;
    }
    const namedMatches = content.match(/export\s+(const|function|class|let|var|interface|type)\s+(\w+)/g);
    if (namedMatches) namedExports += namedMatches.length;

    if (/interface\s+\w*Props\b/i.test(content) || /type\s+\w*Props\s*=\s*\{/i.test(content)) {
      hasPropsInterface = true;
    }

    if (lines > 400) {
      largeFiles.push(path.relative(projectRoot, file).replace(/\\/g, "/"));
    }
  }

  if (allRelevant.size === 0) {
    return {
      totalComponentFiles: 0, pascalCaseFiles: 0, kebabCaseFiles: 0,
      defaultExports: 0, namedExports: 0, hasPropsInterface: false,
      hasIndexFiles: 0, avgLinesPerComponent: 0, largeFiles: [],
      organizationType: "unknown"
    };
  }

  const avgLines = Math.round(totalLines / allRelevant.size);
  const dirs = new Set<string>();
  for (const f of allRelevant) {
    dirs.add(path.dirname(path.relative(projectRoot, f)));
  }
  const singleDirs = [...dirs].filter(d => {
    const full = path.join(projectRoot, d);
    if (!fs.existsSync(full)) return false;
    try {
      const entries = fs.readdirSync(full, { withFileTypes: true });
      const componentCount = entries.filter(e => e.isFile() && COMPONENT_EXTS.has(path.extname(e.name).toLowerCase())).length;
      return componentCount <= 1;
    } catch { return false; }
  });
  const multiDirs = [...dirs].filter(d => !singleDirs.includes(d));

  let orgType: StandardsReport["organizationType"] = "unknown";
  if (allRelevant.size > 0) {
    if (singleDirs.length > multiDirs.length) orgType = "flat";
    else if (multiDirs.length > 0) orgType = "feature-folders";
    else orgType = "mixed";
  }

  return {
    totalComponentFiles: componentFiles.length,
    pascalCaseFiles: pascalCase,
    kebabCaseFiles: kebabCase,
    defaultExports,
    namedExports,
    hasPropsInterface,
    hasIndexFiles: indexFiles.length,
    avgLinesPerComponent: avgLines,
    largeFiles,
    organizationType: orgType
  };
}
