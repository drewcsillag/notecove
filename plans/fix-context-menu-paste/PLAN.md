# Fix Context Menu Paste Bug

**Overall Progress:** `90%` (pending CI verification)

## Problem Summary

When pasting via context menu in the TipTap editor:

1. `<meta charset="utf-8">` tags appear in pasted content
2. Extra newlines are sometimes added
3. Keyboard paste (Cmd+V) works correctly

**Root Cause**: `handleContextMenuPaste` reads raw HTML blob from clipboard and passes it directly to `insertContent()` without sanitization. External sources (browsers, other apps) include HTML metadata in the clipboard.

## Requirements (from [QUESTIONS-1.md](./QUESTIONS-1.md))

- Support pasting from anywhere (internal, browsers, Word, etc.) as much as reasonably possible
- Preserve all formatting that TipTap supports (Option A)
- Add "Paste without formatting" option (like other editors)
- Add tests for `<meta charset>` and `<html><body>` wrapped content

## Plan Critique

See [PLAN-CRITIQUE.md](./PLAN-CRITIQUE.md) for detailed analysis.

**Key changes from critique:**

- Extract sanitization to utility file for easier testing
- Add unit tests for sanitizer before integration tests
- Add edge case tests (empty clipboard, large content)

---

## Tasks

### Step 1: Create sanitization utility with unit tests (TDD)

- [x] 🟩 **1.1** Create utility file `packages/desktop/src/renderer/src/utils/clipboard-sanitizer.ts`
- [x] 🟩 **1.2** Write unit tests in `__tests__/clipboard-sanitizer.test.ts`:
  - Test stripping `<meta charset="utf-8">`
  - Test extracting content from `<html><body>` wrapper
  - Test stripping `<style>`, `<script>`, `<link>` tags
  - Test preserving formatting (bold, italic, links, etc.)
  - Test handling Microsoft Office HTML (mso-\* styles, o:p tags)
  - Test edge cases: empty string, whitespace-only, no body tag
- [x] 🟩 **1.3** Implement `sanitizeClipboardHtml()` to make tests pass

### Step 2: Write integration tests for context menu paste

- [x] 🟩 **2.1** Add test for pasting HTML with `<meta charset="utf-8">` via context menu
- [x] 🟩 **2.2** Add test for pasting HTML wrapped in `<html><body>` via context menu
- [x] 🟩 **2.3** Add test for preserving formatting through context menu paste

### Step 3: Fix `handleContextMenuPaste`

- [x] 🟩 **3.1** Import sanitization utility into TipTapEditor.tsx
- [x] 🟩 **3.2** Update `handleContextMenuPaste` to sanitize HTML before `insertContent()`
- [x] 🟩 **3.3** Run integration tests - should now pass

### Step 4: Add "Paste without formatting" feature

- [x] 🟩 **4.1** Add unit test for paste-as-plain-text (uses `text/plain` only)
- [x] 🟩 **4.2** Create `handleContextMenuPasteAsPlainText` function
- [x] 🟩 **4.3** Add "Paste without formatting" menu item to context menu UI
- [x] 🟩 **4.4** Add keyboard shortcut hint (⇧⌘V) to menu item

### Step 5: Final verification

- [x] 🟩 **5.1** Run all clipboard-related tests (53 tests pass)
- [ ] 🟨 **5.2** Run CI
- [ ] 🟥 **5.3** Manual testing (if requested)

---

## Implementation Summary

### Files Created

- `packages/desktop/src/renderer/src/utils/clipboard-sanitizer.ts` - Sanitization utility
- `packages/desktop/src/renderer/src/utils/__tests__/clipboard-sanitizer.test.ts` - 34 unit tests

### Files Modified

- `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx`:
  - Added import for `sanitizeClipboardHtml`
  - Updated `handleContextMenuPaste` to sanitize HTML before insertion
  - Added `handleContextMenuPasteAsPlainText` function
  - Added "Paste without formatting" menu item with ⇧⌘V hint
- `packages/desktop/src/renderer/src/components/EditorPanel/__tests__/context-menu-clipboard.test.ts`:
  - Added 7 new tests for HTML sanitization and paste-as-plain-text

### Test Results

- 34 unit tests for sanitization function
- 19 integration tests for context menu operations
- Total: 53 tests passing
