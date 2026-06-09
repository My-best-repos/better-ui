# better-ui 1.0

![better-ui header](assets/better-ui.png)

`better-ui` is an open source local frontend command center for scanning projects, scoring health, reviewing changed files, spotting hotspots, and optimizing images from the terminal.

![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?style=for-the-badge&logo=pnpm&logoColor=white)
![Commander](https://img.shields.io/badge/Commander-CLI-111111?style=for-the-badge)
![Enquirer](https://img.shields.io/badge/Enquirer-TUI-7C3AED?style=for-the-badge)
![ESLint](https://img.shields.io/badge/ESLint-10-4B32C3?style=for-the-badge&logo=eslint&logoColor=white)
![Sharp](https://img.shields.io/badge/Sharp-Images-99CC00?style=for-the-badge)
![Vitest](https://img.shields.io/badge/Vitest-Tests-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)

The repository and product name are `better-ui`. The published npm package and executable are `better-ui-cli`.

It supports direct slash commands such as `better-ui-cli /scan`, `better-ui-cli /health`, and `better-ui-cli /menu`, plus a richer TUI designed around a modern dashboard-and-command-palette workflow.

All repository documentation is in English. The detailed sections referenced from this README were split into the `docs/` directory. See `AGENTS.md` for the quick index before adding new features or docs.

## Open source project

- Contribution guide: `CONTRIBUTING.md`
- Open source roadmap: `docs/open-source-roadmap.md`
- Distribution and installation: `docs/distribution-and-installation.md`
- Testing and CI: `docs/testing-and-ci.md`
- Security notes: `docs/security-notes.md`
- Advanced commands: `docs/advanced-commands.md`
- Dependency scanner: `docs/dependency-scanner.md`
- Hotspots: `docs/hotspots-command.md`
- Init presets: `docs/presets-reference.md`
- Technology stack: `docs/technology-stack.md`

The goal is to make `better-ui` broadly useful for frontend developers while staying honest about current limits and keeping the core tool local-first and reviewable.

## Core Features

- Scans `js`, `jsx`, `ts`, and `tsx` files with ESLint plus TypeScript diagnostics.
- Adds frontend-specific heuristics for accessibility and maintainability.
- Scores the project health from `0` to `100`.
- Tracks issue categories: correctness, maintainability, accessibility, performance, DX, and code quality.
- Reviews only changed or staged files for pre-commit / PR workflows.
- Adds a doctor view for config and script readiness.
- Can explain findings in human terms, including why they matter and safer fixes.
- Supports HTML reports for a more shareable visual summary.
- Shows hotspots so you can fix the highest-risk files first.
- Scans images and can generate `.webp` variants.
- Scans dependencies to find unused packages and heavy libraries.
- Exposes every major flow through both CLI commands and slash commands.

## Built With

<table>
  <tr>
    <td><strong>Runtime</strong><br><code>Node.js 22+</code></td>
    <td><strong>Language</strong><br><code>TypeScript 6</code></td>
    <td><strong>Package Manager</strong><br><code>pnpm 11</code></td>
  </tr>
  <tr>
    <td><strong>CLI</strong><br><code>commander</code></td>
    <td><strong>TUI Prompts</strong><br><code>enquirer</code></td>
    <td><strong>Styling</strong><br><code>chalk</code> + <code>cli-table3</code></td>
  </tr>
  <tr>
    <td><strong>Linting</strong><br><code>eslint</code></td>
    <td><strong>TS Rules</strong><br><code>@typescript-eslint/*</code></td>
    <td><strong>Images</strong><br><code>sharp</code></td>
  </tr>
  <tr>
    <td><strong>Testing</strong><br><code>vitest</code></td>
    <td><strong>Output</strong><br>JSON, Markdown, HTML, TUI</td>
    <td><strong>Details</strong><br><code>docs/technology-stack.md</code></td>
  </tr>
</table>

## Main workflows

### Install and run in any project

Install globally if you want the command available everywhere:

```bash
npm install -g better-ui-cli
better-ui-cli /menu
```

Or run it on demand without a global install:

```bash
npx better-ui-cli
npx better-ui-cli /menu
npx better-ui-cli /scan
npm exec better-ui-cli -- /health
```

Behavior rules:

- `better-ui-cli` with no arguments opens the command center.
- Any explicit action beyond opening the menu must still use slash commands such as `/scan` or `/health`.
- Non-slash top-level commands remain rejected on purpose.

During repository development, you can still run the source entrypoint directly:

```bash
npx ts-node src/cli.ts
npx ts-node src/cli.ts /menu
```

That source form is only for working inside the `better-ui` repository itself.

1. **Open the command center**
   `npx ts-node src/cli.ts /menu`

2. **Run a full scan**
   `npx ts-node src/cli.ts /scan`

3. **Find dead dependencies**
   `npx ts-node src/cli.ts /deps`

4. **Check health score**
   `npx ts-node src/cli.ts /health`

6. **Explain findings for a file or report**
   `npx ts-node src/cli.ts /explain src/components/App.tsx`

7. **Generate a visual HTML report and open it**
   `npx ts-node src/cli.ts /scan --format html --out report.html --open`

8. **View advanced flows and subcommands**
   `npx ts-node src/cli.ts /advanced`

9. **Bootstrap using a preset**
   `npx ts-node src/cli.ts /init --preset next`

## Supercharged Scans

The `/scan` command includes powerful flags for professional workflows:
- `--no-save`: Does not write the report file to disk (useful for CI).
- `--top <n>`: Controls how many hotspots (high-risk files) to display (default is 5).
- `--open`: If generating an HTML report, automatically opens it in your default browser.
- `--scan-images`: Also runs the image scan to generate an inventory of heavy assets.

Recommended quick-fix flow:
1. Run `/scan --top 10 --scan-images` to get priorities.
2. Run `/fix --interactive` and apply selective hunks on heavily impacted files.
3. Run `/scan` again to verify the score improvement.

## Command catalog

The CLI is slash-only. Use commands such as:

- `better-ui-cli`
- `better-ui-cli /scan`
- `better-ui-cli /fix`
- `better-ui-cli /health`
- `better-ui-cli /doctor`
- `better-ui-cli /hotspots`
- `better-ui-cli /a11y`
- `better-ui-cli /deps`
- `better-ui-cli /explain`
- `better-ui-cli /images`
- `better-ui-cli /seo`
- `better-ui-cli /tech-debt`
- `better-ui-cli /performance`
- `better-ui-cli /stack-audit`
- `better-ui-cli /migration`
- `better-ui-cli /fe-score`
- `better-ui-cli /init`
- `better-ui-cli /menu`
- `better-ui-cli /advanced`
- `better-ui-cli /ui-colors`
- `better-ui-cli /ui-standards`
- `better-ui-cli /ui-typography`
- `better-ui-cli /ui-spacing`

## Slash commands

Inside the TUI, you can use these directly:
- `/scan`, `/changed`, `/staged`
- `/fix`, `/fix-interactive`, `/fix-apply`
- `/health`, `/doctor`, `/hotspots`, `/a11y`
- `/deps`, `/explain`, `/images`, `/seo`, `/tech-debt`, `/performance`, `/stack-audit`, `/migration`, `/fe-score`, `/init`
- `/advanced`, `/menu`, `/commands`, `/exit`
- `/ui-colors`, `/ui-standards`, `/ui-typography`, `/ui-spacing`

## Reports and scoring

`scan` writes a report in the requested format (json, markdown, or html).
Each report includes: errors, warnings, total issues, files with issues, health score, category counts, and file-level messages.
Supported formats: `json`, `markdown`, `html`

`health` adds: category scores, safe autofix count, high-impact issue count, image payload summary, top priorities, hotspots.
`doctor` adds: config completeness, missing helper scripts, project readiness hints.
`deps` adds: unused dependencies (dead code), heavy dependency warnings.
`explain` adds: why the issue matters, how to fix it safely, estimated risk.

## Git-aware workflows

When the current directory is a git repository, `better-ui-cli` can scope work to the current diff.
- `/changed` scans modified, staged, and untracked files.
- `/staged` scans only staged files.
- `/fix --interactive` can select individual diff blocks to safely apply auto-fixes.

## TUI

`better-ui-cli /menu` opens the interactive command center.
When the TUI starts, it renders a modern grid dashboard showing your stack and active git branch.
The command center is prompt-first: you type slash commands directly, and `Ctrl+Shift+S` opens a selectable command palette.

Every primary action exposed in the TUI has a slash-command equivalent. After running commands like `/scan`, the TUI returns to the normal pause prompt so you can press `/` to type the next command or `a` to go back to the dashboard. Non-scan commands begin with a compact `Run Summary` block, use a cleaner timestamp format, and show human-readable durations like `842 ms`, `1.4 s`, or `2m 03s`. The detailed `Scan Summary` block stays reserved for `/scan`, including the richer-workflows hint and the score bar directly under the score line. Other commands keep only the focused output they actually need. They also include a sharper `Next Best Moves` panel, while invalid commands only show the closest supported matches instead of generic follow-up suggestions. The dashboard also shows popular flows and keyboard shortcuts.

## Configuration

`better-ui-cli /init` creates `better-ui.config.json`. You can also start with presets (`react`, `next`, `vite`, `landing-page`, `typescript-library`).

## Security and guardrails

- Local-only tool. No outbound network behavior in product code.
- Report, image, and history outputs stay inside the project root.
- File traversal skips `node_modules`, `dist`, `.git`, and symlinks.
- Fix mode is dry-run by default.
- `fix --interactive` writes only the selected diff blocks after confirmation.
- The CLI rejects non-slash top-level commands to keep execution paths explicit.

## Development commands

```bash
pnpm install
pnpm verify
pnpm pack:dry-run
pnpm build
npx ts-node src/cli.ts /commands
```

## Release automation and CI

See `docs/release-automation.md` for details on how the release workflow works.

## Important files

- `src/cli.ts`: CLI entrypoint and command surface.
- `src/tui/app.ts`: interactive command center.
- `src/cli/workflows.ts`: shared scan/fix/health workflows.
- `src/explanations.ts`: human-readable issue explanations and guidance.
- `src/scanners/dependencyScanner.ts`: unused/heavy dependency analysis.
- `src/scanners/eslintScanner.ts`: ESLint, TypeScript, and frontend heuristics.
- `src/scanners/imageScanner.ts`: image discovery and WebP generation.
- `src/insights.ts`: scoring, hotspots, markdown summaries, comparisons.
- `src/slashCommands.ts`: slash command parsing and aliases.
- `src/reporters/htmlReporter.ts`: visual HTML report generation.
