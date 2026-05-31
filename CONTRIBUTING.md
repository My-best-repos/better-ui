# Contributing to better-ui

`better-ui` is a terminal-first open source tool for scanning, reviewing, and improving frontend codebases.

## Before you start

Read these files first:

1. `instructions.md`
2. `AGENTS.md`
3. The relevant files in `docs/`

## Local setup

```bash
npm install
npm run typecheck
npm run lint
npm run test:ci
npm run build
```

Useful development commands:

```bash
npx ts-node src/cli.ts /commands
npx ts-node src/cli.ts /menu
npx ts-node src/cli.ts /scan --format json --out tmp-report.json
```

## Contribution principles

- Prefer small, reviewable changes.
- Keep behavior explicit and local-first.
- Avoid writing outside the project root.
- Do not add network-dependent product features casually.
- Document new user-facing behavior.

## Areas that especially need help

- rule quality and false-positive reduction
- tests for scanners and TUI flows
- richer HTML reporting
- framework-aware frontend rules
- documentation and onboarding
- CI and release automation

## Pull request checklist

- [ ] I read `instructions.md`, `AGENTS.md`, and the relevant docs.
- [ ] I ran `npm run typecheck`.
- [ ] I ran `npm run lint`.
- [ ] I ran `npm run test:ci`.
- [ ] I ran `npm run build`.
- [ ] I updated `README.md` if behavior changed.
- [ ] I added or updated a focused document under `docs/` if needed.
- [ ] I described any remaining limitations.

## Release automation notes for contributors

- `.github/workflows/release.yml` runs `release-please` on push to `main`/`master`, creating changelog PRs and GitHub Releases.
- `.github/workflows/publish.yml` publishes to npm when a GitHub Release is published.
- Ensure the CI checks pass (typecheck, lint, tests, build) before merging.
- To test packaging locally, run `pnpm pack` to produce a `.tgz` that can be installed in another project.
- `MY_RELEASE_PLEASE_TOKEN` and `NPM_TOKEN` secrets must be configured for the workflows to run.

## Reporting bugs and proposing features

When opening an issue or PR, include:

- expected behavior
- actual behavior
- reproduction steps
- relevant command used
- platform details if relevant
