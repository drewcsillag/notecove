# Feature Implementation Plan: Fix Checkbox Parsing

**Overall Progress:** `100%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)

**Questions & Answers:** [QUESTIONS-1.md](./QUESTIONS-1.md)

## Summary

Fix the bug where typing `[]` anywhere in a list item converts it to a checkbox. The `[]` syntax should only trigger checkbox conversion when at the **beginning** of the line/content.

## Root Cause

In `TriStateTaskItem.ts`, the input rule handler has two code paths:

- **Case 1 (in a list)**: Missing position check - converts regardless of where `[]` appears
- **Case 2 (not in a list)**: Correctly checks `textBefore.trim() !== ''`

## Tasks

- [x] 🟩 **Step 1: Write failing test**
  - [x] 🟩 Add E2E test in `tri-state-checkboxes.spec.ts` that types `[]` in middle of list item content
  - [x] 🟩 Verify test fails (checkbox is incorrectly created)
  - Note: Unit tests can't test input rules (they require real typing), so E2E tests were used
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 2: Fix the input rule handler**
  - [x] 🟩 Modify Case 1 in `createTaskInputHandler` to check if `[]` is at start of list item content
  - [x] 🟩 Verify failing test now passes
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 3: Run full test suite**
  - [x] 🟩 Run targeted tests for Task List E2E (31 passed, 2 skipped)
  - [x] 🟩 Run CI checks (format, lint, typecheck, test) - all passed
  - [x] 🟩 Update PLAN.md

## Files Modified

1. `packages/desktop/e2e/tri-state-checkboxes.spec.ts` - Added 2 E2E tests for the bug
2. `packages/desktop/src/renderer/src/components/EditorPanel/extensions/TriStateTaskItem.ts` - Fixed bug
3. `packages/desktop/src/renderer/src/components/EditorPanel/extensions/__tests__/TriStateTaskItem.test.ts` - Added comment about E2E tests

## The Fix

Added position check to Case 1 (when already in a list) to match the behavior of Case 2:

```typescript
// Case 1: Already in a list - convert the list item to a task item
if (isInList($from)) {
  const listItemPos = findParentListItemPos($from);
  if (listItemPos === null) return;

  // NEW: Check if [] is at the start of the list item content
  const parentNode = $from.parent;
  if (parentNode.type.name !== 'paragraph') return;

  const textBefore = parentNode.textBetween(0, $from.parentOffset - (range.to - range.from));
  if (textBefore.trim() !== '') return; // Not at start, don't convert

  // ... rest of conversion logic
}
```

## Deferred Items

None
