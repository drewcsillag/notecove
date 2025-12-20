# Comment Live Sync Fixes - Implementation Plan

**Overall Progress:** `0%`

## Summary

Fix 6 issues with the comment system:

1. Comment content doesn't live sync (requires note switch)
2. Replies don't live update (requires note switch)
3. Username always shows "You" instead of actual name
4. No way to open comments sidebar without clicking a comment
5. Overlapping comments from concurrent editors need separate visuals
6. Race condition: concurrent comment creation should result in two separate threads

## Decisions Made

| Decision               | Choice                                     |
| ---------------------- | ------------------------------------------ |
| Toolbar buttons        | Both: "view all" button + rework existing  |
| Overlapping comments   | Stack visually, sidebar shows all          |
| Race condition outcome | Two separate threads                       |
| Username display       | Always actual username (industry standard) |
| CRDT approach          | Add observers to detect remote changes     |
| Author ID              | Use actual profileId (not hardcoded)       |
| Debounce window        | 100ms for observer broadcasts              |
| Phase ordering         | Quick wins first, then CRDT work           |

---

## Phase 1: Quick Wins - Username & Profile Fix

**Goal:** Show actual profile username/handle/ID instead of hardcoded values.

### 1.1 Add User Profile IPC

- [ ] 🟥 **1.1.1 Write tests for user profile handler**
  - Test returns profileId, username, handle from appState
  - Test handles missing values gracefully (fallbacks)
  - Location: `packages/desktop/src/main/ipc/handlers/__tests__/misc-handlers.test.ts`

- [ ] 🟥 **1.1.2 Add `user:getCurrentProfile` IPC handler**
  - Returns `{ profileId, username, handle }` from appState
  - Fallback: profileId from context, empty strings for name/handle
  - Location: `packages/desktop/src/main/ipc/handlers/misc-handlers.ts`

- [ ] 🟥 **1.1.3 Add preload API for current user**
  - Expose `window.electronAPI.user.getCurrentProfile()`
  - Location: `packages/desktop/src/preload/api/comment-api.ts` (extend existing)

- [ ] 🟥 **1.1.4 Update electron.d.ts types**
  - Add `user` namespace with `getCurrentProfile` method
  - Location: `packages/desktop/src/renderer/src/types/electron.d.ts`

- [ ] 🟥 **1.1.5 Update browser stub**
  - Add placeholder for `user.getCurrentProfile`
  - Location: `packages/desktop/src/renderer/src/api/browser-stub.ts`

### 1.2 Update Comment Creation

- [ ] 🟥 **1.2.1 Write tests for username in comment creation**
  - Test comment uses actual profileId, username, handle
  - Test fallback behavior when fetch fails
  - Location: `packages/desktop/src/renderer/src/components/EditorPanel/__tests__/TipTapEditor.test.tsx`

- [ ] 🟥 **1.2.2 Update TipTapEditor to use real user info**
  - Fetch user profile on mount, cache in state
  - Replace hardcoded `CURRENT_USER_ID`, `'You'`, `'@you'`
  - Use in `handleAddCommentOnSelection`
  - Location: `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx`

- [ ] 🟥 **1.2.3 Update CommentPanel to use real user info**
  - Fetch user profile, use in `handleReply`
  - Replace hardcoded values
  - Location: `packages/desktop/src/renderer/src/components/CommentPanel/CommentPanel.tsx`

---

## Phase 2: Quick Wins - Toolbar Button

**Goal:** Add "view all comments" button to open sidebar without clicking a comment.

### 2.1 Add View Comments Button

- [ ] 🟥 **2.1.1 Write tests for view comments button**
  - Test button appears in toolbar
  - Test button is always enabled (unlike add comment)
  - Test button shows badge with comment count
  - Test clicking opens panel
  - Location: `packages/desktop/src/renderer/src/components/EditorPanel/__tests__/EditorToolbar.test.tsx`

- [ ] 🟥 **2.1.2 Add `onViewCommentsClick` prop to EditorToolbar**
  - New callback for "view all comments" action
  - Location: `packages/desktop/src/renderer/src/components/EditorPanel/EditorToolbar.tsx`

- [ ] 🟥 **2.1.3 Add View Comments button to toolbar**
  - Use `Comment` icon (not `AddComment`)
  - Show badge with unresolved comment count
  - Always enabled
  - Place after existing add comment button
  - Tooltip: "View comments"

### 2.2 Wire Up Panel Opening

