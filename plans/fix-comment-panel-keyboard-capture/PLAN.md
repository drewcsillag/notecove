# Fix Comment Panel Keyboard Capture

**Overall Progress:** `100%`

## Summary

Remove keyboard navigation from the comment panel to fix the bug where j/k/e/arrows are captured even when typing in the editor.

## Background

- **Bug**: CommentPanel registers a global `window.addEventListener('keydown', ...)` that captures j, k, e, r, arrows, and Escape
- **Problem**: This handler runs regardless of panel visibility or editor focus, interfering with normal typing
- **Decision**: Remove keyboard nav entirely (can revisit with proper a11y design later)

## Tasks

- [x] 🟩 **Step 1: Write failing e2e test**
  - [x] 🟩 Test that typing 'j' in the editor results in 'j' appearing in content when comment panel is open

- [x] 🟩 **Step 2: Remove keyboard handler from CommentPanel**
  - [x] 🟩 Delete the useEffect block (lines ~315-417) that registers the keydown listener

- [x] 🟩 **Step 3: Update/remove affected e2e test**
  - [x] 🟩 Replaced `comments.spec.ts` test "should close comment panel with Escape" with new test

- [x] 🟩 **Step 4: Verify fix**
  - [x] 🟩 Run the new test - passes
  - [x] 🟩 Run existing comment tests - all 14 pass

## Files to Modify

- `packages/desktop/src/renderer/src/components/CommentPanel/CommentPanel.tsx` - Remove keyboard handler
- `packages/desktop/e2e/comments.spec.ts` - Remove/update Escape test

## Critique Notes

### Behavioral Changes

After this fix:

- **j/k/up/down** will no longer navigate between comments (must use mouse)
- **e** will no longer enter edit mode (must click edit button)
- **r** will no longer open reply input (must click Reply button)
- **Escape** will no longer close the panel (must click X button)

All interactions remain available via mouse/touch.

### Test Strategy

- **E2e test** is appropriate because we need to verify the editor receives keystrokes when panel is open
- **Unit test** would only verify implementation details (no listener registered)
- Existing Escape test in `comments.spec.ts` will fail and should be removed

### Risk Assessment

- **Low risk**: We're removing code, not adding
- **No breaking changes to other components**: The keyboard handler only affected CommentPanel's internal state

## Questions/Decisions

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial analysis
- [QUESTIONS-2.md](./QUESTIONS-2.md) - Focus behavior discussion → Decision: remove keyboard nav
