# Questions and Ambiguities - Round 1

This document contains questions that need clarification before implementation planning begins.

---

## 1. CRDT Sync Architecture

**Q1.1:** The folder structure shows `folders/updates/` at the same level as `notes/`. Is the folder hierarchy itself a CRDT that gets synced? If so, what Yjs data structure should represent the folder tree (Y.Map, Y.Array, nested structure)?

> Yes, the folder hierarchy is indeed a CRDT structure. Suggest a datastructure representation

**Q1.2:** When you say "instances only write to files whose names are prefixed with their instance id" - how should the instance ID be generated? Should it be:

- A persistent UUID per installation stored in app settings?
- Generated fresh each app launch?
- User-configurable?

> uuid normally, but for testing purposes, we should be able to specify it by commandline option

**Q1.3:** For the "packed updates" files (e.g., `instance-A.000001-000050.yjson`), what triggers packing? Is it:

- After N updates accumulate?
- Time-based (e.g., daily)?
- Manual user action?
- App-controlled heuristic?

> After N updates accumulate probably like 50-100 or so, or a period of 10 seconds of no editing activity (and there are edits to flush obviously), or loss of focus of the note (such as the window losing focus, the user selecting another note)

**Q1.4:** In the meta files (`instance-A.json`), what exactly should be tracked? You mention "what A has seen" - should this include:

- Last sequence number read from each other instance?
- Timestamps of last sync?
- Checksum/hash of current state?
- All of the above?

> Whatever you may need for instances to keep track of things. Initially, maybe nothing needs to be there as it might load the entirety of the CRDT hostory for a note, but if we start creating snapshots and the like, we may need more persistent tracking. Especially pertinent to app startup time where the app may need to load a lot of things, and so if there's some local cache of things, this file could be used to store where it left off reading in the store.

**Q1.5:** When multiple editor windows have the same note open, you say they should be "peers" - does this mean:

- Each editor window reads directly from disk and writes updates?
- Or should there be a single in-memory Yjs document in the main process that all renderer processes connect to via IPC?

> the second option: single in-memory yjs document in the main process

---

## 2. Folder & Note Organization

**Q2.1:** Can a note exist in multiple folders simultaneously, or is it strictly one folder per note?

> A note can be in only one folder at a time

**Q2.2:** When a note is moved between SDs (sync directories), you mention showing a warning. Should the actual move operation:

- Copy all CRDT history to the new SD?
- Or create a fresh note in the new SD with current content (losing history)?
- Should the old note files be deleted immediately or after confirming sync?

> Copy the CRDT history. In the source SD, the note should be moved into recently deleted.

**Q2.3:** The "Recently Deleted" folder - should notes stay there:

- Indefinitely until manually purged?
- For a specific time period (e.g., 30 days)?
- Until explicit "Empty Trash" action?

> The first and third options -- individual notes can be manually purged (probably as a right click menu option), or an empty trash action

**Q2.4:** When you create a new folder with the plus icon, where does it get created - at the root level of which SD? Should there be a currently "active" SD concept?

> there should be a currently active SD concept -- which would be whatever folder is currently selected would "select" the active SD as well. If "All Notes" or "recently deleted" is selected the folder will be created at the top level of the folder structure within that SD. Otherwise, it will be create as a subfolder of the current folder.

**Q2.5:** The folder right-click menu has "Move to Top Level" - does this mean moving to become a sibling of "All Notes" and "Recently Deleted"?

> yes

---

## 3. Tags

**Q3.1:** For tag filtering with three states (off/positive/negative), if multiple tags are in positive filter mode, should the logic be:

- AND (note must have ALL selected tags)?
- OR (note must have ANY selected tag)?
- User-configurable?

> AND

**Q3.2:** When mixing positive and negative filters, should negative filters exclude notes even if they match positive filters?

> yes

**Q3.3:** Should tags be case-sensitive? E.g., are `#Meeting` and `#meeting` the same or different tags?

> no

**Q3.4:** In the editor, when typing `#tagname`, are there any restrictions on tag names? Can they:

- Contain spaces (e.g., `#work meeting`)?
- Contain special characters?
- Have a max length?

