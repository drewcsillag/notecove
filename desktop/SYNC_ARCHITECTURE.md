# NoteCove Sync Architecture

## Overview

NoteCove uses a **file-based CRDT sync system** that is:
- **Conflict-free** - Uses Yjs CRDTs for automatic merging
- **Robust** - Append-only files prevent data loss from concurrent writes
- **Serverless** - Works with any shared filesystem (Dropbox, iCloud, NFS, etc.)
- **Efficient** - Packed updates and incremental sync minimize file operations

## Core Components

### 1. CRDTManager (`src/lib/crdt-manager.js`)

Manages Yjs documents for notes. Integrates with TipTap's Collaboration extension.

**Key Features:**
- Maintains Y.Doc for each note
- Provides Y.XmlFragment for TipTap editor content
- Stores metadata (title, tags, folder) in Y.Map
- Tracks pending updates for writing to files
- Character-level CRDT operations (not whole-document replacement)

**Usage:**
```javascript
const crdtManager = new CRDTManager();
const doc = crdtManager.getDoc(noteId);
const fragment = crdtManager.getContentFragment(noteId); // For TipTap
crdtManager.updateMetadata(noteId, { title: 'New Title' });
```

### 2. UpdateStore (`src/lib/update-store.js`)

Handles append-only file storage for CRDT updates. Each instance writes its own files.

**Key Features:**
- Buffers updates until user stops typing (configurable idle timeout)
- Packs multiple updates into single files
- Per-instance sequence tracking (no write conflicts)
- Partial file reads (only extracts unseen updates)
- Pluggable flush strategies (idle, count, immediate)

**File Structure:**
```
shared-notes/
  note-123/
    updates/
      instance-A.000001-000050.yjson  ← Packed updates 1-50
      instance-A.000051.yjson         ← Active file
      instance-B.000001-000030.yjson
    meta/
      instance-A.json  ← Tracking what A has seen
      instance-B.json  ← Tracking what B has seen
```

**Flush Strategies:**
```javascript
// Idle-based (default): Flush after 3s of inactivity
new UpdateStore(fileStorage, 'instance-A');

// Immediate: Flush every update (for server-based sync)
new UpdateStore(fileStorage, 'instance-A', {
  flushStrategy: new ImmediateFlushStrategy()
});

// Count-based: Flush after N updates
new UpdateStore(fileStorage, 'instance-A', {
  flushStrategy: new CountFlushStrategy(50)
});
```

## How Sync Works

### Saving a Note

```
User types "Hello" in TipTap editor
  ↓
TipTap modifies Y.XmlFragment directly
  ↓
Y.Doc emits 'update' event with CRDT operation
  ↓
CRDTManager stores update in pendingUpdates
  ↓
UpdateStore buffers the update
  ↓
After 3s idle (or safety limit), UpdateStore flushes to file:
  note-123/updates/instance-A.000042.yjson
  ↓
UpdateStore updates meta file:
  note-123/meta/instance-A.json
```

### Syncing Between Instances

```
Instance A writes: instance-A.000042.yjson
  ↓
Instance B's file watcher (SyncManager) detects new file
  ↓
Instance B reads all new updates via UpdateStore.readNewUpdates()
  ↓
UpdateStore checks meta/instance-B.json:
  "I've seen instance-A up to #41"
  ↓
UpdateStore reads instance-A.000042.yjson
  ↓
Extracts update #42, returns it
  ↓
SyncManager applies: crdtManager.applyUpdate(noteId, update, 'remote')
  ↓
TipTap editor automatically reflects changes (connected to same Y.Doc)
  ↓
UpdateStore updates meta/instance-B.json:
  "I've now seen instance-A up to #42"
```

### New Instance Joining

```
Instance C starts fresh (never seen this note before)
  ↓
UpdateStore.initialize(noteId) - meta file doesn't exist
  ↓
UpdateStore.readNewUpdates(noteId):
  - Scans updates/ directory
  - Finds: instance-A.000001-000050.yjson, instance-B.000001-000030.yjson
  - Reads all 80 updates
  ↓
SyncManager applies all updates in sequence
  ↓
Y.Doc converges to same state as instances A and B
  ↓
Instance C is now in sync!
```

## Data Integrity Guarantees

### 1. No Write Conflicts
- Each instance only writes to its own files
- File naming includes instance ID: `instance-A.*.yjson`
- Meta files are also per-instance: `meta/instance-A.json`
- No coordination or locking needed

### 2. Append-Only Updates
- Update files are never modified after creation
- New updates create new files
- Sequence numbers ensure ordering

