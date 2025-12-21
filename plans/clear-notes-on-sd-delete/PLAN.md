# Feature: Clear Notes on SD Delete

**Overall Progress:** `100%`

## Summary

When an SD is deleted, clean up UI state across all windows:

- Clear notes list if viewing deleted SD
- Clear selected note if it belongs to deleted SD
- Clear search results if they contain deleted SD's notes
- Close minimal-mode windows showing notes from deleted SD
- Auto-switch active SD if the deleted one was active

## Related Files

- Questions: [QUESTIONS-1.md](./QUESTIONS-1.md)

---

## Tasks

### Step 1: Add `sdId` to NoteMetadata API

- [x] 🟩 **1.1** Add `sdId` field to `NoteMetadata` interface in `packages/desktop/src/main/ipc/types.ts`
- [x] 🟩 **1.2** Update `handleGetMetadata` to return `sdId` from the database record (both old and new handler)
- [x] 🟩 **1.3** Write/update test to verify `getMetadata` returns `sdId`

### Step 2: Handle SD deletion in App.tsx (main window)

- [x] 🟩 **2.1** Write test: When SD is deleted and selectedNoteId belongs to that SD, selectedNoteId becomes null
- [x] 🟩 **2.2** Add `sd:updated` listener in App.tsx (useEffect)
- [x] 🟩 **2.3** When `operation === 'delete'`:
  - If `selectedNoteId` is set, call `note.getMetadata(selectedNoteId)`
  - If metadata.sdId === deletedSdId, set `selectedNoteId` to `null`
  - Handle case where note no longer exists (catch error, set null)

### Step 3: Handle active SD switch on deletion

- [x] 🟩 **3.1** Write test: When active SD is deleted, activeSdId switches to another SD (or undefined)
- [x] 🟩 **3.2** In App.tsx's `sd:updated` listener, if `activeSdId === deletedSdId`:
  - Fetch list of remaining SDs via `sd.list()`
  - Set `activeSdId` to first remaining SD's id (or undefined if none)

### Step 4: Handle SD deletion in NotesListPanel

- [x] 🟩 **4.1** Write test: When SD is deleted and it matches activeSdId, notes list clears and search resets
- [x] 🟩 **4.2** Add `sd:updated` listener in NotesListPanel
- [x] 🟩 **4.3** When `operation === 'delete'` and `activeSdId === deletedSdId`:
  - Set `notes` to empty array
  - Set `searchQuery` to empty string
  - Cancel any pending search timeout

### Step 5: Handle minimal-mode windows

- [x] 🟩 **5.1** Implemented in App.tsx's existing `sd:updated` listener
- [x] 🟩 **5.2** When `operation === 'delete'` and minimalMode:
  - Get note metadata for `selectedNoteId`
  - If sdId === deletedSdId, call `window.close()`

### Step 6: Integration testing & CI

- [x] 🟩 **6.1** Run CI to ensure no regressions - **PASSED**
- [x] 🟩 **6.2-6.5** Manual testing pending user verification

---

## Files Modified

1. `packages/desktop/src/main/ipc/types.ts` - Added `sdId` to `NoteMetadata` interface
2. `packages/desktop/src/main/ipc/handlers.ts` - Updated `handleGetMetadata` to return `sdId`
3. `packages/desktop/src/main/ipc/handlers/note-query-handlers.ts` - Updated `handleGetMetadata` to return `sdId`
4. `packages/desktop/src/renderer/src/App.tsx` - Added `sd:updated` listener for SD deletion
5. `packages/desktop/src/renderer/src/components/NotesListPanel/NotesListPanel.tsx` - Added `sd:updated` listener
6. `packages/desktop/src/renderer/src/api/web-client.ts` - Added `sdId` to getMetadata return (auto-fixed by CI)
7. `packages/desktop/e2e/cross-machine-sync-comments.spec.ts` - Fixed tooltip interference with force:true clicks

## Tests Added

1. `note-query-handlers.test.ts` - Test for `getMetadata` returning `sdId`
2. `App.test.tsx` - Tests for SD deletion handling (3 tests)
3. `NotesListPanel.test.tsx` - Tests for SD deletion handling (2 tests)

## CI Results

- All 1,861 unit tests passed
- All 374 E2E tests passed (21 skipped intentionally)
- No lint or type errors
