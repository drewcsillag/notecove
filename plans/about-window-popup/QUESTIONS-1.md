# Questions for About Window Feature

## Phase 1: Analysis & Questions

### Current Implementation Summary

The "About NoteCove" menu item currently:

1. **macOS**: Appears in the NoteCove app menu (line 81-87 in `menu.ts`)
2. **Windows/Linux**: Appears in the Help menu (line 587-594 in `menu.ts`)
3. Sends `menu:about` IPC message to `mainWindow`
4. Renderer listens via `onAbout` callback in `App.tsx` (line 506-508)
5. Opens `AboutDialog` component - a MUI `<Dialog>` rendered inline in whichever window receives the message

### The Problem

When "About NoteCove" is clicked, the dialog appears inside `mainWindow`, which may not be the focused window. If the user has multiple NoteCove windows open, the about dialog appears in "a random notecove window" (specifically, always `mainWindow`).

### Questions

1. **Window behavior**: Should the About window be:
   - a) A **child window** of the focused window (closes when parent closes, always on top of parent)?
   - b) A completely **independent window** (lives independently, like Storage Inspector)?

B

2. **Multiple About windows**: If the user opens "About" while an About window already exists, should we:
   - a) Focus the existing About window (singleton pattern, like Sync Status)?
   - b) Allow opening multiple About windows?

b

3. **Window size**: The current dialog is `maxWidth="xs"` (small). What approximate pixel size should the independent window be? I'm thinking ~400x350 would be reasonable.

sounds good 4. **Should the About window be resizable?** Current dialog is a fixed size.

yes

5. **Menu bar**: Should the About window have the application menu bar, or be a minimal window without menus?

minimal window without menus
