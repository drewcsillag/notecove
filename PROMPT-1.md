# Initial Explanation Stage

Your task is NOT to implement this yet, but to fully understand and prepare.

Here is exactly what I need implemented:

NoteCove is a cross-platform notes application (Desktop + iOS) designed to be like Apple Notes but with advanced organization and power-user features. The app works offline-first and syncs via shared file systems (Dropbox, Google Drive, iCloud) without requiring internet servers. Focuses on single-user multi-device experience with robust conflict-free synchronization.

# Core Stack
- **Desktop**: Electron app (cross-platform, easier to maintain than native) in typescript
- **iOS**: Native Swift app with SwiftUI
- **Editor**: TipTap for rich text editing in desktop -- with a selection of extensions from https://tiptap.dev/docs/editor/extensions/overview
- **Collaboration**: Yjs
- **Testing**: Jest + Playwright for desktop, XCTest for iOS, extensive automated testing
- **Website**: Static site with Vite/React for GitHub Pages

# Note Sync mechanism 
Sync mechanism is as follows: using CRDTs written to a folder (where ever its root is). The folder is called a sync directory or SD for short.

Until we hit MVP, backward compatibility is not a concern when making changes.

## Folder structure
In the example below, there are two instances of the app that have sync'd, instance-A and instance-B

```
top-level/
  notes/
    note-123/
      updates/
        instance-A.000001-000050.yjson  ← Packed updates 1-50
        instance-A.000051.yjson         ← Active file
        instance-B.000001-000030.yjson
      meta/
        instance-A.json  ← Tracking what A has seen
        instance-B.json  ← Tracking what B has seen
  folders/
    updates/
      instance-A.000001-000029.yjson  ← Packed updates 1-29
      instance-A.000030.yjson         ← Active file
      nistance-B.000001-000015.yjson
    meta/
        instance-A.json  ← Tracking what A has seen
        instance-B.json  ← Tracking what B has seen
```

Per note there will be a folder under the notes subfolder with the note's id, where updates to the note are stored. Metadata tracking on a per application instance are stored under the meta subfolder where instances can store anything that can speed loading of the note. 

Instances only write to files whose names are prefixed with their instance id. For example: above, `instance-A` is the instance id of an instance. They can read from files from any instance, with the goal of having the combined CRDT state of the note or folder structure.

Other files, similarly named may be written in the tree to assist in fast loading, or tracking changes. For example (not a requirement), each instance could have top level files in the sync folder to note say the most recent 100 files written.

Since the shared folder systems (Dropbox, Google Drive, etc.) have sync delays, and the user could very well be offline, the file structure should make no assumptions about sync timeframes being short. More specifically, offline mode should be explicitly supported as a base case.

## Architecture
All CRDT operations will be done in the main process for the election app. More specifically, we may have multiple editors with the same note loaded in it, and no one of them should be special, per se. they should all be peers in the way that crdt changes are handled.

Keep in mind that we're aiming multiplatform, so the CRDT operations will need to be usable across them all platforms -- probably necessitating whatever technologies that you'd use to move an electron app to mobile. Though keep in mind that the presentation on a phone will need to be different than desktop. But what's described in the UI section will be for the desktop app.

# UI
UI Should be 3 panels side by side, with rough width of 25%, 25% and 50%, with sliders between all three.
The panels will be: the folder and tag panel, the notes list, and the note editor

## Folder and tag panel
In column 1 should be the folder tree panel on top, and the tag panel below, separated by a slider

### The folder tree panel
in the folder tree, at the top there will be a top header containing "FOLDERS" and to its right a plus icon to create a new folder. 

Below that will be folder trees, one per SD, labelled with the SD's name given by the user in the settings pane
Each SD will have two folders at least: "All Notes", and "Recently Deleted". All Notes will make all of the notes for that SD available in the notes list, filtered by any selected tags in the tags pane.

Folders can be dragged and dropped within a SD to create nesting structures, or to un-nest an sd, but not across SDs. A folder cannot be its own parent, directly or indirectly. If a folder is dragged to "All Notes" it brings that folder to the top level of the SD folder structure as a peer with "All Notes" and "Recently Deleted"

Notes that are deleted go into the "Recently Deleted" for the SD they reside in.

