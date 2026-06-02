import fs from "fs";
import path from "path";
import { resolveProjectPath } from "../projectPaths";
import { FileReport, ScanReport } from "../types";
import { buildScanReport } from "./reportUtils";
import { buildMarkdownSummary } from "../insights";
import { writeMarkdownReport } from "./markdownWriter";

export function writeJsonReport(projectRoot: string, outPath: string, reportOrFiles: ScanReport | FileReport[]) {
  const report = Array.isArray(reportOrFiles) ? buildScanReport(reportOrFiles) : reportOrFiles;
  const safeOutPath = resolveProjectPath(projectRoot, outPath, "JSON report output");

  fs.mkdirSync(path.dirname(safeOutPath), { recursive: true });
  fs.writeFileSync(safeOutPath, JSON.stringify(report, null, 2), { encoding: "utf8" });

  // Add Markdown summary alongside JSON (write synchronously)
  const parsed = path.parse(outPath);
  const txtPath = path.join(parsed.dir || "", parsed.name + ".txt");
  const safeTxt = resolveProjectPath(projectRoot, txtPath, "JSON report summary output");
  fs.writeFileSync(safeTxt, buildMarkdownSummary(report), "utf8");
  return safeOutPath;
}
