# Questions: Cosmetic Hotkey Fixes

## Current State Analysis

I've analyzed the codebase and found:

### 1. Find Hotkeys (in `menu.ts`)

- Current "Find..." (Cmd+F) sends `menu:find` → opens quick find
- Current "Find in Note" (Cmd+Shift+F) sends `menu:find-in-note` → opens in-note search

**Your request:**

- "Find Note" should be Cmd+Option+F (currently labeled "Find..." with Cmd+F)
- "Find in Note" should be Cmd+F (currently Cmd+Shift+F)

This is essentially swapping/reassigning the accelerators and renaming "Find..." to "Find Note".

### 2. Panel Toggle Hotkeys (Shift+Cmd+1, Shift+Cmd+2)

Current code always sends to `mainWindow`:

```typescript
click: () => {
  if (mainWindow) {
    mainWindow.webContents.send('menu:toggle-folder-panel');
  }
};
```

Should use `BrowserWindow.getFocusedWindow()` like other menu items already do.

### 3. Cmd+X with No Selection

The Edit menu uses `{ role: 'cut' }` which is Electron's built-in cut. To customize "cut current line when no selection", I would need to add a custom handler.

## Questions

### Q1: Cmd+X "Delete Current Line" Behavior

When Cmd+X is pressed with no selection, should it:
a) **Cut the current line** - put the line in clipboard AND delete it (like VS Code/Sublime)
b) **Delete the current line only** - just delete, don't put in clipboard

Based on your prompt saying "delete the current line", I'm assuming (b), but in most editors Cmd+X with no selection cuts (copies then deletes).

actually, I want A

### Q2: Confirming the Find Hotkey Swap

Just to confirm the final state:

- **Edit → Find Note**: Cmd+Option+F (opens quick search for notes)
- **Edit → Find in Note**: Cmd+F (opens in-note search/replace)

Is that correct?

Correct

### Q3: Notes List Toggle (Shift+Cmd+0)

Should Shift+Cmd+0 also operate on the focused window instead of always mainWindow? (It currently has the same issue as 1 and 2)

Yes
