# Questions for Auto-Select Note on Delete Feature

## Context

When a note that's currently open is permanently deleted, the editor shows a spinner forever because:

1. `NotesListPanel` calls `onNoteSelect('')` when the selected note is deleted
2. `App.tsx` sets `selectedNoteId` to `null`/empty
3. `TipTapEditor` starts with `isLoading: true` but the loading effect exits early when `noteId` is null
4. The spinner keeps spinning because `setIsLoading(false)` is never called

## Questions

### 1. What algorithm should be used to pick the next note?

When a note is deleted and we need to auto-select another note, what should the selection priority be?

**Options:**

- **A) Most recently modified**: Pick the note with the latest `modified` timestamp from the current view
- **B) Adjacent in list**: Pick the note that was visually next to the deleted note in the current list (if last, pick previous)
- **C) Pinned first, then most recent**: Prefer pinned notes, then fall back to most recently modified
- **D) Just clear selection**: Show empty state / "select a note" message instead of picking one

A

### 2. Should the algorithm consider the current folder/filter context?

**Options:**

- **A) Yes, only from visible list**: Pick from notes currently displayed in NotesListPanel (respects folder, tag filters, etc.)
- **B) No, any note in the SD**: Pick from all non-deleted notes in the active Storage Device
- **C) Yes, but fall back**: Try visible list first, then fall back to any note in SD if empty

C

### 3. What should happen in "minimal mode" windows?

Minimal mode windows (opened via internal links) only show the editor, not the notes list. When their note is deleted:

**Options:**

- **A) Close the window**: The note is gone, close the minimal window
- **B) Show empty state**: Keep window open but show "Note has been deleted" message
- **C) Auto-select like main window**: Try to pick another note (though this seems odd for minimal mode)

Current behavior: Window stays open with spinning loader.

A

### 4. What should trigger the auto-selection algorithm?

Should auto-selection happen for:

**Options (select all that apply):**

- **A) Permanent delete only**: Only when a note is permanently deleted (emptied from trash)
- **B) Soft delete too**: Also when a note is moved to trash (user might want to continue with another note)
- **C) SD deletion**: When the entire Storage Device is deleted (currently just clears selection)
- **D) Note moved to different SD**: When note is moved out of current view

B and C

### 5. Should there be a "no note selected" empty state as alternative?

Instead of always auto-selecting, should we show a helpful empty state in the editor panel?

**Options:**

- **A) No, always auto-select**: Never show empty state, always pick another note if available
- **B) Yes, prefer empty state**: Show "Select a note" message, don't auto-select
- **C) Configurable**: User preference in settings
- **D) Context-dependent**: Auto-select on delete, but show empty state on app startup if no note remembered

## A unless there really are no notes that can be chosen.

## Current Behavior Summary

| Scenario                       | Current Behavior          | Ideal Behavior (TBD)       |
| ------------------------------ | ------------------------- | -------------------------- |
| Permanent delete selected note | Spinner forever           | Auto-select or empty state |
| Soft delete selected note      | Clears selection, spinner | Same question              |
| Delete SD with open note       | Clears selection, spinner | Same question              |
| Minimal mode note deleted      | Spinner forever           | Close window or message    |
| No notes in SD                 | Spinner                   | Empty state                |
