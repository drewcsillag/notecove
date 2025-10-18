# Folder Deletion Sync Issue - Investigation & Proposed Fix

## Problem

Folder deletion works correctly for:
- ✅ App restart persistence (folder stays deleted after closing and reopening)

But fails for:
- ❌ Multi-instance sync (folder reappears in other instances when deleted)

## Root Cause

The issue is in `src/lib/folder-manager.ts` saveFolders() method (lines 202-214):

```typescript
foldersDoc.transact(() => {
  const yMap = foldersDoc.getMap('folders');

  // Clear existing folders
  yMap.clear();  // ← PROBLEM: This might not sync correctly across instances

  // Add all custom folders
  customFolders.forEach(folder => {
    const { id, ...folderData } = folder;
    yMap.set(id, folderData);
  });
});
```

When instance 1 deletes a folder:
1. It calls `saveFolders()` which does `yMap.clear()` then `yMap.set()` for remaining folders
2. This creates a CRDT update that instance 2 receives
3. Instance 2 applies the update via `syncFolders()` → `loadCustomFolders()`
4. However, the CRDT merge might not properly handle the `clear()` operation

The persistence case works because:
- On app restart, `loadCustomFolders()` clears the local Map (line 173) BEFORE loading from CRDT
- So the local state is reset, and only existing folders are loaded from CRDT

The multi-instance sync case fails because:
- Instance 2 is already running with the folder in its Map
- When it receives the CRDT update with `clear()`, the merge behavior might keep both instances' folders

## Proposed Fix

Instead of using `yMap.clear()`, use individual `yMap.delete(id)` calls for folders that no longer exist:

```typescript
foldersDoc.transact(() => {
  const yMap = foldersDoc.getMap('folders');

  // Get current folder IDs in CRDT
  const existingIds = Array.from(yMap.keys());

  // Get new folder IDs
  const newIds = new Set(customFolders.map(f => f.id));

  // Delete folders that no longer exist (individually, for proper CRDT sync)
  existingIds.forEach(id => {
    if (!newIds.has(id)) {
      yMap.delete(id);
    }
  });

  // Add or update all custom folders
  customFolders.forEach(folder => {
    const { id, ...folderData } = folder;
    yMap.set(id, folderData);
  });
});
```

This ensures that:
- Each folder deletion is an explicit `delete` operation in the CRDT
- CRDT merging will properly propagate deletions across instances
- Both persistence and multi-instance sync will work correctly

## Testing Status

Due to Playwright/Electron timeout issues, I couldn't verify this fix yet. The tests to check are:

1. `tests/e2e-electron/folders-electron.spec.js:581` - "should sync folder deletion between instances"
2. All other folder sync tests should still pass

## Next Steps

1. Apply the proposed fix to `src/lib/folder-manager.ts`
2. Rebuild: `npm run build:main && npm run build:renderer`
3. Run folder tests: `timeout 300 npx playwright test tests/e2e-electron/folders-electron.spec.js --reporter=line --workers=1`
4. Verify that folder deletion now syncs between instances
5. Run full E2E suite to ensure no regressions
