# Questions - Storage Inspector Enhancements

## 1. Parsed Activity Logs

The activity log format is: `noteId|profileId|sequenceNumber` (one entry per line).

**Current behavior**: Activity logs are displayed as raw text via `TextPreview.tsx`.

**Question 1.1**: For the parsed display, should I:
- **(A)** Show a table/list view similar to `RecordList.tsx` with columns: Note ID, Source Profile, Sequence Number?
- **(B)** Show parsed data inline with the raw text (like syntax highlighting)?
- **(C)** Both - have a toggle between raw and parsed view?

C

**Question 1.2**: The activity log filenames contain the profile and instance IDs (format: `{profileId}.{instanceId}.log`). Should I also display this metadata in the header?

Yes

**Question 1.3**: Should clicking on a noteId in the parsed view do anything (e.g., offer to navigate to that note)?

Yes -- offer to navigaate to the note, hovering over the note id should display its title.
Hovering over the profile Id should display a parsed version of the profile file that lives in the profiles folder.

---

## 2. Refresh Buttons on Every View

**Current state**: There's one global refresh button in the main toolbar that reloads the entire SD tree.

**Question 2.1**: What views need individual refresh buttons? I'm thinking:
- Tree browser (already has global refresh)
- File detail view (hex viewer, record list, text preview, etc.)
- Any subcomponent that shows parsed data?

yes: file detail, and subcomponents

**Question 2.2**: Should the refresh buttons be:
- **(A)** Small icon buttons (like the current toolbar buttons)?
- **(B)** Full buttons with "Refresh" text?

A

**Question 2.3**: Should a file refresh automatically re-parse the file (CRDT records, activity logs, etc.)?

yes
---

## 3. Copy Full Path Button

**Question 3.1**: The path displayed is currently the relative path (e.g., `notes/abc123/logs/file.crdtlog`). For the "copy full path" button, should I copy:
- **(A)** The absolute filesystem path (e.g., `/Users/drew/NoteCove/SD1/notes/abc123/logs/file.crdtlog`)?
- **(B)** The relative path as currently shown?
- **(C)** Give user option to choose?

A

**Question 3.2**: Where should the button appear?
- Next to the path in the file metadata section?
- In the toolbar?
- Both?

both
---

## 4. Open Note in New Window from CRDT Logs

**Current structure**: CRDT logs are at paths like `notes/{noteId}/logs/*.crdtlog`.

**Question 4.1**: For opening the note in a new window, I'll extract the noteId from the path. The existing `testing.createWindow({ noteId })` API can open a note in a new window. Should I:
- **(A)** Add a button in the RecordList header when viewing a note's CRDT log?
- **(B)** Add a button in the file metadata section when viewing any file in a note's directory?
- **(C)** Both?

C

**Question 4.2**: Should this be visible for all files under `notes/{noteId}/...` or only for CRDT logs specifically?

all files under the notes/{noteid} path

**Question 4.3**: What if the note doesn't exist in the database (e.g., orphaned CRDT log)? Should I:
- **(A)** Disable the button with a tooltip explaining why?
- **(B)** Hide the button entirely?
- **(C)** Show a warning dialog when clicked?

A

