# About Window Implementation Plan

**Overall Progress:** `100%`

## Summary

Convert the "About NoteCove" menu item from opening a dialog inside `mainWindow` to opening an independent, minimal window.

### Requirements (from Q&A)

- Independent window (not a child window)
- Allow multiple About windows
- Size: ~400x350 pixels, resizable
- Minimal window without menu bar

## Tasks

- [x] 🟩 **Step 1: Add "about" window type to window manager**
  - [x] 🟩 Add `about?: boolean` to `CreateWindowOptions` interface
  - [x] 🟩 Add size defaults (400x350) for about windows
  - [x] 🟩 Add window title "About NoteCove"
  - [x] 🟩 Add `about` to URL params
  - [x] 🟩 Add `about` window type for state tracking (won't be restored on restart - this is correct)
  - [x] 🟩 Remove menu bar on Windows/Linux via `window.setMenu(null)`

- [x] 🟩 **Step 2: Update menu to open About window directly**
  - [x] 🟩 Change macOS About menu handler to call `createWindow({ about: true })`
  - [x] 🟩 Change Windows/Linux About menu handler similarly
  - [x] 🟩 Remove TODO comments about "Show About dialog"

- [x] 🟩 **Step 3: Create AboutWindow renderer component**
  - [x] 🟩 Write tests for AboutWindow component
  - [x] 🟩 Create `AboutWindow.tsx` that renders the about content full-window
  - [x] 🟩 Reuse content from existing `AboutDialog` (extract shared content or inline)

- [x] 🟩 **Step 4: Update App.tsx to detect and render AboutWindow**
  - [x] 🟩 Add `aboutMode` state based on URL params
  - [x] 🟩 Render `AboutWindow` when in about mode (similar to noteInfoMode, syncStatusMode)

- [x] 🟩 **Step 5: Clean up old dialog-based implementation**
  - [x] 🟩 Remove `aboutOpen` state from App.tsx
  - [x] 🟩 Remove `onAbout` listener registration from App.tsx
  - [x] 🟩 Remove `<AboutDialog>` rendering from App.tsx
  - [x] 🟩 Remove `onAbout` from preload window-api.ts
  - [x] 🟩 Remove `menu:about` handling from menu.ts (it now opens window directly)
  - [x] 🟩 Delete old `AboutDialog` component and its tests (replaced by AboutWindow)
  - [x] 🟩 Update type definitions (remove onAbout from electron.d.ts)

- [x] 🟩 **Step 6: Update tests**
  - [x] 🟩 Update App.test.tsx to remove about dialog tests (mocks, etc.)
  - [x] 🟩 Update any mocks that include onAbout in test files

- [x] 🟩 **Step 7: Run CI and verify**
  - [x] 🟩 Run ci-local to ensure all tests pass
  - [ ] 🟥 Manual testing of About window functionality

## Notes

- Unlike NoteInfo/StorageInspector, About doesn't need IPC from renderer to main because it doesn't need any context from the current window. The menu can directly create the window.
- The old `AboutDialog` component will be deleted entirely since `AboutWindow` replaces it.
- The `menu:about` IPC message and `onAbout` listener are removed (menu opens window directly now).
- On macOS, the app menu bar is global (not per-window), so "no menu bar" only affects Windows/Linux.
- About windows won't be restored on app restart (correct behavior for ephemeral info windows).
