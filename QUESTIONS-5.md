# Questions and Ambiguities - Round 5

Final follow-ups and new feature clarifications

---

## 1. Keyboard Shortcuts - Additional Schemes

**Q1.1:** You asked what other shortcut schemes I have in mind. Here are additional ones to consider:

**Navigation:**

- `Cmd/Ctrl+1/2/3`: Focus folder panel / notes list / editor
- `Cmd/Ctrl+↑/↓`: Navigate between notes in list
- `Cmd/Ctrl+Enter`: Open selected note
- `Cmd/Ctrl+Shift+Enter`: Open selected note in new window

**Editing:**

- `Cmd/Ctrl+B/I/U`: Bold/Italic/Underline
- `Cmd/Ctrl+K`: Insert link
- `Cmd/Ctrl+Shift+K`: Insert note link `[[...]]`
- `Cmd/Ctrl+E`: Insert code block
- `Cmd/Ctrl+Shift+C`: Copy note link (to paste in other notes)

**Organization:**

- `Cmd/Ctrl+D`: Duplicate note
- `Cmd/Ctrl+Backspace/Delete`: Delete note
- `Cmd/Ctrl+Shift+M`: Move note to folder (opens dialog)
- `Cmd/Ctrl+P`: Pin/Unpin note

**Tags:**

- `Cmd/Ctrl+T`: Focus tag search
- `Cmd/Ctrl+Shift+T`: Add tag at cursor

**Other:**

- `Cmd/Ctrl+E`: Export current note/folder
- `F2`: Rename (folder/note)
- `Escape`: Clear search, deselect, close dialogs

Should we include all of these, or a subset?

> yes

---

## 2. Initial SD Load Performance

**Q2.1:** You asked about initial SD load - "wouldn't we _have_ to load everything that first time to populate sqlite?"

Good catch. Yes, on first load of an SD (or when cache is stale), we need to:

1. Read all CRDT updates for all notes to build current state
2. Extract metadata (title, tags, dates) for SQLite index
3. This could be slow for large SDs (thousands of notes)

Should we:

- A) Show a progress dialog during initial SD indexing ("Indexing notes... 532/2341")
- B) Do it in background with subtle indicator, allow limited interaction
- C) Block UI until complete with progress bar

Which approach? Also, should we cache the computed note state somewhere to avoid re-processing all CRDT updates every time?

> A. yes, I had assumed that's what you intended to use SQLite for

---

## 3. Tri-State Checkboxes

**Q3.1:** You mentioned tri-state checkboxes: todo, done, won't-do/NOPE.

Visual representation:

- Todo: `[ ]` (empty checkbox)
- Done: `[x]` (checked checkbox)
- NOPE: `[~]` or `[-]` or different icon?

What visual should NOPE have?

> `[N]`

**Q3.2:** Interaction model:

- Click once: unchecked → checked
- Click twice: checked → NOPE
- Click third: NOPE → unchecked (cycles through all three)

Or different interaction? Right-click menu?

> what you have here is what I had in mind

**Q3.3:** Markdown representation:

- `- [ ] Task` for todo
- `- [x] Task` for done
- `- [~] Task` for NOPE (or different character)?

What should the markdown syntax be?

> `[N]`

**Q3.4:** Should checkboxes work anywhere in a note, or only in list items?
only in list items

---

## 4. Due Dates and @mentions for Tasks

**Q4.1:** You mentioned "Later on, I'd like the ability to attach due dates and @ mentions" for tasks.

For planning purposes:

- Should this be part of MVP or post-MVP?
- For due dates: inline syntax like `- [ ] Task @due(2025-12-31)` or separate UI?
- For @mentions: same as the mention handle for user names, or different (like task assignment)?

> post mvp. due date syntax looks right, and @mention should be the same as a mention handle (and it would effectively assign the todo to them)

---

## 5. Apple Shortcuts Integration

**Q5.1:** You want Apple Shortcuts integration similar to Apple Notes.

Capabilities you want:

- Create note from shortcut?
- Add content to existing note?
- Search notes?
- Get note content?
- Others?

> I think this is a decent list to start iwth

**Q5.2:** Is this MVP or post-MVP?

> post MVP

**Q5.3:** This would require the iOS app to expose actions via Intents framework. Should the desktop app have similar automation? (e.g., AppleScript on macOS, command-line interface on all platforms)?

> yes I'd like that

---

## 6. APIs for App/Notes Store

**Q6.1:** You mentioned "APIs to talk to either the app or the notes store."

Use cases:

- Third-party integrations?
- Browser extensions?
- Command-line tools?
- Plugin system?

> There are times where I basically want to query notes for things I can't readily query via search, or things like I want to be able to find all the undone todos where they're in documents whose title match a particular pattern. This is sorta the use case I'm after.

**Q6.2:** Is this MVP or post-MVP?

> post

**Q6.3:** Should the API be:

- REST over HTTP (local server)?
- gRPC?
- IPC-based (for local tools)?
- File-based (read/write CRDT files directly with library)?

