# Folder Window Isolation and Orphan Cleanup - Implementation Plan

**Overall Progress:** `90%`

## Summary

Two bugs to fix:

1. **Window Isolation**: Folder selection in one window affects all windows (should be per-window)
2. **Orphaned Subfolders**: Deleting a parent folder leaves child folders orphaned in the database

## Root Causes

### Issue 1: Cross-Window Folder Pollution

- `NotesListPanel.tsx` polls `appState.get('selectedFolderId')` every 500ms (line 507-516)
- All windows share this global appState, so folder changes propagate across windows
- Additionally, `folder:emitSelected` broadcasts to all windows, clearing search everywhere

### Issue 2: Orphaned Subfolders

- `deleteFolder` only marks the target folder as `deleted: true`
- Child folders retain `deleted: false` with orphaned `parentId`
- `getActiveFolders()` returns these orphans since they're not marked deleted

---

## Tasks

### Phase 0: Diagnostics

- [x] 🟩 **0.1: Query existing orphaned folders**
  - [x] 🟩 Inspected Production profile database
  - [x] 🟩 Result: No current orphans found (11 folders, 2 deleted, no orphaned children)
  - [x] 🟩 Proceeding with code fixes to prevent future orphans

---

### Phase A: Window Isolation Fix

- [ ] 🟥 **A1: Add tests for window isolation behavior**
  - [ ] 🟥 Test that folder selection state is per-window
  - [ ] 🟥 Test that changing folder in one context doesn't affect another

- [x] 🟩 **A2: Establish callback-based folder selection (replaces polling)**
  - [x] 🟩 Lift `selectedFolderId` state to App.tsx (owns state for all panels)
  - [x] 🟩 LeftSidebar: Accept and pass `selectedFolderId`/`onFolderSelect` props
  - [x] 🟩 FolderPanel: Use controlled props instead of internal state
  - [x] 🟩 NotesListPanel: Receive `selectedFolderId` as prop
  - [x] 🟩 Remove the 500ms polling interval from NotesListPanel

- [x] 🟩 **A3: Scope events to current window**
  - [x] 🟩 Removed `folder:emitSelected` call from FolderPanel
  - [x] 🟩 Replaced `folder:onSelected` listener with local effect that clears search on folder change
  - [x] 🟩 In-window communication now uses React state/callbacks only

- [x] 🟩 **A4: Preserve persistence for app restart**
  - [x] 🟩 App.tsx loads `selectedFolderId` from appState on mount
  - [x] 🟩 App.tsx saves `selectedFolderId` to appState when it changes
  - [x] 🟩 Added `AppStateKey.SelectedFolderId` to shared schema
  - [ ] 🟥 Verify folder is restored correctly on window reopen (needs manual test)

---

### Phase B: Orphaned Subfolder Fix

- [ ] 🟥 **B1: Add tests for folder deletion with children**
  - [ ] 🟥 Test cascade delete (delete folder and all descendants)
  - [ ] 🟥 Test reparenting (children move to grandparent)
  - [ ] 🟥 Test notes are moved to parent folder on delete
  - [ ] 🟥 Test root folder edge case (children become roots, notes go to All Notes)

- [x] 🟩 **B2: Add `getDescendants()` to FolderTreeDoc**
  - [x] 🟩 Returns all descendant folders (children, grandchildren, etc.)
  - [x] 🟩 Used for cascade delete and note movement

- [x] 🟩 **B3: Implement cascade delete in folder-handlers**
  - [x] 🟩 Add `mode` parameter: `'cascade'` | `'reparent'` | `'simple'`
  - [x] 🟩 Cascade: Mark folder and all descendants as deleted
  - [x] 🟩 Move ALL notes from entire deleted subtree to the topmost deleted folder's parent

- [x] 🟩 **B4: Implement reparent delete in folder-handlers**
  - [x] 🟩 Mark only target folder as deleted
  - [x] 🟩 Move child folders to target's parent (update parentId)
  - [x] 🟩 Move notes from target folder to target's parent

- [x] 🟩 **B5: Add confirmation dialog for folders with children**
  - [x] 🟩 Added `folder:getChildInfo` IPC handler to detect children
  - [x] 🟩 Updated FolderTree.tsx delete dialog with two options:
    - "Delete folder and all subfolders" (cascade)
    - "Delete folder only, move subfolders to parent" (reparent)
  - [x] 🟩 Simple delete for folders without children

- [x] 🟩 **B6: Add ancestry filtering as safety net**
  - [x] 🟩 Added `hasDeletedAncestor()` helper to FolderTreeDoc
  - [x] 🟩 Added `getVisibleFolders()` that excludes folders with deleted ancestors
  - [x] 🟩 Updated `handleListFolders` and `handleListAllFolders` to use `getVisibleFolders()`
  - [x] 🟩 This hides existing orphans immediately

- [x] 🟩 **B7: Orphan cleanup decision**
  - Decided: Ancestry filtering only (Option D)
  - No actual cleanup - orphans stay in DB but are invisible in UI
  - This is safest for sync scenarios

---

### Phase C: Integration and Testing

- [ ] 🟥 **C1: Run full test suite and fix any failures**

- [ ] 🟥 **C2: Manual testing checklist**
  - [ ] 🟥 Open two windows, change folder in one, verify other is unaffected
  - [ ] 🟥 Create nested folders, delete parent with "cascade", verify all deleted
  - [ ] 🟥 Create nested folders, delete parent with "reparent", verify children moved
  - [ ] 🟥 Verify "Move to..." dialog no longer shows orphaned folders
  - [ ] 🟥 Verify notes are moved to parent when folder deleted
  - [ ] 🟥 Verify app restart restores last selected folder

---

## Key Files Modified

| File                 | Changes                                                           |
| -------------------- | ----------------------------------------------------------------- |
| `App.tsx`            | Added selectedFolderId state, persistence to/from appState        |
| `LeftSidebar.tsx`    | Accept and pass selectedFolderId/onFolderSelect props             |
| `FolderPanel.tsx`    | Changed to controlled component, removed internal state           |
| `NotesListPanel.tsx` | Accept selectedFolderId as prop, removed 500ms polling            |
| `folder-handlers.ts` | Added cascade/reparent delete modes, getChildInfo handler         |
| `folder-api.ts`      | Added getChildInfo method, updated delete with mode param         |
| `FolderTreeDoc.ts`   | Added getDescendants(), hasDeletedAncestor(), getVisibleFolders() |
| `FolderTree.tsx`     | Enhanced delete dialog with cascade/reparent options              |
| `electron.d.ts`      | Updated folder API types                                          |
| `browser-stub.ts`    | Added getChildInfo stub                                           |
| `web-client.ts`      | Added getChildInfo implementation                                 |
| `schema.ts`          | Added AppStateKey.SelectedFolderId                                |

## Related Documents

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial Q&A
- [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) - Plan review questions (pending answers)

## Notes

- Production SD for testing: `af7545b4-c309-4bc0-942e-bfef06130437`
- Both issues are now fixed, pending CI validation and manual testing
