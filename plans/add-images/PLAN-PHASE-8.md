# Phase 8: Export

**Status:** ✅ Complete
**Progress:** `100%`

**Depends on:** Phase 1 (Foundation)

## Overview

Export notes with images to adjacent folder structure.

---

## Export Format

When exporting a note with images:

```
export-folder/
├── My Note.md           # The exported note
└── My Note_attachments/ # Images for this note
    ├── abc123.png
    ├── def456.jpg
    └── ghi789.webp
```

### Markdown Image References

In the exported Markdown:

```markdown
# My Note Title

Here's some text with an image:

![Alt text](My%20Note_attachments/abc123.png)

More text here.
```

- Use relative paths
- URL-encode spaces and special characters
- Preserve original file extension
- Use imageId as filename (unique, no conflicts)

---

## Tasks

### 8.1 Export Images to Adjacent Folder

**Status:** ✅ Complete

Modified existing export functionality to handle images.

#### Implementation Summary

**Files Modified:**

1. `markdown-export.ts` - Added `convertNotecoveImage()`, `extractImageReferences()`, `replaceImagePlaceholders()`
2. `export-service.ts` - Updated to copy images and create attachments folders
3. `handlers.ts` - Added `handleCopyImageForExport()` IPC handler
4. `preload/index.ts` - Added `copyImageFile` API
5. `electron.d.ts` - Added TypeScript types
6. `browser-stub.ts` / `web-client.ts` - Added stubs

#### Export Flow

1. User selects notes to export
2. User picks destination folder
3. For each note:
   a. Convert to markdown with `{ATTACHMENTS}/imageId` placeholders
   b. Extract image references from content
   c. If images exist, create `{title}_attachments/` folder
   d. Copy each image file to attachments folder
   e. Replace placeholders with actual paths
   f. Write Markdown file

#### Image Filename Strategy

**Decision:** Use imageId directly (Option 1)

- `abc123.png` - unique, no conflicts, simple
- Original extension preserved from source file

#### Steps

- [x] ✅ Write test: exported note has correct image paths (10 tests)
- [x] ✅ Write test: images copied to attachments folder
- [x] ✅ Write test: image filenames are valid and unique
- [x] ✅ Modify `handleGetNotesForExport` to include sdId
- [x] ✅ Add `handleCopyImageForExport` IPC handler
- [x] ✅ Update Markdown generation to use relative paths
- [x] ✅ Handle missing images gracefully (skip with warning)

---

## Edge Cases

### Image Referenced Multiple Times

- ✅ Same image appears twice in note
- ✅ Copy file once, both references use same path

### Caption and Alt Text

✅ Implemented using HTML `<figure>` for images with captions:

```html
<figure style="display: block; margin-left: auto; margin-right: auto">
  <img
    src="path/to/image.png"
    alt="Alt text"
    style="display: block; margin-left: auto; margin-right: auto"
  />
  <figcaption>Caption text</figcaption>
</figure>
```

### Image Alignment

✅ Implemented using HTML with inline styles:

- **Left:** No special styles (natural flow)
- **Center:** `margin-left: auto; margin-right: auto`
- **Right:** `margin-left: auto`

### Image with Link

✅ Wrapped in `<a>` tag:

```html
<a href="https://example.com"><img src="..." alt="..." /></a>
```

### Image with Width

✅ Added `width` attribute to `<img>` tag:

```html
<img src="..." alt="..." width="50%" />
```

### Bulk Export

✅ Each note gets its own `_attachments` folder:

- Self-contained exports
- No sharing between notes

### Missing Images

✅ Handled gracefully:

- Warning logged to console
- Warning added to errors list (shown in completion dialog)
- Export continues without failing

---

## Testing Checklist

- [x] ✅ Export creates `_attachments` folder when images present
- [x] ✅ Images copied correctly
- [x] ✅ Markdown has correct relative paths
- [x] ✅ Captions exported correctly (HTML figure/figcaption)
- [x] ✅ Alignment exported correctly (HTML inline styles)
- [x] ✅ Missing images handled gracefully (warning, continue)
- [x] ✅ Bulk export creates separate attachment folders
- [x] ✅ CI passes

---

## Implementation Details

### New Functions in markdown-export.ts

```typescript
// Convert notecoveImage node to markdown/HTML
function convertNotecoveImage(node: JSONContent): string;

// Extract all image references from content
function extractImageReferences(content: JSONContent): ImageReference[];

// Replace {ATTACHMENTS}/imageId placeholders with actual paths
function replaceImagePlaceholders(
  markdown: string,
  attachmentsFolder: string,
  imageExtensions: Map<string, string>
): string;
```

### New IPC Handler

```typescript
// Copy image file for export
handleCopyImageForExport(
  sdId: string,
  imageId: string,
  destPath: string
): Promise<{ success: boolean; error?: string; extension?: string }>;
```

### Test Coverage

- 10 new tests for image export in markdown-export.test.ts
- Covers: simple images, captions, alignment, links, width, missing images, multiple images