- [ ] 🟥 **2.2.1 Update TipTapEditor to pass callback**
  - Add `onViewComments` prop
  - Pass to EditorToolbar as `onViewCommentsClick`
  - Location: `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx`

- [ ] 🟥 **2.2.2 Update EditorPanel for view-all mode**
  - Track whether panel was opened via "view all" vs thread click
  - Don't auto-close when opened via "view all"
  - Location: `packages/desktop/src/renderer/src/components/EditorPanel/EditorPanel.tsx`

---

## Phase 3: CRDT Observers for Live Sync

**Goal:** Comments and replies sync live without requiring note switch.

### 3.0 Debug Infrastructure

- [ ] 🟥 **3.0.1 Add debug logging for comment observers**
  - Add `DEBUG_COMMENT_SYNC` environment variable check
  - Log observer events: type, threadId, isRemote
  - Log broadcasts sent
  - Location: `packages/desktop/src/main/crdt-comment-observer.ts`

### 3.1 Add CRDT Observer Infrastructure

- [ ] 🟥 **3.1.1 Write unit tests for comment CRDT observers**
  - Test observer fires on remote thread addition
  - Test observer fires on remote thread update
  - Test observer fires on remote thread deletion
  - Test observer fires on remote reply addition/update/deletion
  - Test observer does NOT fire for local changes
  - Test no infinite loops
  - Location: `packages/shared/src/crdt/__tests__/note-doc-comments.test.ts`

- [ ] 🟥 **3.1.2 Add observer support to NoteDoc**
  - Add `observeComments(callback): () => void` method
  - Callback signature: `(event: CommentChangeEvent) => void`
  - Event: `{ type: 'thread-add'|'thread-update'|'thread-delete'|'reply-add'|'reply-update'|'reply-delete', threadId: string, replyId?: string, isRemote: boolean }`
  - Use Y.Map `.observe()` and Y.Array `.observe()`
  - Track transaction origin to detect remote vs local
  - Return unsubscribe function
  - Location: `packages/shared/src/crdt/note-doc.ts`

### 3.2 Wire Observers to IPC Broadcasts

- [ ] 🟥 **3.2.1 Write tests for observer-triggered broadcasts**
  - Test remote thread add triggers `comment:threadAdded` broadcast
  - Test remote thread update triggers `comment:threadUpdated` broadcast
  - Test debouncing works (multiple rapid changes = one broadcast)
  - Test cleanup on note unload
  - Location: `packages/desktop/src/main/__tests__/crdt-comment-observer.test.ts`

- [ ] 🟥 **3.2.2 Create CRDTCommentObserver class**
  - Registers observers on loaded NoteDoc instances
  - Debounces broadcasts (100ms window)
  - Calls `broadcastToAll` for remote changes only
  - Tracks registered observers for cleanup
  - Location: `packages/desktop/src/main/crdt-comment-observer.ts`

- [ ] 🟥 **3.2.3 Integrate observer with CRDTManager**
  - Register observers when notes are loaded
  - Unregister when notes are unloaded
  - Location: `packages/desktop/src/main/crdt-manager.ts`

- [ ] 🟥 **3.2.4 Test observer cleanup**
  - Load note, verify observer registered
  - Unload note, verify observer unregistered
  - Check for memory leaks / dangling references
  - Location: `packages/desktop/src/main/__tests__/crdt-comment-observer.test.ts`

---

## Phase 4: Overlapping Comments Visual Handling

**Goal:** Ensure overlapping comment marks are visually distinct.

### 4.1 Visual Stacking for Overlaps

- [ ] 🟥 **4.1.1 Write tests for overlapping marks**
  - Test two marks on same text range both render
  - Test visual distinction for overlapped regions
  - Location: `packages/desktop/src/renderer/src/components/EditorPanel/extensions/__tests__/CommentMark.test.ts`

- [ ] 🟥 **4.1.2 Update CommentMark CSS for stacking**
  - Overlapped regions get darker highlight OR underline
  - Consider: nested spans with additive opacity
  - Location: Editor styles (CSS or inline)

- [ ] 🟥 **4.1.3 Update click handler for overlapped marks**
  - Collect all threadIds at click position
  - Pass array to `onCommentClick`
  - Location: `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx`

### 4.2 Sidebar Multi-Thread Handling

- [ ] 🟥 **4.2.1 Write tests for multi-thread selection**
  - Test sidebar highlights multiple threads
  - Test scrolls to first selected
  - Location: `packages/desktop/src/renderer/src/components/CommentPanel/__tests__/CommentPanel.test.tsx`

