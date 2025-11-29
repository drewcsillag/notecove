# Fuzz Test Infrastructure - Findings & Issues

**Date**: 2025-11-06
**Context**: Built comprehensive fuzz testing infrastructure to test multi-instance CRDT synchronization under sloppy file sync conditions (simulating Google Drive/iCloud)

## What We Built

Created a complete fuzz testing system in `packages/shared/src/__manual__/`:

1. **EventLog** (`event-log.ts`) - JSONL format event recording for replay/debugging
2. **SyncDaemon** (`sync-daemon.ts`) - Simulates sloppy file sync with delays, out-of-order, batching, partial writes
3. **TestInstance** (`test-instance.ts`) - Wraps real UpdateManager/ActivityLogger/ActivitySync to simulate running app
4. **Validation** (`validation.ts`) - Validates instances converged to identical CRDT state
5. **TimelineVisualizer** (`timeline-visualizer.ts`) - ASCII + interactive HTML timeline visualization
6. **Test Runner** (`sync-fuzz-test.ts`) - 5 built-in scenarios from quick-smoke (30s) to chaos (5min+)
7. **Unit Tests** (`__tests__/event-log.test.ts`) - Tests for the test infrastructure
8. **README** (`README.md`) - Complete documentation

## Critical Issues Discovered

### Issue #1: Google Drive Rename → Trash Problem

**Location**: `packages/desktop/src/main/storage/node-fs-adapter.ts:44-48`

**Current Code**:

```typescript
// Atomic write: write to temp file, then rename
const tempPath = `${path}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 9)}`;
await fs.writeFile(tempPath, data);
await fs.rename(tempPath, path);
```

**Problem**:

- Google Drive treats `fs.rename()` as DELETE (temp file) + CREATE (final file)
- Deleted temp files go to Google Drive trash folder
- User's trash folder fills up with `.tmp.*` files
- Generates unnecessary sync traffic (2 events per file write)

**Impact**:

- Annoying UX (trash folder constantly has items)
- Wasted bandwidth syncing deletions
- Potential data loss if trash is auto-emptied

**Solution**: Replace with flag byte approach (see below)

---

### Issue #2: Partial Write Race Condition in ActivitySync

**Location**: CRDT update file reads in `ActivitySync` and `UpdateManager.readNoteUpdates()`

**Error Observed**:

```
Error: Unexpected end of array
    at Object.create (lib0@0.2.114/node_modules/lib0/dist/error-8582d695.cjs:14:21)
```

**Reproduction**:

1. Instance 1 writes update file: `test-instance-1_note-123_timestamp-0.yjson`
2. Google Drive/iCloud syncs file to Instance 2 (but only ~60% before pausing)
3. `ActivitySync` on Instance 2 sees new file and tries to read it
4. Yjs decoder fails because file is incomplete/corrupted

**Root Cause**:

- File sync services don't guarantee atomic file delivery
- Files can be synced partially, then completed later (seconds to minutes)
- ActivitySync has no way to know if a `.yjson` file is complete or still being written

**Current Behavior**:

- ActivitySync logs timeout warning but doesn't crash
- However, if it tries to read partial file, Yjs throws error
- No retry logic for corrupted reads

**Impact**:

- **HIGH** - This is exactly the scenario the fuzz test was designed to catch!
- Can cause data corruption if partial file is read and applied
- May cause sync to stall if file is never re-attempted

**Solution**: Flag byte approach (see below)

---

### Issue #3: File Watcher Queue Explosion

**Location**: Fuzz test infrastructure only - `packages/shared/src/__manual__/sync-daemon.ts`

**Problem**:

- Using `fs.watch()` to monitor directories for changes
- macOS `fs.watch()` fires **multiple events per file write**:
  - File created event
  - Data written event (possibly multiple)
  - File closed event
  - Metadata change event
- With partial writes enabled (30% chance), each file written **twice**:
  - Partial content (30-70%)
  - Complete content (100%)

