# Actual CLI Surface (Commands & Purpose)

This document describes every command available in the CLI, their flags, and behaviors. Use this as the canonical reference for automation or development.

The repository and product name are `better-ui`. The published npm package and executable are `better-ui-cli`.

The CLI is slash-only at the top level. Use `/scan`, `/doctor`, `/menu`, and similar forms.

## Commands

### `scan` — Full project scan

Runs ESLint, TypeScript diagnostics, and frontend heuristics across the project. Produces a report with scoring, categories, and hotspots.

**Output:** report file (json/markdown/html). By default saves to `reports/scan/scan-<ISO>.json`.

**Flags:**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--out <path>` | string | — | Explicit output path (overrides default naming) |
| `--format <format>` | json \| markdown \| html | json | Report format |
| `--ext <exts>` | string | — | Comma-separated file extensions (e.g. `.js,.ts`) |
| `--changed` | boolean | off | Scan only modified and untracked git files |
| `--staged` | boolean | off | Scan only staged git files |
| `--top <n>` | number | 5 | Number of hotspots to display in the summary |
| `--scan-images` | boolean | off | Also run the image scanner during the scan |
| `--open` | boolean | off | Open the HTML report in the default browser (requires `--format html`) |
| `--verbose` | boolean | off | Show extended output after the scan (e.g. raw report path) |
| `--no-save` | boolean | off | Skip writing the report to disk (result stays in memory) |

---

### `fix` — Preview or apply ESLint autofixes

Dry-run by default — shows what would change without writing anything.

**Flags:**

| Flag | Type | Description |
|------|------|-------------|
| `--apply` | boolean | Write the safe autofixes to disk |
| `--interactive` | boolean | Start hunk-level interactive selection flow |
| `--changed` | boolean | Scope to modified and untracked files |
| `--staged` | boolean | Scope to staged files only |

The interactive flow (`--interactive`) parses each file's diff into selection hunks, shows a preview for each hunk, and asks you to confirm before writing.

---

### `health` — Project health score

Builds a numeric health score (0-100) with per-category breakdowns, issue counts, recommendations, and image payload summary.

No additional flags. Sources data from `src/insights.ts`.

---

### `doctor` — Project diagnostic

Checks config completeness, missing `package.json` scripts, ESLint configuration, TypeScript configuration, and detects the active framework.

No additional flags.

---

### `deps` — Dependency scanner

Scans `package.json` dependencies against actual `import`/`require` usage in `src/`. Reports:

- **Unused dependencies** — packages listed but never imported.
- **Heavy dependencies** — known large packages (lodash, moment, three, etc.) with suggestions for lighter alternatives.

No additional flags.

---

### `hotspots` — High-risk file ranking

Ranks files by combined error/warning severity and issue density. See `docs/hotspots-command.md` for the full reference.

**Flags:**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--top <n>` | number | 10 | Number of hotspots to display |
| `--density` | boolean | off | Sort by issues per line of code instead of absolute score |
| `--min-score <n>` | number | 0 | Minimum score threshold for inclusion |

---

### `check-accessibility` / `/a11y` — Accessibility filter

Filters the full scan to accessibility-related findings only (rules tagged under the `accessibility` category).

**Flags:** `--changed`, `--staged`.

---

### `review` — PR-style review

Generates a PR-style markdown summary for changed, staged, or all files. Output includes an executive summary, critical issue list, and per-file findings.

**Flags:**

| Flag | Type | Description |
|------|------|-------------|
| `--changed` | boolean | Scope to modified and untracked files |
| `--staged` | boolean | Scope to staged files only |
| `--out <path>` | string | Write the summary to a file (e.g. `review.md`) |
| `--format <format>` | json \| markdown \| html | Output format (default: markdown) |
| `--no-save` | boolean | Skip writing to disk |

---

### `pr-summary` — Pull request summary

Produces a PR-ready markdown document summarizing the current branch's health impact, defaulting to changed files. Ready to paste into GitHub or GitLab.

**Flags:** same as `review` (`--changed`, `--staged`, `--out`, `--format`, `--no-save`).

---

### `explain [target]` — Issue explanations

Converts raw lint findings into human-friendly why/fix/risk guidance. Optionally accepts a file path to scope the explanation to a single file.

**Output:** per-rule explanation with why the issue matters, how to fix it, and the estimated risk level. Sources data from `src/explanations.ts`.

---

### `images` — Image scanner and WebP generation

Discovers `.png`, `.jpg`, `.jpeg` assets and reports their size. With `--generate`, creates `.webp` sibling copies using `sharp`.

