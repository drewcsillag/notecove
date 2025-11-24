# NoteCove Storage Format Design Document

Version: 2.0
Date: 2025-11-22
Status: Final Design

## Overview

NoteCove uses a file-based CRDT storage system designed for reliable sync across cloud storage providers (Google Drive, Dropbox, iCloud, OneDrive). This document specifies the storage format, sync behavior, and error handling for implementation across platforms (Desktop/Electron, iOS).

### Design Goals

1. **Minimal file churn** - Reduce create/delete operations that trigger cloud sync noise
2. **Crash resilience** - Recover gracefully from incomplete writes
3. **Fast startup** - Display cached state immediately, sync in background
4. **History preservation** - Retain full edit history for timeline scrubbing
5. **Cross-platform** - Format must work identically on all platforms

---

## Directory Structure

### Storage Directory (SD) Layout

```
{SD_ROOT}/
├── SD_ID                           # UUID identifying this storage directory
├── SD_VERSION                      # Format version (currently "1")
├── notes/
│   └── {noteId}/
│       ├── logs/
│       │   ├── {instanceId}_{timestamp}.crdtlog
│       │   └── {instanceId}_{timestamp}.crdtlog.zst  (future: compressed)
│       └── snapshots/
│           ├── {instanceId}_{timestamp}.snapshot
│           └── {instanceId}_{timestamp}.snapshot.zst (future: compressed)
├── folders/
│   ├── logs/
│   │   ├── {instanceId}_{timestamp}.crdtlog
│   │   └── {instanceId}_{timestamp}.crdtlog.zst
│   └── snapshots/
│       ├── {instanceId}_{timestamp}.snapshot
│       └── {instanceId}_{timestamp}.snapshot.zst
└── activity/
    ├── {instanceId}.log
    └── {instanceId}.log.1          (rolled logs)
```

### Path Conventions

| Component  | Format                  | Example                                |
| ---------- | ----------------------- | -------------------------------------- |
| SD_ID      | UUID v4                 | `550e8400-e29b-41d4-a716-446655440000` |
| noteId     | UUID v4                 | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| instanceId | UUID v4                 | `inst-abc123-def456-...`               |
| timestamp  | Unix milliseconds (UTC) | `1699028345123`                        |

### Filename Format

**Log files:** `{instanceId}_{timestamp}.crdtlog`

- `instanceId`: The app instance that created/owns this log
- `timestamp`: Creation time in milliseconds since Unix epoch (UTC)

**Snapshot files:** `{instanceId}_{timestamp}.snapshot`

- Same convention as log files
- Timestamp indicates when snapshot was created

**Timestamp collision handling:** If an instance would create a file with a timestamp ≤ any existing file it created, use `max(existing_timestamps) + 1`.

---

## File Formats

### CRDT Log File Format (.crdtlog)

Append-only log containing CRDT update records.

#### File Header (5 bytes)

| Offset | Size | Description                                |
| ------ | ---- | ------------------------------------------ |
| 0      | 4    | Magic number: `NCLG` (0x4E 0x43 0x4C 0x47) |
| 4      | 1    | Version: `0x01`                            |

#### Record Format

Records immediately follow the header. Each record:

| Field     | Encoding        | Description                                              |
| --------- | --------------- | -------------------------------------------------------- |
| length    | varint (LEB128) | Length of remaining fields (timestamp + sequence + data) |
| timestamp | fixed 64-bit BE | Unix milliseconds (UTC) when change was made             |
| sequence  | varint (LEB128) | Per-instance sequence number (starts at 1)               |
| data      | bytes           | Raw Yjs update (`Y.encodeStateAsUpdate()` differential)  |

#### Termination Sentinel

A record with `length = 0` indicates the log is finalized (no more appends):

| Field  | Value                         |
| ------ | ----------------------------- |
| length | `0x00` (varint encoding of 0) |

#### Example Binary Layout

```
Offset  Bytes           Description
------  --------------  ----------------------------------
0x0000  4E 43 4C 47     Magic "NCLG"
0x0004  01              Version 1
0x0005  8F 01           Varint: length = 143 bytes
0x0007  00 00 01 8C...  64-bit timestamp (8 bytes)
0x000F  01              Varint: sequence = 1
0x0010  [135 bytes]     Yjs update data
0x009D  A2 03           Varint: length = 418 bytes
...
0xNNNN  00              Termination sentinel (length = 0)
```

