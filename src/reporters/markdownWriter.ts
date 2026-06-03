import fs from "fs";
import path from "path";
import { resolveProjectPath } from "../projectPaths";

export async function writeMarkdownReport(projectRoot: string, outPath: string, markdown: string, opts?: { keepTxt?: boolean; frontMatter?: Record<string, any> }) {
  let targetPath = outPath;
  const lower = targetPath.toLowerCase();
  if (!opts?.keepTxt && lower.endsWith(".txt")) {
    targetPath = targetPath.slice(0, -4) + ".md";
  } else if (opts?.keepTxt && !lower.endsWith(".txt")) {
    targetPath = targetPath + ".txt";
  }

  const safePath = resolveProjectPath(projectRoot, targetPath, "Markdown report output");
  fs.mkdirSync(path.dirname(safePath), { recursive: true });

  let content = markdown;
  if (opts?.frontMatter && Object.keys(opts.frontMatter).length > 0) {
    const yaml = Object.entries(opts.frontMatter)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    content = `---\n${yaml}\n---\n\n${content}`;
  }

  await fs.promises.writeFile(safePath, content, "utf8");
  return safePath;
}
