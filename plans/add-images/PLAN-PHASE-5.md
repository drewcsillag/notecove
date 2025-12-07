# Phase 5: Thumbnails & Performance

**Status:** 🟥 To Do
**Progress:** `0%`

**Depends on:** Phase 1 (Foundation)

## Overview

Generate thumbnails for efficient rendering and implement lazy loading for performance.

---

## Tasks

### 5.1 Thumbnail Generation

**Status:** 🟥 To Do

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

> **Risk**: `sharp` has native bindings that must be rebuilt for Electron's Node version. CI must include rebuild step. Test on all platforms.

#### API Addition

```typescript
interface ImageAPI {
  // Get thumbnail data URL (generates if needed)
  getThumbnailDataUrl(sdId: string, imageId: string): Promise<string>;
}
```

#### Steps

- [ ] 🟥 Write test: thumbnail generated at correct size
- [ ] 🟥 Write test: thumbnail cached and reused
- [ ] 🟥 Install `sharp` dependency
- [ ] 🟥 Configure `@electron/rebuild` for sharp
- [ ] 🟥 Add rebuild step to CI pipeline
- [ ] 🟥 Create `ThumbnailGenerator` class in main process
- [ ] 🟥 Add IPC handler for thumbnail requests
- [ ] 🟥 Update `ImageNodeView` to use thumbnail by default
- [ ] 🟥 Test sharp works on macOS, Windows, Linux (CI)

---

### 5.2 Lazy Loading for Images

**Status:** 🟥 To Do

Only load images when they're visible in the viewport.

#### Behavior

1. Image node renders placeholder initially
2. When scrolled into view, fetch thumbnail
3. Display thumbnail
4. Full image only loaded for lightbox/export

#### Implementation Options

1. **Intersection Observer API** - Browser native, efficient
2. **Scroll event + bounds checking** - More control, less efficient

Use Intersection Observer for better performance.

#### Placeholder

- Show gray box with image icon
- Same dimensions as image (from node attrs or default)
- Smooth fade-in when image loads

#### Steps

- [ ] 🟥 Write test: images not loaded until scrolled into view
- [ ] 🟥 Write test: placeholder shown before load
- [ ] 🟥 Add Intersection Observer to `ImageNodeView`
- [ ] 🟥 Implement loading state and placeholder
- [ ] 🟥 Add fade-in animation on load
- [ ] 🟥 Handle load errors gracefully

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