#### Size Limit

When a log file exceeds **10 MB**, the instance:

1. Writes termination sentinel (length = 0)
2. Creates a new log file with current timestamp
3. (Future) Compresses old log to `.crdtlog.zst`

---

### Snapshot File Format (.snapshot)

Full document state at a point in time, with vector clock.

#### File Header (6 bytes)

| Offset | Size | Description                                 |
| ------ | ---- | ------------------------------------------- |
| 0      | 4    | Magic number: `NCSS` (0x4E 0x43 0x53 0x53)  |
| 4      | 1    | Version: `0x01`                             |
| 5      | 1    | Status: `0x00` = writing, `0x01` = complete |

#### Vector Clock Section

| Field       | Encoding | Description                    |
| ----------- | -------- | ------------------------------ |
| entry_count | varint   | Number of vector clock entries |

For each entry:

| Field           | Encoding    | Description                                     |
| --------------- | ----------- | ----------------------------------------------- |
| instance_id_len | varint      | Length of instance ID string                    |
| instance_id     | UTF-8 bytes | Instance UUID                                   |
| sequence        | varint      | Highest sequence number seen from this instance |
| offset          | varint      | Byte offset in that instance's log file         |
| filename_len    | varint      | Length of log filename                          |
| filename        | UTF-8 bytes | Log filename (e.g., `inst-abc_1699028345123`)   |

#### Document State Section

| Field           | Encoding | Description                                       |
| --------------- | -------- | ------------------------------------------------- |
| remaining bytes | raw      | Yjs document state (`Y.encodeStateAsUpdate(doc)`) |

#### Write Protocol

1. Write header with status = `0x00`
2. Write vector clock
3. Write document state
4. `fsync()` to disk
5. Seek to offset 5, write status = `0x01`
6. `fsync()` to disk

**Readers MUST skip snapshots with status = `0x00`** (incomplete write).

#### Snapshot Selection Algorithm

When loading a note, select the best snapshot:

1. List all snapshot files in `snapshots/` directory
2. Sort by timestamp (extracted from filename) descending (newest first)
3. For each snapshot in order:
   - Read header
   - If status = `0x01` (complete), use this snapshot
   - If status = `0x00` (incomplete), skip and try next
4. If no complete snapshots found, load from logs only

**Rationale:** Most recent timestamp correlates with highest vector clock coverage (more changes incorporated). Filename-based sorting is fast—no need to read file contents to rank candidates.

---

### Activity Log Format (.log)

Plain text, one entry per line. Each instance writes only to its own log file.

#### Entry Format

```
{noteId}|{instanceId}_{sequenceNumber}\n
```

| Field          | Description                               |
| -------------- | ----------------------------------------- |
| noteId         | UUID of the note that was modified        |
| instanceId     | UUID of the instance that made the change |
| sequenceNumber | The sequence number of the change         |

#### Write Behavior

To prevent unbounded growth during continuous typing:

- **Different note than last write:** Append new line
- **Same note as last write:** Replace the last line with updated sequence number

This optimization means consecutive edits to the same note produce only one entry (with the latest sequence), rather than thousands of entries during active typing.

**Implementation:** The writer tracks `lastNoteWritten` in memory. When replacing, it reads the file, replaces the last line, and rewrites. This is safe because each instance writes only to its own file (no multi-writer conflicts).

#### Example

User edits note A (seq 1), then note A (seq 2), then note B (seq 1), then note A (seq 3):

```
a1b2c3d4-...|inst-abc123-..._2    # Note A, seq 2 (seq 1 was replaced)
f5e6d7c8-...|inst-abc123-..._1    # Note B, seq 1 (new line, different note)
a1b2c3d4-...|inst-abc123-..._3    # Note A, seq 3 (new line, different from last)
```

#### Compaction

When activity log exceeds **1 MB** (or ~1000 entries, whichever is checked):

1. Keep only the last 1000 entries
2. Rewrite file with kept entries

Alternatively, rolling can be used:

