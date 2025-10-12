# Debugging Notes - Note Switching Issue

## Current Problem
**Test failing**: `regression.spec.js:42` - "should switch note content when clicking different notes"

**Symptom**: When clicking on a different note in the sidebar, the editor content doesn't switch. It continues showing the previously selected note's content.

**Test expectation**:
- Create "First Note Title" → Create "Second Note Title" → Click "First Note Title"
- Expected: Editor shows "First Note Title\nFirst note content"
- Actual: Editor shows "Second Note TitleSecond note content"

## What We Know
1. ✅ Event listeners are set up correctly (using `querySelectorAll` with individual listeners per note)
2. ✅ The click is likely being registered (based on setup)
3. ✅ `selectNote()` is being called (presumed based on correct listener setup)
4. ❌ But `editor.setContent()` is either not being called OR not taking effect

## Root Cause Hypothesis
The `isEditing` flag prevents `renderCurrentNote()` from being called in `updateUI()`:

```javascript
// In updateUI():
if (this.currentNote) {
  welcomeState.style.display = 'none';
  editorState.style.display = 'flex';
  // Only render current note if not actively editing (to avoid scroll issues)
  if (!this.isEditing) {  // ← This is the problem!
    this.renderCurrentNote();
  }
}
```

When the user is typing and clicks on another note:
- `isEditing` is still `true` (editor still has focus initially)
- Click triggers `selectNote()` which sets `isEditing = false`
- But there might be a race condition with the blur event
- Or the debounced update from `handleEditorUpdate()` is interfering

## Attempted Fixes
1. ✅ Replaced event delegation with direct listeners (`querySelectorAll`)
2. ✅ Reverted `updateUI()` to original logic (calls `renderCurrentNote()` when `!isEditing`)
3. ✅ Added `isEditing = false` in `selectNote()` to force the flag reset
4. ❌ Still failing

## Investigation Needed
1. **Add comprehensive logging** to track execution flow:
   - Log when `selectNote()` is called with which noteId
   - Log when `renderCurrentNote()` is called with which note
   - Log when `editor.setContent()` is actually called
   - Log the `isEditing` flag value at each step

2. **Check `saveCurrentNote()`** - it's called at the start of `selectNote()`:
   - Does it somehow interfere with the note switch?
   - Does it trigger another update cycle?

3. **Check debounced updates** in `editor.js`:
   ```javascript
   this.debouncedUpdate = debounce((editor, noteId) => {
     // Only trigger update if we're still on the same note
     if (noteId === this.currentNoteId) {
       this.options.onUpdate(editor);
     }
   }, 1000);
   ```
   - Is there a race where the debounce fires AFTER we switch notes?
   - Could it be overwriting the newly selected note's content?

4. **Check `isSettingContent` flag** - used to prevent update handlers:
   ```javascript
   // In renderCurrentNote():
   this.isSettingContent = true;
   this.editor.setContent(this.currentNote.content || '', this.currentNote.id);
   this.isSettingContent = false;
   ```
   - Is this flag somehow preventing the content from being set?

## Code Locations
- `selectNote()`: src/renderer.js:660-668
- `updateUI()`: src/renderer.js:234-261
- `renderCurrentNote()`: src/renderer.js:406-434
- `handleEditorUpdate()`: src/renderer.js:171-202
- Editor `setContent()`: src/lib/editor.js:138-147
- Debounced update: src/lib/editor.js:104-110

## Test Location
- File: tests/e2e/regression.spec.js:42-86
- Playwright test that creates two notes and clicks between them

## Related Commits
- `9279d2e` - Fixed title extraction and sidebar updates (36 passing tests)
- `14e5b8d` - Current debugging attempt (still failing)

## Next Steps
Option A: Continue debugging this specific test with comprehensive logging
Option B: Move to other failing tests, come back to this later
Option C: Check if the app actually works correctly (manual testing) vs if the test is wrong
