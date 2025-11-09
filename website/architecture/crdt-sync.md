# CRDT Synchronization

NoteCove uses CRDTs (Conflict-free Replicated Data Types) powered by Yjs for robust, automatic conflict resolution.

## What are CRDTs?

### Definition

**CRDT** = Conflict-free Replicated Data Type

A data structure that:

- Can be replicated across multiple devices
- Can be updated independently on each device
- Automatically merges updates without conflicts
- Mathematically guarantees eventual consistency

### The Problem CRDTs Solve

Traditional sync has conflicts:

```
Device A: "Hello world" → "Hello beautiful world"
Device B: "Hello world" → "Hello amazing world"

Merged: ???
- Last write wins? (loses data)
- Manual resolution? (annoying)
- CRDT: "Hello beautiful amazing world" ✓
```

CRDTs automatically merge changes while preserving all edits.

## Why Yjs?

NoteCove uses **Yjs** for CRDT implementation:

### Features

**Rich text support:**

- Character-by-character tracking
- Formatting preservation
- Efficient operations

**Performance:**

- Fast merge operations
- Small update sizes
- Memory efficient

**Ecosystem:**

- TipTap integration (y-prosemirror)
- Offline support
- Battle-tested in production

**Type support:**

- Text (Y.Text)
- Maps (Y.Map)
- Arrays (Y.Array)
- XML (Y.XmlFragment)

### Alternatives Considered

| Library   | Pros                       | Cons                   |
| --------- | -------------------------- | ---------------------- |
| **Yjs**   | Fast, rich text, ecosystem | More complex           |
| Automerge | Simple API, JSON-like      | Slower, larger updates |
| CRDT.tech | Lightweight                | Limited features       |
| Custom    | Full control               | High effort, risk      |

We chose Yjs for its performance and rich text support.

## How It Works

### Document Structure

Each note is a Yjs document:

```typescript
import * as Y from 'yjs';

const ydoc = new Y.Doc();
const ytext = ydoc.getText('content');

// Insert text
ytext.insert(0, 'Hello world');

// Apply formatting
ytext.format(0, 5, { bold: true });
```

### Updates

Changes generate binary updates:

```typescript
// Capture update
ydoc.on('update', (update) => {
  // update is Uint8Array
  // Save to file or send to other devices
});

// Apply update on another device
Y.applyUpdate(ydoc2, update);
```

### Merging

Yjs automatically merges concurrent edits:

```typescript
// Device A
ytextA.insert(0, 'A: ');

// Device B (simultaneously)
ytextB.insert(0, 'B: ');

// After sync: "A: B: " or "B: A: "
// Order deterministic based on client IDs
```

## Sync Protocol

### Architecture

```
┌──────────────┐         ┌──────────────┐
│   Device A   │         │   Device B   │
│              │         │              │
│  ┌────────┐  │         │  ┌────────┐  │
│  │Yjs Doc │  │         │  │Yjs Doc │  │
│  └───┬────┘  │         │  └───┬────┘  │
│      │       │         │      │       │
│  ┌───▼────┐  │         │  ┌───▼────┐  │
│  │Updates │◄─┼─Cloud───┼─►│Updates │  │
│  │ Folder │  │ Storage │  │ Folder │  │
│  └────────┘  │         │  └────────┘  │
└──────────────┘         └──────────────┘
```

### Update Flow

**Writing updates:**

1. User edits note
2. Yjs generates update
3. Update saved to sync folder as file
4. Cloud storage syncs file

**Reading updates:**

1. File system watcher detects new file
2. Read update from file
3. Apply to local Yjs document
4. UI updates automatically

### Update Files

Updates stored as JSON files:

```json
{
  "noteId": "note-abc123",
  "timestamp": 1704067200000,
  "clientId": "device-xyz",
  "update": "base64-encoded-binary-update",
  "checksum": "sha256-hash"
}
```

File naming: `{timestamp}-{clientId}.json`

## Conflict Resolution

### Text Merging

**Concurrent insertions:**

```
Initial: "Hello world"

Device A: Insert "beautiful " at position 6
  → "Hello beautiful world"

Device B: Insert "amazing " at position 6
  → "Hello amazing world"

Merged: "Hello beautiful amazing world"
or:     "Hello amazing beautiful world"
(deterministic based on client IDs)
```

**Concurrent deletions:**

```
Initial: "Hello beautiful world"

Device A: Delete "beautiful "
  → "Hello world"

Device B: Delete "world"
  → "Hello beautiful "

Merged: "Hello "
(both deletions applied)
```

### Formatting Conflicts

Concurrent formatting is merged:

```
Initial: "Hello world"

Device A: Bold "Hello"
  → "<b>Hello</b> world"

Device B: Italic "world"
  → "Hello <i>world</i>"

Merged: "<b>Hello</b> <i>world</i>"
```

### Structural Changes

Folder moves, renames handled separately:

- Metadata stored in SQLite
- Last-write-wins for structural changes
- CRDT only for note content

## Performance

### Update Size

Typical update sizes:

| Operation    | Size         |
| ------------ | ------------ |
| Insert char  | ~10-20 bytes |
| Delete char  | ~10-20 bytes |
| Format range | ~20-40 bytes |
| Large paste  | ~1-10 KB     |

### Merge Speed

Merge performance:

| Updates | Time    |
| ------- | ------- |
| 100     | < 10ms  |
| 1,000   | < 50ms  |
| 10,000  | < 500ms |

### Memory Usage

Per document:

- Empty doc: ~1 KB
- 1,000 words: ~10-50 KB
- 10,000 words: ~100-500 KB

