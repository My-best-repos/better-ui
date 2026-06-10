import { ESLint } from "eslint";
import path from "path";
import fs from "fs";
import ts from "typescript";
import * as tsParser from "@typescript-eslint/parser";
import * as tsPlugin from "@typescript-eslint/eslint-plugin";
import { FileReport, FixHunk, FixPreview, LintMessage } from "../types";
import { resolveProjectPath, toProjectRelativePath } from "../projectPaths";
import { inferCategory, inferImpact } from "../insights";

const DEFAULT_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];
const LINT_FILE_PATTERNS = ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"];
const ESLINT_CONFIG_FILES = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts"
];

const BETTER_UI_CONFIG_FILES = ["better-ui.config.json"];

function loadBetterUiConfig(projectRoot: string): string[] {
  for (const configFile of BETTER_UI_CONFIG_FILES) {
    const fullPath = path.join(projectRoot, configFile);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, "utf8");
        const config = JSON.parse(content);
        if (config.lint?.ignores && Array.isArray(config.lint.ignores)) {
          return config.lint.ignores;
        }
      } catch {
        // ignore parse errors, fall back to defaults
      }
    }
  }
  return getDefaultIgnores();
}

function getDefaultIgnores(): string[] {
  return [
    "node_modules/**",
    "dist/**",
    ".git/**",
    "coverage/**",
    ".next/**",
    ".turbo/**",
    ".vercel/**",
    "build/**",
    "*.config.*",
    "*.lock",
    ".DS_Store",
    ".cache/**",
    ".parcel-cache/**",
    ".webpack/**",
    ".eslintcache",
    ".stylelintcache",
    ".pnp.*",
    ".yarn/**",
    ".nyc_output/**",
    "*.tsbuildinfo",
    ".vitest/**",
    ".playwright/**",
    ".cypress/**",
    "storybook-static/**",
    ".docusaurus/**",
    "public/build/**",
    "out/**",
    ".expo/**",
    ".svelte-kit/**",
    ".astro/**"
  ];
}

function normalizeExtensions(exts?: string[]) {
  return exts && exts.length > 0 ? exts : DEFAULT_EXTENSIONS;
}

interface ScanProjectOptions {
  files?: string[];
}

function findEslintConfigFile(projectRoot: string) {
  for (const configFile of ESLINT_CONFIG_FILES) {
    const fullPath = path.join(projectRoot, configFile);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

function createEslint(projectRoot: string, fix = false) {
  const configFile = findEslintConfigFile(projectRoot);
  const defaultIgnores = loadBetterUiConfig(projectRoot);

  return new ESLint({
    cwd: projectRoot,
    fix,
    overrideConfigFile: configFile ?? true,
    overrideConfig: configFile ? undefined : [
      {
        ignores: defaultIgnores
      },
      {
        files: LINT_FILE_PATTERNS,
        languageOptions: {
          parser: tsParser as any,
          parserOptions: {
            ecmaVersion: 2020,
            sourceType: "module",
            ecmaFeatures: { jsx: true }
          }
        },
        plugins: {
          "@typescript-eslint": tsPlugin as any
        },
        rules: {
          "no-console": "warn",
          "eqeqeq": "error",
          "no-unused-vars": "off",
          "@typescript-eslint/no-unused-vars": ["warn", { args: "after-used", ignoreRestSiblings: false, caughtErrors: "none" }]
        }
      }
    ] as any
  });
}

async function collectFiles(projectRoot: string, extensions: string[], options?: ScanProjectOptions) {
  if (options?.files && options.files.length > 0) {
    const uniqueFiles = [...new Set(options.files)]
      .map(file => resolveProjectPath(projectRoot, file, "Scan target"))
      .filter(file => fs.existsSync(file) && fs.statSync(file).isFile())
      .filter(file => extensions.includes(path.extname(file).toLowerCase()));

    return uniqueFiles;
  }

  const collected: string[] = [];
  const defaultIgnores = loadBetterUiConfig(projectRoot);
  const ignoreDirs = defaultIgnores
    .filter(pattern => pattern.endsWith("/**"))
    .map(pattern => pattern.slice(0, -3))
    .filter(pattern => !pattern.includes("*"));

  const walk = async (dir: string) => {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (ignoreDirs.includes(entry.name)) {
          continue;
        }
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (extensions.includes(extension)) {
        collected.push(fullPath);
      }
    }
  };

  await walk(projectRoot);
  return collected;
}

function mapSeverity(category: ts.DiagnosticCategory) {
  if (category === ts.DiagnosticCategory.Error) {
    return 2;
  }
  if (category === ts.DiagnosticCategory.Warning) {
    return 1;
  }
  return 1;
}

function compareMessages(a: LintMessage, b: LintMessage) {
  if (a.severity !== b.severity) {
    return b.severity - a.severity;
  }

  if ((a.line ?? Number.MAX_SAFE_INTEGER) !== (b.line ?? Number.MAX_SAFE_INTEGER)) {
    return (a.line ?? Number.MAX_SAFE_INTEGER) - (b.line ?? Number.MAX_SAFE_INTEGER);
  }

  if ((a.column ?? Number.MAX_SAFE_INTEGER) !== (b.column ?? Number.MAX_SAFE_INTEGER)) {
    return (a.column ?? Number.MAX_SAFE_INTEGER) - (b.column ?? Number.MAX_SAFE_INTEGER);
  }

  return (a.ruleId ?? "").localeCompare(b.ruleId ?? "") || a.message.localeCompare(b.message);
}

function normalizeMessages(messages: LintMessage[]) {
  const seen = new Set<string>();
  const deduped: LintMessage[] = [];

  for (const message of messages) {
    const key = [message.ruleId ?? "", message.message, message.line ?? "", message.column ?? "", message.severity].join("::");
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(message);
  }

  deduped.sort(compareMessages);
  return deduped;
}

function createFileReport(filePath: string, messages: LintMessage[]): FileReport {
  const normalizedMessages = normalizeMessages(messages);
  return {
    filePath,
    errorCount: normalizedMessages.filter(message => message.severity === 2).length,
    warningCount: normalizedMessages.filter(message => message.severity === 1).length,
    messages: normalizedMessages
  };
}

function getTsCompilerOptions(projectRoot: string) {
  const tsconfigPath = path.join(projectRoot, "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) {
    return {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      noEmit: true,
      skipLibCheck: true
    } as ts.CompilerOptions;
  }

  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    return {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      noEmit: true,
      skipLibCheck: true
    } as ts.CompilerOptions;
  }

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, projectRoot);
  return {
    ...parsed.options,
    noEmit: true,
    skipLibCheck: true
  } as ts.CompilerOptions;
}

