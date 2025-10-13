# Multi-Instance Sync Testing

## Status Update

✅ **CLI Argument Parsing Fixed** - Custom `--notes-path` and `--instance` arguments now work correctly
✅ **Per-Note Directory Structure Implemented** - Notes saved as `note-123/cache.json` with `updates/` and `meta/` subdirectories
✅ **File Storage Integration Complete** - Reads from both new and old formats for migration compatibility

## Quick Test

The new CRDT-based sync architecture is now integrated! Here's how to test it:

### Prerequisites
```bash
cd /Users/drew/devel/nc/desktop
npm run build:main  # Rebuild if you made changes
```

### Manual Testing (Recommended)

**Terminal 1 - Instance 1:**
```bash
npx electron . \
  --user-data-dir="$HOME/.notecove-test1" \
  --notes-path="$HOME/Documents/NoteCove-SyncTest" \
  --instance="test1"
```

**Terminal 2 - Instance 2:**
```bash
npx electron . \
  --user-data-dir="$HOME/.notecove-test2" \
  --notes-path="$HOME/Documents/NoteCove-SyncTest" \
  --instance="test2"
```

### What to Test

1. **Verify Instance 1 Startup**
   - Check console logs show:
     ```
     Instance: test1
     Notes path: /Users/drew/Documents/NoteCove-SyncTest
     ```
   - If you see "Instance: default" or wrong path, argument parsing failed

2. **Create a note in Instance 1**
   - Click "New Note" button
   - Type some content (e.g., "# Test Note from Instance 1")
   - Wait 3 seconds (for auto-flush)
   - Check console for: "Saving note with CRDT sync: note-..."

3. **Verify File Structure**
   ```bash
   # Should see the note directory
   ls -la ~/Documents/NoteCove-SyncTest/

   # Should see cache.json and subdirectories
   ls -la ~/Documents/NoteCove-SyncTest/note-*/

   # Expected structure:
   # note-abc123/
   #   cache.json         ← JSON snapshot of note
   #   updates/           ← CRDT update files
   #     test1.000001.yjson or test1.000001-000005.yjson
   #   meta/              ← Per-instance tracking
   #     test1.json
   ```

4. **Start Instance 2**
   - Open second terminal and run Instance 2 command
   - Check console logs show correct instance name and path
   - Note created in Instance 1 should appear within ~2 seconds

5. **Edit in Instance 2**
   - Make changes to the note (e.g., add "# Edit from Instance 2")
   - Wait 3 seconds for flush
   - Check console for: "UpdateStore: Flushed N updates..."

6. **Check Instance 1**
   - Changes should sync back within ~2 seconds
   - Console should show: "Syncing N updates for note..."
   - Both instances should show the same content

7. **Verify Bidirectional Sync**
   - Edit in Instance 1 again
   - Should sync to Instance 2
   - Edit in Instance 2
   - Should sync to Instance 1
   - No data loss, no conflicts

### What to Look For in Console

**Instance 1 (creating note):**
```
SyncManager created for instance: test1
Started sync watching for instance: test1
Saving note with CRDT sync: note-123
=== saveNoteWithCRDT called ===
  Note ID: note-123
  CRDT doc empty: true
  Initializing new CRDT document
UpdateStore: Flushed 1 updates as test1.1 for note note-123
```

**Instance 2 (receiving sync):**
```
Syncing 1 updates for note note-123
Applied update 1 from test1 to note note-123
```

### Troubleshooting

**Wrong instance name or notes path in console?**
- **Symptom**: Console shows "Instance: default" instead of "test1"
- **Cause**: CLI arguments not being parsed correctly
- **Fix**: Rebuild with `npm run build:main` (argument parsing was fixed)
- **Verify**: Check process args with `ps aux | grep electron`

**Notes saving to old location (~/ Documents/NoteCove)?**
- **Symptom**: Files appear in default location instead of NoteCove-SyncTest
- **Cause**: FileStorage not reading `notesPath` setting correctly
- **Fix**: Rebuild with `npm run build:main` (getDefaultNotesPath() was fixed)
- **Verify**: Check console for "Notes path:" on startup

**Notes not syncing between instances?**
- Check console for errors
- Verify both instances are using same `--notes-path`
- Look for "SyncManager created for instance" message
- Check sync status: Should show "watching" or "syncing"
- Make sure you waited 3 seconds after editing (idle flush timeout)

**Files not created?**
- Check: `~/Documents/NoteCove-SyncTest/`
- Wait 3 seconds after editing (idle flush timeout)
- Check console for "UpdateStore: Flushed" messages
- Check console for "Saving note with CRDT sync:" message

**Can't find note files?**
- **Old format**: `~/Documents/NoteCove/note-123.json` (flat file)
- **New format**: `~/Documents/NoteCove/note-123/cache.json` (directory)
- The code supports reading both formats for migration

**Instances not starting?**
- Make sure different `--user-data-dir` for each instance
- Check for errors in console
- Try `npm run dev` first to verify app works
- Kill any running instances: `pkill -f "electron.*NoteCove"`

## Expected Behavior

✅ **Working:**
- Notes appear in both instances
- Edits sync bidirectionally
- Files created in `updates/` and `meta/` directories
- Console shows sync activity
- No infinite loops
- No data loss

❌ **Not Yet Implemented:**
- TipTap Collaboration extension (character-level sync)
- Real-time editing (currently 2s poll interval)
- Snapshot files (for fast new instance join)

## Architecture Summary

### Save Flow
```
User edits note
  ↓
NoteManager.saveNote()
  ↓
SyncManager.saveNoteWithCRDT()
  ↓
Update CRDT metadata
  ↓
CRDT emits update event
  ↓
UpdateStore buffers update
  ↓
After 3s idle → flush to file
```

### Sync Flow
```
Timer fires (every 2s)
  ↓
SyncManager.performSync()
  ↓
For each loaded note:
  UpdateStore.readNewUpdates()
  ↓
  Apply updates to CRDT
  ↓
  Extract merged note
  ↓
  Update UI (source: 'sync')
```

## Next Steps After Testing

Once basic sync is verified:

1. **Add TipTap Collaboration extension** - For real-time character-level editing
2. **Optimize polling** - Consider file system events instead of timer
3. **Add snapshot support** - For faster new instance joining
4. **Add cleanup** - Periodically compact old update files

## Test Results

Record your test results here:

- [ ] Instance 1 starts successfully
- [ ] Instance 2 starts successfully
- [ ] Note created in Instance 1
- [ ] Note appears in Instance 2
- [ ] Edit in Instance 2 syncs to Instance 1
- [ ] Files created in correct structure
- [ ] No infinite loops observed
- [ ] Console shows expected messages
- [ ] No errors in console

## Notes

Add any observations or issues here:
