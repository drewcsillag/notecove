# Phase 4.1bis.1: Robust Cross-SD Note Moves

**Overall Progress:** `0%` (0/57 tasks complete)

**Status:** 🟥 To Do

**Architecture Doc:** [docs/architecture/cross-sd-move-state-machine.md](./docs/architecture/cross-sd-move-state-machine.md)

---

## Overview

Implement a robust state machine-based system for cross-SD note moves that handles crashes, multi-instance coordination, and provides recovery tools for stuck or corrupted states.

**Problem:** Current move implementation has non-atomic operations that can leave notes in inconsistent states if the app crashes mid-move or if multiple instances are running.

**Solution:** Three-phase implementation with SD identification, atomic move operations with state tracking, and user-facing recovery tools.

---

## Phase 4.1bis.1.1: SD UUIDs + Move State Machine

**Progress:** `0%` (0/26 tasks complete)

### 1. SD UUID System

- [ ] 🟥 **Add SD_ID file support**
  - [ ] 🟥 Create SD_ID file when SD is first initialized
  - [ ] 🟥 Generate UUID using standard UUID format
  - [ ] 🟥 Write UUID to `{sd-path}/SD_ID` file
  - [ ] 🟥 Read UUID on SD mount/startup

- [ ] 🟥 **Implement UUID migration for existing SDs (Option C)**
  - [ ] 🟥 Try to read existing SD_ID file on startup
  - [ ] 🟥 If missing, generate new UUID and write file
  - [ ] 🟥 Immediately read back to detect race condition (another instance may have written first)
  - [ ] 🟥 If UUID changed, adopt the existing one (another instance won the race)
  - [ ] 🟥 Note: Race condition window could be minutes depending on sync speed, but chance of collision is low due to infrequent SD operations

- [ ] 🟥 **Update database schema**
  - [ ] 🟥 Add `uuid` column to `storage_dirs` table (TEXT)
  - [ ] 🟥 Create index on `uuid` column for fast lookups
  - [ ] 🟥 Update SD initialization code to store UUID in database

- [ ] 🟥 **Add SD lookup by UUID**
  - [ ] 🟥 Implement `findSDByUuid(uuid: string)` method
  - [ ] 🟥 Return SD info including database ID and filesystem path
  - [ ] 🟥 Handle case where SD is not currently mounted

### 2. Move State Machine

- [ ] 🟥 **Create note_moves table**
  - [ ] 🟥 Define schema with columns: id, note_id, source_sd_uuid, target_sd_uuid, target_folder_id, state, initiated_by, initiated_at, last_modified, source_sd_path, target_sd_path, error
  - [ ] 🟥 Create indexes on state, note_id, and last_modified columns
  - [ ] 🟥 Add migration to create table on app startup

- [ ] 🟥 **Implement state transitions**
  - [ ] 🟥 Define state enum: initiated, copying, files_copied, db_updated, cleaning, completed, cancelled, rolled_back
  - [ ] 🟥 Implement state update function with timestamp tracking
  - [ ] 🟥 Add validation to ensure valid state transitions

- [ ] 🟥 **Implement atomic move operation**
  - [ ] 🟥 Create temporary directory for file copying (`.moving-{noteId}` in target SD)
  - [ ] 🟥 Copy CRDT files to temporary directory (state: copying)
  - [ ] 🟥 Mark files copied (state: files_copied)
  - [ ] 🟥 Begin SQL transaction
  - [ ] 🟥 Insert note into target SD database
  - [ ] 🟥 Delete note from source SD database
  - [ ] 🟥 Commit transaction (state: db_updated)
  - [ ] 🟥 Atomic rename from temp directory to final location
  - [ ] 🟥 Delete source CRDT files (state: cleaning)
  - [ ] 🟥 Mark move completed (state: completed)

- [ ] 🟥 **Implement error handling**
  - [ ] 🟥 Rollback transaction on database errors
  - [ ] 🟥 Clean up temporary directory on failure
  - [ ] 🟥 Mark move as rolled_back with error message
  - [ ] 🟥 Log detailed error information for debugging

### 3. Recovery Logic

