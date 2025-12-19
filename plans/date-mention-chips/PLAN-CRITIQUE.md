# Plan Critique

## Findings from Codebase Analysis

### Existing Code We Can Reuse

1. **MentionAutocomplete.tsx** (CommentPanel) - Already implements:
   - Fetching users via `window.electronAPI.mention.getUsers()`
   - Filtering by both handle and name
   - Keyboard navigation (arrow keys, enter, escape)
   - MUI-based UI with avatars
   - We can adapt this for the TipTap Suggestion API

2. **mentionApi.getUsers()** - Already exposed in preload (comment-api.ts)
   - Returns `{ profileId, handle, name }[]`
   - No additional IPC work needed

3. **date-fns** - Already installed, use for date formatting

### Missing Dependency

- `@mui/x-date-pickers` needs to be installed for the date picker dialog

---

## Ordering Review

### Issue: Phase 1.3 is mostly done
The "Add IPC for mention users" task is already complete. Update plan to reflect this.

### Issue: Faster feedback loop possible
Current order builds the entire suggestion system before we can test anything.

**Recommendation:** Restructure to get date keywords working first (simpler), then add users:
1. Build AtMention extension with just date keywords
2. Test that `@today` etc. work
3. Add user fetching and combined list
4. Then do the decoration/click handling

This gets us to something testable faster.

---

## Edge Cases & Risks

### Risk 1: Dual-text storage editing
If document stores `@drew Drew Colthorp` and user places cursor in the middle and edits:
- Could corrupt the mention
- Need mark's `inclusive` setting to control whether edits extend the mark

**Mitigation:**
- Use `inclusive: false` on the mention mark
- If text inside mark changes, consider removing the mark entirely
- OR make the entire mention an atomic inline node (more complex but safer)

### Risk 2: Cursor position after insertion
After inserting `@drew Drew Colthorp ` (with trailing space), cursor should be after the space.

**Mitigation:** Test this explicitly, may need to adjust `command()` to set selection.

### Risk 3: Date editing via picker
When clicking a date chip and picking a new date:
- Need to select the old date text
- Replace with new date
- Should work with undo

**Mitigation:** Use editor transaction properly so it's undoable.

### Risk 4: Users without handles filtered out
Per Q8, users without handles aren't shown. But what if:
- Current user has no handle set?
- Should we warn them in settings?

**Mitigation:** Accept this limitation for now. Current user is included even without handle (per existing handler).

---

## Missing from Plan

1. **Install @mui/x-date-pickers** - Add to Phase 1 setup
2. **Pattern for date detection** - Need regex for `YYYY-MM-DD` format
3. **Undo support verification** - Ensure date picker changes are undoable
4. **Mark inclusive setting** - Important for mention editing behavior

---

## Questions for User

### Q1: Atomic mention nodes vs marks?
The dual-text storage (`@handle Name`) has edge cases with editing. Two options:

**Option A (Marks - current plan):**
- Pros: Simpler, leverages existing patterns
- Cons: User could edit and corrupt mention

**Option B (Atomic inline nodes):**
- Pros: Mention is a single unit, can't partially edit
- Cons: More complex, different pattern than hashtags

Recommendation: Start with marks, see if editing issues arise in practice. Can migrate to nodes later if needed.

### Q2: What if current user has no handle?
Should we still show them in autocomplete? Or prompt them to set one?

---

## Revised Plan Recommendation

1. **Phase 0**: Bug fix (instanceId) - unchanged
2. **Phase 1**: Setup + date keywords only
   - Install deps
   - Create AtMention extension with date keywords
   - Date insertion (no decoration yet)
   - **Checkpoint: Can type `@today` and get date inserted**
3. **Phase 2**: Add users to suggestion
   - Fetch users, combine with date keywords
   - User insertion with mention mark
   - **Checkpoint: Can type `@drew` and see autocomplete**
4. **Phase 3**: Chip decoration & styling
   - Date chip decoration
   - Mention chip rendering (hide handle)
   - **Checkpoint: Chips look styled**
5. **Phase 4**: Click interactions
   - Date picker dialog
   - Mention popover
   - **Checkpoint: Can click chips**
6. **Phase 5**: Polish & edge cases
