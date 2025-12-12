# Phase 10: Text Wrapping

**Status:** ✅ Complete
**Progress:** `100%`

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

**Status:** ✅ Complete

Implemented CSS `float` for left/right aligned images when wrapping is enabled.

#### Implementation

Added to `TipTapEditor.tsx`:

```css
/* When wrap mode is enabled */
.notecove-image--wrap.notecove-image--align-left {
  float: left;
  margin-right: 1rem;
}

.notecove-image--wrap.notecove-image--align-right {
  float: right;
  margin-left: 1rem;
}
```

#### Steps

- [x] ✅ Add `wrap` attribute to image node schema (`boolean`, default `false`)
- [x] ✅ Add CSS for floated images with appropriate margins
- [x] ✅ Update `ImageNodeView` to apply float classes when wrap is enabled
- [x] ✅ Write tests for text wrapping behavior (11 new tests)

---

### 10.2 Wrap Mode UI

**Status:** ✅ Complete

Added UI controls for toggling wrap mode.

#### Implementation

1. **Properties Dialog**: Added checkbox "Wrap text around image"
   - Disabled when alignment is center (with helper text)
   - Disabled for inline images (with helper text)
   - Auto-unchecks when alignment changes to center

2. **Context Menu**: Added "Wrap Text" menu item with checkmark icon when enabled
   - Disabled when alignment is center or display is inline

#### Steps

- [x] ✅ Add wrap toggle to `ImagePropertiesDialog` (8 new tests)
- [x] ✅ Add wrap toggle to context menu
- [x] ✅ Disable wrap option when alignment is center
- [x] ✅ Write tests for wrap UI controls

---

### 10.3 Clear Handling for Consecutive Images

**Status:** ✅ Complete

Handled edge cases when multiple floated images appear in sequence.

#### Implementation

```css
/* Clear floats after consecutive wrapped images to prevent stacking */
.notecove-image--wrap + .notecove-image--wrap {
  clear: both;
}
```

#### Steps

- [x] ✅ Test consecutive floated images behavior
- [x] ✅ Implement clear logic for float stacking

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

- [x] ✅ Left-aligned image with wrap has text flowing on right
- [x] ✅ Right-aligned image with wrap has text flowing on left
- [x] ✅ Center-aligned images cannot enable wrap (disabled)
- [x] ✅ Inline images cannot enable wrap (disabled)
- [x] ✅ Multiple consecutive wrapped images don't overlap
- [x] ✅ Wrap toggle persists across dialog open/close
- [x] ✅ Existing images without wrap attribute behave normally
- [x] ✅ CI passes

---

## Files Modified

- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/Image.ts`
  - Added `wrap` attribute to `ImageNodeAttrs` interface
  - Added `wrap` to `addAttributes()` schema
  - Updated `updateVisualState()` to apply wrap and alignment classes
- `packages/desktop/src/renderer/src/components/EditorPanel/ImagePropertiesDialog.tsx`
  - Added `wrap` checkbox with conditional disabling
  - Auto-uncheck wrap when alignment changes to center
- `packages/desktop/src/renderer/src/components/EditorPanel/ImageContextMenu.tsx`
  - Added "Wrap Text" menu item with toggle behavior
- `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx`
  - Added CSS for `.notecove-image--wrap` with float styles
  - Added CSS for consecutive wrapped images (`clear: both`)

## Test Coverage

- 11 new tests in `Image.test.ts` for wrap attribute and visual rendering
- 8 new tests in `ImagePropertiesDialog.test.tsx` for wrap checkbox behavior
