# Questions: Fix Comment Panel Keyboard Capture

## Context

The issue is that the CommentPanel registers a global `window.addEventListener('keydown', ...)` handler that captures `j`, `k`, `e`, `r`, up/down arrows, and Escape keys. This handler is registered whenever the CommentPanel component mounts, **regardless of whether the panel is actually visible**.

### Root Cause

1. **CommentPanel.tsx line 315-417**: The `useEffect` that registers the keyboard handler has no guard for panel visibility
2. **EditorPanel.tsx line 209-219**: CommentPanel always mounts (receives `noteId`), but doesn't know if it's visible - the visibility is controlled via `react-resizable-panels` expand/collapse
3. **The only early-exit** in the current keyboard handler is for `TEXTAREA` and `INPUT` elements - it doesn't check if the TipTap editor (which uses contenteditable) has focus

### Proposed Solution

Pass `showCommentPanel` (or `isVisible`) prop to CommentPanel, and add an early return in the keyboard handler useEffect:

```typescript
// In CommentPanel.tsx
export interface CommentPanelProps {
  noteId: string | null;
  isVisible: boolean; // NEW - whether panel is actually visible
  onClose: () => void;
  // ... existing props
}

// In keyboard handler useEffect
useEffect(() => {
  if (!isVisible) return; // <-- NEW: Don't register handler when panel is hidden

  const handleKeyDown = (e: KeyboardEvent) => {
    // ... existing handler code
  };
  // ...
}, [isVisible /* other deps */]);
```

## Questions

### Q1: Should the keyboard handler also check editor focus state?

The current handler already skips `TEXTAREA` and `INPUT` elements. However, the TipTap editor uses a `contenteditable` div (ProseMirror), which won't be caught by this check.

**Options:**

1. **Just add visibility guard** - Simple fix; keyboard shortcuts only work when panel is visible
2. **Add visibility guard + contenteditable check** - Also skip if focus is inside `.ProseMirror` element
3. **Use focus-based approach instead** - Only capture keys when the comment panel itself has focus

My recommendation is **Option 1** - just add visibility guard. The panel being visible is the primary use case differentiation. If the panel is visible, the user likely intends to interact with it via keyboard. Option 3 would break vim-style navigation unless user explicitly clicks the panel first.

Do you agree with Option 1, or would you prefer a different approach?

Option 3 -- otherwise they'll still get eaten while people are typing.
Will the keys be captured if they're typing or editing a comment?

### Q2: Should Escape close the panel even when editor is focused?

Currently, Escape calls `onClose()` when the panel is open and nothing else needs closing (not replying, not editing). If we add visibility guard, Escape will only work when panel is visible.

**Question:** Is the current behavior correct? Should Escape:

- A) Only close the panel when the panel is visible (natural after this fix)
- B) Be a global "close comments" shortcut regardless of focus

I assume **A** is correct (Escape closes panel only when it's visible), since this is consistent with other keyboard shortcuts.

A

### Q3: Are there any other keyboard scenarios to consider?

Looking at the current handler, it intercepts:

- `j` / `ArrowDown` - navigate to next comment
- `k` / `ArrowUp` - navigate to previous comment
- `r` / `R` - reply to selected comment
- `e` / `E` - edit comment (if owner)
- `Escape` - cancel reply/edit or close panel

Is there any scenario where these should work even when the panel is collapsed? I believe "no" - if the panel isn't visible, there's nothing to navigate.

No there are no scenarios where working when the panel collapsed even makse sense.
