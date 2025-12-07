# Phase 3: Display & Interaction

**Status:** 🟥 To Do
**Progress:** `0%`

**Depends on:** Phase 1 (Foundation)

## Overview

Implement image display modes and user interactions: resizing, lightbox, context menu, and external opening.

---

## Tasks

### 3.1 Block and Inline Display Modes

**Status:** 🟥 To Do

Support both block-level (full-width) and inline images.

#### Block Mode (Default)

- Image takes full width of editor (or specified width)
- Displayed on its own line
- Can have caption below

#### Inline Mode

- Image flows with text
- Limited to small sizes (max 200px height)
- No caption

#### Implementation

- Add `display` attribute to image node: `'block' | 'inline'`
- Different CSS and node view rendering for each mode
- Toggle via context menu or image properties dialog

#### Steps

- [ ] 🟥 Write test: block images display full-width
- [ ] 🟥 Write test: inline images flow with text
- [ ] 🟥 Add `display` attribute to image node schema
- [ ] 🟥 Update `ImageNodeView` to render both modes
- [ ] 🟥 Add CSS for block and inline display

---

### 3.2 User-Resizable Images

**Status:** 🟥 To Do

Allow users to resize images by dragging handles.

#### Behavior

1. Click image to select it
2. Resize handles appear at corners
3. Drag handle to resize
4. Width stored in node attrs (height auto-calculated to maintain aspect ratio)
5. Shift+drag to resize freely (break aspect ratio)

#### Implementation

- Use ProseMirror NodeView with custom DOM
- Add resize handles as absolutely positioned elements
- Track drag events to calculate new dimensions
- Update node attrs on drag end

#### Width Storage

- Store as percentage of container width (e.g., `"50%"`) for responsive behavior
- Or as pixels (e.g., `"400px"`) for fixed size
- Allow toggling between modes in image properties

#### Steps

- [ ] 🟥 Write E2E test: dragging resize handle changes image size
- [ ] 🟥 Write test: aspect ratio maintained by default
- [ ] 🟥 Add resize handles to `ImageNodeView`
- [ ] 🟥 Implement drag tracking and dimension calculation
- [ ] 🟥 Update node attrs on resize complete
- [ ] 🟥 Add visual feedback during resize (dimension tooltip)

---

### 3.3 Click to Enlarge (Lightbox)

**Status:** 🟥 To Do

Single-click on image opens a full-screen lightbox view.

#### Lightbox Features

- Full-resolution image display
- Dark overlay background
- Close button (X) in corner
- Click outside to close
- Escape key to close
- Arrow keys for next/prev if multiple images in note

#### Implementation

- Create `ImageLightbox` React component
- Render via portal to body (above all other content)
- Fetch full-resolution image via IPC

#### Steps

- [ ] 🟥 Write E2E test: click image opens lightbox
- [ ] 🟥 Write E2E test: Escape closes lightbox
- [ ] 🟥 Create `ImageLightbox.tsx` component
- [ ] 🟥 Add lightbox state management to editor
- [ ] 🟥 Wire up click handler in `ImageNodeView`
- [ ] 🟥 Add keyboard navigation (Escape, arrows)
- [ ] 🟥 Add CSS animations for open/close

---

### 3.4 Right-Click Context Menu

**Status:** 🟥 To Do

Show context menu with image-specific actions.

#### Menu Items

- **Copy Image** - Copy to clipboard
- **Save Image As...** - Save to file system
- **Open Original** - Open full file in default app
- **Edit Properties...** - Open properties dialog (alt, caption, etc.) _[stub in Phase 3, implemented in Phase 4]_
- **---** (separator)
- **Delete Image** - Remove from note (with confirmation)
- **---** (separator)
- **Set as Block** / **Set as Inline** - Toggle display mode
- **Alignment** → Left, Center, Right (submenu)

> **Note**: "Edit Properties..." will show a placeholder dialog in Phase 3. Full implementation comes in [Phase 4](./PLAN-PHASE-4.md).

#### Implementation

- Create `ImageContextMenu` component using MUI Menu
- Show on right-click via NodeView
- Wire up actions to appropriate handlers

#### Steps

- [ ] 🟥 Write E2E test: right-click shows context menu
- [ ] 🟥 Write E2E test: "Copy Image" copies to clipboard
- [ ] 🟥 Create `ImageContextMenu.tsx` component
- [ ] 🟥 Add right-click handler to `ImageNodeView`
- [ ] 🟥 Implement each menu action
- [ ] 🟥 Add IPC for clipboard copy (image data)

---

### 3.5 Double-Click to Open Externally

**Status:** 🟥 To Do

Double-click opens the image file in the system's default image viewer.

#### Behavior

1. User double-clicks image
2. Image file opened in default app (Preview on Mac, Photos on Windows)

#### Implementation

- Use Electron's `shell.openPath()` via IPC
- Get image file path from storage layer

#### Steps

- [ ] 🟥 Write E2E test: double-click opens in external app
- [ ] 🟥 Add double-click handler to `ImageNodeView`
- [ ] 🟥 Add IPC handler for `shell.openPath`
- [ ] 🟥 Handle case where file doesn't exist (show error)

---

## Image Selection State

For resize handles and context menu to work, need proper selection:

- Selected image has visible border/outline
- Only one image selected at a time
- Click outside deselects
- Selected state stored in editor decoration or React state

#### Steps (included in above tasks)

- [ ] 🟥 Add selection styling to `ImageNodeView`
- [ ] 🟥 Track selected image ID in component state
- [ ] 🟥 Handle click-outside to deselect

---

## Testing Checklist

- [ ] Block images display centered, full-width
- [ ] Inline images flow with text correctly
- [ ] Resize handles appear on selection
- [ ] Dragging resize handle changes dimensions
- [ ] Aspect ratio maintained during resize
- [ ] Click opens lightbox
- [ ] Lightbox shows full-resolution image
- [ ] Escape/click-outside closes lightbox
- [ ] Right-click shows context menu
- [ ] Context menu actions work correctly
- [ ] Double-click opens in external app
- [ ] CI passes
