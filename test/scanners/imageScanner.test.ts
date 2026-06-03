import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { scanImages, generateWebP } from "../../src/scanners/imageScanner";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "better-ui-img-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relPath: string, content: Buffer | string) {
  const fullPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nK9sAAAAASUVORK5CYII=";

describe("scanImages", () => {
  it("returns empty array when no images exist", async () => {
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src", "index.ts"), "const a = 1;\n");
    const result = await scanImages(tmpDir);
    expect(result).toEqual([]);
  });

  it("discovers PNG files", async () => {
    writeFile("src/icon.png", Buffer.from(TINY_PNG_BASE64, "base64"));
    const result = await scanImages(tmpDir);
    expect(result.length).toBe(1);
    expect(result[0].file).toContain("icon.png");
    expect(result[0].size).toBeGreaterThan(0);
  });

  it("discovers JPG files", async () => {
    writeFile("public/photo.jpg", Buffer.alloc(100));
    const result = await scanImages(tmpDir);
    expect(result.length).toBe(1);
    expect(result[0].file).toContain("photo.jpg");
  });

  it("discovers JPEG files", async () => {
    writeFile("img/banner.jpeg", Buffer.alloc(100));
    const result = await scanImages(tmpDir);
    expect(result.length).toBe(1);
    expect(result[0].file).toContain("banner.jpeg");
  });

  it("finds images in nested directories", async () => {
    writeFile("assets/images/deep/icon.png", Buffer.from(TINY_PNG_BASE64, "base64"));
    writeFile("assets/logo.jpg", Buffer.alloc(50));
    const result = await scanImages(tmpDir);
    expect(result.length).toBe(2);
  });

  it("skips files in node_modules", async () => {
    writeFile("node_modules/lib/x.png", Buffer.from(TINY_PNG_BASE64, "base64"));
    writeFile("src/index.ts", "const a = 1;\n");
    const result = await scanImages(tmpDir);
    expect(result.length).toBe(0);
  });

  it("skips files in dist", async () => {
    writeFile("dist/bundle.png", Buffer.from(TINY_PNG_BASE64, "base64"));
    writeFile("src/index.ts", "const a = 1;\n");
    const result = await scanImages(tmpDir);
    expect(result.length).toBe(0);
  });

  it("skips files in .git", async () => {
    writeFile(".git/logo.png", Buffer.from(TINY_PNG_BASE64, "base64"));
    writeFile("src/index.ts", "const a = 1;\n");
    const result = await scanImages(tmpDir);
    expect(result.length).toBe(0);
  });
});

describe("generateWebP", () => {
  it("generates a WebP file from a PNG", async () => {
    writeFile("src/icon.png", Buffer.from(TINY_PNG_BASE64, "base64"));
    const result = await generateWebP(tmpDir, "src/icon.png", 80);
    expect(result.out).toMatch(/\.webp$/);
    expect(fs.existsSync(path.join(tmpDir, result.out))).toBe(true);
    expect(result.size).toBeGreaterThan(0);
  });
});
