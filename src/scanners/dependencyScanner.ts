import fs from "fs";
import path from "path";
import { resolveProjectPath } from "../projectPaths";

interface DependencyReport {
  unusedDependencies: string[];
  heavyDependencies: Array<{ name: string; sizeKb: number }>;
}

export async function scanDependencies(projectRoot: string): Promise<DependencyReport> {
  const pkgPath = resolveProjectPath(projectRoot, "package.json", "package.json");
  if (!fs.existsSync(pkgPath)) {
    return { unusedDependencies: [], heavyDependencies: [] };
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const deps = Object.keys(pkg.dependencies || {});
  
  // Heavy dependencies heuristic (checking node_modules size roughly if it exists)
  const heavyDependencies: Array<{ name: string; sizeKb: number }> = [];
  const nodeModulesPath = path.join(projectRoot, "node_modules");
  
  for (const dep of deps) {
    const depPath = path.join(nodeModulesPath, dep);
    if (fs.existsSync(depPath)) {
      try {
        // Quick naive size check (just main dir files, not recursive for speed, or just flag known heavy ones)
        // For a true 1.0 we just flag known heavy ones if we can't deeply scan quickly.
        const knownHeavy = ["lodash", "moment", "moment-timezone", "rxjs", "three", "echarts", "d3"];
        if (knownHeavy.includes(dep)) {
          heavyDependencies.push({ name: dep, sizeKb: 0 }); // Placeholder size
        }
      } catch {
        // ignore
      }
    }
  }

  // Scan src for usage
  const srcPath = path.join(projectRoot, "src");
  let allContent = "";
  if (fs.existsSync(srcPath)) {
    const files = findFilesRecursively(srcPath, /\.(ts|tsx|js|jsx)$/);
    for (const file of files) {
      allContent += fs.readFileSync(file, "utf8") + "\n";
    }
  }

  const unusedDependencies = deps.filter(dep => {
    // If it's a types package or internal tool, ignore
    if (dep.startsWith("@types/") || dep === "typescript" || dep === "react-scripts" || dep.includes("eslint")) return false;
    
    // Check if imported
    // matches: import ... from 'dep', require('dep'), or import('dep')
    const regex = new RegExp(`(from|require\\(|import\\()\\s*['"]${dep}(/[^'"]+)?['"]`, "i");
    return !regex.test(allContent);
  });

  return { unusedDependencies, heavyDependencies };
}

function findFilesRecursively(dir: string, pattern: RegExp): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.resolve(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(findFilesRecursively(filePath, pattern));
    } else if (pattern.test(filePath)) {
      results.push(filePath);
    }
  }
  return results;
}