**Flags:**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--generate` | boolean | off | Generate WebP files for discovered images |
| `--quality <n>` | number | 75 | WebP quality 1-100 |

---

### `init` — Project bootstrap

Creates `better-ui.config.json` with optional project presets and injects informational `better-ui:*` scripts into `package.json`.

**Flags:**

| Flag | Type | Description |
|------|------|-------------|
| `--preset <name>` | string | Preset to apply: `react`, `next`, `vite`, `landing-page`, `typescript-library` |

See `docs/presets-reference.md` for the full preset reference.

---

### `tui` / `/menu` — Interactive command center

Opens the full-screen terminal UI with a grid dashboard and command palette (Ctrl+Shift+S).

- Non-scan commands open with a compact `Run Summary` block.
- `/scan` keeps the detailed `Scan Summary` with score bar.
- Type `/` at the prompt to enter a slash command or `a` to return to the dashboard.
- `Esc` exits the TUI cleanly.
- Slash aliases are handled by `src/slashCommands.ts`.

See `docs/tui-command-palette.md` and `docs/tui-slash-actions.md` for details.

---

### `commands` — Command catalog

Prints the full list of available slash commands with descriptions and examples. Same output as the TUI command palette.

---

### `advanced` — Power-user cheat sheet

Renders a categorized cheat sheet with advanced flags, subcommands, and hidden pro-tips. In-app equivalent of `docs/advanced-commands.md`.

---

### `ui-audit` — UI surface audit

Scans file distribution, CSS methodology, semantic HTML, responsive breakpoints, font loading. Returns a 0-100 UI score. Accepts `--out <file>` to save a report.

### `ui-colors` — Color palette scan

Scans hex, rgb, hsl, and Tailwind color declarations across CSS and component files. Reports unique colors, frequency, inconsistencies, and CSS custom properties. Accepts `--out <file>`.

### `ui-standards` — Component standards analysis

Analyzes file naming (PascalCase vs kebab-case), export patterns, props interfaces, file size, and organization type (flat vs feature-folders). Accepts `--out <file>`.

### `ui-typography` — Typography audit

Audits font families, sizes, line-heights, weights, letter-spacing, transforms, decorations, custom `@font-face`, and Tailwind typography utilities. Flags missing line-height and generates recommendations. No output flags.

### `ui-spacing` — Spacing scan

Scans margins, paddings, gaps, position properties, and spacing unit consistency. Flags mixed units (px + rem) and excessive unique values. No output flags.

## Scoring formula

The health score (0–100) is computed from aggregate file results:

```
total = sum of (errorCount + floor(warningCount / 2))
score = max(0, 100 - min(100, total))
```

Each error contributes 1 point, each pair of warnings contributes 1 point. The maximum penalty is capped at 100, so the minimum score is 0.

## Report format details

### JSON and HTML companion files

When writing JSON (`--format json`) or HTML (`--format html`) reports, the system also writes a companion `.txt` file containing a Markdown summary of the same report alongside the primary file. For example:

- `report.json` → also writes `report.txt`
- `report.html` → also writes `report.txt`

This ensures a human-readable summary is always available alongside machine-oriented formats.

### HTML report template

The HTML reporter generates a minimal template — the entire report is embedded as formatted JSON inside `<pre>` tags. It is not a rich visual dashboard; it is a quick way to view the report in a browser.

## Report output structure

When no explicit `--out` path is provided, commands save reports to per-command subdirectories under `reports/`:

```
reports/
├── scan/
│   ├── scan-2026-06-03T125355.json
│   └── scan-2026-06-03T125500.md
└── review/
    └── review-2026-06-03T130000.md
```

The file extension depends on the format: `.json` for json, `.md` for markdown, `.html` for html. The timestamp is ISO-8601 compact format.

## Slash aliases

The CLI supports slash-style aliases via `src/slashCommands.ts` and rejects non-slash top-level invocations. Every primary menu action in the TUI has a slash equivalent.

**Full alias list:** `/scan`, `/changed`, `/staged`, `/fix`, `/fix-preview`, `/fix-apply`, `/fix-interactive`, `/health`, `/doctor`, `/hotspots`, `/a11y`, `/review`, `/review-changed`, `/review-staged`, `/pr-summary`, `/deps`, `/explain`, `/images`, `/init`, `/advanced`, `/menu`, `/commands`, `/help`, `/exit`, `/ui-audit`, `/ui-colors`, `/ui-standards`, `/ui-typography`, `/ui-spacing`.

## Notes for automation and AI agents

- The output formats are deterministic JSON/Markdown/HTML; automated consumers should prefer JSON for machine parsing.
- When applying fixes automatically, prefer creating a branch or making a reviewable PR. `fix --interactive` is safer because it limits writes to selected hunks.
- Reports are saved under `reports/<command>/` by default. Use `--out` or `--no-save` to control output behavior.
