# Questions - Collapse Left Pane Feature

## Current Understanding

Based on my exploration, the app has:

- **Three-panel layout**: Left (Folders+Tags), Middle (Notes List), Right (Editor)
- **Left sidebar** is a nested vertical PanelGroup with FolderPanel and TagPanel
- **Existing toggles**: `Cmd+Shift+1` toggles FolderPanel, `Cmd+Shift+2` toggles TagPanel
- **State persistence**: `showFolderPanel` and `showTagPanel` booleans, plus panel sizes

The feature request:

1. If **both** folder and tags are collapsed → collapse the entire left pane to zero
2. If **either** is uncollapsed when the left pane is collapsed → restore the left pane
3. Add a "Toggle Notes List" option in View menu with hotkey → collapses middle pane

## Questions

### Q1: "Collapsed" Definition

When you say "folder and tags are collapsed", do you mean:

- **A)** The FolderPanel/TagPanel visibility toggles (`showFolderPanel`/`showTagPanel` = false)
- **B)** The folders inside FolderTree are all collapsed (all chevrons pointing right)
- **C)** Something else?

My assumption: **A** - using the existing visibility toggles.

You're correct, A

### Q2: Left Pane Auto-Collapse Behavior

When both panels are hidden via toggles, should the left pane:

- **A)** Collapse to zero width automatically (no user action needed)
- **B)** Collapse to a minimal width showing just the SyncStatusIndicator
- **C)** Collapse to zero but show a thin "expand" handle on hover

My assumption: **A** - but this means SyncStatusIndicator would also be hidden.

Huh, I never saw the syncstatusindicator... But yes, A.

### Q3: SyncStatusIndicator Location

Currently SyncStatusIndicator lives at the bottom of LeftSidebar. If left pane collapses to zero:

- **A)** Move it elsewhere (where?)
- **B)** It's okay to hide it when left pane is collapsed
- **C)** Keep a minimal strip visible just for sync indicator

There's no bottom statusbar (or statusbar like thing) surface on notecove windows. Maybe we should have one.

### Q4: Auto-Restore Trigger

"If either one of them is uncollapsed when the left-most pane is collapsed, restore the left-most pane"

Who triggers the uncollapse when the pane is at zero width?

- **A)** Only via menu/hotkey (Cmd+Shift+1 or Cmd+Shift+2)
- **B)** Some UI element that remains visible even when collapsed
- **C)** Both

My assumption: **A** - since there's no visible UI when collapsed.

A

### Q5: Middle Pane Toggle Hotkey

For "Toggle Notes List" hotkey, what hotkey do you prefer?

- **A)** `Cmd+Shift+3` (continues the pattern: 1=folders, 2=tags, 3=notes list)
- **B)** Something else?

My assumption: **A** - `Cmd+Shift+3`.

A sounds good

### Q6: Middle Pane Collapse Behavior

When the notes list (middle pane) is collapsed:

- **A)** Collapse to zero width (notes list completely hidden)
- **B)** Collapse to minimal width showing just the search field
- **C)** Something else

My assumption: **A** - zero width, editor takes remaining space.

A

### Q7: State Persistence

Should the collapsed states persist across app restarts?

- **A)** Yes, remember if left pane and/or middle pane were collapsed
- **B)** No, always start with default expanded state

My assumption: **A** - persist like other panel states.

A

### Q8: Interaction with Panel Resizing

If user manually drags the left pane to zero width (via resize handle), should that:

- **A)** Automatically set both `showFolderPanel` and `showTagPanel` to false
- **B)** Be a separate "pane width" state independent of panel visibility
- **C)** Not be possible (remove ability to drag to zero)

My assumption: **B** - keep them independent, but this may cause confusion.

B

### Q9: Visual Indicator When Collapsed

When left pane or middle pane is collapsed, should there be any visual indicator to help users discover how to restore it?

- **A)** No, hotkeys/menu are sufficient
- **B)** A thin vertical strip with an expand icon
- **C)** Tooltip on first collapse explaining how to restore

C -- But tell me more about B -- I can't quite visualize it. We might want B also
