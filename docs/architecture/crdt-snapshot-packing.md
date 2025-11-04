# CRDT Snapshot and Packing System

## Overview

This document describes the snapshot and packing optimization system for CRDT update files. The goal is to reduce both the number of files on disk and the time required for cold-start document loading.

## Problem Statement

### Current System

**File Format:** `<instance-id>_<note-id>_<timestamp>-<random>.yjson`

Each change to a document creates a new update file. For a brief note with active editing:

- **File count:** 2,000+ individual update files
- **Cold load time:** 3-5 seconds
- **Operations:** Thousands of file reads + thousands of Y.applyUpdate() calls

### Performance Issues

1. **File System Overhead:** Reading thousands of small files is slow (especially on networked drives like Google Drive)
2. **Processing Time:** Each Y.applyUpdate() call has overhead, even for small updates
3. **Storage Inefficiency:** Each file has filesystem overhead (metadata, minimum block size)
4. **Sync Inefficiency:** Cloud sync services struggle with thousands of tiny files

## Solution: Hybrid Snapshot + Packing

We implement a three-tier system:

1. **Snapshots:** Full document state with vector clock (every ~1000 updates)
2. **Packs:** Batches of 100 updates per instance (between snapshots)
3. **Recent Updates:** Last 50 unpacked updates (for fast incremental sync)

## Architecture

### File Structure

```
notes/<note-id>/
  snapshots/
    snapshot_2500_instance-abc.yjson
    snapshot_4800_instance-xyz.yjson  ← newest (selected)
  packs/
    instance-abc_pack_2501-2600.yjson
    instance-xyz_pack_3000-3100.yjson
  updates/
    instance-abc_<timestamp>-4799.yjson
    instance-abc_<timestamp>-4800.yjson
    instance-xyz_<timestamp>-4801.yjson
```

### Snapshot Format

**Filename:** `snapshot_<total-changes>_<instance-id>.yjson`

**File Contents:**

```typescript
{
  version: 1,
  noteId: "note-xyz",
  timestamp: 1699028345123,
  totalChanges: 4800,

  // Full document state (Yjs serialized)
  documentState: Uint8Array,

  // Vector clock: highest sequence seen from each instance
  maxSequences: {
    "instance-abc": 1250,
    "instance-xyz": 3042,
    "instance-def": 897
  }
}
```

**Key Fields:**

- `totalChanges`: Total number of updates incorporated from all instances
  - Used for snapshot selection (pick highest)
  - **Encoded in filename** for self-documentation
- `maxSequences`: Per-instance vector clock
  - Instance ID → highest sequence number incorporated from that instance
  - Used to determine which update files to skip vs. apply
- `documentState`: Full Yjs document state (Y.encodeStateAsUpdate())
  - Single binary blob representing entire document
- `timestamp`: When snapshot was created (metadata only)
- `instance-id` (in filename): Disambiguates if two snapshots have same totalChanges

**Design Principle: Self-Describing Filenames**

The `totalChanges` count is **encoded in the filename**, not assumed by code.

**Why This Matters:**

1. **Tunable frequency:** Snapshot trigger can change (every 500 → 1000 → 2000 updates) without code changes
2. **Re-snapshotting:** Can create new snapshots with higher totalChanges to supersede old ones
3. **Variable triggers:** Different notes can snapshot at different frequencies
4. **Selection algorithm:** Always pick highest totalChanges (most comprehensive snapshot)

**Example Evolution:**

```
# Early snapshots (frequent):
snapshot_500_instance-A.yjson     (500 updates incorporated)
snapshot_1000_instance-B.yjson    (1000 updates incorporated)

# After tuning (less frequent):
snapshot_2500_instance-C.yjson    (2500 updates incorporated)

# Re-snapshotting (consolidation):
snapshot_5000_instance-A.yjson    (replaces all above, most comprehensive)
```

**Code Implementation:**

```typescript
// GOOD: Parse totalChanges from filename, select highest
const snapshots = listSnapshotFiles();
const selected = snapshots.sort(
  (a, b) => b.totalChanges - a.totalChanges // Highest first
)[0];

// BAD: Assume snapshots every 1000 updates
const SNAPSHOT_INTERVAL = 1000; // ❌ Hard-coded assumption
```

