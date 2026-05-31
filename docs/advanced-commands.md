# Advanced Commands and Subcommands

`better-ui` 1.0 ships with a suite of advanced workflows and subcommands designed for power users.

## The `/advanced` Command

The fastest way to discover these features is the `/advanced` command. It renders an in-app, categorized cheat sheet.

```bash
npx ts-node src/cli.ts /advanced
```

## Subcommands and Flags

### Supercharged Scans (`/scan`)
- `--scan-images`: Groups your image optimization scan with your code scan.
- `--top <n>`: Increase or decrease the number of "Hotspots" (highest technical debt files) shown in your summary.
- `--skip-history`: Prevents the snapshot from being saved in `.better-ui/history/latest.json`. Excellent for ephemeral CI runs.
- `--open`: If `--format html` is used, this tells the OS to automatically pop open your default browser to view the generated dashboard.
- `--changed` and `--staged`: Scope the scan to the current git diff instead of the whole project.

### Surgical Fixes (`/fix`)
- `/fix --interactive`: The safest way to fix a legacy project. Instead of applying fixes indiscriminately, the CLI will parse the file diffs into "hunks" and let you accept or reject them individually.
- `/fix --apply`: Standard bulk application of all safe autofixes.

### Pull Requests (`/review` and `/pr-summary`)
- `/review --changed`: Runs an isolated check against only the files currently modified in git.
- `/pr-summary`: Generates a Markdown document summarizing your current branch's health impact, ready to be pasted into a GitHub or GitLab Pull Request.

## Post-command Prompt
After running a major command like `/scan` within the TUI, the interface returns to the standard pause prompt. Press `a` to return to the dashboard or press `/` to type the next slash command directly.

Both the CLI and the TUI also render a small `Next Best Moves` panel after command output, including variants like `/fix --interactive`, `/review --changed`, or `/images --generate`, so the next useful step is visible immediately.

`/scan` remains the only command that shows the full `Scan Summary` block and score bar. Other commands use the lighter `Run Summary` intro plus their focused panels.

## Minimal commands to test

```bash
npx ts-node src/cli.ts /advanced
npx ts-node src/cli.ts /scan --top 8 --scan-images
npx ts-node src/cli.ts /fix --interactive
npx ts-node src/cli.ts /review --changed
```
