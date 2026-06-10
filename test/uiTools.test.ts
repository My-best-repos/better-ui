import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { scanColors, scanStandards } from "../src/uiTools";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "better-ui-ui-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relPath: string, content: string) {
  const fullPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function mkdir(relPath: string) {
  fs.mkdirSync(path.join(tmpDir, relPath), { recursive: true });
}

// ─── scanColors ─────────────────────────────────────────────────────────────

describe("scanColors", () => {
  it("returns empty report for a project with no colors", async () => {
    writeFile("src/index.ts", "const a = 1;");
    const r = await scanColors(tmpDir);
    expect(r.totalUnique).toBe(0);
    expect(r.totalDeclarations).toBe(0);
    expect(r.allColors).toEqual([]);
    expect(r.tailwindColors).toBe(0);
    expect(r.cssCustomProperties).toBe(0);
    expect(r.hasColorInconsistencies).toBe(false);
  });

  it("detects hex colors in CSS", async () => {
    writeFile("src/styles.css", ".primary { color: #ff0000; } .secondary { color: #00ff00; }");
    const r = await scanColors(tmpDir);
    expect(r.totalUnique).toBe(2);
    expect(r.totalDeclarations).toBe(2);
  });

  it("deduplicates identical hex colors across files", async () => {
    writeFile("src/a.css", ".a { color: #ff0000; }");
    writeFile("src/b.css", ".b { background: #ff0000; }");
    const r = await scanColors(tmpDir);
    expect(r.totalUnique).toBe(1);
    expect(r.totalDeclarations).toBe(2);
    expect(r.allColors[0].files.length).toBe(2);
  });

  it("detects rgb() colors", async () => {
    writeFile("src/styles.css", ".box { color: rgb(255, 0, 0); }");
    const r = await scanColors(tmpDir);
    expect(r.totalUnique).toBe(1);
    expect(r.totalDeclarations).toBe(1);
  });

  it("detects rgba() colors", async () => {
    writeFile("src/styles.css", ".box { color: rgba(0, 0, 255, 0.5); }");
    const r = await scanColors(tmpDir);
    expect(r.totalUnique).toBe(1);
  });

  it("detects hsl() colors", async () => {
    writeFile("src/styles.css", ".box { color: hsl(120, 100%, 50%); }");
    const r = await scanColors(tmpDir);
    expect(r.totalUnique).toBe(1);
  });

  it("detects hsla() colors", async () => {
    writeFile("src/styles.css", ".box { color: hsla(120, 100%, 50%, 0.3); }");
    const r = await scanColors(tmpDir);
    expect(r.totalUnique).toBe(1);
  });

  it("does not count black and white hex colors", async () => {
    writeFile("src/styles.css", ".a { color: #000; } .b { color: #fff; } .c { color: #ffffff; } .d { color: #000000; } .e { color: #ff0000; }");
    const r = await scanColors(tmpDir);
    expect(r.totalUnique).toBe(1);
    expect(r.allColors[0].value).toBe("#ff0000");
  });

  it("detects Tailwind color classes", async () => {
    writeFile("src/Button.tsx", `export function Button() {
  return <button className="bg-blue-500 text-white-100 border-gray-300">Click</button>;
}`);
    const r = await scanColors(tmpDir);
    expect(r.tailwindColors).toBe(2);
  });

  it("detects CSS custom properties with color values", async () => {
    writeFile("src/variables.css", `:root {
  --primary: #ff0000;
  --secondary: #00ff00;
}`);
    const r = await scanColors(tmpDir);
    expect(r.cssCustomProperties).toBe(2);
  });

  it("detects color inconsistencies (close but distinct hex values)", async () => {
    writeFile("src/styles.css", ".a { color: #ff0000; } .b { color: #ff0001; }");
    const r = await scanColors(tmpDir);
    expect(r.hasColorInconsistencies).toBe(true);
  });

  it("does not flag identical hex values as inconsistency", async () => {
    writeFile("src/styles.css", ".a { color: #ff0000; } .b { color: #ff0000; }");
    const r = await scanColors(tmpDir);
    expect(r.hasColorInconsistencies).toBe(false);
  });

  it("scans component files for colors too", async () => {
    writeFile("src/Card.tsx", `export function Card() {
  return <div style={{ color: "#ff0000", background: "#00ff00" }} />;
}`);
    const r = await scanColors(tmpDir);
    expect(r.totalUnique).toBe(2);
  });

  it("handles large files gracefully (over 500KB)", async () => {
    const large = "x".repeat(510_000);
    writeFile("src/huge.css", large);
    const r = await scanColors(tmpDir);
    expect(r.totalUnique).toBe(0);
  });

  it("skips node_modules, dist, .git directories", async () => {
    writeFile("node_modules/lib/theme.css", ".x { color: #ff0000; }");
    writeFile("dist/bundle.css", ".x { color: #00ff00; }");
    writeFile(".git/colors.css", ".x { color: #0000ff; }");
    const r = await scanColors(tmpDir);
    expect(r.totalUnique).toBe(0);
  });
});

// ─── scanStandards ──────────────────────────────────────────────────────────

