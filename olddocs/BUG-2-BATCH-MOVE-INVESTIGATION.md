# Bug 2: Batch Move Across SDs Investigation

## Summary

Batch moving notes across Storage Directories (SDs) causes multiple issues:

- UI shows same notes in every folder (or notes list not updating)
- Notes don't actually move (remain in original location)
- Folder operations stop working on source instance
- Notes don't get deleted from source SD
- Setting up new user data directory fixes issue (points to SQLite caching problem)

## Key Files Involved

### 1. Frontend - Batch Selection & Same-SD Move

- **File:** `/Users/drew/devel/nc2/packages/desktop/src/renderer/src/components/NotesListPanel/NotesListPanel.tsx`
- **Lines:** 66-784
- **Key Functions:**
  - Multi-select state management (lines 66-68)
  - Batch move dialog handler (lines 759-784)

### 2. Frontend - Cross-SD Move

- **File:** `/Users/drew/devel/nc2/packages/desktop/src/renderer/src/components/FolderPanel/FolderTree.tsx`
- **Lines:** 821-949
- **Key Functions:**
  - `handleNoteDrop()` - Detects cross-SD operations (lines 821-921)
  - `handleCrossSDConfirm()` - Executes batch cross-SD moves (lines 924-949)

### 3. Backend - Cross-SD Move Handler

- **File:** `/Users/drew/devel/nc2/packages/desktop/src/main/ipc/handlers.ts`
- **Lines:** 662-742
- **Key Function:**
  - `handleMoveNoteToSD()` - Single note cross-SD move logic
  - For batches: called sequentially via `Promise.all()` per note

### 4. Database Operations

- **File:** `/Users/drew/devel/nc2/packages/desktop/src/main/database/database.ts`
- **Lines:** 190-244
- **Key Functions:**
  - `getNotesBySd()` - Gets all notes in SD (called per-note in batch)
  - `upsertNote()` - Individual insert/update (no batch operation)

### 5. E2E Tests

- `/Users/drew/devel/nc2/packages/desktop/e2e/cross-sd-drag-drop.spec.ts` - Tests cross-SD move
- `/Users/drew/devel/nc2/packages/desktop/e2e/note-multi-select.spec.ts` - Tests multi-select

## Critical Issues Found

### 1. Database Cache Invalidation Issue

**Problem:** `getNotesBySd()` is called per-note in batch loop. SQLite may cache results from first query, missing newly created notes in subsequent iterations.

**Evidence:** User reported "setting up a new user data directory fixed the issue" - classic cache invalidation problem.

### 2. Inconsistent Event Broadcasting

**Problem:** Same-SD moves broadcast `note:moved`, but cross-SD moves broadcast `note:deleted` + `note:created`, causing different UI update paths.

**Impact:** UI may not properly refresh on cross-SD batch moves.

### 3. Missing Multi-Select Clear

**Problem:** In `handleCrossSDConfirm()`, multi-select state is NOT cleared before async operation. Only cleared in same-SD `handleConfirmMove()`.

**Impact:** Selected notes remain selected after move, causing UI confusion.

### 4. No Transaction Wrapping

**Problem:** Batch moves are sequential individual operations with no atomic transaction.

**Impact:** Partial failures leave database in inconsistent state.

### 5. UUID Assignment Issue

**Problem:** Cross-SD moves always generate NEW UUIDs (line 691 in handlers.ts), creating orphaned notes in source SD's Recently Deleted.

**Expected:** Notes should keep same UUIDs when moving across SDs.

### 6. No Batch Error Handling

**Problem:** `Promise.all()` with no individual failure tracking. User sees "success" even if some notes fail.

**Impact:** Silent failures, data loss potential.

### 7. Stale Query Results

**Problem:** Database queries within batch loop don't see changes from earlier iterations due to SQLite adapter caching.

**Impact:** Notes list shows stale data, folders show wrong counts.

## Recommendations

1. Add explicit cache invalidation after each note move
2. Wrap batch operations in database transaction
3. Preserve UUIDs when moving across SDs
4. Clear multi-select state after cross-SD moves
5. Add individual error tracking in batch operations
6. Broadcast consistent events for all move types
7. Implement proper batch database operations instead of sequential individual ops
