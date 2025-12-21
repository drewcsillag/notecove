# Sync Status Fixes - Implementation Plan

**Overall Progress:** `90%`

## Overview

This plan addresses three related sync status issues:

1. Sync status shows issues for SDs no longer attached
2. Sync Status menu item doesn't open the window
3. Adding a new SD waits synchronously for initial sync

See [QUESTIONS-1.md](./QUESTIONS-1.md) for detailed analysis and user answers.

---

## Tasks

### Issue 2: Fix Sync Status menu item (Quick win - do first)

- [x] 🟩 **2.1** Update menu handler to call `createWindow` directly
  - [x] 🟩 Modify `menu.ts` Sync Status click handler to call `createWindow({ syncStatus: true })`
  - [x] 🟩 Remove the `if (mainWindow)` check since we're creating a new window

- [x] 🟩 **2.2** Clean up dead code
  - [x] 🟩 Remove `onSyncStatus` listener from App.tsx (lines 669-672)
  - [x] 🟩 Remove `onSyncStatus` from preload API (`window-api.ts`)
  - [x] 🟩 Remove from type definitions (`electron.d.ts`)
  - [x] 🟩 Remove from web-client.ts and browser-stub.ts
  - [x] 🟩 Update test mocks

- [ ] 🟥 **2.3** Manual test: verify Sync Status menu opens window

---

### Issue 1: Clean up sync state when SD is deleted

- [x] 🟩 **1.1** Add database method to clean profile_presence_cache
  - [x] 🟩 Method `deleteProfilePresenceCacheBySd(sdId)` already exists in Database class

- [x] 🟩 **1.2** Write tests for SD deletion cleanup
  - [x] 🟩 Test that `onStorageDirDeleted` callback is called when SD is deleted
  - [x] 🟩 Test that callback is called BEFORE database delete

- [x] 🟩 **1.3** Add `onStorageDirDeleted` callback to handlers
  - [x] 🟩 Define the callback type in `handlers/types.ts`
  - [x] 🟩 Add it to `HandlerDependencies` interface
  - [x] 🟩 Add parameter to constructor in `handlers.ts`
  - [x] 🟩 Call the callback from `handleDeleteStorageDir`

- [x] 🟩 **1.4** Implement the callback in `index.ts`
  - [x] 🟩 Create callback function that:
    - Calls `sdWatcherManager.cleanupWatchers(sdId)`
    - Calls `storageManager.unregisterSD(sdId)`
    - Calls `database.deleteProfilePresenceCacheBySd(sdId)`
  - [x] 🟩 Pass it to `IPCHandlers` via constructor

- [ ] 🟥 **1.5** Run targeted tests to verify

---

### Issue 3: Make SD addition sync non-blocking

- [x] 🟩 **3.1** Modify `handleNewStorageDir` in `index.ts`
  - [x] 🟩 Remove `await` from `sdWatcherResult.runInitialSync()`
  - [x] 🟩 Use `void` to run it in background (like startup does)
  - [x] 🟩 Update comment to reflect new behavior

- [ ] 🟥 **3.2** Manual test: verify adding SD returns quickly

---

### Verification

- [ ] 🟥 **4.1** Run CI to verify all tests pass
- [ ] 🟥 **4.2** Final manual testing of all three fixes

---

## Files Modified

| File                                                                 | Changes                                                         |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| `packages/desktop/src/main/menu.ts`                                  | Call `createWindow` directly for Sync Status                    |
| `packages/desktop/src/renderer/src/App.tsx`                          | Remove `onSyncStatus` listener                                  |
| `packages/desktop/src/preload/api/window-api.ts`                     | Remove `onSyncStatus` API                                       |
| `packages/desktop/src/renderer/src/api/web-client.ts`                | Remove `onSyncStatus`                                           |
| `packages/desktop/src/renderer/src/api/browser-stub.ts`              | Remove `onSyncStatus`                                           |
| `packages/desktop/src/renderer/src/types/electron.d.ts`              | Remove `onSyncStatus` type                                      |
| `packages/desktop/src/renderer/src/__tests__/App.test.tsx`           | Remove `onSyncStatus` mock                                      |
| `packages/desktop/src/renderer/src/__tests__/multi-sd-bugs.test.tsx` | Remove `onSyncStatus` mock                                      |
| `packages/desktop/src/main/ipc/handlers/types.ts`                    | Add `OnStorageDirDeletedFn` type                                |
| `packages/desktop/src/main/ipc/handlers/index.ts`                    | Export `OnStorageDirDeletedFn`                                  |
| `packages/desktop/src/main/ipc/handlers/sd-handlers.ts`              | Call `onStorageDirDeleted` callback (modular handlers)          |
| `packages/desktop/src/main/ipc/handlers.ts`                          | Add `onStorageDirDeleted` param, call in handleDeleteStorageDir |
| `packages/desktop/src/main/index.ts`                                 | Implement delete callback, make SD addition non-blocking        |

## Test Files Modified

| File                                                                   | Changes                        |
| ---------------------------------------------------------------------- | ------------------------------ |
| `packages/desktop/src/main/ipc/__tests__/handlers/sd-handlers.test.ts` | Add test for deletion callback |

## Implementation Notes

- **Database method already existed**: `deleteProfilePresenceCacheBySd(sdId)` was already implemented
- **Two handlers files**: Both `handlers.ts` (monolithic, actually used) and `handlers/` (modular, unused) were updated
- **Ordering verified**: Test confirms callback is called BEFORE database deletion