function normalizeDiagnostic(projectRoot: string, diagnostic: ts.Diagnostic): { filePath: string; message: LintMessage } | null {
  if (!diagnostic.file) {
    return null;
  }

  const position = diagnostic.start !== undefined && diagnostic.start !== null
    ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
    : null;
  return {
    filePath: toProjectRelativePath(projectRoot, diagnostic.file.fileName),
    message: {
      ruleId: `ts(${diagnostic.code})`,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n").trim(),
      line: position ? position.line + 1 : null,
      column: position ? position.character + 1 : null,
      severity: mapSeverity(diagnostic.category),
      category: "correctness",
      impact: diagnostic.category === ts.DiagnosticCategory.Error ? "high" : "medium",
      fixable: false,
      source: "typescript"
    }
  };
}

async function collectLintableFiles(eslint: ESLint, files: string[]) {
  const lintable: string[] = [];

  for (const file of files) {
    if (await eslint.isPathIgnored(file)) {
      continue;
    }

    lintable.push(file);
  }

  return lintable;
}

async function getTypeScriptDiagnostics(projectRoot: string, files: string[]) {
  const tsFiles = files.filter(file => [".ts", ".tsx"].includes(path.extname(file).toLowerCase()));
  if (tsFiles.length === 0) {
    return new Map<string, LintMessage[]>();
  }

  const compilerOptions = getTsCompilerOptions(projectRoot);
  const program = ts.createProgram(tsFiles, compilerOptions);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const byFile = new Map<string, LintMessage[]>();

  for (const diagnostic of diagnostics) {
    const normalized = normalizeDiagnostic(projectRoot, diagnostic);
    if (!normalized) {
      continue;
    }

    const current = byFile.get(normalized.filePath) || [];
    current.push(normalized.message);
    byFile.set(normalized.filePath, current);
  }

  return byFile;
}

