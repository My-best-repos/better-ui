import fs from "fs";
import path from "path";
import { walk, readFileSafe } from "./scannerUtils";

export interface LegacyPattern {
  type: string;
  count: number;
  files: string[];
  description: string;
  migration: string;
}

export interface MigrationReport {
  legacyPatterns: LegacyPattern[];
  recommendations: string[];
  score: number;
}

type PatternDetector = {
  type: string;
  description: string;
  migration: string;
  test: (content: string, file: string, deps?: Set<string>) => boolean;
};

const PATTERNS: PatternDetector[] = [
  {
    type: "class-component",
    description: "React class components using React.Component or Component",
    migration: "Migrate to function components with hooks",
    test: (content) => /class\s+\w+\s+extends\s+(React\.)?Component/.test(content),
  },
  {
    type: "proptypes",
    description: "PropTypes for runtime type checking",
    migration: "Replace with TypeScript props interface",
    test: (content) => /import\s+PropTypes/.test(content) || /\.propTypes\s*=/.test(content),
  },
  {
    type: "create-element",
    description: "React.createElement() calls",
    migration: "Use JSX syntax instead",
    test: (content) => /React\.createElement\(/.test(content),
  },
  {
    type: "legacy-lifecycle",
    description: "Legacy lifecycle methods (componentWillMount, componentWillReceiveProps, componentWillUpdate)",
    migration: "Rename with UNSAFE_ prefix or migrate to modern lifecycle / hooks",
    test: (content) => /\bcomponentWillMount\b|\bcomponentWillReceiveProps\b|\bcomponentWillUpdate\b/.test(content),
  },
  {
    type: "dangerously-set-html",
    description: "dangerouslySetInnerHTML usage",
    migration: "Sanitize HTML before rendering or use a safe rendering library",
    test: (content) => /\bdangerouslySetInnerHTML\b/.test(content),
  },
  {
    type: "any-type",
    description: "`any` type annotations in TypeScript files",
    migration: "Replace with proper TypeScript types or interfaces",
    test: (content, file) => /\.tsx?$/i.test(file) && /:\s*any\b(?!\s*\[)/.test(content),
  },
  {
    type: "require-cjs",
    description: "require() calls in files using ES module syntax",
    migration: "Replace require() with ES module import statements",
    test: (content) => {
      const hasImport = /import\s/.test(content) || /export\s/.test(content);
      return hasImport && /\brequire\s*\(/.test(content);
    },
  },
  {
    type: "enzyme",
    description: "Enzyme testing library imports",
    migration: "Migrate to React Testing Library for component tests",
    test: (content) => /from\s+['"]enzyme['"]/.test(content) || /require\s*\(\s*['"]enzyme['"]/.test(content),
  },
  {
    type: "cra-react-scripts",
    description: "Create React App (react-scripts) dependency",
    migration: "Migrate to Vite or Next.js for faster builds and better defaults",
    test: (_content, _file, deps?) => deps?.has("react-scripts") ?? false,
  },
  {
    type: "next-pages-router",
    description: "Next.js Pages Router (getServerSideProps, getStaticProps, pages/_app)",
    migration: "Migrate to Next.js App Router (app/ directory, server components)",
    test: (content) => /\bgetServerSideProps\b|\bgetStaticProps\b/.test(content) || /pages\/_app/.test(content),
  },
  {
    type: "find-dom-node",
    description: "findDOMNode() calls",
    migration: "Use refs (useRef / createRef) instead of findDOMNode",
    test: (content) => /\bfindDOMNode\s*\(/.test(content),
  },
  {
    type: "default-props",
    description: "defaultProps on function components",
    migration: "Use default parameter values in the function signature",
    test: (content) => /\.defaultProps\s*=/.test(content),
  },
];

export async function scanMigrationIssues(projectRoot: string): Promise<MigrationReport> {
  const files = walk(projectRoot, new Set([".js", ".jsx", ".ts", ".tsx"]));

  const pkgPath = path.join(projectRoot, "package.json");
  const pkg: Record<string, any> = fs.existsSync(pkgPath)
    ? JSON.parse(fs.readFileSync(pkgPath, "utf8"))
    : {};
  const allDeps = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ]);

  const patternResults: Map<string, { count: number; files: string[] }> = new Map();

  for (const file of files) {
    const content = readFileSafe(file);
    if (!content) continue;

    for (const pattern of PATTERNS) {
      const matches = pattern.test(content, file, allDeps);
      if (!matches) continue;

      const existing = patternResults.get(pattern.type) || { count: 0, files: [] };
      existing.count++;
      if (existing.files.length < 5) {
        existing.files.push(path.relative(projectRoot, file));
      }
      patternResults.set(pattern.type, existing);
    }
  }

  const legacyPatterns: LegacyPattern[] = [];
  const recommendations: string[] = [];

  for (const pattern of PATTERNS) {
    const result = patternResults.get(pattern.type);
    const count = result?.count ?? 0;

    legacyPatterns.push({
      type: pattern.type,
      count,
      files: result?.files ?? [],
      description: pattern.description,
      migration: pattern.migration,
    });

    if (count > 0) {
      recommendations.push(`[${pattern.type}] ${pattern.description} (${count} occurrence(s)) — ${pattern.migration}`);
    }
  }

  const typesFound = legacyPatterns.filter(p => p.count > 0).length;
  const score = Math.max(0, 100 - typesFound * 10);

  return { legacyPatterns, recommendations, score };
}
