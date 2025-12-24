# Fix Profile Panel Blank in Release Build

**Overall Progress:** `100%`

## Problem Summary

The profile picker (and likely main window) are blank in release builds because path resolution for preload scripts and renderer HTML is broken when running from an asar archive.

**Root Cause:** The `isAppPathInDistElectronMain()` function incorrectly groups asar mode with the `dist-electron/main` case, but they require different path resolution strategies.

| Launch Method           | `app.getAppPath()` returns | Correct preload path        |
| ----------------------- | -------------------------- | --------------------------- |
| Dev mode (`pnpm dev`)   | Package root               | `dist-electron/preload/...` |
| Test with `args: ['.']` | Package root               | `dist-electron/preload/...` |
| Test with explicit main | `dist-electron/main`       | `../preload/...`            |
| **Production (asar)**   | Path to `.asar` file       | `dist-electron/preload/...` |

The fix: asar should use the same paths as dev mode, NOT the `../` navigation.

## Related Files

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Root cause analysis

## Tasks

- [x] 🟩 **Step 1: Fix path resolution in profile-picker/index.ts**
  - [x] 🟩 Update `isAppPathInDistElectronMain()` to NOT include asar case
  - [x] 🟩 Verify preload path resolves correctly for all launch methods

- [x] 🟩 **Step 2: Fix path resolution in window-manager.ts**
  - [x] 🟩 Apply same fix to `isAppPathInDistElectronMain()` function
  - [x] 🟩 Verify main window preload and renderer paths

- [x] 🟩 **Step 3: Check and fix other affected files**
  - [x] 🟩 Review `web-server/manager.ts` for similar issues (fixed for consistency)
  - [x] 🟩 Review `note-init.ts` for similar issues (fixed for consistency)

- [x] 🟩 **Step 4: Test the fix**
  - [x] 🟩 Test dev mode (`pnpm dev`) still works
  - [x] 🟩 Build release (`pnpm build:mac`)
  - [x] 🟩 Test release build - profile picker should display
  - [x] 🟩 Test release build - main window should work after profile selection

- [x] 🟩 **Step 5: Run CI and commit**
  - [x] 🟩 Run ci-runner (12 E2E failures are pre-existing - verified on main)
  - [x] 🟩 Commit the fix

## Implementation Details

### Current (Broken) Logic

```javascript
function isAppPathInDistElectronMain(): boolean {
  const appPath = app.getAppPath();
  return appPath.endsWith('dist-electron/main') || appPath.includes('.asar');
}

function getPreloadPath(): string {
  if (isAppPathInDistElectronMain()) {
    return join(app.getAppPath(), '..', 'preload/index.js');  // WRONG for asar!
  }
  return join(app.getAppPath(), 'dist-electron/preload/index.js');
}
```

### Fixed Logic

```javascript
function isAppPathInDistElectronMain(): boolean {
  const appPath = app.getAppPath();
  // Only true when running from dist-electron/main directly (some test configurations)
  // NOT for asar - asar paths use app.getAppPath()/dist-electron/... like dev mode
  return appPath.endsWith('dist-electron/main');
}

function getPreloadPath(): string {
  if (isAppPathInDistElectronMain()) {
    // Test with explicit main path: go up from dist-electron/main
    return join(app.getAppPath(), '..', 'preload/index.js');
  }
  // Dev mode, asar, and most test configs: path relative to package/asar root
  return join(app.getAppPath(), 'dist-electron/preload/index.js');
}
```

The key insight: In asar mode, `app.getAppPath()` returns the asar file path, and Electron's virtual filesystem allows accessing files inside via `asar-path/internal-path`. So `app.asar/dist-electron/preload/index.js` works correctly.

## Plan Critique Notes

**Why we need `endsWith('dist-electron/main')`:** E2E tests launch Electron with an explicit path to the main script (e.g., `args: ['/path/to/dist-electron/main/index.js']`). In this case, `app.getAppPath()` returns `/path/to/dist-electron/main`. So the `../preload/...` navigation is correct for this case.

**Why asar is different:** When running from asar, `app.getAppPath()` returns the path TO the asar file (e.g., `/path/to/app.asar`), not a path inside it. Files inside the asar are accessed via Electron's virtual filesystem: `app.asar/dist-electron/preload/...`.

**Risk:** Low - the fix is a one-line change (remove `|| appPath.includes('.asar')`). E2E tests verify the test-launch path still works.
