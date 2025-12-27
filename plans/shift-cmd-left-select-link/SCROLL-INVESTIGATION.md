# Scroll Position Investigation

## Findings

### How scrolling works in ProseMirror

1. **Explicit `scrollIntoView()`**: Transactions can call `.scrollIntoView()` to request the editor scroll the selection into view after update
2. **Current InterNoteLink handlers**: The existing Backspace/Delete handlers use raw `view.dispatch(tr)` without calling `.scrollIntoView()` - this should NOT cause scrolling
3. **TipTap's focus()**: Has a `{ scrollIntoView: false }` option (used in TriStateTaskItem.ts:297)

### Potential causes of unexpected scroll

1. **Browser native behavior**: When selection changes in contentEditable, browsers may scroll to ensure selection is visible
2. **Widget decoration side effects**: The widget decorations in InterNoteLink might affect how the browser calculates visible content
3. **`display: none` on hidden text**: The hidden `[[uuid]]` text with `display: none` might confuse browser's selection/scroll calculations

### Current implementation check

The existing keyboard handlers in InterNoteLink.ts (lines 267-331) do:

```javascript
const tr = state.tr.setSelection(TextSelection.create(state.doc, linkRange.from, linkRange.to));
view.dispatch(tr);
```

This does NOT call `.scrollIntoView()`, which is correct.

## Recommendation

The scroll issue is likely related to the same root cause as the selection issue - the browser doesn't understand the hidden content. Our selection fix may also help with scroll behavior since we'll be properly managing the selection.

If scroll issues persist after the selection fix, we should:

1. Check if adding explicit scroll prevention helps
2. Consider if the widget/decoration approach needs refinement

## Next Steps

Proceed with selection fix (Steps 2-5). Re-evaluate scroll in Phase B if still problematic.