- [ ] 🟥 **4.2.2 Update CommentPanel for multi-selection**
  - Change `selectedThreadId?: string` to `selectedThreadIds?: string[]`
  - Highlight all selected threads
  - Scroll to first selected
  - Location: `packages/desktop/src/renderer/src/components/CommentPanel/CommentPanel.tsx`

- [ ] 🟥 **4.2.3 Update EditorPanel state for multi-selection**
  - Change `selectedThreadId` to `selectedThreadIds: string[]`
  - Update handlers
  - Location: `packages/desktop/src/renderer/src/components/EditorPanel/EditorPanel.tsx`

---

## Phase 5: Concurrent Thread Creation (Race Condition)

**Goal:** When two editors create comments on overlapping text, both threads exist.

### 5.1 Verify CRDT Behavior

- [ ] 🟥 **5.1.1 Write tests for concurrent thread creation**
  - Two NoteDoc instances add threads on same text
  - Merge updates both ways
  - Both threads exist in both docs
  - Location: `packages/shared/src/crdt/__tests__/note-doc-comments.test.ts`

- [ ] 🟥 **5.1.2 Write tests for concurrent mark application**
  - Both marks survive CRDT merge
  - Both threadIds present in synced document
  - Location: Same file

### 5.2 E2E Cross-Machine Test

- [ ] 🟥 **5.2.1 Write E2E test for concurrent comments**
  - Use FileSyncSimulator pattern
  - Instance A creates comment on "text"
  - Instance B creates different comment on same "text"
  - After sync: both instances show both comments
  - Location: `packages/desktop/e2e/cross-machine-sync-comments.spec.ts`

---

## Phase 6: Integration & Polish

### 6.1 E2E Live Sync Tests

- [ ] 🟥 **6.1.1 Write E2E test for comment content sync**
  - Instance A adds comment with content
  - Instance B sees comment appear live (no note switch)
  - Location: `packages/desktop/e2e/cross-machine-sync-comments.spec.ts`

- [ ] 🟥 **6.1.2 Write E2E test for reply sync**
  - Instance A adds reply
  - Instance B sees reply appear live

### 6.2 Sloppy Sync Tests

- [ ] 🟥 **6.2.1 Write sloppy sync tests for comments**
  - Use partialSyncProbability and delays
  - Verify eventual consistency
  - Location: `packages/desktop/e2e/cross-machine-sync-comments-sloppy.spec.ts`

### 6.3 Cleanup

- [ ] 🟥 **6.3.1 Remove TODO comments**
  - Remove resolved TODOs from TipTapEditor
  - Remove resolved TODOs from CommentPanel
  - Update any stale comments

---

## File Summary

### Files to Create

| File                                                                | Purpose           |
| ------------------------------------------------------------------- | ----------------- |
| `packages/desktop/src/main/crdt-comment-observer.ts`                | Observer class    |
| `packages/desktop/src/main/__tests__/crdt-comment-observer.test.ts` | Observer tests    |
| `packages/desktop/e2e/cross-machine-sync-comments.spec.ts`          | E2E tests         |
| `packages/desktop/e2e/cross-machine-sync-comments-sloppy.spec.ts`   | Sloppy sync tests |

### Files to Modify

| File                                                      | Changes                                |
| --------------------------------------------------------- | -------------------------------------- |
| `packages/shared/src/crdt/note-doc.ts`                    | Add `observeComments()`                |
| `packages/desktop/src/main/crdt-manager.ts`               | Wire up observers                      |
| `packages/desktop/src/main/ipc/handlers/misc-handlers.ts` | Add `user:getCurrentProfile`           |
| `packages/desktop/src/preload/api/comment-api.ts`         | Add user API                           |
| `packages/desktop/src/renderer/src/types/electron.d.ts`   | Add types                              |
| `packages/desktop/src/renderer/src/api/browser-stub.ts`   | Add stub                               |
| `packages/desktop/src/renderer/.../TipTapEditor.tsx`      | Use real user info, multi-thread click |
| `packages/desktop/src/renderer/.../CommentPanel.tsx`      | Use real user info, multi-selection    |
| `packages/desktop/src/renderer/.../EditorToolbar.tsx`     | Add view comments button               |
| `packages/desktop/src/renderer/.../EditorPanel.tsx`       | View-all mode, multi-thread state      |

---

## Related Files

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial questions and answers
- [QUESTIONS-2.md](./QUESTIONS-2.md) - Follow-up analysis
- [PLAN-CRITIQUE.md](./PLAN-CRITIQUE.md) - Staff engineer review
