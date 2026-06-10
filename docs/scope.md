# Project Scope & High-level Context

Context summary (one paragraph):

better-ui is a single-package Node + TypeScript command-line tool focused on helping frontend engineers scan repositories for issues (linting, TypeScript diagnostics, accessibility heuristics), score project health, review changed files, and generate shareable reports. The project is terminal-first and intentionally lightweight: there is no monorepo layout, the product is local-first, and the repository includes automated verification through linting, typechecking, tests, and build checks.

Goals:

- Provide a fast local developer feedback loop for frontend code quality and accessibility.
- Offer both scriptable CLI commands and an interactive TUI (Enquirer-based) for reviewing and fixing issues.
- Keep writes constrained to the project root and default to dry-run for destructive operations.

Audience:

- Developers and maintainers of frontend repositories who want fast, local code health feedback and lightweight report artifacts for PRs.

Architecture overview (where to look):

- CLI entry: `src/cli.ts` - maps commands to workflows and reporters.
- Scanners: `src/scanners/` - ESLint + TypeScript diagnostics (`eslintScanner.ts`), image tooling (`imageScanner.ts`), and dependency analysis (`dependencyScanner.ts`).
- Workflows: `src/cli/workflows.ts` - orchestrates scan, fix, explain, doctor flows.
- Reporters: `src/reporters/` - json, html, and terminal reporters.
- TUI: `src/tui/app.ts` - interactive command center.

Quick directory layout:

- `src/` - application code (scanners, reporters, CLI, TUI, helpers)
- `bin/` - light wrapper for local executable
- `.reports/` - generated command reports (scan, health, etc.)
- `docs/` - human- and machine-oriented documentation (split from AGENTS.md)

Quick start (developer):

1. `pnpm install`
2. `npx tsc --noEmit` (typecheck)
3. `npx ts-node src/cli.ts /scan --format json --out report.txt`

For automated agents / bots:

- Read `better-ui/AGENTS.md` first. This file defines contribution rules and agent expectations.
- Parse the `docs/` files for deeper context before making code changes or generating patches.