function buildFallbackMessages(code: string): LintMessage[] {
  const messages: LintMessage[] = [];

  if (/console\./.test(code)) {
    messages.push({ ruleId: "no-console", message: "Use of console detected", line: null, column: null, severity: 1, category: "code-quality", impact: "low", fixable: false, source: "heuristic" });
  }

  if (/(^|[^=])==([^=]|$)/.test(code)) {
    messages.push({ ruleId: "eqeqeq", message: "Use '===' instead of '=='", line: null, column: null, severity: 2, category: "correctness", impact: "high", fixable: true, source: "heuristic" });
  }

  const decls = [] as string[];
  const declRe = /(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g;
  let match: RegExpExecArray | null;
  while ((match = declRe.exec(code))) {
    decls.push(match[1]);
  }

  for (const name of decls) {
    const usageRe = new RegExp("\\b" + name + "\\b", "g");
    const occurrences = [...code.matchAll(usageRe)];
    if (occurrences.length <= 1) {
      messages.push({ ruleId: "no-unused-vars", message: `'${name}' is defined but never used`, line: null, column: null, severity: 1, category: "code-quality", impact: "low", fixable: false, source: "heuristic" });
    }
  }

  return messages;
}

function getLocationFromIndex(code: string, index: number) {
  const textUntilIndex = code.slice(0, index);
  const lines = textUntilIndex.split(/\r?\n/);
  return {
    line: lines.length,
    column: (lines[lines.length - 1] || "").length + 1
  };
}

function countChangedLines(before: string, after: string) {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const maxLength = Math.max(beforeLines.length, afterLines.length);
  let changed = 0;

  for (let index = 0; index < maxLength; index += 1) {
    if ((beforeLines[index] || "") !== (afterLines[index] || "")) {
      changed += 1;
    }
  }

  return changed;
}

function buildDiffPreview(before: string, after: string, maxLines = 12) {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const maxLength = Math.max(beforeLines.length, afterLines.length);
  const preview: string[] = [];

  for (let index = 0; index < maxLength && preview.length < maxLines; index += 1) {
    const previousLine = beforeLines[index] || "";
    const nextLine = afterLines[index] || "";
    if (previousLine === nextLine) {
      continue;
    }

    if (previousLine) {
      preview.push(`- ${previousLine}`);
    }
    if (nextLine) {
      preview.push(`+ ${nextLine}`);
    }
  }

  return preview;
}

type LineDiffOp =
  | { type: "equal"; line: string }
  | { type: "delete"; line: string }
  | { type: "insert"; line: string };

function buildLineDiff(beforeLines: string[], afterLines: string[]) {
  const rows = beforeLines.length;
  const cols = afterLines.length;
  const dp = Array.from({ length: rows + 1 }, () => Array.from({ length: cols + 1 }, () => 0));

  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let col = cols - 1; col >= 0; col -= 1) {
      if (beforeLines[row] === afterLines[col]) {
        dp[row][col] = dp[row + 1][col + 1] + 1;
      } else {
        dp[row][col] = Math.max(dp[row + 1][col], dp[row][col + 1]);
      }
    }
  }

  const operations: LineDiffOp[] = [];
  let row = 0;
  let col = 0;

  while (row < rows && col < cols) {
    if (beforeLines[row] === afterLines[col]) {
      operations.push({ type: "equal", line: beforeLines[row] });
      row += 1;
      col += 1;
      continue;
    }

    if (dp[row + 1][col] >= dp[row][col + 1]) {
      operations.push({ type: "delete", line: beforeLines[row] });
      row += 1;
    } else {
      operations.push({ type: "insert", line: afterLines[col] });
      col += 1;
    }
  }

  while (row < rows) {
    operations.push({ type: "delete", line: beforeLines[row] });
    row += 1;
  }

  while (col < cols) {
    operations.push({ type: "insert", line: afterLines[col] });
    col += 1;
  }

  return operations;
}

function buildFixHunks(filePath: string, before: string, after: string): FixHunk[] {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const operations = buildLineDiff(beforeLines, afterLines);
  const hunks: FixHunk[] = [];

  let beforeLineNumber = 1;
  let afterLineNumber = 1;
  let current: Omit<FixHunk, "id" | "label"> | null = null;

  const finalize = () => {
    if (!current) {
      return;
    }

    const hunkNumber = hunks.length + 1;
    hunks.push({
      ...current,
      id: `${filePath}#${hunkNumber}`,
      label: `${filePath} hunk ${hunkNumber} (${current.beforeStart}-${current.beforeEnd < current.beforeStart ? current.beforeStart : current.beforeEnd})`,
      preview: [
        ...current.beforeLines.slice(0, 4).map(line => `- ${line}`),
        ...current.afterLines.slice(0, 4).map(line => `+ ${line}`)
      ]
    });
    current = null;
  };

  for (const operation of operations) {
    if (operation.type === "equal") {
      finalize();
      beforeLineNumber += 1;
      afterLineNumber += 1;
      continue;
    }

    if (!current) {
      current = {
        beforeStart: beforeLineNumber,
        beforeEnd: beforeLineNumber - 1,
        afterStart: afterLineNumber,
        afterEnd: afterLineNumber - 1,
        beforeLines: [],
        afterLines: [],
        preview: []
      };
    }

    if (operation.type === "delete") {
      current.beforeLines.push(operation.line);
      current.beforeEnd = beforeLineNumber;
      beforeLineNumber += 1;
      continue;
    }

    current.afterLines.push(operation.line);
    current.afterEnd = afterLineNumber;
    afterLineNumber += 1;
  }

  finalize();
  return hunks;
}

