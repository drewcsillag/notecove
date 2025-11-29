# Folder Tree Ordering Feature Plan

**Overall Progress:** `20%` (Phase 0 complete)

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

### Phase 1: Backend - Folder Reordering Support

- [ ] 🟥 **1.1: Add folder reorder tests (TDD)**
  - [ ] 🟥 Test `reorderFolder()` updates order field in CRDT
  - [ ] 🟥 Test reordering renumbers all siblings (0, 1, 2, ...)
  - [ ] 🟥 Test `getActiveFolders()` returns sorted by order

- [ ] 🟥 **1.2: Implement reorderFolder in FolderTreeDoc**
  - [ ] 🟥 Add `reorderFolder(folderId: UUID, newIndex: number)` method
  - [ ] 🟥 Get siblings, remove folder, insert at newIndex, renumber all

- [ ] 🟥 **1.3: Update getActiveFolders to sort by order**
  - [ ] 🟥 Sort folders by `order` field before returning
  - [ ] 🟥 Secondary sort by name for stability

- [ ] 🟥 **1.4: Add folder:reorder IPC handler**
  - [ ] 🟥 Implement `handleReorderFolder(sdId, folderId, newIndex)`
  - [ ] 🟥 Register in ipcMain
  - [ ] 🟥 Add to preload API: `window.electronAPI.folder.reorder()`

- [ ] 🟥 **1.5: Update folder creation for alphabetical insert**
  - [ ] 🟥 Modify `handleCreateFolder` to find alphabetical position
  - [ ] 🟥 Insert at that position, renumber siblings
  - [ ] 🟥 Add test for alphabetical insertion

**Checkpoint:** Backend supports reordering. Can test via console. Commit point.

---

### Phase 2: Frontend - Drag-and-Drop Reordering

See [Q9](./QUESTIONS-FOLDER-ORDERING.md#q9-placeholder-visual-design) for placeholder design decision.

- [ ] 🟥 **2.1: Update Tree component for manual ordering**
  - [ ] 🟥 Change `sort={sortNodes}` to `sort={false}`
  - [ ] 🟥 Pre-sort nodes in `buildTreeNodes()` / `buildMultiSDTreeNodes()`
  - [ ] 🟥 Set `insertDroppableFirst={false}`
  - [ ] 🟥 Set `dropTargetOffset={5}` (tune as needed)

- [ ] 🟥 **2.2: Add placeholder rendering**
  - [ ] 🟥 Implement `placeholderRender` prop
  - [ ] 🟥 Style as horizontal line indicator

- [ ] 🟥 **2.3: Update handleDrop for reordering**
  - [ ] 🟥 Detect reorder: same parent + relativeIndex provided
  - [ ] 🟥 Call `folder.reorder()` for reorder operations
  - [ ] 🟥 Existing logic for parent-change operations

- [ ] 🟥 **2.4: Update canDrop for reorder constraints**
  - [ ] 🟥 Block reordering "All Notes" and "Recently Deleted"
  - [ ] 🟥 Allow reordering user folders within same parent
  - [ ] 🟥 Block cross-SD reordering (existing)

- [ ] 🟥 **2.5: Add reorder tests**
  - [ ] 🟥 Test drag folder A above folder B calls reorder
  - [ ] 🟥 Test special items cannot be reordered
  - [ ] 🟥 Test tree updates immediately after reorder

**Checkpoint:** Full folder reordering works. Commit point.

---

### Phase 3: SD Header Reordering (Can Defer)

Lower priority - can be done later if needed.

- [ ] 🟥 **3.1: Add SD order to app state**
  - [ ] 🟥 Add `sdOrder: string[]` to app state type
  - [ ] 🟥 Implement `sd:getOrder` / `sd:setOrder` IPC handlers
  - [ ] 🟥 Add to preload API

- [ ] 🟥 **3.2: Update SD list to respect order**
  - [ ] 🟥 Read order from app state
  - [ ] 🟥 Sort SDs accordingly (new SDs append to end)

- [ ] 🟥 **3.3: Enable SD header dragging**
  - [ ] 🟥 Update `canDrag` to allow SD headers
  - [ ] 🟥 Update `handleDrop` for SD reordering
  - [ ] 🟥 Call `sd:setOrder` on drop

- [ ] 🟥 **3.4: Add SD reorder tests**
  - [ ] 🟥 Test SD order persists in app state
  - [ ] 🟥 Test SD order survives app restart

**Checkpoint:** SD reordering works. Commit point.

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
