# Distribution and Installation

## Goal

Make `better-ui` usable from any frontend project without cloning the repository or invoking internal source paths.

The repository and product name are `better-ui`. The published npm package and executable are `better-ui-cli`.

## Install from npm

Global install:

```bash
npm install -g better-ui-cli
better-ui-cli /menu
```

On-demand execution without a global install:

```bash
npx better-ui-cli
```

Other equivalent forms:

```bash
npm exec better-ui-cli
pnpm dlx better-ui-cli
```

This opens the same command center as `/menu`.

Run a scan in the current project:

```bash
npx better-ui-cli /scan
```

## Local development package flow

From the `better-ui` repository:

```bash
pnpm install
pnpm verify
npm link
```

Then from any other project on the same machine:

```bash
better-ui-cli /menu
better-ui-cli /scan
better-ui-cli /health
```

The supported UX is:

- `better-ui-cli` opens the TUI menu.
- `better-ui-cli /scan` and similar slash commands run direct actions.
- non-slash top-level commands stay invalid by design.

## Packaging behavior

- The package exposes a `better-ui-cli` binary through `bin/better-ui.js`.
- The binary loads the compiled CLI from `dist/src/cli.js`.
- In local development, the binary falls back to `ts-node` only when the compiled output is missing.
- The package ships only the files needed to run the CLI (`bin`, `dist`, and core top-level docs).

## Publish verification

Before publishing, run:

```bash
pnpm verify
pnpm pack:dry-run
```

`prepack` builds the distributable package and `prepublishOnly` enforces verification before publication.

## Notes

- `npm better-ui-cli` is not a valid npm execution form. The supported commands are `better-ui-cli`, `npx better-ui-cli`, `npm exec better-ui-cli`, and `pnpm dlx better-ui-cli`.
- `npx ts-node src/cli.ts /menu` is a repository-development command only. It works inside the `better-ui` repository, not inside arbitrary target projects.
- For normal users, the supported entrypoint is the package binary (`better-ui-cli`).
