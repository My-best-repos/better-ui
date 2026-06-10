import fs from "fs";
import path from "path";

export const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "build", ".next", ".cache", "coverage", ".turbo", ".vercel"]);

export interface FileDetail {
  file: string;
  line: number;
  detail?: string;
}

export function walk(root: string, exts: Set<string>): string[] {
  const results: string[] = [];
  if (!fs.existsSync(root)) return results;
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(root, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) results.push(...walk(full, exts));
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (exts.size === 0 || exts.has(ext)) results.push(full);
      }
    }
  } catch {
    // permission denied
  }
  return results;
}

export function readFileSafe(filePath: string): string | null {
  try {
    if (fs.statSync(filePath).size > 500_000) return null;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}