1. Rename current log to `{instanceId}.log.1`
2. Start new `{instanceId}.log`
3. Delete `.log.2` if it exists (keep at most 2 files)

---

## Encoding Details

### Variable-Length Integer (Varint / LEB128)

Unsigned LEB128 encoding for length and sequence fields:

```
Value       Encoded Bytes
-------     -------------
0           00
1           01
127         7F
128         80 01
16383       FF 7F
16384       80 80 01
```

**Decoding algorithm:**

```
result = 0
shift = 0
while true:
    byte = read_byte()
    result |= (byte & 0x7F) << shift
    if (byte & 0x80) == 0:
        break
    shift += 7
return result
```

### Fixed 64-bit Timestamp

Big-endian, unsigned, milliseconds since Unix epoch (UTC).

```
Timestamp: 1699028345123 (2023-11-03T15:19:05.123Z)
Encoded:   00 00 01 8B E8 2D 8D 23
```

---

## Vector Clock

### Structure

```typescript
type VectorClock = {
  [instanceId: string]: {
    sequence: number; // Highest sequence number seen
    offset: number; // Byte offset after that record in log file
    file: string; // Log filename (without extension)
  };
};
```

### Example

```json
{
  "inst-abc123-def456-7890": {
    "sequence": 150,
    "offset": 48230,
    "file": "inst-abc123-def456-7890_1699028345123"
  },
  "inst-xyz789-uvw012-3456": {
    "sequence": 42,
    "offset": 12500,
    "file": "inst-xyz789-uvw012-3456_1699100000000"
  }
}
```

### Semantics

- **sequence**: Per-instance, per-document, monotonically increasing (no holes)
- **offset**: Byte position immediately after the last processed record
- **file**: Which log file contains that sequence number

This allows an instance to resume reading from exactly where it left off without re-scanning.

---

## Sync and Polling Behavior

### Startup Sequence

1. **Load from database** - Display cached note states immediately
2. **Scan activity logs** - Check for changes since last run
3. **For each changed note:**
   - Read new log entries (using stored vector clock to skip already-seen)
   - Apply Yjs updates to in-memory document
   - Update display
4. **Background polling** - Continue checking for changes periodically

### Polling Algorithm

```
every POLL_INTERVAL (e.g., 5 seconds):
    for each registered SD:
        scan activity/ directory for all .log files
        for each activity log:
            read entries after last_seen_offset
            for each new entry (noteId, instanceId, seq):
                if noteId is open or cached:
                    check log files for that note
                    apply any new updates
        update last_seen_offset for each activity log
```

### Writing Changes

When the user edits a note:

1. Generate Yjs update (`Y.encodeStateAsUpdate(doc, prevState)`)
2. Increment sequence number for this note
3. Append record to current log file:
   - If no current log file, create one
   - If current log file exceeds 10MB, finalize and create new
4. Update activity log:
   - If same note as last activity write: replace last line
   - Otherwise: append new line
5. Update database snapshot (debounced, or on note close)

### Cross-Instance Coordination

Instances coordinate via activity logs:

- Each instance writes only to its own activity log
- All instances read all activity logs
- No locking required (single writer per file)

---

## Error Handling

### Incomplete Log Record

**Detection:** `length` field indicates more bytes than remaining in file.

**Cause:** Crash during write, or sync completed before write finished.

**Handling (reading instance):**

- Stop reading at the incomplete record
- Record the offset of the incomplete record
- Check back later (record may complete after sync)

**Handling (writing instance on restart):**

- Detect own incomplete record (compare expected offset in DB vs actual file size)
- Truncate file to last complete record
- Continue appending

### Incomplete Snapshot

**Detection:** Status byte = `0x00`

**Handling:** Skip this snapshot, use next best available.

### Missing Log File

**Cause:** File deleted, sync incomplete, or corruption.

**Handling:**

- If snapshot exists, load from snapshot
- Log warning
- Continue operation (data from that instance may be incomplete)

### Activity Log Rolled

**Detection:** Instance's recorded offset exceeds current activity log size.

**Handling:**

1. Show progress bar explaining rescan needed
2. Scan all notes directories to rebuild state
3. Update recorded offsets