> no spaces. Special characters are fine. No pre-defined maximum length

---

## 4. Inter-Note Links

**Q4.1:** For `[[title of note to link to]]` syntax:

- If multiple notes have the same title, how should this be handled in the autocomplete and actual linking?
- Should links update if the target note's title changes?
- Should links be stored as note IDs internally, or literally by title?

> duplicate note titles should be handled in the initial autocomplete/linking. Links should update if the title changes. Internally, links should be Ids -- so note titles when displayed would probably be computed when the note is shown

**Q4.2:** When clicking a note link, should it:

- Replace the current note in the editor?
- Open in a new window?
- User choice?

> if single clicked, the note should show in the editor. If double clicked, in a new window

**Q4.3:** If a linked note is deleted (moved to Recently Deleted), should the link:

- Break/show as invalid?
- Still work (allowing navigation to deleted notes)?
- Be automatically removed?

> Break/show as invalid

---

## 5. Note Editor & Windows

**Q5.1:** The right-click menu has "open in new window" - should these new windows:

- Be completely independent Electron windows?
- Share the same CRDT state as described in your architecture?
- Have the full 3-panel UI or just the editor?

> should have just the editor. Should be competely independent electron windows. Clarify what you mean by having the same CRDT state.

**Q5.2:** When a note is open in multiple windows and gets deleted, what should happen to those windows?

A dialog should be shown indicating this, and on confirm should close the other windows

**Q5.3:** For the "duplicate to" menu option - should this:

- Create a complete copy including all CRDT history?
- Create a new note with just the current content?
- Can you duplicate across SDs?

