# Questions - Phase 1

## Export All Notes to Markdown Issue

### Understanding the Bug

I've traced the export flow and found the issue. When "Export All Notes to Markdown..." is triggered from the File menu:

1. `App.tsx` sets `exportTrigger` to `'all'`
2. `NotesListPanel.tsx` (lines 792-852) handles the export
3. The code correctly fetches ALL notes from the SD (line 834-835):
   ```typescript
   const allNotesInSD = await window.electronAPI.note.list(sdId, undefined);
   ```
4. **THE BUG**: The `noteTitleLookup` is built from `notes` (line 797), which only contains notes from the currently _viewed_ folder, not all notes in the SD:
   ```typescript
   const noteTitleLookup = buildNoteTitleLookup(notes);
   ```

This means inter-note links in the exported markdown will fail to resolve for notes outside the current folder view.

**Question 1**: Is this the bug you're experiencing (export does nothing/exports nothing), or is there a different issue? The code SHOULD export files, but the note title lookups would be wrong. Could the issue be that `activeSdId` is `undefined` so it falls back to `'default'` which might not exist?

Maybe, I'm not sure. I do have a link that links to a note in another SD...

## Help Menu Changes

You want:

- Report Issue → `https://github.com/drewcsillag/notecove/issues/new`
- Documentation → `https://github.com/drewcsillag/notecove/`
- Remove "Show Logs" option

**Question 2**: Confirmed, these are all straightforward changes in `menu.ts`. Shall I proceed with these? (No ambiguity here)

Yes

## Testing Strategy

**Question 3**: For the export bug fix, do you want:

- A unit test for the export-service functions
- An E2E test that actually triggers the menu item (would extend the existing `markdown-export.spec.ts`)
- Both

The existing E2E tests only cover context menu export, not the File menu "Export All Notes" option.

Definitely want the E2E to trigger the menu item.
If there aren't tests for export-service, then I'd want them covered as well.
