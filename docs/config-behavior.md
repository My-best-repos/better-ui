# Config Behavior & Schema

`better-ui` stores lightweight project preferences in `better-ui.config.json`. The config is advisory and used to provide defaults for commands and reports.

The repository and product name are `better-ui`. The published npm package and executable referenced in command examples are `better-ui-cli`.

Typical fields:

```json
{
  "projectName": "my-project",
  "preset": "next",
  "defaults": {
    "reportFile": "better-ui-report.txt",
    "extensions": [".js", ".jsx", ".ts", ".tsx"]
  },
  "scripts": {
    "scan": "better-ui-cli /scan --format html --out better-ui-report.html",
    "fix": "better-ui-cli /fix --interactive"
  }
}
```

Key behaviors:

- `better-ui-cli /init` will create `better-ui.config.json` and may inject informational `better-ui:*` scripts into the target project's `package.json`.
- Commands read `better-ui.config.json` for defaults such as `projectName`, `preset`, `defaults.reportFile`, and `defaults.extensions`.
- Scripts written to `package.json` are informational only; the CLI does not execute or modify those script strings dynamically.
- When no `--out` or `defaults.reportFile` is set, reports use a descriptive filename (`<command>-<MMDDTHHMMSS>.<ext>`).

Framework detection:

- `detectFramework()` runs on every scan and reads `package.json` dependencies/devDependencies to identify the project stack.
- Detected frameworks: `Next.js`, `Nuxt`, `Remix`, `React`, `Vue`, `Svelte`, `Vite`, `Tailwind`, `TypeScript` — falls back to `vanilla` when nothing matches.
- The detected stack is shown in the `/doctor` command output and in the TUI dashboard.

Init presets:

- `/init --preset <name>` bootstraps a config tailored to your project type. Available presets: `react`, `next`, `vite`, `landing-page`, `typescript-library`.
- Each preset sets the `reportFile`, `extensions`, and adds `better-ui:*` scripts to `package.json`.
- See `docs/presets-reference.md` for the full preset reference.

Report output paths:

- When no `--out` is specified and a `command` name is available, reports save to `.reports/<command>/<command>-<ISO>.<ext>` (e.g., `.reports/scan/scan-2026-06-03T125355.json`).
- The directory is created automatically.
- `--out <path>` always overrides the default path.
- `--no-save` skips writing the report to disk entirely.

Path safety:

- All reporters and write operations must use `src/projectPaths.ts` helpers (e.g., `resolveProjectPath`, `toProjectRelativePath`) to ensure writes stay inside the project root. Do not write outside the project root.

For automation and agents:

- When an automated agent modifies `better-ui.config.json`, it should include an accompanying docs file under `docs/` and update `AGENTS.md` linking to the new doc per repository policy.
