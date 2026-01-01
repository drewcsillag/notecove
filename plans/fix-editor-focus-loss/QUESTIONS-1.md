# Questions for Editor Focus Issues

Based on my analysis, I've found two separate but potentially related issues. Let me clarify some details:

## Issue 1: Note with Missing Content (5TJ83vPDQWiUiILGRnIfbg)

The note directory you mentioned only contains a `logs` folder with a CRDT log file, but no actual note content files (no `note.json`, no `updates/`, no `snapshots/`, etc.):

```
5TJ83vPDQWiUiILGRnIfbg/
  logs/
    5f9fa4e7-b2d9-4bc8-8ab2-6bad28e5373a_nC97weZJR4-FNXHFcf9rtQ_1767283750548.crdtlog
```

This structure is incomplete - the note appears to have CRDT operations logged but the actual content may not have been properly synced or saved.

**Questions:**

1. Was this note created on a different device and synced via iCloud, or was it created locally?
2. Is it possible this note was created during a crash or abrupt shutdown?
3. Does this note show up in the notes list? If so, what title/preview does it show?

I made a duplicate of a note, then moved it across SDs. Another instance of the app can open and see the note. The storage inspector shows the sorts of things I'd expect to see. And the local instance of the app can open it fine, I just can't edit the thing.

## Issue 2: Focus Loss When Title Updates

I found the title update flow:

1. Editor content changes → debounced 300ms → title extracted → IPC call to update database
2. Database broadcasts `onTitleUpdated` event
3. NotesListPanel receives event → updates note in list → debounced 500ms → re-sorts list

The re-sorting or React re-renders during this process shouldn't steal focus from the editor since React's reconciliation preserves focus. However...

**Questions:**

1. When you say "if I'm editing a title and pause, it'll update the notes list with the new title and the editor loses focus" - does focus go somewhere specific (e.g., the notes list item, the search box, elsewhere), or does it just disappear?
2. Is the Comment Panel open when this happens? (I see the comment panel but its keyboard handling shouldn't interfere with the editor)
3. Is the Search Panel (Cmd+Shift+F) open when this happens?
4. Do you have any browser extensions or accessibility tools running that might be interacting with focus?
5. Does this happen consistently or intermittently?

6. it doesn't seem to go anywhere I can see -- I do see a flicker, like a bunch of the screen (including the editor) reloads

7. The comment panel isn't open
8. search panel (folder list) is visible
9. This is an electron application, but no -- this didn't used to be a problem
10. it's very reproducible

## Issue 3: Possible Connection

**Question:**
When you try to get the cursor active in note 5TJ83vPDQWiUiILGRnIfbg - does the loading spinner ever show and complete, or does it seem stuck? The note may not be loading properly because its content is missing from disk.

There's no loading spinner. The content fully loads, it just never becomes editable. I wonder if it being a copy of another note (Using right click in the notes folder > duplicate) might have something do do with it...

## Next Steps

Once I understand these details, I'll be able to:

1. Determine if the "can't focus" issue is due to corrupt/incomplete note data vs. a focus-stealing bug
2. Identify the exact point where focus is being lost during title updates
3. Write targeted tests to reproduce the issues
4. Implement fixes
