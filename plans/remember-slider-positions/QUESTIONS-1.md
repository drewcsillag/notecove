# Questions - Remember Slider Positions

## Current State Summary

Based on my exploration, here's what I found:

### What Already Works

1. **Main 3-panel layout** (folder/tags | notes list | editor) - sizes ARE persisted via `AppStateKey.PanelSizes` in the database
2. **Left sidebar split** (folder panel | tags panel) - sizes ARE persisted via `AppStateKey.LeftSidebarPanelSizes` in the database
3. **Comment panel** in editor - uses localStorage (less robust than DB, but works)

### What's Broken

1. **Toggle Folder Panel** menu item - the handler exists but just logs "not yet implemented"
2. **Toggle Folder Panel hotkey** (Cmd+Shift+1) - same issue, not implemented

## Questions

### Q1: Persistence Already Working?

My exploration shows that panel sizes ARE already being persisted to the database. The code in `App.tsx` loads `PanelSizes` and `LeftSidebarPanelSizes` on mount and saves them when changed.

**Are you seeing the sliders NOT remembering positions across restarts?** If so, there might be a bug in the load/save logic rather than missing functionality.

Or is the issue that you want the **comment panel** (rightmost slider in the editor) to also use database persistence instead of localStorage?

They are not remembering when it restarts. In addition to the sliders, whether the folder or tags panels have been toggled should be stored as well.

and since we're persisting things like this (or fixing the existing things), we should store the scroll position of notes so that when they're reopened, they reopen where they were left. The scroll position should not be stored in the CRDT structure!

### Q2: Toggle Folder Panel - Desired Behavior

The "Toggle Folder Panel" menu item sends an IPC event but the handler is a TODO. What behavior do you want?

Options:

1. **Collapse/Expand the left panel entirely** (hide folder AND tags)
2. **Collapse/Expand just the folder section** within the left sidebar (keeping tags visible)
3. Something else?

Note: "Toggle Tags Panel" (Cmd+Shift+2) already works and hides/shows the tags section within the left sidebar.

Collapse/expand just the folder section

### Q3: Should I Test Current Persistence?

Before adding new code, should I verify whether the current persistence is actually broken? I could:

1. Run the app
2. Resize panels
3. Restart app
4. Check if sizes were restored

This would tell us if this is a "feature needed" vs "bug to fix" situation.

yes test the code first. But manual testing tells me they don't work, but having programmatic tests are still good!
