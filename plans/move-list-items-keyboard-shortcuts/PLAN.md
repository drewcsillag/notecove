# Move Block Up/Down Keyboard Shortcuts

**Overall Progress:** `100%`

## Summary

Implement `Alt-Up` and `Alt-Down` keyboard shortcuts to move blocks (list items, paragraphs, headings, blockquotes, code blocks) up and down within their parent container.

## Decisions Made

See [QUESTIONS-1.md](./QUESTIONS-1.md) and [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) for full discussion.

- **Shortcuts**: `Alt-Up` / `Alt-Down`
- **Scope**: List items (bullet, ordered, task), paragraphs, headings, blockquotes, code blocks (not tables)
- **Nested lists**: Move item with all children as a unit
- **Boundaries**: Do nothing at top/bottom of container
- **Cursor**: Preserve relative position after move
- **Text selection**: Use selection start ($from) to determine block to move
- **Early integration**: Register extension in Phase 1 for faster feedback

## Tasks

### Phase 1: List Item Movement (bullet, ordered, task)

- [x] 🟩 **1.1: Create MoveBlock extension and register**
  - [x] 🟩 Create `extensions/MoveBlock.ts` with skeleton
  - [x] 🟩 Declare `moveBlockUp` and `moveBlockDown` commands (return false initially)
  - [x] 🟩 Add `Alt-Up` and `Alt-Down` keyboard shortcuts
  - [x] 🟩 Register in TipTapEditor.tsx

- [x] 🟩 **1.2: Write tests for list item movement**
  - [x] 🟩 Create `extensions/__tests__/MoveBlock.test.ts`
  - [x] 🟩 Test: Move bullet list item up
  - [x] 🟩 Test: Move bullet list item down
  - [x] 🟩 Test: Move task item up
  - [x] 🟩 Test: Move task item down
  - [x] 🟩 Test: Mixed list (listItem and taskItem) movement
  - [x] 🟩 Test: No-op at top boundary
  - [x] 🟩 Test: No-op at bottom boundary
  - [x] 🟩 Test: Nested list item moves with children
  - [x] 🟩 Test: Cursor position preserved

- [x] 🟩 **1.3: Implement list item movement**
  - [x] 🟩 `findListItemInfo()` - find listItem/taskItem containing cursor
  - [x] 🟩 `moveNode()` - helper to move node between positions
  - [x] 🟩 `moveBlockUp` command for list items
  - [x] 🟩 `moveBlockDown` command for list items
  - [x] 🟩 All list item tests pass (10 tests)

### Phase 2: Other Block Types (paragraph, heading, blockquote, code block)

- [x] 🟩 **2.1: Write tests for other blocks**
  - [x] 🟩 Test: Move paragraph up/down
  - [x] 🟩 Test: Move heading up/down
  - [x] 🟩 Test: Move blockquote up/down
  - [x] 🟩 Test: Move code block up/down
  - [x] 🟩 Test: No-op at document boundaries
  - [x] 🟩 Test: No movement when in table (returns false)

- [x] 🟩 **2.2: Implement other block movement**
  - [x] 🟩 `findTopLevelBlockInfo()` - find top-level block containing cursor
  - [x] 🟩 Extend moveBlockUp/Down to handle top-level blocks
  - [x] 🟩 Skip tables (return false)
  - [x] 🟩 All block tests pass (11 tests)

### Phase 3: Final Validation

- [x] 🟩 **3.1: Manual testing**
  - [x] 🟩 Test in running app with various content
  - [x] 🟩 Verify no shortcut conflicts

- [x] 🟩 **3.2: CI and code review**
  - [x] 🟩 Run full CI suite (all 368 e2e tests + unit tests passed)
  - [x] 🟩 Self code review
  - [x] 🟩 Ready for commit

## Technical Notes

### Key Files

- New: `extensions/MoveBlock.ts`
- New: `extensions/__tests__/MoveBlock.test.ts`
- Modify: `TipTapEditor.tsx` - Register extension

### Algorithm

```typescript
moveBlockUp($from):
  1. If in table, return false
  2. If in list item (listItem or taskItem):
     a. Find parent list (bulletList/orderedList)
     b. Find current item's index in parent
     c. If index === 0, return false (at top)
     d. Get previous sibling
     e. Swap positions (delete + insert)
     f. Restore cursor
  3. Else (top-level block):
     a. Find the top-level block containing cursor
     b. Find previous sibling block at depth 1
     c. If none, return false
     d. Swap positions
     f. Restore cursor
```

### Position Math (from TriStateTaskItem.ts pattern)

```typescript
if (targetPos < currentPos) {
  // Moving backward: insert first, then delete
  tr.insert(targetPos, Fragment.from(node));
  const shiftedPos = currentPos + node.nodeSize;
  tr.delete(shiftedPos, shiftedPos + node.nodeSize);
} else {
  // Moving forward: delete first, then insert
  tr.delete(currentPos, currentPos + node.nodeSize);
  tr.insert(targetPos - node.nodeSize, Fragment.from(node));
}
```
