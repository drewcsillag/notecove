# Image Support Implementation Plan

**Overall Progress:** `56%` (Phases 1-4, 9 complete)

## Architecture Summary

- **Storage**: External file references (not embedded in CRDT)
- **Location**: `sync-directory/media/{imageId}.{ext}`
- **CRDT stores**: Image node with `{ imageId, alt, caption, alignment, width, linkHref }`
- **Thumbnails**: Generated on-demand, cached in app data directory
- **Cleanup**: Mark-and-sweep with 14-day grace period
- **Formats**: PNG, JPEG, GIF (animated), WebP, SVG, HEIC
- **Large file warning**: Soft warning at 10MB (configurable)
- **Future extensibility**: Architecture supports video/audio later

> **Design Decisions**: See [QUESTIONS-1.md](./QUESTIONS-1.md) for rationale on storage approach, cleanup strategy, and other decisions.

## Phases

1. ✅ [Phase 1: Foundation](./PLAN-PHASE-1.md) - Storage layer, database, IPC, basic extension
2. ✅ [Phase 2: Insertion Methods](./PLAN-PHASE-2.md) - Paste, drag-drop, file picker, markdown syntax
3. ✅ [Phase 3: Display & Interaction](./PLAN-PHASE-3.md) - Resizing, lightbox, context menu
4. ✅ [Phase 4: Metadata & Accessibility](./PLAN-PHASE-4.md) - Alt text, captions, alignment, link wrapping
5. 🟥 [Phase 5: Thumbnails & Performance](./PLAN-PHASE-5.md) - Thumbnail generation, lazy loading
6. 🟥 [Phase 6: Sync & Edge Cases](./PLAN-PHASE-6.md) - Broken placeholders, cross-SD copy
7. 🟥 [Phase 7: Cleanup](./PLAN-PHASE-7.md) - Mark-and-sweep orphan cleanup
8. 🟥 [Phase 8: Export](./PLAN-PHASE-8.md) - Export with adjacent folder
9. ✅ [Phase 9: Toolbar UI](./PLAN-PHASE-9.md) - Image button in toolbar
10. 🟥 [Phase 10: Text Wrapping](./PLAN-PHASE-10.md) - Text flow around images
11. 🟥 [Phase 11: Media Browser](./PLAN-PHASE-11.md) - Browse images, see which notes use them, bulk actions

---

## Tasks Overview

### Phase 1: Foundation ✅

- [x] ✅ **1.1 Database schema for images**
- [x] ✅ **1.2 Image storage layer (shared package)**
- [x] ✅ **1.3 IPC handlers for image operations**
- [x] ✅ **1.4 Basic TipTap Image extension (node type)**
- [x] ✅ **1.5 Debug tooling (dev tooltip, logging, large file warning)**

### Phase 2: Insertion Methods ✅

- [x] ✅ **2.1 Paste image from clipboard**
- [x] ✅ **2.2 Drag and drop from file system**
- [x] ✅ **2.3 File picker dialog**
- [x] ✅ **2.4 Markdown syntax auto-linkification**

### Phase 3: Display & Interaction ✅

- [x] ✅ **3.1 Block and inline display modes**
- [x] ✅ **3.2 User-resizable images**
- [x] ✅ **3.3 Click to enlarge (lightbox)**
- [x] ✅ **3.4 Right-click context menu**
- [x] ✅ **3.5 Double-click to open externally**

### Phase 4: Metadata & Accessibility ✅

- [x] ✅ **4.1 Alt text editing**
- [x] ✅ **4.2 Caption support**
- [x] ✅ **4.3 Alignment options (left/center/right)**
- [x] ✅ **4.4 Link wrapping (click image → URL)**

### Phase 5: Thumbnails & Performance

- [x] ✅ **5.1 Thumbnail generation** (ThumbnailGenerator class, 5 IPC handlers, 17 tests)
- [x] ✅ **5.2 Lazy loading for images** (IntersectionObserver, thumbnail display, 5 tests)
- [ ] 🟥 **5.3 Thumbnail cache management**

### Phase 6: Sync & Edge Cases

- [ ] 🟥 **6.1 Broken image placeholder**
- [ ] 🟥 **6.2 Auto-update when image file arrives**
- [ ] 🟥 **6.3 Cross-SD copy handling**
- [ ] 🟥 **6.4 Image diagnostics (orphan count, missing count, storage stats)**

### Phase 7: Cleanup

- [ ] 🟥 **7.1 Mark-and-sweep orphan detection**
- [ ] 🟥 **7.2 Integrate cleanup with existing indexing**

### Phase 8: Export

- [ ] 🟥 **8.1 Export images to adjacent folder**

### Phase 9: Toolbar UI ✅

- [x] ✅ **9.1 Add image button to toolbar**

### Phase 10: Text Wrapping

- [ ] 🟥 **10.1 CSS float-based text wrapping**
- [ ] 🟥 **10.2 Wrap mode UI (wrap vs no-wrap option)**
- [ ] 🟥 **10.3 Clear handling for consecutive images**

### Phase 11: Media Browser

- [ ] 🟥 **11.1 Media Browser window**
- [ ] 🟥 **11.2 Media Browser UI (Grid/List views)**
- [ ] 🟥 **11.3 Search & filtering**
- [ ] 🟥 **11.4 Image-to-note mapping**
- [ ] 🟥 **11.5 Image actions (single & bulk)**
- [ ] 🟥 **11.6 IPC & data layer**

---

## Key Files (Expected)

### New Files

- `packages/shared/src/storage/image-storage.ts` - Image file operations
- `packages/shared/src/database/image-queries.ts` - Image database queries
- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/Image.ts` - TipTap extension
- `packages/desktop/src/renderer/src/components/EditorPanel/ImageLightbox.tsx` - Lightbox component
- `packages/desktop/src/renderer/src/components/EditorPanel/ImageContextMenu.tsx` - Context menu
- `packages/desktop/src/main/image-manager.ts` - Main process image handling
- `packages/desktop/src/main/thumbnail-generator.ts` - Thumbnail generation

### Modified Files

- `packages/shared/src/database/schema.ts` - Add images table
- `packages/desktop/src/main/ipc/handlers.ts` - Add image IPC handlers
- `packages/desktop/src/preload/index.ts` - Expose image APIs
- `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx` - Register Image extension
- `packages/desktop/src/renderer/src/components/EditorPanel/EditorToolbar.tsx` - Add image button
- `packages/shared/src/storage/sd-structure.ts` - Add media directory paths

---

## Testing Strategy

Each phase follows TDD:

1. Write failing tests for the feature
2. Implement minimum code to pass
3. Refactor if needed
4. Run CI before commit

Test categories:

- **Unit tests**: Storage layer, thumbnail generation, database queries
- **Integration tests**: IPC round-trips, file system operations
- **E2E tests**: Paste, drag-drop, display, lightbox interactions

---

## Notes

- Phase 1 must be complete before other phases can start
- Phases 2-4 can be worked on in parallel after Phase 1
- Phase 5 (thumbnails) should come before Phase 6 (sync) for better UX
- Phase 7 (cleanup) depends on Phase 6
- Phase 8-10 are independent and can be done anytime after Phase 1
- Phase 10 (text wrapping) builds on Phase 4's alignment feature
