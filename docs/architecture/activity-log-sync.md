# Activity Log Sync Architecture

## Overview

The Activity Log Sync system enables real-time note synchronization across multiple windows and instances of NoteCove. This document describes the architecture for tracking note edits and propagating changes across instances.

## Problem Statement

NoteCove needs to synchronize note edits across:

- Multiple windows in the same application instance
- Multiple application instances on the same machine
- Multiple machines via file sync services (Dropbox, iCloud, etc.)

### Requirements

1. **Efficient File Watching**: Avoid watching hundreds of individual note directories
2. **Multi-Writer Safety**: No file corruption when multiple instances write simultaneously
3. **Minimal File Growth**: Avoid creating thousands of entries during continuous editing
4. **Gap Detection**: Handle cases where log entries are compacted/deleted
5. **Cross-Platform**: Work identically on desktop and mobile (future)

## Architecture

### Storage Structure

```
storage/
  .activity/
    {instanceId}.log     # One log file per instance
  notes/
    {noteId}/
      updates/           # CRDT update files (unchanged)
        {timestamp}-{instanceId}.yjson
  folders/
    updates/             # Folder CRDT updates (existing)
```

### Activity Log Format

Each instance maintains its own append-only log file at `.activity/{instanceId}.log`.

**Format:**

```
{timestamp}|{noteId}|{updateCount}
```

**Example:**

```
1698765432000|note-abc123|5
1698765433000|note-def456|2
1698765434000|note-abc123|12
```

### Key Principles

#### 1. Per-Instance Files (No Multi-Writer Conflicts)

Each instance writes ONLY to its own log file:

- Instance `inst-abc` writes to `.activity/inst-abc.log`
- Instance `inst-xyz` writes to `.activity/inst-xyz.log`

**Benefits:**

- No file locking needed
- No write contention
- Crash-safe (corrupted file only affects one instance)
- Clear debugging (each instance has its own history)

#### 2. Last-Line Reuse (Compression During Continuous Editing)

When editing the **same note consecutively**, replace the last line instead of appending:

```typescript
// User types in note-123 for 5 seconds
// File content (last line keeps getting replaced):
1698765430000 | (note - 123) | 24;

// User switches to note-456
// File content (new line appended):
1698765430000 | (note - 123) | 24;
1698765435000 | (note - 456) | 1;

// User switches back to note-123
// File content (new line appended, not replaced):
1698765430000 | (note - 123) | 24;
1698765435000 | (note - 456) | 1;
1698765440000 | (note - 123) | 30;
```

**Benefits:**

- Natural compression for common case (typing in one note)
- No complex deduplication logic
- File size stays reasonable even with rapid edits

#### 3. Single Directory Watch

Watch the `.activity/` directory (not individual note directories):

```typescript
fileWatcher.watch('.activity/', (event) => {
  if (event.filename === `${myInstanceId}.log`) return; // Ignore own file
  syncFromOtherInstances();
});
```

**Benefits:**

- Only 1 watcher needed (vs hundreds for individual notes)
- Works with any number of notes
- No dynamic watcher management

#### 4. Watermark Tracking (Efficient Sync)

Track the last timestamp seen from each instance:

```typescript
lastSeenTimestamps: Map<instanceId, timestamp> = {
  'inst-abc': 1698765440000,
  'inst-xyz': 1698765435000,
};
```

On sync, only process entries newer than the watermark.

#### 5. Gap Detection (Compaction Safety)

If an instance compacts its log (removes old entries), other instances detect the gap:

```typescript
// Our watermark for inst-abc: 1698765400000
// inst-abc's oldest entry now: 1698765500000 (gap of 100 seconds)

if (oldestTimestamp > lastSeen && lastSeen > 0) {
  // Gap detected! Some entries were compacted.
  // Fallback: reload all currently loaded notes
  fullScanAllNotes();
}
```

**Benefits:**

- Safe compaction without coordination
- Automatic recovery from gaps
- Only scans loaded notes (typically 1-5), not all notes on disk

## Implementation

### Components

#### 1. ActivityLogger (Shared Package)

**Location:** `packages/shared/src/storage/activity-logger.ts`

**Responsibilities:**

- Write note activity to instance's log file
- Replace last line when same note edited consecutively
- Compact log to 1,000 most recent entries

**API:**

```typescript
class ActivityLogger {
  async initialize(): Promise<void>;
  async recordNoteActivity(noteId: string, updateCount: number): Promise<void>;
  async compact(): Promise<void>;
}
```

#### 2. ActivitySync (Shared Package)

**Location:** `packages/shared/src/storage/activity-sync.ts`

**Responsibilities:**

- Read other instances' activity logs
- Track watermarks (last seen timestamp per instance)
- Detect gaps and trigger full scans
- Clean up orphaned logs (older than 7 days)

**API:**

```typescript
class ActivitySync {
  async syncFromOtherInstances(): Promise<Set<string>>;
  async cleanupOrphanedLogs(): Promise<void>;
}
```

#### 3. CRDTManager Integration (Desktop)

**Location:** `packages/desktop/src/main/crdt/crdt-manager.ts`