function buildFrontendHeuristics(code: string, filePath: string) {
  const messages: LintMessage[] = [];
  const extension = path.extname(filePath).toLowerCase();
  const lineCount = code.split(/\r?\n/).length;

  if (lineCount > 350) {
    messages.push({
      ruleId: "better-ui/large-file",
      message: `Large UI file detected (${lineCount} lines). Consider splitting responsibilities to improve reviewability.`,
      line: 1,
      column: 1,
      severity: 1,
      category: "maintainability",
      impact: "medium",
      fixable: false,
      source: "heuristic"
    });
  }

  if (![".jsx", ".tsx"].includes(extension)) {
    return messages;
  }

  const addRegexMatches = (ruleId: string, regex: RegExp, messageBuilder: (match: RegExpExecArray) => string, extra: Pick<LintMessage, "severity" | "category" | "impact" | "fixable">) => {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(code))) {
      const location = getLocationFromIndex(code, match.index);
      messages.push({
        ruleId,
        message: messageBuilder(match),
        line: location.line,
        column: location.column,
        severity: extra.severity,
        category: extra.category,
        impact: extra.impact,
        fixable: extra.fixable,
        source: "heuristic"
      });
    }
  };

  addRegexMatches(
    "better-ui/img-alt",
    /<img(?![^>]*\balt=)[^>]*>/g,
    () => "Image element is missing an `alt` attribute.",
    { severity: 1, category: "accessibility", impact: "medium", fixable: false }
  );
  addRegexMatches(
    "better-ui/clickable-div",
    /<div[^>]*\bonClick=\{[^}]+\}[^>]*>/g,
    () => "Clickable `div` detected. Prefer a semantic `button` or add keyboard accessibility support.",
    { severity: 1, category: "accessibility", impact: "medium", fixable: false }
  );
  addRegexMatches(
    "better-ui/inline-style",
    /style=\{\{/g,
    () => "Inline styles can make UI code harder to maintain and theme consistently.",
    { severity: 1, category: "maintainability", impact: "low", fixable: false }
  );
  addRegexMatches(
    "better-ui/empty-button",
    /<button[^>]*>\s*<\/button>/g,
    () => "Button element has no accessible text content.",
    { severity: 1, category: "accessibility", impact: "medium", fixable: false }
  );
  addRegexMatches(
    "better-ui/input-label",
    /<input(?![^>]*(aria-label|aria-labelledby|title)=)[^>]*>/g,
    () => "Input element may be missing an accessible label.",
    { severity: 1, category: "accessibility", impact: "medium", fixable: false }
  );
  addRegexMatches(
    "better-ui/list-key",
    /\.map\([^\n]+=>\s*<(?!(?:>|.*\bkey=))/g,
    () => "List rendering may be missing a stable `key` prop.",
    { severity: 1, category: "performance", impact: "medium", fixable: false }
  );

  const headingMatches = [...code.matchAll(/<h([1-6])\b[^>]*>/g)];
  let previousLevel: number | null = null;
  for (const headingMatch of headingMatches) {
    const level = Number(headingMatch[1]);
    if (previousLevel !== null && level > previousLevel + 1) {
      const location = getLocationFromIndex(code, headingMatch.index || 0);
      messages.push({
        ruleId: "better-ui/heading-order",
        message: `Heading level jumps from h${previousLevel} to h${level}.`,
        line: location.line,
        column: location.column,
        severity: 1,
        category: "accessibility",
        impact: "low",
        fixable: false,
        source: "heuristic"
      });
    }
    previousLevel = level;
  }

  return messages;
}

export async function scanProject(projectRoot: string, exts?: string[], options?: ScanProjectOptions): Promise<FileReport[]> {
  const extensions = normalizeExtensions(exts);
  const eslint = createEslint(projectRoot, false);
  const files = await collectFiles(projectRoot, extensions, options);
  const lintableFiles = await collectLintableFiles(eslint, files);
  const typeDiagnostics = await getTypeScriptDiagnostics(projectRoot, lintableFiles);
  const reports = new Map<string, FileReport>();

  for (const file of lintableFiles) {
    const relativePath = toProjectRelativePath(projectRoot, file);
    const code = await fs.promises.readFile(file, "utf8");

    try {
      const results = await eslint.lintText(code, { filePath: file, warnIgnored: false });
      const result = results[0];
      if (!result) {
        continue;
      }
      const messages: LintMessage[] = result.messages.map(message => {
        const normalized: LintMessage = {
          ruleId: message.ruleId ?? null,
          message: message.message,
          line: message.line ?? null,
          column: message.column ?? null,
          severity: message.severity,
          fixable: Boolean((message as any).fix),
          source: "eslint"
        };

        normalized.category = inferCategory(normalized);
        normalized.impact = inferImpact(normalized);
        return normalized;
      });

      messages.push(...buildFrontendHeuristics(code, relativePath));

      reports.set(relativePath, createFileReport(relativePath, messages));
    } catch {
      const fallbackMessages = [...buildFallbackMessages(code), ...buildFrontendHeuristics(code, relativePath)];
      reports.set(relativePath, createFileReport(relativePath, fallbackMessages));
    }
  }

  for (const [filePath, messages] of typeDiagnostics.entries()) {
    const existing = reports.get(filePath) || { filePath, errorCount: 0, warningCount: 0, messages: [] };
    existing.messages.push(...messages);
    reports.set(filePath, createFileReport(filePath, existing.messages));
  }

  return [...reports.values()].filter(report => report.messages.length > 0);
}

export async function previewEslintFixes(projectRoot: string, exts?: string[], options?: ScanProjectOptions): Promise<FixPreview[]> {
  const extensions = normalizeExtensions(exts);
  const eslint = createEslint(projectRoot, true);
  const files = await collectFiles(resolveProjectPath(projectRoot, ".", "Project root"), extensions, options);
  const lintableFiles = await collectLintableFiles(eslint, files);
  const previews: FixPreview[] = [];

  for (const file of lintableFiles) {
    const before = await fs.promises.readFile(file, "utf8");
    try {
      const results = await eslint.lintText(before, { filePath: file, warnIgnored: false });
      const result = results[0];
      if (!result || !result.output || result.output === before) {
        continue;
      }

      previews.push({
        filePath: toProjectRelativePath(projectRoot, file),
        before,
        after: result.output,
        changedLines: countChangedLines(before, result.output),
        diffPreview: buildDiffPreview(before, result.output),
        hunks: buildFixHunks(toProjectRelativePath(projectRoot, file), before, result.output)
      });
    } catch (err) {
      console.warn(`Could not preview fixes for ${file}: ${err}`);
    }
  }

  return previews;
}

export async function applyFixPreviews(projectRoot: string, previews: FixPreview[], selectedFiles?: string[]) {
  const allowed = selectedFiles ? new Set(selectedFiles.map(file => path.normalize(file))) : null;

  for (const preview of previews) {
    if (allowed && !allowed.has(path.normalize(preview.filePath))) {
      continue;
    }

    const fullPath = resolveProjectPath(projectRoot, preview.filePath, "Fix target");
    await fs.promises.writeFile(fullPath, preview.after, "utf8");
  }
}

export async function applyFixHunks(projectRoot: string, previews: FixPreview[], selectedHunks: string[]) {
  const selected = new Set(selectedHunks);

  for (const preview of previews) {
    const beforeLines = preview.before.split(/\r?\n/);
    const nextLines: string[] = [];
    let cursor = 1;

    for (const hunk of preview.hunks) {
      const startIndex = Math.max(0, hunk.beforeStart - 1);
      const endIndex = Math.max(startIndex, hunk.beforeEnd);
      nextLines.push(...beforeLines.slice(cursor - 1, startIndex));
      nextLines.push(...(selected.has(hunk.id) ? hunk.afterLines : hunk.beforeLines));
      cursor = endIndex + 1;
    }

    nextLines.push(...beforeLines.slice(cursor - 1));

    const nextContent = nextLines.join("\n");
    if (nextContent === preview.before) {
      continue;
    }

    const fullPath = resolveProjectPath(projectRoot, preview.filePath, "Fix target");
    await fs.promises.writeFile(fullPath, nextContent, "utf8");
  }
}
