# Questions - Profile API not available

## Context

When starting NoteCove, you get "Profile API not available" for the profile selector.

This error occurs in `ProfilePicker.tsx:61` when `window.profilePickerAPI` is `undefined`.

The `profilePickerAPI` is supposed to be exposed by the preload script at `src/preload/profile-picker.ts`.

## Investigation Findings

1. **The preload script exists and is built correctly** at `dist-electron/preload/profile-picker.js`

2. **The BrowserWindow configuration looks correct** in `src/main/profile-picker/index.ts`:
   - `preload: getProfilePickerPreloadPath()` points to the correct file
   - `sandbox: false` allows the preload script to run
   - `contextIsolation: true` (correct)
   - `nodeIntegration: false` (correct)

3. **Path calculation** in `getProfilePickerPreloadPath()`:
   ```ts
   return join(app.getAppPath(), '..', 'preload/profile-picker.js');
   ```
   This assumes `app.getAppPath()` returns `dist-electron/main`.

## Questions

1. **How are you starting NoteCove?**
   - `pnpm dev` (development mode)?
   - Running the built app directly?
   - Something else?

`pnpm dev`

2. **Do you see any console errors in the Electron main process?**
   - When running `pnpm dev`, there should be terminal output
   - Look for any errors mentioning the preload script

the only terminal output is
[Telemetry] Console metrics enabled
[Telemetry] Local mode only - remote metrics disabled
[Telemetry] OpenTelemetry SDK initialized
[Telemetry] OpenTelemetry initialized
[Profile] Showing profile picker...
[ProfileStorage] Loaded 2 profiles

3. **Did this work before, and something changed recently?**
   - Is this a new issue that appeared after a recent change?
   - Or has it never worked for you?

it stopped working sometime today

4. **What platform are you on?**
   - macOS, Windows, or Linux?

MacOs

5. **Is the build fresh?**
   - Have you tried running `pnpm build` before `pnpm dev`?
   - Sometimes dev mode can have stale build artifacts

yes build is fresh

## Most Likely Causes

Based on my analysis, the most likely causes are:

1. **Dev mode path resolution issue**: In development mode, `app.getAppPath()` might return a different path than expected, causing the preload script path to be wrong.

2. **Preload script not built**: The preload script might not be built/hot-reloaded in dev mode before the profile picker window opens.

3. **Race condition**: The window might be loading before the preload script is ready.