### Corrupt Magic Number

**Detection:** First 4 bytes don't match expected magic.

**Handling:**

- Log error with filename
- Skip file entirely
- Alert user if persistent

---

## Database Schema

### Instance Identity

```sql
-- Stored in app_state table
-- Key: 'instance_id'
-- Value: UUID string, generated on first run
```

### Note Sync State

```sql
CREATE TABLE note_sync_state (
  note_id TEXT PRIMARY KEY,
  sd_id TEXT NOT NULL,
  vector_clock TEXT NOT NULL,      -- JSON: VectorClock structure
  document_state BLOB NOT NULL,    -- Yjs encoded state
  updated_at INTEGER NOT NULL      -- Unix timestamp of last update
);

CREATE INDEX idx_note_sync_state_sd ON note_sync_state(sd_id);
```

### Folder Sync State

```sql
CREATE TABLE folder_sync_state (
  sd_id TEXT PRIMARY KEY,
  vector_clock TEXT NOT NULL,
  document_state BLOB NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Activity Log Tracking

```sql
CREATE TABLE activity_log_state (
  sd_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  last_offset INTEGER NOT NULL,    -- Byte offset in activity log
  log_file TEXT NOT NULL,          -- Current log filename being tracked
  PRIMARY KEY (sd_id, instance_id)
);
```

### Sequence Number Tracking

Tracks per-instance sequence numbers for each document (note or folder tree).

```sql
CREATE TABLE sequence_state (
  sd_id TEXT NOT NULL,
  document_id TEXT NOT NULL,       -- noteId or 'folder-tree'
  current_sequence INTEGER NOT NULL,
  current_file TEXT NOT NULL,      -- Log filename we're writing to
  current_offset INTEGER NOT NULL, -- Byte offset after last write
  PRIMARY KEY (sd_id, document_id)
);
```

**Verification on startup:**

1. Load sequence_state from DB
2. Check if `current_file` exists and has length >= `current_offset`
3. If yes, use DB values (fast path)
4. If no (file shorter or missing), rescan log files to rebuild state

---

## Snapshot Triggers

### File Snapshots (in SD)

Created when:

- Log file is rotated (exceeds 10MB) - snapshot captures all changes seen so far
- Manual trigger (future feature)

Note: Snapshots are written at 10MB rotation regardless of compression status. Compression is deferred but snapshots provide value for fast loading.

### Database Snapshots

Updated when:

- Note is closed after editing
- Periodically during editing (debounced, e.g., every 30 seconds of idle)
- App shutdown (with progress bar if >5 notes pending)

---

## History Viewer Support

### Timeline Reconstruction

1. List all log files for note (all instances)
2. Parse all records, extract: instance, timestamp, sequence, data
3. Sort by timestamp
4. Group into sessions (gaps > 5 minutes = new session)

### Keyframe Caching

For efficient scrubbing:

1. Generate keyframe snapshots at intervals (every 500 changes or 1 hour of activity)
2. Store in memory (LRU cache)
3. To reconstruct state at time T:
   - Find nearest keyframe before T
   - Apply updates from keyframe to T

### JIT Snapshots

Temporary snapshots generated on-demand for history viewer:

- Stored in memory or temp directory
- Cleaned up when history viewer closes
- Not persisted to SD

---

## Future Considerations

### Compression (Deferred)

When implemented:

- Finalized log files compressed to `.crdtlog.zst`
- Snapshots compressed to `.snapshot.zst`
- Use zstd streaming compression
- Original file deleted after successful compression verification

### Garbage Collection (Deferred)

Possible future options:

- Tiered retention (full history recent, snapshots-only older)
- User-initiated archival
- Configurable retention period

### iOS Implementation Notes

- Use same file formats exactly
- Instance ID generated per device/installation, stored in app container
- File I/O via standard iOS APIs (FileManager)
- Consider background refresh for polling when app is backgrounded
- SQLite via native iOS SQLite or a wrapper library

---

## Appendix: Quick Reference

### Magic Numbers

| Type     | Magic  | Hex           |
| -------- | ------ | ------------- |
| Log file | `NCLG` | `4E 43 4C 47` |
| Snapshot | `NCSS` | `4E 43 53 53` |

### File Extensions

| Extension       | Purpose                       |
| --------------- | ----------------------------- |
| `.crdtlog`      | CRDT update log (append-only) |
| `.crdtlog.zst`  | Compressed CRDT log (future)  |
| `.snapshot`     | Document state snapshot       |
| `.snapshot.zst` | Compressed snapshot (future)  |
| `.log`          | Activity log (plain text)     |

### Size Limits

| Item                       | Limit      |
| -------------------------- | ---------- |
| Log file rotation          | 10 MB      |
| Activity log rolling       | 1 MB       |
| Database snapshot debounce | 30 seconds |

### Byte Order

| Field         | Order                            |
| ------------- | -------------------------------- |
| Magic numbers | ASCII (big-endian)               |
| Timestamps    | Big-endian                       |
| Varints       | LEB128 (little-endian by nature) |

---

## Implementation Status

### Completed (packages/shared/src/storage/)

| Module                 | File                        | Description                                           |
| ---------------------- | --------------------------- | ----------------------------------------------------- |
| Binary Format          | `binary-format.ts`          | Varint encoding, log/snapshot headers, record parsing |
| Log Writer             | `log-writer.ts`             | Append-only log writer with 10MB rotation             |
| Log Reader             | `log-reader.ts`             | Log file reader with async generator API              |
| Snapshot Writer        | `snapshot-writer.ts`        | Crash-safe snapshot writing (0x00/0x01 protocol)      |
| Snapshot Reader        | `snapshot-reader.ts`        | Snapshot reading and selection                        |
| Note Storage Manager   | `note-storage-manager.ts`   | High-level note loading/saving                        |
| Folder Storage Manager | `folder-storage-manager.ts` | Folder tree storage manager                           |
| Crash Recovery         | `crash-recovery.ts`         | Cleanup and recovery utilities                        |
| Log Sync               | `log-sync.ts`               | Multi-instance sync from logs                         |
| Append Log Manager     | `append-log-manager.ts`     | High-level API (UpdateManager replacement)            |
| Migration              | `migration.ts`              | Convert old .yjson format to new .crdtlog             |

### Database Schema (packages/shared/src/database/)

Schema version bumped to 6 with new tables:

- `note_sync_state` - Per-note vector clock and document state
- `folder_sync_state` - Folder tree sync state
- `activity_log_state` - Activity log consumption tracking
- `sequence_state` - Per-document sequence tracking

### Debug Tools (packages/shared/tools/)

| Tool               | Usage                                                |
| ------------------ | ---------------------------------------------------- |
| `dump-crdtlog.ts`  | `npx ts-node tools/dump-crdtlog.ts <file.crdtlog>`   |
| `dump-snapshot.ts` | `npx ts-node tools/dump-snapshot.ts <file.snapshot>` |

### Integration Guide

To use the new storage format in the desktop app:

```typescript
import { AppendLogManager } from '@notecove/shared/storage';

// Create manager (similar to UpdateManager)
const manager = new AppendLogManager(fsAdapter, database, instanceId);

// Register storage directories
manager.registerSD('sd-123', '/path/to/storage');

// Write updates
const seq = await manager.writeNoteUpdate('sd-123', 'note-id', yjsUpdate);

// Load notes
const { doc, vectorClock } = await manager.loadNote('sd-123', 'note-id');

// Save snapshots (call periodically or on note close)
await manager.saveNoteSnapshot('sd-123', 'note-id', doc);

// Shutdown (writes termination sentinels)
await manager.shutdown();
```

### Migration from Old Format

```typescript
import { StorageMigration } from '@notecove/shared/storage';

const migration = new StorageMigration(fsAdapter, instanceId);

// Check if migration needed
if (await migration.checkMigrationNeeded(updatesDir)) {
  // Migrate note
  const result = await migration.migrateNote(updatesDir, logsDir, noteId);

  // Clean up old files after successful migration
  if (result.success) {
    await migration.cleanupOldFiles(updatesDir);
  }
}
```

### Test Coverage

618 tests covering:

- Binary format encoding/decoding
- Log file reading/writing
- Snapshot creation and selection
- Storage managers
- Crash recovery
- Migration utilities
