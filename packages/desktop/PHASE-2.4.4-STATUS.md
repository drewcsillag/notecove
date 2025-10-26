# Phase 2.4.4 - Current Status

## Test Results: 2/9 Passing (was 0/9, then 1/9)

### ✅ PASSING Tests:
1. **Test 1**: Right-click rename - Fixed by adding `event.stopPropagation()` in FolderTree.tsx:142-189
2. **Test 2**: Drag-drop moves correct folder - Fixed by using exact Playwright selectors

### ❌ FAILING Tests:

**Test 3** (Drag-drop multiple operations):
- Status: Timing/selector issue
- Error: Can't find "Ideas" after multiple drags
- Same fix as Test 2 needed

**Tests 4-5** (Persistence):
- Status: Async loading/timing issues
- Test 4: Dialog won't close - folder already exists error
- Test 5: "Career" not visible after restart
- Root cause: Need better async wait for folder tree loading

**Tests 6-8** (Multi-window sync):
- Status: Window creation blocked
- Error: `__dirname is not defined` in electronApp.evaluate()
- Fix needed: Add IPC method to create windows OR use different approach

**Test 9** (Cross-instance sync):
- Status: Folder created but UI not refreshing
- Error: "Cross Instance Sync Test" folder not visible in instance 2
- Logs show file watcher works, folder:updated fires
- Root cause: FolderPanel.tsx:38-49 listener might not be triggering tree reload properly

## Bugs Fixed:

### 1. ENOENT Bug (CRITICAL - Real Implementation Bug)
**File**: `src/main/index.ts:190-204`
**Problem**: Updates directory didn't exist when demo folders were created
**Fix**:
```typescript
// Ensure updates directory exists BEFORE creating CRDT manager
const folderUpdatesPath = join(storageDir, 'folders', 'updates');
await fsAdapter.mkdir(folderUpdatesPath);

// Eagerly load folder tree to trigger demo folder creation
crdtManager.loadFolderTree('default');
```

### 2. Event Bubbling Bug
**File**: `src/renderer/src/components/FolderPanel/FolderTree.tsx:142-189`
**Problem**: Right-click and drag events bubbled to parent folders
**Fix**: Added `event.stopPropagation()` to all handlers

### 3. Drag State Reset Bug
**File**: `src/renderer/src/components/FolderPanel/FolderTree.tsx:485-489`
**Problem**: Drag state not reset on ESC or failed drag
**Fix**: Added `onDragEnd` handler that always resets state

## Known Issues Still To Fix:

### Issue 1: FolderPanel UI Refresh After folder:updated
**File**: `src/renderer/src/components/FolderPanel/FolderPanel.tsx:38-49`
**Current Code**:
```typescript
useEffect(() => {
  const unsubscribe = window.electronAPI.folder.onUpdated((data) => {
    console.log('[FolderPanel] Received folder:updated event:', data);
    setRefreshTrigger((prev) => prev + 1);
  });
  return () => unsubscribe();
}, []);
```
**Problem**: `refreshTrigger` increments but FolderTree might not be reloading
**Investigation Needed**: Check if FolderTree properly responds to refreshTrigger prop changes

### Issue 2: Multi-Window Creation in Tests
**File**: `e2e/folder-bugs.spec.ts:331-353`
**Current Code**:
```typescript
await electronApp.evaluate(async ({ BrowserWindow }) => {
  const newWindow = new BrowserWindow({
    webPreferences: {
      preload: __dirname + '/../preload/index.js',  // __dirname not defined!
    },
  });
});
```
**Problem**: `__dirname` is not available in evaluate context
**Options**:
1. Add IPC method like `window.electronAPI.testing.createWindow()`
2. Use app.getPath() and construct paths differently
3. Expose window creation via menu item programmatically

### Issue 3: Async Loading Race Conditions
**Files**: Tests 3, 4, 5, 9
**Problem**: Tests don't wait long enough for:
- Folder tree to fully load from disk
- folder:updated events to propagate and trigger UI refresh
- Tree expansion animations to complete
**Current Waits**: 500ms - 3000ms (inconsistent)
**Better Solution**: Wait for specific DOM changes or use retry logic

## File Changes Summary:

### Created:
- `src/main/storage/node-fs-adapter.ts` - Node.js FileSystemAdapter impl
- `src/main/storage/node-file-watcher.ts` - fs.watch() wrapper
- `e2e/folder-bugs.spec.ts` - 9 E2E tests
- `e2e/BUG-TEST-SUMMARY.md` - Test documentation
- `PHASE-2.4.4-CHECKPOINT.md` - Initial checkpoint
- `PHASE-2.4.4-STATUS.md` - This file

### Modified:
- `src/main/index.ts` - Added UpdateManager, file watcher, eager folder tree load
- `src/main/crdt/crdt-manager.ts` - Added persistence, update listeners
- `src/main/ipc/handlers.ts` - Added broadcastToAll() for multi-window sync
- `src/preload/index.ts` - Updated folder:onUpdated signature
- `src/renderer/src/types/electron.d.ts` - Updated types
- `src/renderer/src/components/FolderPanel/FolderPanel.tsx` - Added event listener
- `src/renderer/src/components/FolderPanel/FolderTree.tsx` - Fixed event bubbling, drag state

## Commits:
1. `cf2a50e` - Phase 2.4.4: All implementations complete - E2E tests failing
2. `ac0a32a` - WIP: E2E test fixes - 1/9 tests now passing
3. `baeef05` - Fix ENOENT bug: ensure updates directory exists
4. `c562393` - Apologize for incorrectly dismissing test failures

## Next Steps (Priority Order):

1. **Fix FolderTree refresh on folder:updated event**
   - Debug why refreshTrigger doesn't reload tree
   - Possibly need to reload folders from IPC instead of just incrementing trigger

2. **Add test helper for window creation**
   - Implement `window.electronAPI.testing.createWindow()`
   - Use in tests 6-8

3. **Improve test timing/waits**
   - Use `page.waitForFunction()` to wait for specific conditions
   - Add retry logic for flaky assertions

4. **Fix drag-drop test 3**
   - Apply same selector fixes as test 2
   - Ensure proper folder expansion between operations

5. **Fix persistence tests 4-5**
   - Add proper cleanup or handle "already exists" gracefully
   - Wait for folder tree to fully load before assertions
