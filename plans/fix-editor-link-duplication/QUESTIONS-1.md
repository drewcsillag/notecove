# Questions - Fix Editor Link Duplication Bug

## Summary of Understanding

After analyzing the codebase, I've identified the root cause of the bug. Here's my understanding:

### The Bug

When editing text _before_ a line that contains a checkbox (`[ ]`) and a wikilink (`[[Note]]`), typing characters causes the wikilink to visually duplicate. Each character typed adds another copy of the link display. This is a rendering bug only - the document structure is correct.

### Root Cause Analysis

The `InterNoteLink` extension uses ProseMirror **decorations** to render wikilinks:

1. An **inline decoration** (`hideDecoration`) hides the original `[[uuid]]` text using CSS (`font-size: 0`)
2. A **widget decoration** at position `to` with `side: -1` renders the visible `[[Title]]` span

The bug is in `updateLinksIncrementally()` (line 666-714 in InterNoteLink.ts):

```typescript
// Find existing decorations in this range
const existingInRange = decorations.find(searchFrom, searchTo, () => true);
// ...
decorations = decorations.remove(existingInRange);
```

**The Problem**: `DecorationSet.find()` may not find widget decorations when they are positioned with `side: -1`. The widget is placed at the END of the link (`to` position), but `side: -1` means it's positioned _before_ that position. When the changed range doesn't fully encompass the widget's conceptual position, it may not be found and removed.

Result: Old widget decorations remain while new ones are added = visual duplication.

### Why It Only Happens With Checkboxes

The TriStateTaskItem uses a NodeView with `contentDOM`, which creates a more complex DOM structure. When decorations are not properly tracked, the widget DOM elements accumulate in the `contentDOM` div.

---

## Questions

### Q1: Rendering Approach Preference

I see two viable fixes:

**Option A: Switch to Full Recalculation on Doc Change**

- Like `WebLinkChipPlugin` does (line 389-390 in that file)
- Simpler, more reliable, slightly less efficient
- Always works correctly

**Option B: Fix the Incremental Logic**

- Properly track widget decorations by expanding the search range to include `side: -1` widgets
- More complex but preserves the performance optimization
- Risk of edge cases

Given that wikilinks are not extremely frequent in documents (vs hashtags in some apps), I'm leaning toward **Option A** for reliability. The performance cost is negligible for typical note sizes.

**Do you have a preference, or should I go with the simpler/more reliable approach?**

At what frequency of links would it become a problem?

### Q2: Test Approach

I plan to write a test that:

1. Creates an editor with a task item containing a wikilink
2. Types characters before the link
3. Asserts that only one widget decoration exists per link

**Is there anything specific you want tested beyond the basic repro scenario?**

No, just make sure you can repro before you start writing any other code.

### Q3: Verification Method

After fixing, I plan to:

1. Run the failing test → passes
2. Run all InterNoteLink tests
3. Run full CI

**Is there additional manual verification you'd like me to describe or capture (e.g., screenshot, video)?**

## I'll run CI, but otherwise sounds good.

## No Blocking Questions

The above are preferences/confirmations. I can proceed with the fix using my best judgment if you just want me to continue.

**Say "continue" to proceed to Phase 2 (planning) or answer any questions above.**
