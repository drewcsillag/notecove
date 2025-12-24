# Fix: Profile API not available

**Overall Progress:** `100%`

## Problem

When starting NoteCove with `pnpm dev`, the profile picker showed "Profile API not available" error.

## Root Cause

Commit `2fad1a2` ("fix: test failures and preload path resolution") changed the preload path resolution assuming `app.getAppPath()` always returns `dist-electron/main`. In reality it varies:

| Launch Method | `app.getAppPath()` Returns |
|--------------|---------------------------|
| Dev mode (`pnpm dev`) | package root |
| Test with `args: ['.']` | package root |
| Test with explicit main path | `dist-electron/main` |
| Production (asar) | path inside asar |

## Solution

Added `isAppPathInDistElectronMain()` helper function that detects the actual path format:

```ts
function isAppPathInDistElectronMain(): boolean {
  const appPath = app.getAppPath();
  return appPath.endsWith('dist-electron/main') || appPath.includes('.asar');
}
```

Uses appropriate path resolution based on detection:
- Package root: use `dist-electron/preload/...` etc.
- dist-electron/main or asar: use `../preload/...` etc.

## Files Changed

### Commit 1: fix: preload path resolution for all launch methods
- [x] 🟩 `src/main/profile-picker/index.ts` - Fixed preload/renderer paths
- [x] 🟩 `src/main/window-manager.ts` - Fixed preload/renderer paths

### Commit 2: fix: path resolution for web-server and resources
- [x] 🟩 `src/main/web-server/manager.ts` - Fixed dist-browser path
- [x] 🟩 `src/main/note-init.ts` - Fixed resources path for welcome.md

## Verification

- [x] 🟩 `pnpm dev` works - profile picker loads correctly
- [x] 🟩 backup-restore E2E tests pass (uses `args: ['.']`)
- [x] 🟩 profile-picker E2E tests pass (uses explicit main path)
- [x] 🟩 web-server E2E test passes (was failing with 404)

## Remaining Test Failures (Pre-existing, Unrelated)

These failures exist independently of path resolution:
- `note-count-badges` - folder visibility timing issue
- `search` - search persistence not working across restarts
- `cross-machine-sync-*` - various sync mechanism timing issues
