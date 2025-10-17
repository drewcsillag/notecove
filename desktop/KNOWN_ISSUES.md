# Known Issues

## Note Link Feature Temporarily Disabled

**Status:** DISABLED as of 2025-10-16
**Reason:** The note link feature was causing catastrophic bugs that broke basic note functionality:
- Note titles being corrupted to single characters
- Note content being truncated to first character only
- CRDT sync breaking completely
- Multiple e2e tests failing

**Action Taken:**
- Note link extension disabled in `src/lib/editor.ts` (line 14, line 136-140)
- Note link callbacks disabled in `src/renderer.ts` (line 147-151)
- Files backed up to `.note-link-backup/`

**Investigation Needed:**
The attempted fix of including trailing space in the node's rendered HTML (`>>${displayTitle} `) broke CRDT serialization. Need to find a way to:
1. Prevent space consumption after link when user continues typing
2. Without breaking basic note persistence and CRDT sync

**User's Suggestion:** "Is there a way to have it so that when there's a space after, it's part of the link, but ignored for figuring out where it goes?"

---

## Critical: Note Link Space Consumption Bug (DISABLED)

**Status:** OPEN - Affects usability
**Affected Version:** v0.1.0
**Issue:** When typing `>>note_title for details` continuously, the space after the link is consumed, resulting in `>>note_titlefor details`.

### Symptoms
1. Typing `>>Target_Note for details` results in `>>Target_Notefor details` (no space between link and "for")
2. The link node itself is correct (`noteTitle: "Target_Note"`)
3. The separate space text node inserted after the link gets consumed when user continues typing
4. Does not affect link functionality, only affects spacing in editor

### Root Cause
When the InputRule completes its transaction and inserts `[node, state.schema.text(' ')]`, ProseMirror consumes the space text node when the user immediately continues typing. Cursor positioning and explicit selection setting do not prevent this.

### Workaround
Users should type a punctuation mark after the link before continuing: `>>Target_Note. For details`

### Impact
**MEDIUM** - Affects editor UX but does not corrupt data or break navigation

---

## ~~Critical: Note Link Mark Extension Bug~~ (RESOLVED)

**Status:** ✅ RESOLVED in v0.1.0
**Solution:** Converted from Mark-based to Node-based implementation
**Original Issue:** When creating a note link with `>>note_title` syntax and then continuing to type, the noteLink mark extends to include subsequent text, corrupting the link.

### Symptoms
1. Typing `>>Target_Note for details` results in the noteTitle being stored as "Target_Notefor" instead of "Target_Note"
2. Clicking the corrupted link tries to navigate to "Target_Notefor" which doesn't exist
3. All text after the link gets consumed by the mark, causing note content to disappear
4. Note titles get corrupted to a single character

### Reproduction
```
1. Create a note titled "Note_to_link"
2. Create another note
3. Type: "Quick Start\n\nLink to >>Note_to_link here"
4. Press space after ">>Note_to_link"
5. Continue typing "here"
6. The link will show ">>Note_to_linkhere" instead of ">>Note_to_link"
```

### Root Cause
ProseMirror marks are "inclusive" and extend to adjacent text by default. Despite setting `inclusive: false` and trying multiple approaches to clear stored marks (`removeStoredMark`, `setStoredMarks([])`, explicit selection positioning, pre-marked text nodes), the mark continues to extend when text is typed immediately after the input rule triggers.

### Attempted Fixes
1. ✗ Set `inclusive: false` on mark definition
2. ✗ Call `tr.removeStoredMark(this.type)` after adding mark
3. ✗ Call `tr.setStoredMarks([])` to clear all marks
4. ✗ Explicitly position selection after marked text
5. ✗ Create pre-marked text nodes with `schema.text(text, [mark])`
6. ✗ Use `tr.replaceRangeWith()` instead of delete+insert+mark
7. ✗ Insert unmarked space node separately

### Workaround
Users must type a punctuation mark (period, comma, etc.) or press Enter after completing a note link before continuing to type. This breaks the mark boundary.

**Example:**
```
Instead of: "See >>Target_Note for details"
Type: "See >>Target_Note. For details"
Or: "See >>Target_Note\nFor details"
```

### Investigation Needed
- Research TipTap/ProseMirror mark boundary handling
- Check if other TipTap extensions (like Link) have similar issues
- Consider using a Node instead of a Mark for note links
- Investigate using decorations instead of marks
- Look into TipTap's `extendMarkRange` option

### Impact
**HIGH** - This bug makes the note link feature essentially unusable for production. It corrupts note content and makes navigation unreliable.

### Priority
**P0** - Must fix before any release

---

## Resolution

**Date Resolved:** 2025-10-16

### Solution Implemented
Completely reimplemented note links as an **inline Node** instead of a Mark in TipTap/ProseMirror.

### Key Changes
1. Changed from `Mark.create()` to `Node.create()` with properties:
   - `inline: true` - allows node to flow with text
   - `atom: true` - prevents selection inside node
   - `group: 'inline'` - allows node anywhere inline content is permitted

2. Updated `parseHTML()` to extract attributes using `getAttrs` function

3. Modified `renderHTML()` to access attributes via `node.attrs` and return formatted text directly

4. Changed commands from `setMark()` to `insertContent()` for node insertion

5. Completely rewrote input rules to:
   - Delete matched text with `tr.delete(from, to)`
   - Create node with `this.type.create({ attrs })`
   - Insert node with `tr.insert(from, node)`
   - Insert trailing space with `tr.insertText(' ', from + 1)`

### Test Results
- **16/17 tests passing** (1 skipped for unimplemented rename feature)
- All 3 regression tests for corruption bugs pass
- All 5 bug verification tests pass
- All 8 core functionality tests pass

### Why This Works
Nodes have clear boundaries and do not extend to adjacent text like Marks do. This completely eliminates the mark extension problem that was causing corruption.
