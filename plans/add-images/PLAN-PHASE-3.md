# Phase 3: Display & Interaction

**Status:** 🟩 Done
**Progress:** `100%`

**Depends on:** Phase 1 (Foundation)

## Overview

Implement image display modes and user interactions: resizing, lightbox, context menu, and external opening.

---

## Tasks

### 3.1 Block and Inline Display Modes

**Status:** 🟩 Done

Support both block-level (full-width) and inline images.

#### Block Mode (Default)

- Image takes full width of editor (or specified width)
- Displayed on its own line
- Can have caption below

#### Inline Mode

- Image flows with text
- Limited to small sizes (max 200px height, max 300px width)
- No caption

#### Implementation

- Add `display` attribute to image node: `'block' | 'inline'`
- Different CSS and node view rendering for each mode
- Toggle via context menu or image properties dialog

#### Steps

- [x] 🟩 Add `display` attribute to ImageNodeAttrs interface
- [x] 🟩 Add `display` attribute to node schema with parseHTML/renderHTML
- [x] 🟩 Update `ImageNodeView` to apply CSS classes based on display mode
- [x] 🟩 Add CSS for block and inline display modes in TipTapEditor.tsx
- [x] 🟩 Write 5 tests for display modes (schema, serialization, parsing)

---

### 3.2 User-Resizable Images

**Status:** 🟩 Done

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

- [x] 🟩 Add resize handles to `ImageNodeView` (4 corners: nw, ne, sw, se)
- [x] 🟩 Implement drag tracking and dimension calculation
- [x] 🟩 Aspect ratio maintained by default (Shift+drag breaks ratio)
- [x] 🟩 Update node attrs on resize complete (stores as percentage)
- [x] 🟩 Add visual feedback during resize (dimension tooltip)
- [x] 🟩 Add CSS for resize handles and tooltip in TipTapEditor.tsx

---

### 3.3 Click to Enlarge (Lightbox)

**Status:** 🟩 Done

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

- [x] 🟩 Create `ImageLightbox.tsx` component with Portal
- [x] 🟩 Add ImageLightbox to TipTapEditor render
- [x] 🟩 Wire up click handler in `ImageNodeView`
- [x] 🟩 Add keyboard navigation (Escape, arrows)
- [x] 🟩 Add CSS animations for open/close
- [x] 🟩 Support navigation through all images in note

---

### 3.4 Right-Click Context Menu

**Status:** 🟩 Done

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

- [x] 🟩 Create `ImageContextMenu.tsx` component
- [x] 🟩 Add right-click handler to `ImageNodeView`
- [x] 🟩 Implement each menu action (Copy, Save As, Open, Delete, Display Mode, Alignment)
- [x] 🟩 Add IPC handlers: `image:copyToClipboard`, `image:saveAs`, `image:openExternal`
- [x] 🟩 Add preload API and TypeScript types

---

### 3.5 Double-Click to Open Externally

**Status:** 🟩 Done

Double-click opens the image file in the system's default image viewer.

#### Behavior

1. User double-clicks image
2. Image file opened in default app (Preview on Mac, Photos on Windows)

#### Implementation

- Use Electron's `shell.openPath()` via IPC
- Get image file path from storage layer

#### Steps

- [x] 🟩 Add double-click handler to `ImageNodeView`
- [x] 🟩 Uses `image:openExternal` IPC handler (shared with context menu)
- [x] 🟩 Error handling for missing files (thrown by IPC handler)

---

## Image Selection State

For resize handles and context menu to work, need proper selection:

- Selected image has visible border/outline
- Only one image selected at a time
- Click outside deselects
- Selected state stored in ProseMirror selection

#### Steps (included in above tasks)

- [x] 🟩 Add selection styling to `ImageNodeView` (via `selectNode`/`deselectNode`)
- [x] 🟩 Track selection via ProseMirror selection state
- [x] 🟩 Handle click-outside to deselect (via `deselectNode`)

---

## Testing Checklist

- [x] Block images display centered, full-width
- [x] Inline images flow with text correctly
- [x] Resize handles appear on selection
- [x] Dragging resize handle changes dimensions
- [x] Aspect ratio maintained during resize
- [x] Click opens lightbox
- [x] Lightbox shows full-resolution image
- [x] Escape/click-outside closes lightbox
- [x] Right-click shows context menu
- [x] Context menu actions work correctly
- [x] Double-click opens in external app
- [ ] CI passes (manual verification needed)
