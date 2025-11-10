# Backup & Recovery

NoteCove includes powerful tools to protect your data and recover from unexpected issues. Access these features through **Settings → Recovery** tab.

## Backup System

### Manual Backups

Create complete backups of your Storage Directories for safekeeping:

1. Open Settings (`Cmd+,` / `Ctrl+,`)
2. Go to the **Recovery** tab
3. Click **Create Backup**
4. Select which Storage Directory to backup
5. Choose backup options:
   - **Normal Backup**: Fast, preserves exact current state
   - **Pack and Snapshot** (optional): Optimizes file size (takes longer)
6. Add an optional description
7. Click **Create**

**Backup Contents**:

- All notes (database + CRDT files)
- Folder structure and organization
- Tags and tag associations
- Storage Directory metadata
- Settings and configuration

**Storage Location**: Backups are stored in your user data directory under `.backups/`. You can change this location in Settings.

**Retention**: Manual backups are kept until you delete them manually.

### Pre-Operation Snapshots

NoteCove automatically creates safety snapshots before risky operations:

- **When**: Before bulk operations that modify multiple notes
- **Retention**: Automatically deleted after 7 days
- **Speed**: Always uses fast backup (no packing)
- **Purpose**: Safety net for "undo" if something goes wrong

These snapshots capture only the affected notes, not your entire Storage Directory, for faster recovery.

## Restore System

### Restoring from Backup

Recover your data from a previous backup:

1. Open Settings → **Recovery** tab
2. Click **View Backups**
3. Select a backup from the list (shows timestamp, size, note count)
4. Click **Restore**
5. Choose restore options:
   - **Restore as Original**: Replaces the original Storage Directory (if it exists)
   - **Restore as New**: Creates a new Storage Directory with the backup contents
6. Select destination folder
7. Click **Restore**

**After Restore**:

- The restored Storage Directory is automatically registered in NoteCove
- All notes and folders from the backup are available immediately
- Tags are automatically extracted and indexed from note content
- If restored as new, you'll have both the original and restored SDs

## Recovery & Diagnostics

The Recovery tab provides tools to detect and fix data inconsistencies:

### Stuck Operations

**What**: Cross-SD note moves that didn't complete (e.g., app crashed mid-move)

**Detection**: Operations older than 5 minutes are flagged

**Actions**:

- **View Details**: See move state, source/target SDs, note info
- **Take Over**: Resume the operation from this instance
- **Cancel**: Roll back and clean up

**When to Use**: If you see a stuck operation from another instance (e.g., you started a move on your laptop but need to complete it from your desktop).

### Duplicate Notes Detection

**What**: Notes with the same ID appearing in multiple Storage Directories

**Causes**: Rare edge cases in multi-instance synchronization

**Actions**:

- **View Both Copies**: See content preview and metadata side-by-side
- **Delete Duplicate**: Keep one copy, remove the other

### Orphaned CRDT Files

**What**: Note files on disk that don't have corresponding database entries

**Causes**: Incomplete operations, manual file system changes

**Actions**:

- **Preview Content**: See what the note contains
- **Import to SD**: Re-add the note to NoteCove's database

### Missing CRDT Files

**What**: Database entries for notes that don't have files on disk

**Causes**: Accidental deletion, file system corruption

**Actions**:

- **Delete Entry**: Clean up the orphaned database record

### Stale Migration Locks

**What**: Migration lock files older than 1 hour

**Causes**: App crash during database migration

**Actions**:

- **Remove Lock**: Allows migrations to proceed again

### Orphaned Activity Logs

**What**: Activity logs from instances not seen in 30+ days

**Causes**: Old installations, retired devices

**Actions**:

- **Clean Up**: Remove old logs to free disk space

## Best Practices

### Regular Backups

- Create manual backups before major operations
- Back up before upgrading NoteCove
- Consider weekly backups for important data

### Multi-Storage Directory Setup

- Use multiple SDs for organization (work, personal, etc.)
- Each SD can be backed up independently
- Easier to restore specific data sets

