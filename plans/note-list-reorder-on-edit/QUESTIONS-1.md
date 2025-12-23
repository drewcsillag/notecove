# Questions for Note List Reorder on Edit

## Current Behavior

Based on my exploration, the `modified` timestamp is currently **NOT updated when note content is edited**. It only updates when:

1. Metadata changes explicitly (pin, move, delete, restore)
2. Notes are synced from another machine
3. Notes are discovered from disk

The note list sorts by pinned status first, then by `modified` date (newest first).

## Questions

### 1. What constitutes an "edit"?

Should the `modified` timestamp update when:

- [ ] Any keystroke/character is typed?
- [ ] Content is saved/persisted (CRDT update written to disk)?
- [ ] User explicitly saves (though I don't see an explicit save action - it's auto-save)?
- [ ] User leaves the note/switches to another note?
- [ ] Something else?

**My recommendation:** Update on CRDT content update (when changes are persisted to disk), but potentially debounced to avoid excessive updates during active typing.

agree with recommendation

### 2. Debouncing/throttling considerations

If we update `modified` on every CRDT content change:

- Typing "hello" could trigger 5 updates in rapid succession
- This could cause the note list to "flicker" as notes reorder

Should we:

- Debounce updates (e.g., only update after 2 seconds of inactivity)?
- Throttle updates (e.g., at most once per 5 seconds)?
- Update immediately but only re-sort the list on a debounced schedule?

**My recommendation:** Update `modified` immediately on content change, but debounce the list re-sort/UI update to avoid flicker.

agree with recommendation

### 3. Title-only edits vs content edits

Currently, title changes don't seem to update `modified` either. Should:

- Title changes update `modified`? (Likely yes, for consistency)
- Is this already the expected behavior?

yes

### 4. Visual feedback during reorder

When a note moves position in the list due to being edited:

- Should there be animation?
- Should the note smoothly slide to its new position?
- Or is an instant reorder acceptable?

**My recommendation:** Start with instant reorder (simpler), consider animation as a follow-up if needed.

agree with recommendation

### 5. What if the note being edited is currently selected?

If I'm editing "Note A" and it was at position 5, after the edit it should move to position 1. But since it's selected:

- Should the scroll position follow the note to keep it visible?
- Or stay at the same scroll position (note might scroll out of view)?

**Current behavior for pin toggle:** The note stays selected and the list re-sorts, so the selected note can change position. This seems like the right approach.

retain current behavior

### 6. Cross-machine sync implications

When note A is edited on Machine 1:

- Machine 1's list should reorder immediately
- Machine 2 (after sync) should also see the updated `modified` time and reorder

Is this already handled by the existing sync mechanism? (I believe yes - the CRDT metadata would sync, and the database cache would update with the new `modified` time.)

In theory it should, I don't know though.