- [ ] 🟥 **Implement startup recovery**
  - [ ] 🟥 Query for incomplete moves (state not in completed, cancelled, rolled_back)
  - [ ] 🟥 Filter for moves initiated by current instance (instance ownership)
  - [ ] 🟥 Check if both source and target SDs are accessible
  - [ ] 🟥 Resume move from current state
  - [ ] 🟥 Log warning for stale moves from other instances (>5 minutes old)

- [ ] 🟥 **Implement state-specific recovery**
  - [ ] 🟥 Handle recovery from 'initiated' state (start fresh)
  - [ ] 🟥 Handle recovery from 'copying' state (clean temp dir, restart)
  - [ ] 🟥 Handle recovery from 'files_copied' state (continue with DB update)
  - [ ] 🟥 Handle recovery from 'db_updated' state (verify DB, continue with file finalization)
  - [ ] 🟥 Handle recovery from 'cleaning' state (retry file operations)

### 4. Cleanup & Maintenance

- [ ] 🟥 **Implement move record cleanup**
  - [ ] 🟥 Clean up completed/cancelled/rolled_back moves older than 30 days
  - [ ] 🟥 Run cleanup on app startup
  - [ ] 🟥 Run cleanup once per day in background

### 5. Integration & Testing

- [ ] 🟥 **Update existing move operation**
  - [ ] 🟥 Replace current move logic with state machine implementation
  - [ ] 🟥 Keep conflict resolution before creating move record
  - [ ] 🟥 Update IPC handlers to use new move system

- [ ] 🟥 **Write unit tests**
  - [ ] 🟥 Test UUID generation and reconciliation
  - [ ] 🟥 Test state machine transitions
  - [ ] 🟥 Test move record CRUD operations
  - [ ] 🟥 Test cleanup logic (30-day retention)

- [ ] 🟥 **Write integration tests with controlled interruption**
  - [ ] 🟥 Refactor move executor to be step-based for testing
  - [ ] 🟥 Test recovery from each state (initiated, copying, files_copied, db_updated, cleaning)
  - [ ] 🟥 Test handling of missing SD access during recovery
  - [ ] 🟥 Test stale move detection and warning

- [ ] 🟥 **Write E2E tests**
  - [ ] 🟥 Test basic move flow (happy path with state machine)
  - [ ] 🟥 Test conflict resolution flows
  - [ ] 🟥 Manual testing for multi-instance scenarios (too complex to automate)

- [ ] 🟥 **Add fuzz testing for multi-instance sync**
  - [ ] 🟥 Extend fuzz test to include moves in progress
  - [ ] 🟥 Test sloppy sync scenarios (delayed file visibility)
  - [ ] 🟥 Verify eventual consistency regardless of observation order
  - [ ] 🟥 Test handling when instance cannot see source SD
  - [ ] 🟥 Ensure no data loss or corruption in any scenario

**Acceptance Criteria:**

- All SDs have UUIDs stored in SD_ID files
- Move operations use state machine for atomicity
- Recovery logic handles crashes at any point in move operation
- Stale moves (>5 minutes) are detected and logged
- Move records are cleaned up after 30 days
- All unit and integration tests pass
- Fuzz testing validates eventual consistency across instances

---

## Phase 4.1bis.1.2: Basic Recovery Panel

**Progress:** `0%` (0/16 tasks complete)

### 1. Recovery Panel UI

- [ ] 🟥 **Add Recovery & Diagnostics section to Settings**
  - [ ] 🟥 Create new tab or section in Settings dialog
  - [ ] 🟥 Display list of stuck operations
  - [ ] 🟥 Show operation details (note title, source/target SDs, state, age)
  - [ ] 🟥 Add actions: Take Over, Cancel, View Details

### 2. Stuck Operations Display

- [ ] 🟥 **Implement stuck operations detection**
  - [ ] 🟥 Query for incomplete moves from all instances
  - [ ] 🟥 Filter for moves older than 5 minutes
  - [ ] 🟥 Display with warning icon and age
  - [ ] 🟥 Show which instance initiated the move

### 3. Manual Takeover Flow

- [ ] 🟥 **Implement takeover verification**
  - [ ] 🟥 Check current instance has access to both source and target SDs
  - [ ] 🟥 Verify target folder exists (fallback to All Notes if missing)
  - [ ] 🟥 Show list of warnings if any (missing folder, etc.)

