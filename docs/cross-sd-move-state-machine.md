# Cross-SD Move State Machine Architecture

## Overview

This document describes the architecture for robust cross-SD (Storage Directory) note moves that can survive crashes, handle multi-instance coordination, and provide user-facing recovery tools.

## Problem Statement

The current cross-SD move implementation has several critical issues:

1. **Non-Atomic Operations**: Move involves multiple steps (database insert, database delete, file copy, file delete) that aren't wrapped in a single atomic operation
2. **No Crash Recovery**: If the app crashes mid-move, a note may exist in both SDs, neither SD, or have inconsistent database/file state
3. **Multi-Instance Conflicts**: Multiple instances can see inconsistent state during moves
4. **No SD Identification**: SDs have no global identifier, making cross-instance coordination impossible
5. **No Recovery Tools**: Users have no way to fix stuck or corrupted states

### Real-World Failure Scenario

User reported: "create note A with content 'A', create SD, move note A to second SD, restart app, note A shows in second SD, edit note A and add some text, restart APP, note A shows in default SD"

**Root cause**: The move operation had these non-atomic steps:

1. Insert note into target SD database
2. Delete note from source SD database
3. Copy CRDT files to target SD
4. Delete CRDT files from source SD

If the app crashed between steps 1-2, the note existed in **both** databases. When `getNote(noteId)` was called (which doesn't filter by SD), it returned an arbitrary row. The CRDT files were only copied, not deleted, so the source SD could "resurrect" the note on restart.

## Requirements

### Functional Requirements

1. **Atomicity**: Move operations must be all-or-nothing (note exists in exactly one SD)
2. **Crash Recovery**: App must detect and complete incomplete moves on startup
3. **Multi-Instance Safe**: Multiple instances must coordinate without conflicts
4. **User Recovery**: Provide UI for manually intervening when operations are stuck
5. **Data Integrity**: Never lose note data, even in worst-case scenarios
6. **Eventual Consistency**: All instances must eventually converge to the same state

### Non-Functional Requirements

1. **Performance**: Moves should complete in <500ms under normal conditions
2. **Transparency**: Users should see clear status for operations in progress
3. **Reliability**: <1% of moves should require manual intervention
4. **Debuggability**: All state transitions should be logged for troubleshooting

## Architecture

### SD UUID System

Each SD needs a globally unique identifier that persists across instances.

**Storage Structure:**

```
/path/to/sd/
  SD_ID             ← UUID file (e.g., "sd_abc123-def4...")
  SD_VERSION        ← Existing version marker
  notes/
  folders/
  activity/
```

**UUID Generation:**

When an instance first accesses an SD:

1. Try to read `SD_ID` file
2. If missing, generate a new UUID and write it
3. Immediately read it back
4. If UUID changed (another instance wrote first), adopt theirs
5. Store UUID in local database's `storage_dirs.uuid` column

**Race Condition Handling:**

The race window could be minutes (depending on file sync speed), but the probability of collision is low because SD creation/addition is infrequent. Even if two instances generate different UUIDs:

- One will "win" (write first)
- Other will detect and adopt the winner's UUID
- Eventually consistent within file sync latency

**Database Schema:**

```sql
ALTER TABLE storage_dirs ADD COLUMN uuid TEXT;
CREATE INDEX idx_storage_dirs_uuid ON storage_dirs(uuid);
```

### Move State Machine

**State Table Schema:**

```sql
CREATE TABLE note_moves (
  id TEXT PRIMARY KEY,              -- UUID for the move operation
  note_id TEXT NOT NULL,            -- Note being moved
  source_sd_uuid TEXT NOT NULL,     -- Source SD UUID (not database ID)
  target_sd_uuid TEXT NOT NULL,     -- Target SD UUID (not database ID)
  target_folder_id TEXT,            -- Target folder (NULL = All Notes)

  state TEXT NOT NULL,              -- Current state (see transitions below)

  initiated_by TEXT NOT NULL,       -- Instance ID that started the move
  initiated_at INTEGER NOT NULL,    -- Timestamp (milliseconds)
  last_modified INTEGER NOT NULL,   -- Timestamp (milliseconds)

  -- Metadata for recovery/debugging
  source_sd_path TEXT,              -- Original path (informational only)
  target_sd_path TEXT,              -- Original path (informational only)
  error TEXT                        -- Last error message if any
);

CREATE INDEX idx_note_moves_state ON note_moves(state);
CREATE INDEX idx_note_moves_note_id ON note_moves(note_id);
CREATE INDEX idx_note_moves_last_modified ON note_moves(last_modified);
```

**State Transitions:**

```
  initiated
      ↓
  copying          (Files being copied to temp dir .moving-{noteId})
      ↓
  files_copied     (Files in temp dir, ready for commit)
      ↓
  db_updated       (Database transaction committed)
      ↓
  cleaning         (Deleting source files)
      ↓
  completed        (Success! Ready for cleanup after 30 days)

Failure states:
  → cancelled      (User cancelled)
  → rolled_back    (Error occurred, changes reverted)
```

**Why These States?**

Each state represents a checkpoint where recovery can resume:

- `initiated`: Nothing done yet, safe to restart
- `copying`: Temp files may exist, can delete and restart
- `files_copied`: Temp files ready, proceed to database update
- `db_updated`: Database consistent, finish file operations
- `cleaning`: Almost done, retry cleanup
- `completed`: Done, can be garbage collected

### Atomic Move Operation

**Key Principle: Temporary Directories for Isolation**

Files are copied to a temporary directory (`.moving-{noteId}`) that's invisible to the app until the database transaction commits. This provides:

- **Natural multi-instance isolation**: Other instances can't see in-progress moves
- **Atomic visibility**: Files appear atomically after rename
- **Simple cleanup**: Just delete the temp directory on failure

**Operation Steps:**

1. **Create Move Record** (state: `initiated`)
   - Generate move ID (UUID)
   - Record source/target SD UUIDs, folder, instance ID
   - Write to database

2. **Copy Files** (state: `copying`)
   - Create `.moving-{noteId}` directory in target SD
   - Copy all CRDT files from source to temp directory
   - Update state to `files_copied`

3. **Database Transaction** (state: `files_copied` → `db_updated`)
   - Begin SQL transaction
   - Insert note into target SD database
   - Delete note from source SD database
   - Commit transaction
   - Update state to `db_updated`
   - On error: rollback transaction, mark as `rolled_back`

4. **Finalize Files** (state: `db_updated` → `cleaning`)
   - Atomic rename: `.moving-{noteId}` → `{noteId}`
   - Delete source CRDT files
   - Update state to `cleaning`

5. **Complete** (state: `cleaning` → `completed`)
   - Mark move as completed
   - Eligible for cleanup after 30 days

**Why Temporary Directories?**

- **Crash between copy and commit**: Temp files are orphaned, cleaned up on recovery
- **Crash after commit**: Temp files exist alongside final location, recovery can detect and clean up
- **ActivitySync coordination**: Other instances only see final directory (no special handling needed)

### Multi-Instance Coordination

**Primary Strategy: Instance Ownership (Option A)**

Each move is owned by the instance that initiated it. Only that instance will automatically resume the move on startup.

**Benefits:**

- No race conditions between instances
- Clear ownership and responsibility
- Simple recovery logic

**When it works:**

- Instance crashes but eventually restarts → resumes automatically
- User closes app → resumes on next launch
- Common case (>99% of scenarios)

**Secondary Strategy: Manual Takeover (Option B)**

When a move is stuck (original instance not coming back), user can manually take over from another instance via the Recovery Panel.

**When needed:**

- Original instance machine is geographically distant (laptop at home while at work)
- Original instance machine is offline/broken
- User wants immediate access to stuck notes
- Rare case (<1% of scenarios)

**Stale Move Detection:**

If a move hasn't progressed in >5 minutes and the initiating instance isn't the current instance, log a warning:

```
[Recovery] Move {id} appears stuck (started by {instance}).
Check Recovery Panel to manually intervene.
```

### Recovery Logic

**Startup Recovery Process:**

When the app starts:

1. Query for incomplete moves:

   ```sql
   SELECT * FROM note_moves
   WHERE state NOT IN ('completed', 'cancelled', 'rolled_back')
   ```

2. For each incomplete move:
   - **If I didn't initiate it**: Check if stale (>5 min), log warning, skip
   - **If I initiated it**: Check SD access, resume from current state

3. **SD Access Check**:
   - Look up source SD by UUID → get filesystem path
   - Look up target SD by UUID → get filesystem path
   - If either is missing, log warning and skip (can't resume)

4. **State-Specific Resume**:

   **From `initiated`**:
   - Nothing done yet
   - Start move from beginning

   **From `copying`**:
   - Temp directory may be partially created
   - Delete temp directory (cleanup)
   - Restart copy operation

   **From `files_copied`**:
   - Temp directory complete
   - Proceed directly to database transaction

   **From `db_updated`**:
   - Database transaction committed successfully
   - Verify note exists in target database
   - If yes: continue with file finalization
   - If no: transaction may have failed, rollback

   **From `cleaning`**:
   - File rename may have succeeded or failed
   - Check if final directory exists
   - If yes: delete source files only
   - If no: retry rename, then delete source

**Error Handling:**

If recovery fails:

- Mark move as `rolled_back`
- Store error message in `error` column
- Log detailed information for debugging
- Move will appear in Recovery Panel for manual intervention

### Activity Sync Coordination

**Key Insight**: Instance B cannot see Instance A's database, only SD files.

**Natural Isolation via Temporary Directories:**

While move is in progress (states `copying`, `files_copied`):

- Files are in `.moving-{noteId}` directory
- App logic ignores directories starting with `.`
- Other instances don't see anything

After `db_updated` state:

- Files atomically renamed to `{noteId}`
- Other instances detect new directory via ActivitySync
- Normal note loading process applies

**No Special Coordination Needed**: The temporary directory pattern provides natural isolation. ActivitySync only triggers when final directory appears, which happens after the database is already consistent.

### Cleanup & Maintenance

**Retention Policy**: Keep move records for 30 days after completion.

**Why 30 Days?**

- Handles vacation scenarios (user away for 2 weeks)
- Provides debugging window
- Prevents database bloat

**Cleanup Process:**

```sql
DELETE FROM note_moves
WHERE state IN ('completed', 'cancelled', 'rolled_back')
  AND last_modified < (current_timestamp - 30 days)
```

Run on:

- App startup (after recovery)
- Once per day in background

**Temp Directory Cleanup:**

On startup, scan for orphaned `.moving-*` directories and clean them up:

- No matching `note_moves` record → delete
- Matching record in terminal state → delete
- Matching record in active state → let recovery handle it

## Recovery Panel UI

Provides visibility and control when things go wrong.

### Basic Recovery Panel (Phase 4.1bis.1.2)

**Location**: Settings → Recovery & Diagnostics

**Features**:

- List stuck operations (incomplete moves >5 min old)
- Show operation details (note, source/target SDs, state, age, initiating instance)
- Actions: Take Over, Cancel, View Details

**Stuck Operations Display:**

```
⚠️ Note move in progress
  Note: "Project ideas"
  From: Personal SD → Work SD
  Started: 2 hours ago (by instance abc123)
  State: copying
  [Take Over] [Cancel Move] [Details]
```

**Manual Takeover Flow:**

1. User clicks "Take Over"
2. Verify current instance has access to both SDs
3. Show confirmation dialog:
   - Move details
   - Warning about taking over another instance's operation
   - Choices: Complete Move, Cancel Move, Back
4. Execute takeover:
   - Update `initiated_by` to current instance ID
   - Update `last_modified` timestamp
   - Resume move from current state OR rollback if cancelling

### Advanced Recovery Panel (Phase 4.1bis.1.3)

**Additional Diagnostics:**

1. **Duplicate Notes**: Same note ID in multiple SDs
   - Side-by-side content preview
   - Metadata (modified date, size, blocks)
   - Actions: Keep This, View Full, Keep Both (Rename), Merge Manually

2. **Orphaned CRDT Files**: Note files without database entry
   - Content preview (load and render CRDT)
   - Metadata (file date, size, blocks)
   - Actions: Import to SD, Delete, View Full

3. **Missing CRDT Files**: Database entry without files
   - Database metadata
   - Actions: Delete Entry, Restore from Backup

4. **Stale Migration Locks**: `.migration-lock` >1 hour old
   - Action: Remove Lock

5. **Orphaned Activity Logs**: Logs for instances not seen in 30+ days
   - Size, last activity
   - Action: Clean Up

## Backup & Restore System

Provides safety net for risky operations and user confidence.

### Backup Types

**Pre-Operation Snapshots** (automatic):

- Created before risky operations (manual takeover, recovery actions)
- Always as-is (no packing) for speed and safety
- Minimal backup (database + CRDT files for affected notes only)
- Retention: 7 days

**Manual Backups** (user-initiated):

- Created from settings
- Optional packing before backup (checkbox)
- Full backup (database + all CRDT files + metadata)
- Retention: Until user deletes

### Storage Location

**Default**: User data directory (`app.getPath('userData')/backups/`)
**Optional**: Custom location (configured in settings)

### Backup Format

```
backup-{sdUuid}-{timestamp}.tar.gz
  ├── SD_ID
  ├── SD_VERSION
  ├── notecove.db
  ├── notes/
  │   ├── note_abc123/
  │   └── note_def456/
  └── folders/
```

**Metadata File** (stored alongside tar.gz):

```json
{
  "sdUuid": "sd_abc123-def4...",
  "timestamp": 1698765432000,
  "noteCount": 156,
  "folderCount": 8,
  "backupType": "manual" | "pre-operation",
  "triggerReason": "takeover-move-123"
}
```

### Restore Flow

**Location**: Settings → Storage Directories → Add Storage Directory → Import SD from backup

**Process**:

1. Show list of available backups with metadata
2. User selects backup
3. Offer restoration options:
   - Restore to Original Location (if SD_ID file provides path)
   - Restore to... (user chooses new location)
4. Extract backup to selected location
5. Register SD in database
6. Load SD in UI

## Testing Strategy

### Unit Tests

- UUID generation and reconciliation logic
- State machine transitions and validation
- Move record CRUD operations
- Cleanup logic (30-day retention)
- Backup creation and format validation
- Restore process

### Integration Tests (with Controlled Interruption)

**Challenge**: Need to interrupt operations at specific points to test recovery.

**Solution**: Refactor move executor to be step-based:

```typescript
interface MoveExecutor {
  executeStep(moveId: string, step: MoveStep): Promise<void>;
  getCurrentStep(moveId: string): Promise<MoveStep>;
}
```

**Test Structure**:

```typescript
test('recovery from files_copied state', async () => {
  // Execute up to checkpoint
  await executor.executeStep(moveId, 'initiated');
  await executor.executeStep(moveId, 'copying');
  await executor.executeStep(moveId, 'files_copied');

  // Simulate crash and restart
  const newExecutor = new MoveExecutor();
  await newExecutor.recoverIncompleteMoves();

  // Verify recovery completed successfully
  const move = await getMoveRecord(moveId);
  expect(move.state).toBe('completed');
});
```

**Test Coverage**:

- Recovery from each state (initiated, copying, files_copied, db_updated, cleaning)
- Handling of missing SD access
- Stale move detection
- Takeover from different instance
- Rollback scenarios

### E2E Tests

- Basic move flow with state machine (happy path)
- Conflict resolution flows (replace, keepBoth, cancel)
- Recovery panel UI interactions
- Backup and restore flows

### Fuzz Testing for Multi-Instance Sync

**Critical Addition**: Test eventual consistency in sloppy sync scenarios.

**Scenarios to test**:

1. **Move in Progress + Delayed Sync**:
   - Instance A starts move (state: copying)
   - Instance B syncs and sees temp directory
   - Verify Instance B ignores temp directory
   - Instance A completes move
   - Instance B eventually sees final directory
   - Verify eventual consistency

2. **Database Commit + Delayed File Sync**:
   - Instance A commits database (state: db_updated)
   - Instance B sees database change before files sync
   - Verify Instance B handles missing files gracefully
   - Files eventually sync to Instance B
   - Verify eventual consistency

3. **Missing Source SD**:
   - Instance A starts move from SD1 to SD2
   - Instance B only has SD2 mounted (not SD1)
   - Verify Instance B doesn't interfere
   - Verify Instance B can't take over (missing SD access)

4. **Partial Observations**:
   - Test random orderings of file sync events
   - Verify no corruption regardless of observation order
   - Verify all instances eventually converge

**Fuzz Test Configuration**:

```typescript
// Extend existing sync-fuzz-test.js
scenarios.push({
  name: 'sloppy-sync-with-moves',
  operations: [
    { type: 'create-note', noteId: 'A', content: 'Original' },
    { type: 'create-sd', sdId: 'SD2' },
    { type: 'move-note', noteId: 'A', targetSd: 'SD2' },
    { type: 'edit-note', noteId: 'A', content: 'Edited' },
    { type: 'verify-convergence' },
  ],
  syncDelays: { min: 100, max: 5000 }, // Sloppy sync
  instances: 3,
  iterations: 100,
});
```

**Success Criteria**:

- Zero data loss across all iterations
- Zero duplicate notes across all iterations
- All instances converge to same state
- No crashes or hangs

## Migration Strategy

### Backward Compatibility

**SD_VERSION stays at 1**: These features are additive, not breaking.

**Old clients**:

- Ignore `SD_ID` file (unknown file, no harm)
- Ignore `note_moves` table (unknown table, no harm)
- Can still read/write notes normally

**New clients**:

- Gracefully handle SDs without `SD_ID` (auto-generate)
- Gracefully handle SDs without `note_moves` table (create on startup)

### Schema Migrations

Run on app startup:

```sql
-- Add UUID to SDs if not exists
ALTER TABLE storage_dirs ADD COLUMN IF NOT EXISTS uuid TEXT;
CREATE INDEX IF NOT EXISTS idx_storage_dirs_uuid ON storage_dirs(uuid);

-- Create moves table if not exists
CREATE TABLE IF NOT EXISTS note_moves (
  -- schema defined above
);
CREATE INDEX IF NOT EXISTS idx_note_moves_state ON note_moves(state);
-- ... other indexes
```

### File System Changes

**Non-Destructive**:

- Add `SD_ID` file on first access (doesn't affect existing files)
- Create `.backups/` directory only when first backup is created
- Temp directories (`.moving-*`) are transient and cleaned up automatically

## Performance Considerations

### Move Operation Performance

**Target**: <500ms for typical note move

**Breakdown**:

- Conflict check: ~10ms (database query)
- Create move record: ~5ms (database insert)
- Copy CRDT files: ~100-200ms (depends on note size and disk speed)
- Database transaction: ~20ms (insert + delete + commit)
- File rename: ~10ms (atomic operation)
- Delete source files: ~50ms (recursive delete)

**Total**: ~200-300ms typical, well under 500ms target

**Optimization Opportunities**:

- Parallel file operations where safe
- Batch database operations
- Async cleanup (mark completed, delete source files in background)

### Recovery Overhead

**Startup recovery**: O(incomplete moves) queries + O(accessible moves) resume operations

**Expected**: <100ms for typical case (0-2 incomplete moves)

**Worst case**: Hundreds of stuck moves would take seconds, but this is a pathological scenario requiring manual intervention anyway

### Database Growth

**Move records retention**: 30 days

**Space per record**: ~500 bytes (text fields, timestamps)

**Growth rate**: If user does 100 moves/day → 3,000 records after 30 days → ~1.5 MB

**Conclusion**: Negligible database growth

## Security & Privacy Considerations

### SD UUID Privacy

UUIDs are stored locally and in SD directories. They don't contain user-identifying information but could theoretically be used to correlate SDs across devices if someone had filesystem access.

**Mitigation**: UUIDs stay local, never transmitted to servers (since NoteCove has no server component)

### Backup Security

Backups contain full note content and are stored locally.

**Recommendations**:

- Document that users should protect backup directory
- Support encrypted backup formats in future (Phase 5+)
- Respect OS file permissions

## Future Enhancements

### Phase 5+

- **Compressed backups**: Smaller file sizes for manual backups
- **Encrypted backups**: Password-protected backup files
- **Scheduled backups**: Automatic daily/weekly backups
- **Cloud backup integration**: Optional iCloud/Dropbox backup sync
- **Move operation batching**: Move multiple notes in single transaction
- **Cross-SD folder moves**: Move entire folders between SDs
- **Undo for moves**: One-click undo within 5 minutes of move

### Research Topics

- **Distributed consensus**: Could moves use Paxos/Raft for true multi-instance coordination?
  - Probably overkill for this use case (Option A + B already handles 99.9% of scenarios)
- **CRDT-based move tracking**: Could move operations themselves be CRDTs?
  - Interesting but complex, would need conflict resolution for competing moves

## References

- **SD Versioning System**: `packages/shared/src/storage/versioning/`
- **Activity Log Sync**: `docs/architecture/activity-log-sync.md`
- **CRDT Snapshot Packing**: `docs/architecture/crdt-snapshot-packing.md`
- **Current Move Implementation**: `packages/desktop/src/main/ipc/handlers.ts:779-890`

## Glossary

- **SD (Storage Directory)**: A folder containing notes, folders, and metadata for one logical notebook
- **CRDT**: Conflict-free Replicated Data Type (Yjs document for note content)
- **Instance**: One running copy of the NoteCove app (may be different windows or different machines)
- **Activity Sync**: Cross-instance notification system for note changes
- **State Machine**: Formal model with defined states and transitions
- **Atomic Operation**: Operation that either fully succeeds or fully fails (no partial state)
- **Eventual Consistency**: Property where all instances converge to same state given enough time
