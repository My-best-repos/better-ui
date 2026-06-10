import fs from "fs";
import path from "path";
import { resolveProjectPath } from "./projectPaths";

interface BetterUiConfig {
  projectName?: string;
  preset?: string;
  defaults?: {
    reportFile?: string;
    extensions?: string[];
  };
  scripts?: {
    scan?: string;
    fix?: string;
  };
}

export function getConfigPath(projectRoot: string) {
  return resolveProjectPath(projectRoot, "better-ui.config.json", "Config file");
}

export function loadConfig(projectRoot: string): BetterUiConfig {
  const configPath = getConfigPath(projectRoot);
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as BetterUiConfig;
  } catch (err) {
    console.warn(`Warning: could not read ${configPath}: ${err}`);
    return {};
  }
}

export function getProjectLabel(projectRoot: string, config: BetterUiConfig) {
  return config.projectName?.trim() || path.basename(projectRoot) || "better-ui";
}

export function getReportFile(projectRoot: string, config: BetterUiConfig, explicitOut?: string, format?: "json" | "markdown" | "html", command?: string, createDir = false) {
  if (explicitOut) {
    return resolveProjectPath(projectRoot, explicitOut, "Report output");
  }

  if (command) {
    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const h = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    const ts = `${y}-${mo}-${d}T${h}${mi}${s}`;
    const ext = format === "html" ? "html" : format === "markdown" ? "md" : "json";
    const relPath = path.join(".reports", command, `${command}-${ts}.${ext}`);
    const fullPath = resolveProjectPath(projectRoot, relPath, "Report output");
    if (createDir) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    }
    return fullPath;
  }

  const fallback = format === "html" ? "report.html" : format === "markdown" ? "report.md" : "report.txt";
  const configuredDefault = config.defaults?.reportFile;
  const configuredPath = (configuredDefault && format === "html" && /\.(json|txt)$/i.test(configuredDefault) ? configuredDefault.replace(/\.(json|txt)$/i, ".html") : undefined)
    || (configuredDefault && format === "markdown" && /\.(json|txt)$/i.test(configuredDefault) ? configuredDefault.replace(/\.(json|txt)$/i, ".md") : undefined)
    || configuredDefault
    || fallback;
  return resolveProjectPath(projectRoot, configuredPath, "Report output");
}

export function getExtensions(config: BetterUiConfig, explicitExts?: string[]) {
  return explicitExts && explicitExts.length > 0 ? explicitExts : config.defaults?.extensions;
}

export function detectFramework(projectRoot: string): string[] {
  const pkgPath = resolveProjectPath(projectRoot, "package.json", "package.json");
  if (!fs.existsSync(pkgPath)) return ["vanilla"];
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const stack: string[] = [];
    if (deps["next"]) stack.push("Next.js");
    else if (deps["nuxt"]) stack.push("Nuxt");
    else if (deps["@remix-run/react"]) stack.push("Remix");
    
    if (deps["react"] && !stack.includes("Next.js") && !stack.includes("Remix")) stack.push("React");
    if (deps["vue"] && !stack.includes("Nuxt")) stack.push("Vue");
    if (deps["svelte"]) stack.push("Svelte");
    
    if (deps["vite"]) stack.push("Vite");
    if (deps["tailwindcss"]) stack.push("Tailwind");
    if (deps["typescript"]) stack.push("TypeScript");
    
    return stack.length > 0 ? stack : ["vanilla"];
  } catch {
    return ["vanilla"];
  }
}

