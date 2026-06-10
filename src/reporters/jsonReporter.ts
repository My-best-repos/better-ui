import fs from "fs";
import path from "path";
import { resolveProjectPath } from "../projectPaths";
import { FileReport, ScanReport } from "../types";
import { buildScanReport } from "./reportUtils";

export function writeJsonReport(projectRoot: string, outPath: string, reportOrFiles: ScanReport | FileReport[]) {
  const report = Array.isArray(reportOrFiles) ? buildScanReport(reportOrFiles) : reportOrFiles;
  const safeOutPath = resolveProjectPath(projectRoot, outPath, "JSON report output");

  fs.mkdirSync(path.dirname(safeOutPath), { recursive: true });
  fs.writeFileSync(safeOutPath, JSON.stringify(report, null, 2), { encoding: "utf8" });

  return safeOutPath;
}
