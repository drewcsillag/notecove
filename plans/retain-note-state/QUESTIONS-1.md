# Questions for State Retention Feature

## Findings Summary

Before the questions, here's what I discovered about the current state:

### Currently Persisted

- **Panel sizes** (`PanelSizes`): 3 percentages [left%, middle%, right%] ✓
- **Theme mode** (`ThemeMode`): light/dark ✓
- **Folder collapse state** (`FolderCollapseState`): which folders expanded ✓
- **Selected folder** (via FolderPanel internal state) ✓
- **Username/UserHandle**: user preferences ✓

### Defined but NOT Used

- `LastOpenedNote` - exists in schema but not wired up
- `WindowPosition` - exists in schema but not wired up
- `WindowSize` - exists in schema but not wired up
- `LeftPanelWidth` / `RightPanelWidth` - legacy keys, unused

### Not Persisted at All

- Which notes are open in which windows
- Window position (x, y coordinates)
- Window size (width, height)
- Maximized/minimized state
- Scroll positions in editor/notes list/folder tree
- Editor cursor position

### Architecture Notes

- Window creation in `packages/desktop/src/main/index.ts`
- State persisted via `app_state` table in SQLite
- Multi-window support via `allWindows: BrowserWindow[]` array
- Windows can open specific notes via `?noteId=<id>` query param
- Profile-specific databases already exist

---

## Questions

### 1. Window Scope

**Question:** Should the feature restore ALL windows that were open, or just the main window?

**Context:** Currently you can have:

- Main window (full 3-panel layout)
- Minimal windows (single-note popup with `?minimal=true&noteId=<id>`)
- Sync status window (special window for sync debugging)

**Options:**

- A) Restore only the main window with the last-selected note
- B) Restore main window + all minimal windows that had notes open
- C) Restore all windows including sync status if it was open

C - ALL windows

### 2. "Sliders" Clarification

**Question:** What exactly do you mean by "sliders"?

**Current state:** The 3-panel resize dividers (folder panel | notes list | editor) are already persisted via `PanelSizes`. When you restart, panels come back to where they were.

**Possible interpretations:**

- A) The panel resize positions (already working - no change needed)
- B) Some other UI slider I haven't found
- C) Scroll positions within panels (different from resize positions)

A

### 3. Scroll Position Granularity

**Question:** How should scroll positions be tracked?

**Options:**

- A) **Per-window only**: Save scroll positions for the current session, lose them on restart
- B) **Per-note persistent**: Each note remembers its scroll position indefinitely (like VS Code)
- C) **Session-only persistent**: Remember scroll positions just for the current "session" but clear on significant events

**Follow-up:** Should this apply to:

- [x] Editor content scroll position
- [ ] Notes list scroll position
- [ ] Folder tree scroll position
- [ ] All of the above

B

### 4. Editor Cursor Position

**Question:** Should the cursor position within a note be preserved?

When you return to a note, should the cursor be:

- A) At the position where you left it last time
- B) At the beginning of the document
- C) At the end of the document

A

### 5. Multi-Monitor Handling

**Question:** How should the feature behave on multi-monitor setups?

**Context:** If a user had a window on their external monitor and then disconnects it:

- A) Open window on primary monitor (safe default)
- B) Try to restore exact position, may open off-screen (bad UX)
- C) Validate position is visible before restoring, fall back to primary if not

A

### 6. Maximized/Fullscreen State

**Question:** Should maximized/fullscreen window state be restored?

**Options:**

- A) Yes, if the window was maximized, open it maximized
- B) No, always open in normal windowed mode
- C) Restore maximized state, but NOT fullscreen (macOS has special fullscreen spaces)

A

### 7. Per-Profile vs Global

**Question:** Should window state be per-profile or global?

**Context:** The app supports multiple profiles, each with separate databases. Currently:

- Panel sizes are stored in per-profile database
- Theme is stored in per-profile database

**Options:**

- A) Per-profile: Each profile has its own window state (current pattern)
- B) Global: All profiles share window position/size
- C) Hybrid: Window position/size global, but open notes per-profile

A

### 8. "Fresh Start" Behavior

**Question:** Should there be a way to start fresh without restoring state?

**Options:**

- A) No, always restore state
- B) Yes, add a "Start Fresh" menu option
- C) Yes, holding Shift while launching should skip state restoration
- D) Both B and C

D

### 9. Crash Recovery vs Normal Quit

**Question:** Should the behavior differ between normal quit and crash recovery?

**Context:**

- Normal quit: User explicitly quits the app
- Crash/force quit: App closed unexpectedly

**Options:**

- A) Same behavior for both (always restore)
- B) On crash recovery, show a dialog asking if user wants to restore
- C) On crash recovery, restore but show a notification

A

### 10. Note Deletion Edge Case

**Question:** What should happen if a note that was open was deleted (e.g., from another synced device)?

**Options:**

- A) Silently skip that window/note
- B) Show an error notification that "Note X was deleted"
- C) Open the window but show an empty state with a message

C - pick the top note in the notes list

### 11. Storage Directory Removal Edge Case

**Question:** What if a Storage Directory (SD) containing an open note is no longer accessible?

**Context:** Notes live in Storage Directories that could be:

- On removable drives
- In cloud-synced folders that went offline
- Manually deleted

**Options:**

- A) Skip notes from inaccessible SDs silently
- B) Show notification about inaccessible notes
- C) Prompt user to locate the missing SD

A

---

## Implementation Notes (for after questions are resolved)

Based on my analysis, the implementation will likely involve:

1. **Main process changes** (`packages/desktop/src/main/index.ts`):
   - Save window bounds on `move`, `resize`, and `close` events
   - Track which notes are open in which windows
   - Restore windows on `app.ready`

2. **Renderer changes**:
   - Save scroll positions before unload
   - Wire up `AppStateKey.LastOpenedNote`
   - Report current note ID changes to main process

3. **IPC additions**:
   - New handlers for window state get/set
   - Events for note selection changes

4. **Database/Schema**:
   - Use existing `WindowPosition`, `WindowSize` keys
   - May need new keys for open windows list

Let me know your answers and I'll refine the approach!
