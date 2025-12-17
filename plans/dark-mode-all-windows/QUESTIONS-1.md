# Dark Mode All Windows - Questions

## Findings

I've analyzed the codebase and found **two separate issues** that cause dark mode to only toggle for one window:

### Issue 1: Menu sends only to mainWindow

In `menu.ts` (lines 260-264):

```typescript
click: () => {
  if (mainWindow) {
    mainWindow.webContents.send('menu:toggle-dark-mode');
  }
};
```

The "Toggle Dark Mode" menu action only sends the IPC message to `mainWindow`, not to all windows. The menu already has access to `allWindows` (line 64), but it's not being used for dark mode.

### Issue 2: Windows don't sync theme changes

Each window independently loads the theme from the database on startup (`App.tsx` lines 301-316), and saves its own changes (`App.tsx` lines 319-331). However:

- **When one window toggles dark mode**, it saves to the database
- **Other windows don't know the database has changed** - there's no IPC broadcast or listener for theme changes

## Questions

1. **Which approach should we use for syncing theme across windows?**

   **Option A: Broadcast from main process**
   - When menu triggers toggle, main process sends `menu:toggle-dark-mode` to ALL windows
   - When Settings dialog changes theme, renderer tells main, main broadcasts to ALL windows
   - Pros: Simple, consistent, main process is source of truth
   - Cons: Need to add IPC for Settings dialog theme change

   **Option B: Database-driven with change notification**
   - When theme changes, save to database and broadcast `theme:changed` event to all windows
   - Each window listens for `theme:changed` and re-reads from database
   - Pros: Theme persists, works even if a window is created after the change
   - Cons: Slight complexity with database reads

   **Option C: Broadcast new value directly**
   - Main process broadcasts the actual new theme value ('light' or 'dark') to all windows
   - Windows apply directly without re-reading database
   - Pros: Fastest, no extra database reads
   - Cons: Database save still happens separately (could get out of sync theoretically)

   **I recommend Option C** - it's the most straightforward and performant. The database save happens in the window that initiated the change, and all windows receive the new value directly.

C

2. **Should the Settings dialog theme change also broadcast?**

   Currently the Settings dialog sets `themeMode` locally via callback, which saves to database. This means if you have two windows open and change theme in Settings, only that window changes.

   **I believe yes** - Settings changes should broadcast to all windows, same as the menu toggle.
   This is correct

## No Questions Remain

I believe Option C with Settings broadcasting is the right approach. Let me know if you want to proceed or if you have a different preference.
