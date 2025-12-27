# Plan Critique Questions

## Question 1: Simplified Architecture

The original plan had NotesListPanel suggest the next note. But this misses deletions from:

- Other windows
- Auto-cleanup
- Sync from other devices

**Proposed change**: Have App.tsx listen for deletion events directly and handle all auto-selection logic there. App.tsx already knows `selectedFolderId` and `activeSdId`, so it can query for notes itself.

This eliminates the `onRequestNoteSelect` prop entirely.

**Is this simpler approach acceptable?**

Sounds right

## Question 2: Existing delete handlers in NotesListPanel

Currently `NotesListPanel` calls `onNoteSelect('')` when deleting the selected note (lines 912, 971, 1016).

With the new approach, we should:

- **A)** Remove these calls entirely - App.tsx handles it via events
- **B)** Keep them but have App.tsx ignore `''` and handle via events instead
- **C)** Keep them as-is for immediate feedback, let events handle auto-selection

**Which approach?**

Option A is cleanest but means a brief moment where selection is stale. Option C means NotesListPanel still clears selection immediately, then App.tsx picks a new note when it receives the event (might cause brief flicker).

C
