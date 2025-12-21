# Fix Export All Notes & Help Menu Links

**Overall Progress:** `100%`

## Summary

1. Fix "Export All Notes to Markdown..." menu item which doesn't work
2. Update Help menu links and remove "Show Logs" option

## Root Cause Analysis

The Export All Notes bug is in `NotesListPanel.tsx` lines 792-852. When `exportTrigger === 'all'`:

- The code correctly fetches ALL notes from the SD
- **BUG**: `noteTitleLookup` is built from `notes` (the currently viewed folder's notes), not from `allNotesInSD`
- This means inter-note links fail to resolve, but more critically, if the viewed folder has no notes, `noteTitleLookup` is empty

The fix: Build `noteTitleLookup` from notes across ALL SDs so cross-SD links also resolve with proper titles.

## Tasks

### Phase 1: Fix Export All Notes Bug

- [x] 🟩 **Step 1: Write failing E2E test for File menu Export All Notes**
  - Added tests to `markdown-export.spec.ts` that trigger the menu item
  - Tests verify files are created when exporting via File menu

- [x] 🟩 **Step 2: Fix the noteTitleLookup bug in NotesListPanel.tsx**
  - For both 'all' and 'selected' export: fetch notes from ALL SDs to build complete `noteTitleLookup`
  - This ensures cross-SD links show proper note titles

- [x] 🟩 **Step 3: Verify E2E test passes**

### Phase 2: Add Unit Tests for Export Service

- [x] 🟩 **Step 4: Add unit tests for exportNotes function**
  - Test successful export of single note
  - Test handling of empty notes
  - Test multiple notes export
  - Test filename sanitization

- [x] 🟩 **Step 5: Add unit tests for exportAllNotes function**
  - Test export with folder structure
  - Test filtering of deleted notes
  - Test nested folder creation
  - Test handling of empty SD

### Phase 3: Update Help Menu

- [x] 🟩 **Step 6: Update Help menu links in menu.ts**
  - Changed Documentation URL to `https://github.com/drewcsillag/notecove/`
  - Changed Report Issue URL to `https://github.com/drewcsillag/notecove/issues/new`
  - Removed "Show Logs" menu item

### Phase 4: Validation

- [x] 🟩 **Step 7: Run CI to verify all tests pass**

## Files Modified

- `packages/desktop/src/renderer/src/components/NotesListPanel/NotesListPanel.tsx` - Fixed bug
- `packages/desktop/src/main/menu.ts` - Updated Help menu
- `packages/desktop/e2e/markdown-export.spec.ts` - Added E2E tests
- `packages/desktop/src/renderer/src/services/__tests__/export-service.test.ts` - Added unit tests
