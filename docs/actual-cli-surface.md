
# Actual CLI Surface (Commands & Purpose)

This document describes the primary commands available in the CLI, what they do, and common flags. Use this as a quick reference for automation or development.

The repository and product name are `better-ui`. The published npm package and executable are `better-ui-cli`.

Key commands (brief):

- The CLI is slash-only at the top level. Use `/scan`, `/doctor`, `/menu`, and similar forms.

- `scan` — Runs scanners across the project and produces a report.
  - Formats: `json` (default), `markdown`, `html` (`--format`)
  - Output: `--out <path>`; descriptive filename `<command>-<MMDDTHHMMSS>.<ext>` by default
  - Performs a full scan of the current project and produces a report tagged with the project name.
  - Advanced flags: `--top <n>`, `--scan-images`, `--open`
  - Terminal output: keeps the full `Scan Summary`, richer-workflows hint, and score bar

- `fix` — Applies autofixes or previews. Dry-run by default.
  - `--apply` to write ESLint autofixes to disk.
  - `--interactive` starts a hunk-level interactive selection flow.

- `health` — Builds a numeric health score and category summaries (uses `src/insights.ts`).

- `doctor` — Runs project readiness checks (config, scripts, typical pitfalls) and reports suggestions.

- `deps` — Finds unused dependencies and warns about known heavy frontend libraries.

- `advanced` — Shows the built-in cheat sheet for advanced flags, TUI prompt flow, and high-leverage commands.

- `check-accessibility` — Filters scan results to accessibility-related findings.

- `explain` — Converts raw findings into human-friendly why/fix/risk guidance (uses `src/explanations.ts`).

- `review` — Git-aware review flows. Common flags: `--changed`, `--staged`.

- `pr-summary` — Produces a PR-ready markdown summary of changed files and high-priority findings.



- `hotspots` — Outputs files ranked by combined severity/volume to help prioritize fixes.

- `images` — Scans images and can generate `.webp` variants. Use `--generate` to create webp files.

- `init` — Bootstraps `better-ui.config.json` and can inject `better-ui:*` scripts into `package.json`. Supports presets: `react`, `next`, `vite`, `vue`, `design-system`, `landing-page`, `typescript-library`.

- `tui` / `/menu` — Starts the interactive terminal UI (prompt-first command center, command palette, dashboards, review flows).
  - Non-scan slash commands open with a compact `Run Summary`; `/scan` keeps the detailed scan summary

- `ui-audit` — Scans UI surface: file distribution, CSS methodology, semantic HTML, responsive breakpoints, and font loading. Returns a 0-100 UI score.
- `ui-colors` — Scans CSS and component files for hex, rgb, hsl, and Tailwind color declarations. Reports unique colors, frequency, and inconsistencies.
- `ui-standards` — Analyzes component naming (PascalCase vs kebab-case), export patterns, Props interfaces, file size, and organization type (flat vs feature-folders).

Slash aliases:

- The CLI supports slash-style aliases via `src/slashCommands.ts` and rejects non-slash top-level invocations.
- Every primary menu action in the TUI has a slash equivalent. The explicit aliases are: `/scan`, `/changed`, `/staged`, `/fix`, `/fix-preview`, `/fix-apply`, `/fix-interactive`, `/health`, `/doctor`, `/hotspots`, `/a11y`, `/review`, `/review-changed`, `/review-staged`, `/pr-summary`, `/deps`, `/explain`, `/images`, `/init`, `/advanced`, `/menu`, `/commands`, `/help`, `/exit`, `/ui-audit`, `/ui-colors`, `/ui-standards`, `/ui-typography`, and `/ui-spacing`.

Notes for automation and AI agents:

- The output formats are deterministic JSON/Markdown/HTML; automated consumers should prefer JSON for machine parsing.
- When applying fixes automatically, prefer creating a branch or making a reviewable PR. `fix --interactive` is safer because it limits writes to selected hunks.
