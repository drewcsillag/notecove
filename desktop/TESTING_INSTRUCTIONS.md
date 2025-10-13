# Multi-Instance Sync Testing

## Quick Test

The new CRDT-based sync architecture is now integrated! Here's how to test it:

### Prerequisites
```bash
cd /Users/drew/devel/nc/desktop
npm run build:main  # Already done
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

1. **Create a note in Instance 1**
   - Open Instance 1
   - Create a new note with some content
   - Wait 3 seconds (for auto-flush)

2. **Check Instance 2**
   - Within ~2 seconds (sync poll interval), the note should appear
   - Check console for: "Syncing N updates for note..."

3. **Edit in Instance 2**
   - Make changes to the note
   - Wait 3 seconds

4. **Check Instance 1**
   - Changes should sync back
   - Both instances should show the same content

5. **Check File Structure**
   ```bash
   # Should see packed update files
   ls -la ~/Documents/NoteCove-SyncTest/*/updates/

   # Should see meta tracking files
   ls -la ~/Documents/NoteCove-SyncTest/*/meta/

   # Example:
   # note-123/
   #   updates/
   #     test1.000001-000005.yjson
   #     test2.000001-000003.yjson
   #   meta/
   #     test1.json
   #     test2.json
   ```

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

**Notes not syncing?**
- Check console for errors
- Verify both instances are using same `--notes-path`
- Look for "SyncManager created for instance" message
- Check sync status: Should show "watching" or "syncing"

**Files not created?**
- Check: `~/Documents/NoteCove-SyncTest/`
- Wait 3 seconds after editing (idle flush timeout)
- Check console for "UpdateStore: Flushed" messages

**Instances not starting?**
- Make sure different `--user-data-dir` for each
- Check for errors in console
- Try `npm run dev` first to verify app works

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
