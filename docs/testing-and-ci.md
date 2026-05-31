
# Testing and CI

This file describes the current verification bar for `better-ui` and the commands contributors should run before opening a pull request or publishing a release.

## Local verification

Run these commands from the repository root:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test:ci
pnpm build
```

If you are validating packaging or a release candidate, also run:

```bash
pnpm pack:dry-run
node ./bin/better-ui.js /commands
```

## What each check covers

- `pnpm typecheck` verifies the TypeScript codebase without emitting build output.
- `pnpm lint` checks repository code against the current flat ESLint configuration.
- `pnpm test:ci` runs the non-watch Vitest suite.
- `pnpm build` compiles the distributable CLI into `dist/`.
- `pnpm pack:dry-run` verifies what would be published to npm.
- `node ./bin/better-ui.js /commands` is the quickest smoke test for the packaged entrypoint.

## CI expectations

CI should enforce the same baseline as local verification:

1. install dependencies
2. typecheck
3. lint
4. test
5. build
6. validate packaging when release confidence matters

This keeps contributor workflows and release workflows aligned.

## When to run extra checks

- If you changed slash-command parsing or the command catalog, run `pnpm test:ci` and smoke-test `/commands`.
- If you changed packaging, docs for installation, or binary behavior, run `pnpm pack:dry-run` and `node ./bin/better-ui.js /commands`.
- If you changed scanners or reporters, run a real scan such as `npx ts-node src/cli.ts /scan --format json --out tmp-report.json`.

## Notes

- The repository name is `better-ui`.
- The published npm package and executable are `better-ui-cli`.
- Prefer documenting verification exactly as it was run so contributors can reproduce failures.
