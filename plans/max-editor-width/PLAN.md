# Max Editor Width Feature - Implementation Plan

**Overall Progress:** `70%`

## Summary

Add a maximum width constraint to the note editor content, similar to Google Docs and Dropbox Paper. When the window is very wide, content will be constrained to a comfortable reading width and centered.

## Requirements (from QUESTIONS-1.md)

- Max-width: ~750px (easy to change)
- Toolbar: Full width (changed from Option A - more like Google Docs)
- User preference: Fixed width for now (no toggle)
- Wide content: Constrained, tables use internal scrolling (already works)
- Comment panel: Content stays centered in available space (Option A)

## Scope Expansion

- **Note title in titlebar**: Show the currently selected note's title in the window titlebar

## Files to Modify

- `packages/desktop/src/renderer/src/components/EditorPanel/tipTapEditorStyles.ts` - Add max-width to ProseMirror styles
- `packages/desktop/src/renderer/src/components/EditorPanel/EditorToolbar.tsx` - Add max-width to toolbar

## Tasks

- [x] 🟩 **Step 1: Add max-width constant**
  - [x] 🟩 Create `EDITOR_MAX_WIDTH` constant in `tipTapEditorStyles.ts` (export it)
  - [x] 🟩 Value: 750 (pixels) - easy to adjust

- [x] 🟩 **Step 2: Write failing tests**
  - [x] 🟩 Create `tipTapEditorStyles.test.ts` - test that `getTipTapEditorStyles` returns max-width/centering for `.ProseMirror`
  - [x] 🟩 Add test to `EditorToolbar.test.tsx` - test toolbar container has max-width/centering styles

- [x] 🟩 **Step 3: Apply max-width to ProseMirror content**
  - [x] 🟩 Add `maxWidth: EDITOR_MAX_WIDTH` to `.ProseMirror` styles
  - [x] 🟩 Add `marginLeft: 'auto'` and `marginRight: 'auto'` for centering

- [x] 🟩 **Step 4: Apply max-width to EditorToolbar**
  - [x] 🟩 Import `EDITOR_MAX_WIDTH` from tipTapEditorStyles.ts
  - [x] 🟩 Add `maxWidth: EDITOR_MAX_WIDTH` to toolbar Box
  - [x] 🟩 Add `marginLeft: 'auto'` and `marginRight: 'auto'` for centering

- [x] 🟩 **Step 5: Verify tests pass**
  - [x] 🟩 Run unit tests for EditorToolbar and TipTapEditor
  - [x] 🟩 Ensure no regressions in existing tests

- [ ] 🟨 **Step 6: Manual verification**
  - [ ] 🟥 Test with narrow window (content should fill available space up to max-width)
  - [ ] 🟥 Test with wide window (content should be centered with max-width)
  - [ ] 🟥 Test with comment panel open (content should recenter in remaining space)
  - [ ] 🟥 Test that tables scroll horizontally within the constrained width

- [ ] 🟥 **Step 7: Run CI and commit**
  - [ ] 🟥 Run ci-runner to verify all tests pass
  - [ ] 🟥 Commit changes

## Technical Notes

### Current Structure

```
TipTapEditor (Box with getTipTapEditorStyles)
├── EditorToolbar (Box with inline sx)
├── Overlays (sync indicator, empty state, loading)
└── Box (editorContainerRef - scrollable, padding: 2)
    └── EditorContent
        └── .ProseMirror (styled via getTipTapEditorStyles)
```

### Styling Approach

Both components use MUI's `sx` prop with CSS-in-JS. The `getTipTapEditorStyles` function returns styles that target nested `.ProseMirror` element.

### Why margin auto works

The `editorContainerRef` Box has `flex: 1` making it take remaining vertical space. The `.ProseMirror` inside it will be constrained and centered via `margin: 0 auto`.

Similarly, the toolbar's parent allows it to expand. Adding max-width + margin auto centers it.

### Tables already handle scrolling

From `tipTapEditorStyles.ts` line 400-406:

```tsx
'& table': {
  borderCollapse: 'collapse',
  width: '100%',
  margin: '16px 0',
  tableLayout: 'fixed',
  overflow: 'hidden',
  ...
}
```

Tables use `width: 100%` so they'll respect the max-width constraint. If content overflows, the table itself has `overflow: hidden` and cells handle content naturally.

### Toolbar border behavior (design note)

The toolbar currently has `borderBottom: 1`. With max-width applied, the border will only span the constrained width (creating a "floating toolbar" look). This is intentional per Option A choice.

If this looks odd in practice, we can iterate by:

1. Adding an inner wrapper for button content only
2. Or keeping the outer Box full-width with border, inner content constrained

For now, we implement the simpler approach (constrain whole toolbar box).

## Plan Critique Summary

- **Ordering**: ✅ Correct dependency chain
- **Feedback loop**: ✅ Interactive testing available after Steps 3-4
- **Debug tools**: ✅ Browser DevTools sufficient for CSS changes
- **Risks**: Low - CSS-only, additive changes
- **Potential iteration**: Toolbar border behavior may need refinement based on visual result
