# Cross-SD Move Bug Analysis

## Investigation Date

December 4, 2024

## Environment

- Machine A: macOS, production NoteCove app
- SD1: Local storage (`/Users/drew/Library/Application Support/@notecove/desktop/storage`)
- SD2: Google Drive (`/Users/drew/My Drive/Shared With Work/NoteCove-Shared`)
- Profile: `d42292bd-fd18-4636-8207-b0857db27842`

## Bug Reproduction

### User Actions

1. Move note from SD1 (local) to SD2 (Google Drive) on Machine A
2. Note appears in target folder on Machine A
3. Note does NOT appear in "All Notes" view of SD2
4. Note Info shows OLD filesystem path (SD1 path)
5. Note never appears on Machine B (which only has SD2)

### Database State (Production)

**Note record:**

```sql
SELECT id, title, sd_id, folder_id FROM notes WHERE id = 'd8a95b41-88f4-412e-8290-e5c243c11f39';
-- Result:
-- d8a95b41-88f4-412e-8290-e5c243c11f39 | Moved of Lexapro log | default | 5d04d272-a489-4a2b-8e3e-2598764ebd87
```

**Move record:**

```sql
SELECT * FROM note_moves WHERE note_id = 'd8a95b41-88f4-412e-8290-e5c243c11f39';
-- Result:
-- id: 5eab54cb-adfb-412c-bf3a-77c746edd69b
-- note_id: d8a95b41-88f4-412e-8290-e5c243c11f39
-- source_sd_uuid: fe9a5692-ed5b-4b27-abed-8bc66729b383 (Default/SD1)
-- target_sd_uuid: c3e42263-df32-4858-801e-9e02f40c9ade (Google Drive/SD2)
-- state: completed
-- source_sd_path: /Users/drew/Library/Application Support/@notecove/desktop/storage
-- target_sd_path: /Users/drew/My Drive/Shared With Work/NoteCove-Shared
```

**Storage directories:**

```sql
SELECT id, name, uuid FROM storage_dirs;
-- default | Default | fe9a5692-ed5b-4b27-abed-8bc66729b383
-- d3772c38-cb31-4d06-a661-05d9613d6586 | Google Drive | c3e42263-df32-4858-801e-9e02f40c9ade
```

**Folder (target):**

```sql
SELECT id, name, sd_id FROM folders WHERE id = '5d04d272-a489-4a2b-8e3e-2598764ebd87';
-- 5d04d272-a489-4a2b-8e3e-2598764ebd87 | psych | d3772c38-cb31-4d06-a661-05d9613d6586
```

### Filesystem State

**SD1 (source - should be empty):**

```
/Users/drew/Library/Application Support/@notecove/desktop/storage/notes/d8a95b41-88f4-412e-8290-e5c243c11f39/
└── logs/  (dated Dec 3 06:27)
```

Files STILL EXIST - should have been deleted!

**SD2 (target):**

```
/Users/drew/My Drive/Shared With Work/NoteCove-Shared/notes/d8a95b41-88f4-412e-8290-e5c243c11f39/
└── logs/  (dated Dec 3 22:16)
```

Files exist correctly.

## Key Findings

### Finding 1: Inconsistent Database State

| Field            | Expected            | Actual          |
| ---------------- | ------------------- | --------------- |
| `note.sd_id`     | `d3772c38...` (SD2) | `default` (SD1) |
| `note.folder_id` | SD2 folder          | ✓ SD2 folder    |
| `move.state`     | `completed`         | `completed`     |

The note's `folder_id` correctly points to SD2, but `sd_id` still points to SD1.
This explains why:

- Note appears in SD2's folder view (folder_id lookup)
- Note doesn't appear in SD2's "All Notes" (sd_id mismatch)
- Note Info shows SD1 path (sd_id-based path calculation)

### Finding 2: Source Files Not Deleted

The move is marked `completed` but source files still exist in SD1.
This violates the state machine contract - `completed` should mean cleanup finished.

### Finding 3: No Activity Log for Moves

`NoteMoveManager` does not write an activity log entry to the target SD.
This means other instances watching SD2 via ActivitySync have no notification.

### Finding 4: instanceId Bug

`handlers.ts:1033` passes empty string for instanceId:

```typescript
const moveId = await this.noteMoveManager.initiateMove({
  ...
  instanceId: '', // BUG: Should be actual instance ID
});
```

## Root Cause Hypotheses

### Hypothesis A: Transaction Bug

The `updateDatabase()` method (lines 674-733) executes:

1. DELETE note WHERE sd_id = source
2. INSERT note with sd_id = target

If DELETE succeeds but INSERT fails (or vice versa), state would be inconsistent.
However, both are in a transaction, so this seems unlikely unless transaction handling is broken.

### Hypothesis B: Race Condition / Re-import

After the move completes, something may re-import the note from SD1's CRDT files:

1. Move completes, note.sd_id = SD2
2. FileWatcher or ActivitySync triggers reload from SD1
3. Note re-imported with sd_id = SD1

This would explain why folder_id is correct (updated in move) but sd_id is wrong (overwritten by re-import).

### Hypothesis C: SQL Bug

The DELETE may use wrong sd_id value, causing it to not match any rows.
The INSERT then fails due to PRIMARY KEY conflict.

## Code Locations

| Component              | File                                                         | Lines    |
| ---------------------- | ------------------------------------------------------------ | -------- |
| Move handler           | `packages/desktop/src/main/ipc/handlers.ts`                  | 962-1050 |
| NoteMoveManager        | `packages/desktop/src/main/note-move-manager.ts`             | 1-991    |
| updateDatabase()       | `note-move-manager.ts`                                       | 653-735  |
| performSourceCleanup() | `note-move-manager.ts`                                       | 761-772  |
| ActivitySync           | `packages/shared/src/storage/activity-sync.ts`               | 1-483    |
| Design doc             | `website/technical_documents/cross-sd-move-state-machine.md` | 1-723    |

## Machine B Discovery Gap

Even if Machine A worked correctly, Machine B would still not see the note because:

1. **No activity log entry:** Move doesn't write to SD2/activity/
2. **ActivitySync only reloads known notes:** `fullScanAllNotes()` only iterates `getLoadedNotes()`
3. **No note directory scanning:** Nothing scans SD2/notes/ for unknown directories
4. **Note never in Machine B's database:** It was only in SD1, which Machine B doesn't have

The design doc incorrectly claims (lines 305-309):

> "After db_updated state: Other instances detect new directory via ActivitySync"

This is false - ActivitySync cannot detect new directories.
