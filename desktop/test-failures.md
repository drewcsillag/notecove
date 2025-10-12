# Test Failure Analysis

**Date:** 2025-10-12 (Updated)
**Test Suite:** E2E Tests (Playwright)
**Initial Results:** 17 failed, 31 passed (48 total, 1 skipped)
**After Sample Notes Fix:** Testing in progress

## Progress Update

**Fixed Issues:**
1. ✅ Folder dialog timing issues (Commit d4ca655)
2. ✅ Duplicate event handler on "Create New Note" button (Commit 6b8bd37)
3. ✅ Sample notes being counted in test assertions (Commit 63633be)

## Summary

After fixing the folder dialog timing issues and duplicate event handler on the "Create New Note" button, the test suite still shows 17 failures. The failures fall into clear patterns indicating underlying issues with:

1. **Note duplication** - Notes are being created multiple times
2. **Title extraction** - First line title derivation not working in tests
3. **Note content switching** - Wrong note displayed when switching
4. **Tag duplication** - Tags appearing multiple times
5. **Reset functionality** - Reset button not properly clearing data

## Detailed Failure Analysis

### Category 1: Note Duplication Issues

**Pattern:** Tests expecting 3-4 notes are seeing 5-6 notes

**Failed Tests:**
- `basic.spec.js:67` - Search and filter (expected 3, got 5)
- `folders.spec.js:115` - Create notes in selected folder
- `folders.spec.js:166` - Make notes draggable
- `folders.spec.js:505` - Single-click note selection (strict mode: 2 elements with "First Note")
- `regression.spec.js:86` - Maintain consistent note count after edits
- `regression.spec.js:129` - Reset button (expected 1, got 3+)
- `tags.spec.js:34` - Extract tags from note content (expected 2 tags, got 6)
- `tags.spec.js:58` - Show tag counts (strict mode: duplicate tags)
- `tags.spec.js:80` - Filter notes by tag (expected 3, got 6)

**Root Cause Hypothesis:**
Even though the inline `onclick="createNewNote()"` was removed, notes are still being duplicated. Possible causes:
1. Sample notes being loaded multiple times
2. Event listeners being attached multiple times
3. Data persistence issues causing notes to accumulate across tests
4. beforeEach() not properly resetting state

**Evidence:**
- Screenshot from `folders.spec.js:505` shows "strict mode violation: 2 elements" for "First Note"
- Tag tests show 6 tag items when expecting 2
- Multiple tests show double the expected note count

### Category 2: Title Extraction Issues

**Pattern:** Note titles remain "Untitled" instead of deriving from first line

**Failed Tests:**
- `basic.spec.js:41` - Type in note and derive title (SKIPPED but related)
- `regression.spec.js:15` - No duplicate notes when typing (title is "Untitled", expected "This is a test note")

**Root Cause:**
Title extraction relies on a debounced update mechanism. In the test environment, the title update doesn't complete before assertions run. This works correctly in manual testing but fails in automated tests.

**Known Issue:** This is a pre-existing issue from Phase 2.

### Category 3: Note Content Switching Issues

**Pattern:** Wrong note content displayed when clicking different notes

**Failed Tests:**
- `regression.spec.js:40` - Switch note content (shows "Second Note Title" when expecting "First Note Title")

**Root Cause Hypothesis:**
The `renderCurrentNote()` function may not be properly switching content, or there's a timing issue where:
1. Click event fires
2. `currentNote` is updated
3. Editor content doesn't refresh properly
4. Test reads stale content

**Evidence from screenshot:** Editor shows "Second Note Title\nSecond note content" when first note was clicked.

### Category 4: Editor Feature Issues

**Pattern:** Editor features timing out or not working properly

**Failed Tests:**
- `editor-features.spec.js:72` - Image insertion (timeout finding file input)
- `editor-features.spec.js:137` - Column resizing (can't find resize handle)
- `editor-features.spec.js:178` - Toolbar button states (timeout on H1 button)
- `editor-features.spec.js:219` - Nested task lists (timeout on note item)
- `editor-features.spec.js:266` - Persist task states (missing checkbox)

**Root Cause Hypothesis:**
These tests may have timing issues or may be affected by the note duplication problems (e.g., can't find the right note because there are duplicates).

### Category 5: Reset Functionality

**Pattern:** Reset button doesn't properly clear all notes

**Failed Tests:**
- `regression.spec.js:129` - Reset should leave only sample notes (expected 1, got 3+)

**Root Cause Hypothesis:**
The reset functionality may not be properly:
1. Clearing localStorage
2. Resetting the notes array
3. Reloading sample data
4. Or sample data is being loaded multiple times

## Priority Investigation Order

### Priority 1: Note Duplication Root Cause ⚠️ CRITICAL

This is affecting the most tests (9+ failures). Need to investigate:

1. **Check sample data loading** - Are sample notes being added multiple times?
2. **Check event listener attachment** - Are listeners being duplicated?
3. **Check test beforeEach()** - Is state being properly reset between tests?
4. **Check data persistence** - Is localStorage being cleared properly?

**Files to investigate:**
- `/Users/drew/devel/nc/desktop/src/renderer.js` - Sample data initialization
- `/Users/drew/devel/nc/desktop/src/lib/noteManager.js` - Note creation logic
- `/Users/drew/devel/nc/desktop/tests/e2e/*.spec.js` - beforeEach() hooks

### Priority 2: Note Content Switching

Fix the issue where clicking different notes doesn't properly update the editor content.

**Files to investigate:**
- `/Users/drew/devel/nc/desktop/src/renderer.js:renderCurrentNote()` - Line ~244
- Click handler for `.note-item` elements

### Priority 3: Title Extraction

This is a known timing issue but affects several tests. May need to:
- Increase debounce wait in tests
- Add explicit waits for title updates
- Or skip these assertions in E2E tests and cover in unit tests

### Priority 4: Reset Functionality

Once note duplication is fixed, verify reset works properly.

### Priority 5: Editor Feature Timeouts

These may resolve once note duplication is fixed (tests can find the right elements).

## Next Steps

1. Investigate why notes are being duplicated (Priority 1)
2. Check if sample data is loaded multiple times
3. Check if event listeners are attached multiple times
4. Review test setup/teardown to ensure clean state
5. Fix root cause and re-run tests
6. Address remaining failures in priority order

## Files Modified So Far

- ✅ `/Users/drew/devel/nc/desktop/tests/e2e/folders.spec.js` - Fixed dialog timing (Commit d4ca655)
- ✅ `/Users/drew/devel/nc/desktop/index.html:968` - Removed duplicate onclick handler (Commit 6b8bd37)

## Test Environment

- Playwright with Chromium
- Tests run with `npm run test:e2e`
- HTML report available at http://localhost:9323
