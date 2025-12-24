# Fix: Profile API not available

**Overall Progress:** `100%`

## Problem

When starting NoteCove with `pnpm dev`, the profile picker showed "Profile API not available" error.

## Root Cause

Commit `2fad1a2` ("fix: test failures and preload path resolution") changed the preload path resolution to fix E2E tests, but broke dev mode:

**Before (worked in dev):**

```ts
return join(app.getAppPath(), 'dist-electron/preload/profile-picker.js');
```

**After (broke dev):**

```ts
return join(app.getAppPath(), '..', 'preload/profile-picker.js');
```

The issue: `app.getAppPath()` returns different values:

- **Dev mode:** Package root (e.g., `/path/to/packages/desktop`)
- **Production:** `dist-electron/main`

## Solution

Check `is.dev` and use the appropriate path for each mode:

```ts
function getProfilePickerPreloadPath(): string {
  if (is.dev) {
    return join(app.getAppPath(), 'dist-electron/preload/profile-picker.js');
  }
  return join(app.getAppPath(), '..', 'preload/profile-picker.js');
}
```

## Files Changed

- [x] 🟩 `src/main/profile-picker/index.ts` - Fixed `getProfilePickerPreloadPath()` and `getProfilePickerRendererPath()`
- [x] 🟩 `src/main/window-manager.ts` - Fixed `getPreloadPath()` and `getRendererPath()`

## Verification

- [x] 🟩 `pnpm dev` works - profile picker loads correctly
- [ ] 🟥 CI tests pass
- [ ] 🟥 E2E tests pass (these run on built app, so production paths are tested)
