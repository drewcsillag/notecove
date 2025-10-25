# Questions and Ambiguities - Round 4

Final technical clarifications

---

## 1. User Tracking in CRDT Updates

**Q1.1:** You asked what I suggest for storing user information - Yjs metadata vs separate history.

My recommendation:
- **Store in Yjs metadata**: Yjs allows attaching metadata to updates. We can include `{ userId, username, timestamp }` with each update
- **Also maintain in SQLite cache**: For quick queries like "show edit history" or "last edited by"
- **Display in UI**: Show "Last edited by [username]" in note metadata, optionally a full history view

This gives us:
- Authoritative source (Yjs updates on disk)
- Fast queries (SQLite cache)
- UI display capability

The alternative would be a completely separate audit log, but that could get out of sync with actual CRDT state.

Does this approach sound good?
> sounds good

---

## 2. iOS Version Research

**Q2.1:** You mentioned iOS 26.0.1 on your iPhone. That's unusual as iOS 18 is the latest public version as of my training data (Jan 2025).

I should research this to understand the current iOS versioning. However, to proceed with planning, should I:
- A) Research current iOS versioning using WebSearch, then set minimum version accordingly
- B) Assume you want latest iOS support (whatever that currently is)
- C) Plan for iOS 18 minimum and we can adjust later

Which approach?
> B -- there were a number of changes in the most recent release and while iOS is good about backward compatibility, I don't wnat to lose out on potential things we can do.

---

## 3. Note Title Edge Cases

**Q3.1:** For note titles (first line with text), some edge cases:
- If a note has only whitespace, should it be "Untitled"?
- If first line is very long (500+ characters), should we truncate it for display in notes list?
- Should there be a max title length for display purposes?

> if a note has only whitespace, indeed it should be "untitled"
> if the first line is long, yes truncate, and indicate that in the display with elipses
> I'm not thinking so, the widgets by the way they're sized will effectively truncate the title here I'm thinking

---

## 4. Folder/SD Naming Restrictions

**Q4.1:** Should there be any restrictions on:
- Folder names (special characters, length, etc.)?
- SD names in settings (just display names, so probably any characters OK)?
- Can two folders in the same parent have the same name?
- Can two SDs have the same name?

> no restrictions on folder names -- for export they'll need some form of deterministic mangling though
> SD names can be whatever
> two folders in the same parent cannot have the same name. If by rename or move operation this might happen, stop the operation and alert the user
> two SDs shouldn't have the same name
---

## 5. Keyboard Shortcuts

**Q5.1:** Should we define a standard set of keyboard shortcuts? For example:
- `Cmd/Ctrl+N`: New note
- `Cmd/Ctrl+Shift+N`: New folder
- `Cmd/Ctrl+F`: Focus search
- `Cmd/Ctrl+,`: Open settings
- `Cmd/Ctrl+W`: Close window
- `Cmd/Ctrl+Shift+F`: Find in note (Monaco-style search)
- `Cmd/Ctrl+O`: Open note in new window

Should I plan a comprehensive shortcut scheme, or is this a later refinement?

> What are other shortcut schemes you have in mind?
---

## 6. Application Menu Structure

**Q6.1:** For the native application menu (macOS menu bar, Windows menu), should we have standard menus like:

**File Menu:**
- New Note
- New Folder
- New Window
- Export as Markdown
- Close Window
- Quit (macOS) / Exit (Windows/Linux)

**Edit Menu:**
- Undo/Redo
- Cut/Copy/Paste
- Select All
- Find...

**View Menu:**
- Toggle Dark Mode
- Zoom In/Out/Reset
- Toggle Folder Panel
- Toggle Tags Panel

**Window Menu:**
- Minimize
- Zoom
- List of open windows

**Help Menu:**
- Documentation
- Report Issue
- About NoteCove

Is this structure appropriate, or would you like different organization?

> that sounds fantastic
---

## 7. Note and Folder IDs

**Q7.1:** For note and folder IDs:
- Should they be UUIDs (universally unique)?
- Or some other scheme (timestamp + random, etc.)?
- Need to ensure no collisions across instances

My recommendation: UUIDv4 for both notes and folders. Agree?

> agree
---

## 8. Error Handling and Logging

**Q8.1:** For production error handling:
- Should errors be logged to a file?
- Should there be a "Show Logs" option in the UI?
- Should we integrate crash reporting (like Sentry)?
- Or keep it simple initially and add later?

> Log to file and show logs in the UI. I have no place for this to report crashes to, so that can come later.
---

