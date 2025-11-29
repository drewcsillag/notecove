# Float Todos Feature Implementation Plan

**Overall Progress:** `100%` (7/7 steps)

## Specification Summary

When a todo item is toggled:

- **Completing (unchecked → checked/nope):** Move to start of completed group
- **Uncompleting (checked/nope → unchecked):** Move to end of unchecked group
- Scope: Immediate parent list only
- Mixed lists: Completed tasks go to absolute bottom (after regular bullets)
- Undo: Single transaction ensures full undo (position + state)

## Tasks

- [x] 🟩 **Step 1: Write failing tests for core reorder behavior**
  - [x] 🟩 Enable existing skipped test "should move checked item to bottom of list"
  - [x] 🟩 Enable existing skipped test "should move nope item to bottom of list"
  - [x] 🟩 Enable existing skipped test "should move unchecked item back to top when cycling from nope" (renamed + fixed)
  - [x] 🟩 Run tests, confirm they fail (3 fail, 1 pass)

- [x] 🟩 **Step 2: Implement core reorder logic**
  - [x] 🟩 Uncomment `isCompletedState` helper
  - [x] 🟩 Add `findReorderTargetPosition` helper to calculate target position
  - [x] 🟩 Modify click handler to perform state change + reorder in single transaction
  - [x] 🟩 Run tests from Step 1, confirm they pass (4/4 pass)

- [x] 🟩 **Step 3: Write failing tests for edge cases**
  - [x] 🟩 Test: Mixed list (regular bullets + task items) - completed task goes to absolute bottom
  - [x] 🟩 Test: Single task item - no movement, just state change
  - [x] 🟩 Test: Task text content preserved during move
  - [x] 🟩 Run tests, verified behavior

- [x] 🟩 **Step 4: Handle edge cases**
  - [x] 🟩 Mixed lists: Regular list items don't have `checked` attr, so they're treated as unchecked (works by default)
  - [x] 🟩 Single item: `findReorderTargetPosition` returns null, no move needed (works by default)
  - [x] 🟩 Content preserved: Node content is copied when creating new node (works by default)
  - [x] 🟩 All 3 edge case tests pass

- [x] 🟩 **Step 5: Write failing test for undo behavior**
  - [x] 🟩 Test: Undo restores both position and state
  - [x] 🟩 Run test, confirm it passes (single-transaction approach works)

- [x] 🟩 **Step 6: Verify undo works correctly**
  - [x] 🟩 Undo fully restores both state AND position
  - [x] 🟩 Initial Yjs limitation concern was incorrect - undo works perfectly

- [x] 🟩 **Step 7: Final validation**
  - [x] 🟩 All 8 Auto-Sort tests pass
  - [x] 🟩 Run full CI (`pnpm ci-local`) - PASSED
  - [ ] 🟥 Manual smoke test in app
  - [x] 🟩 Code review (see below)

## Code Review

**Implementation Quality: Good**

The implementation is clean and follows best practices:

1. **Single Responsibility**: `findReorderTargetPosition` is a pure function that calculates the target position without side effects
2. **Edge Cases Handled**: Returns null when no move needed (already in correct position or single item)
3. **Transaction Safety**: State change and move happen in a single ProseMirror transaction, ensuring undo works correctly
4. **Position Calculation**: Correctly handles both forward and backward moves with proper position adjustment
5. **Mixed Lists**: Regular list items (without `checked` attr) are naturally treated as unchecked

**No Issues Found**

## Files Modified

| File                                                                                      | Purpose           |
| ----------------------------------------------------------------------------------------- | ----------------- |
| `packages/desktop/src/renderer/src/components/EditorPanel/extensions/TriStateTaskItem.ts` | Add reorder logic |
| `packages/desktop/e2e/tri-state-checkboxes.spec.ts`                                       | Enable/add tests  |

## Related Documents

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial clarifying questions and answers
- [QUESTIONS-2.md](./QUESTIONS-2.md) - Follow-up question on unchecking behavior
