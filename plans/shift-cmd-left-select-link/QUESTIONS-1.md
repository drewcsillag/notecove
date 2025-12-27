# Questions - Phase 1: Analysis

## Understanding the Issue

I've analyzed the codebase and understand the issue:

1. **Root Cause**: Inter-note links use a decoration-based approach where:
   - The raw `[[uuid]]` text is hidden via CSS `display: none` (`inter-note-link-hidden` class)
   - A widget decoration shows `[[Title]]` in its place

2. **Why Shift+Cmd+Right works**: When extending selection rightward, the browser can see the visible widget and text, so selection works normally.

3. **Why Shift+Cmd+Left doesn't work**: When cursor is immediately after the link (e.g., `[[Title]]|text`), pressing Shift+Cmd+Left should select to the beginning of the line. But the browser can't "see" the hidden `[[uuid]]` text, so it behaves as if there's nothing there.

4. **Precedent**: The Backspace fix in `InterNoteLink.ts:267-299` uses `findLinkEndingAt()` to detect a link and select it. We need similar logic for Shift+Cmd+Left.

## Questions for You

### 1. Expected behavior clarification

When pressing **Shift+Cmd+Left** with cursor after a link like `foo [[Link]] bar|`:

- Should it select `bar` first (to start of word)?
- Or jump to beginning of line selecting `foo [[uuid]] bar`?

On Mac, Shift+Cmd+Left typically extends selection to the **beginning of the line**. So:

- **Current behavior**: Selects `bar` but stops before the hidden `[[uuid]]` text
- **Expected behavior**: Should select all of `foo [[uuid]] bar` (the entire line back to start)

Is my understanding of the expected behavior correct?

yes it should select bar to the beginning of the line

But what I was concerned about was when you have `foo [[Link]]| bar`. Shift-Cmd-left does not select `foo [[Link]]`, but rather just `foo `.

### 2. Should we also handle Shift+Cmd+Right?

You mentioned Shift+Cmd+Right works. I want to confirm:

- With cursor like `|foo [[Link]] bar`, does Shift+Cmd+Right correctly select `foo [[uuid]] bar`?
- If it works correctly now, we only need to fix the leftward direction.

Shift-cmd- right works just fine

### 3. Other selection commands to consider?

While we're fixing this, should we also handle:

- **Cmd+Left** (without Shift): Move cursor to beginning of line - should jump over the link atomically?
- **Option+Left/Right**: Move by word - might have similar issues near links
- **Shift+Option+Left/Right**: Select by word
- **Shift+Left/Right**: Extend selection by one character

Or do you want to focus only on Shift+Cmd+Left for now?

Ah, Option-left works ok. Shift option left works correct, Shift left needs work though.
Strangely some of these adjust the scroll position unexpectedly which I'd like investigated also

### 4. Selection spanning the link

When extending selection that **includes** a link:

- Should the entire link always be selected as a unit (atomic selection)?
- Or should partial selection be possible (e.g., just `[[` or just the first few chars of the uuid)?

The backspace behavior treats links atomically. Should selection do the same?

Should treat the link atomically
