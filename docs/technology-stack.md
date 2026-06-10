# Technology Stack

`better-ui` is a local-first Node.js CLI/TUI. This file gives contributors a quick map of the main technologies and why they exist in the project.

## Quick path

1. Run `pnpm install`
2. Run `pnpm typecheck && pnpm lint && pnpm build`
3. Open `npx ts-node src/cli.ts /menu` or run `npx ts-node src/cli.ts /scan`

## Stack

| Area | Technology | Why it is used |
|------|------------|----------------|
| Runtime | `Node.js 22+` | Required by the pinned pnpm setup and CLI runtime |
| Language | `TypeScript 6` | Strong types across CLI, TUI, workflows, and report shapes |
| Package manager | `pnpm 11` | Fast installs, workspace-friendly behavior, and pinned package manager support |
| CLI parser | `commander` | Slash-command CLI surface and option handling |
| Terminal prompts | `enquirer` | Input prompt, command palette, confirm flows, and interactive selection |
| Terminal styling | `chalk` | Colored output for summaries, panels, and severity cues |
| Tables | `cli-table3` | Scan summaries, command catalog, and aligned terminal layouts |
| Lint engine | `eslint` | Core issue detection across frontend code |
| TS linting | `@typescript-eslint/*` | TypeScript-aware parsing and rules |
| Images | `sharp` | WebP generation and image optimization workflows |
| Tests | `vitest` | Fast unit and integration verification |

## Architecture map

| Path | Role |
|------|------|
| `src/cli.ts` | CLI entrypoint and command registration |
| `src/tui/app.ts` | Interactive TUI and command palette |
| `src/cli/workflows.ts` | Shared application workflows |

| `src/scanners/` | ESLint, image, and dependency scanners |
| `src/reporters/` | Terminal, markdown, HTML, and report formatting |
| `src/terminalUi.ts` | Shared terminal panels, grids, score bar, and run summary helpers |
| `src/insights.ts` | Scoring, category inference, hotspots, markdown summaries |
| `src/explanations.ts` | Human-readable why/fix/risk per rule |
| `src/config.ts` | Config loading, framework detection, report path resolution |
| `src/presets.ts` | Init preset definitions (react, next, vite, etc.) |
| `src/slashCommands.ts` | Slash alias mapping and CLI argv normalization |
| `src/relatedCommands.ts` | "Next Best Moves" recommendation system |
| `src/commandText.ts` | Centralized user-facing guidance strings |
| `src/gitUtils.ts` | Git branch detection, changed/staged file listing |
| `src/projectPaths.ts` | Path safety validators (prevent writes outside project root) |
| `src/types.ts` | Shared TypeScript types: ScanReport, HealthReport, HotspotEntry, LintMessage, etc. |
| `src/commandCatalog.ts` | Canonical command definitions and slash registry |
| `src/uiTools.ts` | Filesystem-only UI scanners: audit, colors, standards, typography, spacing |

## Verification

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `npx ts-node src/cli.ts /scan`
- `npx ts-node src/cli.ts /menu`
