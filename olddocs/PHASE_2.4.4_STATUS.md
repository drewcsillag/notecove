# Phase 2.4.4: Drag-and-Drop Status

## Summary

Successfully implemented `@minoru/react-dnd-treeview` to replace custom drag-and-drop implementation.

## Test Results

**Core Functionality: 9/9 E2E tests passing (100%)** ✅
**New Cosmetic Tests: 2/3 failing as expected (demonstrating bugs)** ✘

### Passing Tests (folder-bugs.spec.ts):

1. ✓ Right-click rename renames correct folder
2. ✓ Drag-and-drop moves only dragged folder (not parent)
3. ✓ Drag-and-drop works for multiple operations
4. ✓ Folders persist after app restart (create)
5. ✓ Folders persist after app restart (rename)
6. ✓ Folder creation syncs across windows
7. ✓ Folder rename syncs across windows
8. ✓ Folder move syncs across windows
9. ✓ Folder changes sync across separate Electron instances

### New Tests for Cosmetic Bugs (Written Before Fixes):

10. ✘ Expand/collapse all button doesn't work (TEST CORRECTLY FAILING - Bug confirmed)
11. ✘ Childless folders show expand icon (TEST CORRECTLY FAILING - Bug confirmed)
12. ✓ Drag shadow shows multiple items (Visual test - screenshots generated for verification)

## Implementation Details

### Packages Installed

- `@minoru/react-dnd-treeview@^3.5.3` - Tree view with drag-and-drop
- `react-dnd@^16.0.1` - Drag and drop for React
- `react-dnd-html5-backend@^16.0.1` - HTML5 backend for react-dnd

### Key Files Modified

1. `src/renderer/src/components/FolderPanel/FolderTree.tsx` - Complete rewrite using react-dnd-treeview
2. `e2e/folder-bugs.spec.ts` - Updated selectors from `role=treeitem` to `role=button`

### Architecture Changes

- Replaced MUI RichTreeView with @minoru/react-dnd-treeview Tree component
- Uses ListItemButton for each tree node instead of TreeItem
- Drag-and-drop handled by react-dnd (no manual event handling)
- Tree structure uses NodeModel format with parent/child relationships

### Cosmetic Features Implemented

✅ Bullets removed (CSS: `listStyleType: 'none'` on ul/li)
✅ Tree starts fully expanded (`initialOpen={allFolderIds}`)
✅ Root folders (Personal, Work) at same level as All Notes/Recently Deleted
✅ Drop target highlighting (background color + border during drag)
✅ "All Notes" doesn't show expand/collapse button (uses `noExpand` flag)
✅ "All Notes" is droppable (allows moving folders to root level, like Apple Notes)
✅ Expand All / Collapse All button at top (UnfoldMore/UnfoldLess icons)

## Outstanding Issues with E2E Tests ✅

### Issue 1: Expand/Collapse All Doesn't Work

**Bug**: Clicking expand/collapse all button only changes folder icons (solid ↔ hollow) but doesn't actually expand/collapse the tree nodes.

**Root Cause**: State management issue - `expandedFolderIds` updates but tree doesn't respond to changes.

**E2E Test**: ✘ folder-bugs.spec.ts:694 - Test correctly fails, demonstrating the bug

### Issue 2: Childless Folders Show Expand Icon

**Bug**: Folders without children show expand/collapse chevron (> or v)

**Fix**: Need to check if folder has children before rendering expand/collapse button.

**E2E Test**: ✘ folder-bugs.spec.ts:730 - Test correctly fails, demonstrating the bug

### Issue 3: Drag Shadow Shows Multiple Items

**Bug**: When dragging a folder, the drag preview shows unrelated folders (sometimes "All Notes" above it, child folders, or entire tree).

**Root Cause**: react-dnd-treeview's default drag preview includes DOM elements from tree structure.

**Fix**: Need to implement custom drag preview using `dragPreviewRender` prop.

**E2E Test**: ✓ folder-bugs.spec.ts:771 - Visual test with screenshots at /tmp/during-drag.png

## Storage Locations

### CRDT Files (Folder/Note Data)

**Dev mode**: `~/Library/Application Support/Electron/storage`
**Test mode**: Same location (cleaned between tests in beforeEach) OR configurable via `TEST_STORAGE_DIR` env var
**Configuration**: Set via `TEST_STORAGE_DIR` environment variable (see src/main/index.ts:177)

### App State (UI State)

**Current**: In-memory only (not persistent across restarts)
**Location**: src/main/storage/app-state.ts - using Map<string, string>
**Future**: Will be moved to SQLite database (planned in future phase)
**Note**: UI state like expanded folders is lost on app restart

### User Data Directory

**Dev mode**: `~/Library/Application Support/Electron`
**Custom**: Can be changed with `--user-data-dir` flag or `ELECTRON_USER_DATA_DIR` env var
**Multiple instances**: Use different user data dirs to run independent app instances

## Key Implementation Notes

### buildTreeNodes Function

```typescript
// Root folders have parent: 0 (top level)
// Child folders have parent: folderId
// Special items (All Notes, Recently Deleted) have parent: 0
```

### Drag-and-Drop Logic

```typescript
// Dropping on "All Notes" or root (0) → parentId = null (root level)
// Dropping on folder → parentId = folderId
// "Recently Deleted" is not droppable
```

### Tree Expansion

```typescript
// allFolderIds: All user folder IDs (for initial expansion)
// expandedFolderIds: Currently expanded folders (prop from parent)
// initialOpen: Pass to Tree component for initial state
```

## Next Steps

1. Write E2E tests for the 3 outstanding issues
2. Fix expand/collapse all functionality
3. Hide expand icon for childless folders
4. Implement custom drag preview

## Context Notes for Future Sessions

- Event bubbling issues are SOLVED by react-dnd-treeview
- Tests use `beforeEach` (not `beforeAll`) for proper isolation
- Cross-instance sync works perfectly via file watching
- Library is actively maintained (604 stars, MIT license)
