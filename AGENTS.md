# AGENTS.md

Summary and purpose

This file is a concise landing guide for anyone (human or automated) who will inspect, modify, or extend the better-ui repository.
Its goal is to provide enough context to understand the project's intent, point to key files and flows, and set clear expectations for automated agents and AI assistants.

Required reading

Before proposing or applying any changes, read these files:

1. `AGENTS.md` — this file; read it to get high-level context and a quick checklist.
2. The relevant files in `docs/` — read the specific documentation for the area you will change.

If an automated agent cannot read any of the above, it must stop and request human intervention.

What this repository contains (operational summary)

- Purpose: a terminal-first tool to scan frontend code, compute a health score, generate reports, and help apply fixes with interactive workflows.
- CLI entry: `src/cli.ts` — maps commands to workflows and reporters.
- Workflows: `src/cli/workflows.ts` — orchestrates scan, fix, doctor, review, explain, etc.
- Scanners: `src/scanners/` — `eslintScanner.ts` (ESLint + TypeScript diagnostics + heuristics), `imageScanner.ts` (discover and generate WebP), and `dependencyScanner.ts` (unused/heavy dependency analysis).
- Reporters: `src/reporters/` — JSON, HTML, and terminal reporters.
- Interactive UI: `src/tui/app.ts` — Enquirer-based TUI for dashboards and review flows.
- Path safety: `src/projectPaths.ts` — helpers that ensure all writes stay inside the project root.

Required checklist before making changes (human or automated agent)

1. Read `AGENTS.md` and the relevant `docs/*` files.
2. Run the basic local verification steps:
   - `pnpm install`
   - `pnpm typecheck` (ensure no type errors)
   - `pnpm lint` (fix lint issues if applicable)
   - `pnpm build` (when relevant)
3. Exercise the affected flow to verify behavior. Examples:
   - `npx ts-node src/cli.ts /scan --format json --out tmp-report.json`
   - `npx ts-node src/cli.ts /fix --interactive`
4. If the change writes files, review `src/projectPaths.ts` and ensure all target paths go through the helper functions.
5. Do not modify files outside the project tree or commit secrets.

Documentation and commit rules (mandatory)

- Every functional change must include:
  - A clear commit message (e.g. `feat: add X`, `fix: Y`) with an optional area suffix (`docs`, `scanners`, `cli`).
  - An update to `README.md` with a short usage example or note for the new feature.
  - A new `docs/<descriptive-name>.md` file explaining: what the feature does, minimal commands to test it, and any considerations/limitations.
  - If adding a substantial new area, add a link from `AGENTS.md` to the new `docs/<descriptive-name>.md` file.

AI / automated agent policy

- Before generating code, an AI agent must list (in the PR or commit message) which `docs/*` files and sections it read and explain why they are relevant.
- Follow the sequence: read → plan → make local changes → run checks (typecheck/lint/build) → document → create commit/PR.
- The PR/commit must include a short summary with:
  - A brief explanation of the change.
  - The list of `docs/` files read.
  - The verification commands executed (for example: `pnpm typecheck`, `pnpm lint`).

Where to modify code depending on the change type

- Add a new CLI command: edit `src/cli.ts` to expose the command, add or extend a workflow in `src/cli/workflows.ts`, and document the new behavior in `docs/` + `README.md`.
- Change scanner behavior: modify `src/scanners/eslintScanner.ts`, add manual test fixtures, and update docs describing limitations and output shape.
- Add a reporter: create a file in `src/reporters/`, update `src/cli/workflows.ts` to support the `--format` option, and document the format with examples in `docs/`.
- Update the TUI: edit `src/tui/app.ts` and supporting UI helpers; keep user-facing copy aligned with `docs/user-facing-copy.md`.
- TUI slash parity reference: `docs/tui-slash-actions.md` documents the expected mapping between menu actions and slash commands.
- TUI palette behavior: `docs/tui-command-palette.md` documents the command palette hotkey, selection flow, and exit behavior.
- Open source direction: `docs/open-source-roadmap.md` documents the current product posture, priorities, and contributor direction.
- Distribution and install flow: `docs/distribution-and-installation.md` documents the supported binary entrypoint and publish expectations.
- Testing and CI: `docs/testing-and-ci.md` documents the expected local verification and package checks.
- Dependency Scanner: `docs/dependency-scanner.md` documents how the unused/heavy dependency analysis works.
- Advanced Commands: `docs/advanced-commands.md` documents flags, the TUI post-command prompt flow, and the `/advanced` catalog.
- Technology Stack: `docs/technology-stack.md` documents the main runtime, CLI/TUI, linting, and testing technologies used by the project.
- UI Commands: `docs/ui-commands.md` documents the filesystem-only UI scanners: `/ui-colors`, `/ui-standards`, `/ui-typography`, and `/ui-spacing`.
- Hotspots: `docs/hotspots-command.md` documents the `/hotspots` command and its flags (`--density`, `--min-score`, `--top`).
- Init Presets: `docs/presets-reference.md` documents the available `/init --preset` options and their configuration.
- Scanner Commands: `docs/scanner-commands.md` documents the six standalone scanners: `/seo`, `/tech-debt`, `/performance`, `/stack-audit`, `/migration`, and `/fe-score`.

Quick verification commands

- `pnpm install`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `npx ts-node src/cli.ts /scan --format json --out tmp.json`
- `npx ts-node src/cli.ts /fix --interactive`

Security considerations and operational limits

- The product is local-first: do not add outbound network calls without explicit design and review.
- Never write outside the repository root. Use `src/projectPaths.ts` for path validation.
- Do not commit secrets. Prefer environment variables or secure secret stores when necessary.

What an agent should include in the PR/commit

- Short change summary.
- The list of `docs/` files read and a one-line note per file explaining relevance.
- The verification commands executed and the key outputs if something failed.

Suggested commit message example

feat: add images --optimize flow

Docs-checked: docs/image-command-behavior.md, docs/config-behavior.md

Verification: pnpm typecheck; pnpm lint; npx ts-node src/cli.ts /images --generate --quality 80

Final note

Keep AGENTS.md concise but informative. For deep technical details and design rationale, consult the files under `docs/`. Always follow `AGENTS.md` before acting.