### Pack Format

**Filename:** `<instance-id>_pack_<start-seq>-<end-seq>.yjson`

Example: `instance-abc_pack_2501-2600.yjson`

**File Contents:**

```typescript
{
  version: 1,
  instanceId: "instance-abc",
  noteId: "note-xyz",
  sequenceRange: [2501, 2600],
  updates: [
    { seq: 2501, timestamp: 1699028100000, data: Uint8Array },
    { seq: 2502, timestamp: 1699028100123, data: Uint8Array },
    // ... 98 more
    { seq: 2600, timestamp: 1699028345000, data: Uint8Array }
  ]
}
```

**Key Properties:**

- Packs are per-instance (maintains strict sequence ordering)
- Sequence ranges are contiguous (no gaps)
- Updates stored in order within pack
- Pack size is variable (initially 50-100, but tunable)

**Design Principle: Self-Describing Filenames**

The sequence range is **encoded in the filename** (`<start-seq>-<end-seq>`), not assumed by code.

**Why This Matters:**

1. **Tunable parameters:** Pack size can change over time (50 → 100 → 200) without code changes
2. **Repacking:** Can consolidate packs (merge `pack_1-50` + `pack_51-100` → `pack_1-100`)
3. **Variable sizes:** Different instances or notes can use different pack sizes
4. **Forward compatibility:** Code reads actual range from filename, works with any size

**Example Evolution:**

```
# Early version (small packs):
instance-abc_pack_1-50.yjson      (50 updates)
instance-abc_pack_51-100.yjson    (50 updates)

# After tuning (larger packs):
instance-abc_pack_101-300.yjson   (200 updates)

# After repacking (consolidation):
instance-abc_pack_1-300.yjson     (replaces all above)
```

**Code Implementation:**

```typescript
// GOOD: Parse range from filename
const [startSeq, endSeq] = parsePackFilename(filename);
for (const update of pack.updates) {
  if (update.seq >= startSeq && update.seq <= endSeq) {
    applyUpdate(update);
  }
}

// BAD: Assume fixed pack size
const PACK_SIZE = 100; // ❌ Hard-coded assumption
```

### Update File Format (Unpacked)

**Filename:** `<instance-id>_<timestamp>-<seq>.yjson`

Example: `instance-abc_1699028345123-4799.yjson`

**File Contents:** Raw Yjs update (Uint8Array)

**Key Properties:**

- Only recent updates remain unpacked (last 50-100)
- Sequence number included in filename for ordering
- Timestamp for human readability/debugging

## Algorithms

### Cold Load Algorithm

```
1. Scan snapshots/ directory
2. Parse filenames to extract totalChanges
3. Select snapshot with highest totalChanges
4. Load and apply snapshot:
   - Y.applyUpdate(doc, snapshot.documentState)
   - Store snapshot.maxSequences for filtering

5. Scan packs/ directory
6. For each pack:
   - If pack.sequenceRange overlaps with (maxSequences[instance] + 1, ∞):
     - Load pack
     - For each update in pack:
       - If update.seq > maxSequences[pack.instanceId]:
         - Apply update
       - Else: Skip (already in snapshot)

7. Scan updates/ directory
8. For each update file:
   - Parse filename to get instance-id and sequence
   - If seq > maxSequences[instance-id]:
     - Load and apply update
   - Else: Skip (already in snapshot)

9. Document is now fully loaded
```

**Expected Performance:**

- Load 1 snapshot file: ~10-50ms
- Load 5-10 pack files: ~50-100ms
- Load ~50 update files: ~50-100ms
- **Total: 100-250ms** (vs. 3-5 seconds before)

### Snapshot Creation Algorithm

**Triggers:**

- Document close (if ≥100 updates since last snapshot)
- Background job (periodic scan for documents with ≥500 updates since last snapshot)
- Manual trigger (future: user-initiated)

**Process:**

