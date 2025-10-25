# Questions and Ambiguities - Round 2

Follow-up questions based on answers from QUESTIONS-1.md

---

## 1. CRDT Architecture Follow-ups

**Q1.1:** For the folder hierarchy CRDT structure, I'm considering:
- A Y.Map at the root representing all folders across all SDs
- Each folder as a Y.Map with properties: `{ id, name, parentId, sdId, children: Y.Array }`
- Each note has a `folderId` property to link it to its folder

Is this structure appropriate, or would you prefer a different approach?

> the folder structure is per SD, not across all of them as some instances of the app may have different sets of SDs configured. Otherwise, yes.

**Q1.2:** You mentioned "instances should have a user name associated with them" in Q10.2. Should this be:
- Set in settings alongside the mention handle?
- Auto-detected from system username?
- Used for display purposes in collaborative cursors?

> yes to all. The autodetected one should be the default, but the user can override. The user should also be included in the CRDT updates somewhere, so we know who did what.

**Q1.3:** For the local database/cache (Q13.1), what technology should we use?
- SQLite (via better-sqlite3 or similar)?
- IndexedDB?
- A simpler JSON-based store?
- Your preference?

> what are the tradeoffs, and your recommendation?
---

## 2. Multi-Window CRDT Behavior

**Q2.1:** Regarding Q5.1 - you asked me to clarify "same CRDT state." What I meant was:
- Option A: Each standalone editor window connects to the main process's single in-memory Yjs document (like the main window does)
- Option B: Each standalone editor window has its own Yjs document instance and syncs via files only

Since you want them to be "completely independent Electron windows," I'm assuming Option B - they would be independent and sync through the file system. Is this correct?

> Option A

---

## 3. Search Features

**Q3.1:** You mentioned search should be like Monaco editor's find operation with options for case-sensitive/insensitive. Should we also include:
- Regex support?
- Whole word matching?
- Find and replace?

> regex and whole word, but not find and replace

**Q3.2:** For the notes list search box that searches full content - should the search be:
- Live/incremental (updates as you type)?
- Or triggered by Enter/button click?

> live if it wouldn't be overly complex compared to the alternative

---

## 4. Multi-select Badge

**Q4.1:** For the multi-select badge location (Q8.3), here are some options:
- A) In the notes list header next to the note count
- B) Floating badge near the selection
- C) Bottom of the notes list panel
- D) Top-right corner of the entire app window
- E) Your suggestion

Which would you prefer?

> option B
---

## 5. Recently Deleted

**Q5.1:** For "Recently Deleted," should there be:
- A right-click menu option on individual notes to "Delete Permanently"?
- A right-click menu on the "Recently Deleted" folder itself with "Empty Trash"?
- Both?

> both

**Q5.2:** Can notes be restored from "Recently Deleted"? If yes, should this be:
- A right-click menu option?
- Drag and drop to another folder?
- Both?

> both

---

## 6. Note Creation Context

**Q6.1:** When creating a new note via the "+" button in the notes list:
- Should the editor immediately focus on the new note?
- Should it be created with any default content/template?
- What folder should it be created in if "All Notes" is currently selected (since All Notes shows notes from all folders)?

> editor should immediately focus, and editor should be empty. If "All Notes" is currently selected, the note will have no other folder association (but would show when "All Notes" is selected)

**Q6.2:** When creating a new note via right-click menu on a note:
- Should the new note be created in the same folder as the note that was right-clicked?
- Should it be inserted adjacent to that note in the list?

> should be created in same folder as the note that was right clicked. As to "Should it be inserted adjacent to that note in the list?", I don't know what you mean.

---

## 7. Settings Panel

**Q7.1:** The settings panel - should it be:
- A separate window?
- A modal overlay?
- Replaces the main 3-panel UI temporarily?
- A fourth panel that slides in?

> separate window

**Q7.2:** For SD management in settings, should the UI show:
- A list of configured SDs with add/remove/edit capabilities?
- Ability to enable/disable SDs without removing them?
- Ability to reorder SDs (affecting display order in folder tree)?

> Not sure what a disabled SD would mean in the app, so clarify. But yes to the other two.
---

## 8. Inter-note Links with Duplicate Titles

**Q8.1:** You said duplicate note titles should be handled in autocomplete/linking. Should the autocomplete:
- Show both notes with some differentiator (e.g., folder path, SD name, or date)?
- Allow the user to select which one to link to?
- What should the differentiator be?

