# Questions Round 2

## Answering: Range Anchoring Robustness

You asked: "Which would be the most robust given edits may come in from disk or directly from the user?"

**My answer: Option A (Yjs RelativePosition) is most robust** for this architecture.

Here's why:

1. **CRDT-native**: `Y.RelativePosition` is specifically designed for this. It creates a position relative to a specific item ID in the Yjs data structure, not an absolute character offset.

2. **Handles all edit sources**: Whether edits come from:
   - User typing directly → RelativePosition resolves correctly
   - Disk sync (another device) → RelativePosition resolves correctly
   - Concurrent edits → RelativePosition handles conflicts

3. **How it works**:

   ```typescript
   // When user selects text at positions 10-20:
   const startPos = Y.createRelativePositionFromTypeIndex(content, 10);
   const endPos = Y.createRelativePositionFromTypeIndex(content, 20);

   // Later, even after edits, resolve back to absolute positions:
   const start = Y.createAbsolutePositionFromRelativePosition(startPos, doc);
   const end = Y.createAbsolutePositionFromRelativePosition(endPos, doc);
   // start.index and end.index now reflect current positions
   ```

4. **Orphan handling**: If the anchored text is completely deleted, `createAbsolutePositionFromRelativePosition` returns `null`. We can then:
   - Show comment as "orphaned" with visual indicator
   - Offer to delete or re-anchor
   - Keep comment visible in sidebar even without text anchor

5. **Alternative (Option C - marks)** would also work but:
   - Requires modifying document structure
   - Comments become entangled with content
   - Harder to query/filter comments separately
   - More complex undo/redo behavior

**Recommendation confirmed: Option A (Yjs RelativePosition)**

## Go with A

## New Questions (given expanded MVP scope)

### 1. @-Mentions: Who Can Be Mentioned?

You want @-mentions in comments. But who can be mentioned?

**Option A: Free-form @-names**

- User types @drew, @alice, etc.
- No validation - just styled differently
- No notifications (for now)

**Option B: Known users from sync**

- Mention users whose edits appear in note history
- Autocomplete from seen usernames
- Still no notifications

**Option C: Contact list**

- Add a "contacts" feature to preferences
- Autocomplete from contacts
- Future: notifications

**My recommendation**: Option A for MVP - free-form @-names with visual styling. We can enhance later.

The set of usernames should be in the profile files that are in the sync directory.

---

### 2. Reactions: Emoji Picker Details

You want emoji reactions on comments. Details:

**Question A**: Standard emoji picker (like macOS native) or custom subset?

standard emoji picker.

**Question B**: Can users add multiple reactions to the same comment, or one reaction per user?
multiple

**Question C**: Should reactions show who reacted (hover to see names)?
yes

**My recommendation**:

- Standard emoji picker (fewer to implement, users know it)
- Multiple reactions per user allowed
- Show reactor names on hover

---

### 3. Username Preferences

You mentioned username is already in preferences. Can you confirm where this is so I can integrate?

I'll search for it, but want to confirm the field name and location.

## I don't recall, but there's a user tab in the settings panel where you can specify the full name and the @mention

### 4. Resolved Comments Behavior

You want resolution AND re-open. How should resolved comments display?

**Option A: Hidden by default**

- Resolved comments don't show in sidebar
- Toggle "Show resolved" to see them
- Visual distinction when shown (strikethrough, grayed out)

**Option B: Collapsed**

- Resolved comments show but collapsed to one line
- Click to expand

**Option C: Always visible but styled differently**

- Same as active comments but grayed out / muted

**My recommendation**: Option A - hidden by default with toggle. Keeps focus on active discussions.
option A

---

### 5. Comment Deletion Scope

You want deletion. Clarify:

**Question A**: Can any user delete any comment, or only their own?

**Question B**: When deleting a comment with replies:

- Delete entire thread?
- Delete only the comment, keep replies (orphaned)?
- Prevent deletion if has replies?

**My recommendation**:

- Users can only delete their own comments
- Deleting a comment with replies: delete entire thread (with confirmation)

I like your recommendation
