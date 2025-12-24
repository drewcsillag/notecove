# Plan Critique - Context Menu Cut/Paste Fix

## Review Summary

### ✅ Ordering - Good

- Tests first (TDD) is correct
- Step 2 (state update) must come before Steps 3-5
- Steps 3 & 4 share logic and are correctly adjacent
- Dependencies are properly ordered

### ✅ Feedback Loop - Good

- Can manually test after each operation is implemented
- Unit tests provide fast feedback
- Existing test patterns (`undo-redo.test.ts`) show how to test editor operations standalone

### ⚠️ Missing Items - Need to Add

1. **Error handling**: Clipboard API can fail (permissions denied, unsupported browser)
   - Should handle gracefully, possibly show toast on failure

2. **Cleanup**: Remove `eslint-disable` comments for deprecated `execCommand` after fix

3. **Helper extraction**: Cut and Copy share serialization logic - should extract to avoid duplication

4. **Focus restoration timing**: Need to ensure focus is restored BEFORE clipboard operations

### ⚠️ Risks Identified

1. **Clipboard API in JSDOM**: Jest/JSDOM doesn't have full Clipboard API
   - **Mitigation**: Mock `navigator.clipboard` in tests (existing pattern in codebase at `CodeBlockComponent.tsx`)

2. **ProseMirror serialization edge cases**: Custom nodes (images, comments, links) might not serialize correctly
   - **Mitigation**: Test with rich content including these node types

3. **Async clipboard operations**: `navigator.clipboard.read()` is async
   - **Mitigation**: Use async/await properly, handle loading states if needed

### ✅ Debug Tools - Adequate

- Console logging exists throughout TipTapEditor
- Can add specific logging for clipboard operations during development

---

## Questions

### Q1: Error Handling UX

When clipboard operations fail (e.g., permission denied), should we:

- **A) Silent failure** - Just log to console
- **B) Show toast notification** - User sees "Failed to paste - clipboard access denied"
- **C) Fallback to execCommand** - Try deprecated API as backup

I lean toward (B) for paste failures, (A) for copy/cut (less common to fail).
