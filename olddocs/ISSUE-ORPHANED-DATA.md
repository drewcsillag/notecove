# Issue: Orphaned Database Entries Causing False Duplicate Warnings

## Problem Summary

When attempting to restore a backup, users were getting false duplicate warnings like:

```
Error: Cannot restore: Found 2 duplicate note(s) and 0 duplicate folder(s)
that already exist in the following storage directory: .
```

The SD name showing as "." was a key clue that something was wrong.

## Root Cause

The database contained **orphaned notes and folders** from Storage Directories that had been deleted/unloaded but whose data wasn't properly cleaned up from the cache.

### Example from Investigation

Database state:

- **Current SDs**: `restoreit` and `Restore2` (two empty SDs)
- **Orphaned notes in database**:
  - "Controlled crash idea" with `sd_id = "default"` (no such SD exists!)
  - "Testing with #tags" with `sd_id = "default"` (no such SD exists!)
  - "Welcome to NoteCove" with `sd_id = "65182cb4..."` (no such SD exists!)

When the duplicate checker found these notes, it tried to look up their SD name via `getStorageDir(sd_id)`, which returned `null`, displaying as "." in the error message.

## How Orphaned Data Happens

While `deleteStorageDir()` was correctly deleting notes/folders when explicitly called, there were scenarios where notes could become orphaned:

1. **Database migrations or schema changes** that don't preserve referential integrity
2. **Manual database edits** during development/testing
3. **Crashes during SD deletion** (though this was unlikely given our current code)
4. **Historical data** from earlier versions before proper cleanup was implemented

## Solution

### 1. Fixed Duplicate Checker (backup-manager.ts)

Updated `checkForDuplicates()` to verify the SD still exists before counting a note/folder as a conflict:

```typescript
// Check if this note ID already exists in the database
const existingNote = await this.database.getNote(noteId);
if (existingNote) {
  // Verify the SD still exists (skip orphaned notes from deleted SDs)
  const sd = await this.database.getStorageDir(existingNote.sdId);
  if (sd) {
    duplicateNotes.push(noteId);
    conflictingSdIds.add(existingNote.sdId);
  }
}
```

This prevents false positives from orphaned data.

### 2. Added Automatic Cleanup (database.ts)

Added `cleanupOrphanedData()` method that removes:

- Notes from SDs that no longer exist
- Folders from SDs that no longer exist
- Tag associations for deleted notes

```typescript
async cleanupOrphanedData(): Promise<{
  notesDeleted: number;
  foldersDeleted: number;
  tagsDeleted: number;
}> {
  // Delete orphaned notes
  await this.adapter.exec(
    'DELETE FROM notes WHERE sd_id NOT IN (SELECT id FROM storage_dirs)'
  );

  // Delete orphaned folders
  await this.adapter.exec(
    'DELETE FROM folders WHERE sd_id NOT IN (SELECT id FROM storage_dirs)'
  );

  // Delete orphaned tag associations
  await this.adapter.exec(
    'DELETE FROM note_tags WHERE note_id NOT IN (SELECT id FROM notes)'
  );
}
```

### 3. Called Cleanup on Startup (index.ts)

```typescript
// Initialize database
database = await initializeDatabase();

// Clean up orphaned data from deleted SDs
await database.cleanupOrphanedData();
```

This ensures the database is always in a clean state when the app starts.

### 4. Created db-doctor Diagnostic Tool

Added `tools/db-doctor.js` for manual diagnosis and repair:

```bash
# Check for issues
node tools/db-doctor.js /path/to/notecove.db

# Fix issues
node tools/db-doctor.js /path/to/notecove.db --fix
```

The tool checks for:

- Orphaned notes (notes from deleted SDs)
- Orphaned folders (folders from deleted SDs)
- Orphaned tag associations (tags for deleted notes)

## Testing

Tested on the problematic database from `/tmp/nc-instance-X/`:

**Before fix**:

