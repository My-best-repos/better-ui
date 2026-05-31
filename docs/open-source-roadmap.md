# Open Source Roadmap

## Vision

`better-ui` aims to become a strong local command center for frontend quality work: scanning, prioritizing, explaining, and safely applying improvements from the terminal.

The goal is not to replace every specialized tool. The goal is to unify the most useful frontend quality workflows behind one reliable interface.

## Current position

Today the project already provides:

- CLI and slash-command workflows
- TUI command center
- ESLint and TypeScript-backed scanning
- basic frontend heuristics
- report generation in multiple formats
- git-aware review scopes
- image inventory and WebP generation

## Near-term priorities

1. Reliability
- automated tests
- stronger CI coverage
- fewer false positives
- more stable TUI behavior

2. Open source readiness
- better onboarding
- contribution docs
- issue and PR templates
- reproducible local verification

3. Scanner depth
- framework-aware rules
- clearer explanations
- safer autofix workflows
- richer report output

## Medium-term direction

- plugin-style rule architecture
- baseline and suppressions support
- monorepo-aware scanning
- design-system and component-library checks
- CI-first JSON/markdown reporting for pull requests

## Guardrails

- keep the product local-first
- prefer explicit, safe writes
- avoid promising full frontend coverage before evidence supports it
- optimize for usefulness and trust before feature count

## Minimal commands to test

```bash
pnpm typecheck
pnpm lint
pnpm build
npx ts-node src/cli.ts /commands
npx ts-node src/cli.ts /scan --format json --out tmp-report.json
```
