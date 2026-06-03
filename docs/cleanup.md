# Cleanup Documentation

This document describes the cleanup actions performed on the better-ui repository in June 2026.

## Files Removed

### Redundant Artifacts
- `package-lock.json` - Removed because the project uses pnpm (pnpm-lock.yaml is the correct lockfile)
- `.atl/` directory - Local artifact folder containing stale skill-registry cache
- Temporary report files in `reports/` - Cleaned up old scan reports

### OS/Editor Artifacts
- `.DS_Store` files - macOS directory metadata
- `Thumbs.db` files - Windows thumbnail cache
- `*~` files - Backup files from various editors

### Documentation Normalization
- `instructions.md` - Obsolete documentation file, content integrated into other docs
- `test/readme.md` renamed to `test/README.md` for consistency

## Changes Made

1. Removed redundant lock files and local artifacts
2. Normalized documentation files and removed broken links
3. Standardized test documentation filenames
4. Removed temporary and OS-generated files

## Verification

All changes were verified with:
- `pnpm typecheck` - No TypeScript errors
- `pnpm lint` - No linting errors
- `pnpm test` - All 241 tests passing

## Rationale

This cleanup was performed to:
1. Reduce repository clutter and confusion from obsolete files
2. Normalize documentation structure and naming conventions
3. Remove artifacts that are either generated locally or redundant
4. Improve overall project maintainability and developer experience

The changes are purely maintenance-focused and do not affect the core functionality of the better-ui CLI tool.