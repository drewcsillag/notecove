# Backspace/Delete Link Handling - Implementation Plan

**Overall Progress:** `100%`

## Summary

Implement two-stage backspace/delete behavior for inter-note links:

- **Backspace after `]]`**: First press selects the link, second press deletes it
- **Delete before `[[`**: First press selects the link, second press deletes it

See [QUESTIONS-1.md](./QUESTIONS-1.md) for requirements discussion.

---

## Tasks

### Phase 1: Tests First (TDD)

- [x] 🟩 **1.1 Create test file for link keyboard handling**
  - [x] 🟩 Create `InterNoteLinkKeyboard.test.ts` in extensions/**tests**/
  - [x] 🟩 Set up test editor with InterNoteLink extension

- [x] 🟩 **1.2 Write tests for Backspace behavior**
  - [x] 🟩 Test: Backspace after `]]` with cursor selects the link
  - [x] 🟩 Test: Backspace when link already selected - second press deletes it
  - [x] 🟩 Test: Backspace not adjacent to link passes through
  - [x] 🟩 Test: Backspace with range selection passes through
  - [x] 🟩 Test: Consecutive links - only selects immediately preceding link

- [x] 🟩 **1.3 Write tests for Delete behavior**
  - [x] 🟩 Test: Delete before `[[` with cursor selects the link
  - [x] 🟩 Test: Delete when link already selected - second press deletes it
  - [x] 🟩 Test: Delete not adjacent to link passes through
  - [x] 🟩 Test: Delete with range selection passes through

- [x] 🟩 **1.4 Edge case tests**
  - [x] 🟩 Test: Link at start of paragraph
  - [x] 🟩 Test: Link at end of paragraph
  - [x] 🟩 Test: Link is only content in paragraph

### Phase 2: Implementation

- [x] 🟩 **2.1 Add helper functions for link detection**
  - [x] 🟩 `findLinkEndingAt(doc, pos)`: Find `[[uuid]]` ending at position
  - [x] 🟩 `findLinkStartingAt(doc, pos)`: Find `[[uuid]]` starting at position
  - [x] 🟩 Both return `{ from, to }` range or `null`

- [x] 🟩 **2.2 Implement Backspace handler**
  - [x] 🟩 Return false if selection is not collapsed (range selection)
  - [x] 🟩 Check if cursor immediately after `]]` using `findLinkEndingAt`
  - [x] 🟩 If link found AND not already selected: select it, return true
  - [x] 🟩 If link already selected OR not found: return false (default behavior)

- [x] 🟩 **2.3 Implement Delete handler**
  - [x] 🟩 Return false if selection is not collapsed
  - [x] 🟩 Check if cursor immediately before `[[` using `findLinkStartingAt`
  - [x] 🟩 If link found AND not already selected: select it, return true
  - [x] 🟩 If link already selected OR not found: return false

- [x] 🟩 **2.4 Add keyboard shortcuts to InterNoteLink extension**
  - [x] 🟩 Add `addKeyboardShortcuts()` method
  - [x] 🟩 Register Backspace and Delete handlers

### Phase 3: Verification

- [x] 🟩 **3.1 Run all tests and verify pass** - 18 tests passing
- [x] 🟩 **3.2 Manual testing in the app** - Passed
- [x] 🟩 **3.3 Run CI** - All checks passed

---

## Technical Notes

### Link Pattern

Links are stored as `[[uuid]]` where uuid is `8-4-4-4-12` hex format.
Pattern: `/\[\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\]/gi`

### Two-Stage Behavior Logic

```
if (selection is range): return false  // let default handle
if (link adjacent to cursor):
  if (selection already spans this link): return false  // let default delete
  else: select the link, return true
else: return false  // no link, default behavior
```

### Key Files

- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/InterNoteLink.ts`
- `packages/shared/src/utils/link-extractor.ts`

### Risks Mitigated

1. **Re-selection loop**: Handled by checking if link already selected
2. **Range selection interference**: Handled by checking `selection.empty`
3. **Handler priority**: Return `false` appropriately to let other handlers run
