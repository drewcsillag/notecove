# Phase 6: Sync & Edge Cases

**Status:** 🟡 In Progress
**Progress:** `25%` (6.1 complete)

**Depends on:** Phase 1 (Foundation), Phase 5 (Thumbnails)

## Overview

Handle sync edge cases: missing images, file arrival detection, and cross-SD copying.

---

## Tasks

### 6.1 Broken Image Placeholder

**Status:** ✅ Complete

Show appropriate placeholder when image file is missing.

#### Scenarios

1. **Image not yet synced** - File exists on another device, syncing via Dropbox/iCloud
2. **Image deleted externally** - File removed outside NoteCove
3. **Sync directory unavailable** - External drive disconnected

#### Placeholder Design

```
┌─────────────────────┐
│                     │
│    [broken icon]    │
│                     │
│  Image not found    │
│  imageId: abc123    │
│                     │
└─────────────────────┘
```

- Gray background with broken image icon
- Show imageId for debugging
- Same dimensions as original if known (from node attrs)
- Tooltip: "This image may still be syncing or was deleted"

#### Implementation

- Detect missing file during `getDataUrl` IPC call
- Return null for missing files (already implemented)
- `ImageNodeView` renders broken placeholder with imageId
- Title tooltip explains possible sync scenario

#### Steps

- [x] ✅ Write test: missing image shows broken placeholder (4 tests)
- [x] ✅ Design broken placeholder component (enhanced existing)
- [x] ✅ IPC returns null for missing files (already worked)
- [x] ✅ Update `ImageNodeView` to display imageId in error placeholder
- [x] ✅ Add title tooltip: "This image may still be syncing..."
- [x] ✅ Add CSS for error-id styling (monospace, smaller font)

#### Files Modified

- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/Image.ts`
  - Added title tooltip to errorPlaceholder
  - Added `.notecove-image-error-id` span for imageId display
  - Update imageId in span when showing error
- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/__tests__/Image.test.ts`
  - Added 4 tests for broken image placeholder
- `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx`
  - Added CSS for `.notecove-image-error-id`

---

### 6.2 Auto-Update When Image File Arrives

**Status:** 🟥 To Do

Automatically display image when file appears (after sync).

#### Behavior

1. Image node references `imageId` that doesn't exist yet
2. Broken placeholder shown
3. File syncs from another device
4. File watcher detects new file in `media/` folder
5. Renderer notified via IPC event
6. Image node updates to show actual image

#### Implementation

- Extend existing file watcher to watch `media/` directory
- Emit `image:available` event when new image file detected
- `ImageNodeView` subscribes to this event
- Re-fetch and display when matching imageId arrives

#### IPC Events

```typescript
// Main → Renderer
window.electronAPI.image.onAvailable((imageId: string, sdId: string) => {
  // Image file is now available
});
```

#### Steps

- [ ] 🟥 Write test: broken placeholder updates when file arrives
- [ ] 🟥 Extend file watcher to watch `media/` directories
- [ ] 🟥 Add `image:available` IPC event
- [ ] 🟥 Add event listener in `TipTapEditor.tsx`
- [ ] 🟥 Update `ImageNodeView` to re-render on availability
- [ ] 🟥 Handle rapid arrivals (debounce updates)

---

### 6.3 Cross-SD Copy Handling

**Status:** 🟥 To Do

When copying content with images between sync directories, copy the image files.

#### Scenarios

1. **Same SD**: Copy image reference (same imageId)
2. **Different SD**: Copy image file to target SD, update reference

#### Behavior (Different SD)

1. User copies text with image from Note A (SD-1)
2. User pastes into Note B (SD-2)
3. System detects cross-SD paste
4. Image file copied from SD-1/media/ to SD-2/media/
5. New image node created with same imageId (or new ID?)

#### Design Decision: Same ID or New ID?

- **Same ID**: Simpler, but assumes IDs are globally unique (UUIDs are)
- **New ID**: Safer, but loses reference to original

Recommend: **Same ID** since we use UUIDs.

#### Implementation

- Detect cross-SD paste in paste handler
- Extract image nodes from pasted content
- For each image, check if exists in target SD
- If not, copy file from source SD
- Update node attrs if needed

#### Steps

- [ ] 🟥 Write test: paste across SDs copies image file
- [ ] 🟥 Write test: paste within same SD doesn't duplicate
- [ ] 🟥 Add cross-SD detection in paste handler
- [ ] 🟥 Add IPC for cross-SD image copy
- [ ] 🟥 Handle case where source image is also missing

---

### 6.4 Image Diagnostics

**Status:** 🟥 To Do

Add image-specific diagnostics to the existing diagnostics page.

#### Diagnostics Features

- **Orphaned images count**: Images in `media/` not referenced by any note
- **Missing images count**: Image nodes referencing non-existent files
- **Total image storage**: Size of all images per SD
- **Force re-fetch**: Context menu option to reload a specific image

#### Steps

- [ ] 🟥 Write test: diagnostics correctly counts orphaned images
- [ ] 🟥 Write test: diagnostics correctly counts missing images
- [ ] 🟥 Add image diagnostics to `DiagnosticsManager`
- [ ] 🟥 Add image section to diagnostics UI
- [ ] 🟥 Add "Reload Image" to context menu (force re-fetch)

---

## Edge Case: Source SD Unavailable

If copying from SD that's no longer available (e.g., external drive disconnected):

1. Detect that source SD is unavailable
2. Show warning to user
3. Paste proceeds but images show broken placeholder
4. Images will appear when source SD is reconnected and files sync

#### Steps

- [ ] 🟥 Write test: graceful handling when source SD unavailable
- [ ] 🟥 Add SD availability check before copy
- [ ] 🟥 Show appropriate user feedback

---

## Edge Case: Duplicate Image Content

If same image content is inserted multiple times:

- Each insertion creates a new file (different imageId)
- No deduplication (keeps things simple)
- Future optimization: content-addressed storage (hash-based)

For now, no special handling needed.

---

## Testing Checklist

- [ ] Missing image shows broken placeholder with imageId
- [ ] Broken placeholder has appropriate styling
- [ ] File arrival triggers image update
- [ ] Multiple images arriving in quick succession handled
- [ ] Copy/paste within SD reuses image reference
- [ ] Copy/paste across SDs copies image file
- [ ] Cross-SD paste with missing source shows broken placeholder
- [ ] Unavailable source SD handled gracefully
- [ ] CI passes
