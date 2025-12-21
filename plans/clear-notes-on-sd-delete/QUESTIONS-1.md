# Questions for Feature: Clear Notes on SD Delete

## Analysis Summary

When an SD is deleted:

1. **Database layer** (`storage-dir-repository.ts:101-110`): Cascading deletes remove all notes and folders from that SD
2. **Broadcast**: `sd:updated` event with `{ operation: 'delete', sdId }` is sent to all windows
3. **Current listeners**:
   - `FolderPanel`: Refreshes folder tree on any `sd:updated` event
   - `TagPanel`: Reloads all tags on any `sd:updated` event
   - `NotesListPanel`: **Does NOT listen** to `sd:updated` - only reacts to `activeSdId` prop changes
   - `App.tsx`: **Does NOT listen** to `sd:updated` for note/SD cleanup

**Current bugs**:

- Notes list can show stale notes from a deleted SD if user was viewing that SD
- `selectedNoteId` in App.tsx can point to a note that no longer exists
- Editor may display stale content or error when trying to save

---

## Questions

### 1. Currently Open Note Behavior

When a user deletes an SD and the currently open note is from that SD, what should happen?

**Options:**

- **A) Clear selection (show empty editor)**: Set `selectedNoteId` to `null`, editor shows "Select a note" placeholder
- **B) Navigate to first note in remaining SD**: If another SD exists, select its first note
- **C) Show an error/warning in the editor**: Keep the note "open" but show a message that it's from a deleted SD

**My recommendation**: Option A is simplest and most intuitive. User deleted the SD knowingly; clearing the editor is expected.

## A

### 2. Notes List Refresh Behavior

When a user deletes an SD:

- If viewing the deleted SD: Clear the list (already will happen since notes are gone from DB, but we should force a refresh)
- If viewing a different SD: No action needed for the notes list

**Confirm**: Is this the expected behavior, or should there be additional UX (like switching to a different SD)?

## Yes

### 3. Active SD Handling

If the **active SD** is deleted:

- Should we automatically switch `activeSdId` to another SD (the first remaining one)?
- Or leave it undefined/null until user explicitly selects one?

**My recommendation**: Auto-switch to another SD if available, otherwise leave undefined. The FolderPanel already has logic to handle this via `sd.getActive()` on refresh.

## Agrree

### 4. Search Results

If the user has performed a search and search results include notes from the deleted SD:

- Should search results be automatically refreshed/cleared?
- Or just let the UI naturally fail gracefully when trying to open a deleted note?

**My recommendation**: Clear search results when SD is deleted (simple: just clear the search query or re-run the search). This prevents confusing ghost entries.

## agree

### 5. Multi-window Handling

The app can have multiple windows. All windows receive the `sd:updated` broadcast.

**Confirm**: Each window should independently clear its notes list and selected note if they belong to the deleted SD. Correct?

## correct

### 6. Edge Cases

**Minimal mode windows**: These show a single note without sidebars. If the note's SD is deleted, what should happen?

- Close the window?
- Show an error state?

**My recommendation**: Close the window gracefully (or show an error message), as the content no longer exists.

## agree

## Summary of Proposed Behavior

1. **App.tsx**: Listen to `sd:updated` with `operation === 'delete'`. If `selectedNoteId` belongs to deleted SD, set it to `null`.
2. **NotesListPanel**: Listen to `sd:updated` with `operation === 'delete'`. Clear notes list and search query if viewing deleted SD.
3. **Active SD handling**: If active SD is deleted, let FolderPanel's existing refresh mechanism handle switching (or we can explicitly switch to first remaining SD).
4. **Minimal windows**: Need to decide on close vs error state.

---

Please answer the questions above so I can finalize the implementation plan.