```
❌ Found 3 orphaned note(s):
   - eb9bece5... "Controlled crash idea" (sd_id: default)
   - bb17d2a4... "Testing with #tags" (sd_id: default)
   - default-note "Welcome to NoteCove" (sd_id: 65182cb4...)

❌ Found 5 orphaned tag association(s)
```

**After running db-doctor --fix**:

```
✅ No orphaned notes found
✅ No orphaned folders found
✅ No orphaned tag associations found
✅ Database is healthy - no issues found
```

## Additional Issue: Tags Not Restored

After fixing the orphaned data issue, discovered that tags weren't being indexed when restoring backups.

### Root Cause

During SD initialization (`handleNewStorageDir` in `index.ts`), notes were being loaded from disk and inserted into the database, but:

- Content text was not being extracted from CRDT documents
- Tags were not being extracted from content
- Tag indexing was skipped entirely

### Solution

Updated SD initialization to:

1. Extract full content text from CRDT Y.Doc
2. Extract tags using `extractTags()` from shared package
3. Create or get tag entries in database
4. Associate tags with notes using `addTagToNote()`

This matches the tag indexing behavior when notes are created/updated through the UI.

## Additional Issue: Tags Panel Not Updating After SD Deletion

After fixing the orphaned data and tag restoration issues, discovered that deleting a Storage Directory didn't update the tags panel to remove tags that were no longer accessible.

### Root Cause

1. **UI Not Listening**: The TagPanel component only listened to `note:updated` events but not `sd:updated` events, so it didn't know when SDs were deleted
2. **Unused Tags Not Cleaned**: While orphaned tag associations were deleted via CASCADE, the actual tag entries remained in the database

### Solution

**UI Fix** (`TagPanel.tsx`):

- Added listener for `sd:updated` events
- TagPanel now refreshes when SDs are created, deleted, or activated
- This triggers a re-query which filters out tags with 0 notes

**Database Fix** (`database.ts`):

- Updated `cleanupOrphanedData()` to also delete unused tags
- Added cleanup: `DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags)`
- Updated db-doctor tool to check for and clean unused tags

## Files Changed

1. `packages/desktop/src/main/backup-manager.ts`
   - Updated duplicate checker to skip orphaned data

2. `packages/desktop/src/main/database/database.ts`
   - Added `cleanupOrphanedData()` method
   - **Updated to also clean unused tags from database**

3. `packages/desktop/src/main/index.ts`
   - Call cleanup on startup
   - **Added tag extraction and indexing during SD initialization (lines 1029-1071)**

4. `packages/desktop/src/renderer/src/components/TagPanel/TagPanel.tsx`
   - **Added listener for `sd:updated` events to refresh when SDs are deleted/created**

5. `tools/db-doctor.js`
   - New diagnostic/repair tool
   - **Added check for unused tags**

6. `website/guide/backup-recovery.md`
   - Added documentation for db-doctor tool
   - **Updated backup contents and restore documentation to mention tags**
   - **Added unused tags to list of checks**

## User Impact

**Before**:

- Users would see cryptic errors when trying to restore backups, with no clear way to resolve them
- Tags from restored notes wouldn't appear in the tags panel
- Tag filtering wouldn't work for restored notes
- Deleting an SD left orphaned tags in the tags panel
- Tags panel wouldn't update until app restart

**After**:

- Database automatically cleaned on startup (including unused tags)
- Duplicate checking ignores orphaned data
- Tags automatically extracted and indexed during restore
- Tags panel updates immediately when SDs are deleted/created/restored
- Unused tags are removed from database automatically
- Users can manually run db-doctor for diagnosis
- Clear documentation for troubleshooting

## Prevention

**Orphaned Data**: The automatic cleanup on startup should prevent this issue from recurring. Even if orphaned data somehow gets into the database, it will be cleaned up on the next app launch.

**Tag Indexing**: Tags are now extracted and indexed during SD initialization, ensuring they're always available after restore or when adding existing SDs. This matches the behavior when notes are created/updated through the UI.