```
1. Calculate totalChanges:
   - Count all update files + entries in all packs + snapshots
   - OR maintain running counter (more efficient)

2. Build maxSequences vector clock:
   - For each instance that has written updates:
     - maxSequences[instance] = highest sequence seen

3. Serialize document state:
   - documentState = Y.encodeStateAsUpdate(doc)

4. Write snapshot file:
   - filename = snapshot_<totalChanges>_<this-instance-id>.yjson
   - Write to snapshots/ directory

5. Update metadata:
   - Record "last snapshot at totalChanges=X"
   - Used to determine when next snapshot is needed
```

**Conflict Handling:**

If two instances create snapshots simultaneously with same totalChanges:

- Both are valid (same totalChanges, different instance-id in filename)
- Load algorithm picks one arbitrarily (deterministic: lexicographic by instance-id)
- No data loss: Both snapshots represent same document state (CRDT convergence)

### Packing Algorithm

**Triggers:**

- Background job runs every 5 minutes
- Scans for instances with ≥100 unpacked updates older than 5 minutes

**Process:**

```
1. Group update files by instance-id

2. For each instance:
   - Sort updates by sequence number
   - Verify contiguous sequence (no gaps)
   - If gap found: Only pack up to the gap

3. Group into packs of 50-100 updates:
   - startSeq = first update sequence
   - endSeq = last update sequence (50-100 later)

4. For each pack:
   - Load all update files in range
   - Write pack file: instance_pack_<start>-<end>.yjson
   - Delete original update files (atomic: write then delete)

5. Keep last 50 updates unpacked per instance:
   - Don't pack the most recent 50 updates
   - Allows fast incremental sync without unpacking
```

### Garbage Collection Algorithm

**Triggers:**

- Background job runs every 30 minutes
- After snapshot creation
- When disk space is low (future)

**Process:**

```
1. List all snapshots, sort by totalChanges descending

2. Keep newest 2-3 snapshots:
   - Safety: If newest snapshot corrupts, fallback exists
   - Optimization: Different instances can use different snapshots

3. For remaining (old) snapshots:
   - Delete snapshot file

4. Determine oldest kept snapshot's maxSequences:
   - oldestMaxSeq = oldest_kept_snapshot.maxSequences

5. Delete packs fully covered by oldest snapshot:
   - For each pack:
     - If pack.endSeq <= oldestMaxSeq[pack.instanceId]:
       - Delete pack (fully incorporated into snapshot)

6. Delete update files fully covered by oldest snapshot:
   - For each update:
     - If update.seq <= oldestMaxSeq[update.instanceId]:
       - Delete update (fully incorporated into snapshot)

7. Keep minimum history:
   - Even if covered by snapshot, keep last 24 hours of updates
   - Safety: Allows debugging recent changes
   - Configurable retention period
```

## Sequence Number Management

Each instance maintains a **monotonically increasing sequence counter** for updates it writes.

### Sequence Counter Storage

**Location:** Per-instance, per-document metadata

**Options:**

1. **In-memory + persisted to special file:** `<instance-id>_sequence_<note-id>.json`
   - Fast access
   - Survives crashes (written after each update)

2. **Parse from filenames on startup:**
   - Scan update files for this instance
   - maxSeq = max(all sequences found)
   - nextSeq = maxSeq + 1
   - No extra files needed

**Recommendation:** Option 2 (parse from filenames)

- Simpler (no extra files)
- Self-healing (if metadata lost, can reconstruct)
- Slightly slower startup (negligible: already scanning files)

### Sequence Number in Filenames

**Current format:** `<instance-id>_<timestamp>-<random>.yjson`

**New format:** `<instance-id>_<timestamp>-<seq>.yjson`

**Migration:** Both formats coexist during transition

- Parser handles both: `timestamp-random` (old) and `timestamp-seq` (new)
- Old files gradually get packed/deleted via GC
- No data loss

### Handling Gaps

**Scenario:** Instance crashes, sequence 1050 was never written, next is 1051.

**Packing behavior:**

- Only pack contiguous sequences: 1-1049 (stop at gap)
- Leave 1051+ unpacked until gap is resolved or timed out
- Timeout: After 24 hours, assume gap is permanent, treat 1051 as valid continuation

**Rationale:**

