# Questions - Phase 1

## Feature 1: Auto-unpin on Delete

1. **Scope**: Should the unpin happen when moving to "Recently Deleted" (soft delete), or only on permanent delete?
   - I assume soft delete (when the note first goes to Recently Deleted) - please confirm.

Yes, on soft delete

2. **Restore behavior**: When a note is restored from Recently Deleted, should we:
   - (a) Restore its previous pinned state (would need to track original state), OR
   - (b) Leave it unpinned after restore (simpler)
   - I lean toward (b) for simplicity - the user can re-pin if they want.

leave it as unpinned

## Feature 2: Empty Trash / Permanently Delete All

3. **Menu text**: Standard terminology options:
   - "Empty Trash" (macOS style)
   - "Empty Recycle Bin" (Windows style)
   - "Permanently Delete All Notes"
   - "Delete All Permanently"

   I suggest **"Empty Trash"** as it's concise and familiar.

Empty trash

4. **Confirmation dialog**: Should require confirmation. Proposed text:
   - Title: "Empty Trash?"
   - Body: "Permanently delete {count} note(s)? This action cannot be undone."
   - Buttons: "Cancel" / "Empty Trash"

   Does this sound right?

yes

5. **Multi-SD mode**: In multi-SD mode, each SD has its own "Recently Deleted" folder. Should "Empty Trash" on a specific SD's folder only delete notes from that SD, or all SDs?
   - I assume only that specific SD's notes - please confirm.

yes only that specific SD's notes

6. **Edge case - empty trash folder**: If the Recently Deleted folder is already empty, should the context menu still show "Empty Trash" (disabled/grayed out), or hide it entirely?
   - I suggest showing it but disabled, with text like "Empty Trash (0 notes)" - this provides visual feedback.

show it disabled 7. **Keyboard shortcut**: Should there be a keyboard shortcut for Empty Trash (when the Recently Deleted folder is selected)?

- Not typical in other apps, so I'd skip this unless you want it.
  No
