# Questions for Sync Status Fixes Feature

## Summary of Issues

Based on my exploration of the codebase, here are the three issues and my understanding:

### Issue 1: Sync status shows issues for SDs no longer attached

**Root Cause Identified:**
When an SD is deleted via `handleDeleteStorageDir` in `sd-handlers.ts:98-103`:

```typescript
await ctx.database.deleteStorageDir(sdId);
ctx.broadcastToAll('sd:updated', { operation: 'delete', sdId });
```

The SD is removed from the database, but `SDWatcherManager.cleanupWatchers(sdId)` is **never called**. This means:

- `sdActivitySyncs` still contains the deleted SD's ActivitySync
- `sdDeletionSyncs` still contains the deleted SD's DeletionSync
- `getSyncStatus` callback in `index.ts:607-635` iterates `sdWatcherManager.getActivitySyncs()` which still includes the deleted SD

**Question 1:** The fix is to call `sdWatcherManager.cleanupWatchers(sdId)` when an SD is deleted. However, the `SDWatcherManager` is not currently passed to the SD handlers. Should I:

- A) Add `sdWatcherManager` to the `HandlerContext` and call cleanup from the handler
- B) Have the main process listen for `sd:updated` delete events and cleanup there
- C) Add an `onStorageDirDeleted` callback similar to `onStorageDirCreated`

My recommendation is **Option C** as it mirrors the existing pattern for SD creation.

## C

### Issue 2: Sync Status menu item doesn't open the window

**Root Cause Analysis:**
Looking at `menu.ts:343-349`:

```typescript
{
  label: 'Sync Status',
  click: () => {
    if (mainWindow) {
      mainWindow.webContents.send('menu:syncStatus');
    }
  },
},
```

This sends the event to `mainWindow` which then calls `window.electronAPI.sync.openWindow()` (App.tsx:670-672).

The flow is:

1. Menu click → sends `menu:syncStatus` to mainWindow
2. App.tsx listens → calls `window.electronAPI.sync.openWindow()`
3. This calls `ipcMain.handle('sync:openWindow')` → `createWindow({ syncStatus: true })`

**Question 2:** To test this, I need to understand what's actually failing. Did you observe:

- A) The menu click does nothing at all (no window appears, no console logs)
- B) The window appears but is blank/broken
- C) Something else

If it's (A), is `mainWindow` possibly null when you click? This would happen if you're clicking from a non-main window.

If it's (A), the fix would be to bypass the mainWindow relay and call `createWindow({ syncStatus: true })` directly from the menu click handler (like Storage Inspector does).

## A

### Issue 3: Adding a new SD waits synchronously

**Code Location:**
`index.ts:433-436`:

```typescript
// For runtime SD addition, run initial sync immediately (blocking)
// since the user is actively waiting for the SD to be ready
await sdWatcherResult.runInitialSync();
```

**Current Behavior:**

- At startup: `initialSyncFunctions.push(...)` collects sync functions, then runs them in background after window creation via `Promise.all(initialSyncFunctions.map(fn => fn()))` (non-blocking)
- When adding SD: `await sdWatcherResult.runInitialSync()` is called directly in the IPC handler (blocking)

**Question 3:** The comment says this is intentional ("since the user is actively waiting for the SD to be ready"). Should we:

- A) Make it non-blocking like startup (just don't await), understanding the SD list and notes will populate asynchronously
- B) Keep blocking but add better progress UI (the `sd:init-progress` events are sent but may not be handled well)
- C) Keep as-is (it's intentional design)

The progress messages ARE being sent (`sendProgress()`), but they're on the same IPC call that's blocking, so the UI can't update until the handler returns.

A

**Question 4:** If we go with option A, should we:

- Return immediately after setting up watchers (so user can interact with the SD immediately)
- Show a spinner/indicator that sync is in progress
- Notify when sync completes

## Return immediately

## Implementation Approach Questions

**Question 5:** For issue 1 (detached SDs), should I also:

- Clean up entries from the database's profile_presence_cache for that SD?
  yes

- Any other cleanup needed when an SD is removed?

I can't think of any right now

**Question 6:** Are there any tests I should be aware of that might need updating when changing SD deletion behavior?

## They'll probably be couple, but none come to mind.

## Summary of Proposed Fixes

1. **Issue 1 (Detached SDs)**: Add `onStorageDirDeleted` callback that calls `sdWatcherManager.cleanupWatchers(sdId)`

2. **Issue 2 (Menu not working)**: Call `createWindow({ syncStatus: true })` directly from menu handler instead of going through mainWindow relay

3. **Issue 3 (Blocking sync)**: Run initial sync in background (don't await), similar to startup behavior
