# Dark Mode All Windows - Implementation Plan

**Overall Progress:** `100%`

## Summary

Toggle dark mode across ALL open windows instead of just the focused/main window.

**Approach:** Option C - Broadcast the new theme value directly to all windows via IPC.

See also: [QUESTIONS-1.md](./QUESTIONS-1.md) | [PLAN-CRITIQUE.md](./PLAN-CRITIQUE.md)

## Tasks

- [x] 🟩 **Step 1: Add IPC infrastructure for theme broadcast**
  - [x] 🟩 Add `onThemeChanged(callback)` listener in `window-api.ts` → `theme-api.ts`
  - [x] 🟩 Add `theme:set` invoke method in preload API
  - [x] 🟩 Add type definitions in `electron.d.ts`

- [x] 🟩 **Step 2: Write failing tests for menu broadcast**
  - [x] 🟩 Test: App.tsx registers listener for `theme:changed`
  - [x] 🟩 Test: App.tsx responds to `theme:changed` by updating state
  - [x] 🟩 Test: Theme change from broadcast skips redundant database save

- [x] 🟩 **Step 3: Implement menu broadcast + App.tsx listener**
  - [x] 🟩 Update menu.ts "Toggle Dark Mode" to:
    1. Read current theme from database
    2. Toggle value
    3. Save to database
    4. Broadcast `theme:changed` to ALL windows
  - [x] 🟩 Add useEffect in App.tsx to listen for `theme:changed`
  - [x] 🟩 Use ref to skip redundant database save when theme comes from broadcast
  - [x] 🟩 Tests pass

- [x] 🟩 **Step 4: Write failing tests for Settings broadcast**
  - [x] 🟩 Test: Settings theme toggle calls `theme:set` IPC
  - [x] 🟩 Test: Theme toggle to light also calls `theme:set` IPC

- [x] 🟩 **Step 5: Implement theme:set handler + Settings update**
  - [x] 🟩 Add `theme:set` IPC handler in handlers.ts (saves + broadcasts)
  - [x] 🟩 Update AppearanceSettings to call `theme:set` IPC
  - [x] 🟩 Tests pass

- [x] 🟩 **Step 6: Integration testing**
  - [x] 🟩 Run CI to ensure no regressions (all unit tests pass)
  - [ ] 🟥 Manual test: Open multiple windows, toggle via menu (Cmd+Shift+D)
  - [ ] 🟥 Manual test: Open multiple windows, change in Settings

## Files Modified

| File                                                                                      | Changes                                            |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `packages/desktop/src/preload/api/theme-api.ts`                                           | **NEW** - Theme API with `set()` and `onChanged()` |
| `packages/desktop/src/preload/index.ts`                                                   | Export theme API                                   |
| `packages/desktop/src/renderer/src/types/electron.d.ts`                                   | Add theme API types                                |
| `packages/desktop/src/main/menu.ts`                                                       | Toggle reads DB, saves, broadcasts to all windows  |
| `packages/desktop/src/main/ipc/handlers.ts`                                               | Add `theme:set` handler                            |
| `packages/desktop/src/renderer/src/App.tsx`                                               | Listen for `theme:changed`, ref for skip save      |
| `packages/desktop/src/renderer/src/components/Settings/AppearanceSettings.tsx`            | Use IPC for theme change                           |
| `packages/desktop/src/renderer/src/__tests__/App.test.tsx`                                | Add theme broadcasting tests                       |
| `packages/desktop/src/renderer/src/components/Settings/__tests__/SettingsDialog.test.tsx` | Add theme broadcasting tests                       |
| `packages/desktop/src/renderer/src/api/browser-stub.ts`                                   | Add theme API stub (CI auto-fix)                   |
| `packages/desktop/src/renderer/src/api/web-client.ts`                                     | Add theme API stub (CI auto-fix)                   |
| `packages/desktop/src/renderer/src/__tests__/multi-sd-bugs.test.tsx`                      | Add theme mock (CI auto-fix)                       |

## Design Decisions

1. **Main process handles toggle** - Menu reads current theme, toggles, saves, broadcasts. Avoids race conditions.

2. **Settings requests via IPC** - Settings calls `theme:set`, main saves and broadcasts to all.

3. **Ref to skip redundant saves** - When App.tsx receives `theme:changed`, it sets a ref before updating state. The save useEffect checks this ref and skips if set.

4. **New windows load from database** - Unchanged behavior for initial load.
