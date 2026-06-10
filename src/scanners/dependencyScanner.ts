import fs from "fs";
import path from "path";
import { walk, readFileSafe } from "./scannerUtils";

interface DependencyReport {
  unusedDependencies: string[];
  heavyDependencies: Array<{ name: string; sizeKb: number }>;
}

export async function scanDependencies(projectRoot: string): Promise<DependencyReport> {
  const pkgPath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return { unusedDependencies: [], heavyDependencies: [] };
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const deps = Object.keys(pkg.dependencies || {});
  
  const heavyDependencies: Array<{ name: string; sizeKb: number }> = [];
  const nodeModulesPath = path.join(projectRoot, "node_modules");
  
  for (const dep of deps) {
    const depPath = path.join(nodeModulesPath, dep);
    if (fs.existsSync(depPath)) {
      try {
        const knownHeavy = ["lodash", "moment", "moment-timezone", "rxjs", "three", "echarts", "d3"];
        if (knownHeavy.includes(dep)) {
          heavyDependencies.push({ name: dep, sizeKb: 0 });
        }
      } catch {
        // ignore
      }
    }
  }

  const scriptFiles = walk(projectRoot, new Set([".ts", ".tsx", ".js", ".jsx"]));
  let allContent = "";
  for (const file of scriptFiles) {
    const c = readFileSafe(file);
    if (c) allContent += c + "\n";
  }

  const unusedDependencies = deps.filter(dep => {
    if (dep.startsWith("@types/") || dep === "typescript" || dep === "react-scripts" || dep.includes("eslint")) return false;
    const regex = new RegExp(`(from|require\\(|import\\()\\s*['"]${dep}(/[^'"]+)?['"]`, "i");
    return !regex.test(allContent);
  });

  return { unusedDependencies, heavyDependencies };
}
