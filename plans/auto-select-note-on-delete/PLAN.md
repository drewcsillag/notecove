# Auto-Select Note on Delete - Implementation Plan

**Overall Progress:** `100%`

## Summary

When a note that's currently open is deleted (soft or permanent), automatically select another note instead of showing a spinner forever. Close minimal mode windows when their note is deleted.

## Requirements (from [QUESTIONS-1.md](./QUESTIONS-1.md))

1. **Algorithm**: Pick most recently modified note
2. **Context**: Try visible list first (current folder), fall back to any note in SD
3. **Minimal mode**: Close the window when note is deleted
4. **Triggers**: Soft delete, permanent delete, SD deletion
5. **Empty state**: Only show if no notes exist at all

## Architecture (revised per [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md))

**App.tsx handles all auto-selection** by listening to deletion events directly:

- Listens for `note:deleted`, `note:permanentDeleted` events
- When `selectedNoteId` matches deleted note, queries for next note
- Uses `selectedFolderId` for primary query, falls back to `activeSdId`
- Picks most recently modified note
- Uses refs to track current values (avoids closure issues with event handlers)

**NotesListPanel keeps existing behavior** (Option C):

- Still calls `onNoteSelect('')` for immediate feedback
- App.tsx then picks new note when event arrives (may cause brief empty state, acceptable)

This handles all deletion sources: UI actions, other windows, auto-cleanup, sync.

## Tasks

- [x] 🟩 **Step 1: Add empty state to TipTapEditor**
  - [x] 🟩 Write test: TipTapEditor shows "Select a note" message when `noteId` is null
  - [x] 🟩 Modify TipTapEditor to show empty state instead of spinner when `noteId` is null
  - [x] 🟩 Verify test passes

- [x] 🟩 **Step 2: Create pickNextNote utility**
  - [x] 🟩 Write tests for `pickNextNote(notes, excludeIds?)` function
    - Returns most recently modified note's ID
    - Excludes specified IDs
    - Returns null if no notes available
  - [x] 🟩 Create `src/renderer/src/utils/pickNextNote.ts`
  - [x] 🟩 Verify tests pass

- [x] 🟩 **Step 3: Implement auto-selection in App.tsx for note deletion**
  - [x] 🟩 Write tests for auto-selection on `note:deleted` event
  - [x] 🟩 Write tests for auto-selection on `note:permanentDeleted` event
  - [x] 🟩 Add event listeners in App.tsx useEffect (using refs for current values)
  - [x] 🟩 Implement `selectNextNote()` helper
  - [x] 🟩 Verify tests pass

- [x] 🟩 **Step 4: Handle minimal mode window closure**
  - [x] 🟩 Write test: minimal mode window closes when its note is deleted
  - [x] 🟩 In App.tsx, check minimalModeRef and close window on note deletion
  - [x] 🟩 Verify test passes

- [x] 🟩 **Step 5: Update SD deletion handling**
  - [x] 🟩 Write test: SD deletion triggers auto-selection from remaining SDs
  - [x] 🟩 Update existing SD deletion handler to auto-select a note from the new SD
  - [x] 🟩 Verify test passes

- [x] 🟩 **Step 6: Integration testing**
  - [x] 🟩 All unit tests pass (32 tests)
  - [ ] 🟨 CI run pending

## Files Modified

| File                                                           | Changes                                                                                                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `TipTapEditor.tsx`                                             | Show empty state instead of spinner when `noteId` is null                                                                        |
| `App.tsx`                                                      | Add deletion event listeners, implement `selectNextNote()`, use refs for current values, handle minimal mode, update SD deletion |
| New: `utils/pickNextNote.ts`                                   | Utility function for selecting next note                                                                                         |
| New: `utils/__tests__/pickNextNote.test.ts`                    | Tests for the utility                                                                                                            |
| New: `EditorPanel/__tests__/TipTapEditor.empty-state.test.tsx` | Tests for empty state                                                                                                            |
| `__tests__/App.test.tsx`                                       | Added tests for auto-selection behavior                                                                                          |

## Out of Scope

- Remembering last selected note across app restarts (separate feature)
- "Note moved to different SD" trigger (not requested)
- Changing NotesListPanel's existing `onNoteSelect('')` calls (keep for immediate feedback)