## 9. Drag and Drop Details

**Q9.1:** For drag and drop operations:
- Should there be visual feedback during drag (ghost image, drop zone highlighting)?
- Should we support drag from external applications (e.g., drag a text file to create a note)?
- Should we support drag to external applications (e.g., drag note to email client)?

What's the priority/scope here?

> yes to all

---

## 10. Window State Persistence

**Q10.1:** Should the app remember:
- Window size and position?
- Which note was open in secondary windows?
- Panel widths (you already confirmed this)?
- Which folder was selected?
- Tag filter states?
- Search text?

Which of these should persist across app restarts?

> all
---

## 11. Sync Conflict Scenarios

**Q11.1:** While Yjs handles CRDT merging, there are file-level conflicts possible:
- Two instances try to write to same update file simultaneously (shouldn't happen with instance-id naming)
- File system sync delay causes one instance to not see other's updates immediately

Should we have any UI indication of:
- "Sync in progress"?
- "Waiting for changes from other instances"?
- Or keep it completely transparent?

> keep it transparent -- only in the case where file storage is in a state we can't handle should the user be notified.
> While CRDTs should make this ok anyway, make sure we account for the fact that while the sync files have an ordering, they may be syncd out of order
---

## 12. Performance Considerations

**Q12.1:** For initial load and performance:
- Should we lazy-load notes (only load content when opened)?
- Should we limit how many notes are rendered in the notes list (virtual scrolling)?
- At what note count should we be concerned about performance?

My thoughts:
- Lazy-load note content (only load for editing)
- Virtual scrolling if >1000 notes visible
- SQLite + indexing should handle 10k+ notes fine

Agree?

> sounds good -- though on initial load of an SD, wouldn't we *have* to load everything that first time to populate sqlite?
---

## 13. Tags in Note Content

**Q13.1:** When a tag appears in note content as `#tagname`:
- Should it be clickable to filter by that tag?
- Should it show autocomplete of existing tags as you type?
- Should there be a way to manage/rename tags globally?

> clickable no. autocomplete yes, global rename no.
---

## 14. Note History / Versions

**Q14.1:** The CRDT updates give us full history. Should we expose this in the UI?
- View note history / previous versions?
- Restore to a previous version?
- Or is this a post-MVP feature?

> this is a pre-MVP feature
---

## 15. Mobile Consideration for Desktop

**Q15.1:** You mentioned "presentation on a phone will need to be different than desktop" in context of multiplatform support.

For iOS native app:
- Single panel view that navigates between folder list → note list → editor?
- Swipe gestures for navigation?
- Should I plan the iOS UI in detail, or is desktop the priority and iOS follows later?

> plan the iOS UI in detail. as I said in another question, I'd like to surface any surprises sooner rather than later.

---

## 16. CI/CD Pipeline

**Q16.1:** You mentioned CI should run tests. Should we also plan for:
- Automated builds for releases?
- Code signing (macOS, Windows, iOS)?
- App store distribution (Mac App Store, iOS App Store)?
- Or just testing + manual builds initially?

> I'd like plan for the CD side of things yes. CI first though.

---

## 17. Development Phases

**Q17.1:** Given the scope, should the plan be organized in phases like:

**Phase 1: Core Foundation**
- Project setup, build system
- Basic CRDT sync engine
- File system operations
- Local database/cache
- Testing framework

**Phase 2: Desktop UI**
- Electron app structure
- Three-panel layout
- Basic note editing (TipTap integration)
- Folder management

**Phase 3: Advanced Features**
- Tags system
- Inter-note links
- Search
- Export

**Phase 4: iOS App**
- iOS project setup
- UI implementation
- CRDT integration

**Phase 5: Documentation & Polish**
- Website
- Documentation
- UI refinements

Or would you prefer a different organization?

> I'd like to swap 3 and 4. This way I can try it out and surface any interop issues before we build on the base foundation.

---

A few more things I forgot to specify:

I'd like todo items via checkboxes, but the checkboxes are tri-state for todo, done, and won't do (aka NOPE). Later on, I'd like the ability to attach due dates and @ mentions.

I'd want to integrate with apple short cuts, so that shortcuts can create notes, etc. from various actions, similar to what can be done with apple notes.

Later on, I'd like to have APIs to talk to either the app or the notes store (depending on what makes sense)

As a If I ask you to do something, and you start doing it, NEVER start rolling back the change without asking me and explaining in detail what the problem is.

## Notes

These are the final clarifications. Once answered, I'll create a comprehensive implementation plan.
