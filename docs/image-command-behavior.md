# Image Command Behavior

Summary:

- The `images` command discovers common raster assets (`.png`, `.jpg`, `.jpeg`) and reports basic metadata (dimensions, filesize). With `--generate`, the command will write a `.webp` sibling copy using `sharp`.

Behavior and flags:

- Default discovery: scans project for `.png`, `.jpg`, `.jpeg` (skips `node_modules`, `.git`, and symlinks).
- `--generate` — create a `<original>.<ext>.webp` file next to each source image; originals are not replaced.
- `--quality <n>` — optional quality parameter for webp generation (0-100). Default quality is set in the implementation (check `src/scanners/imageScanner.ts`).

Notes and safety:

- Writes are restricted to the project root using `src/projectPaths.ts` helpers.
- The command avoids modifying original files and only writes new `.webp` assets.

How to test:

1. Place a small `test.jpg` in a temporary folder inside the repo.
2. Run: `npx ts-node src/cli.ts /images --generate --quality 80`
3. Verify that `test.jpg.webp` exists and that original remains untouched.
