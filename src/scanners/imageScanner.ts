import fs from "fs";
import path from "path";
import { walk, readFileSafe } from "./scannerUtils";
import { resolveProjectPath, toProjectRelativePath } from "../projectPaths";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);

export async function scanImages(projectRoot: string) {
  const images: { file: string; size: number }[] = [];
  const resolvedRoot = resolveProjectPath(projectRoot, ".", "Project root");

  const imageFiles = walk(resolvedRoot, IMAGE_EXTENSIONS);
  for (const full of imageFiles) {
    const stat = fs.statSync(full);
    images.push({ file: toProjectRelativePath(resolvedRoot, full), size: stat.size });
  }

  return images;
}

export async function generateWebP(projectRoot: string, file: string, quality = 75) {
  const normalizedQuality = Math.max(1, Math.min(100, Math.trunc(quality)));
  const full = resolveProjectPath(projectRoot, file, "Image file");
  const extension = path.extname(full).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported image type: ${extension || "unknown"}`);
  }

  // Load sharp only when WebP generation is requested so non-image commands can
  // still start even if the native optional dependency cannot be loaded.
  const { default: sharp } = await import("sharp");
  const out = full + ".webp";
  await sharp(full).webp({ quality: normalizedQuality }).toFile(out);
  const stat = await fs.promises.stat(out);
  return { out: toProjectRelativePath(projectRoot, out), size: stat.size };
}
