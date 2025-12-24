# Plan Critique

## Ordering Analysis

**Current order is good for TDD:**

1. Write failing tests first
2. Create utility
3. Fix the bug
4. Add new feature
5. Verify

**Issue identified:** The sanitization utility (Step 2) is only tested through integration tests. Should add unit tests for the sanitization function itself to catch edge cases.

**Recommendation:** Add Step 2.0 - Write unit tests for sanitization function before implementing it.

## Feedback Loop

**Good:** The plan allows for:

- Run tests after Step 1 (should fail) ✓
- Run tests after Step 3 (should pass) ✓
- Run tests after Step 4 (new feature tests should pass) ✓

## Debug Tools

**Existing:** Console.log statements in paste handlers

**Addition needed:** Add debug logging to sanitization function during development to see what's being stripped. Can remove before final commit.

## Missing Items

1. **Unit tests for sanitization function** - Added to plan
2. **Keyboard shortcut Cmd+Shift+V** - TipTap doesn't handle this natively for context menu operations. Since context menu paste is manual, we should:
   - Add keyboard shortcut hint to menu item (like "Add Comment" has ⌘⌥M)
   - Consider adding keyboard handler for Cmd+Shift+V as a separate enhancement

3. **Edge cases to test:**
   - Empty clipboard
   - Clipboard with only images (no text/html)
   - Very large HTML content
   - Deeply nested HTML

4. **Where to put sanitization utility:**
   - Could be in TipTapEditor.tsx (inline)
   - Could be extracted to a utility file for reuse/testing
   - **Recommendation:** Extract to `utils/clipboard-sanitizer.ts` for easier unit testing

## Risk Assessment

| Risk                                    | Likelihood | Impact | Mitigation                                              |
| --------------------------------------- | ---------- | ------ | ------------------------------------------------------- |
| Sanitization strips wanted content      | Medium     | High   | Comprehensive tests, preserve all TipTap-supported tags |
| Microsoft Office HTML not fully handled | Medium     | Low    | Handle common cases, log unhandled patterns             |
| Performance with large HTML             | Low        | Medium | DOMParser is fast, but add size limits if needed        |
| Browser compatibility                   | Very Low   | N/A    | Electron uses Chromium, DOMParser is standard           |

## Updated Recommendations

1. **Extract sanitization to utility file** for easier testing
2. **Add unit tests for sanitizer** before integration tests
3. **Test edge cases** (empty, images-only, large content)
4. **Add keyboard shortcut hint** to "Paste without formatting" menu item
5. **Consider Cmd+Shift+V keyboard handler** as future enhancement (not in this fix)

## Decision

No blocking questions. Proceeding with plan updates.
