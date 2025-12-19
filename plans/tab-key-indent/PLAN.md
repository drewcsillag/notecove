# Tab Key Indent - Implementation Plan

**Overall Progress:** `100%`

## Summary

Create a TipTap extension that intercepts Tab/Shift+Tab to insert/remove tab characters instead of letting the browser move focus. Modify existing list item extensions to only indent/outdent when cursor is at content start. TabIndent serves as the fallback handler.

## Requirements

- **Tab**: Insert literal `\t` character
- **Shift+Tab**: Remove tab character at cursor position if present
- **Tables**: Keep existing cell navigation (unchanged)
- **Task/List items**:
  - At start of content → indent/outdent (existing behavior)
  - Elsewhere in content → insert/remove tab (new behavior)
- **Works in**: paragraphs, headings, code blocks, blockquotes

## Approach

**Approach A (incremental):**

1. Modify ListItem to check cursor position → return false if not at start
2. Modify TriStateTaskItem to check cursor position → return false if not at start
3. TabIndent extension as fallback → always inserts/removes tab

This preserves existing indent logic while adding tab insertion as fallback.

## Tasks

### Phase 0: CSS Spike (verify tabs render)

- [x] 🟩 **0.1 Quick CSS verification**
  - [x] 🟩 Check editor's `white-space` CSS property
  - [x] 🟩 Added `white-space: pre-wrap` to `.ProseMirror` styles

### Phase 1: Create TabIndent Extension

- [x] 🟩 **1.1 Write tests for TabIndent extension**
  - [x] 🟩 Test: Tab inserts `\t` in paragraph
  - [x] 🟩 Test: Tab inserts `\t` in heading
  - [x] 🟩 Test: Tab inserts `\t` in code block
  - [x] 🟩 Test: Tab inserts `\t` in blockquote
  - [x] 🟩 Test: Shift+Tab removes `\t` at cursor
  - [x] 🟩 Test: Shift+Tab does nothing if no `\t` before cursor

- [x] 🟩 **1.2 Implement TabIndent extension**
  - [x] 🟩 Create `extensions/TabIndent.ts`
  - [x] 🟩 Implement `Tab` keyboard shortcut handler (insert `\t`)
  - [x] 🟩 Implement `Shift-Tab` keyboard shortcut handler (remove `\t` if present)

- [x] 🟩 **1.3 Integrate extension into editor**
  - [x] 🟩 Add TabIndent to TipTapEditor.tsx extensions array (at end, as fallback)

### Phase 2: Modify List Item Extensions

- [x] 🟩 **2.1 Write tests for cursor-position-aware indentation**
  - [x] 🟩 Test: Tab at start of task item indents the item
  - [x] 🟩 Test: Tab mid-content in task item inserts `\t`
  - [x] 🟩 Test: Shift+Tab at start of task item outdents the item
  - [x] 🟩 Test: Shift+Tab mid-content in task item removes `\t`
  - [x] 🟩 Test: Tab at start of bullet list item indents the item
  - [x] 🟩 Test: Tab mid-content in bullet list item inserts `\t`
  - [x] 🟩 Test: Shift+Tab at start of bullet list item outdents the item
  - [x] 🟩 Test: Shift+Tab mid-content in bullet list item removes `\t`

- [x] 🟩 **2.2 Modify TriStateTaskItem**
  - [x] 🟩 Update Tab handler: check if cursor at content start, return false otherwise
  - [x] 🟩 Update Shift-Tab handler: check if cursor at content start, return false otherwise

- [x] 🟩 **2.3 Extend ListItem**
  - [x] 🟩 Create NotecoveListItem extension that extends TipTap's ListItem
  - [x] 🟩 Override Tab handler: check if cursor at content start, return false otherwise
  - [x] 🟩 Override Shift-Tab handler: check if cursor at content start, return false otherwise
  - [x] 🟩 Update TipTapEditor.tsx to use NotecoveListItem

### Phase 3: Table Behavior Verification

- [x] 🟩 **3.1 Verify table Tab behavior unchanged**
  - [x] 🟩 Test: Tab in table navigates to next cell
  - [x] 🟩 Test: Shift+Tab in table navigates to previous cell
  - [x] 🟩 (Table.ts already returns false when not in table - works correctly)

### Phase 4: Final Validation

- [x] 🟩 **4.1 Manual testing**
  - [x] 🟩 All 33 Tab-related tests pass
  - [x] 🟩 CI passed

- [x] 🟩 **4.2 Run CI**
  - [x] 🟩 All tests pass
  - [x] 🟩 Ready for commit

## Files Created/Modified

### New Files

- `extensions/TabIndent.ts` - Tab/Shift-Tab extension for inserting/removing tab characters
- `extensions/NotecoveListItem.ts` - Custom ListItem with cursor-position-aware Tab
- `extensions/__tests__/TabIndent.test.ts` - Tests for TabIndent extension
- `extensions/__tests__/ListItemTabBehavior.test.ts` - Tests for list item Tab behavior

### Modified Files

- `TipTapEditor.tsx` - Added TabIndent, NotecoveListItem, and CSS for tab rendering
- `extensions/TriStateTaskItem.ts` - Modified Tab/Shift-Tab to check cursor position

## Links

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial questions and answers
- [QUESTIONS-2.md](./QUESTIONS-2.md) - Clarifications
- [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) - Plan critique findings
