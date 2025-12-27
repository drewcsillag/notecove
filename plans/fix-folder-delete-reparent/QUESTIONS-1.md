# Questions - Fix Folder Delete Reparent

## Bug Analysis

I've analyzed the code and identified the issue:

### Primary Issue

When deleting a folder **without children**, the UI uses `'simple'` mode (FolderTree.tsx:1948). The `'simple'` mode in `handleDeleteFolder`:

1. Marks the folder as deleted
2. **Does NOT move notes to the parent folder**

This causes:

- Notes still have `folderId` pointing to the deleted folder
- Notes don't appear in the parent folder
- Notes appear in "All notes" (because `getNotesBySd` returns all non-deleted notes regardless of folder)
- Note Info shows the deleted folder name (because `folderId` still references it)

### Secondary Issue

Even in `'cascade'` and `'reparent'` modes, notes are only updated in the database - the CRDT metadata is NOT updated. This means:

- `noteDoc.updateMetadata({ folderId: parentFolderId })` is never called
- On cross-device sync, the CRDT might overwrite the database change

Comparison with explicit note move (`handleMoveNote`):

```typescript
// handleMoveNote correctly updates BOTH:
noteDoc.updateMetadata({ folderId: newFolderId, modified: Date.now() });
await database.upsertNote({ ...note, folderId: newFolderId });
```

But `handleDeleteFolder` only does:

```typescript
// Only updates database, not CRDT:
await database.upsertNote({ ...note, folderId: parentFolderId });
```

## Questions

1. **Simple mode behavior**: The UI promises "Notes in this folder will be moved to the parent folder" (FolderTree.tsx:1907-1908), but `'simple'` mode doesn't do that. Should I:
   - **Option A**: Change `'simple'` mode to move notes to parent folder (like `'reparent'` but without touching child folders)
   - **Option B**: Change the UI to use `'reparent'` mode for folders without children (child folder handling becomes a no-op anyway)

B - probably simpler just to have a single way to do this

2. **CRDT synchronization**: Should I also fix the secondary issue where CRDT metadata isn't updated during folder deletion? This would ensure:
   - Cross-device sync correctly propagates the folder change
   - Note Info always shows correct folder immediately

Yes

3. **Broadcast events**: When moving notes during folder deletion, should we broadcast `note:moved` events for each note (like `handleMoveNote` does) so the UI can update in real-time?

yes
