# Questions - Round 2

## Confirmed from Round 1:

- Q1: A - visibility toggles
- Q2: A - collapse to zero width
- Q3: B - add bottom statusbar, move SyncStatusIndicator there
- Q4: A - restore via menu/hotkey only
- Q5: A - `Cmd+Shift+3` for notes list toggle
- Q6: A - zero width collapse
- Q7: A - persist state
- Q8: B - keep resize and visibility independent
- Q9: B + C - thin vertical strip + tooltip on first collapse

---

## New Questions

### Q10: Bottom Statusbar Scope

For the new bottom statusbar:

- **A)** Minimal: Just SyncStatusIndicator, spans full window width at bottom
- **B)** Future-ready: Reserve space for other status items (e.g., word count, note count, current folder path, etc.) but only implement sync indicator now
- **C)** Full: Design and implement multiple status items now

My assumption: **B** - design it to accommodate future items, but only implement sync indicator for this feature.

B

### Q11: Bottom Statusbar Height

- **A)** Compact: ~20-24px (like VS Code)
- **B)** Standard: ~28-32px (like Slack, Discord)
- **C)** Whatever looks good with existing MUI components

My assumption: **C** - let MUI's natural sizing determine it.

C

### Q12: Thin Expand Strip Appearance

For the collapsed pane indicator strip:

- **A)** Subtle: Same background as surrounding area, only visible on hover
- **B)** Visible: Slightly different background color, always shows a faint line
- **C)** Icon-based: Shows a small chevron/arrow icon even when not hovered

My assumption: **B** - subtle but visible so users know something is there.

B

### Q13: Thin Strip Click vs Drag

When user interacts with the expand strip:

- **A)** Click expands to previous size, drag allows custom sizing
- **B)** Click only - expands to previous/default size
- **C)** Click expands to default size (ignores previous)

My assumption: **A** - click restores previous size, drag allows adjustment.

A

### Q14: Tooltip Persistence

For the "first collapse" tooltip:

- **A)** Show once ever per user (persist "has seen tooltip" flag)
- **B)** Show once per session
- **C)** Show for first few collapses (e.g., 3 times) then stop

My assumption: **A** - once user has seen it, don't show again.

A

### Q15: Tooltip Content

What should the tooltip say? Example:

> "Press Cmd+Shift+1 to show Folders, Cmd+Shift+2 to show Tags, or click this strip"

Or shorter:

> "Click to expand, or use View menu"

My assumption: Include the specific hotkeys since they're the primary way to restore.

Go with the one including the hotkeys
