# Phase 8: Export

**Status:** 🟥 To Do
**Progress:** `0%`

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
    ├── image1.png
    ├── image2.jpg
    └── image3.webp
```

### Markdown Image References

In the exported Markdown:

```markdown
# My Note Title

Here's some text with an image:

![Alt text](My%20Note_attachments/image1.png)

More text here.
```

- Use relative paths
- URL-encode spaces and special characters
- Preserve original file extension

---

## Tasks

### 8.1 Export Images to Adjacent Folder

**Status:** 🟥 To Do

Modify existing export functionality to handle images.

#### Current Export Flow

1. User selects notes to export
2. User picks destination folder
3. Each note exported as `{title}.md`
4. Images... not handled yet

#### New Flow

1. User selects notes to export
2. User picks destination folder
3. For each note:
   a. Parse content for image nodes
   b. Create `{title}_attachments/` folder if images exist
   c. Copy each image file to attachments folder
   d. Generate Markdown with relative image paths
   e. Write Markdown file

#### Image Filename Strategy

Options:

1. **Use imageId**: `abc123.png` (unique, but not descriptive)
2. **Use alt text**: `my-screenshot.png` (descriptive, but may conflict)
3. **Sequential**: `image-1.png`, `image-2.png` (simple, predictable)
4. **Hybrid**: `{alt-or-image}-{short-id}.png`

Recommend: **Option 4 (Hybrid)** - Best of both worlds.

Example: `screenshot-abc1.png`, `diagram-def4.png`

#### Implementation

```typescript
interface ExportImageResult {
  originalImageId: string;
  exportedFilename: string;
  relativePath: string; // e.g., "Note_attachments/screenshot-abc1.png"
}

async function exportNoteWithImages(
  noteId: string,
  destinationDir: string,
  noteTitle: string
): Promise<{
  markdownPath: string;
  images: ExportImageResult[];
}>;
```

#### Steps

- [ ] 🟥 Write test: exported note has correct image paths
- [ ] 🟥 Write test: images copied to attachments folder
- [ ] 🟥 Write test: image filenames are valid and unique
- [ ] 🟥 Modify `handleGetNotesForExport` to include image info
- [ ] 🟥 Modify `handleWriteExportFile` to copy images
- [ ] 🟥 Update Markdown generation to use relative paths
- [ ] 🟥 Handle missing images gracefully (skip with warning)

---

## Edge Cases

### Image Referenced Multiple Times

- Same image appears twice in note
- Copy file once, reference twice in Markdown

### Caption and Alt Text

Export both in Markdown format:

```markdown
![Alt text](path/to/image.png 'Caption text')
```

Or use HTML for more control:

```html
<figure>
  <img src="path/to/image.png" alt="Alt text" />
  <figcaption>Caption text</figcaption>
</figure>
```

**Decision:** Use HTML `<figure>` for images with captions, plain Markdown for others.

### Image Alignment

Not supported in standard Markdown. Options:

1. Ignore alignment in export
2. Use HTML with style attributes
3. Add comment hint

**Decision:** Use HTML with inline style for aligned images:

```html
<img src="..." alt="..." style="display: block; margin-left: auto; margin-right: auto;" />
```

### Bulk Export

When exporting multiple notes:

- Each note gets its own `_attachments` folder
- No shared images between notes (even if same image used)
- Simpler structure, self-contained exports

#### Steps

- [ ] 🟥 Handle multiple image references
- [ ] 🟥 Export captions using figure/figcaption
- [ ] 🟥 Export alignment using inline styles
- [ ] 🟥 Handle bulk export correctly

---

## Filename Sanitization

Image filenames in exports must be:

- Valid on all platforms (Windows, Mac, Linux)
- No special characters: `< > : " / \ | ? *`
- No leading/trailing spaces or dots
- Reasonable length (< 200 chars)

```typescript
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^\.+|\.+$/g, '')
    .substring(0, 200);
}
```

#### Steps

- [ ] 🟥 Implement filename sanitization
- [ ] 🟥 Test with various edge cases

---

## Export Options (Future)

Could add options for:

- [ ] Embed images as base64 (single file export)
- [ ] Use absolute paths
- [ ] Flatten attachments folder structure

Not implementing now, but architecture should allow extension.

---

## Testing Checklist

- [ ] Export creates `_attachments` folder when images present
- [ ] Images copied correctly
- [ ] Markdown has correct relative paths
- [ ] Paths work when opening exported file
- [ ] Captions exported correctly
- [ ] Alignment exported correctly
- [ ] Missing images handled gracefully
- [ ] Filenames sanitized properly
- [ ] Bulk export creates separate attachment folders
- [ ] CI passes
