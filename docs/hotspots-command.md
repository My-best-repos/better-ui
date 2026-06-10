# Hotspots Command

The `/hotspots` command surfaces the files with the highest issue density and risk score, helping you prioritize which files to fix first.

## Basic usage

```bash
npx ts-node src/cli.ts /hotspots
```

From the TUI: type `/hotspots` at the prompt.

## Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--top <n>` | number | 10 | Number of hotspots to display |
| `--density` | boolean | off | Sort by issue density (issues per line of code) instead of absolute score |
| `--min-score <n>` | number | 0 | Minimum score threshold — only files with a score at or above this value are shown |

## How scoring works

Each file receives a numeric score based on the weighted sum of its errors and warnings:

- Errors contribute more weight than warnings.
- The score reflects both severity and density.
- Files with zero issues are excluded from hotspots.

The `--density` flag recalculates the ranking using `issues / lines of code`, which can reveal small files with high issue concentrations that a raw score might rank lower.

## Output

The command shows two levels of detail:

1. **Summary table** — a compact table of the top N files with columns for errors, warnings, score, density, top category, and line count.
2. **Per-file breakdown** — for each hotspot, a panel showing the file path, aggregate metrics, and each individual issue with rule ID, severity tag, line reference, and message.

## Examples

Show the top 10 most problematic files:
```bash
npx ts-node src/cli.ts /hotspots
```

Show the top 5 files by issue density:
```bash
npx ts-node src/cli.ts /hotspots --density --top 5
```

Show only files with a score of 20 or higher:
```bash
npx ts-node src/cli.ts /hotspots --min-score 20
```

## Related commands

- `/fix` — Preview or apply autofixes in the identified hotspots.
- `/health` — See category-level score impact across the project.
- `/scan` — Re-run the full scan after addressing hotspot issues.