### 3. Graceful Error Handling
- Failed flush → updates stay in buffer, retry on next flush
- Corrupted file → skip and log error, continue with other files
- Missing meta → start fresh with empty state
- Network errors → updates buffered until connection restored

### 4. CRDT Properties
- Yjs guarantees convergence - all instances reach same state
- Operations commute - order doesn't matter (Yjs handles it)
- No "conflicts" - concurrent edits merge automatically

## Testing

Comprehensive test suite in `src/lib/update-store.test.js`:

✅ **19 tests covering:**
- Initialization (fresh and existing state)
- Writing (buffering, flushing, strategies)
- Reading (incremental, partial, multi-instance)
- Sequence tracking across restarts
- Real Yjs document synchronization
- Data integrity (failed writes, corrupted files)
- Concurrent writes without conflicts

**Run tests:**
```bash
npm test -- update-store
```

## Performance Characteristics

### File Counts
- Default: ~10-20 files per note (with idle flush strategy)
- One typing session = 1 file (not 1 file per keystroke!)
- Files accumulate slowly (3 second idle timeout between flushes)

### Sync Latency
- File watcher detects changes: ~100-500ms (depends on filesystem)
- Read + apply updates: <10ms for typical note
- TipTap update: instantaneous (already connected to Y.Doc)

### Scalability
- ✅ **Works well:** 2-5 concurrent instances
- ⚠️ **Consider snapshots:** 10+ instances (many update files to read)
- ❌ **Not designed for:** Real-time collaboration (>20 concurrent users)

## Future Enhancements

### Snapshots (Not Yet Implemented)
For new instances joining, reading hundreds of small files is inefficient.

**Proposed:**
```
note-123/
  snapshot.yjs       ← Full Y.Doc state
  snapshot.meta.json ← { includes: { A: 100, B: 75 } }
  updates/
    instance-A.000101-000110.yjson  ← Only recent updates
```

Any instance can write a snapshot after N total updates (e.g., 100).
New instances load snapshot + recent updates.

### Compaction (Optional)
Delete old update files after snapshot creation.
Keeps file counts bounded.

### Server-Based Sync (Future)
Use ImmediateFlushStrategy + WebSocket transport.
Same CRDT system, different storage backend.

## Integration with TipTap

NoteCove uses TipTap's Collaboration extension:

```javascript
// In editor setup
import Collaboration from '@tiptap/extension-collaboration';

const editor = new Editor({
  extensions: [
    StarterKit,
    Collaboration.configure({
      document: crdtManager.getDoc(noteId),
      field: 'default' // Y.XmlFragment name
    })
  ]
});
```

TipTap directly modifies the Y.XmlFragment - no manual serialization needed!

## Why This Architecture?

### Vs. Traditional File Sync
- ❌ Traditional: Last-write-wins → data loss on concurrent edits
- ✅ CRDTs: Automatic merge → never lose data

### Vs. Operational Transform (OT)
- ❌ OT: Requires server, complex conflict resolution
- ✅ CRDTs: Serverless, conflicts impossible by design

### Vs. Git-style Sync
- ❌ Git: Manual merge conflicts, not real-time
- ✅ CRDTs: Automatic merge, near real-time

### Vs. Database Replication
- ❌ Database: Requires server infrastructure
- ✅ File-based: Works with any shared folder

## Limitations

1. **Not real-time** - Sync latency is ~100-500ms (filesystem dependent)
2. **Requires shared filesystem** - Can't sync over pure HTTP
3. **File count grows** - Needs snapshots for long-running notes
4. **No access control** - Anyone with folder access can edit

## Security Considerations

- **No encryption at rest** - Files stored as plain JSON/base64
- **No authentication** - Rely on filesystem permissions
- **No signing** - Can't verify update authorship
- **Future:** Add encryption layer for sensitive notes

## Migration Path

Current code uses old single-file approach. To migrate:

1. ✅ New CRDTManager (integrated with TipTap)
2. ✅ New UpdateStore (append-only files)
3. ⏳ Update SyncManager to use UpdateStore
4. ⏳ Integrate TipTap Collaboration extension
5. ⏳ Migrate existing notes to new format
6. ⏳ Test with multiple instances

## Summary

This architecture provides:
- ✅ **Zero data loss** - Append-only + CRDTs
- ✅ **Zero conflicts** - CRDT properties
- ✅ **Zero coordination** - Per-instance files
- ✅ **Reasonable performance** - Packed updates + incremental reads
- ✅ **Serverless** - Works with any shared filesystem

Perfect for personal/small-team note-taking with sync across devices!
