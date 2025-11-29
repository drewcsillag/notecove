# Clear Search on Folder Selection - Implementation Plan

**Overall Progress:** `100%`

## Summary

When a user clicks a folder in the folder tree (including virtual folders like "All Notes" and "Recently Deleted"), the note list search box should be cleared and the folder's contents should be displayed.

## Tasks:

- [x] 🟩 **Step 1: Write failing tests**
  - [x] 🟩 Add test: search is cleared when `folder:selected` event is received
  - [x] 🟩 Add test: search is cleared for virtual folders ("All Notes", "Recently Deleted")
  - [x] 🟩 Add test: search is cleared when `activeSdId` prop changes
  - [x] 🟩 Add test: persisted `searchQuery` app state is also cleared

- [x] 🟩 **Step 2: Add IPC event channel for folder selection**
  - [x] 🟩 Add `folder.onSelected` listener in `preload/index.ts`
  - [x] 🟩 Add `folder.emitSelected` method in `preload/index.ts`
  - [x] 🟩 Register `folder:selected` handler in `main/ipc/handlers.ts`
  - [x] 🟩 Update TypeScript types in `renderer/src/types/electron.d.ts`

- [x] 🟩 **Step 3: Emit folder selection event from FolderPanel**
  - [x] 🟩 Call `window.electronAPI.folder.emitSelected(folderId)` in `handleFolderSelect`

- [x] 🟩 **Step 4: Listen for folder selection in NotesListPanel**
  - [x] 🟩 Add `useEffect` to subscribe to `folder.onSelected` event
  - [x] 🟩 Clear `searchQuery` local state when event received
  - [x] 🟩 Clear persisted `searchQuery` in app state via `saveSearchQuery('')`
  - [x] 🟩 Set `isSearching` to false
  - [x] 🟩 Cancel any pending search timeout

- [x] 🟩 **Step 5: Clear search on SD change**
  - [x] 🟩 Modify existing SD change `useEffect` to also clear search state

- [ ] 🟥 **Step 6: Verify tests pass and manual QA**
  - [x] 🟩 All new tests pass
  - [x] 🟩 Existing tests still pass
  - [ ] 🟥 Manual verification: click folder while search active → search clears
  - [ ] 🟥 Manual verification: click "All Notes" while search active → search clears
  - [ ] 🟥 Manual verification: click "Recently Deleted" while search active → search clears
  - [ ] 🟥 Manual verification: change SD while search active → search clears
  - [ ] 🟥 Manual verification: click same folder while search active → search clears

## Files Modified

| File                                                                                            | Change                                                       |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `packages/desktop/src/preload/index.ts`                                                         | Added `folder.emitSelected()` and `folder.onSelected()`      |
| `packages/desktop/src/main/ipc/handlers.ts`                                                     | Added `folder:emitSelected` handler and cleanup              |
| `packages/desktop/src/renderer/src/types/electron.d.ts`                                         | Added types for new IPC methods                              |
| `packages/desktop/src/renderer/src/components/FolderPanel/FolderPanel.tsx`                      | Emit event on folder click                                   |
| `packages/desktop/src/renderer/src/components/NotesListPanel/NotesListPanel.tsx`                | Listen for event and clear search; clear search on SD change |
| `packages/desktop/src/renderer/src/components/NotesListPanel/__tests__/NotesListPanel.test.tsx` | Added 5 new tests                                            |

## Technical Approach

**Event-based communication:**

1. `FolderPanel` calls `window.electronAPI.folder.emitSelected(folderId)` whenever a folder is clicked
2. Main process receives `folder:emitSelected` and broadcasts `folder:selected` to all windows
3. `NotesListPanel` subscribes to `folder.onSelected()` and clears search state when received
4. This handles same-folder clicks naturally since the event is emitted on every click

**Search clearing logic:**

- Clear `searchQuery` local state to `''`
- Clear persisted app state via `saveSearchQuery('')`
- Set `isSearching` to `false`
- Clear any pending debounce timeout via `searchTimeoutRef.current`

**SD change handling:**

- The existing `useEffect` watching `activeSdId` was extended to also clear search

**Pattern follows existing IPC conventions:**

- Similar to `folder:updated` / `folder.onUpdated()` pattern already in codebase
- Uses `broadcastToAll()` in handlers.ts to send to all windows
