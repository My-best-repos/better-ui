# Scanner Commands

Six standalone scanners that run **without ESLint or configuration**. Each reads files directly and produces a score (0–100) with file-level details and recommendations.

## Commands

### `/seo` — SEO audit

Scans HTML and JSX/TSX files for 25 SEO checks:

- **Meta & Technical**: charset, viewport (quality-checked), description, theme-color, lang, canonical, favicon, keywords, author, hreflang, robots meta, robots.txt, sitemap.xml
- **Open Graph**: og:title, og:description, og:image, og:url, og:type
- **Twitter Cards**: twitter:card, twitter:title, twitter:description, twitter:image
- **Structured Data**: JSON-LD block count and parse error detection
- **Content**: heading hierarchy (H1-H6, gap detection), multiple H1, semantic elements, image alt text, dimensions, lazy loading, word count
- **Links**: external/internal link count, missing `rel="noopener noreferrer"`, empty hash links
- **Performance SEO**: preload, preconnect, render-blocking scripts and stylesheets

Example output:
```
  Images Missing Alt Text (3):
    src/components/Hero.tsx:45  <img src="banner.jpg" />
    src/pages/About.tsx:12     <img src="team.jpg" />
    src/pages/About.tsx:18     <img src="office.jpg" />
```

Source: `src/scanners/seoScanner.ts`

### `/tech-debt` — Technical debt scan

Scans JS/TS/JSX/TSX/CSS/SCSS files for 11 categories of code smells:

- TODO, FIXME, HACK, XXX comments
- `console.log()` (excluding error/warn)
- `debugger;` statements
- `:any` type annotations
- Loose equality (`==`/`!=`)
- `var` declarations
- Commented-out code blocks
- Empty catch blocks
- Large files (>300 lines)

Each finding is reported with **file:line**. Example:
```
console.log() (47):
  src/cli.ts:840              if (shortSummary) console.log(...)
  ... +46 more
```

Source: `src/scanners/techDebtScanner.ts`

### `/performance` — Performance audit

Analyzes frontend performance across 5 dimensions:

- **Images**: count, total size, oversized (>200KB), missing width/height, missing lazy loading
- **Bundle hints**: heavy imports (lodash, moment, d3, rxjs, three), missing code splitting
- **Render blocking**: scripts and stylesheets in `<head>` without defer/async
- **Resource hints**: preconnect, preload, prefetch counts
- **Caching**: service worker presence, cache policy detection

Each finding is reported with **file:line**. Example:
```
Images Without Dimensions (5):
  src/pages/Home.tsx:88  <img src="hero.jpg" />
  src/pages/Home.tsx:92  <img src="feature.jpg" />
  ... +3 more
```

Source: `src/scanners/performanceScanner.ts`

### `/stack-audit` — Technology stack analysis

Examines `package.json` and project files to detect:

- **Frameworks**: React, Next.js, Vue, Svelte, Angular, Astro, SolidJS, etc.
- **Build tools**: Vite, CRA, webpack, Turbopack, esbuild, Rollup
- **Testing**: Vitest, Jest, Playwright, Cypress, Testing Library
- **Linting/formatting**: ESLint, Prettier
- **CSS frameworks**: Tailwind, Bootstrap, Chakra, Material UI, shadcn, etc.
- **Package manager**: pnpm, yarn, npm, bun
- **Infrastructure**: CI config, Dockerfile, pre-commit hooks, Storybook, monorepo, bundle analyzer

Scored on essential tooling coverage (linter + formatter + test runner + CI + pre-commit + TypeScript).

Source: `src/scanners/stackAuditScanner.ts`

### `/migration` — Migration readiness scan

Detects 12 legacy patterns in JS/TS/JSX/TSX files:

| Pattern | Description | Migration |
|---------|-------------|-----------|
| class-component | React.Component classes | Function components + hooks |
| proptypes | PropTypes imports | TypeScript interfaces |
| create-element | React.createElement() | JSX |
| legacy-lifecycle | componentWillMount, etc. | UNSAFE_ prefix or hooks |
| dangerously-set-html | dangerouslySetInnerHTML | Safe rendering |
| any-type | `:any` annotations | Proper TypeScript types |
| require-cjs | require() with ES imports | ES module imports |
| enzyme | Enzyme imports | React Testing Library |
| cra-react-scripts | react-scripts dependency | Vite or Next.js |
| next-pages-router | getServerSideProps, etc. | App Router |
| find-dom-node | findDOMNode() | useRef / createRef |
| default-props | .defaultProps on functions | Default parameters |

Each pattern shows occurrence count and up to 5 sample files.

Source: `src/scanners/migrationScanner.ts`

### `/fe-score` — Consolidated frontend health score

Aggregates all 5 scanner scores into one weighted score (0–100):

| Scanner | Weight |
|---------|--------|
| SEO | 20% |
| Tech Debt | 20% |
| Performance | 20% |
| Stack & Tooling | 15% |
| Migration Readiness | 15% |

Shows a score bar chart and top 10 consolidated recommendations.

No standalone scanner — built from `runFeScoreWorkflow` in `src/cli/workflows.ts`.

## Common behavior

- All scanners skip `node_modules`, `dist`, `.git`, `build`, `.next`, `.cache`, `.turbo`, `.vercel`
- Files over 500 KB are skipped
- Findings include file path and line number
- Scores: ≥80 green (good), ≥50 yellow (needs work), <50 red (critical)
- All available from both CLI and TUI (`/menu`)
