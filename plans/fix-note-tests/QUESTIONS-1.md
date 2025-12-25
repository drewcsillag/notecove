# Questions - Fix Note Tests

## Analysis Summary

From the test log, there are 6 note-\* test failures. After running tests in isolation, I found:

### Tests that pass in isolation (were resource contention issues):

1. `note-context-menu.spec.ts:141` - "should have Delete option" - ✅ PASSES
2. `note-info-window.spec.ts:103` - "should open Note Info window from context menu" - ✅ PASSES
3. `note-info-window.spec.ts:173` - "Note Info window should display basic information" - (likely passes, same pattern)

### Tests that truly fail:

1. `note-count-badges.spec.ts:126` - "should show note count badge on user folders" - ❌ FAILS
   - Creates folder "Test Folder" but then can't find it in the folder tree

2. `note-info-window.spec.ts:239` - "should show full folder path with SD name" - ❌ FAILS
   - Creates folder "Test Folder" but then can't click on it (locator timeout)

3. `note-multi-select.spec.ts:334` - "should move multiple notes via context menu" - ❌ FAILS
   - Creates folder "Test Folder" but can't find it in move dialog radiogroup

### Root Cause Analysis

All 3 failing tests follow the same pattern:

1. Click "Create folder" button
2. Fill in "Test Folder" in dialog
3. Press Enter
4. Wait (500-1000ms)
5. Try to interact with "Test Folder" - **FAILS**

The folder creation might be:

- Not completing before the test continues
- Failing silently
- Creating the folder but not rendering it in the tree

## Questions

1. **Have folder creation tests worked previously?** I want to confirm this is a regression vs tests that were always flaky.

I don't know. I believe they did

2. **Should I investigate the actual folder creation mechanism?** I could add debug logging to understand if the folder is being created in the database/storage vs just not rendering in the UI.

yes. I want to get to the bottom so if these are flaky, to figure a way to make them not flaky
