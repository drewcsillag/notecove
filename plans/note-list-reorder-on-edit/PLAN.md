# Note List Reorder on Edit - Implementation Plan

**Overall Progress:** `100%` ✅

## Summary

When a note is edited (content or title), its `modified` timestamp should update, and the note list should re-sort accordingly. Previously, the `modified` timestamp only updated on metadata changes (pin, move, delete), not on content or title edits.

## Current State (After Implementation)

1. **Content changes**: ✅ CRDT updates now update the `modified` timestamp in CRDT metadata and database via `CRDTManager.applyUpdate()`
2. **Title changes**: ✅ `handleUpdateTitle` broadcasts `note:title-updated` with the `modified` timestamp
3. **Note list**: ✅ Listens to both `note:modified-updated` and `note:title-updated` events, updates timestamps, and re-sorts with 500ms debounce

## Implementation Tasks

### Phase 1: Update `modified` timestamp on content changes

- [x] 🟩 **1.1 Write tests for content change timestamp updates**
  - Test that `modified` timestamp updates when CRDT content changes
  - Test that database cache is updated with new timestamp
  - Test that appropriate event is broadcast

- [x] 🟩 **1.2 Update `CRDTManager.applyUpdate()` to update `modified` timestamp**
  - After writing CRDT update to disk, update NoteDoc metadata with new `modified` time
  - Update database cache with new timestamp
  - Broadcast `note:modified-updated` event to renderer

- [x] 🟩 **1.3 Add `note:modified-updated` IPC event**
  - Define event in preload/api
  - Add broadcast and listener infrastructure

### Phase 2: Update `note:title-updated` to include timestamp

- [x] 🟩 **2.1 Write tests for title change list reorder**
  - Test that `note:title-updated` event includes `modified` timestamp
  - Test that NotesListPanel updates `modified` and re-sorts on this event

- [x] 🟩 **2.2 Update `handleUpdateTitle` to include `modified` in event**
  - Add `modified` field to `note:title-updated` broadcast

### Phase 3: NotesListPanel re-sort with debouncing

- [x] 🟩 **3.1 Write tests for debounced list re-sort**
  - Test that list re-sorts when `modified` timestamp updates
  - Test that rapid updates are debounced (no flicker)
  - Test that currently selected note stays selected after reorder

- [x] 🟩 **3.2 Add `note:modified-updated` listener to NotesListPanel**
  - Listen for the new event
  - Update the note's `modified` timestamp in local state
  - Debounce the re-sort (e.g., 500ms) to avoid flicker during active typing

- [x] 🟩 **3.3 Update `note:title-updated` handler to include re-sort**
  - Extract `modified` from event
  - Update the note's `modified` timestamp in local state
  - Use same debounced re-sort mechanism

### Phase 4: Cross-machine sync verification

- [x] 🟩 **4.1 Verify cross-machine sync works correctly**
  - When Machine 1 edits a note, Machine 2 should see updated `modified` time after sync
  - The existing `reloadNote` callback already updates the database cache from CRDT metadata
  - Updated `note:title-updated` broadcast in sd-watcher-callbacks.ts to include `modified`

## Technical Details

### Event Flow (after implementation)

```
User types in TipTapEditor
    ↓
Y.Doc emits 'update' event
    ↓
TipTapEditor calls window.electronAPI.note.applyUpdate()
    ↓
CRDTManager.applyUpdate():
  1. Writes update to disk
  2. Updates NoteDoc metadata: { modified: Date.now() }
  3. Updates database cache
  4. Broadcasts 'note:modified-updated' with { noteId, modified }
    ↓
NotesListPanel receives event:
  1. Updates note.modified in local state
  2. Schedules debounced re-sort (500ms)
    ↓
After 500ms of inactivity, list re-sorts
```

### Debouncing Strategy

- Use a single debounce timer shared across all `modified` update events
- Timer resets on each new event
- After 500ms of no events, execute the re-sort
- This prevents flicker during active typing while still updating promptly when user pauses

## Files to Modify

1. `packages/desktop/src/main/crdt/crdt-manager.ts` - Update `applyUpdate` to set `modified`
2. `packages/desktop/src/main/ipc/handlers/note-edit-handlers.ts` - Update `handleUpdateTitle` event
3. `packages/desktop/src/preload/api/note-api.ts` - Add `onModifiedUpdated` listener
4. `packages/desktop/src/renderer/src/types/electron.d.ts` - Add type for new event
5. `packages/desktop/src/renderer/src/components/NotesListPanel/NotesListPanel.tsx` - Add listeners and debounced re-sort

## Related Files (reference)

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Requirements clarification
- [PLAN-CRITIQUE.md](./PLAN-CRITIQUE.md) - Plan review and risk assessment

## Implementation Notes (from critique)

### CRDT Metadata Update Flow

When `applyUpdate` calls `noteDoc.updateMetadata({ modified: now })`:

1. This creates a new Y.Doc update (metadata change)
2. The update flows through `handleUpdate` (no 'ipc' origin)
3. `handleUpdate` persists it to disk automatically
4. **No changes needed to `handleUpdate`** - it handles metadata updates naturally

### Title Changes Are Also Content Changes

When user edits the title (first line of note):

1. Content CRDT update goes through `applyUpdate` → updates `modified`
2. Later (debounced 300ms), `handleUpdateTitle` is called → updates `modified` again
3. This is harmless - later timestamp wins

### Future Optimization (Deferred)

If performance issues are observed with rapid typing:

- Consider debouncing `modified` update in main process (100ms)
- This would reduce: metadata CRDT updates, database upserts, broadcasts
- **Not implementing now** - wait for evidence of need
