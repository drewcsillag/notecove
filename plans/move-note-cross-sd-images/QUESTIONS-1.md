# Questions: Moving Notes Across SDs - Image Handling

## Summary of Current State

After analyzing the codebase, I've confirmed:

1. **Notes are moved via `NoteMoveManager`** - A state machine that atomically copies CRDT files, updates the database, and cleans up. This is in `note-edit-handlers.ts:handleMoveNoteToSD()`.

2. **Images are NOT copied during note moves** - The move only handles CRDT files (notes directory). The `media/` directory is not touched.

3. **`image:copyToSD` IPC exists** - Manual image copy between SDs is already implemented in `image-picker-handlers.ts:handleImageCopyToSD()`.

4. **Image references are embedded in CRDT** - `notecoveImage` nodes contain `imageId` attributes. The `extractImageReferencesFromXmlFragment()` function can extract all image IDs from a note.

5. **Cross-machine sync via activity log** - When a note is moved, `recordMoveActivity()` is called so other machines discover the note.

---

## Questions

### Q1: Image Copy Timing - During Move or On-Demand?

Two approaches for handling images when moving a note across SDs:

**Option A: Copy During Move**

- When moving a note, also copy all referenced images to the target SD
- Pros: Images available immediately, no broken placeholders
- Cons: Longer move operation, may copy images that aren't needed (e.g., if note is deleted soon after)

**Option B: Copy On-Demand (Lazy)**

- When an image is requested from target SD but doesn't exist, check source SD and copy it
- Pros: Only copies images that are actually viewed, faster move operation
- Cons: First view after move shows broken placeholder briefly, more complex to track "where did this image come from?"

**Option C: Hybrid**

- Copy images during move (Option A), but also support on-demand discovery for edge cases
- Use existing `image:copyToSD` for the copy operation

**My Recommendation:** Option C (Hybrid) - copy during move for best UX, but keep on-demand fallback for robustness (e.g., images that sync after the note arrives on machine B).

**Your preference?**

## C

### Q2: Image Copy Failure Handling

What should happen if an image can't be copied during the move?

**Option A: Fail the entire move**

- If any image fails to copy, rollback the note move
- Pros: Atomic - either everything moves or nothing
- Cons: A single corrupted image prevents note move

**Option B: Best-effort copy**

- Move the note even if some images fail to copy
- Log which images failed, proceed with the move
- Images show as broken until they sync or user manually copies them
- Pros: Note is still moved, more resilient
- Cons: User may not realize images are missing

**Option C: User choice**

- Show dialog if images fail: "Some images couldn't be copied. Move anyway?"
- Pros: User decides
- Cons: More complex UX

**My Recommendation:** Option B (best-effort) - the note content is more important than the images, and the existing placeholder system handles missing images gracefully. We can log warnings.

**Your preference?**

## A - The only time failures should happen is if storage is full, which has its own problems, this being the least of them.

### Q3: Image Arriving After Note (Sync Scenario)

You mentioned: "We'd also want to account for the fact that the image may show up later than the note."

This is a scenario like:

1. Machine A creates a note with an image
2. Machine A moves the note from SD1 to SD2
3. Machine B syncs SD2 first (gets the note CRDT)
4. Machine B hasn't synced SD2's media directory yet (image not arrived)
5. Machine B tries to load the image - fails (expected - broken placeholder)
6. Image file eventually syncs to SD2
7. Machine B should show the image

**Current behavior:** Step 6-7 is already handled by the media file watcher (Phase 6.2 implementation). When the image file arrives in `SD2/media/`, the watcher emits `image:available` and the `ImageNodeView` refreshes.

**Question:** Is there an additional scenario you're thinking of beyond this?

Possible additional scenario:

- Image exists in source SD but wasn't copied during move
- Note references image that only exists in source SD, not target
- Should we try to "discover" the image from any available SD?

No, as long as it will display the image when it arrives without user intervention (e.g. switching to a different note and back to retry), all is good.

---

### Q4: Cross-SD Image Discovery

When loading an image, should we search other SDs if not found in the note's SD?

**Current behavior:** Image requests are SD-specific. If note is in SD2 and references `imageId`, we only look in `SD2/media/`.

**Proposal:** Add fallback logic:

1. Look in note's current SD (`SD2/media/{imageId}.*`)
2. If not found, look in other registered SDs
3. If found in another SD, optionally copy to current SD for future access

This would help with:

- Images that weren't copied during move
- Images still syncing
- Images referenced by notes that were moved before image support was complete

**Do you want this fallback behavior?**

---

### Q5: Duplicate Images Across SDs

When the same image (same imageId = same content hash) exists in multiple SDs:

**Current behavior:** The database stores one record per (imageId, sdId). An image can exist in multiple SDs with the same ID (since we use content hashing).

**For move operations:** If image already exists in target SD (perhaps from a previous note), we can skip copying.

**This seems correct. Any concerns here?**

---

### Q6: What About the Legacy `moveNoteToSD_Legacy` Path?

There's a legacy code path for `conflictResolution: 'keepBoth'` that creates a new note ID:

```typescript
if (hasConflict && conflictResolution === 'keepBoth') {
  await moveNoteToSD_Legacy(ctx, noteId, sourceSdId, targetSdId, targetFolderId, sourceNote);
  return;
}
```

Should image handling also be added to this path? It creates a copy of the note with a new ID.

**My assumption:** Yes, both code paths should copy images.

---

### Q7: Image Copy Location in State Machine

The `NoteMoveManager` has stages:

```
initiated → copying → files_copied → db_updated → cleaning → completed
```

Where should image copying fit?

**Option A: During 'copying' stage** (alongside CRDT files)

- Atomic with file copy
- If image copy fails, rollback happens automatically

**Option B: After 'db_updated' stage** (before cleaning)

- Note is already in target SD
- Can fail without affecting note move
- Matches "best-effort" approach

**Option C: Separate concern** (not in state machine)

- Handle image copying in the IPC handler (`handleMoveNoteToSD`)
- Call `image:copyToSD` for each image after successful move
- Keep NoteMoveManager focused on CRDT files

**My Recommendation:** Option C - keeps concerns separated, easier to test, matches existing architecture.

**Your preference?**

---

## Summary of Decisions Needed

1. **Copy timing**: During move, on-demand, or hybrid?
2. **Failure handling**: Fail move, best-effort, or user choice?
3. **Late-arriving images**: Any scenario beyond what's already handled?
4. **Cross-SD discovery**: Should we search other SDs for missing images?
5. **Legacy path**: Include image copy in keepBoth path?
6. **State machine integration**: Where does image copy happen?

---

## Implementation Outline (Pending Your Answers)

Assuming my recommendations:

1. **During note move (in `handleMoveNoteToSD`):**
   - After successful `noteMoveManager.executeMove()`, before broadcasting events
   - Extract image IDs from the note's CRDT content
   - For each image: call `handleImageCopyToSD` (reuse existing)
   - Log warnings for any failures, don't fail the move

2. **Add on-demand discovery (optional enhancement):**
   - When `image:getDataUrl` fails, check other SDs
   - If found, copy to note's SD and return the data
   - This handles late-syncing images and edge cases

3. **Tests:**
   - Move note with images → images are copied
   - Move note with broken image → move succeeds, image stays broken
   - Image arrives after move → placeholder updates (already tested)
