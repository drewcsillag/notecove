# Fix Folder Delete Reparent

**Overall Progress:** `100%`

## Summary

When deleting a folder, notes should be moved to the parent folder. The bug was:

- UI used `'simple'` mode for folders without children, which didn't move notes
- Even `'cascade'`/`'reparent'` modes only updated database, not CRDT
- No `note:moved` events were broadcast

## Decisions (from QUESTIONS-1.md)

1. Use `'reparent'` mode for folders without children (Option B)
2. Fix CRDT synchronization - update note metadata in CRDT
3. Broadcast `note:moved` events when moving notes

## Tasks

- [x] 🟩 **Step 1: Write failing tests**
  - [x] 🟩 Test that CRDT metadata is updated when notes are moved during folder deletion
  - [x] 🟩 Test that `note:moved` events are broadcast for each moved note
  - [x] 🟩 Test that notes are loaded if not already in memory

- [x] 🟩 **Step 2: Fix UI to use 'reparent' mode**
  - [x] 🟩 Changed FolderTree.tsx line 1948 from `'simple'` to `'reparent'`

- [x] 🟩 **Step 3: Fix CRDT synchronization in folder-handlers.ts**
  - [x] 🟩 Added `moveNoteToFolder` helper function
  - [x] 🟩 Updated cascade mode to use helper (updates CRDT + broadcasts)
  - [x] 🟩 Updated reparent mode to use helper (updates CRDT + broadcasts)

- [x] 🟩 **Step 4: Verify tests pass**
  - [x] 🟩 All 31 folder handler tests pass

## Files Modified

1. `packages/desktop/src/renderer/src/components/FolderPanel/FolderTree.tsx` - Changed delete mode from 'simple' to 'reparent'
2. `packages/desktop/src/main/ipc/handlers/folder-handlers.ts` - Added moveNoteToFolder helper with CRDT updates and broadcasts
3. `packages/desktop/src/main/ipc/__tests__/handlers/folder-handlers.test.ts` - Added 5 new tests for reparent/cascade modes
4. `packages/desktop/src/main/ipc/__tests__/handlers/test-utils.ts` - Added getDescendants to mock interface

## Implementation Details

The fix added a `moveNoteToFolder` helper function that:

1. Loads note CRDT if not already in memory
2. Updates note metadata via `noteDoc.updateMetadata({ folderId, modified })`
3. Updates database via `database.upsertNote`
4. Broadcasts `note:moved` event

This helper is now used in both `cascade` and `reparent` modes, ensuring consistent behavior with explicit note moves.
