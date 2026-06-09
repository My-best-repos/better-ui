import fs from "fs";
import path from "path";
import { walk, readFileSafe } from "./scannerUtils";

export interface StackAuditReport {
  frameworks: string[];
  buildTool: string | null;
  testRunner: string | null;
  linter: string | null;
  formatter: string | null;
  cssFramework: string | null;
  packageManager: string | null;
  nodeVersion: string | null;
  typescriptVersion: string | null;
  hasCiConfig: boolean;
  hasDockerfile: boolean;
  hasPreCommitHooks: boolean;
  hasStorybook: boolean;
  hasMonorepoConfig: boolean;
  hasBundleAnalyzer: boolean;
  recommendations: string[];
  score: number;
}

export async function scanStackAudit(projectRoot: string): Promise<StackAuditReport> {
  const pkgPath = path.join(projectRoot, "package.json");
  const pkg: Record<string, any> = fs.existsSync(pkgPath)
    ? JSON.parse(fs.readFileSync(pkgPath, "utf8"))
    : {};

  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };
  const depNames = Object.keys(allDeps);

  const frameworks: string[] = [];
  const frameworkMap: Record<string, string> = {
    react: "React",
    next: "Next.js",
    vue: "Vue",
    nuxt: "Nuxt",
    svelte: "Svelte",
    "@sveltejs/kit": "SvelteKit",
    "@angular/core": "Angular",
    remix: "Remix",
    gatsby: "Gatsby",
    astro: "Astro",
    "solid-js": "SolidJS",
    preact: "Preact",
  };
  for (const dep of depNames) {
    if (frameworkMap[dep]) {
      if (!frameworks.includes(frameworkMap[dep])) frameworks.push(frameworkMap[dep]);
    }
  }

  let buildTool: string | null = null;
  const buildToolMap: Record<string, string> = {
    vite: "Vite",
    next: "Next.js",
    "react-scripts": "CRA",
    gatsby: "Gatsby",
    astro: "Astro",
    "@vue/cli-service": "Vue CLI",
    "webpack-cli": "webpack",
    parcel: "Parcel",
    turbopack: "Turbopack",
    esbuild: "esbuild",
    rollup: "Rollup",
  };
  for (const dep of depNames) {
    if (buildToolMap[dep]) {
      buildTool = buildToolMap[dep];
      break;
    }
  }

  let testRunner: string | null = null;
  const testRunnerMap: Record<string, string> = {
    vitest: "Vitest",
    jest: "Jest",
    mocha: "Mocha",
    ava: "AVA",
    tape: "Tape",
    playwright: "Playwright",
    cypress: "Cypress",
    "@playwright/test": "Playwright",
    "@testing-library/react": "Testing Library",
  };
  for (const dep of depNames) {
    if (testRunnerMap[dep]) {
      testRunner = testRunnerMap[dep];
      break;
    }
  }

  let linter: string | null = null;
  if (depNames.some(d => d === "eslint" || d.startsWith("@eslint"))) linter = "ESLint";
  else if (depNames.some(d => d.startsWith("prettier"))) linter = "Prettier";

  let formatter: string | null = null;
  if (depNames.some(d => d === "prettier")) formatter = "Prettier";
  else if (depNames.some(d => d === "dprint")) formatter = "dprint";

  let cssFramework: string | null = null;
  const cssFrameworkMap: Record<string, string> = {
    tailwindcss: "Tailwind CSS",
    bootstrap: "Bootstrap",
    "bulma": "Bulma",
    "foundation-sites": "Foundation",
    "@chakra-ui/react": "Chakra UI",
    "@mui/material": "Material UI",
    antd: "Ant Design",
    "@radix-ui": "Radix",
  };
  for (const dep of depNames) {
    if (cssFrameworkMap[dep]) {
      cssFramework = cssFrameworkMap[dep];
      break;
    }
  }
  if (!cssFramework && depNames.some(d => d.startsWith("shadcn") || d === "@shadcn/ui")) cssFramework = "shadcn";

  let packageManager: string | null = null;
  if (fs.existsSync(path.join(projectRoot, "pnpm-lock.yaml"))) packageManager = "pnpm";
  else if (fs.existsSync(path.join(projectRoot, "yarn.lock"))) packageManager = "yarn";
  else if (fs.existsSync(path.join(projectRoot, "package-lock.json"))) packageManager = "npm";
  else if (fs.existsSync(path.join(projectRoot, "bun.lockb"))) packageManager = "bun";

  const nodeVersion: string | null = pkg.engines?.node || null;
  const typescriptVersion: string | null = allDeps.typescript || null;

  const hasCiConfig = fs.existsSync(path.join(projectRoot, ".github", "workflows"))
    || fs.existsSync(path.join(projectRoot, ".gitlab-ci.yml"))
    || fs.existsSync(path.join(projectRoot, "Jenkinsfile"))
    || fs.existsSync(path.join(projectRoot, "circleci", "config.yml"));

  const hasDockerfile = fs.existsSync(path.join(projectRoot, "Dockerfile"));

  const hasPreCommitHooks = fs.existsSync(path.join(projectRoot, ".husky"))
    || fs.existsSync(path.join(projectRoot, ".lintstagedrc"))
    || depNames.some(d => d === "lint-staged");

  const hasStorybook = depNames.some(d => d === "storybook" || d.startsWith("@storybook/"))
    || fs.existsSync(path.join(projectRoot, ".storybook"));

  const hasMonorepoConfig = fs.existsSync(path.join(projectRoot, "lerna.json"))
    || fs.existsSync(path.join(projectRoot, "nx.json"))
    || fs.existsSync(path.join(projectRoot, "turbo.json"))
    || Boolean(pkg.workspaces);

  const hasBundleAnalyzer = depNames.some(d =>
    d === "webpack-bundle-analyzer"
    || d === "vite-bundle-visualizer"
    || d === "rollup-plugin-visualizer"
  );

  const recommendations: string[] = [];
  if (!linter) recommendations.push("Add a linter (ESLint) to enforce code quality and consistency");
  if (!formatter) recommendations.push("Add a code formatter (Prettier) for consistent code style");
  if (!testRunner) recommendations.push("Add a test runner (Vitest or Jest) for automated testing");
  if (!hasCiConfig) recommendations.push("Set up CI (GitHub Actions, GitLab CI, or CircleCI) for automated checks");
  if (!hasPreCommitHooks) recommendations.push("Add pre-commit hooks (husky + lint-staged) to catch issues before commits");
  if (!cssFramework && frameworks.length > 0) recommendations.push("Consider a CSS framework (Tailwind CSS, CSS Modules) for scalable styling");
  if (!typescriptVersion) recommendations.push("Add TypeScript for type safety and better developer experience");
  if (!hasDockerfile) recommendations.push("Add a Dockerfile for consistent deployment and development environments");
  if (!hasStorybook) recommendations.push("Consider Storybook for component development and visual testing");
  if (!hasBundleAnalyzer) recommendations.push("Add a bundle analyzer to monitor and optimize bundle size");

  const essentials = [linter, formatter, testRunner, hasCiConfig, hasPreCommitHooks, typescriptVersion].filter(Boolean);
  const totalEssential = 6;
  const score = Math.round((essentials.length / totalEssential) * 100);

  return {
    frameworks,
    buildTool,
    testRunner,
    linter,
    formatter,
    cssFramework,
    packageManager,
    nodeVersion,
    typescriptVersion,
    hasCiConfig,
    hasDockerfile,
    hasPreCommitHooks,
    hasStorybook,
    hasMonorepoConfig,
    hasBundleAnalyzer,
    recommendations,
    score,
  };
}
