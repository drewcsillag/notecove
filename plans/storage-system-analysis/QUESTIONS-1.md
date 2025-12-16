# Questions - Storage System Analysis (Phase 1)

## Clarifications Needed

### Design Doc Scope

1. **Output Format**: You mentioned "more than one output file I'd expect." Would you prefer:
   - A single comprehensive document with sections, or
   - Multiple focused documents (e.g., `STORAGE-ARCHITECTURE.md`, `SYNC-MECHANISM.md`, `DATA-MODELS.md`)?
     Multiple documents, but linked in reasonable ways.

2. **Audience**: Is this design doc for:
   - Future contributors (detailed implementation guide)?
   - Your own reference (high-level architecture)?
   - Both?
     Both, including Claude as well

3. **Level of Detail**: Should I include:
   - Code snippets and file path references?
   - Sequence diagrams (in Mermaid)?
   - Just prose descriptions?

All of these

### Bug #1: Double CRDT Log Write

Based on my analysis, I've identified the issue. The flow is:

```
Renderer types → yDoc.on('update') fires locally
             → renderer calls window.electronAPI.note.applyUpdate(noteId, update)
             → IPC to main process
             → crdtManager.applyUpdate() called
             → writes update to disk (FIRST WRITE)
             → calls state.snapshot.applyUpdate() which calls Y.applyUpdate(doc, update)
             → this triggers doc.on('update') in main process
             → handleUpdate() called
             → writes update to disk AGAIN (SECOND WRITE)
```

**Question**: Should I:

- Just fix this bug as part of the analysis work, or
- Document the bug and proposed fix for your review before implementing?

fix the bug

### Bug #2: New Notes Not Syncing When Node B Wakes

Based on my analysis, the issue is:

- **Activity Sync** (which triggers note reloads) only handles notes it sees in the activity log
- When Node B was sleeping, Node A created a new note and wrote to its activity log
- When Node B wakes up, it reads the activity log and sees `noteId|instanceA_1`
- Node B calls `reloadNote(noteId)` which checks `db.getNote(noteId)`
- Since the note doesn't exist in Node B's database, it tries to load from CRDT files
- The `reloadNote` callback (lines 954-1083 in index.ts) handles this case - it loads from CRDT and inserts into DB

However, the issue might be:

1. The activity log file hasn't fully synced from cloud storage yet when Node B reads it
2. The CRDT log files haven't synced yet, so `checkCRDTLogExists()` returns false and it keeps retrying until timeout
3. After timeout, the entry is marked as processed (via line count) and never retried

**Questions**:

- Is this a cloud storage sync (iCloud/Dropbox) issue, or does it happen with local-only testing?

I've only noticed it when using cloud storage (Google Drive is where I've seen it, but I'd expect it's not exclusive to it)

- When you say "node B is sleeping" - is this:
  - The machine is asleep (macOS sleep)?
  - The NoteCove app is not running?
  - The app is running but minimized/backgrounded?

The machine is asleep

- Does the activity log file appear in Node B's storage directory after Node A creates the note?

I don't know

- Have you seen this issue with existing note edits, or only new note creation?
  only new notes

Generally, if I restart notecove, it will show up.

### Additional Context Needed

1. **Testing Environment**:
   - Are you testing with actual cloud storage (iCloud), or local-only?
     cloud storage
   - Same machine with two profiles, or different machines?
     two different machines

2. **Reproducibility**:
   - How consistently does bug #2 occur? (Always, sometimes, rarely)
     It's pretty easily reproducible

   - Any specific conditions that make it more likely?
     I'd guess that the longer machine B is asleep, the more likely, but it's just a hunch.
