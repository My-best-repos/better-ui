# UI Commands

Four filesystem-only scanners that inspect frontend UI structure, colors, component conventions, typography, and spacing. Unlike the main ESLint scanner, these work on any project without configuration.

See `docs/scanner-commands.md` for `/seo`, `/tech-debt`, `/performance`, `/stack-audit`, `/migration`, and `/fe-score`.

## Commands

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

### `/ui-typography`

Audits typography declarations across CSS, JSX, and TSX files.

What it detects:

- **Font families**: unique family names used across the project
- **Font sizes**: frequency of each size value
- **Line heights**: values and their occurrences
- **Font weights**: weight values detected
- **Letter spacing**: spacing values detected
- **Text transform**: uppercase, lowercase, capitalize, etc.
- **Text decoration**: underline, line-through, etc.
- **Custom @font-face**: detects `@font-face` declarations and custom font names
- **Tailwind typography classes**: count of Tailwind typography utilities used
- **Inline typography styles**: count of inline `font-*`, `line-height`, etc. styles
- **Missing line-height**: files with font-size but no line-height

Output fields:

- `filesWithTypography` — files containing at least one typography declaration
- `totalFontDeclarations` — total typography-related CSS/class declarations
- `uniqueFontFamilies` — distinct font family names
- `customFonts` — custom font names from `@font-face`
- `fontSizes` — sorted by frequency, each with count
- `lineHeights`, `fontWeights`, `letterSpacing`, `textTransform`, `textDecoration` — sorted by frequency
- `tailwindTypographyCount` — count of Tailwind typography utilities
- `inlineTypographyCount` — count of inline typography styles
- `missingLineHeight` — files missing line-height alongside font-size
- `recommendations` — actionable suggestions

### `/ui-spacing`

Scans spacing patterns: margins, paddings, gaps, position properties, and unit consistency.

What it detects:

- **Margin values**: frequency of each margin value
- **Padding values**: frequency of each padding value
- **Gap values**: frequency of each gap value (grid/flex gaps)
- **Position properties**: absolute, relative, fixed, sticky counts
- **Tailwind spacing**: count of Tailwind spacing utilities (m-, p-, gap-, space-)
- **Inline spacing**: count of inline margin/padding/gap styles
- **Unit inconsistencies**: files that mix spacing units (px + rem, etc.)
- **Excessive unique values**: files with more than 10 unique spacing values

Output fields:

- `filesWithSpacing` — files containing at least one spacing declaration
- `totalSpacingDeclarations` — total spacing-related declarations
- `tailwindSpacingCount` — count of Tailwind spacing utilities
- `inlineSpacingCount` — count of inline spacing styles
- `positionValues` — position values sorted by frequency
- `unitInconsistencies` — files with mixed spacing units
- `filesWithExcessiveUniqueValues` — files with >10 unique spacing values
- `marginValues`, `paddingValues`, `gapValues` — sorted by frequency
- `recommendations` — actionable suggestions

## Usage

```bash
npx ts-node src/cli.ts /ui-colors
npx ts-node src/cli.ts /ui-standards
npx ts-node src/cli.ts /ui-typography
npx ts-node src/cli.ts /ui-spacing
```

From the TUI (after `/menu`): type any of `/ui-colors`, `/ui-standards`, `/ui-typography`, or `/ui-spacing` at the prompt.

## Considerations

- All four scanners skip `node_modules`, `dist`, `.git`, `build`, `.next`, `.cache`, and `coverage` directories.
- Files over 500 KB are skipped to avoid memory issues on large assets.
- The color scanner's Tailwind pattern matches at the attribute level — one `className="bg-blue-500 text-white-100"` counts as one declaration, not two.
- The standards scanner counts both `.tsx`/`.jsx` files (as components) and `.ts`/`.js`/`.tsx`/`.jsx` files (as relevant for organization analysis).
- All four are pure filesystem scanners — no ESLint, no configuration needed.
