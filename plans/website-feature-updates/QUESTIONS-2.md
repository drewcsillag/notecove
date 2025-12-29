# Questions - Documentation Accuracy Audit

After your feedback, I audited the website documentation against the source code. Here are all the issues I found:

---

## 1. Landing Page (website/index.md)

### "Coming Soon" Section is Outdated (lines 80-85)

Current:

```
🔄 Cross-instance sync improvements
📋 Note list panel with search
📋 Tags and inter-note links
📋 iOS app implementation
```

**Issues:**

- "Cross-instance sync improvements" - appears to be done
- "Note list panel with search" - exists in the app
- "Tags and inter-note links" - fully implemented (you confirmed)

**Question:** What should the "Coming Soon" section say? Should it be just:

- iOS app implementation
- (anything else?)

### "What's Working" Section May Need Updates (lines 71-78)

Current list is basic. Should I add more items like:

- Images
- Tables
- Comments
- Export
- Dark Mode
- etc.?

---

## 2. Keyboard Shortcuts (website/guide/keyboard-shortcuts.md)

### WRONG Shortcuts Found:

| Line | Current (WRONG)              | Correct (from menu.ts)             |
| ---- | ---------------------------- | ---------------------------------- |
| 10   | New window: `Cmd+Shift+N`    | **`Cmd+Shift+W`**                  |
| 65   | Global search: `Cmd+Shift+F` | This is "Find in Note" (Edit menu) |
| 81   | New folder: `Cmd+Shift+F`    | **`Cmd+Shift+N`**                  |

### Shortcuts That May Not Exist:

| Line  | Documented                            | Reality                                                 |
| ----- | ------------------------------------- | ------------------------------------------------------- |
| 73    | Toggle sidebar: `Cmd+\`               | `Cmd+\` is "Clear formatting" - no sidebar toggle found |
| 74    | Focus sidebar: `Cmd+Shift+S`          | Not in menu.ts                                          |
| 75    | Focus editor: `Cmd+Shift+E`           | This is Export!                                         |
| 71-72 | Next/Previous note: `Cmd+]` / `Cmd+[` | Not in menu.ts                                          |

### Shortcuts Missing from Docs:

From menu.ts that aren't documented:

- Toggle Dark Mode: `Cmd+Shift+D`
- Toggle Folder Panel: `Cmd+Shift+1`
- Toggle Tags Panel: `Cmd+Shift+2`
- Toggle Notes List: `Cmd+Shift+0`

**Question:** Should I:

1. Remove the non-existent shortcuts?
2. Add the missing real shortcuts?
3. Mark non-existent ones as "Coming soon"?

---

## 3. Basic Usage (website/guide/basic-usage.md)

### WRONG: New Window Shortcut (line 121)

Current: `File → New Window (Cmd+Shift+N / Ctrl+Shift+N)`
Correct: `File → New Window (Cmd+Shift+W / Ctrl+Shift+W)`

### WRONG: Sync Settings Menu Path (line 97)

Current: `File → Preferences → Sync`

**Reality:** There is no "Preferences" or "Sync" menu item. The correct path is:

- macOS: `NoteCove → Settings...` (`Cmd+,`) → Storage Directories tab
- Windows/Linux: `File → Settings...` (`Ctrl+,`) → Storage Directories tab

### Global Search (lines 83-91)

Currently marked as "(Coming soon)" with `Cmd+Shift+F`.
But `Cmd+Shift+F` exists in the menu as "Find in Note".

**Question:** Is global search (across all notes) actually implemented? Or just find-in-note?

---

## 4. Sync Configuration (website/guide/sync-configuration.md)

### WRONG: Menu Path Throughout

Lines 22-23, 33-34, 45-46, 72-73, 134: `File → Preferences → Sync`

**Should be:**

- macOS: `NoteCove → Settings...` → Storage Directories
- Windows/Linux: `File → Settings...` → Storage Directories

### WRONG: Activity Log Menu Path (line 112)

Current: `Help → View Activity Log`

**Reality:** I don't see this in the Help menu. The Help menu has:

- Documentation
- Report Issue
- About NoteCove (Windows/Linux only)

**Question:** Does "View Activity Log" exist somewhere else? Or should it be removed?

### WRONG: Reset Sync State (lines 134-137)

References `File → Preferences → Sync` and a "Reset Sync State" button.

**Question:** Does this button exist in the Settings → Storage Directories tab?

---

## 5. Other Documentation Files to Check

### features/import-export.md

Line 12: `Cmd/Ctrl+Shift+I` for Import

**Conflict:** menu.ts shows BOTH Import Markdown AND Note Info use `CmdOrCtrl+Shift+I`!

Is this a bug in the app, or does one override the other?

### features/collaboration.md (new file I created)

Line 14: `Cmd+Shift+M / Ctrl+Shift+M` for add comment

**Question:** Is this correct? I see `Cmd+Shift+M` mentioned in the code for something related to comments, but need to verify.

### features/rich-text-editing.md

Line 132: References "Insert: Links, images, tables" in toolbar.

**Question:** Does the toolbar actually have image and table insert buttons?

---

## Summary of Actions Needed

1. **Fix landing page "Coming Soon"** - need your input on what to list
2. **Fix all keyboard shortcuts** - major overhaul needed
3. **Fix all menu paths** - "File → Preferences → Sync" → "Settings → Storage Directories"
4. **Verify buttons exist** - Activity Log, Reset Sync State, toolbar buttons
5. **Resolve Import/Note Info shortcut conflict**

**Question:** Before I proceed, please confirm:

1. What should "Coming Soon" on the landing page say?
2. Is "Help → View Activity Log" a valid menu item?
3. Does "Reset Sync State" button exist?
4. Is there a global search (across all notes)?