**Observed Metrics** (quick-smoke test, 30 seconds):

- 60 `.yjson` files created
- **41,958 queued sync operations** = ~700 queues per file!
- Event log grew to **721MB** (should be <10MB)

**Why So Many Events**:

- Base: 60 files × 4 events/file = 240 events minimum
- Partial writes: 60 files × 30% × 2 writes = 36 extra writes × 4 = 144 events
- Total expected: ~384 events
- **Actual: 41,958 events** = 109x more than expected!

**Hypothesis**:

- File writes aren't atomic at OS level
- Write buffer flushes trigger multiple events
- Directory modification events also firing
- Concurrent writes from both instances creating race conditions

**Attempted Fixes** (all in fuzz test code):

1. ✅ mtimeMs-based debouncing (only queue if mtime changed)
2. ✅ Max queue size limit (1000 items)
3. ✅ Event log sampling (only log 10% of sync-queued events)
4. ⚠️ Still causes test to hang waiting for queue to drain

**Impact**:

- Low (fuzz test infrastructure only)
- Could switch to polling instead of fs.watch()
- Or accept that fs.watch() is too sensitive and use longer debounce

---

## Proposed Solution: Flag Byte Approach

### Overview

Prepend a 1-byte flag to every `.yjson` update file:

- `0x00` = File still being written (readers should skip)
- `0x01` = File complete and ready to read
- Other values = Invalid/corrupted file

### Implementation

**Write Operation** (in `node-fs-adapter.ts`):

```typescript
async writeFile(path: string, data: Uint8Array): Promise<void> {
  // Prepare data with flag byte
  const flaggedData = new Uint8Array(1 + data.length);
  flaggedData[0] = 0x00; // Not ready
  flaggedData.set(data, 1);

  // Write all data with "not ready" flag
  const fd = await fs.open(path, 'w');
  await fd.write(flaggedData, 0, flaggedData.length, 0);
  await fd.sync(); // Force data to disk

  // Atomically flip flag to "ready"
  const readyFlag = new Uint8Array([0x01]);
  await fd.write(readyFlag, 0, 1, 0); // Overwrite byte 0
  await fd.sync(); // Force flag to disk
  await fd.close();
}
```

**Read Operation** (in `UpdateManager.readNoteUpdates()` and `ActivitySync`):

```typescript
async readFile(path: string): Promise<Uint8Array> {
  const data = await fs.readFile(path);

  if (data.length === 0) {
    throw new Error('Empty file');
  }

  // Check flag byte
  if (data[0] === 0x00) {
    // Still being written - caller should retry later
    return null; // or throw PartialFileError
  }

  if (data[0] !== 0x01) {
    throw new Error(`Invalid file format (flag byte: 0x${data[0].toString(16)})`);
  }

  // Return actual data (skip flag byte)
  return data.subarray(1);
}
```

### Migration Required

All existing `.yjson` files need flag byte prepended:

```typescript
// Migration tool pseudocode
async function migrateUpdateFiles(sdPath: string) {
  const files = await findAllYjsonFiles(sdPath);

  for (const filePath of files) {
    const data = await fs.readFile(filePath);
    const flaggedData = new Uint8Array(1 + data.length);
    flaggedData[0] = 0x01; // Mark as ready
    flaggedData.set(data, 1);

    // Write atomically (using temp file approach one last time)
    const tempPath = `${filePath}.migration.tmp`;
    await fs.writeFile(tempPath, flaggedData);
    await fs.rename(tempPath, filePath);
  }
}
```

### Benefits

✅ **No renames** - Google Drive doesn't fill trash
✅ **Atomic ready flag** - Readers can detect incomplete files
✅ **Works with all file sync services** - iCloud, Dropbox, etc.
✅ **Small overhead** - Only 1 byte per file
✅ **Backward compatible** with migration tool

### Tradeoffs

