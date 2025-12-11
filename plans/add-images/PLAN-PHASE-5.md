# Phase 5: Thumbnails & Performance

**Status:** 🟡 In Progress
**Progress:** `66%` (5.1, 5.2 complete)

**Depends on:** Phase 1 (Foundation)

## Overview

Generate thumbnails for efficient rendering and implement lazy loading for performance.

---

## Tasks

### 5.1 Thumbnail Generation

**Status:** ✅ Complete

Generate smaller thumbnails for display in editor to improve performance.

#### Thumbnail Specs

- **Size**: Max 800px on longest edge (sufficient for most editor widths)
- **Format**: JPEG at 85% quality (good balance of size/quality)
- **Location**: `{appDataDir}/thumbnails/{sdId}/{imageId}.thumb.jpg`

#### When to Generate

- On image insertion (immediate)
- On first access if missing (lazy)
- Background regeneration if corrupt/missing

#### Implementation

- Use `sharp` library (Node.js) for image processing
- Generate in main process
- Return thumbnail path to renderer

#### Sharp Setup (Important)

```bash
# Install sharp
pnpm add sharp

# Rebuild for Electron (required for native bindings)
pnpm add -D @electron/rebuild
npx electron-rebuild -f -w sharp
```

> **Note**: Sharp 0.34+ provides its own TypeScript types. Added `esModuleInterop: true` to tsconfig.json for proper CJS/ESM interop.

#### API Addition

```typescript
// Preload API: window.electronAPI.thumbnail
interface ThumbnailAPI {
  get(sdId: string, imageId: string): Promise<ThumbnailResult | null>;
  getDataUrl(sdId: string, imageId: string): Promise<string | null>;
  exists(sdId: string, imageId: string): Promise<boolean>;
  delete(sdId: string, imageId: string): Promise<void>;
  generate(sdId: string, imageId: string): Promise<ThumbnailResult | null>;
}

interface ThumbnailResult {
  path: string;
  format: 'jpeg' | 'png' | 'gif';
  width: number;
  height: number;
  size: number;
}
```

#### Steps

- [x] ✅ Write test: thumbnail generated at correct size (17 tests)
- [x] ✅ Write test: thumbnail cached and reused
- [x] ✅ Install `sharp` dependency (^0.34.5)
- [x] ✅ Configure `@electron/rebuild` for sharp (pretest:e2e, rebuild:electron scripts)
- [x] ✅ Add rebuild step to CI pipeline (via pretest:e2e)
- [x] ✅ Create `ThumbnailGenerator` class in main process
- [x] ✅ Add IPC handlers for thumbnail requests (5 handlers)
- [ ] 🟥 Update `ImageNodeView` to use thumbnail by default (moved to 5.2)
- [ ] 🟥 Test sharp works on macOS, Windows, Linux (CI) - macOS verified

#### Files Created

- `packages/desktop/src/main/thumbnail/thumbnail-generator.ts` - ThumbnailGenerator class
- `packages/desktop/src/main/thumbnail/__tests__/thumbnail-generator.test.ts` - 17 tests
- `packages/desktop/src/main/thumbnail/index.ts` - Exports

#### Files Modified

- `packages/desktop/package.json` - Added sharp ^0.34.5, updated rebuild scripts
- `packages/desktop/tsconfig.json` - Added `esModuleInterop: true`
- `packages/desktop/src/main/ipc/handlers.ts` - 5 thumbnail IPC handlers
- `packages/desktop/src/preload/index.ts` - thumbnail API object
- `packages/desktop/src/renderer/src/types/electron.d.ts` - thumbnail interface
- `packages/desktop/src/renderer/src/api/browser-stub.ts` - thumbnail stubs
- `packages/desktop/src/renderer/src/api/web-client.ts` - thumbnail REST API
- `/.pnpm-approvals.json` - Added "sharp" to approvedPackages

---

### 5.2 Lazy Loading for Images

**Status:** ✅ Complete

Only load images when they're visible in the viewport.

#### Behavior

1. Image node renders lazy placeholder initially
2. When scrolled into view (via IntersectionObserver), fetch thumbnail
3. Display thumbnail with fade-in animation
4. Full image only loaded for lightbox/export (fallback if no thumbnail)

#### Implementation

- Uses IntersectionObserver API (browser native, efficient)
- 100px rootMargin for pre-loading slightly before visible
- Thumbnail API used for display (smaller, faster)
- Falls back to full image if thumbnail unavailable

#### Placeholder