**Changes:**

- Add `ActivityLogger` instance
- Call `recordNoteActivity()` when note is edited
- Add `reloadNote()` method to re-apply updates from disk

#### 4. File Watcher Setup (Desktop Main Process)

**Location:** `packages/desktop/src/main/index.ts`

**Setup:**

- Initialize ActivityLogger and ActivitySync
- Watch `.activity/` directory for changes
- On change, sync from other instances and broadcast to renderer

## File Size Analysis

**Per-line size:**

```
Format: 1698765432000|note-abc123|42
Length: 13 + 1 + 36 + 1 + ~3 = ~54 bytes
```

**With 1,000 line retention:**

```
1,000 lines × 54 bytes = ~54 KB
With newlines: ~55-60 KB
```

**Conclusion:** 60KB is negligible, even on mobile. No performance concerns.

## Timing and Triggers

### When Activity is Recorded

Every time a note receives a CRDT update:

```typescript
doc.on('update', (update: Uint8Array) => {
  await this.updateManager.writeNoteUpdate(noteId, update);
  await this.activityLogger.recordNoteActivity(noteId, updateCount);
});
```

### When Sync Happens

When `.activity/` directory changes (another instance wrote their log):

```typescript
fileWatcher.watch('.activity/', async (event) => {
  if (event.filename === `${instanceId}.log`) return; // Ignore own writes

  const affectedNotes = await activitySync.syncFromOtherInstances();

  // Broadcast to all windows
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('note:external-update', { affectedNotes });
  }
});
```

### When Compaction Happens

Periodically (every 5 minutes) in the main process:

```typescript
setInterval(
  () => {
    activityLogger.compact().catch((err) => {
      console.error('Failed to compact activity log:', err);
    });
  },
  5 * 60 * 1000
);
```

### When Cleanup Happens

On application startup:

```typescript
await activitySync.cleanupOrphanedLogs(); // Remove logs older than 7 days
```

## Edge Cases

### Case 1: Instance Crashes

**Scenario:** Instance crashes while editing note-123

**Result:**

- Activity log remains on disk
- Other instances can still read it
- Will be cleaned up after 7 days of inactivity

**No data loss.**

### Case 2: Clock Skew

**Scenario:** Instance A's clock is 5 minutes ahead of Instance B

**Mitigation:**

- Timestamps only used for ordering within same instance file
- Cross-instance sync uses "newer than last seen" not absolute time
- No issues as long as clocks don't go backwards

### Case 3: Rapid Instance Restart

**Scenario:** Instance restarts immediately (same instance ID)

**Result:**

- Appends to existing activity log
- Other instances see new entries
- Works correctly

### Case 4: File Sync Delay (Dropbox)

**Scenario:** Instance A on machine 1, Instance B on machine 2, synced via Dropbox

**Result:**

- Instance A writes to `.activity/inst-a.log`
- Dropbox syncs file to machine 2 (a few seconds delay)
- Instance B's file watcher detects change
- Instance B syncs note updates

**Eventual consistency achieved.**

### Case 5: Compaction During Continuous Editing

**Scenario:** Instance editing note-123 continuously, compaction triggers

**Result:**

- Last line contains most recent state for note-123
- Compaction keeps last 1,000 lines (including this one)
- No data loss, continuous editing preserved

## Testing Strategy

### Unit Tests

- ActivityLogger: Line replacement logic
- ActivityLogger: Compaction (keep last 1,000)
- ActivitySync: Watermark tracking
- ActivitySync: Gap detection
- CRDTManager: reloadNote() merges updates correctly

### E2E Tests

1. **Two windows, same instance**: Edit in window A, verify update in window B
2. **Two instances**: Edit in instance A, verify update in instance B
3. **Continuous editing**: Edit same note 100 times, verify log has 1 entry
4. **Switching notes**: Edit note A, then B, then A - verify 3 entries
5. **Compaction**: Create 1,100 entries, trigger compaction, verify 1,000 remain
6. **Gap detection**: Manually delete old entries, verify full scan triggered
7. **Orphaned cleanup**: Create old log file, verify cleanup after 7 days

## Future Enhancements

### Mobile Support

Same architecture applies to mobile:

```typescript
// iOS/Android native layer
import { ActivityLogger, ActivitySync } from '@notecove/shared';

const logger = new ActivityLogger(mobileFileSystemAdapter, deviceInstanceId, activityDirPath);
```

### Conflict Resolution

CRDT (Yjs) handles conflicts automatically. No additional conflict resolution needed in activity log layer.

### Performance Optimization

If 1,000-line logs become too large (unlikely):

- Compress logs (gzip)
- Use binary format instead of text
- Reduce retention to 500 lines

Not needed currently - 60KB is negligible.

## References

- Yjs Documentation: https://docs.yjs.dev/
- CRDT Background: https://crdt.tech/
- Node.js fs.watch(): https://nodejs.org/api/fs.html#fswatchfilename-options-listener

---

**Document Version:** 1.0
**Last Updated:** 2025-10-26
**Author:** NoteCove Team
