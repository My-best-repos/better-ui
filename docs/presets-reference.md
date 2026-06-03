# Init Presets Reference

The `/init --preset <name>` command bootstraps a `better-ui.config.json` with pre-configured defaults tailored to your project type.

## Available presets

| Preset ID | Label | Extensions | Use case |
|-----------|-------|------------|----------|
| `react` | React | `.js`, `.jsx`, `.ts`, `.tsx` | Typical React app (CRA, Vite, or Next.js) |
| `next` | Next.js | `.js`, `.jsx`, `.ts`, `.tsx` | Next.js application conventions |
| `vite` | Vite | `.js`, `.jsx`, `.ts`, `.tsx` | Vite-powered frontend app |
| `landing-page` | Landing Page | `.js`, `.jsx` | Simple static landing page project |
| `typescript-library` | TypeScript Library | `.ts`, `.tsx` | Library published as TypeScript |

## What a preset configures

Each preset sets three values in `better-ui.config.json`:

1. **`reportFile`** — The default output path for scan reports (default: `better-ui-report.txt`).
2. **`extensions`** — Which file extensions the scanner processes. Language-specific presets restrict to relevant extensions.
3. **Injected scripts** — `/init` also adds informational `better-ui:*` scripts to `package.json` (scan, fix, health, doctor, a11y, review, pr-summary, init, tui).

## Example

```bash
npx ts-node src/cli.ts /init --preset next
```

This creates a `better-ui.config.json` with Next.js conventions and adds `better-ui:scan`, `better-ui:fix`, and related scripts to `package.json`.

## Notes

- Presets are purely advisory — the config they produce can be edited manually afterward.
- The CLI does not execute or modify the injected `better-ui:*` script strings dynamically.
- Without a preset, `/init` creates a config with no preset and generic defaults.