- [ ] 🟥 **Implement takeover confirmation dialog**
  - [ ] 🟥 Show move details (note, source SD, target SD, folder)
  - [ ] 🟥 Display warning about taking over another instance's operation
  - [ ] 🟥 Offer choices: Complete Move, Cancel Move, Back

- [ ] 🟥 **Implement takeover execution**
  - [ ] 🟥 Update move record to claim ownership (change initiated_by to current instance)
  - [ ] 🟥 Update last_modified timestamp
  - [ ] 🟥 Resume move from current state if completing
  - [ ] 🟥 Rollback and clean up if cancelling

### 4. Basic Diagnostics

- [ ] 🟥 **Display diagnostic summary**
  - [ ] 🟥 Show count of incomplete moves
  - [ ] 🟥 Show count of stale moves
  - [ ] 🟥 Display "No issues detected" when clean

### 5. Testing

- [ ] 🟥 **Write unit tests for recovery UI**
  - [ ] 🟥 Test stuck operation detection
  - [ ] 🟥 Test takeover verification logic
  - [ ] 🟥 Test takeover execution

- [ ] 🟥 **Manual testing**
  - [ ] 🟥 Create stuck move by manually editing database
  - [ ] 🟥 Verify recovery panel displays it
  - [ ] 🟥 Test takeover from different instance
  - [ ] 🟥 Verify move completes or cancels correctly

**Acceptance Criteria:**

- Recovery panel displays stuck operations with relevant details
- Manual takeover works for stuck moves
- User can cancel stuck moves
- Warnings shown for missing SD access or folders
- Diagnostics provide clear status of system health

---

## Phase 4.1bis.1.3: Advanced Recovery + Backup/Restore

**Progress:** `0%` (0/15 tasks complete)

### 1. Advanced Diagnostics

- [ ] 🟥 **Implement duplicate notes detection**
  - [ ] 🟥 Scan for notes with same ID in multiple SDs
  - [ ] 🟥 Load and display content preview for both copies
  - [ ] 🟥 Show metadata (modified date, size, block count)
  - [ ] 🟥 Actions: Keep This, View Full, Keep Both (Rename One), Merge Manually

- [ ] 🟥 **Implement orphaned CRDT files detection**
  - [ ] 🟥 Scan for CRDT note directories without database entries
  - [ ] 🟥 Load CRDT and render content preview
  - [ ] 🟥 Show metadata (file modified date, size, block count)
  - [ ] 🟥 Actions: Import to SD, Delete, View Full

- [ ] 🟥 **Implement missing CRDT files detection**
  - [ ] 🟥 Find database entries without corresponding CRDT files
  - [ ] 🟥 Show note metadata from database
  - [ ] 🟥 Actions: Delete Database Entry, Restore from Backup

- [ ] 🟥 **Implement stale migration lock detection**
  - [ ] 🟥 Scan for .migration-lock files older than 1 hour
  - [ ] 🟥 Action: Remove Lock

- [ ] 🟥 **Implement orphaned activity log detection**
  - [ ] 🟥 Find activity logs for instances not seen in 30+ days
  - [ ] 🟥 Show size and last activity timestamp
  - [ ] 🟥 Action: Clean Up (delete log file)

### 2. Backup System

- [ ] 🟥 **Implement backup infrastructure**
  - [ ] 🟥 Create backup directory in user data path (default location)
  - [ ] 🟥 Support custom backup location in settings
  - [ ] 🟥 Implement backup format (tar.gz with SD contents)
  - [ ] 🟥 Store backup metadata (SD UUID, timestamp, note count, folder count)

- [ ] 🟥 **Implement pre-operation snapshots**
  - [ ] 🟥 Automatically create backup before risky operations (takeover, manual recovery)
  - [ ] 🟥 Always backup as-is (no packing) for speed and safety
  - [ ] 🟥 Include database and CRDT files for affected notes only (minimal backup)
  - [ ] 🟥 Retention: 7 days for automatic snapshots

- [ ] 🟥 **Implement manual backups**
  - [ ] 🟥 Add "Create Manual Backup" button in settings
  - [ ] 🟥 Allow selection of which SDs to backup
  - [ ] 🟥 Optional checkbox: "Pack and snapshot before backup" (slower but cleaner)
  - [ ] 🟥 Include full SD contents (database + all CRDT files)
  - [ ] 🟥 Retention: Until user manually deletes

