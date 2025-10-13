# Cache.json Decision Record

## Date: 2025-10-13

## Decision: Remove cache.json (Option 1)

We are removing the `cache.json` snapshot files and loading notes entirely from CRDT updates.

## Context

The original architecture included two storage mechanisms:
1. **CRDT updates** in `note-123/updates/` - Append-only, per-instance, source of truth
2. **cache.json** in `note-123/cache.json` - Point-in-time snapshot for fast loading

## Problem Identified

**Race Condition with cache.json:**
- Multiple instances can write to the same `cache.json` file simultaneously
- Last writer wins, which can cause:
  - Corrupted JSON (partial writes)
  - Stale snapshots that don't reflect any real state
  - Wasted I/O

**Example Scenario:**
```
Time 0: cache.json = state after update #10
Time 1: Instance A writes cache.json with state #11
Time 2: Instance B writes cache.json with state #12 (simultaneously)
Result: Corrupted or stale cache.json
```

**Why CRDT updates are safe:**
Each instance writes to its own files:
- `note-123/updates/test1.000011.yjson` (Instance A - no conflict)
- `note-123/updates/test2.000012.yjson` (Instance B - no conflict)

## Options Considered

### Option 1: Remove cache.json ✅ CHOSEN
**Implementation:**
- Load notes by reconstructing from CRDT updates only
- No cache file at all
- Always have consistent state

**Pros:**
- Simplest and safest
- No race conditions
- No stale data
- Source of truth is always CRDT updates

**Cons:**
- Slower startup if many updates (need to replay all)
- More I/O on startup (read multiple update files)

**When this becomes a problem:**
- If a note has hundreds/thousands of update files
- If startup time exceeds ~1-2 seconds
- At that point, implement Option 3

### Option 2: Per-instance cache files
**Implementation:**
- `note-123/cache-test1.json`
- `note-123/cache-test2.json`

**Pros:**
- No write conflicts
- Each instance has its own snapshot

**Cons:**
- Which cache to use on startup? (arbitrary choice)
- Extra storage (N cache files for N instances)
- Still can be stale

**Rejected because:** Doesn't solve the fundamental problem of which snapshot to trust

### Option 3: Snapshots with metadata (Future Enhancement)
**Implementation:**
```json
{
  "snapshot": {
    "title": "My Note",
    "content": "...",
    "modified": "2025-10-13T15:30:00Z"
  },
  "includes": {
    "test1": 50,
    "test2": 30
  },
  "timestamp": "2025-10-13T15:30:00Z"
}
```

**How it works:**
1. Any instance can write a snapshot after N total updates (e.g., every 100 updates)
2. Snapshot includes metadata: "This snapshot includes updates 1-50 from test1, 1-30 from test2"
3. On load:
   - Read snapshot
   - Read only newer updates (test1: 51+, test2: 31+)
   - Apply new updates to get current state

**Pros:**
- Fast startup (read snapshot + recent updates only)
- Always consistent (metadata tells you exactly what's included)
- No arbitrary "which cache" decision
- Works with any number of instances

**Cons:**
- More complex implementation
- Need to track what's in each snapshot
- Need to handle snapshot compaction

**When to implement:**
- When startup time becomes noticeably slow (>1-2 seconds)
- When notes have hundreds of update files
- Estimated: When typical note has >100 update files

## Migration Path to Option 3

When we need better performance:

1. **Add snapshot writing:**
   - After flushing N updates, write a snapshot with metadata
   - Store as `note-123/snapshot.json` with `includes` field

2. **Update loading:**
   - Check if `snapshot.json` exists
   - If yes: Load snapshot, then load only newer updates
   - If no: Load all updates (current behavior)

3. **Add compaction (optional):**
   - After writing snapshot, delete old update files
   - Keep only recent updates (e.g., last 50)

## Implementation Notes

### Files to Update:
1. `src/lib/file-storage.js` - Remove `saveNote()`, `loadNote()`, `loadAllNotes()` JSON logic
2. `src/lib/sync-manager.js` - Remove `fileStorage.saveNote()` calls
3. `src/lib/note-manager.js` - Load via `syncManager.loadNote()` instead

### Loading Flow (New):
```
On startup:
  For each note directory in notesPath:
    Initialize UpdateStore for noteId
    Read all updates from updates/
    Apply updates to Y.Doc (CRDT)
    Extract note from Y.Doc
    Add to notes map
```

### Saving Flow (Already Correct):
```
User edits note:
  TipTap modifies Y.Doc
  Y.Doc emits update event
  UpdateStore buffers update
  After 3s idle: Flush to updates/test1.000042.yjson
```

## Performance Expectations

**Current (with cache.json):**
- Startup: ~10ms per note (read JSON)
- 100 notes: ~1 second

**After removal (CRDT-only):**
- Startup: ~50-100ms per note (read + apply updates)
- 100 notes: ~5-10 seconds (worst case if many updates)

**With snapshots (Option 3, future):**
- Startup: ~20ms per note (read snapshot + recent updates)
- 100 notes: ~2 seconds

## Decision Rationale

For multi-instance sync, **correctness > performance**. We chose Option 1 because:

1. **Simpler architecture** - One source of truth (CRDT updates)
2. **No race conditions** - Safe for concurrent writes
3. **Performance likely fine** - Most notes won't have many update files yet
4. **Easy migration** - Can add snapshots (Option 3) later without breaking changes

## Review Date

Re-evaluate this decision when:
- Startup time exceeds 2 seconds for typical usage
- Users have notes with >100 update files
- Performance complaints arise

At that point, implement Option 3 (snapshots with metadata).

## References

- SYNC_ARCHITECTURE.md - Overall sync design
- src/lib/update-store.js - Packed update files
- src/lib/crdt-manager.js - Yjs document management
