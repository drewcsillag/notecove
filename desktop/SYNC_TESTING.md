# CRDT-Based Sync Testing Guide

## Overview

NoteCove now implements CRDT (Conflict-free Replicated Data Type) based synchronization using Yjs. This allows multiple instances to edit the same notes simultaneously without conflicts.

## Architecture

### Storage Structure

```
NoteCove/
  ├── crdt/           # WATCHED - Source of truth for sync
  │   └── {id}.yjs    # Binary Yjs CRDT data (base64 encoded)
  └── notes/          # NOT WATCHED - Materialized cache
      └── {id}.json   # JSON note data for fast loading
```

### How It Works

1. **Editing**: User types → Yjs document updates → Save both `.yjs` and `.json`
2. **External Change**: Another instance saves → `.yjs` file changes
3. **File Watcher**: Detects `.yjs` change (NOT `.json`)
4. **Sync**: Load `.yjs` → Apply to local Yjs doc → Extract note → Update UI
5. **No Loop**: UI update doesn't trigger save (marked as `source: 'sync'`)

### Key Principle

- **CRDT files (.yjs) are watched** - They are the source of truth
- **JSON files (.json) are NOT watched** - They are just a cache
- This prevents infinite sync loops

## Testing Multi-Instance Sync

### Option 1: Using the Test Script (Recommended)

```bash
cd desktop
./test-sync.sh
```

The script will:
1. Create a shared test directory
2. Start two instances with separate user data
3. Both instances watch the same CRDT directory
4. Provide instructions for testing

### Option 2: Manual Testing

**Terminal 1 - Instance 1:**
```bash
npm run build:main
NODE_ENV=development npx electron . \
  --user-data-dir="$HOME/.notecove-test1" \
  --notes-path="$HOME/Documents/NoteCove-SyncTest" \
  --instance="test1"
```

**Terminal 2 - Instance 2:**
```bash
NODE_ENV=development npx electron . \
  --user-data-dir="$HOME/.notecove-test2" \
  --notes-path="$HOME/Documents/NoteCove-SyncTest" \
  --instance="test2"
```

### What to Test

1. **Basic Sync**
   - Create a note in Instance 1
   - Verify it appears in Instance 2
   - Edit in Instance 2
   - Verify changes appear in Instance 1

2. **Conflict-Free Editing**
   - Edit the same note in both instances simultaneously
   - All changes should merge correctly (CRDT guarantees)

3. **File Structure**
   - Check `crdt/` directory for `.yjs` files
   - Check `notes/` directory for `.json` files
   - Verify both are created when saving

4. **Console Logs**
   - Look for "CRDT file change detected"
   - Look for "Note synced from CRDT"
   - Verify no infinite loops

## Command-Line Arguments

- `--user-data-dir <path>` - Custom Electron user data directory (for multiple instances)
- `--notes-path <path>` - Custom notes storage directory (shared between instances)
- `--instance <name>` - Instance name (for logging/debugging)

## Debugging

### View Logs

```bash
# Instance logs
tail -f /tmp/notecove-instance1.log
tail -f /tmp/notecove-instance2.log

# Or use Chrome DevTools (already open in dev mode)
```

### Inspect Files

```bash
# List CRDT files (source of truth, watched)
ls -la ~/Documents/NoteCove-SyncTest/crdt/

# List JSON cache files (not watched)
ls -la ~/Documents/NoteCove-SyncTest/notes/

# View a CRDT file (base64 encoded binary)
cat ~/Documents/NoteCove-SyncTest/crdt/<note-id>.yjs
```

### Common Issues

**Issue: Notes not syncing**
- Check if CRDT watcher is running: Look for "Started watching CRDT directory" in logs
- Verify `.yjs` files are being created in `crdt/` directory
- Check file watcher is not being blocked by the OS

**Issue: Infinite loop**
- Should NOT happen with current architecture
- If it does, check that JSON files in `notes/` are NOT being watched
- Verify sync events have `source: 'sync'` flag

**Issue: Conflicts**
- CRDT should prevent conflicts automatically
- If seeing unexpected behavior, check CRDT manager logs
- Verify Yjs is applying updates correctly

## Implementation Details

### Key Files

- `src/lib/file-storage.js` - CRDT file operations (saveCRDT, loadCRDT, watchCRDT)
- `src/lib/sync-manager.js` - Sync coordination (watches CRDT files, handles changes)
- `src/lib/crdt-manager.js` - Yjs document management
- `src/main.js` - Multi-instance CLI argument parsing

### Sync Manager Flow

```javascript
// Save flow
saveNoteWithCRDT(note) {
  updateYjsDoc(note) → 
  saveCRDT(note.id, yjsState) → // Saves .yjs file (triggers watch)
  saveNote(note)                // Saves .json cache (NOT watched)
}

// Sync flow
handleCRDTChanged(noteId) {
  loadCRDT(noteId) →
  applyToYjsDoc(crdtData) →
  extractNote() →
  updateUI(note, {source: 'sync'}) // Flag prevents re-save
}
```

## Next Steps

After verifying sync works:

1. **Commit 9 Continuation**: Integrate TipTap Collaboration extension for real-time editing
2. **Commit 10**: Add offline support and sync queue
3. **Commit 11**: Support multiple sync points (work/personal folders)

## References

- [Yjs Documentation](https://docs.yjs.dev/)
- [TipTap Collaboration](https://tiptap.dev/guide/collaboration)
- Implementation Plan: `/Users/drew/devel/nc/plan.txt`
