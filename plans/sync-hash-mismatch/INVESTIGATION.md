# Investigation: Stale Sync False Positive

## Root Cause Identified

### Bug 1: False Positive Stale Sync Detection (Primary Issue)

**The Problem**: The stale sync detection algorithm marks activity log entries as "stale" based purely on sequence number gaps, without checking if the CRDT data already exists.

**Reproduction scenario**:

1. Remote machine creates note and edits it over time (582 activity log entries, seq 1-582)
2. Single CRDT log file `cc614188..._1766506160372.crdtlog` contains ALL updates
3. Local machine first encounters this note
4. `lastSeenLineCount` = 0, so all 582 lines are "new"
5. First pass: finds highest sequence = 582
6. Second pass: for seq 1, gap = 582-1 = 581 > 50 → **FALSELY marked stale**
7. Entries 1-532 are all marked stale (gap > 50)
8. But the CRDT log file already has all the data!
9. Note loads correctly, vector clocks match, content is identical
10. But stale entries persist and "Wait for sync" toast never clears

**Code location**: `packages/shared/src/storage/activity-sync.ts:387-418`

```typescript
// STALE DETECTION: Check if this entry is too far behind the highest sequence
const gap = highestSeqForNote - sequence;
if (gap > STALE_SEQUENCE_GAP_THRESHOLD) {
  // BUG: Marks as stale WITHOUT checking if CRDT data exists!
  this.staleEntries.push({...});
  continue;
}
```

**Fix options**:

1. **Before marking stale, check if CRDT log exists with that sequence**
   - Call `checkCRDTLogExists(noteId, instanceId, sequence)`
   - Only mark stale if the file doesn't exist

2. **After successful note load, clear stale entries for that note**
   - When `pollAndReload` succeeds, call `clearStaleEntriesForNote(noteId)`
   - When vector clocks match expected, clear stale entries

3. **Compare vector clocks when checking stale status**
   - If local vector clock already includes the sequence, it's not stale

**Recommended fix**: Option 1 or 3 - check CRDT log existence or vector clock before marking stale.

---

### Bug 2: Document Hash Mismatch (Cosmetic Issue)

**The Problem**: Document hash differs between machines despite identical CRDT log files.

**Analysis**:

- Hash is computed via `Y.encodeStateAsUpdate(doc)`
- When note is in-memory: uses live Y.Doc
- When loading from cache/disk: uses cached bytes or fresh load

The hash computation has three paths (`note-query-handlers.ts:341-403`):

1. In-memory doc: `Y.encodeStateAsUpdate(doc)`
2. DB cache: `syncState.documentState` (cached bytes directly)
3. Disk load: `Y.encodeStateAsUpdate(loadedDoc)`

**Potential causes**:

1. Different Yjs client IDs when docs are constructed
2. In-memory doc has different internal state than disk load
3. Cache staleness - DB cache doesn't match disk

**Recommended fix**: Normalize hash computation to always use the same path (e.g., always load from disk for comparison purposes).

---

## Evidence

Activity log for note `229a9288-ae9f-493f-a0f4-7ca1b6757983`:

```
229a9288...|cc614188..._1   (seq 1 - would be marked stale, gap=581)
229a9288...|cc614188..._2   (seq 2 - would be marked stale, gap=580)
...
229a9288...|cc614188..._532 (seq 532 - would be marked stale, gap=50)
229a9288...|cc614188..._533 (seq 533 - NOT stale, gap=49)
...
229a9288...|cc614188..._582 (seq 582 - highest)
```

CRDT log file: `cc614188-8e7e-4821-865f-6f8cfcc41b18_1766506160372.crdtlog`

- Contains all 582 sequences worth of updates
- md5sum matches on both machines
- 20,117 bytes
