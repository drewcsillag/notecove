# Phase 4: Metadata & Accessibility

**Status:** 🟥 To Do
**Progress:** `0%`

**Depends on:** Phase 1 (Foundation), Phase 3 (for properties dialog)

## Overview

Add support for image metadata: alt text, captions, alignment, and link wrapping.

---

## Tasks

### 4.1 Alt Text Editing

**Status:** 🟥 To Do

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

- [ ] 🟥 Write test: alt text stored in node and rendered in HTML
- [ ] 🟥 Create `ImagePropertiesDialog.tsx` component
- [ ] 🟥 Add alt text field to dialog
- [ ] 🟥 Wire up "Edit Properties" context menu item
- [ ] 🟥 Update `ImageNodeView` to use alt attribute

---

### 4.2 Caption Support

**Status:** 🟥 To Do

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

- [ ] 🟥 Write test: caption displays below image
- [ ] 🟥 Write test: caption hidden for inline images
- [ ] 🟥 Add caption field to `ImagePropertiesDialog`
- [ ] 🟥 Update `ImageNodeView` to render figure/figcaption
- [ ] 🟥 Add CSS for caption styling

---

### 4.3 Alignment Options (Left/Center/Right)

**Status:** 🟥 To Do

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

- [ ] 🟥 Write test: each alignment option positions image correctly
- [ ] 🟥 Add alignment to `ImagePropertiesDialog`
- [ ] 🟥 Add alignment to context menu submenu
- [ ] 🟥 Update `ImageNodeView` CSS for alignment
- [ ] 🟥 Update node attrs on alignment change

---

### 4.4 Link Wrapping (Click Image → URL)

**Status:** 🟥 To Do

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

- [ ] 🟥 Write test: clicking linked image opens URL
- [ ] 🟥 Write test: Cmd+click opens lightbox for linked images
- [ ] 🟥 Add link field to `ImagePropertiesDialog`
- [ ] 🟥 Update click handler in `ImageNodeView`
- [ ] 🟥 Add visual indicator for linked images
- [ ] 🟥 Add "Remove Link" to context menu (when applicable)

---

## Image Properties Dialog

Central dialog for all image metadata, accessed via:

- Right-click → "Edit Properties..."
- Double-click on caption area (quick edit)
- Keyboard shortcut when image selected (Cmd+I or similar)

#### Dialog Fields

| Field        | Type                  | Notes                |
| ------------ | --------------------- | -------------------- |
| Alt Text     | Text input            | For accessibility    |
| Caption      | Text input            | Block images only    |
| Alignment    | Radio/Segmented       | Left, Center, Right  |
| Display Mode | Radio/Segmented       | Block, Inline        |
| Width        | Input + unit selector | Percentage or pixels |
| Link URL     | Text input            | Optional             |

#### Steps (consolidated)

- [ ] 🟥 Design dialog layout
- [ ] 🟥 Implement all fields
- [ ] 🟥 Handle save/cancel
- [ ] 🟥 Validate link URL format
- [ ] 🟥 Keyboard shortcut to open

---

## Testing Checklist

- [ ] Alt text stored and rendered in HTML
- [ ] Screen readers can access alt text
- [ ] Caption displays for block images
- [ ] Caption hidden for inline images
- [ ] Left alignment positions image left
- [ ] Center alignment positions image center
- [ ] Right alignment positions image right
- [ ] Link wrapping makes image clickable
- [ ] Clicking linked image opens URL
- [ ] Properties dialog opens and saves correctly
- [ ] CI passes
