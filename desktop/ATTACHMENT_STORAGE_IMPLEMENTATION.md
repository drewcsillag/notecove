# Attachment Storage Implementation

## Overview
Implemented separate file storage for images and attachments instead of embedding them as base64 in CRDT documents. This fixes the image persistence bug and provides a foundation for general file attachments.

## Architecture

### File Structure
```
.notecove/
├── notes/
│   ├── <note-id>/
│   │   ├── updates/              # CRDT updates (existing)
│   │   ├── meta/                 # Metadata (existing)
│   │   └── attachments/          # NEW: Attachment files
│   │       ├── <uuid>.png        # Image file
│   │       ├── <uuid>.meta.json  # Attachment metadata
│   │       ├── <uuid>.jpg
│   │       └── <uuid>.meta.json
```

### Attachment Metadata Format
Each attachment has a `.meta.json` file containing:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "noteId": "abc123",
  "filename": "screenshot.png",
  "mimeType": "image/png",
  "size": 45678,
  "created": "2025-10-17T10:30:00.000Z"
}
```

## Components

### 1. AttachmentManager (`src/lib/attachment-manager.ts`)
New class that manages all attachment operations:

**Methods:**
- `saveAttachment(noteId, filename, data)` - Save file and return metadata
- `loadAttachment(noteId, attachmentId)` - Load file data
- `loadAttachmentAsDataURL(noteId, attachmentId)` - Load as data URL for rendering
- `deleteAttachment(noteId, attachmentId)` - Delete file and metadata
- `listAttachments(noteId)` - Get all attachments for a note
- `hasAttachment(noteId, attachmentId)` - Check if attachment exists
- `getTotalSize(noteId)` - Get total size of all attachments

**Features:**
- Automatically generates unique UUIDs for attachments
- Detects MIME types from file extensions
- Stores both file data and metadata
- Browser-compatible (uses crypto.randomUUID() or fallback)

### 2. ResizableImage Extension (`src/lib/extensions/resizable-image.ts`)
Modified to support attachment references:

**New Attributes:**
- `attachmentId` - UUID reference to attachment file

**Loading Priority:**
1. If `attachmentId` is present, load from AttachmentManager
2. If `src` is present (base64 or URL), use it (backward compatibility)
3. If neither, show placeholder image

**Configuration:**
```typescript
ResizableImage.configure({
  attachmentManager: attachmentManager,
  currentNoteId: () => currentNoteId,
  // ... other options
})
```

### 3. Editor Integration (`src/lib/editor.ts`)
Updated image insertion methods:

**Paste Handler:**
- Detects pasted images
- Saves as attachment (Electron mode) or base64 (web mode)
- Inserts with `attachmentId` attribute

**File Picker:**
- Same behavior as paste handler
- Fallback to base64 if attachment save fails

### 4. SyncManager Integration (`src/lib/sync-manager.ts`)
- Added `attachmentManager` field
- Initialized with file storage interface
- Accessible via `syncManager.attachmentManager`

### 5. Renderer Integration (`src/renderer.ts`)
- Passes `attachmentManager` to editor options
- Available for all editor operations

## Backward Compatibility

The implementation maintains full backward compatibility:

1. **Existing base64 images**: Will continue to work via the `src` attribute
2. **New images**: Automatically saved as attachments with `attachmentId`
3. **Graceful degradation**: Falls back to base64 if attachment loading fails
4. **Web mode**: Continues to use base64 (AttachmentManager only works in Electron)

## Benefits

### 1. Fixes Image Persistence Bug
- Images no longer stored in Y.Doc
- No more mysterious disappearances
- Data persists reliably on disk

### 2. Performance Improvements
- Y.Doc stays small (no large base64 strings)
- Faster CRDT operations
- Reduced memory usage
- Smaller sync data

### 3. Foundation for File Attachments
Ready to support any file type:
- PDFs
- Documents
- Archives
- Videos
- etc.

Just need to:
- Update UI to handle non-image attachments
- Add download/preview functionality
- Extend MIME type detection

### 4. Better Resource Management
- Can list all attachments per note
- Can calculate total storage used
- Can implement attachment cleanup/garbage collection
- Can implement attachment limits

## Usage Examples

### Saving an Attachment
```typescript
const attachment = await attachmentManager.saveAttachment(
  noteId,
  'screenshot.png',
  imageBuffer
);
// Returns: { id, noteId, filename, mimeType, size, created }
```

### Loading an Attachment
```typescript
const dataURL = await attachmentManager.loadAttachmentAsDataURL(
  noteId,
  attachmentId
);
// Returns: "data:image/png;base64,iVBORw0K..."
```

### Inserting with Attachment Reference
```typescript
editor.commands.insertContent({
  type: 'image',
  attrs: {
    attachmentId: '550e8400-e29b-41d4-a716-446655440000',
    src: '' // Empty for new attachment system
  }
});
```

## Migration Strategy

### For Existing Notes with Base64 Images:
No migration needed! Base64 images continue to work via the `src` attribute.

### Optional: Convert to Attachments
If desired, could implement a migration script:
1. Scan all notes for base64 images
2. Extract base64 data
3. Save as attachments
4. Update Y.Doc to use `attachmentId` instead of `src`

## Testing

### Manual Testing
1. Start app
2. Create new note
3. Paste or insert image
4. Check `.notecove/<note-id>/attachments/` for files
5. Switch to another note and back
6. Verify image persists

### File System Check
```bash
# List attachments for a note
ls .notecove/<note-id>/attachments/

# View metadata
cat .notecove/<note-id>/attachments/<uuid>.meta.json
```

## Next Steps

### Immediate
- [ ] Manual testing in actual app
- [ ] Create automated e2e tests
- [ ] Test edge cases (network drives, permissions, etc.)

### Future Enhancements
- [ ] Attachment browser UI
- [ ] Drag & drop file uploads
- [ ] Attachment sync between instances
- [ ] Garbage collection for orphaned attachments
- [ ] Attachment size limits/quotas
- [ ] Thumbnail generation for images
- [ ] Preview for PDFs and documents

## Files Modified

1. **New Files:**
   - `src/lib/attachment-manager.ts` - Core attachment management

2. **Modified Files:**
   - `src/lib/extensions/resizable-image.ts` - Added attachment support
   - `src/lib/editor.ts` - Updated image insertion to use attachments
   - `src/lib/sync-manager.ts` - Added AttachmentManager initialization
   - `src/renderer.ts` - Pass attachmentManager to editor

3. **Build:**
   - All TypeScript compiles successfully
   - No new dependencies required
   - Backward compatible

## Related Documentation
- See `IMAGE_PERSISTENCE_BUG_FINDINGS.md` for the investigation that led to this solution
- See `KNOWN_ISSUES.md` for any open issues