- Gray box with image icon (`.notecove-image-lazy-placeholder`)
- Loading spinner shown during fetch (`.notecove-image-loading`)
- Smooth fade-in via `.notecove-image--fade-in` class

#### Steps

- [x] ✅ Write test: images not loaded until scrolled into view
- [x] ✅ Write test: placeholder shown before load
- [x] ✅ Write test: thumbnail API used, not full image API
- [x] ✅ Write test: fade-in class added on load
- [x] ✅ Write test: stops observing after load
- [x] ✅ Add Intersection Observer to `ImageNodeView`
- [x] ✅ Implement lazy placeholder element
- [x] ✅ Implement loading state transitions
- [x] ✅ Add fade-in animation class
- [x] ✅ Handle load errors gracefully (shows error placeholder)

#### Files Modified

- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/Image.ts`
  - Added `thumbnailCache` Map for caching thumbnails
  - Added `lazyPlaceholder` DOM element
  - Refactored `updateVisualState` to set up IntersectionObserver
  - Added `loadImage` function for async thumbnail loading
  - IntersectionObserver cleanup in `destroy()`
- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/__tests__/Image.test.ts`
  - Added MockIntersectionObserver for testing
  - 5 new lazy loading tests

---

### 5.3 Thumbnail Cache Management

**Status:** 🟥 To Do

Manage thumbnail cache to prevent unbounded growth.

#### Cache Location

```
{appDataDir}/
├── thumbnails/
│   ├── {sdId-1}/
│   │   ├── abc123.thumb.jpg
│   │   └── def456.thumb.jpg
│   └── {sdId-2}/
│       └── ...
```

#### Cleanup Strategy

1. **Size-based**: If cache exceeds X GB, remove oldest accessed
2. **Age-based**: Remove thumbnails not accessed in 90 days
3. **Orphan cleanup**: Remove thumbnails for images that no longer exist

#### Implementation

- Track last access time (file mtime or separate metadata)
- Run cleanup on app startup or periodically
- Integrate with image orphan cleanup (Phase 7)

#### Steps

- [ ] 🟥 Write test: old thumbnails removed after threshold
- [ ] 🟥 Write test: orphaned thumbnails cleaned up
- [ ] 🟥 Create `ThumbnailCacheManager` class
- [ ] 🟥 Add startup cleanup routine
- [ ] 🟥 Add cache size monitoring
- [ ] 🟥 Log cleanup actions for debugging

---

## Performance Considerations

### Memory Management

- Don't keep all image data in memory
- Use `URL.createObjectURL` for blob handling
- Revoke object URLs when image unmounts

### Rendering Optimization

- Use `content-visibility: auto` CSS where supported
- Debounce rapid scroll events
- Cancel pending loads if scrolling quickly

#### Steps

- [ ] 🟥 Implement object URL lifecycle management
- [ ] 🟥 Add CSS content-visibility optimization
- [ ] 🟥 Profile and optimize hot paths

---

## Thumbnail Formats by Source

| Source Format | Thumbnail Format  | Notes                         |
| ------------- | ----------------- | ----------------------------- |
| PNG           | JPEG              | Unless has transparency → PNG |
| JPEG          | JPEG              | Direct resize                 |
| GIF           | GIF (first frame) | Preserve for animated preview |
| WebP          | JPEG              | Convert for compatibility     |
| SVG           | PNG               | Rasterize at thumbnail size   |
| HEIC          | JPEG              | Convert via sharp             |

#### Steps

- [ ] 🟥 Handle each format correctly
- [ ] 🟥 Preserve transparency when needed
- [ ] 🟥 Handle animated GIFs appropriately

---

## Testing Checklist

### Functional Tests

- [ ] Thumbnails generated at correct size
- [ ] Thumbnails cached and reused on subsequent loads
- [ ] Cache cleaned up after size/age threshold
- [ ] Orphaned thumbnails removed
- [ ] Images lazy load on scroll
- [ ] Placeholder shown during load
- [ ] Smooth fade-in animation
- [ ] Memory usage reasonable with many images

### Performance & Stress Tests

- [ ] Note with 50+ images renders smoothly
- [ ] Rapid paste of 10 images in 2 seconds doesn't crash
- [ ] 100MB image handled gracefully (warning shown, still works)
- [ ] Corrupt/truncated image files show broken placeholder
- [ ] Zero-byte image files handled without crash

### Platform Tests

- [ ] Sharp builds on macOS (CI)
- [ ] Sharp builds on Windows (CI)
- [ ] Sharp builds on Linux (CI)
- [ ] HEIC conversion works (or graceful fallback)

- [ ] CI passes
