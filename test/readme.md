# Test Suite

- `test/` — Unit tests (vitest, pure logic + isolated FS)
- `tests/integration/` — Integration/smoke tests (spawn real CLI)

## Test Files

| File | Tests | What it covers |
|------|-------|----------------|
| `commandCatalog.test.ts` | 9 | All 24 command definitions, required fields, slash uniqueness, core + alias coverage |
| `presets.test.ts` | 10 | 5 presets, required fields, uniqueness, ID lookup |
| `projectPaths.test.ts` | 11 | Path resolution inside/outside root, `..` escape, absolute paths, relative paths |
| `slashCommands.test.ts` | 18 | Alias mapping, arg passthrough, tokenizer with quotes, non-slash exit, edge cases |
| `explanations.test.ts` | 10 | explainMessage: ruleId, category, fixable, impact; buildExplainSummary |
| `insights.test.ts` | 22 | buildCategoryCounts, buildScanScore (edge cases at 0/100), buildHotspots, inferCategory/Impact, buildHealthReport, buildMarkdownSummary, buildReviewBody, compareReports |
| `relatedCommands.test.ts` | 11 | Known keys return 4 entries, default fallback (3 entries), intent labels for all categories |
| `terminalUi.test.ts` | 7 | formatTimestamp, formatElapsed, formatDelta |
| `config.test.ts` | 16 | loadConfig (missing/corrupt/valid), getProjectLabel, getReportFile (format-aware), getExtensions, detectFramework (7 framework detections) |
| `reportUtils.test.ts` | 5 | buildScanReport aggregation, scope/metadata passthrough, empty input |
| `reporters.test.ts` | 8 | writeJsonReport (validity, dir creation, ScanReport + FileReport[], indentation), writeHtmlReport (HTML structure, data content) |
| `gitUtils.test.ts` | 6 | isGitRepository, getCurrentBranch, getChangedFiles (modified/staged/untracked) |
| `scanners/dependencyScanner.test.ts` | 7 | Unused deps, used deps, @types/eslint ignoring, require detection, heavy deps, missing src/, invalid JSON |
| `scanners/imageScanner.test.ts` | 9 | Empty, png/jpg/jpeg discovery, nested dirs, node_modules/dist/.git exclusion, WebP generation |
| `tests/integration/cli-smoke.spec.ts` | 4 | CLI: advanced, deps, scan JSON output, images/webp |
| `tests/integration/pack-install.spec.ts` | 1 | Pack → install in fresh project → run binary |

Total: **241 tests** (236 unit + 5 integration)

## Pending

- `scanners/eslintScanner.test.ts` — Requires ESLint + TypeScript fixtures
- `cli/workflows.test.ts` — Integration-level, mocks many modules
- `tui/app.test.ts` — Full TUI flow, hard to mock
- `cli.ts` — Commander entry point, integration-tested indirectly via smoke tests