### 3. Restore System

- [ ] 🟥 **Implement SD restore from backup**
  - [ ] 🟥 Add "Import SD from backup" option in Add Storage Directory flow
  - [ ] 🟥 List available backups with metadata
  - [ ] 🟥 Offer "Restore to Original Location" and "Restore to..." options
  - [ ] 🟥 Extract backup contents to selected location
  - [ ] 🟥 Register restored SD in database

### 4. Testing

- [ ] 🟥 **Write unit tests**
  - [ ] 🟥 Test duplicate detection logic
  - [ ] 🟥 Test orphaned file detection
  - [ ] 🟥 Test backup creation and format
  - [ ] 🟥 Test restore process

- [ ] 🟥 **Integration tests**
  - [ ] 🟥 Test end-to-end backup and restore
  - [ ] 🟥 Test pre-operation snapshot creation
  - [ ] 🟥 Test content preview rendering

- [ ] 🟥 **Manual testing**
  - [ ] 🟥 Test duplicate notes resolution with real content
  - [ ] 🟥 Test orphaned CRDT import flow
  - [ ] 🟥 Test backup/restore with real SD data

**Acceptance Criteria:**

- Duplicate notes can be resolved with side-by-side content preview
- Orphaned CRDT files can be previewed and imported
- Missing CRDT files are detected and can be cleaned up
- Backup system works for both pre-operation snapshots and manual backups
- SD restore from backup works correctly
- All recovery scenarios work end-to-end
- User can confidently recover from any data inconsistency

---

## Success Criteria Summary

### Overall Goals

- Cross-SD moves are atomic and crash-resistant
- Multi-instance coordination works correctly (instance ownership + manual takeover)
- Users have tools to recover from any stuck or corrupted state
- Data loss is prevented in all scenarios
- System provides visibility into health and issues

### Metrics

- Zero data loss from move operations
- Zero duplicate notes after move completion
- <1% of moves require manual intervention (under normal operation)
- Recovery time from crash: <5 seconds (automatic recovery on restart)
- User satisfaction with recovery tools: Clear, actionable, confidence-inspiring

---

## Related Documentation

- **Architecture:** [docs/architecture/cross-sd-move-state-machine.md](./docs/architecture/cross-sd-move-state-machine.md)
- **SD Versioning:** `packages/shared/src/storage/versioning/`
- **Activity Sync:** [docs/architecture/activity-log-sync.md](./docs/architecture/activity-log-sync.md)
- **Current Move Logic:** `packages/desktop/src/main/ipc/handlers.ts:779-890`

---

## Design Decisions

### Why Option A (Instance Ownership) + Manual Option B (Takeover)?

- Avoids race conditions between instances trying to complete the same move
- Handles common case where instance comes back after crash
- Gives user control when they need access from a different location (e.g., laptop at home while at work)
- Generalizable pattern for other stuck/corrupted state recovery

### Why 30-Day Retention?

- Handles vacation scenarios (user away for 2 weeks)
- Provides debugging window for investigating issues
- Prevents database bloat while keeping useful history

### Why Temporary Directories?

- Provides natural isolation between instances (files hidden until committed)
- Atomic rename after commit ensures consistency
- App logic ignores directories starting with `.`
- No special ActivitySync coordination needed

### Why No Packing for Pre-Operation Backups?

- Speed matters - user is waiting to proceed with risky operation
- Safety matters - don't want the "safety" operation itself to be risky
- Want exact current state, warts and all
- If something is already broken, capture that broken state for analysis

---

## Migration Notes

### Schema Changes

- Add `uuid` column to `storage_dirs` table
- Create `note_moves` table with state machine fields
- Create indexes for performance
- All changes backward compatible (old versions ignore new tables/columns)

### File System Changes

- Add `SD_ID` file to each SD root directory
- Add `.moving-{noteId}` temporary directories during moves (cleaned up after)
- Add `.backups/` directory in user data path (optional, created on first backup)

### No Breaking Changes

- SD_VERSION remains at 1 (these are additive features)
- Old clients can still read/write SDs (they just won't use UUID features)
- New clients gracefully handle SDs without SD_ID files (auto-generate on first access)
