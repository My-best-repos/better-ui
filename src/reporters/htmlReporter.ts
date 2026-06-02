import fs from "fs";
import path from "path";
import { resolveProjectPath } from "../projectPaths";
import { ScanReport } from "../types";
import { buildMarkdownSummary } from "../insights";
import { writeMarkdownReport } from "./markdownWriter";

export function writeHtmlReport(projectRoot: string, reportPath: string, report: ScanReport) {
  const outPath = resolveProjectPath(projectRoot, reportPath, "HTML report output");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Scan Report</title></head><body><h1>Scan Report</h1><pre>${JSON.stringify(report, null, 2)}</pre></body></html>`;
  fs.writeFileSync(outPath, html, "utf8");

  // Add Markdown summary alongside HTML (write synchronously)
  const parsed = path.parse(reportPath);
  const txtPath = path.join(parsed.dir || "", parsed.name + ".txt");
  const safeTxt = resolveProjectPath(projectRoot, txtPath, "HTML report summary output");
  fs.writeFileSync(safeTxt, buildMarkdownSummary(report), "utf8");

  return outPath;
}
