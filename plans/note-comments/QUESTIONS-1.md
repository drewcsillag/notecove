# Questions for Note Comments Feature

## 1. Data Storage Strategy

The app uses Yjs CRDT for collaborative editing with SQLite as a query cache. For comments, there are two main approaches:

**Option A: Comments stored IN the note CRDT (Y.Map alongside content)**

- Pros: Comments are part of the note document, sync automatically with note
- Cons: Comments tied to note lifecycle, range anchoring to text positions can drift as text changes

**Option B: Comments stored in SEPARATE CRDT documents (one per note)**

- Pros: Cleaner separation, can delete comments without affecting note, potentially simpler range management
- Cons: More complexity in sync orchestration, need to load two documents per note

**Option C: Comments stored ONLY in SQLite (not CRDT)**

- Pros: Simplest implementation, no CRDT complexity for comments
- Cons: No real-time collaboration on comments, no offline-first sync

**Question**: Which approach do you prefer? My recommendation is **Option A** since comments are fundamentally part of the note and benefit from the same sync mechanism. But this is a meaningful architectural choice.

## Agree -- option A

## 2. Range Anchoring Strategy

When user selects text at positions 10-20 and adds a comment, what happens when text is inserted before position 10?

**Option A: Relative Positions (Yjs RelativePosition)**

- Comments anchor to Y.XmlFragment positions using Yjs RelativePosition API
- Automatically adjust as document changes
- If the exact text is deleted, comment becomes "orphaned" at nearest valid position

**Option B: Text Markers (store the selected text)**

- Store the original text string, re-find it in document
- Fragile: breaks if user edits the selected text

**Option C: Node-based (comments are inline nodes)**

- Comments become ProseMirror marks or nodes in the document
- Most robust anchoring but modifies document structure
- Similar to how track-changes systems work

**Question**: Which anchoring approach? My recommendation is **Option A (Yjs RelativePosition)** - it's the canonical CRDT approach and handles concurrent edits gracefully.

Which would be the most robust given edits may come in from disk or directly from the user?

---

## 3. Comment Thread Features

**Question**: What features do you want for comment threads?

- [ ] **Replies**: Multiple people can reply to a comment (thread style)
- [ ] **Resolution**: Mark a thread as "resolved" (hides but doesn't delete)
- [ ] **Re-open**: Can resolved threads be re-opened?
- [ ] **Editing**: Can users edit their own comments after posting?
- [ ] **Deletion**: Can users delete their own comments? Entire threads?
- [ ] **Reactions**: Emoji reactions to comments (like GitHub)?
- [ ] **Mentions**: @-mention other users in comments?

For MVP, I'd suggest: Replies ✓, Resolution ✓, Editing own comments ✓, Deletion ✓

I'd like all of them.

---

## 4. User Identity

Currently the app doesn't appear to have user accounts/authentication.

**Question**: How should comments identify authors?

**Option A: Anonymous with device name**

- Use device name or "You" for current user
- Show "Unknown" for comments from other synced devices

**Option B: Local username setting**

- Add a "Your name" setting in preferences
- Store as metadata in comments

**Option C: Defer to future auth system**

- Use placeholder identity now
- Plan for future user accounts

**My recommendation**: Option B - simple local username setting for now.

## Option B. We have a username in the preferences and part of it was literally for this use case.

## 5. UI Layout

**Question**: How should comments be displayed?

**Option A: Right sidebar (Google Docs style)**

- Dedicated panel showing all comments for current note
- Comments aligned with their text position
- Click comment to highlight text, click text to show comment

**Option B: Inline bubbles (Notion style)**

- Small icons in the gutter next to commented text
- Click to expand comment thread inline

**Option C: Both**

- Inline markers with sidebar panel for full view

**My recommendation**: Option A (sidebar) is cleaner and matches Google Docs mental model. We can add inline markers (Option C) later.

A

---

## 6. Toolbar/Context Menu Integration

**Question**: How does user initiate adding a comment?

**Option A: Selection context menu**

- Right-click selected text → "Add comment"

**Option B: Keyboard shortcut**

- Cmd+Shift+M or similar

**Option C: Toolbar button**

- Button in editor toolbar when text is selected

**Option D: All of the above**

**My recommendation**: Option D - provide all three for discoverability and power users.

D

---

## 7. Comment Panel Visibility

**Question**: When should the comment panel be visible?

**Option A: Always visible when note has comments**

- Panel opens automatically if note has comments
- User can close it manually

**Option B: Manual toggle only**

- User explicitly opens/closes comment panel
- Badge shows comment count in toolbar

**Option C: Visible when interacting with comments**

- Opens when user clicks a comment marker
- Opens when user adds a comment
- Closes when clicking outside or pressing Escape

**My recommendation**: Option C - context-driven visibility with manual override.

## C

## 8. Visual Markers

**Question**: How should commented text be visually indicated?

**Option A: Background highlight (subtle yellow/orange)**

- Classic Google Docs style

**Option B: Underline (wavy or dotted)**

- More subtle, less disruptive to reading

**Option C: Gutter markers only**

- No inline styling, just icons in margin

**Option D: Configurable**

- User preference

**My recommendation**: Option A (background highlight) - it's the most recognizable pattern.

## A

## 9. Offline Behavior

Since the app uses Yjs, offline editing is built-in.

**Question**: Any special offline considerations for comments?

- Comments created offline should sync when reconnected (automatic with Yjs)
- Conflict resolution: CRDT handles concurrent comment edits
- Should we show "pending sync" status for offline comments?

Given the architecture, I don't think we need to do anything special here.

---

## 10. MVP Scope

**Question**: For the initial implementation, what's the minimum viable feature set?

My suggested MVP:

1. Add comment on text selection (toolbar + keyboard shortcut)
2. Right sidebar panel showing all comments
3. Reply to comments
4. Resolve/unresolve threads
5. Delete comments
6. Visual highlighting of commented text
7. Click comment → scroll to text (and vice versa)

Deferred to later:

- Reactions
- @-mentions
- Inline bubble UI
- Comment search/filter
- Export comments

Is this scope appropriate?

## Nothing specified is optional. We're going to do all of it. Everything is for MVP

## 11. Testing Requirements

Given TDD mandate:

**Question**: What level of test coverage is expected?

- Unit tests for CRDT operations (comment CRUD)
- Unit tests for RelativePosition anchoring
- Integration tests for IPC round-trips
- E2E tests for UI interactions?

I'll write tests first per TDD requirement - just want to confirm scope.

Unit, integration and E2E
