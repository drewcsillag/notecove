# Questions - Sync Hash Mismatch Investigation

## Summary of the Issue

You have two NoteCove instances (local profile `af7545b4-c309-4bc0-942e-bfef06130437` and remote profile starting with `5d03`) working on the same note (`229a9288-ae9f-493f-a0f4-7ca1b6757983`).

Observations:

1. **"Wait for sync" toast appeared** on startup - indicating stale sync entries were detected
2. **Visible content looks the same** on both machines
3. **Total file size matches** on both machines
4. **Vector clocks match** on both machines
5. **Document hashes differ** despite everything else matching
6. **There's a link to another SD** that this machine doesn't have access to

---

## Questions to Clarify

### Q1: Was the "Wait for sync" toast about this specific note?

The toast shows notes that have stale activity log entries (where expected CRDT sequences never arrived). It aggregates across all notes.

- Was the toast specifically about note `229a9288...`?
- Or was it about a different note entirely?

If it was about a different note, then the toast and the hash mismatch might be unrelated issues.

It was. Strictly speaking, the toast doesn't have enough to say, but the sync status panel only had one item, the note in question.

### Q2: After dismissing/viewing the toast, does the hash mismatch still exist?

The stale sync tracking and hash computation are separate systems:

- **Stale sync**: Activity log shows an expected CRDT log file that never arrived
- **Document hash**: SHA-256 of `Y.encodeStateAsUpdate(doc)` - the full Yjs CRDT state

Once sync is complete, both machines should have identical CRDT state and thus identical hashes. If hashes still differ after sync completes:

- Do you still see "Wait for sync" or has it resolved?
- Did you try closing and reopening the note on both machines to ensure fresh loads?

The hashes still don't match, even after switching away and back
The sync status still has the note

### Q3: What does "link to another SD that this machine doesn't have access to" mean exactly?

You mentioned the note has a link to another SD. I need to understand:

1. Is this a **note link** (e.g., `[[note-id]]`) pointing to a note in a different SD?
2. Or is it something else (image, attachment)?

For note links stored as `[[note-id]]`:

- The raw text `[[uuid]]` is stored in the CRDT
- The link text is **not** stored in the CRDT - it's looked up at render time from the database
- So missing access to the linked note's SD shouldn't affect the CRDT hash

However, if the link was **originally created** on the remote machine and the local machine doesn't have metadata about that note in its database, it might affect how the title cache works - but not the underlying CRDT state.

There is a link in the note to a note in a different sd. the "different sd" is one that the remote machine has but the local machine does not.

### Q4: How are you viewing the document hash?

The document hash is computed in `note-query-handlers.ts` via `getNoteInfo`. It has three code paths:

1. **If note is in memory** (loaded in CRDTManager): Uses `Y.encodeStateAsUpdate(doc)` on the live doc
2. **If note is in DB cache but not memory**: Uses `syncState.documentState` (the cached snapshot)
3. **If note is only on disk**: Loads from disk and uses `Y.encodeStateAsUpdate(loadedDoc)`

Could the difference be caused by one machine using the cache and another loading from disk?

- Did you try both machines with the note **closed** (not loaded in memory)?
- Did you try **Note Info > Reload from CRDT Logs** on both machines and then compare?

The only way I see the note hash is in the note info pane.

### Q5: Are both machines fully synced (no pending activity)?

Check on both machines:

1. **Sync Status Indicator** (bottom right) - is it showing "Synced" or pending syncs?
2. **Tools > Sync Status Panel** - are there any pending or stale entries?
3. Are there any errors in the DevTools console (`Cmd+Opt+I`) related to sync?

There is no sync status visible normally. Maybe it's supposed to be visible, but it's not
Status sync panel on local machine shows the note -- but looking at the note, it looks the same and the vector clocks agree. It looks to me like whatever "computes" that something isn't sync'd is broken, rather than sync actually being broken. Like perhaps for a bit it was out of sync, but caught up, and the entry never cleared or something.

### Q6: Can you provide more diagnostic information?

If you can access the DevTools console on both machines, I'd like to see:

1. **On the local machine** (profile `af7545b4`):
   - Open DevTools (`Cmd+Opt+I`)
   - Search for `[NoteInfo]` logs when you open Note Info dialog
   - This will show which path the hash computation took

2. **On the remote machine** (profile `5d03...`):
   - Same thing

Also, the raw CRDT log file contents could be compared:

- Local: `/Users/drew/My Drive/Shared With Work/NoteCove-Shared-workpersonal/notes/229a9288-ae9f-493f-a0f4-7ca1b6757983/logs/`
- Remote: Same path on the other machine

If the log files are identical (same bytes), then the hash should match when loaded from disk. If they differ, that's the root cause.

Nothing in the javascript console for either the note nor the note info pane says anything about [noteinfo]
I did an md5sum of the log file on both and they were the same

---

## What Could Cause Hash Mismatch with Identical Vector Clocks?

Based on code analysis, potential causes:

1. **Different loading paths**: One machine uses cached state, another loads from disk
2. **Yjs client ID differences**: Each instance has a unique client ID that affects internal CRDT state representation
3. **Tombstone differences**: Deleted content leaves CRDT tombstones; if deletions happened differently, encoded state differs
4. **Uncommitted local changes**: One machine has unsaved local modifications
5. **Cache staleness**: The DB cache (`note_sync_state` table) is out of date on one machine

---

## What I'm Leaning Towards

The most likely cause is **different computation paths** for the hash. Specifically:

- If one machine has the note loaded in memory (currently open) and another doesn't, they use different code paths
- The in-memory doc accumulates state over time, while loading from disk/cache produces a "clean" representation
- Yjs documents are content-equivalent but may have different internal representations

**Recommended test**: On both machines, do:

1. Close the note (ensure it's not loaded)
2. Open "Note Info" dialog directly without opening the note first
3. Compare hashes - they should now use the same disk-loading path

## In both cases, the note is in the editor, and I get the hash via the note info pane. I can't open the note info pane without having th enote open.

## Do You Want Me to Investigate or Fix?

Depending on your answers:

1. **If this is just a display issue**: The hash in Note Info might need normalization (e.g., always load from disk rather than using different paths)

2. **If there's an actual sync bug**: We need to compare the raw CRDT logs on disk between machines

3. **If the "Wait for sync" is the real issue**: That's a different bug - stale activity entries that never resolved

Let me know which direction to pursue.

For this, it's investigate. The more annoying problem is the toast saying it's waiting for sync when it shouldn't be (because the vector clocks agree). The hashes being different is more cosmetic and would be confusing to users (such as myself) when they're different but the content is the same -- it kinda defeats the purpose if you know what I mean.

Other detail which may be relevant in all of this: there's only one crdtlog file -- the remote created it, and the local has never edited it.
