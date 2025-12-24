# Fix Note Drag/Drop from All Notes

**Overall Progress:** `90%`

## Summary

Three bugs to fix:

1. Notes disappear from "All Notes" when moved to a folder (should stay visible)
2. Folder path indicator doesn't update on first move (folderId not updated in local state)
3. Drag shadow is too large, includes elements like search box

## Related Files

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial questions and answers

## Tasks

### 1. Fix onMoved handler (combines issues 1 and 2)

- [x] **1.1** Write tests for "All Notes" move behavior
  - File: `NotesListPanel/__tests__/NotesListPanel.test.tsx`
  - Test: Moving note to folder while viewing "All Notes" keeps note in list
  - Test: Moving note to folder updates `folderId` in local state (folder path displays)
  - Test: Moving note back to root (null folderId) clears folder path
  - Test: Moving note between folders updates folderId

- [x] **1.2** Update `onMoved` handler in `NotesListPanel.tsx`
  - For "All Notes" view: Update note's `folderId` instead of removing note
  - Keep note visible regardless of which folder it moves to/from

### 2. Fix drag shadow being too large

- [x] **2.1** Create custom DragLayer component
  - File: `NotesListPanel/NoteDragLayer.tsx`
  - Shows note title for single drag
  - Shows "X notes" for multi-select drag
  - Uses `useDragLayer` from react-dnd

- [x] **2.2** Update DraggableNoteItem to use empty drag preview
  - Import `getEmptyImage` from `react-dnd-html5-backend`
  - Connect empty image as drag preview to suppress default browser preview

- [x] **2.3** Add DragLayer to component tree
  - Add `<NoteDragLayer />` to App.tsx (inside DndProvider)

- [x] **2.4** Write tests for drag preview
  - File: `NotesListPanel/__tests__/NoteDragLayer.test.tsx`
  - Test: Single note drag shows note title
  - Test: Multi-note drag shows count

### 3. Validation

- [x] **3.1** Run targeted tests for NotesListPanel
- [ ] **3.2** Run CI before commit
- [ ] **3.3** Manual testing:
  - Drag note from "All Notes" to folder - stays in list, folder path appears
  - Drag note from folder to folder while in "All Notes" - folder path updates
  - Drag note to root while in "All Notes" - folder path disappears
  - Drag shadow shows only the note item (not search box)
  - Multi-select drag shows "X notes"

## Implementation Details

### Task 1.2: onMoved Handler Fix

Current problematic code (lines 686-706):

```typescript
if (selectedFolderId === 'all-notes' || selectedFolderId?.startsWith('all-notes:')) {
  if (data.newFolderId !== null && data.newFolderId !== '') {
    return prevNotes.filter((n) => n.id !== data.noteId); // BUG: removes note
  }
  return prevNotes; // BUG: doesn't update folderId
}
```

Fixed code:

```typescript
if (selectedFolderId === 'all-notes' || selectedFolderId?.startsWith('all-notes:')) {
  // Normalize newFolderId: empty string means root (null)
  const newFolderId = data.newFolderId === '' ? null : data.newFolderId;
  // Update the note's folderId - keep note in list
  return prevNotes.map((n) => (n.id === data.noteId ? { ...n, folderId: newFolderId } : n));
}
```

### Task 2: Drag Layer Architecture

```
App.tsx
├── <DndProvider>
│   ├── <NoteDragLayer />        <-- Custom drag preview (fixed position, follows cursor)
│   └── <div>
│       ├── <NotesListPanel>
│       │   └── <DraggableNoteItem>  <-- Uses getEmptyImage() for preview
```

The `NoteDragLayer` component:

- Uses `useDragLayer` to get current drag state
- Renders only when dragging a NOTE type item
- Positioned absolutely at cursor location using `clientOffset`
- Shows note title or "X notes" count

### Files Changed

1. `NotesListPanel.tsx` - Fixed onMoved handler
2. `DraggableNoteItem.tsx` - Added empty drag preview
3. `NoteDragLayer.tsx` - New custom drag layer component
4. `App.tsx` - Added NoteDragLayer to DndProvider contexts
5. `__mocks__/react-dnd.tsx` - Added useDragLayer mock
6. `__mocks__/react-dnd-html5-backend.tsx` - Added getEmptyImage mock
7. `__tests__/NotesListPanel.test.tsx` - Added move behavior tests
8. `__tests__/NoteDragLayer.test.tsx` - New drag layer tests
