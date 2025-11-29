# Debug Guide: Folder Tree Ordering

This document provides debugging tools and techniques for the folder tree ordering feature.

## Console Logging

### Enable Sort Debug Logging

The `sortNodes` function can be instrumented with debug logging. To enable:

1. In `FolderTree.tsx`, add this at the top of `sortNodes()`:

```typescript
const DEBUG_SORT = false; // Set to true to enable logging

if (DEBUG_SORT) {
  console.log('[sortNodes]', {
    a: { id: aId, text: a.text },
    b: { id: bId, text: b.text },
  });
}
```

2. Set `DEBUG_SORT = true` and restart the app.

### Existing Tree Logging

The FolderTree component already logs `initialOpen` state:
```
[FolderTree] Tree initialOpen: { isCollapsedAll, expandedFolderIds, allFolderIds, result }
```

## Inspecting Folder Order Values

### Via DevTools Console

Open DevTools (Cmd+Option+I) and run:

```javascript
// List all folders with their order values
window.electronAPI.folder.list('default').then(folders => {
  console.table(folders.map(f => ({
    name: f.name,
    id: f.id.slice(0, 8),
    order: f.order,
    parentId: f.parentId?.slice(0, 8) ?? 'root'
  })));
});
```

### Via Main Process

In the main process debugger or logs, look for:
```
[FolderTreeDoc] getAllFolders: folders.size = N
[FolderTreeDoc]   folder {id}: { name, order, ... }
```

## Common Issues

### "All Notes" Not First

1. Check that `sort={sortNodes}` is set on the Tree component
2. Verify the folder ID matches pattern: `all-notes` or `all-notes:*`
3. Check console for any errors in the sort function

### Folders Not Alphabetical

1. Verify `localeCompare` is being used correctly
2. Check if there are special characters in folder names
3. Confirm case-insensitive comparison: `a.text.toLowerCase().localeCompare(b.text.toLowerCase())`

### SD Headers Reordering Unexpectedly

1. Check that `aIsSD && bIsSD` returns `0` (no change)
2. SD headers should maintain their original order

## Testing Sort Function

Run the unit tests:
```bash
npx jest src/renderer/src/components/FolderPanel/__tests__/FolderTree.test.tsx --testNamePattern="sortNodes"
```

## Future: Drag-Drop Reordering Debug

When drag-drop reordering is implemented:

1. Log `onDrop` callback parameters:
   - `dragSourceId`, `dropTargetId`
   - `relativeIndex`, `destinationIndex`

2. Log `folder:reorder` IPC calls:
   - `sdId`, `folderId`, `newIndex`

3. Verify order field updates in CRDT:
   ```javascript
   // After reorder, check new values
   window.electronAPI.folder.list('default').then(folders => {
     console.table(folders.sort((a,b) => a.order - b.order).map(f => ({
       name: f.name,
       order: f.order
     })));
   });
   ```
