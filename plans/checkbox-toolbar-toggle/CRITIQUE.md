# Plan Critique

## Review as a Staff Engineer

### 1. Ordering Issues

**Problem Found**: The plan has toolbar handler changes (Phase 3) depend on new commands (Phases 1-2), which is correct. However, the button handler logic in Phase 3 is more complex than initially described.

**Issue**: The bullet/numbered button behavior requires knowing:

1. Whether we're on a taskItem or listItem
2. What list type we're currently in (bulletList or orderedList)

This means the toolbar needs access to `editor.isActive('taskItem')` and `editor.isActive('bulletList')` together to make decisions. The plan should be more explicit about this logic.

### 2. Feedback Loop

**Good**: Writing tests first (TDD) means we can verify behavior incrementally.

**Improvement**: We should add a manual testing step after Phase 2 (new commands added) so we can verify the commands work via browser console before wiring them to buttons.

### 3. Debug Tools

**Adequate**: The browser console allows running `editor.chain().focus().<command>().run()` directly. No additional debug tooling needed.

### 4. Missing Items

**Found**:

1. **No test file exists for TriStateTaskItem** - Need to create `extensions/__tests__/TriStateTaskItem.test.ts`

2. **The listItem type name** - Need to confirm it's `'listItem'` from `@tiptap/extension-list-item`. ✅ Verified via `NotecoveListItem.ts`

3. **Command interface declaration** - `convertToListItem` needs to be added to the `Commands` interface in TriStateTaskItem.ts

4. **E2E tests** - The plan only mentions unit tests. Should we add E2E tests for the toolbar buttons? (Probably not required for this fix - unit tests on the commands are sufficient)

### 5. Risk Assessment

**Risks identified**:

1. **TipTap's toggleBulletList/toggleOrderedList behavior** - These built-in commands may interfere with our custom logic. We need to test what they do when on a taskItem.

2. **List type switching** - When switching from bulletList to orderedList while on a taskItem, we need to ensure the entire list switches type, not just the current item.

3. **Edge case: nested lists** - What happens if a taskItem is nested inside another list? The plan doesn't address this explicitly.

### 6. Suggested Plan Refinements

1. **Clarify toolbar handler logic** with pseudocode:

   ```
   Bullet button:
     if isActive('taskItem') && isActive('bulletList'):
       convertToListItem()  // Already in bullet list, convert to regular item
     else:
       toggleBulletList()   // Works for: ordered->bullet, or toggle off

   Numbered button:
     if isActive('taskItem') && isActive('orderedList'):
       convertToListItem()  // Already in ordered list, convert to regular item
     else:
       toggleOrderedList()  // Works for: bullet->ordered, or toggle off

   Checkbox button:
     toggleTaskItem()  // Converts between listItem <-> taskItem
   ```

2. **Add test for list type switching while on taskItem** - Verify that clicking "Numbered" on a taskItem in a bulletList switches to orderedList while keeping taskItem status.

3. **Test edge case**: What if you're on a paragraph (not in a list) and click checkbox? Should it create a bulletList with a taskItem, or do nothing?

---

## Questions for User

None - the plan refinements above are clarifications, not ambiguities requiring user input.
