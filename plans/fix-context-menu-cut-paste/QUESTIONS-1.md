# Context Menu Cut/Paste Bug - Questions

## Bug Analysis

### Current Implementation (TipTapEditor.tsx:2949-2975)

The context menu uses `document.execCommand()` for cut, copy, and paste:

```tsx
<MenuItem onClick={() => {
  document.execCommand('cut');
  handleContextMenuClose();
}}>Cut</MenuItem>

<MenuItem onClick={() => {
  document.execCommand('copy');
  handleContextMenuClose();
}}>Copy</MenuItem>

<MenuItem onClick={() => {
  document.execCommand('paste');
  handleContextMenuClose();
}}>Paste</MenuItem>
```

### Root Causes

1. **Focus Loss**: When the user clicks on a menu item, the editor loses focus. `document.execCommand()` operates on the currently focused element, not the element that had the selection.

2. **Cursor Jump (Cut)**: The cut operation fails silently, and when the menu closes, the editor may receive focus at a different position (beginning of line).

3. **Paste Not Working**: `document.execCommand('paste')` is heavily restricted by browsers for security reasons. Even when the editor has focus, this command often fails due to security policies. The Clipboard API's `navigator.clipboard.readText()` requires user gesture context that's often lost after menu interactions.

### Proposed Solution

**For Cut:**

1. Capture the selection bounds (`from`, `to`) when the context menu opens (not just the x/y position)
2. Use the Clipboard API (`navigator.clipboard.writeText()`) to copy selected text
3. Use TipTap's `editor.chain().focus().deleteSelection().run()` to delete the selection

**For Copy:**

1. Capture selection when context menu opens
2. Use `navigator.clipboard.writeText()` with the selected text

**For Paste:**

1. Use `navigator.clipboard.readText()` to get clipboard content
2. Use TipTap's `editor.chain().focus().insertContent()` to insert at the stored position

---

## Questions

### Q1: Scope of Rich Text Support

When cutting/copying, should we support:

- **A) Plain text only** - Simple, reliable, works everywhere
- **B) Rich text (HTML/ProseMirror slice)** - Preserves formatting when pasting back into the editor

Currently keyboard shortcuts (Cmd+C/V/X) handle rich text through TipTap's built-in handling. Should the context menu match this behavior?

Yes, B

### Q2: Image Handling

If the selection contains images (notecoveImage nodes):

- **A) Copy/cut just the text, skip images** - Simplest
- **B) Full ProseMirror slice handling** - Most complete, matches keyboard behavior

B

### Q3: Paste Behavior with Existing Selection

If there's text selected when pasting:

- **A) Replace the selection** (standard behavior)
- **B) Insert at cursor, preserve selection** (unusual)

I assume (A) but want to confirm.

A