describe("scanStandards", () => {
  it("returns zero report when no component files exist", async () => {
    writeFile("src/util.ts", "export const add = (a: number, b: number) => a + b;");
    const r = await scanStandards(tmpDir);
    expect(r.totalComponentFiles).toBe(0);
    expect(r.organizationType).toBe("flat");
  });

  it("counts PascalCase component files", async () => {
    writeFile("src/Button.tsx", `export function Button() { return <button />; }`);
    writeFile("src/Card.tsx", `export function Card() { return <div />; }`);
    const r = await scanStandards(tmpDir);
    expect(r.totalComponentFiles).toBe(2);
    expect(r.pascalCaseFiles).toBe(2);
  });

  it("counts kebab-case files as not PascalCase", async () => {
    writeFile("src/my-button.tsx", `export function MyButton() { return <button />; }`);
    writeFile("src/icon-picker.tsx", `export function IconPicker() { return <div />; }`);
    const r = await scanStandards(tmpDir);
    expect(r.pascalCaseFiles).toBe(0);
    expect(r.kebabCaseFiles).toBe(2);
  });

  it("skips index files in naming counts", async () => {
    writeFile("src/index.tsx", `export { Button } from "./Button";`);
    writeFile("src/Button.tsx", `export function Button() { return <button />; }`);
    const r = await scanStandards(tmpDir);
    expect(r.hasIndexFiles).toBe(1);
    expect(r.totalComponentFiles).toBe(2);
  });

  it("detects default exports", async () => {
    writeFile("src/Button.tsx", `export default function Button() { return <button />; }`);
    const r = await scanStandards(tmpDir);
    expect(r.defaultExports).toBe(1);
  });

  it("detects named exports", async () => {
    writeFile("src/utils.tsx", `export const add = (a: number) => a + 1;
export function sub(a: number) { return a - 1; }
export class Calc {}`);
    const r = await scanStandards(tmpDir);
    expect(r.namedExports).toBe(3);
  });

  it("detects Props interface", async () => {
    writeFile("src/Button.tsx", `interface ButtonProps { label: string; }
export function Button(props: ButtonProps) { return <button>{props.label}</button>; }`);
    const r = await scanStandards(tmpDir);
    expect(r.hasPropsInterface).toBe(true);
  });

  it("detects Props type alias", async () => {
    writeFile("src/Card.tsx", `type CardProps = { title: string; };
export function Card(props: CardProps) { return <div />; }`);
    const r = await scanStandards(tmpDir);
    expect(r.hasPropsInterface).toBe(true);
  });

  it("reports when no Props interface exists", async () => {
    writeFile("src/Button.tsx", `export function Button(props: { label: string }) { return <button />; }`);
    const r = await scanStandards(tmpDir);
    expect(r.hasPropsInterface).toBe(false);
  });

  it("identifies large files (>400 lines)", async () => {
    const lines = Array.from({ length: 450 }, (_, i) => `// line ${i + 1}`).join("\n");
    writeFile("src/Huge.tsx", `export function Huge() { return <div />; }\n${lines}`);
    const r = await scanStandards(tmpDir);
    expect(r.largeFiles).toHaveLength(1);
  });

  it("does not flag small files as large", async () => {
    writeFile("src/Small.tsx", `export function Small() { return <div />; }`);
    const r = await scanStandards(tmpDir);
    expect(r.largeFiles).toEqual([]);
  });

  it("calculates average lines per component", async () => {
    writeFile("src/A.tsx", "x\n".repeat(10));
    writeFile("src/B.tsx", "x\n".repeat(20));
    const r = await scanStandards(tmpDir);
    expect(r.avgLinesPerComponent).toBe(16);
  });

  it("identifies flat organization when most dirs have single components", async () => {
    writeFile("src/atoms/Button.tsx", `export function Button() { return <button />; }`);
    writeFile("src/molecules/Card.tsx", `export function Card() { return <div />; }`);
    writeFile("src/utils/helpers.ts", "export const add = (a: number, b: number) => a + b;");
    const r = await scanStandards(tmpDir);
    expect(r.organizationType).toBe("flat");
  });

  it("identifies feature-folder organization", async () => {
    writeFile("src/button/Button.tsx", `export function Button() { return <button />; }`);
    writeFile("src/button/Button.test.tsx", `test("works", () => {})`);
    writeFile("src/card/Card.tsx", `export function Card() { return <div />; }`);
    writeFile("src/card/Card.test.tsx", `test("works", () => {})`);
    const r = await scanStandards(tmpDir);
    expect(r.organizationType).toBe("feature-folders");
  });

  it("skips node_modules, dist, .git directories", async () => {
    writeFile("node_modules/lib/btn.tsx", `export function Btn() { return <button />; }`);
    writeFile("dist/bundle.tsx", `export function Widget() { return <div />; }`);
    writeFile(".git/hooks/post.tsx", `export function Hook() { return <div />; }`);
    writeFile("src/Button.tsx", `export function Button() { return <button />; }`);
    const r = await scanStandards(tmpDir);
    expect(r.totalComponentFiles).toBe(1);
  });

  it("handles large files gracefully (over 500KB)", async () => {
    const large = "x".repeat(510_000);
    writeFile("src/Huge.tsx", large);
    const r = await scanStandards(tmpDir);
    expect(r.totalComponentFiles).toBe(1);
  });

  it("processes .js and .jsx files", async () => {
    writeFile("src/Button.jsx", `export default function Button() { return <button />; }`);
    writeFile("src/utils.js", `export const add = (a) => a + 1;`);
    const r = await scanStandards(tmpDir);
    expect(r.totalComponentFiles).toBe(1);
    expect(r.pascalCaseFiles).toBe(1);
    expect(r.namedExports).toBeGreaterThanOrEqual(1);
  });
});
