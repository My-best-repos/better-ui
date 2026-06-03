# Scanner Details & Limitations

## Scan engine

- Primary engine: programmatic ESLint with `@typescript-eslint` for parsing TypeScript and JSX.
- Additional checks: TypeScript pre-emit diagnostics are included for `.ts` and `.tsx` files (via the TypeScript compiler API).
- Normalization: messages are normalized, deduplicated, and sorted before reporting to make downstream tooling deterministic.

## Default scope and exclusions

- Default extensions: `.js`, `.jsx`, `.ts`, `.tsx` (configurable via `better-ui.config.json`).
- The scanner respects project ignore configurations and skips `node_modules`, `.git`, `dist`, and symlinks.
- ESLint config search order: `eslint.config.js`, `.mjs`, `.cjs`, `.ts`, `.mts`, `.cts`.

## Score formula

The health score (0-100) is computed per-file and aggregated:

```
total = sum of (errorCount + floor(warningCount / 2)) across all files
score = max(0, 100 - min(100, total))
```

Each error counts as 1 point, each pair of warnings counts as 1 point, clamped to a maximum penalty of 100.

## Custom heuristic rules (ESLint fallback)

When ESLint cannot analyze a file (parser error, plugin load failure), the scanner falls back to regex-based heuristics. These run on ALL scanned files even when ESLint succeeds, except for the fallback trio which only run when ESLint fails.

### Always-active heuristics (JSX/TSX only)

| Rule | Severity | Category | Description |
|------|----------|----------|-------------|
| `better-ui/large-file` | warning | maintainability | Files exceeding 350 lines of code |
| `better-ui/img-alt` | warning | accessibility | `<img>` element missing an `alt` attribute |
| `better-ui/clickable-div` | warning | accessibility | `<div>` with `onClick` — prefer a semantic `<button>` |
| `better-ui/inline-style` | warning | maintainability | Inline `style={{}}` objects that hinder theming |
| `better-ui/empty-button` | warning | accessibility | `<button>` with no visible text content |
| `better-ui/input-label` | warning | accessibility | `<input>` without `aria-label`, `aria-labelledby`, or `title` |
| `better-ui/list-key` | warning | performance | `.map()` returning JSX without a `key` prop |
| `better-ui/heading-order` | warning | accessibility | Heading level jumps (e.g. `h2` → `h4`) |

### ESLint-failure fallbacks (regex only)

When no ESLint config is found or ESLint fails:

| Rule | Severity | Description |
|------|----------|-------------|
| `no-console` | warn | `console.log` / `console.error` statements |
| `eqeqeq` | error | Loose equality (`==`) — prefer strict (`===`) |
| `@typescript-eslint/no-unused-vars` | warn | Variables declared but never used |

The default ESLint config (used when no `eslint.config.*` file exists) enables these same three rules in addition to the full `@typescript-eslint` plugin and parser setup.

## Data shape (example)

```json
{
  "file": "src/components/App.tsx",
  "ruleId": "no-console",
  "message": "Unexpected console statement.",
  "severity": "warning",
  "line": 42,
  "column": 5,
  "category": "correctness",
  "impact": "medium",
  "fixable": false,
  "source": "eslint"
}
```

## Limitations

- Heuristics are not a substitute for semantic AST-based analysis for accessibility or complex code patterns.
- The hunk-based interactive fixer uses a line-diff LCS algorithm. It is robust for normal edits but not a full git-style patch engine. Confirm behavior before applying to large or critical files.
- The scanner is intentionally local-only and does not attempt to reach external services for additional analysis.
- Heuristic rules are regex-based and may produce false positives or miss edge cases that an AST-aware tool would catch.
