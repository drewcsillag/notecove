# Folder Tree Ordering Feature Plan

**Overall Progress:** `90%` (Phase 0, 1, 2, 3 complete)

## Summary

Implement proper ordering in the folder tree sidebar:

1. "All Notes" always appears first within each SD
2. User folders sorted alphabetically (case-insensitive) by default
3. Drag-and-drop reordering of user folders (persists across restarts, syncs across devices)
4. "Recently Deleted" always appears last within each SD
5. SD headers can be reordered (per-device, stored in app state)

## Related Documents

- [Questions & Decisions](./QUESTIONS-FOLDER-ORDERING.md) - Ambiguities and answers
- [Debug Guide](./DEBUG-FOLDER-ORDERING.md) - Debug tools (created in Phase 0)

## Technical Approach

- Use `sort={false}` on the Tree component to disable automatic alphabetical sorting
- Pre-sort nodes before passing to Tree: special items pinned, user folders by `order` field
- Add `dropTargetOffset` and `placeholderRender` for visual reorder feedback
- Update `handleDrop` to detect reordering vs nesting operations
- Backend: add `folder:reorder` handler to update `order` fields
- Folder order stored in CRDT (syncs), SD order stored in app state (per-device)

## Risks

1. **CRDT conflicts:** Two devices reorder simultaneously → last-write-wins may cause unexpected order. Accepted risk - rare edge case, no data loss. See [Q10](./QUESTIONS-FOLDER-ORDERING.md#q10-crdt-conflict-handling-for-order-field).

2. **Existing data:** Current folders have creation-time order values. Decision: leave as-is until user manually reorders. See [Q6](./QUESTIONS-FOLDER-ORDERING.md#q6-existing-folder-migration).

---

## Tasks

### Phase 0: Quick Win - Fix "All Notes" First (Immediately Testable) ✅

Goal: Get "All Notes" appearing first with minimal changes. Testable in ~15 minutes.

- [x] 🟩 **0.1: Add custom sort function to Tree component**
  - [x] 🟩 Create `sortNodes()` comparator function
  - [x] 🟩 "All Notes" (and `all-notes:*`) sorts first
  - [x] 🟩 "Recently Deleted" (and `recently-deleted:*`) sorts last
  - [x] 🟩 User folders sort alphabetically (case-insensitive)
  - [x] 🟩 Pass `sort={sortNodes}` to Tree component

- [x] 🟩 **0.2: Manual testing checkpoint**
  - [x] 🟩 Verify "All Notes" appears first
  - [x] 🟩 Verify "Recently Deleted" appears last
  - [x] 🟩 Verify folders are alphabetical
  - [x] 🟩 Verify multi-SD mode works correctly

- [x] 🟩 **0.3: Add unit tests for sort function**
  - [x] 🟩 Test All Notes < any user folder
  - [x] 🟩 Test any user folder < Recently Deleted
  - [x] 🟩 Test alphabetical ordering (case-insensitive)

- [x] 🟩 **0.4: Create debug tooling**
  - [x] 🟩 Add console logging for sort comparisons (behind flag)
  - [x] 🟩 Create [DEBUG-FOLDER-ORDERING.md](./DEBUG-FOLDER-ORDERING.md)

**Checkpoint:** ✅ Can demo "All Notes first" fix. Ready for commit.

---

### Phase 1: Backend - Folder Reordering Support ✅

- [x] 🟩 **1.1: Add folder reorder tests (TDD)**
  - [x] 🟩 Test `reorderFolder()` updates order field in CRDT
  - [x] 🟩 Test reordering renumbers all siblings (0, 1, 2, ...)
  - [x] 🟩 Test `getActiveFolders()` returns sorted by order

- [x] 🟩 **1.2: Implement reorderFolder in FolderTreeDoc**
  - [x] 🟩 Add `reorderFolder(folderId: UUID, newIndex: number)` method
  - [x] 🟩 Add `getSiblings(folderId: UUID)` helper method
  - [x] 🟩 Get siblings, remove folder, insert at newIndex, renumber all

- [x] 🟩 **1.3: Update getActiveFolders to sort by order**
  - [x] 🟩 Sort folders by `order` field before returning
  - [x] 🟩 Secondary sort by name for stability

- [x] 🟩 **1.4: Add folder:reorder IPC handler**
  - [x] 🟩 Implement `handleReorderFolder(sdId, folderId, newIndex)`
  - [x] 🟩 Register in ipcMain
  - [x] 🟩 Add to preload API: `window.electronAPI.folder.reorder()`

- [x] 🟩 **1.5: Update folder creation for alphabetical insert**
  - [x] 🟩 Modify `handleCreateFolder` to find alphabetical position
  - [x] 🟩 Insert at that position, renumber siblings

**Checkpoint:** ✅ Backend supports reordering. Ready for commit.

---

### Phase 2: Frontend - Drag-and-Drop Reordering ✅

See [Q9](./QUESTIONS-FOLDER-ORDERING.md#q9-placeholder-visual-design) for placeholder design decision.

- [x] 🟩 **2.1: Update Tree component for manual ordering**
  - [x] 🟩 Change `sort={sortNodes}` to `sort={false}`
  - [x] 🟩 Pre-sort nodes in `buildTreeNodes()` / `buildMultiSDTreeNodes()`
  - [x] 🟩 Set `insertDroppableFirst={false}`
  - [x] 🟩 Set `dropTargetOffset={10}` (tuned from 5 to 10 for better UX)

- [x] 🟩 **2.2: Add placeholder rendering**
  - [x] 🟩 Implement `placeholderRender` prop
  - [x] 🟩 Style as horizontal line indicator (2px primary color)

- [x] 🟩 **2.3: Update handleDrop for reordering**
  - [x] 🟩 Detect reorder: same parent + relativeIndex provided
  - [x] 🟩 Call `folder.reorder()` for reorder operations
  - [x] 🟩 Existing logic for parent-change operations

- [x] 🟩 **2.4: Update canDrop for reorder constraints**
  - [x] 🟩 Block reordering "All Notes" and "Recently Deleted"
  - [x] 🟩 Block drops at index 0 (before All Notes)
  - [x] 🟩 Block drops at/after last index (after Recently Deleted)
  - [x] 🟩 Allow reordering user folders within same parent
  - [x] 🟩 Block cross-SD reordering (existing)

- [x] 🟩 **2.5: Add reorder tests**
  - [x] 🟩 Test order field sorting takes precedence over alphabetical
  - [x] 🟩 Test alphabetical fallback when order values equal
  - [x] 🟩 Test All Notes stays first with reordered folders
  - [x] 🟩 Test Recently Deleted stays last with reordered folders

**Checkpoint:** ✅ Full folder reordering works. Ready for commit.

---

### Phase 3: SD Header Reordering ✅

- [x] 🟩 **3.1: Add SD order to app state**
  - [x] 🟩 Use existing `appState.get/set` with key `sdOrder`
  - [x] 🟩 Store order as JSON array of SD IDs
  - [x] 🟩 No new IPC handlers needed (uses existing appState API)

- [x] 🟩 **3.2: Update SD list to respect order**
  - [x] 🟩 Load saved order from appState on mount
  - [x] 🟩 Add `sortSDsByOrder()` helper function
  - [x] 🟩 Sort SDs accordingly (new SDs append to end by creation time)

- [x] 🟩 **3.3: Enable SD header dragging**
  - [x] 🟩 Update `canDrag` to allow SD headers
  - [x] 🟩 Update `canDrop` to allow SD reordering at root level
  - [x] 🟩 Update `handleDrop` for SD reordering
  - [x] 🟩 Save new order to appState on drop
  - [x] 🟩 Add spacer nodes (sd-spacer-top/bottom) for drop targets with 2 SDs
  - [x] 🟩 Attach `handleRef` for @minoru/react-dnd-treeview drag-and-drop to work

- [x] 🟩 **3.4: Add SD reorder tests**
  - [x] 🟩 Test SD order loads from appState
  - [x] 🟩 Test fallback to creation order when no saved order
  - [x] 🟩 Test new SDs not in saved order are appended
  - [x] 🟩 E2E tests for spacer nodes rendering (drag-drop tests skipped - Playwright + react-dnd limitation)

**Checkpoint:** ✅ SD reordering works. Ready for commit.

**Note:** E2E tests for drag-drop are skipped due to Playwright's inability to properly simulate react-dnd events. The drag-drop functionality has been manually verified and unit tests cover the handleDrop logic.

---

### Phase 4: Integration & Polish

- [ ] 🟥 **4.1: End-to-end testing**
  - [ ] 🟥 Test folder reorder persists after app restart
  - [ ] 🟥 Test folder reorder syncs to other instance
  - [ ] 🟥 Test new folder appears in alphabetical position

- [ ] 🟥 **4.2: Edge cases**
  - [ ] 🟥 Empty folder list
  - [ ] 🟥 Single folder (no reorder needed)
  - [ ] 🟥 Folders with same name (stable sort by ID)

- [ ] 🟥 **4.3: Run full CI suite**
  - [ ] 🟥 All existing tests pass
  - [ ] 🟥 New tests pass

- [ ] 🟥 **4.4: Clean up debug tooling**
  - [ ] 🟥 Remove/disable verbose logging
  - [ ] 🟥 Keep useful diagnostics

---

## Files to Modify

### Phase 0

- `packages/desktop/src/renderer/src/components/FolderPanel/FolderTree.tsx`

### Phase 1

- `packages/shared/src/crdt/folder-tree-doc.ts` - Add `reorderFolder()`
- `packages/desktop/src/main/ipc/handlers.ts` - Add `folder:reorder` handler
- `packages/desktop/src/preload/index.ts` - Expose `folder.reorder()`

### Phase 2

- `packages/desktop/src/renderer/src/components/FolderPanel/FolderTree.tsx`

### Phase 3

- `packages/desktop/src/main/ipc/handlers.ts` - SD order handlers
- `packages/desktop/src/preload/index.ts` - SD order API

---

## Out of Scope

- Folder name editing inline (existing context menu rename is sufficient)
- Undo/redo for reordering
- Keyboard-based reordering (arrow keys to move)
- Fractional indexing for CRDT conflict reduction (accepted risk)
