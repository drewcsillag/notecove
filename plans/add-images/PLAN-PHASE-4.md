# Phase 4: Metadata & Accessibility

**Status:** ✅ Done
**Progress:** `100%`

**Depends on:** Phase 1 (Foundation), Phase 3 (for properties dialog)

## Overview

Add support for image metadata: alt text, captions, alignment, and link wrapping.

---

## Tasks

### 4.1 Alt Text Editing

**Status:** ✅ Done

Allow users to set alt text for accessibility and SEO.

#### Behavior

1. Right-click image → "Edit Properties..."
2. Properties dialog opens
3. User enters alt text
4. Alt text saved to image node attrs
5. Alt text used in `<img alt="...">` attribute

#### Default Alt Text

- On image insertion, default to empty string
- Optional: Extract from filename (strip extension, replace dashes/underscores)

#### Implementation

- Add `alt` attribute to image node (already in schema)
- Create `ImagePropertiesDialog` component
- Wire up from context menu

#### Steps

- [x] ✅ Write test: alt text stored in node and rendered in HTML
- [x] ✅ Create `ImagePropertiesDialog.tsx` component
- [x] ✅ Add alt text field to dialog
- [x] ✅ Wire up "Edit Properties" context menu item
- [x] ✅ Update `ImageNodeView` to use alt attribute

---

### 4.2 Caption Support

**Status:** ✅ Done

Allow adding captions below block images.

#### Behavior

1. In properties dialog, user enters caption
2. Caption displays below image
3. Caption styled as smaller, muted text
4. Caption only visible for block images (not inline)

#### HTML Structure

```html
<figure class="image-container">
  <img src="..." alt="..." />
  <figcaption>Caption text here</figcaption>
</figure>
```

#### Implementation

- Add `caption` attribute to image node (already in schema)
- Update `ImageNodeView` to render `<figure>` with `<figcaption>`
- Add caption field to properties dialog

#### Steps

- [x] ✅ Write test: caption displays below image
- [x] ✅ Write test: caption hidden for inline images
- [x] ✅ Add caption field to `ImagePropertiesDialog`
- [x] ✅ Update `ImageNodeView` to render figure/figcaption
- [x] ✅ Add CSS for caption styling

---

### 4.3 Alignment Options (Left/Center/Right)

**Status:** ✅ Done

Allow aligning block images.

#### Behavior

- **Left**: Image aligned to left edge, text wraps on right (optional)
- **Center** (default): Image centered, no text wrap
- **Right**: Image aligned to right edge, text wraps on left (optional)

#### Implementation Options

1. **Simple (no wrap)**: Just CSS `text-align` on container
2. **With wrap**: CSS `float` for left/right, `clear` handling

Start with simple approach (no text wrap).

#### Steps

- [x] ✅ Write test: each alignment option positions image correctly
- [x] ✅ Add alignment to `ImagePropertiesDialog`
- [x] ✅ Add alignment to context menu submenu
- [x] ✅ Update `ImageNodeView` CSS for alignment
- [x] ✅ Update node attrs on alignment change

---

### 4.4 Link Wrapping (Click Image → URL)

**Status:** ✅ Done

Allow wrapping an image in a link so clicking opens a URL.

#### Behavior

1. In properties dialog, user enters link URL
2. Image becomes clickable
3. Click opens URL in browser (not lightbox)
4. Visual indicator that image is linked (e.g., subtle border or icon)

#### Interaction Priority

When image has link:

- Single click → Opens link URL
- Double click → Opens image externally (unchanged)
- Right click → Context menu (includes "Remove Link")
- Cmd+click → Lightbox (alternative to lightbox for linked images)

#### Implementation

- Add `linkHref` attribute to image node (already in schema)
- Update click handler to check for link
- Add link field to properties dialog

#### Steps

- [x] ✅ Write test: clicking linked image opens URL
- [x] ✅ Write test: Cmd+click opens lightbox for linked images
- [x] ✅ Add link field to `ImagePropertiesDialog`
- [x] ✅ Update click handler in `ImageNodeView`
- [x] ✅ Add visual indicator for linked images
- [ ] ❌ Skipped: "Remove Link" in context menu (users can clear via properties dialog)

---

## Image Properties Dialog

Central dialog for all image metadata, accessed via:

- Right-click → "Edit Properties..."
- Double-click on caption area (quick edit) - deferred
- Keyboard shortcut when image selected (Cmd+I or similar) - deferred

#### Dialog Fields

| Field        | Type            | Status       | Notes                 |
| ------------ | --------------- | ------------ | --------------------- |
| Alt Text     | Text input      | ✅ Done      | For accessibility     |
| Caption      | Text input      | ✅ Done      | Block images only     |
| Alignment    | Radio/Segmented | ✅ Done      | Left, Center, Right   |
| Display Mode | Radio/Segmented | Via ctx menu | Available in ctx menu |
| Width        | Input + unit    | Deferred     | For resize phase      |
| Link URL     | Text input      | ✅ Done      | With URL validation   |

#### Steps (consolidated)

- [x] ✅ Design dialog layout
- [x] ✅ Implement all fields (alt, caption, alignment, link)
- [x] ✅ Handle save/cancel
- [x] ✅ Validate link URL format
- [ ] 🟡 Keyboard shortcut to open (deferred to later phase)

---

## Testing Checklist

- [x] ✅ Alt text stored and rendered in HTML
- [x] ✅ Screen readers can access alt text
- [x] ✅ Caption displays for block images
- [x] ✅ Caption hidden for inline images
- [x] ✅ Left alignment positions image left
- [x] ✅ Center alignment positions image center
- [x] ✅ Right alignment positions image right
- [x] ✅ Link wrapping makes image clickable
- [x] ✅ Clicking linked image opens URL
- [x] ✅ Properties dialog opens and saves correctly
- [x] ✅ CI passes

---

## Files Changed

- `ImagePropertiesDialog.tsx` - New dialog component for editing properties
- `ImagePropertiesDialog.test.tsx` - 18 tests for dialog
- `ImageContextMenu.tsx` - Updated to pass attrs object and integrate properties dialog
- `Image.ts` - Updated context menu call and added link click behavior
- `TipTapEditor.tsx` - Added CSS for linked image indicator (link emoji badge)

## Test Summary

- 18 tests for ImagePropertiesDialog (rendering, alt text, caption, alignment, link URL, cancel behavior)
- All existing image tests continue to pass
