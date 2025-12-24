# Questions - Profile Panel Blank in Release Build

## Issue Identified

The profile picker panel is blank in release builds. This is caused by incorrect path resolution for the preload scripts and renderer HTML files.

## Root Cause Analysis

When running from an asar archive:

- `app.getAppPath()` returns `/path/to/NoteCove.app/Contents/Resources/app.asar`
- The code incorrectly assumes this path ends in `dist-electron/main` when inside asar
- Current logic: `join(app.getAppPath(), "..", "preload/profile-picker.js")` = `/path/to/Contents/Resources/preload/profile-picker.js` (OUTSIDE asar - wrong!)
- Correct path: `join(app.getAppPath(), "dist-electron/preload/profile-picker.js")` = `/path/to/app.asar/dist-electron/preload/profile-picker.js` (INSIDE asar - correct!)

## The Bug in Code

The `isAppPathInDistElectronMain()` function returns `true` for asar paths, leading to the wrong branch being taken:

```javascript
function isAppPathInDistElectronMain(): boolean {
  const appPath = app.getAppPath();
  return appPath.endsWith('dist-electron/main') || appPath.includes('.asar');
}
```

When this returns `true`, the code uses `..` to go UP from what it thinks is `dist-electron/main`, but in asar mode, `app.getAppPath()` points to the asar itself, not to `dist-electron/main` inside it.

## Affected Files

1. `packages/desktop/src/main/profile-picker/index.ts` - Profile picker preload and renderer paths
2. `packages/desktop/src/main/window-manager.ts` - Main window preload and renderer paths
3. Possibly `packages/desktop/src/main/web-server/manager.ts` - Static file serving paths
4. Possibly `packages/desktop/src/main/note-init.ts` - Resources path for welcome.md

## Confirmed Questions

No additional questions needed - the issue is clear:

1. The path resolution logic incorrectly treats asar mode the same as running from `dist-electron/main`
2. In asar mode, files are accessed via `app.getAppPath()/dist-electron/...`, not `app.getAppPath()/../...`

## Proposed Fix

Separate the asar case from the `dist-electron/main` case:

- For asar: use `join(app.getAppPath(), 'dist-electron/preload/...')`
- For tests running from `dist-electron/main`: use `join(app.getAppPath(), '../preload/...')`
- For dev mode (package root): use `join(app.getAppPath(), 'dist-electron/preload/...')`

This means asar and dev mode use the same paths, only tests with explicit main path need the `..` navigation.
