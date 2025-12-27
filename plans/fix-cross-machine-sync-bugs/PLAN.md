# Feature Implementation Plan: Fix Cross-Machine Sync Bugs

**Overall Progress:** `10%`

## Answers

- **Q1 (Debugging):** Option 1 - Add temporary logging first
- **Q2 (Comments fix):** Option 4 - Ensure atomic thread creation in Y.js transaction
- **Q3 (Deletion fix):** Option 2 - Ensure `note:deleted` broadcast after sync
- **Q4 (Test stability):** Options 3+4 - Retry assertions + sync barriers

## Summary

Two cross-machine sync bugs documented by e2e tests need fixing:

1. **Comments sync bug**: Badge shows comment count but sidebar is empty
2. **Deletion sync bug**: Deleted notes still appear in other instance's list

## Bug 1: Comments Sidebar Empty After Sync

### Symptom

- Instance 1 adds a comment
- Instance 2's badge shows "1" (correct)
- Instance 2's sidebar shows 0 threads (incorrect)

### Root Cause Analysis

Comments are stored in the CRDT Y.Doc as Y.Maps. The sync chain:

```
Instance 1: addCommentThread() → Y.Map created in comments map
    ↓
CRDT update written to .crdtlog file
    ↓
Activity log records note modification
    ↓
Instance 2: Activity watcher detects change
    ↓
reloadNote() → Y.applyUpdate() merges remote changes
    ↓
CRDTCommentObserver.registerNote() → broadcasts comment:threadAdded
    ↓
CommentPanel receives event → calls loadThreads()
    ↓
getThreads() IPC → reads from Y.Doc → returns threads
```

**The Problem**: Race condition between badge count and sidebar data:

| Component              | What It Reads                         | Issue                                |
| ---------------------- | ------------------------------------- | ------------------------------------ |
| Badge (TipTapEditor)   | Counts thread objects in Y.Doc        | Works if thread key exists           |
| Sidebar (CommentPanel) | Fetches threads + replies + reactions | May get incomplete data during merge |

**Likely Causes**:

1. Thread Y.Map exists but internal properties not fully initialized during merge
2. Observer fires before thread data is complete
3. `getCommentThreads()` returns thread with invalid/empty anchor data → marked orphaned → hidden

### Key Files

- `/packages/shared/src/crdt/note-doc.ts` - Comment storage (lines 200-655)
- `/packages/desktop/src/main/crdt/crdt-manager.ts` - Note reload (lines 586-686)
- `/packages/desktop/src/main/ipc/handlers/comment-handlers.ts` - Thread fetching
- `/packages/desktop/src/renderer/src/components/CommentPanel/CommentPanel.tsx` - Sidebar

---

## Bug 2: Deletion Not Syncing

### Symptom

- Instance 1 deletes a note (soft delete to Recently Deleted)
- Instance 2 still shows the note in All Notes list

### Root Cause Analysis

Deletion sync chain:

```
Instance 1: handleDeleteNote() → noteDoc.markDeleted()
    ↓
CRDT metadata updated: deleted = true
    ↓
Update written to .crdtlog + activity log entry created
    ↓
Instance 2: ActivitySync reads activity log
    ↓
reloadNote() → CRDT merges → metadata.deleted = true synced to SQLite
    ↓
broadcast('note:deleted', noteId)
    ↓
NotesListPanel receives event → removes note from list
```

**Possible Failure Points**:

1. **Activity log entry not created** - metadata update doesn't trigger CRDT event
2. **Activity log entry not processed** - watermark tracking skipped it
3. **CRDT log not synced yet** - cloud sync delivered files out of order
4. **Stale entry detection** - gap exceeds threshold (50), entry skipped
5. **UI event not broadcast** - `note:deleted` not sent after sync
6. **UI event not received** - renderer not subscribed or race condition

### Key Files

- `/packages/desktop/src/main/ipc/handlers/note-handlers.ts` - Deletion handling (lines 137-163)
- `/packages/shared/src/storage/activity-sync.ts` - Activity polling
- `/packages/desktop/src/main/sd-watcher-callbacks.ts` - Sync callbacks
- `/packages/desktop/src/renderer/src/components/NotesListPanel.tsx` - List refresh (lines 521-536)

---

## Tasks

### Bug 1: Comments Sync

- [ ] **Step 1: Add logging to diagnose exact failure point**
  - Log when thread is added to Y.Doc
  - Log when observer fires `comment:threadAdded`
  - Log what `getCommentThreads()` returns
  - Log orphan detection in CommentPanel

- [ ] **Step 2: Fix the root cause** (TBD based on diagnosis)
  - Option A: Ensure thread data is complete before observer fires
  - Option B: Add retry logic in CommentPanel when data incomplete
  - Option C: Validate thread completeness in getCommentThreads()

- [ ] **Step 3: Add test coverage**
  - Verify fix with existing e2e test

### Bug 2: Deletion Sync

- [ ] **Step 1: Add logging to trace the sync chain**
  - Log activity log entry creation on delete
  - Log activity log processing on Instance 2
  - Log CRDT metadata after reload
  - Log `note:deleted` broadcast and receipt

- [ ] **Step 2: Fix the root cause** (TBD based on diagnosis)
  - Option A: Ensure activity log entry is created for metadata-only updates
  - Option B: Fix watermark tracking to not skip deletion entries
  - Option C: Add explicit deletion event in activity log (not just note activity)

- [ ] **Step 3: Add test coverage**
  - Verify fix with existing e2e test

---

## Questions

See QUESTIONS-1.md for implementation approach questions.
