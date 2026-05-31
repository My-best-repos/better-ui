# Release automation and CI notes

This document explains how the repository's release and publish automation works.

Workflows
- `.github/workflows/release.yml` — runs `googleapis/release-please-action@v4` to create changelog PRs and GitHub Releases. Triggered on `push` to `main`/`master`.
- `.github/workflows/publish.yml` — publishes the package to npm. Triggered on the `release` event (`published` type).

Flow
1. Merge a feature PR → `release.yml` creates/updates a release PR with changelog.
2. Merge the release PR → `release-please` creates a GitHub Release with a version tag.
3. The GitHub Release triggers `publish.yml` → installs deps, verifies, and publishes to npm.

What publish.yml does
1. Checks out the repository at the release tag.
2. Sets up pnpm and Node.js with cached dependencies.
3. Runs `pnpm install --frozen-lockfile`.
4. Verifies package contents with `pnpm pack:dry-run`.
5. Publishes to npm with `--provenance` and `--access public`.

Token setup
- `release.yml` requires `MY_RELEASE_PLEASE_TOKEN` (PAT with repo write permissions).
- `publish.yml` requires `NPM_TOKEN` with npm publish permissions.
- Add both under Settings → Secrets and variables → Actions.

Local testing
- Use `pnpm pack` to produce a `.tgz` and install it elsewhere to simulate how npm installs the package.
