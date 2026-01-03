# Questions - Checkbox Parsing Bug

## Analysis Summary

I've identified the bug. The issue is in the input rules in `TriStateTaskItem.ts` (lines 449-473).

### The Bug

The input rules use regex patterns like:

```
/(?:^|\s)\[\s?\]\s$/
```

This matches `[]` (or `[ ]`) either at:

- `^` - Start of the text block, OR
- `\s` - After any whitespace

The problem is there are **two code paths** in the handler:

1. **Case 1 (in a list)**: When `isInList($from)` returns true, it converts the list item immediately with **no position check**. So typing `some text []` in a list item triggers checkbox conversion.

2. **Case 2 (not in a list)**: There IS a check: `if (textBefore.trim() !== '') return;` - this correctly prevents conversion when not at the start.

**The fix**: Case 1 needs the same "start of line" check that Case 2 has.

## Questions

### 1. Confirm expected behavior

When in a list item like:

```
- some text here
```

And the user types `[]` after "here" (becoming `- some text here []`), the expected behavior is:

- **Do NOT convert** to a checkbox
- Keep the literal `[]` text

Is this correct? (I believe yes, based on your description)

correct

### 2. Edge case: Beginning of existing list item

If someone has a list item with content:

```
- existing text
```

And they move cursor to the beginning and type `[] `, should that convert to a task item?

Options:

- **A) Yes** - `[]` at start of list item content should always trigger conversion
- **B) No** - Only trigger when the list item was empty or when created fresh with `- [] `

My recommendation: **Option A** - This matches the current behavior for Case 2 (standalone paragraphs) where typing `[]` at the beginning of a paragraph creates a task list.

A

### 3. What about markdown import?

Looking at `markdown-to-prosemirror.ts`, the markdown import uses:

```regex
/^\[([ xX])\]\s*/
```

This only matches at the **start** of list item content - which is already correct. So imported markdown like `- some text []` would NOT become a checkbox. This is consistent with your expected behavior.

No changes needed there.

---

## Proposed Fix

Modify the input rule handler (Case 1) to check if the `[]` is at the start of the list item content before converting:

```typescript
// Case 1: Already in a list - convert the list item to a task item
if (isInList($from)) {
  const listItemPos = findParentListItemPos($from);
  if (listItemPos === null) return;

  // NEW: Check if [] is at start of list item content
  const listItemNode = state.doc.nodeAt(listItemPos);
  if (!listItemNode) return;

  // Get the paragraph inside the list item
  const firstChild = listItemNode.firstChild;
  if (!firstChild || firstChild.type.name !== 'paragraph') return;

  // Check text before the match in the paragraph
  const textBefore = firstChild.textBetween(0, $from.parentOffset - (range.to - range.from));
  if (textBefore.trim() !== '') return; // Not at start, don't convert

  // ... rest of conversion logic
}
```

Once you confirm the expected behavior (Questions 1 & 2), I can proceed with implementation.