Grows with edit history, not just content size.

## Advanced Features

### State Vectors

Track what each device has seen:

```typescript
// Get state vector
const stateVector = Y.encodeStateVector(ydoc);

// Get missing updates
const diff = Y.encodeStateAsUpdate(ydoc2, stateVector);

// Apply diff
Y.applyUpdate(ydoc, diff);
```

**Use case:** Efficient initial sync

### Transaction Bundling

Group operations:

```typescript
ydoc.transact(() => {
  ytext.insert(0, 'Hello ');
  ytext.insert(6, 'world');
  ytext.format(0, 11, { bold: true });
});
// Single update generated
```

**Benefits:**

- Smaller updates
- Better performance
- Atomic operations

### Undo/Redo

Built-in undo manager:

```typescript
const undoManager = new Y.UndoManager(ytext);

// Make changes
ytext.insert(0, 'Hello');

// Undo
undoManager.undo();

// Redo
undoManager.redo();
```

**Scope:**

- Per-user undo stack
- Doesn't affect other users
- Time-based grouping

## Implementation Details

### Document Lifecycle

**Creation:**

```typescript
// Create new note
const ydoc = new Y.Doc();
ydoc.clientID = generateClientId();

// Initialize content
const ytext = ydoc.getText('content');
```

**Loading:**

```typescript
// Load from SQLite
const updates = await db.getUpdates(noteId);

// Apply updates
updates.forEach((update) => {
  Y.applyUpdate(ydoc, update);
});
```

**Syncing:**

```typescript
// Watch for local changes
ydoc.on('update', async (update) => {
  await saveUpdate(noteId, update);
  await writeSyncFile(noteId, update);
});

// Apply remote changes
watchSyncFolder(async (file) => {
  const update = await readUpdate(file);
  Y.applyUpdate(ydoc, update);
});
```

### Integration with TipTap

Using y-prosemirror binding:

```typescript
import { ySyncPlugin } from 'y-prosemirror';

const editor = new Editor({
  extensions: [
    // ... other extensions
  ],
  onUpdate: ({ editor }) => {
    // Yjs handles sync automatically
  },
});

// Bind Yjs document
const provider = new WebsocketProvider('ws://localhost:1234', 'room-name', ydoc);
```

### Persistence

**SQLite storage:**

```sql
CREATE TABLE note_updates (
  id INTEGER PRIMARY KEY,
  note_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  client_id TEXT NOT NULL,
  update BLOB NOT NULL,
  checksum TEXT NOT NULL
);

CREATE INDEX idx_note_updates_note_id
  ON note_updates(note_id, timestamp);
```

**File system storage:**

```
sync-data/
├── SD-abc123/
│   ├── note-xyz/
│   │   ├── 1704067200000-device1.json
│   │   ├── 1704067201000-device2.json
│   │   └── 1704067202000-device1.json
```

## Debugging

### Inspect Document State

```typescript
// Get current content
const content = ytext.toString();

// Get all updates
const updates = await db.getUpdates(noteId);

// Verify checksum
const hash = sha256(update);
```

### Activity Logging

Track all CRDT operations:

```typescript
ydoc.on('update', (update, origin) => {
  logger.info('CRDT update', {
    noteId,
    size: update.length,
    origin,
    timestamp: Date.now(),
  });
});
```

### Consistency Checks

Verify document integrity:

```typescript
// Compare state vectors
const sv1 = Y.encodeStateVector(ydoc1);
const sv2 = Y.encodeStateVector(ydoc2);

// Should be equal after sync
assert.deepEqual(sv1, sv2);
```

## Best Practices

### Do's

✅ Use transactions for multi-op changes
✅ Store all updates for history
✅ Validate updates before applying
✅ Log CRDT operations for debugging
✅ Test concurrent editing scenarios

### Don'ts

❌ Don't modify Yjs docs directly
❌ Don't assume update order
❌ Don't skip update validation
❌ Don't delete old updates (unless archiving)
❌ Don't share Yjs docs across threads

## Limitations

### What CRDTs Can't Do

**Constraints:**

- Can't enforce business rules
- Can't prevent all "conflicts"
- Can't guarantee "sensible" results

**Example:**

```
Initial: "The cat sat on the mat"

Device A: Change "cat" to "dog"
Device B: Delete "cat"

Merged: "The  sat on the mat"
or:     "The dog sat on the mat"

Both valid CRDT results, neither may be desired
```

### Workarounds

**Last-write-wins for metadata:**

- Folder location
- Tags
- Title (if separate from content)

**Operational transforms for constraints:**

- Custom validation
- Application-level conflict resolution

## Future Enhancements

### Planned Features

**Compression:**

- Compact update history
- Reduce storage size
- Maintain full functionality

**Selective history:**

- Archive old updates
- Keep snapshots
- Rebuild capability

**P2P sync:**

- Direct device communication
- WebRTC data channels
- Faster than cloud sync

## Resources

### Documentation

- [Yjs Documentation](https://docs.yjs.dev/)
- [CRDT Introduction](https://crdt.tech/)
- [Conflict-Free Replicated Data Types (Paper)](https://hal.inria.fr/inria-00555588)

### Related Reading

- [Local-First Software](https://www.inkandswitch.com/local-first/)
- [CRDTs: The Hard Parts](https://martin.kleppmann.com/2020/07/06/crdt-hard-parts-hydra.html)

## Next Steps

- [Learn about storage layer](/architecture/storage)
- [Understand offline sync](/features/offline-sync)
- [Explore tech stack](/architecture/tech-stack)
