# Phase 2: Insertion Methods

**Status:** 🟩 Done
**Progress:** `100%`

**Depends on:** Phase 1 (Foundation)

## Overview

Enable users to add images to notes via paste, drag-drop, file picker, and markdown syntax.

---

## Tasks

### 2.1 Paste Image from Clipboard

**Status:** 🟩 Done (basic paste)

Detect image data on clipboard when user pastes (Cmd+V).

#### Behavior

1. User copies image (screenshot, from browser, etc.)
2. User presses Cmd+V in editor
3. System detects image on clipboard
4. Image saved to `media/` folder via IPC
5. Image node inserted at cursor position

#### Implementation

- Use ProseMirror's `handlePaste` in editor props
- Check `clipboardData.items` for image types
- Convert to `Uint8Array` and send to main process
- Insert image node with returned `imageId`

#### Web Page Paste (HTML with remote images)

**Status:** 🟥 Deferred - to be done in a later phase

When pasting HTML content containing `<img src="https://...">`:

1. Parse HTML for `<img>` tags
2. Download each remote image via main process (avoids CORS)
3. Save to local `media/` folder
4. Replace remote URLs with local image nodes
5. Paste text content normally

> See [QUESTIONS-1.md#17-web-paste-behavior](./QUESTIONS-1.md#17-web-paste-behavior) for design decision.

#### Steps

- [x] 🟩 Write E2E test: paste image from clipboard inserts image node
- [ ] 🟨 Write E2E test: paste HTML with remote images downloads and inserts them (skipped/deferred)
- [x] 🟩 Add `handlePaste` handler in `TipTapEditor.tsx`
- [x] 🟩 Create helper to extract image from clipboard (in handlePaste)
- [ ] 🟨 Create helper to parse HTML and extract remote image URLs (deferred)
- [x] 🟩 Wire up IPC call to save image
- [ ] 🟨 Wire up IPC call to download remote images (deferred)
- [x] 🟩 Insert image node after successful save
- [ ] 🟨 Handle download failures gracefully (skip image, show toast) (deferred)

---

### 2.2 Drag and Drop from File System

**Status:** 🟩 Done

Allow dragging image files from Finder/Explorer into the editor.

#### Behavior

1. User drags image file into editor
2. Drop zone highlights
3. On drop, image saved to `media/` folder
4. Image node inserted at drop position

#### Implementation

- Use ProseMirror's `handleDrop` in editor props
- Read files from `dataTransfer.files`
- Filter for supported image types
- Save via IPC and insert node

#### Steps

- [x] 🟩 Write E2E test: drag image file into editor inserts image node
- [x] 🟩 Add `handleDrop` handler in `TipTapEditor.tsx`
- [x] 🟩 Add drag-over visual feedback (CSS)
- [x] 🟩 Create helper to read dropped files
- [x] 🟩 Wire up IPC and node insertion

---

### 2.3 File Picker Dialog

**Status:** 🟩 Done

Allow selecting images via native file picker dialog.

#### Behavior

1. User clicks image button in toolbar (Phase 9) or uses keyboard shortcut
2. Native file picker opens (filtered to image types)
3. User selects image(s)
4. Images saved to `media/` folder
5. Image nodes inserted at cursor

#### Implementation

- IPC handler calls `dialog.showOpenDialog` with image filters
- Returns file paths
- Main process reads files and saves to media folder
- Returns imageIds to renderer

#### IPC API Addition

```typescript
interface ImageAPI {
  // ... existing methods

  // Open file picker, save selected images, return imageIds
  pickAndSave(sdId: string): Promise<string[]>;
}
```

#### Steps

- [ ] 🟨 Write E2E test: file picker inserts selected images (skipped - file dialogs can't be tested in E2E)
- [x] 🟩 Add `image:pickAndSave` IPC handler
- [x] 🟩 Add keyboard shortcut (Cmd+Shift+I / Ctrl+Shift+I)
- [x] 🟩 Wire up to editor command
- [x] 🟩 Unit tests for IPC handler (5 tests)

---

### 2.4 Markdown Syntax Auto-Linkification

**Status:** 🟩 Done

Convert markdown image syntax `![alt](url)` to image nodes.

#### Behavior

1. User types `![description](https://example.com/image.png) ` (note trailing space)
2. On space, pattern is detected
3. Image is downloaded and saved to `media/`
4. Markdown syntax replaced with image node

#### For Local Files

- If URL is `file://` path, read from local filesystem
- If URL is relative path, resolve relative to note's sync directory

#### Implementation

- Similar to markdown link input rule in WebLink extension
- Use `InputRule` to detect pattern
- Download remote images via main process (to avoid CORS)
- Save to media folder and insert node

#### IPC API Addition

```typescript
interface ImageAPI {
  // ... existing methods

  // Download image from URL, save to media, return imageId
  downloadAndSave(sdId: string, url: string): Promise<string>;
}
```

#### Steps

- [x] 🟩 Write test: markdown syntax converts to image node (regex pattern tests)
- [x] 🟩 Add input rule for `![alt](url)` pattern
- [x] 🟩 Add `image:downloadAndSave` IPC handler (7 unit tests)
- [ ] 🟨 Handle download errors gracefully (show error toast) (deferred - errors logged to console)
- [x] 🟩 Support local file:// URLs

---

## Supported MIME Types

For all insertion methods, validate against supported types:

- `image/png`
- `image/jpeg`
- `image/gif`
- `image/webp`
- `image/svg+xml`
- `image/heic` (convert to JPEG on save if needed)

---

## Testing Checklist

- [ ] Paste PNG from clipboard → image appears
- [ ] Paste JPEG from screenshot tool → image appears
- [ ] Drag PNG from Finder → image appears
- [ ] Drag multiple images → all appear in order
- [ ] File picker → select image → image appears
- [ ] File picker → select multiple → all appear
- [ ] Type `![alt](url) ` → image downloaded and inserted
- [ ] Invalid image type → appropriate error message
- [ ] CI passes
