import fs from "fs";
import path from "path";
import { walk, readFileSafe, FileDetail } from "./scannerUtils";

export interface TechDebtReport {
  todos: FileDetail[];
  fixmes: FileDetail[];
  hacks: FileDetail[];
  xxxs: FileDetail[];
  consoleLogs: FileDetail[];
  debuggers: FileDetail[];
  anyTypes: FileDetail[];
  nonStrictEqualities: FileDetail[];
  varDeclarations: FileDetail[];
  commentedCode: FileDetail[];
  emptyCatches: FileDetail[];
  totalFiles: number;
  largeFiles: { file: string; lines: number }[];
  recommendations: string[];
  score: number;
}

export async function scanTechDebt(projectRoot: string): Promise<TechDebtReport> {
  const files = walk(projectRoot, new Set([".js", ".jsx", ".ts", ".tsx", ".css", ".scss"]));
  const codeFiles = files.filter(f => /\.(js|jsx|ts|tsx|css|scss)$/i.test(f));

  const todos: FileDetail[] = [];
  const fixmes: FileDetail[] = [];
  const hacks: FileDetail[] = [];
  const xxxs: FileDetail[] = [];
  const consoleLogs: FileDetail[] = [];
  const debuggers: FileDetail[] = [];
  const anyTypes: FileDetail[] = [];
  const nonStrictEqualities: FileDetail[] = [];
  const varDeclarations: FileDetail[] = [];
  const commentedCode: FileDetail[] = [];
  const emptyCatches: FileDetail[] = [];
  const largeFiles: { file: string; lines: number }[] = [];

  for (const file of codeFiles) {
    const content = readFileSafe(file);
    if (!content) continue;

    const lines = content.split(/\r?\n/);
    const relPath = path.relative(projectRoot, file);

    if (lines.length > 300) largeFiles.push({ file: relPath, lines: lines.length });

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const lineNum = i + 1;

      if (/\/\/\s*TODO/i.test(trimmed)) todos.push({ file: relPath, line: lineNum, detail: trimmed.slice(0, 80) });
      if (/\/\/\s*FIXME/i.test(trimmed)) fixmes.push({ file: relPath, line: lineNum, detail: trimmed.slice(0, 80) });
      if (/\/\/\s*HACK/i.test(trimmed)) hacks.push({ file: relPath, line: lineNum, detail: trimmed.slice(0, 80) });
      if (/\/\/\s*XXX/i.test(trimmed)) xxxs.push({ file: relPath, line: lineNum, detail: trimmed.slice(0, 80) });
      if (/console\.log\s*\(/.test(trimmed) && !/console\.(error|warn)\s*\(/.test(trimmed)) consoleLogs.push({ file: relPath, line: lineNum, detail: trimmed.slice(0, 80) });
      if (/\bdebugger\s*;/.test(trimmed)) debuggers.push({ file: relPath, line: lineNum, detail: trimmed.slice(0, 80) });

      if (!/\.tsx?$/i.test(file)) continue;

      if (/\bany\b(?!\s*\[)/.test(trimmed) && !/\bany\[\]/.test(trimmed) && /:\s*any\b/.test(trimmed)) anyTypes.push({ file: relPath, line: lineNum, detail: trimmed.slice(0, 80) });
      if (/==[^=]/.test(trimmed) && !/===/.test(trimmed)) nonStrictEqualities.push({ file: relPath, line: lineNum, detail: trimmed.slice(0, 80) });
      if (/!= ?[^=]/.test(trimmed) && /!==/.test(trimmed) === false && /!= /.test(trimmed)) nonStrictEqualities.push({ file: relPath, line: lineNum, detail: trimmed.slice(0, 80) });
      if (/\bvar\s/.test(trimmed)) varDeclarations.push({ file: relPath, line: lineNum, detail: trimmed.slice(0, 80) });
    }

    const emptyCatchRe = /catch\s*(\([^)]*\))?\s*\{[^a-zA-Z0-9'"`]*\}/g;
    let ecMatch;
    while ((ecMatch = emptyCatchRe.exec(content)) !== null) {
      const lineNum = content.substring(0, ecMatch.index).split(/\r?\n/).length;
      emptyCatches.push({ file: relPath, line: lineNum });
    }

    const commentLines = content.match(/^\s*\/\/\s+(.+)$/gm) || [];
    for (const cl of commentLines) {
      const code = cl.replace(/^\s*\/\/\s+/, "");
      if (/[;{}]/.test(code) || /\b(function|const|let|var|import|export|class|return|if|for|while)\b/.test(code)) {
        const lineNum = content.substring(0, content.indexOf(cl)).split(/\r?\n/).length;
        commentedCode.push({ file: relPath, line: lineNum, detail: cl.slice(0, 80) });
      }
    }
  }

  const totalIssues = todos.length + fixmes.length + hacks.length + xxxs.length + consoleLogs.length + debuggers.length + anyTypes.length + nonStrictEqualities.length + varDeclarations.length + commentedCode.length + emptyCatches.length;
  const deductions = Math.floor(totalIssues / 10);
  const score = Math.max(0, 100 - deductions);

  const recommendations: string[] = [];
  if (todos.length > 0) {
    const top = todos.slice(0, 2).map(d => `${d.file}:${d.line}`).join(", ");
    recommendations.push(`Resolve ${todos.length} TODO(s) — e.g. ${top}${todos.length > 2 ? ` +${todos.length - 2} more` : ""}`);
  }
  if (fixmes.length > 0) {
    const top = fixmes.slice(0, 2).map(d => `${d.file}:${d.line}`).join(", ");
    recommendations.push(`Fix ${fixmes.length} FIXME(s) — e.g. ${top}${fixmes.length > 2 ? ` +${fixmes.length - 2} more` : ""}`);
  }
  if (hacks.length > 0) {
    const top = hacks.slice(0, 2).map(d => `${d.file}:${d.line}`).join(", ");
    recommendations.push(`Refactor ${hacks.length} HACK(s) — e.g. ${top}${hacks.length > 2 ? ` +${hacks.length - 2} more` : ""}`);
  }
  if (xxxs.length > 0) {
    const top = xxxs.slice(0, 2).map(d => `${d.file}:${d.line}`).join(", ");
    recommendations.push(`Review ${xxxs.length} XXX(s) — e.g. ${top}${xxxs.length > 2 ? ` +${xxxs.length - 2} more` : ""}`);
  }
  if (consoleLogs.length > 0) {
    const top = consoleLogs.slice(0, 2).map(d => `${d.file}:${d.line}`).join(", ");
    recommendations.push(`Remove ${consoleLogs.length} console.log(s) — e.g. ${top}${consoleLogs.length > 2 ? ` +${consoleLogs.length - 2} more` : ""}`);
  }
  if (debuggers.length > 0) {
    const top = debuggers.slice(0, 2).map(d => `${d.file}:${d.line}`).join(", ");
    recommendations.push(`Remove ${debuggers.length} debugger statement(s) — e.g. ${top}${debuggers.length > 2 ? ` +${debuggers.length - 2} more` : ""}`);
  }
  if (anyTypes.length > 0) {
    const top = anyTypes.slice(0, 2).map(d => `${d.file}:${d.line}`).join(", ");
    recommendations.push(`Replace ${anyTypes.length} ` + "`any`" + ` type(s) — e.g. ${top}${anyTypes.length > 2 ? ` +${anyTypes.length - 2} more` : ""}`);
  }
  if (nonStrictEqualities.length > 0) {
    const top = nonStrictEqualities.slice(0, 2).map(d => `${d.file}:${d.line}`).join(", ");
    recommendations.push(`Use ===/!== instead of ==/!= in ${nonStrictEqualities.length} place(s) — e.g. ${top}${nonStrictEqualities.length > 2 ? ` +${nonStrictEqualities.length - 2} more` : ""}`);
  }
  if (varDeclarations.length > 0) {
    const top = varDeclarations.slice(0, 2).map(d => `${d.file}:${d.line}`).join(", ");
    recommendations.push(`Replace ${varDeclarations.length} ` + "`var`" + ` with const/let — e.g. ${top}${varDeclarations.length > 2 ? ` +${varDeclarations.length - 2} more` : ""}`);
  }
  if (commentedCode.length > 0) {
    const top = commentedCode.slice(0, 2).map(d => `${d.file}:${d.line}`).join(", ");
    recommendations.push(`Remove ${commentedCode.length} commented-out code block(s) — e.g. ${top}${commentedCode.length > 2 ? ` +${commentedCode.length - 2} more` : ""}`);
  }
  if (emptyCatches.length > 0) {
    const top = emptyCatches.slice(0, 2).map(d => `${d.file}:${d.line}`).join(", ");
    recommendations.push(`Handle or rethrow ${emptyCatches.length} empty catch(es) — e.g. ${top}${emptyCatches.length > 2 ? ` +${emptyCatches.length - 2} more` : ""}`);
  }
  if (largeFiles.length > 0) recommendations.push(`Split ${largeFiles.length} file(s) exceeding 300 lines into smaller modules`);

  return {
    todos,
    fixmes,
    hacks,
    xxxs,
    consoleLogs,
    debuggers,
    anyTypes,
    nonStrictEqualities,
    varDeclarations,
    commentedCode,
    emptyCatches,
    totalFiles: codeFiles.length,
    largeFiles,
    recommendations,
    score,
  };
}
