# Questions - Note Info Window Feature

## Understanding Summary

I've analyzed the current implementation:

1. **Current UI**: `NoteInfoDialog` is a Material-UI `<Dialog>` component rendered inside the main renderer process. It's modal and opens within whichever window triggered it.

2. **Trigger mechanism**: Menu item `Tools > Note Info` (Cmd+Shift+I) sends `menu:noteInfo` IPC to the focused window's renderer, which sets state to open the dialog.

3. **Data displayed**:
   - Basic: Title, Note ID, SD name/path, Folder path, Tags
   - Timestamps: Created, Modified
   - Document Stats: Characters, Words, Paragraphs (only if note is loaded in memory)
   - Advanced (collapsed accordion): Vector Clock, Document Hash, CRDT Update Count, Snapshot Count, Pack Count, Note Directory, Total File Size, Status

4. **Issues you identified**:
   - Opens in "random" window when multiple windows exist
   - Advanced info requires clicking accordion to see
   - Pack Count is hardcoded to 0 (packs don't exist anymore)
   - CRDT Update Count is wrong (counts log _files_, not actual updates within files)
   - Snapshot Count may also be wrong (same issue?)

5. **Window types in the app**: main, minimal, syncStatus (sync status window already has "only one instance" pattern)

---

## Questions

### 1. Window Behavior

**Q1.1**: Should Note Info be a singleton window (like Sync Status - only one instance, focus if already open), or should multiple Note Info windows be allowed (one per note)?
One per note

**Q1.2**: When opening Note Info for a different note while a Note Info window is already open, should it:

- (a) Replace the content in the existing window, or
- (b) Open a second Note Info window?

second window

**Q1.3**: Should the Note Info window be:

- (a) A child/dependent window (closes when parent closes), or
- (b) An independent window (can stay open even if all other windows close)?

a

### 2. Advanced Information Display

**Q2.1**: You said "advanced information shouldn't require clicking anything to see." Should the Advanced section:

- (a) Simply be expanded by default (keep accordion, just start open), or
- (b) Be displayed inline without any accordion/collapse UI at all?

b

### 3. Fixing the Data Issues

**Q3.1**: For CRDT Update Count - should this show:

- (a) The number of individual CRDT updates (actual operations), which would require parsing the log files, or
- (b) Just remove this field entirely since it's misleading?

Why would this require reparsing. This very much seems like something the sum of the vector clocks would give you.

**Q3.2**: For Snapshot Count - similar question: is the current count (number of `.snapshot` files) correct, or is there a different metric you want?

current count of snapshot files

**Q3.3**: For Pack Count - since packs don't exist anymore, should we:

- (a) Remove the Pack Count row entirely, or
- (b) Keep it but mark it as "N/A (deprecated)" or similar?
  a

### 4. Window Size/Position

**Q4.1**: What size should the Note Info window be? (Current dialog is `maxWidth="md"` which is ~900px wide, height adjusts to content)

that sounds reasonable

**Q4.2**: Should window position/size be persisted like other windows?
yes

### 5. Keyboard Shortcut

**Q5.1**: The current shortcut Cmd+Shift+I should now open the Note Info window (not dialog). Should it:

- (a) Focus the existing Note Info window if open (and update its note), or
- (b) Always create a new window?
  b

### 6. Other

**Q6.1**: Should there be a way to open Note Info from the note context menu (right-click on note in sidebar) in addition to the menu bar?
ah that sounds great

**Q6.2**: Any other fields you want added or removed from the Note Info display?
Where we have the folder, have it be the full folder path, starting with the name of the SD it comes from.
