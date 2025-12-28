# Questions for Scroll Position Recall Feature

## Discovery: Feature Already Exists

After exploring the codebase, I found that **scroll position recall is already implemented**. Here's what exists:

### Current Implementation

1. **`useEditorStateRestoration` hook** (`packages/desktop/src/renderer/src/components/EditorPanel/useEditorStateRestoration.ts`)
   - Handles scroll and cursor position persistence
   - Reports scroll position on scroll events (debounced)
   - Restores scroll position when switching between notes
   - Saves final state on unmount

2. **`useNoteScrollPosition` hook** (`packages/desktop/src/renderer/src/hooks/useNoteScrollPosition.ts`)
   - Persists per-note scroll positions across app restarts
   - Stores up to 100 notes' scroll positions
   - Uses `AppStateKey.NoteScrollPositions` in the SQLite database

3. **`useWindowState` hook** (`packages/desktop/src/renderer/src/hooks/useWindowState.ts`)
   - Tracks per-window editor state (scroll + cursor)
   - Used for session restoration within same app run

4. **Database persistence** via `AppStateRepository` using SQLite `app_state` table

### What Should Happen

- Switching between notes: scroll position should be remembered and restored
- App restart: scroll position for previously viewed notes should be restored
- Up to 100 notes tracked to prevent unbounded storage growth

---

## Questions

1. **Is the feature not working for you?** If so, can you describe:
   - Are scroll positions not being saved when switching notes?
   - Are they not being restored when switching back?
   - Are they not persisting across app restarts?
   - Both issues?

None of it works

2. **Is there a specific scenario where it fails?**
   - Newly created notes?
   - Very long notes?
   - Specific note types?

all of them

3. **Were you aware this feature was already implemented?**
   - If not, this might be a bug in the existing implementation rather than a new feature request
   - Let me know and I can investigate what's broken

I thought I had, but figured maybe I forgot

4. **Do you want any enhancements beyond basic scroll recall?**
   - For example: cursor position recall (already tracked), scroll percentage indicator, etc.

Cursor position would be good.