> show with differentiator -- SD, folder, and date

**Q8.2:** If a note's title changes and links need to update, should this:
- Happen automatically and silently?
- Show a notification/log of updated links?
- Be configurable?

> happen automatically
---

## 9. Tags Color

**Q9.1:** You mentioned tags and inter-note links should have different colors. Should these be:
- Fixed colors defined by the app?
- User-configurable in settings?
- Theme-dependent (different in light/dark mode)?

> theme dependent

---

## 10. Folder Operations

**Q10.1:** When a folder is deleted (via right-click → Delete):
- What happens to notes in that folder - do they also go to "Recently Deleted"?
- What happens to subfolders - do they also get deleted?
- Should there be a confirmation dialog?

> they go to "Recently Deleted", same for subfolders, and there should definitely be a confirmation dialog

**Q10.2:** Can the "All Notes" and "Recently Deleted" special folders be:
- Renamed?
- Deleted?
- Or are they protected/system folders?

> they're protected system folders. not specified elsewhere but "All Notes" should always be at the top of the tree of the SD, and "Recently Deleted" should always be at the bottom of the tree
---

## 11. Note Movement Warnings

**Q11.1:** You mentioned showing a warning when moving notes between SDs with an option to "not see this box again." Should this preference be:
- Global (never show for any cross-SD move)?
- Per-SD pair (e.g., don't warn when moving from Local to Dropbox specifically)?

> Global
---

## 12. Pinned Notes

**Q12.1:** For pinned notes that show at the top:
- Should they have a visual indicator (pin icon)?
- Should they be sorted among themselves (e.g., by edit time), or maintain a manual order?
- Can they be unpinned? If so, how?

> indicator, yes. Sorted amongst themselves, yes. They can be unpinned, via right click menu option (As they're already pinned, the "pin" option should be changed to "unpin")
---

## 13. File System Permissions

**Q13.1:** Should the app handle cases where:
- The SD folder becomes unavailable (network drive disconnected, etc.)?
- The app doesn't have write permissions to the SD?
- The SD folder is deleted while the app is running?

What should the user experience be in these error scenarios?

> The SD folder shouldn't become unavailable in any meaningful way because of how the sync systems work. If they don't have write permissions, then they cannot modify anything. If the SD folder is deleted while the app is running, pop up an alert letting them know, then remove the SD tree from the app.
---

## 14. Initial Setup / First Run

**Q14.1:** On first app launch when no SDs are configured:
- Should it show the settings panel automatically?
- Show a welcome screen with setup wizard?
- Create a default local SD automatically?
- What should the experience be?

> welcome screen with setup wizard to configure name, SDs, etc. But also a command line option to set any of the necessary things. A default setting
> for SD should be in (on MacOs) ~/Documents/NoteCove, and simiilarly for other platforms using their native conventions, a folder called NoteCove.
---

## 15. Electron Architecture Details

**Q15.1:** For the Electron app structure, should we use:
- webpack/vite for bundling?
- React for renderer process UI?
- Any specific UI component library (Material-UI, Chakra UI, Ant Design, etc.) or build custom?
- TypeScript strict mode?

> React yes. webpack vs. vite, recommend something. I'm thinking Material-UI, but open to suggestions. Typescript strict mode, strong yes.
> Add to the "CI" bit I mentioned in the spec, appropriate linting of the code, like eslint.

**Q15.2:** For the iOS app, should we target:
- Minimum iOS version?
- iPhone only, or universal (iPhone + iPad)?

> minimum iOS -> 26
> universal

---

## 16. Git Structure

**Q16.1:** For the git repository structure, should it be:
- Monorepo with desktop, iOS, and website as subdirectories?
- Separate repositories for each platform?
- If monorepo, should we use a tool like Nx, Turborepo, or simple npm workspaces?

> monorepo. as to tool, make a suggestion. Maybe bazel? evaluate and give me tradeoffs
---

## 17. Documentation Website

**Q17.1:** For the documentation website, should it include:
- Installation instructions?
- User guide?
- Developer documentation?
- API documentation?
- All of the above?

> all of the above

**Q17.2:** Should the website have:
- A landing page with marketing copy?
- Screenshots/demos?
- Download links?
- What's the priority/scope?

> yes to the first three. Not sure what you mean by the fourth.
---

# Unspecified before

A capability to export as markdown, either individual notes, a folder or a whole sd.

## Notes

Please answer these follow-up questions, and then we should have enough clarity to proceed with planning.