> create a copy including all CRDT history, and can duplicate across SDs (you'd need it for the move operation anyway)

---

## 6. Search & Filtering

**Q6.1:** The notes list has a search box - should this search:

- Only note titles?
- Full note content?
- Both?
- Should it include tags in the search?

> full note Content. As to tags, yes. I'd want to be able to search for "#sometag something_in_the_doc"

**Q6.2:** Should search be case-sensitive or insensitive?

> An option to do either -- ideally, I want search functionality to be similar to what the monaco editor "find" operation gives you.

**Q6.3:** For the tag panel search box (to filter displayed tags), should this search be:

- Exact prefix match?
- Substring match?
- Fuzzy match?

> fuzzy match

---

## 7. Settings & Sync Directories

**Q7.1:** You mention "nice defaults" for Google Drive, OneDrive, iCloud Drive, and Dropbox. Should the app:

- Auto-detect these if they exist on the system?
- Provide a list of detected cloud storage locations?
- Just provide file picker with suggested common paths?

> not sure the difference between the first two options, but yes.

**Q7.2:** Can a user have multiple SDs active simultaneously (which seems implied by "folder trees, one per SD")? If yes:

- Is there a limit to how many?
- What's the UX for adding/removing SDs?

> they can have multiple SDs, but only one will be active at a time, which will be the SD associated with the currently active folder. To be clear, in the left pane, you might have folder trees for a local SD, a Dropbox SD, and multiple Google Drive SDs

**Q7.3:** When an SD is added, should the app:

- Immediately start watching it for changes?
- Perform an initial full sync/load of all notes and folders?
- What if the folder doesn't exist yet?

> perform an initial full load of the added SD. If the SD doesn't exist yet, pop up a confirmation dialog, and if yes, then create it.

**Q7.4:** Each SD needs a user-given name - where/when is this set?

> in the settings panel

---

## 8. UI Details

**Q8.1:** For the three-panel layout with sliders, should:

- Panel widths persist across app restarts?
- There be min/max widths for panels?
- Panels be collapsible?

> yes to all three

**Q8.2:** The note list shows "last modified" with relative time - should this auto-update while the app is running (e.g., "2 minutes ago" becomes "3 minutes ago")?

> yes

**Q8.3:** For the multi-select badge showing count of selected notes - where exactly should this appear?

> give me choices

**Q8.4:** Settings pane - how is this accessed? Menu bar item? Keyboard shortcut? Icon in the UI?

> menubar and gear icon in the UI

---

## 9. TipTap & Yjs Integration

**Q9.1:** TipTap has many extensions. Which specific ones should be included initially? For example:

- Bold, Italic, Underline?
- Lists (bullet, numbered)?
- Headings?
- Code blocks?
- Images?
- Tables?

> yes to all of the above, and color highlight extensions, color text extensions, copy to clipboard, emoji dropdown, image align, mentions, reset formatting, undo/redo, block quote, horizontal rule
> unspecified in the original request is that in the settings pane, there should be a place to configure what one's mention handle should be.

**Q9.2:** You mention understanding if components don't agree with CRDT operations. Are you aware of any TipTap extensions that are known to be incompatible with Yjs, or should I research and report back?

> I'm not, but research and find out. I'd rather not have some document element that we can't actually persist properly

**Q9.3:** Should the editor have a toolbar, or is formatting done via keyboard shortcuts/markdown-style shortcuts?

> both/all

---

## 10. File Watching & Sync

**Q10.1:** How frequently should the app poll/watch for changes in the SD folders?

> every two seconds or so. If there are native file watching technologies (such as whatever the watchman tool uses), use those.

**Q10.2:** When the app detects changes from another instance:

- Should it apply them immediately?
- Should there be any indication to the user that a sync occurred?
- What if a note currently being edited receives updates from another instance?

> apply immediately, and if a currently open note receives edits, they should update the current display. As instances should have a user name
> associated with them, I think tiptap has a way to have a cursor for other users locations for these sorts of things

**Q10.3:** Should there be any conflict resolution UI, or should Yjs CRDT nature handle everything automatically?

> yjs should handle it all, that's why I like the idea of CRDTs rather than using operational transforms

---

## 11. Testing Strategy

**Q11.1:** You mention "extensive automated testing" with Jest + Playwright. Should I prioritize:

- Unit tests for core CRDT/sync logic first?
- E2E tests for UI workflows?
- Both in parallel?
- What test coverage target should we aim for?

> both in parallel -- aiming for 70% coverage minimum, but core CRDT/sync logic should be much closer to 100%

**Q11.2:** For testing multi-instance sync behavior, should tests:

- Simulate multiple instances programmatically?
- Use multiple SD folders?
- Test with actual file system operations or mock?

> yes -- all. Losing note data is unacceptable. Of anything in this app, the storage part has to be absolutely rock solid.

---

## 12. MVP Scope & Phasing

**Q12.1:** You mention "until we hit MVP, backward compatibility is not a concern." What should be considered the MVP scope? Is it:

- Desktop app only (iOS later)?
- Core note editing + sync working?
- Full UI with all features described?
- Something else?

> The full execution of the plan as specified.

**Q12.2:** Should iOS development start immediately in parallel, or only after desktop MVP?

> immediately in parallel. I want to ensure they have reasonable feature parity. Also, I want to catch cases where there's something that cannot be done, or has to be done substantially differently between the two early rather than late.

**Q12.3:** Should the documentation website be built incrementally as features are completed, or all at once after MVP?

> incrementally

---

## 13. Data Persistence & Startup

**Q13.1:** Besides the SD folders, should the app maintain any local database/cache? For example:

- Index of all notes for faster search?
- Tag index?
- Recently opened notes?
- Or should everything be computed from SD files on startup?

> There should be a local database/cache, and from the beginning -- getting these sorts of things right can be hard, especially if we wait. Along the lines of what I said earlier regarding testing: the storage system has to work correctly, and local caching/storage is part of that.

**Q13.2:** On app startup, what should be displayed:

- Last opened note?
- Blank editor?
- Some "home" view?
- User-configurable?

> last opened note

---

## 14. Platform-Specific Behaviors

**Q14.1:** For cross-platform Electron app, should the app follow platform conventions for:

- Menu bar (native menu on macOS, in-window on Windows/Linux)?
- Keyboard shortcuts (Cmd on macOS, Ctrl on Windows/Linux)?
- File paths display?

> yes to all

---

## Notes

Please answer these questions directly in this file. You can add your answers after each question, or in a separate section at the end. Once answered, we can proceed to planning.