⚠️ **Breaking change** - Old code can't read new files (and vice versa)
⚠️ **Requires migration** - One-time operation per SD
⚠️ **Slightly slower writes** - 2 fsyncs instead of 1 rename
⚠️ **1 byte overhead** - 60-byte file becomes 61 bytes

---

## Test Infrastructure Status

### What Works

✅ All 7 components built and compiled
✅ Test instances create/edit/delete notes
✅ Sync daemon copies files between instances
✅ Both instances sync and reload notes
✅ Event logging captures all operations
✅ Validation compares CRDT states
✅ HTML timeline generated

### What's Broken

❌ **fs.watch() queue explosion** - 41K+ queued syncs for 60 files
❌ **Test hangs on waitForPendingSyncs()** - 60s timeout not enough
❌ **Partial file reads cause Yjs errors** - Expected! This is what we wanted to find

### Scenarios Implemented

1. **quick-smoke** (30s) - 5 creates, 10 edits per instance - ✅ Runs but hangs at end
2. **rapid-same-note** (60s) - Both instances edit same note 50x - ⏸️ Not tested yet
3. **many-notes** (120s) - 20 creates, 40 edits + GC every 30s - ⏸️ Not tested yet
4. **half-duplex-test** (90s) - One-way sync only - ⏸️ Not tested yet
5. **chaos** (300s) - All operations + GC + snapshots - ⏸️ Not tested yet

---

## Files Changed/Created

### New Files (Fuzz Test Infrastructure)

- `packages/shared/src/__manual__/event-log.ts`
- `packages/shared/src/__manual__/sync-daemon.ts`
- `packages/shared/src/__manual__/test-instance.ts`
- `packages/shared/src/__manual__/validation.ts`
- `packages/shared/src/__manual__/timeline-visualizer.ts`
- `packages/shared/src/__manual__/sync-fuzz-test.ts`
- `packages/shared/src/__manual__/__tests__/event-log.test.ts`
- `packages/shared/src/__manual__/README.md`

### Files To Modify (Flag Byte Implementation)

- `packages/desktop/src/main/storage/node-fs-adapter.ts` - writeFile/readFile
- `packages/shared/src/storage/update-manager.ts` - readNoteUpdates
- `packages/shared/src/storage/activity-sync.ts` - file read error handling
- All tests that read `.yjson` files

### Files To Create (Flag Byte Migration)

- Migration tool script (can be CLI or part of app startup)
- Tests for migration tool
- Documentation for users

---

## Next Steps

### Immediate (Flag Byte Implementation)

1. Implement flag byte write in `node-fs-adapter.ts`
2. Implement flag byte read in `node-fs-adapter.ts`
3. Update `UpdateManager.readNoteUpdates()` to handle null return (incomplete file)
4. Update `ActivitySync` to retry on incomplete files
5. Create migration tool
6. Update all existing tests
7. Test migration tool on real SD
8. Run fuzz tests again (should fix partial write errors)

### Future (Fuzz Test Improvements)

1. Replace `fs.watch()` with periodic polling (every 500ms)
2. Add configurable debounce settings
3. Add test scenario validation (ensure operations completed)
4. Add automatic retry logic for incomplete files in fuzz test
5. Run longer chaos tests (20+ minutes)

---

## Open Questions

1. **Should migration be automatic?** (run on app startup if old format detected)
2. **Should we support both formats?** (for transition period)
3. **What if migration fails mid-way?** (some files migrated, some not)
4. **Should flag byte be in UpdateFormat spec?** (document as part of file format)
5. **Do we need versioning?** (flag byte + version byte for future changes)

---

## Lessons Learned

1. **Fuzz testing works!** Found real race condition on first run
2. **Google Drive behavior matters** Renames → trash is a real UX issue
3. **fs.watch() is too sensitive** Need debouncing or polling instead
4. **File sync is NOT atomic** Must design for partial/delayed delivery
5. **Test infrastructure is complex** Building a good test harness is ~50% of the work