> what do you suggest?

---

## 7. Phase Ordering Clarification

**Q7.1:** You want to swap phases 3 and 4 (iOS before advanced features).

So the order would be:

1. Core Foundation (project setup, CRDT, file system, database, tests)
2. Desktop UI (basic three-panel layout, note editing, folder management)
3. iOS App (iOS UI, CRDT integration)
4. Advanced Features (tags, inter-note links, search, export)
5. Documentation & Polish

This means iOS app will initially have limited features (basic note editing, folders) until Phase 4. Correct?

> correct

---

## 8. Note History/Versions UI

**Q8.1:** You said note history is "pre-MVP" (I assume you meant it's IN MVP, not after).

For the UI:

- Should there be a "History" button in the editor toolbar?
- A sidebar that shows history?
- A separate history view/modal?
- Should it show a timeline slider?
- Should it show who made changes and when?
- Should diff view show what changed between versions?

What level of detail for history UI?

> there are too many options, make a suggestion

---

## 9. iOS UI Details

**Q9.1:** For iOS UI, should it be:

**Navigation Pattern:**

- Tab bar at bottom with: Notes / Tags / Settings
- In "Notes" tab: hierarchical navigation (SD list → folder list → note list → note editor)
- Or different structure?

> that looks good to me

**Folder/Tag View:**

- Combined view like desktop?
- Separate tabs?
- Which is more important to access quickly on mobile?

> combined, as both would be commonly used

**Editor:**

- Full-screen editor when editing?
- Toolbar for formatting?
- Keyboard accessory view with shortcuts?

Should I create a detailed iOS UI specification as part of the plan?

> yes to all

---

## 10. Markdown Export - Filename Mangling

**Q10.1:** You mentioned "for export they'll need some form of deterministic mangling" for folder names with special characters.

Should we:

- Replace invalid filesystem characters (`/`, `:`, etc.) with `_` or `-`?
- URL-encode special characters?
- Transliterate unicode to ASCII where possible?
- What's your preference for the mangling strategy?

> go with `_`, otherwise I don't have a strong preference to mangling, other than keyboard typable (e.g. no emojis or other "weird" chars in a filename)
> **Q10.2:** For note titles with forbidden characters, same approach?
> yes

---

## 11. Cross-SD Search

**Q11.1:** When searching in the notes list search box:

- Should search be limited to current SD/folder?
- Or search across all SDs?
- User-selectable?

> user selectable, defaulting to current SD

---

## 12. Folder Collapse State

**Q12.1:** You mentioned folder tree should remember collapse state across restarts.

Should this be:

- Per-SD (each SD remembers its own collapse state)?
- Global (same collapse state across all instances)?
- Stored in local settings (instance-specific)?

> stored in local settings

---

## 13. Settings Storage

**Q13.1:** Where should app settings be stored?

- Electron store (local to instance)?
- Should settings sync across instances somehow?
- Or is it acceptable for each instance to have independent settings (different SDs, different theme, etc.)?

> Electron store

---

## 14. App Icons and Branding

**Q14.1:** For the app icon and branding:

- Should I use placeholder/generic icons in the plan?
- Do you have specific icon/logo in mind?
- Should this be part of the plan, or defer to later?

> part of the plan -- I don't have a specific icon set in mind. I imagine you can find some somewhere whose license is agreeable. BTW: the app should be APACHE v2 licensed

---

## 15. Localization/Internationalization

**Q15.1:** Should the app support multiple languages?

- English only initially?
- Plan for i18n from the start (structure code to support it)?
- Or add later if needed?

> english initially, but with i18n support structure at the start.

---

## 16. Accessibility

**Q16.1:** Should we plan for accessibility features?

- Screen reader support (ARIA labels, proper semantics)?
- Keyboard navigation (already planning this)?
- High contrast mode?
- Font size adjustment?

Is accessibility a priority for MVP, or post-MVP refinement?

> accessibility is MVP

---

## 17. Beta/Alpha Testing

**Q17.1:** Should the plan include:

- Alpha/beta testing phase?
- User feedback collection mechanism?
- Staged rollout?
- Or is this for personal use initially?

> personal use only at first, until I feel good with the feature set to release it

---

## 18. Rollback Rule Clarification

**Q18.1:** You added "NEVER start rolling back the change without asking me and explaining in detail what the problem is."

Just to confirm I understand:

- If I encounter an issue during implementation, I should stop and explain the problem rather than trying alternative approaches on my own?
- Or do you mean specifically for user-requested changes (don't second-guess your requirements)?
- Both?

## Don't second guess my requirement. For example, in another project, I asked you to use a very specific widget, it got hard and you started rolling back what you had done and were going to try to substitute it with something else without at least asking. I had to stop what you were doing and tell you "No, I really want this widget", and you were ultimately able to do it. I don't like having to scold you.

## Notes

These questions cover the new features you mentioned (tri-state checkboxes, Shortcuts integration, APIs) and some follow-ups from your answers. Once these are answered, I'll have everything to create the comprehensive plan.
