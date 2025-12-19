# Feature Implementation Plan: Unpin on Delete & Empty Trash

**Overall Progress:** `90%`

## Summary

Two features:

1. **Auto-unpin on delete**: When a note is soft-deleted (moved to Recently Deleted), automatically unpin it
2. **Empty Trash**: Add context menu option on Recently Deleted folder to permanently delete all notes in trash

## Related Documents

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Requirements clarification
- [PLAN-CRITIQUE.md](./PLAN-CRITIQUE.md) - Staff engineer review

## Requirements (from QUESTIONS-1.md)

- Unpin happens on soft delete (not permanent delete)
- Restored notes stay unpinned (no state restoration)
- Menu text: "Empty Trash"
- Confirmation dialog: "Empty Trash?" / "Permanently delete {count} note(s)? This action cannot be undone."
- Multi-SD: Only delete notes from that specific SD's trash
- Show disabled "Empty Trash" when trash is empty
- No keyboard shortcut

---

## Tasks

### Feature 1: Auto-unpin on Delete

- [x] 🟩 **Step 1.1: Write failing test for auto-unpin on delete**
  - Add test in `note-handlers.test.ts` that creates a pinned note, deletes it, and verifies `pinned: false` is in the upsert call
  - File: `packages/desktop/src/main/ipc/__tests__/handlers/note-handlers.test.ts`

- [x] 🟩 **Step 1.2: Implement auto-unpin in handleDeleteNote**
  - File: `packages/desktop/src/main/ipc/handlers/note-handlers.ts` AND `handlers.ts` (legacy)
  - In `handleDeleteNote()`, add `pinned: false` to the upsert call
  - Also update the CRDT metadata to set `pinned: false`

- [x] 🟩 **Step 1.3: Verify test passes**

### Feature 2: Empty Trash Context Menu

- [x] 🟩 **Step 2.1: Add IPC handler for empty trash**
  - Added `note:emptyTrash` handler in `note-handlers.ts` and `handlers.ts`
  - Takes `sdId` parameter
  - Gets all deleted notes for that SD, calls `permanentlyDeleteNote()` for each
  - Returns count of deleted notes
  - Added to `unregisterNoteHandlers()` cleanup

- [x] 🟩 **Step 2.2: Write tests for empty trash handler**
  - Test: Empty trash with multiple deleted notes
  - Test: Empty trash when already empty (returns 0)
  - Test: Continue deleting if one note fails

- [x] 🟩 **Step 2.3: Add preload/renderer API for empty trash**
  - Added `emptyTrash(sdId: string): Promise<number>` to `note-api.ts`
  - Added type to `electron.d.ts`
  - Added browser stub in `browser-stub.ts`
  - Added web client stub in `web-client.ts` (desktop-only feature, use `browserNotAvailable`)

- [x] 🟩 **Step 2.4: Enable context menu on Recently Deleted folder**
  - Modified `handleContextMenu` to handle `recently-deleted` folders specially
  - Added separate state for trash context menu

- [x] 🟩 **Step 2.5: Implement Empty Trash context menu UI**
  - Added `trashContextMenu` state with `anchorEl`, `sdId`
  - Added `emptyTrashDialog` state for confirmation
  - Render separate Menu component with "Empty Trash" item
  - Disabled if count is 0, shows count in parentheses
  - Confirmation dialog: "Empty Trash?" with note count

- [x] 🟩 **Step 2.6: Handle UI updates after empty trash**
  - Already handled via `note:permanentDeleted` events broadcast for each note

### Final Validation

- [x] 🟩 **Step 3.1: Run full test suite**
  - All CI checks passed
  - Also fixed unrelated test failure (added `getXmlFragment` to mock for moveToSD tests)
- [ ] 🟥 **Step 3.2: Manual testing**
  - Test pinned note deletion unpins it
  - Test Empty Trash in single-SD mode
  - Test Empty Trash in multi-SD mode (only deletes from selected SD)
  - Test Empty Trash when trash is empty (disabled)
  - Test confirmation dialog shows correct count

---

## Key Files

| File                                                                      | Changes                                           |
| ------------------------------------------------------------------------- | ------------------------------------------------- |
| `packages/desktop/src/main/ipc/handlers/note-handlers.ts`                 | Add unpin logic in delete, add emptyTrash handler |
| `packages/desktop/src/main/ipc/__tests__/handlers/note-handlers.test.ts`  | Add tests for unpin and emptyTrash                |
| `packages/desktop/src/preload/api/note-api.ts`                            | Add emptyTrash                                    |
| `packages/desktop/src/renderer/src/types/electron.d.ts`                   | Add emptyTrash type                               |
| `packages/desktop/src/renderer/src/api/browser-stub.ts`                   | Add emptyTrash stub                               |
| `packages/desktop/src/renderer/src/api/web-client.ts`                     | Add emptyTrash stub (browserNotAvailable)         |
| `packages/desktop/src/renderer/src/components/FolderPanel/FolderTree.tsx` | Add trash context menu                            |

---

## Analysis Notes

### Existing Infrastructure

- `getDeletedNoteCount(sdId)` already exists in preload API
- `permanentlyDeleteNote()` already exists and handles all cleanup (CRDT unload, file deletion, database, broadcasts)
- `note:permanentDeleted` event already broadcast - UI already listens for this

### Integration Points

- Delete handler: `handleDeleteNote()` at line 318-350 in `note-handlers.ts`
- Context menu check: line 679 in `FolderTree.tsx` - currently returns early for `recently-deleted`
- Test patterns: Tests use `createMockNoteDoc()` and mock database methods

### Risk Assessment

- **Low risk**: Auto-unpin is a simple addition to existing flow
- **Medium risk**: Empty trash permanently deletes multiple notes - confirmation dialog is critical
- **Mitigation**: Only enabled when trash has notes, requires explicit confirmation
