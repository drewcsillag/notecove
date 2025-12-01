# Phase 1: Titlebar & About Dialog

**Phase Progress:** `100%` ✅

**Parent Plan:** [PLAN-DEV-TITLEBAR.md](./PLAN-DEV-TITLEBAR.md)

---

## Step 1: Fix titlebar `[DEV]` prefix not displaying

**Progress:** `100%` ✅

### Problem

The `<title>NoteCove</title>` in `index.html` overrides the Electron window title set via `BrowserWindow({ title: getWindowTitle() })`.

### Solution

Have renderer dynamically set `document.title` after loading app info from main process via IPC.

### Substeps

- [x] 🟩 **1.1** Write E2E test to verify window title includes `[DEV]` in dev mode
  - File: `packages/desktop/e2e/titlebar.spec.ts`
  - Test: window title matches expected pattern `[DEV] NoteCove` or `[DEV] NoteCove - ProfileName`

- [x] 🟩 **1.2** Add IPC handler `app:getInfo` in main process
  - File: `packages/desktop/src/main/index.ts`
  - Returns: `{ version, isDevBuild, profileName, profileId }`
  - Version from: `app.getVersion()` or read from package.json

- [x] 🟩 **1.3** Add `app.getInfo()` to preload API
  - File: `packages/desktop/src/preload/index.ts`
  - Add to `electronAPI.app` namespace

- [x] 🟩 **1.4** Update renderer to set `document.title` on load
  - File: `packages/desktop/src/renderer/src/App.tsx`
  - Call `window.electronAPI.app.getInfo()` in useEffect
  - Build title: `${isDevBuild ? '[DEV] ' : ''}NoteCove${profileName ? ` - ${profileName}` : ''}`

- [x] 🟩 **1.5** Update type definitions
  - File: `packages/desktop/src/renderer/src/types/electron.d.ts`
  - Add `app.getInfo()` return type

---

## Step 2: Implement About dialog

**Progress:** `100%` ✅

### Solution

Create a React modal component triggered by the About menu item.

### Substeps

- [x] 🟩 **2.1** Write unit test for AboutDialog component
  - File: `packages/desktop/src/renderer/src/components/AboutDialog/__tests__/AboutDialog.test.tsx`
  - Tests: renders all expected content, license link works, close button works

- [x] 🟩 **2.2** Create AboutDialog component
  - File: `packages/desktop/src/renderer/src/components/AboutDialog/AboutDialog.tsx`
  - Content:
    - "NoteCove" (app name)
    - Version: `0.1.0`
    - "Development Build" (only if dev)
    - Profile: `{name} ({id})`
    - "© 2025 Drew Csillag"
    - "Licensed under Apache 2.0" (clickable link)

- [x] 🟩 **2.3** Add IPC handler for opening external URLs
  - File: `packages/desktop/src/main/index.ts`
  - Handler: `shell:openExternal`
  - Uses: `shell.openExternal(url)`

- [x] 🟩 **2.4** Add `shell.openExternal()` to preload API
  - File: `packages/desktop/src/preload/index.ts`
  - Add to `electronAPI.shell` namespace

- [x] 🟩 **2.5** Wire About menu to show dialog
  - File: `packages/desktop/src/renderer/src/App.tsx`
  - Add state: `aboutOpen`
  - Update `onAbout` handler to set state
  - Render `AboutDialog` component when state is true

- [x] 🟩 **2.6** Style AboutDialog to match app design
  - Use existing modal/dialog patterns from codebase
  - Center content, reasonable padding
  - Close button or click-outside-to-close

---

## Files Modified

| File                                                                                      | Changes                                                    |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/desktop/src/main/index.ts`                                                      | Add `app:getInfo`, `shell:openExternal` IPC handlers       |
| `packages/desktop/src/preload/index.ts`                                                   | Add `app.getInfo()`, `shell.openExternal()`                |
| `packages/desktop/src/renderer/src/App.tsx`                                               | Set document.title, wire About dialog, add aboutOpen state |
| `packages/desktop/src/renderer/src/types/electron.d.ts`                                   | Add new API types (app, shell)                             |
| `packages/desktop/src/renderer/src/components/AboutDialog/AboutDialog.tsx`                | New component                                              |
| `packages/desktop/src/renderer/src/components/AboutDialog/__tests__/AboutDialog.test.tsx` | New test                                                   |
| `packages/desktop/e2e/titlebar.spec.ts`                                                   | New E2E test                                               |

---

## Verification

After Phase 1 completion:

1. ✅ Run `pnpm dev` - titlebar shows `[DEV] NoteCove - ProfileName`
2. ✅ Click Help > About NoteCove - dialog shows with all info
3. ✅ Click Apache 2.0 link - opens browser to license URL
4. Run packaged build - titlebar shows `NoteCove - ProfileName` (no `[DEV]`) - not tested yet
