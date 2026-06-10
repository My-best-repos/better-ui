# Presets Reference

Presets can be set manually in `better-ui.config.json` under the `"preset"` field. They provide pre-configured defaults tailored to your project type.

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
3. **Recommended scripts** — The recommended `better-ui:*` scripts to add to `package.json` (scan, fix, health, a11y, tui).

## Example

```json
{
  "preset": "next",
  "projectName": "my-project",
  "defaults": {
    "reportFile": "better-ui-report.txt",
    "extensions": [".js", ".jsx", ".ts", ".tsx"]
  }
}
```

## Notes

- Presets are purely advisory — the config can be edited manually afterward.
- The CLI does not execute or modify script strings in `package.json` dynamically.