Notes can be dragged and dropped onto folders in the folders tree. They need not originate from the same SD they came from. In that case a warning box stating that they're ultimately copying the note to the new SD from the old one and deleting the note from the SD it came from with an option not to see that box again.

To the right of a folder in the tree should be a count of notes in that folder. The count of the "All Notes" folder should be the total of all notes in that SD.

Deleted notes do not participate in search, either by the search box in the notes list pane, nor by tag search

folder tree should be collapsible and what's collapsed should be remembered across restarts

right click menu on a folder should bring up a right click menu with the options of "Rename Folder", "Move to Top Leve", and "Delete"


###  The tag panel
The tag panel will show buttons with tags in them, where clicking on a tag will affect the filtering of notes in the notes list pane. A tag button will be displayed for all known tags. tag buttons have three states
* not participating in filtering
* positive filter on notes that have the tag (i.e. only notes that have the tag show up in the notes list)
* negative filter - notes that have the tag are excluded from the notes list

At the top of the tag panel there will be a header containing "TAGS" and a search box to filter the list of displayed tags

## Notes list
At the top of the notes list will be a search box where notes containing the text specified there will be listed in the notes list below.
below that, a header containing "NOTES", and then right justifed, the count of notes in the notes list and a plus button to create a new note
when creating new notes, notes will be created in the currently active folder.
The content of the notes list starts with the lists in the currently selected folder, filtered by the tag filtering selection, then by the note search box in the notes pane
users can drag a note to folders in the folders pane. If a note is dragged to "Recently Deleted", it's treated as if the user had deleted the note through any of the other means notes can be deleted.

The right click menu on a note will contain
* New Note
* pin
* open in new window
* move to
* duplicate to
* delete

Pinning a note will make it show at the top of the list in the notes pane if it meets the search criteria. There may be multiple pinned notes displayed.

Note sort order is by most recently edited.

A note component in the notes list will contain:
* its title
* when it was last modified as human readable "two minute ago", "three hours ago", and the hover text will be a concrete human readable timestamp in the proper locale, such as "November 11, 2025 12:05pm"

multiple selection of notes is supported in the usual way for the platform, and there should be a badge somewhere when the number of selected notes is > 1. When multiple notes are selected, the right click menu options should all be supported, and dragging the collection to a folder to move them all will work.

## Note editor
We'll use TipTap editor (https://tiptap.dev/docs) starting with the "Simple Template" (https://tiptap.dev/docs/ui-components/templates/simple-editor). Please understand if there are components which do not agree with CRDT operations, and let me know.

In the note editor, the first line will be considered the note's title for display in the notes list. If the first line is blank, find the first line that has text, and if there are none, the note's title shall be considered "Untitled"

You will make tags available for the aforementioned search features. They should be typed, and appear as "#tagname" with the text in a different color than the body text of the document

You will make inter-document links available. I'm thinking `[[title of note to link to]]` as the format as it's consistent with other systems that do this sort of thing, but if you have alternate suggestions, I'm fine with them. Either way, they should display as they are typed in a different color than the body text. They should be in a color that's different from the body text and complementary to the color of tag text.

When a user types `[[` there should be an autocomplete box that restricts the list as the user types things, and the autocomplete should contain those notes where what the user has typed is a substring.

## Settings pane

There will be a setting to control the sync directories used. It should have nice defaults for Google Drive, One Drive, iCloud Drive, and Dropbox, though still allowing the user to file select through them in the event that they don't want a `NoteCove` folder at the top level of these. Users shall be able to select any folder through the native folder selection UI.

Dark mode shall be an option as well for the entirety of the ui

## Overall UI
Icon images shall be used rather than emoji equivalents
It should look professional

# Other details
At the beginning, you're doing foundational work and there may be no obvious UI to show. In such cases, consider building tooling as the UI to use during that time.

At the beginning there is no git setup, so you'll need to do that.
--

Your responsibilities:

- Analyze and understand the existing codebase thoroughly.
- Determine exactly how this feature integrates, including dependencies, structure, edge cases (within reason, don't go overboard), and constraints.
- Clearly identify anything unclear or ambiguous in my description or the current implementation.
- List clearly all questions or ambiguities you need clarified and write them to QUESTIONS-1.md

Remember, your job is not to implement (yet). Just exploring, planning, and then asking me questions to ensure all ambiguities are covered. We will go back and forth until you have no further questions. Do NOT assume any requirements or scope beyond explicitly described details.
