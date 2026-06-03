
# UI Commands

Three filesystem-only scanners that inspect frontend UI structure, colors, and component conventions. Unlike the main ESLint scanner, these work on any project without configuration.

## Commands

### `/ui-audit`

Scans the project surface for UI-related files and patterns.

What it detects:

- **File distribution**: HTML, CSS, component (JSX/TSX), image, and font file counts
- **Viewport `<meta>`**: whether `<meta name="viewport">` is present in HTML
- **Theme-color `<meta>`**: whether `<meta name="theme-color">` is present
- **CSS methodology**: auto-detects Tailwind CSS, CSS Modules, CSS-in-JS (styled-components / Emotion), and Plain CSS
- **Semantic HTML elements**: presence of `<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`, `<footer>`, etc. in JSX files
- **Inline styles**: checks for `style={}` or `style=""` in components
- **Responsive breakpoints**: collects all `min-width` / `max-width` media queries from CSS and HTML
- **Font loading**: detects Google Fonts links and `@font-face` declarations
- **UI Score**: 0-100 score based on best practices (viewport, semantics, responsive, fonts, inline styles)

Score penalties:

| Rule | Penalty |
|------|---------|
| Missing viewport meta (when HTML exists) | −15 |
| Inline styles detected | −10 |
| No semantic elements (5+ components) | −10 |
| No font loading (when fonts exist) | −5 |
| Missing theme-color meta | −5 |
| No responsive breakpoints (CSS exists) | −5 |
| No HTML or component files | score = 0 |

### `/ui-colors`

Scans all CSS and component files for color declarations.

What it detects:

- **Hex colors** (`#ff0000`, `#fff`, etc.) — skips black/white (`#000`, `#fff`, `#000000`, `#ffffff`)
- **RGB/RGBA colors** (`rgb(255, 0, 0)`, `rgba(0, 0, 255, 0.5)`)
- **HSL/HSLA colors** (`hsl(120, 100%, 50%)`, `hsla(120, 100%, 50%, 0.3)`)
- **Tailwind color classes** (e.g. `bg-blue-500`, `text-white-100`, `border-gray-300`)
- **CSS custom properties** that hold color values (`--primary: #ff0000`)
- **Color inconsistencies**: near-identical hex values that might indicate drift

Output fields:

- `totalUnique` — distinct color values found
- `totalDeclarations` — total color occurrences across all files
- `allColors` — sorted by frequency, each with count and file list
- `tailwindColors` — count of Tailwind color class matches
- `cssCustomProperties` — number of CSS custom properties holding colors
- `hasColorInconsistencies` — whether similar but non-identical colors exist

### `/ui-standards`

Analyzes component file organization and naming conventions.

What it detects:

- **File naming**: PascalCase vs kebab-case component files
- **Exports**: default exports vs named exports
- **Props interfaces**: whether files define `interface XProps` or `type XProps = {}`
- **Index files**: count of `index.ts` / `index.tsx` / `index.js` / `index.jsx` files
- **File size**: flags components over 400 lines
- **Average lines per component**
- **Organization type**: `flat` (single-file dirs outnumber multi-file), `feature-folders` (multi-file dirs dominate), `mixed`, or `unknown`

## Usage

```bash
npx ts-node src/cli.ts /ui-audit
npx ts-node src/cli.ts /ui-colors
npx ts-node src/cli.ts /ui-standards
```

From the TUI (after `/menu`): type any of `/ui-audit`, `/ui-colors`, `/ui-standards` at the prompt.

## Considerations

- All three scanners skip `node_modules`, `dist`, `.git`, `build`, `.next`, `.cache`, and `coverage` directories.
- Files over 500 KB are skipped (read as `null`) to avoid memory issues on large assets.
- The color scanner's Tailwind pattern matches at the attribute level — one `className="bg-blue-500 text-white-100"` counts as one declaration, not two.
- The standards scanner counts both `.tsx`/`.jsx` files (as components) and `.ts`/`.js`/`.tsx`/`.jsx` files (as relevant for organization analysis).
- All three are pure filesystem scanners — no ESLint, no configuration needed.
