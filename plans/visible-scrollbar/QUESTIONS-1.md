# Questions - Visible Scrollbar Feature

## Analysis Summary

The note editor is a TipTap-based rich text editor rendered inside a Material-UI `Box` component with `overflow: 'auto'`. Currently, scrollbars are using browser defaults, which on macOS are typically hidden/overlay style scrollbars.

**Key files:**

- `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx` - The editor container with `editorContainerRef` (line 2519-2533)
- `packages/desktop/src/renderer/src/theme.ts` - Material-UI theme configuration (no scrollbar customization exists)

**Current behavior:** The Box container has `overflow: 'auto'` so scrollbars appear, but they use OS defaults (on macOS: thin overlay scrollbars that fade when not actively scrolling).

---

## Questions

### 1. Scope of scrollbar styling

Should the visible scrollbar apply to:

- **A)** Only the note editor panel (TipTapEditor)
- **B)** All scrollable areas in the app (notes list, folder panel, etc.)

b

### 2. Styling approach

What style of visible scrollbar do you prefer?

- **A)** Classic/always visible (like Windows) - constant width, always shows track and thumb
- **B)** Minimalist but visible - thin scrollbar that's always visible (no overlay behavior)
- **C)** Something else (please describe)

Is there an option for whatever native scrollbars would look like?

### 3. Theme integration

Should the scrollbar:

- **A)** Adapt to light/dark mode (different colors for each theme)
- **B)** Use a fixed color scheme regardless of theme

A

### 4. Width preference

- **A)** Standard width (~12px) for easy interaction
- **B)** Thin (~6-8px) to minimize visual footprint
- **C)** No preference, use sensible defaults

C

### 5. Code blocks within notes

Code blocks in the editor already have `overflow: 'auto'`. Should they also get visible scrollbars when content overflows horizontally?

- **A)** Yes, make them consistent
- **B)** No, leave code blocks with default behavior

B
