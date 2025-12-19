# Plan Review Questions

## 1. Text Selection Handling

Currently the plan assumes cursor (caret) position. What should happen if user has selected a range of text?

Options:

- (A) Only work when there's a cursor (no selection) - return false otherwise
- (B) Move the block containing the selection start ($from)
- (C) Move all blocks that the selection spans

**My recommendation**: (B) - Move the block containing selection start. This matches VS Code behavior.

B

## 2. Early Integration

Should we register the extension earlier (Phase 1) to enable manual testing during development, even before all block types are implemented?

- (A) Yes, register early for faster feedback loop
- (B) No, wait until fully implemented

**My recommendation**: (A) - Faster feedback and we can test list items work before building paragraph support.

A

## 3. Phase 2 Collapse

Phase 2 (task items) is likely redundant if Phase 1 implementation checks for both `listItem` and `taskItem` node types. Should we:

- (A) Collapse Phase 2 into Phase 1 (just add task item tests alongside list item tests)
- (B) Keep separate for cleaner organization

**My recommendation**: (A) - Less overhead, and the logic is identical.

A