### Cloud Sync + Local Backups

- Store your Storage Directories in cloud sync folders (Dropbox, etc.)
- Create local backups as additional protection
- You get both real-time sync and point-in-time restore

### Monitoring

- Check the Recovery tab periodically for diagnostics
- Address stuck operations promptly
- Clean up old activity logs to save space

## Troubleshooting

### "Cannot restore: target exists"

The destination folder already contains a Storage Directory. Either:

- Choose a different destination folder
- Delete the existing SD first
- Use "Restore as New" to create alongside it

### "Backup failed: disk full"

Free up disk space or change backup location to a drive with more space (Settings → Recovery → Backup Location).

### "Stuck operation from this instance"

A move operation started on this device didn't complete. Click "Take Over" to resume it. If it fails repeatedly, click "Cancel" to roll back.

### "Duplicate notes detected"

Compare both copies using "View Both Copies". Keep the one with the latest changes, then delete the other.

## Advanced Topics

### Database Doctor Tool

The `db-doctor` tool helps diagnose and repair database integrity issues, particularly orphaned data from deleted Storage Directories.

**Location**: `tools/db-doctor.js` in the NoteCove repository

**When to Use**:
- You're getting "duplicate note" errors when restoring backups
- Notes from deleted Storage Directories are still appearing
- You suspect database corruption after crashes or forced quits

**Basic Usage**:

```bash
# Check for issues (read-only)
node tools/db-doctor.js /path/to/notecove.db

# Check and automatically fix issues
node tools/db-doctor.js /path/to/notecove.db --fix
```

**Common Database Paths**:

- **macOS**: `~/Library/Application Support/@notecove/desktop/notecove.db`
- **Linux**: `~/.config/@notecove/desktop/notecove.db`
- **Windows**: `%APPDATA%\@notecove\desktop\notecove.db`

**What It Checks**:

1. **Orphaned Notes**: Notes from Storage Directories that no longer exist
2. **Orphaned Folders**: Folders from deleted Storage Directories
3. **Orphaned Tag Associations**: Tag links for deleted notes
4. **Unused Tags**: Tags with no notes (cleaned up automatically)

**Example Output**:

```
🔍 Database Doctor

Database: /Users/you/Library/Application Support/@notecove/desktop/notecove.db
Mode: CHECK ONLY

📝 Checking for orphaned notes...
❌ Found 3 orphaned note(s):
   - abc123... "Old Note" (sd_id: deleted-sd, created: 2024-01-15)
   Run with --fix to remove these orphaned notes

📁 Checking for orphaned folders...
✅ No orphaned folders found

🏷️  Checking for orphaned tag associations...
✅ No orphaned tag associations found

============================================================
⚠️  Issues found. Run with --fix to repair.
```

**Safety Notes**:
- Always backup your database before running with `--fix`
- The tool only removes data from SDs that no longer exist
- NoteCove automatically runs this cleanup on startup (as of v0.2.0)

### Backup File Format

Backups use a directory structure:

```
backup-{timestamp}/
  metadata.json         # Backup metadata
  databases/           # SQLite databases
  crdt/               # Note CRDT files
  folders/            # Folder tree data
```

**Note**: Backups are not encrypted. Store them securely.

### Recovery from Catastrophic Failure

If NoteCove won't start:

1. Locate your Storage Directories (default: `~/Documents/NoteCove/`)
2. Copy them to a safe location
3. Reinstall NoteCove
4. Use "Add Storage Directory" to re-add your data
5. Or use "Restore from Backup" if you have backups

### Multi-Instance Coordination

When running multiple NoteCove instances (different computers):

- Stuck operations from other instances show which instance started them
- Use "Take Over" to continue an operation from a different device
- Instance IDs are shown for debugging multi-device scenarios

## Next Steps

- [Learn about sync configuration](/guide/sync-configuration)
- [Understand CRDT architecture](/architecture/crdt-sync)
- [Explore advanced features](/features/)
