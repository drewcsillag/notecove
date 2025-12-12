# Phase 11: Media Browser

**Status:** 🟥 Not Started

## Overview

A dedicated window to browse all images in sync directories, see which notes contain each image, and perform bulk operations.

## Design Decisions

| Question           | Answer                                                           |
| ------------------ | ---------------------------------------------------------------- |
| Access Point       | Menu item (View → Media Browser) + keyboard shortcut             |
| Layout             | New window (separate from main app window)                       |
| Display Modes      | Grid + List toggle                                               |
| Image-to-Note Info | Note name + preview snippet, clickable to navigate               |
| Actions            | Navigate, Lightbox, Copy, Export, Bulk ops, Insert into note     |
| Filtering          | Advanced (search + filter by date/size/format, used vs orphaned) |
| Name               | Media Browser                                                    |
| Scope              | Switchable between SDs                                           |

---

## Tasks

### 11.1 Media Browser Window

- [ ] Create new Electron BrowserWindow for Media Browser
- [ ] Add menu item: View → Media Browser
- [ ] Add keyboard shortcut (Cmd/Ctrl+Shift+M or similar)
- [ ] Implement IPC communication between main window and Media Browser window
- [ ] Handle window lifecycle (open, close, focus)

### 11.2 Media Browser UI

- [ ] Create main MediaBrowser React component
- [ ] Implement Grid view with thumbnails (from Phase 5)
- [ ] Implement List view with image details (filename, size, dimensions, format)
- [ ] Add view mode toggle (Grid/List)
- [ ] Implement SD selector dropdown
- [ ] Add lazy loading with Intersection Observer

### 11.3 Search & Filtering

- [ ] Add search bar (search by filename, alt text, containing note)
- [ ] Filter: Used vs Orphaned images
- [ ] Filter: Date range (added/modified)
- [ ] Filter: File size range
- [ ] Filter: Format (PNG, JPEG, GIF, etc.)
- [ ] Persist filter state in window

### 11.4 Image-to-Note Mapping

- [ ] Query database for image → note relationships
- [ ] Display note references panel when image selected
- [ ] Show note name + text snippet around image
- [ ] Click note reference to navigate (focus main window, open note, scroll to image)
- [ ] Handle images used in multiple notes

### 11.5 Image Actions

- [ ] Single image actions:
  - [ ] Open in lightbox (full-size view)
  - [ ] Copy to clipboard
  - [ ] Export to filesystem (Save As dialog)
  - [ ] Insert into current note (communicate with main window)
  - [ ] Navigate to image in note
- [ ] Multi-select support:
  - [ ] Shift+click range selection
  - [ ] Cmd/Ctrl+click individual selection
  - [ ] Select All (Cmd/Ctrl+A)
- [ ] Bulk operations:
  - [ ] Bulk export (to folder)
  - [ ] Bulk copy (if practical)

### 11.6 IPC & Data Layer

- [ ] IPC handlers for Media Browser queries:
  - [ ] List all images (with filters)
  - [ ] Get image-to-note mappings
  - [ ] Get storage stats per SD
- [ ] Efficient database queries for image-note relationships
- [ ] Handle cross-window communication for "Insert into note"

---

## Dependencies

- **Phase 5 (Thumbnails)** - Required for performant thumbnail display
- **Phase 7 (Cleanup)** - Orphan detection logic for "used vs orphaned" filter

## Key Files (Expected)

### New Files

- `packages/desktop/src/main/media-browser-window.ts` - Window creation/management
- `packages/desktop/src/renderer/src/media-browser/` - Media Browser React app
  - `MediaBrowser.tsx` - Main component
  - `MediaGrid.tsx` - Grid view
  - `MediaList.tsx` - List view
  - `MediaFilters.tsx` - Search and filter controls
  - `ImageDetails.tsx` - Selected image info + note references
- `packages/desktop/src/main/ipc/media-browser-handlers.ts` - IPC handlers

### Modified Files

- `packages/desktop/src/main/index.ts` - Register Media Browser window
- `packages/desktop/src/main/menu.ts` - Add View → Media Browser menu item
- `packages/shared/src/database/schema.ts` - May need indexes for efficient queries

## Notes

- New window approach keeps Media Browser independent of main editor state
- Cross-window IPC needed for "Insert into note" and "Navigate to image"
- Consider whether Media Browser should have its own entry point or share renderer
