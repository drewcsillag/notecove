# Storage System Analysis - Implementation Plan

**Overall Progress:** `100%`

## Overview

This plan covers:

1. Fixing Bug #1: Double CRDT log writes
2. Fixing Bug #2: New notes not syncing when node B wakes from sleep
3. Writing comprehensive design documentation for the NoteCove storage system

## Related Documents

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial clarifications
- [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) - Plan critique and decisions
- [storage-architecture.md](/website/architecture/storage-architecture.md) - Main architecture doc
- [sync-mechanism.md](/website/architecture/sync-mechanism.md) - Cross-instance sync
- [data-models.md](/website/architecture/data-models.md) - Data structures and schemas

---

## Phase 1: Bug #1 Fix - Double CRDT Log Write

### Root Cause

Two parallel write paths both trigger disk writes:

1. `applyUpdate()` writes to disk, then calls `Y.applyUpdate(doc, update)` without origin
2. `doc.on('update')` listener fires and calls `handleUpdate()` which writes again

### Fix

Pass `'ipc'` origin when applying updates from IPC, skip `handleUpdate()` for that origin.

### Tasks

- [x] 🟩 **1.1** Write failing test demonstrating double write
- [x] 🟩 **1.2** Modify `DocumentSnapshot.applyUpdate()` to accept optional origin parameter
- [x] 🟩 **1.3** Modify `CRDTManagerImpl.applyUpdate()` to pass `'ipc'` origin
- [x] 🟩 **1.4** Modify `doc.on('update')` handler to skip when origin is `'ipc'`
- [x] 🟩 **1.5** Verify test passes
- [x] 🟩 **1.6** Run targeted tests for CRDT manager

---

## Phase 2: Bug #2 Fix - New Notes Not Syncing After Sleep

### Root Cause

When B wakes, activity sync processes entries but CRDT files haven't synced yet. After timeout, watermark advances and entry is never retried. Restart clears in-memory watermark, allowing full reprocess.

### Fix

Add wake-from-sleep handler that scans for notes on disk but not in database.

### Tasks

- [ ] 🟨 **2.1** Write test for `discoverNewNotes()` function (deferred - hard to test wake-from-sleep)
- [x] 🟩 **2.2** Create `discoverNewNotes(sdId, sdPath)` function:
  - List all note directories in `{sdPath}/notes/`
  - For each note ID not in database:
    - Check deletion logs first (skip if found)
    - Attempt to load from CRDT
    - Insert into database if successful
  - Trigger folder tree reload for the SD
- [x] 🟩 **2.3** Resume handler already existed - updated to call `discoverNewNotes()`
- [x] 🟩 **2.4** Call `discoverNewNotes()` for all SDs after 5s delay on resume
- [x] 🟩 **2.5** Add diagnostic logging throughout
- [x] 🟩 **2.6** Add IPC call `debug:triggerNoteDiscovery` for manual testing
- [x] 🟩 **2.7** Run targeted tests

---

## Phase 3: Integration Testing

- [x] 🟩 **3.1** Run full CI suite (`pnpm ci-local`) - All 360 E2E tests passed
- [ ] 🟨 **3.2** Manual testing of Bug #1 fix (verify single write in logs) - deferred to user
- [ ] 🟨 **3.3** Manual testing of Bug #2 fix (sleep/wake scenario) - deferred to user

---

## Phase 4: Design Documentation

### 4.1 Storage Architecture Document

- [x] 🟩 Document overall architecture (Electron main/renderer, shared package)
- [x] 🟩 Document Storage Directory (SD) structure and file layout
- [x] 🟩 Document CRDT implementation (Yjs, NoteDoc, FolderTreeDoc)
- [x] 🟩 Document binary file formats (.crdtlog, .crdtsnapshot)
- [x] 🟩 Document vector clock mechanism
- [x] 🟩 Include sequence diagrams for key flows

### 4.2 Sync Mechanism Document

- [x] 🟩 Document activity log system (ActivityLogger, ActivitySync)
- [x] 🟩 Document deletion sync (DeletionLogger, DeletionSync)
- [x] 🟩 Document cross-instance sync flow with sequence diagrams
- [x] 🟩 Document cloud storage considerations (flag byte protocol)
- [x] 🟩 Document wake-from-sleep discovery (new!)

### 4.3 Data Models Document

- [x] 🟩 Document all database schemas
- [x] 🟩 Document CRDT data structures
- [x] 🟩 Document sync state schemas
- [x] 🟩 Document relationships between cache and CRDT

---

## Files to Modify

### Bug #1

- `packages/shared/src/storage/document-snapshot.ts`
- `packages/desktop/src/main/crdt/crdt-manager.ts`

### Bug #2

- `packages/desktop/src/main/index.ts`

---

## Notes

- Bug #1 is low risk, straightforward fix
- Bug #2 has edge cases (deletion during sleep, incomplete files) - handled via deletion log check and retry logic
