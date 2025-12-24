# Sync Issue Investigation Plan

**Overall Progress:** `50%`

## Summary

Investigating a sync issue where:

- Note content differs between two machines
- Files are confirmed same size on both machines
- "Reload from CRDT Logs" doesn't fix the issue on Machine B

## Root Cause: CONFIRMED - refCount > 1 Bug

**The bug is in `handleReloadFromCRDTLogs`:**

1. `loadNote()` always increments `refCount`, even if doc is already loaded
2. Multiple IPC handlers call `loadNote()` without corresponding `unloadNote()` (e.g., `getMetadata`, `applyUpdate`, comment handlers, etc.)
3. `handleReloadFromCRDTLogs` calls `unloadNote()` once, which only decrements refCount
4. If `refCount > 1`, the document stays in memory with **stale data**
5. The subsequent `loadNote()` call sees the doc is already in `this.documents` and returns the stale doc!

**Evidence:**

- Files are same size on both machines (confirmed)
- "Reload from CRDT Logs" doesn't help (because doc isn't actually reloaded)
- The CRDT logs ARE complete when parsed offline (verified with my script)

## Tasks

### Phase 1: Fix refCount Bug (PRIORITY - CONFIRMED BUG) ✅ COMPLETE

- [x] 🟩 **Step 1.1: Add forceUnloadNote method**
  - [x] 🟩 Add `forceUnloadNote(noteId)` to CRDTManager that ignores refCount
  - [x] 🟩 Properly clean up observer, destroy snapshot
  - [x] 🟩 Add test for force unload

- [x] 🟩 **Step 1.2: Fix handleReloadFromCRDTLogs**
  - [x] 🟩 Use forceUnloadNote instead of unloadNote
  - [x] 🟩 Add tests for unloadNote refCount behavior
  - [x] 🟩 CI passed - all tests green

### Phase 2: Add Diagnostic Tooling

- [ ] 🟥 **Step 2.1: Create CRDT Log Analyzer**
  - [ ] 🟥 Add IPC handler to analyze logs for a note
  - [ ] 🟥 Parse all log files and return: file list, sizes, sequence ranges, gaps
  - [ ] 🟥 Reconstruct document and return content preview
  - [ ] 🟥 Compare with current in-memory state

- [ ] 🟥 **Step 2.2: Add to Storage Inspector or Note Info**
  - [ ] 🟥 Add "Analyze CRDT Logs" section to Note Info dialog
  - [ ] 🟥 Display sequence ranges per instance
  - [ ] 🟥 Show reconstructed content vs current content
  - [ ] 🟥 Show refCount for the note

### Phase 3: Improve Live Sync (Follow-up)

- [ ] 🟥 **Step 3.1: Investigate why live sync stopped working**
  - [ ] 🟥 Check activity log polling intervals
  - [ ] 🟥 Verify CRDT log verification before reload
  - [ ] 🟥 Add better sync status indicators in UI

## Current Status

**Phase 1 COMPLETE** - The refCount bug is fixed:

- Added `forceUnloadNote()` method to CRDTManager
- Updated both `handleReloadFromCRDTLogs` implementations to use it
- All tests pass, CI green

**Ready for commit.** After commit, user should test on Machine B to verify fix works.

Phase 2 (diagnostic tooling) and Phase 3 (live sync improvements) are optional follow-ups.
