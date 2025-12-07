# Phase 1: Foundation

**Status:** ✅ Complete
**Progress:** `100%` (1.1 ✅, 1.2 ✅, 1.3 ✅, 1.4 ✅, 1.5 ✅)

## Overview

Establish the core infrastructure for image support: database schema, storage layer, IPC handlers, and basic TipTap extension.

> **Note**: This phase fetches full-resolution images for display. Performance optimization via thumbnails comes in [Phase 5](./PLAN-PHASE-5.md). Testing with large images (>5MB) may be slow until then.

> **Design Decision**: External file storage chosen over embedded base64.
> See [QUESTIONS-1.md#1-image-storage-architecture](./QUESTIONS-1.md#1-image-storage-architecture)

---

## Tasks

### 1.1 Database Schema for Images

**Status:** ✅ Complete

Add `images` table to track image metadata in SQLite cache.

#### Schema

```sql
CREATE TABLE images (
  id TEXT PRIMARY KEY,           -- UUID (same as filename without extension)
  sd_id TEXT NOT NULL,           -- Which sync directory this image belongs to
  filename TEXT NOT NULL,        -- Full filename with extension (e.g., "abc123.png")
  mime_type TEXT NOT NULL,       -- e.g., "image/png"
  width INTEGER,                 -- Original width in pixels (nullable until analyzed)
  height INTEGER,                -- Original height in pixels (nullable until analyzed)
  size INTEGER NOT NULL,         -- File size in bytes
  created INTEGER NOT NULL,      -- Timestamp when image was added
  FOREIGN KEY (sd_id) REFERENCES storage_dirs(id) ON DELETE CASCADE
);

CREATE INDEX idx_images_sd_id ON images(sd_id);
```

#### Implementation Notes

- Schema version bumped from 7 to 8
- Added `ImageCache` type to `packages/shared/src/database/schema.ts`
- Added `ImageCacheOperations` interface to `packages/shared/src/database/types.ts`
- Implemented all operations in `packages/desktop/src/main/database/database.ts`:
  - `upsertImage`, `getImage`, `getImagesBySd`, `deleteImage`
  - `imageExists`, `getImageStorageSize`, `getImageCount`
- Added migration `migrateToVersion8()` for existing databases
- 10 new tests in `database.test.ts` covering all operations

#### Steps

- [x] ✅ Write test: `database.test.ts` - Image Cache Operations (10 tests)
- [x] ✅ Add schema to `packages/shared/src/database/schema.ts`
- [x] ✅ Add types to `packages/shared/src/database/types.ts`
- [x] ✅ Implement operations in `packages/desktop/src/main/database/database.ts`
- [x] ✅ Add migration for existing databases (v7→v8)

---

### 1.2 Image Storage Layer (Shared Package)

**Status:** ✅ Complete

Create `ImageStorage` class that handles file operations for images using the `FileSystemAdapter` abstraction.

#### Interface

```typescript
interface ImageStorage {
  // Get media directory path
  getMediaPath(): string;

  // Get full image file path
  getImagePath(imageId: string, mimeType: string): string;

  // Initialize media directory
  initializeMediaDir(): Promise<void>;

  // Save image file, returns { imageId, filename }
  saveImage(data: Uint8Array, mimeType: string, imageId?: string): Promise<SaveImageResult>;

  // Read image file
  readImage(imageId: string, mimeType: string): Promise<Uint8Array | null>;

  // Delete image file
  deleteImage(imageId: string, mimeType: string): Promise<void>;

  // Check if image exists
  imageExists(imageId: string, mimeType: string): Promise<boolean>;

  // List all image filenames
  listImages(): Promise<string[]>;

  // Get image info (size, filename)
  getImageInfo(imageId: string, mimeType: string): Promise<ImageInfo | null>;

  // Static helpers for MIME type / extension conversion
  static getExtensionFromMimeType(mimeType: string): string | null;
  static getMimeTypeFromExtension(extension: string): string | null;
  static isSupportedMimeType(mimeType: string): boolean;
  static parseImageFilename(filename: string): ParsedImageFilename | null;
}
```

#### Supported MIME Types

- `image/png` → `.png`
- `image/jpeg` → `.jpg`
- `image/gif` → `.gif`
- `image/webp` → `.webp`
- `image/svg+xml` → `.svg`
- `image/heic` → `.heic`
- `image/heif` → `.heif`

#### Directory Structure

```
sync-directory/
├── media/
│   ├── abc123.png
│   ├── def456.jpg
│   └── ghi789.webp
├── notes/
│   └── ...
```

#### Implementation Notes

- Added `media` path to `SyncDirectoryPaths` interface in `types.ts`
- Updated `SyncDirectoryStructure.getPaths()` to include media path
- Updated `SyncDirectoryStructure.initialize()` to create media directory
- Added `getMediaPath()` helper method to `SyncDirectoryStructure`
- Created `ImageStorage` class with all operations
- Uses native `crypto.randomUUID()` for UUID generation (avoids ESM uuid package issues)
- 36 new tests in `image-storage.test.ts` covering all operations
- Exported from `packages/shared/src/storage/index.ts`

#### Steps

- [x] ✅ Write test: `image-storage.test.ts` - 36 tests with mock FileSystemAdapter
- [x] ✅ Update `SyncDirectoryPaths` to include `media` path
- [x] ✅ Update `SyncDirectoryStructure.getPaths()` to include media
- [x] ✅ Implement `ImageStorage` class in `packages/shared/src/storage/image-storage.ts`
- [x] ✅ Add initialization of `media/` directory in SD initialization
- [x] ✅ Export `ImageStorage` from storage index

---

### 1.3 IPC Handlers for Image Operations

**Status:** ✅ Complete

Add IPC handlers in main process for renderer to interact with images.

#### API

```typescript
// Preload API (window.electronAPI.image.*)
interface ImageAPI {
  // Save image and return imageId
  save(
    sdId: string,
    data: Uint8Array,
    mimeType: string
  ): Promise<{ imageId: string; filename: string }>;

  // Get image data as base64 data URL for display
  getDataUrl(sdId: string, imageId: string): Promise<string | null>;

  // Get image file path (for external operations)
  getPath(sdId: string, imageId: string): Promise<string | null>;

  // Delete image
  delete(sdId: string, imageId: string): Promise<void>;

  // Check if image exists
  exists(sdId: string, imageId: string): Promise<boolean>;

  // Get image metadata from database
  getMetadata(imageId: string): Promise<ImageMetadata | null>;

  // List all images in a storage directory
  list(sdId: string): Promise<ImageMetadata[]>;

  // Get storage statistics
  getStorageStats(sdId: string): Promise<{ totalSize: number; imageCount: number }>;
}
```

#### Implementation Notes

- Added 8 IPC handlers to `packages/desktop/src/main/ipc/handlers.ts`:
  - `image:save`, `image:getDataUrl`, `image:getPath`, `image:delete`
  - `image:exists`, `image:getMetadata`, `image:list`, `image:getStorageStats`
- Uses `NodeFileSystemAdapter` and `SyncDirectoryStructure` for file operations
- Coordinates with database for metadata storage
- Returns base64 data URLs for renderer display
- 24 unit tests in `packages/desktop/src/main/ipc/__tests__/image-handlers.test.ts`
- Preload API exposed at `window.electronAPI.image.*`

#### Steps

- [x] ✅ Write test: IPC handler tests for image operations (24 tests)
- [x] ✅ Add handlers to `packages/desktop/src/main/ipc/handlers.ts`
- [x] ✅ Expose APIs in `packages/desktop/src/preload/index.ts` (inline types)

---

### 1.4 Basic TipTap Image Extension (Node Type)

**Status:** ✅ Complete

Create a TipTap node extension for images. Initially just renders images; interaction features come in later phases.

#### Node Schema

```typescript
{
  name: 'notecoveImage',
  group: 'block',
  atom: true,  // Treated as single unit, not editable content
  draggable: true,  // Can be reordered by dragging
  attrs: {
    imageId: { default: null },      // Reference to image in media folder
    sdId: { default: null },         // Sync directory ID
    alt: { default: '' },            // Alt text
    caption: { default: '' },        // Caption text
    alignment: { default: 'center' }, // left | center | right
    width: { default: null },        // Display width (percentage or px)
    linkHref: { default: null },     // Optional link URL
  }
}
```

#### Rendering

- Fetches image via IPC: `getDataUrl(sdId, imageId)`
- Shows loading placeholder (spinner) while fetching
- Shows broken image icon if fetch fails
- Caches loaded images to avoid re-fetching
- Supports alignment (left, center, right)
- Custom width support (percentage or px)
- Caption display below image

#### Implementation Notes

- Created `NotecoveImage` extension in `packages/desktop/src/renderer/src/components/EditorPanel/extensions/Image.ts`
- NodeView renders figure with img, loading state, error state, and caption
- Image data cache (`imageDataCache`) prevents re-fetching
- Added type declarations to `packages/desktop/src/renderer/src/types/electron.d.ts`
- Registered extension in `TipTapEditor.tsx`
- Added comprehensive CSS styling for all states (loading, error, alignment, selection)
- 9 unit tests in `extensions/__tests__/Image.test.ts`
- Commands: `insertImage`, `updateImage`

#### Steps

- [x] ✅ Write test: Image extension node creation and serialization (9 tests)
- [x] ✅ Create `packages/desktop/src/renderer/src/components/EditorPanel/extensions/Image.ts`
- [x] ✅ Create basic `ImageNodeView` component for rendering (inline in extension)
- [x] ✅ Register extension in `TipTapEditor.tsx`
- [x] ✅ Add basic CSS for image display in editor

---

### 1.5 Debug Tooling

**Status:** ✅ Complete

Add development aids for debugging image issues.

#### Features

- **Dev-mode tooltip**: When hovering image in dev mode, show imageId, dimensions, file size
- **Console logging**: Log image operations (save, load, delete) with IDs and sizes
- ~~Large file warning~~: Deferred to Phase 2 (image insertion) - more appropriate when adding images

#### Implementation Notes

- Added `__NOTECOVE_DEV_MODE__` global flag set in `main.tsx`
- Dev tooltip shows on hover: imageId, size, dimensions, MIME type
- Renderer logs: loading from cache, loading via IPC, load success with metadata, errors
- Main process logs: save operations (with size), delete operations
- Tooltip styled with monospace font and dark background for visibility

#### Steps

- [x] ✅ Add dev-mode tooltip to `ImageNodeView`
- [x] ✅ Add console logging for image operations (renderer + main process)
- [~] Large file warning - Deferred to Phase 2 (insertion)
- [~] `imageWarningSizeMB` setting - Deferred to Phase 2

---

## Dependencies

- None (this is the foundation phase)

## Outputs

After this phase:

- Images can be stored in `media/` folder
- Database tracks image metadata
- Renderer can request image data via IPC
- TipTap can render image nodes (but not insert them yet - that's Phase 2)

## Testing Checklist

- [x] Unit tests pass for ImageStorage (36 tests)
- [x] Unit tests pass for image database queries (10 tests)
- [x] IPC handler tests pass (24 tests)
- [x] TipTap extension tests pass (9 tests)
- [x] Debug logging appears in tests
- [ ] CI passes
