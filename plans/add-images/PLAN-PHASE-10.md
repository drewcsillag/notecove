# Phase 10: Text Wrapping

**Status:** 🟥 To Do
**Progress:** `0%`

**Depends on:** Phase 4 (Metadata & Accessibility - alignment feature)

## Overview

Add text wrapping support so text can flow around left/right-aligned images, similar to traditional word processors.

---

## Background

Phase 4 implemented alignment (left/center/right) but without text wrapping. Currently:

- **Left**: Image positioned at left edge, no text wrap
- **Center**: Image centered, no text wrap
- **Right**: Image positioned at right edge, no text wrap

This phase adds the option to have text flow around left/right aligned images.

---

## Tasks

### 10.1 CSS Float-Based Text Wrapping

**Status:** 🟥 To Do

Implement CSS `float` for left/right aligned images when wrapping is enabled.

#### Implementation

```css
/* When wrap mode is enabled */
.notecove-image--wrap.notecove-image--align-left {
  float: left;
  margin-right: 1rem;
  margin-bottom: 0.5rem;
}

.notecove-image--wrap.notecove-image--align-right {
  float: right;
  margin-left: 1rem;
  margin-bottom: 0.5rem;
}
```

#### Steps

- [ ] 🟥 Add `wrap` attribute to image node schema (`boolean`, default `false`)
- [ ] 🟥 Add CSS for floated images with appropriate margins
- [ ] 🟥 Update `ImageNodeView` to apply float classes when wrap is enabled
- [ ] 🟥 Write tests for text wrapping behavior

---

### 10.2 Wrap Mode UI

**Status:** 🟥 To Do

Add UI controls for toggling wrap mode.

#### Options

1. **Properties Dialog**: Add checkbox "Allow text to wrap around image"
2. **Context Menu**: Add "Text Wrapping" submenu with options:
   - None (default)
   - Wrap text

#### Constraints

- Wrap only applies to left/right alignment (not center)
- Wrap only applies to block images (not inline)

#### Steps

- [ ] 🟥 Add wrap toggle to `ImagePropertiesDialog`
- [ ] 🟥 Add wrap options to context menu
- [ ] 🟥 Disable wrap option when alignment is center
- [ ] 🟥 Write tests for wrap UI controls

---

### 10.3 Clear Handling for Consecutive Images

**Status:** 🟥 To Do

Handle edge cases when multiple floated images appear in sequence.

#### Issues to Address

1. **Stacking**: Multiple left-floated images should stack vertically, not horizontally
2. **Clearing**: Content after floated images should clear properly
3. **Mixed alignment**: Left and right floated images on same line

#### Implementation

```css
/* Clear floats after certain elements */
.notecove-image--wrap + .notecove-image--wrap {
  clear: both; /* or clear: left/right depending on alignment */
}

/* Clear float after image section */
.notecove-image--wrap + p,
.notecove-image--wrap + h1,
.notecove-image--wrap + h2 {
  /* May need explicit clear in some cases */
}
```

#### Steps

- [ ] 🟥 Test consecutive floated images behavior
- [ ] 🟥 Implement clear logic for float stacking
- [ ] 🟥 Add option for manual clear (e.g., "Clear floats" paragraph style)
- [ ] 🟥 Write tests for consecutive image scenarios

---

## Design Decisions

### Why Not Use CSS Grid/Flexbox?

CSS float is the traditional approach for text wrapping and is well-supported. Grid/flexbox require restructuring the document flow in ways that don't match how WYSIWYG editors typically work.

### Default Behavior

- **Default**: No wrap (current behavior unchanged)
- **Opt-in**: User explicitly enables wrap per image

This preserves backward compatibility and predictable behavior.

### Interaction with Alignment

| Alignment | Wrap Available? | Behavior When Wrapped                     |
| --------- | --------------- | ----------------------------------------- |
| Left      | Yes             | Float left, text wraps on right           |
| Center    | No              | N/A (center doesn't make sense with wrap) |
| Right     | Yes             | Float right, text wraps on left           |

---

## Testing Checklist

- [ ] Left-aligned image with wrap has text flowing on right
- [ ] Right-aligned image with wrap has text flowing on left
- [ ] Center-aligned images cannot enable wrap (disabled)
- [ ] Inline images cannot enable wrap (disabled)
- [ ] Multiple consecutive wrapped images don't overlap
- [ ] Wrap toggle persists across dialog open/close
- [ ] Existing images without wrap attribute behave normally
- [ ] CI passes

---

## Files to Modify

- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/Image.ts`
  - Add `wrap` attribute
  - Update CSS classes in node view
- `packages/desktop/src/renderer/src/components/EditorPanel/ImagePropertiesDialog.tsx`
  - Add wrap toggle checkbox
- `packages/desktop/src/renderer/src/components/EditorPanel/ImageContextMenu.tsx`
  - Add wrap submenu
- `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx`
  - Add float CSS styles