- Gaps should be rare (only crashes during write)
- Preserves data integrity (don't skip updates)
- Timeout prevents indefinite blocking

### Handling Gaps in Snapshot Creation

**Scenario:** Instance C wants to create snapshot, but Instance B has a gap in its sequences.

**Example:**

- Instance B's files visible to Instance C: 1-50 ✅, **51 ❌ (missing - laptop rebooted before sync)**, 52-80 ✅

**Snapshot Behavior: Record Highest Contiguous Sequence**

Instance C creates snapshot with:

```typescript
maxSequences: {
  "instance-A": 150,  // Complete
  "instance-B": 50,   // Stop at gap (don't include 52-80 yet)
  "instance-C": 200   // Complete
}
```

**Key Decision: Don't Block Snapshot Creation on Gaps**

- Snapshot captures "what we know so far" (contiguous sequences only)
- Missing updates (seq 51, 52-80) will be loaded as regular updates during cold load
- When seq 51 eventually syncs (hours/days later), everything works correctly

**Cold Load After Gap Is Filled:**

1. Load snapshot (has Instance B up to seq 50)
2. Load update files for Instance B:
   - seq 51 (51 > 50 → apply) ✅
   - seq 52-80 (52-80 > 50 → apply) ✅
3. Document is now fully up-to-date

**Why This Works:**

- Snapshots don't need to be "complete" - just consistent with visible state
- CRDT convergence guarantees correctness regardless of update order
- Gap eventually gets filled (or timeout assumes permanent loss)
- No indefinite blocking on snapshot creation

**Alternative (Not Chosen):**

- Block snapshot creation until all gaps filled
- Problem: Could wait hours/days if Instance B is offline
- Result: Snapshot creation stalls indefinitely (bad UX)

**Conclusion:** Snapshots record highest **contiguous** sequence per instance, ignoring gaps. Missing updates are applied during cold load. This prevents indefinite blocking while maintaining correctness.

## Multi-Instance Coordination

### Snapshot Selection (Multiple Instances)

**Scenario:** Two instances create snapshots with same totalChanges value.

**Filenames:**

- Instance A: `snapshot_4800_instance-abc.yjson`
- Instance B: `snapshot_4800_instance-xyz.yjson`

**Selection Algorithm:**

- Sort filenames lexicographically
- Pick first (deterministic): `snapshot_4800_instance-abc.yjson`

**Result:**

- Both snapshots are valid (CRDT convergence guarantees same state)
- Picking one arbitrarily is safe
- No coordination needed between instances

### Concurrent Packing

**Scenario:** Two instances try to pack same update files.

**Critical Constraint: Each Instance Only Packs Its Own Updates**

**Reasoning:**
Each instance MUST only pack updates it wrote itself (identified by instance-id in filename). This is essential because:

1. **Filesystem Replication Lag:**
   - Instance B writes: seq 100, 101, 102, 103, 104, 105
   - Files sync to Google Drive/iCloud with latency
   - Instance A might see: 100, 101, 103, 105 (102, 104 not synced yet)
   - Instance A detects false "gap" at 102
   - Result: Only packs 100-101, leaves 103+ unpacked (inefficient)

2. **Local Filesystem Is Complete:**
   - Instance A wrote: seq 200, 201, 202, 203, 204
   - All files on Instance A's local disk immediately
   - No replication lag for own files
   - Can pack confidently: pack(200-250) with no false gaps

3. **Natural Partitioning:**
   - Instance A packs: `instance-A_*.yjson` files
   - Instance B packs: `instance-B_*.yjson` files
   - No conflicts, no coordination needed

**Implementation:**

```typescript
// Packing job filters by instance ID
const myInstanceId = getInstanceId();
const updateFiles = listUpdateFiles(noteId).filter(
  (file) => file.instanceId === myInstanceId // Only pack own updates
);
```

**Alternative Approaches (Not Recommended):**

1. **Exclusive file locks:** Complex, error-prone
2. **Atomic write-then-delete:** Doesn't solve replication lag problem
3. **Cross-instance packing:** Broken by replication lag (as described above)

**Conclusion:** Instance-specific packing is the only reliable approach given eventual-consistency filesystem semantics (Google Drive, iCloud, Dropbox, etc.).

### Concurrent Snapshot Creation

**Scenario:** Two instances create snapshots simultaneously.

**Behavior:**

- Both snapshots created successfully
- Filenames differ by instance-id
- Load algorithm picks one (deterministic)
- GC eventually deletes older one (when newer snapshot exists)

**Optimization:**

- Record "last snapshot totalChanges" in shared metadata file
- Instances check before creating snapshot
- Reduces duplicate snapshots (but not harmful if they occur)

## Implementation Phases

### Phase 1: Add Snapshots (Foundational)

**Goals:**

- Implement snapshot creation on document close
- Implement snapshot loading on cold start
- Fallback to update files if no snapshot

**Files Modified:**

- `packages/shared/src/crdt/snapshot-format.ts` (new)
- `packages/shared/src/storage/update-manager.ts`
- `packages/desktop/src/main/crdt/crdt-manager.ts`

**Success Metrics:**

- Cold load time reduced by 80-90%
- No data loss
- All tests pass

### Phase 2: Add Packing (File Count Reduction)

**Goals:**

- Background job to pack old updates
- Load packs on cold start
- Keep last 50 updates unpacked

**Files Modified:**

- `packages/shared/src/crdt/pack-format.ts` (new)
- `packages/shared/src/storage/update-manager.ts`
- `packages/desktop/src/main/background-jobs/packing-job.ts` (new)

**Success Metrics:**

- File count reduced by 90-95%
- Cloud sync faster (fewer files)
- All tests pass

### Phase 3: Add Garbage Collection (Disk Space)

**Goals:**

- Delete old snapshots (keep last 2-3)
- Delete packs/updates incorporated into snapshots
- Configurable retention period

**Files Modified:**

- `packages/desktop/src/main/background-jobs/gc-job.ts` (new)
- `packages/shared/src/storage/update-manager.ts`

**Success Metrics:**

- Disk usage stable (doesn't grow unbounded)
- Old data properly cleaned up
- Retention policy respected

### Phase 4: Optimizations and Monitoring

**Goals:**

- Add metrics/telemetry (file counts, load times)
- Optimize snapshot/pack triggers
- Handle edge cases (corrupted files, gaps, conflicts)

**Files Modified:**

- All previous files (optimizations)
- `packages/desktop/src/main/telemetry/crdt-metrics.ts` (new)

## Error Handling

### Corrupted Snapshot

**Detection:** Y.applyUpdate() throws error

**Recovery:**

1. Log error with snapshot filename
2. Try next-newest snapshot
3. If all snapshots fail: Fall back to loading all update files
4. On successful load: Create new snapshot to replace corrupted one

### Missing Update Files

**Detection:** Sequence gap in update files for an instance

**Recovery:**

1. Load up to the gap (don't skip)
2. Load updates after gap (assuming gap is permanent)
3. Log warning about gap (for debugging)
4. After 24 hours: Treat gap as permanent, continue normally

### Filesystem Errors (Google Drive)

**Scenario:** Google Drive not synced, files missing temporarily

**Mitigation:**

1. Retry file reads (exponential backoff)
2. Cache loaded documents longer (don't unload aggressively)
3. Graceful degradation: If can't load, show error but don't crash

## Testing Strategy

### Unit Tests

- Snapshot creation and loading
- Pack creation and loading
- Vector clock arithmetic
- Filename parsing
- Sequence number management

### Integration Tests

- Cold load with snapshots + packs + updates
- Snapshot creation during document edit
- Packing background job
- GC background job
- Multi-instance snapshot selection

### E2E Tests

- Create document, edit heavily, close, reopen (verify fast load)
- Multiple instances editing same document (verify sync)
- Crash during snapshot creation (verify recovery)
- Corruption scenarios (verify fallback)

### Performance Tests

- Benchmark cold load time: before vs. after
- Benchmark file count: before vs. after
- Benchmark disk usage over time
- Benchmark sync time (with Google Drive)

## Metrics and Observability

### Key Metrics

- **Cold load time:** ms to load document
- **File count per note:** total files in notes/<note-id>/
- **Snapshot creation time:** ms to create snapshot
- **Pack creation time:** ms to pack N updates
- **GC deleted file count:** files deleted per GC run

### Logging

- Snapshot creation: log totalChanges, file size, duration
- Snapshot loading: log which snapshot selected, load duration
- Pack creation: log instance-id, sequence range, file count
- GC: log deleted file count, disk space freed
- Errors: log corruption, gaps, filesystem errors

## Future Enhancements

### Repacking and Re-snapshotting

**Current:** Packs and snapshots created once, never consolidated

**Future:** Background job to consolidate fragmented files

**Repacking (Pack Consolidation):**

- Merge multiple small packs into larger packs
- Example: `pack_1-50` + `pack_51-100` + `pack_101-150` → `pack_1-150`
- Reduces file count further
- Especially useful after parameter tuning (old small packs → new large packs)

**Re-snapshotting (Snapshot Refresh):**

- Create new snapshot with higher totalChanges
- Allows GC to delete more old packs/updates
- Example: Old snapshot at 2000, new at 5000 → delete packs 2000-5000
- Useful for long-lived documents with many updates

**Implementation:**

```typescript
// Repacking
async function consolidatePacks(noteId: string, instanceId: string) {
  const packs = listPacks(noteId, instanceId);
  if (packs.length >= 5) {
    // Consolidate if fragmented
    const merged = mergePacks(packs);
    writePack(merged);
    deletePacks(packs);
  }
}

// Re-snapshotting
async function refreshSnapshot(noteId: string) {
  const latestSnapshot = getNewestSnapshot(noteId);
  const updateCount = countUpdatesSince(latestSnapshot);
  if (updateCount >= 1000) {
    // Enough new updates
    createSnapshot(noteId);
  }
}
```

**Benefits:**

- Reduces file count over time (even for old documents)
- Faster cold load (fewer files to scan)
- More efficient GC (larger gaps to clean up)

### Compression

**Current:** Raw Yjs updates (uncompressed)

**Future:** Apply gzip or brotli to snapshot/pack contents

- Reduces file size 50-80%
- Tradeoff: CPU cost for compression/decompression
- Worthwhile for large documents or slow networks

### Differential Snapshots

**Current:** Full document state in each snapshot

**Future:** Store delta from previous snapshot

- Reduces snapshot file size
- Requires loading base snapshot + deltas (more complex)
- Worthwhile if snapshots are large (>1MB)

### Remote Snapshot Storage

**Current:** Snapshots stored in same directory as updates

**Future:** Store snapshots in separate cloud storage (S3, etc.)

- Faster sync (small updates sync quickly, large snapshots separate)
- Better for mobile (don't download entire snapshot unless needed)
- Requires additional infrastructure

### Adaptive Snapshot Frequency

**Current:** Fixed threshold (every 1000 updates)

**Future:** Adjust based on document characteristics

- Large documents: Snapshot more frequently
- Idle documents: Snapshot less frequently
- High-edit-rate documents: Snapshot more frequently
- Use ML to predict optimal frequency

## Migration Path

### Phase 1: Backward Compatible

- Both old and new formats coexist
- Load algorithm tries snapshot first, falls back to updates
- Write both formats temporarily (for safety)
- No user action required

### Phase 2: New Format Only

- After 2-4 weeks of Phase 1 (verify stability)
- Stop writing old format
- GC cleans up old files over time
- Still supports reading old format (for safety)

### Phase 3: Remove Old Format Support

- After 6-12 months (all users migrated)
- Remove old format reading code
- Simplify codebase

## Conclusion

The snapshot and packing system provides:

✅ **10-50x faster cold load times** (3-5s → 100-250ms)
✅ **90-95% fewer files** (2000 files → 50-100 files)
✅ **Better cloud sync performance** (fewer files, less metadata overhead)
✅ **Bounded disk usage** (GC prevents unbounded growth)
✅ **No data loss** (all updates preserved, snapshots are optimization)
✅ **Multi-instance safe** (CRDT guarantees + deterministic selection)

This architecture provides a solid foundation for scalable, performant note synchronization across multiple instances.
