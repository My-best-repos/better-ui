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
- `--no-save`: Prevents the report from being written to disk. Excellent for ephemeral CI runs.
- `--open`: If `--format html` is used, this tells the OS to automatically pop open your default browser to view the generated dashboard.
- `--changed` and `--staged`: Scope the scan to the current git diff instead of the whole project.
- `--verbose`: Show extended output details after the scan, including the raw report path.
- `--ext <exts>`: Comma-separated file extensions to scan (e.g. `.js,.ts,.tsx`).

### Surgical Fixes (`/fix`)
- `/fix`: Dry-run preview of all ESLint autofixes — shows what would change without writing anything.
- `/fix --apply`: Standard bulk application of all safe autofixes.
- `/fix --interactive`: The safest way to fix a legacy project. Instead of applying fixes indiscriminately, the CLI will parse the file diffs into "hunks" and let you accept or reject them individually.
- `/fix --changed`: Scope fixes to modified and untracked files.
- `/fix --staged`: Scope fixes to staged files only.

### Pull Requests (`/review` and `/pr-summary`)
- `/review --changed`: Runs an isolated check against only the files currently modified in git.
- `/review --staged`: Reviews only staged files.
- `/review --no-save`: Prevents the review output from being written to disk.
- `/pr-summary`: Generates a Markdown document summarizing your current branch's health impact, ready to be pasted into a GitHub or GitLab Pull Request.
- `/pr-summary --no-save`: Prevents the PR summary from being written to disk.

### Hotspots (`/hotspots`)
- `/hotspots`: Lists files ranked by combined issue severity and density (default: top 10).
- `/hotspots --density`: Sort by issues per line of code instead of absolute risk score. Useful for finding small but messy files.
- `/hotspots --min-score <n>`: Only show files with a score at or above the threshold.
- `/hotspots --top <n>`: Show more or fewer results.

### Health & Diagnostics (`/health`, `/doctor`, `/deps`)
- `/health`: Category-level score breakdown with per-category recommendations and image payload summary.
- `/doctor`: Full project config audit (config, scripts, ESLint config, TypeScript config, framework detection).
- `/deps`: Find unused dependencies and known-heavy packages with alternative suggestions.

### Accessibility (`/a11y`)
- `/a11y`: Filter the latest scan to accessibility-related findings only.
- `/a11y --changed`: Scope to modified files.
- `/a11y --staged`: Scope to staged files.

## Post-command Prompt
After running a major command like `/scan` within the TUI, the interface returns to the standard pause prompt. Press `a` to return to the dashboard or press `/` to type the next slash command directly.

Both the CLI and the TUI also render a small `Next Best Moves` panel after command output, including variants like `/fix --interactive`, `/review --changed`, or `/images --generate`, so the next useful step is visible immediately.

`/scan` remains the only command that shows the full `Scan Summary` block and score bar. Other commands use the lighter `Run Summary` intro plus their focused panels.

## Minimal commands to test

```bash
npx ts-node src/cli.ts /advanced
npx ts-node src/cli.ts /scan --top 8 --scan-images --verbose
npx ts-node src/cli.ts /scan --no-save
npx ts-node src/cli.ts /fix
npx ts-node src/cli.ts /fix --interactive
npx ts-node src/cli.ts /hotspots --density --min-score 3
npx ts-node src/cli.ts /review --changed
npx ts-node src/cli.ts /review --no-save
npx ts-node src/cli.ts /deps
npx ts-node src/cli.ts /init --preset next
```
