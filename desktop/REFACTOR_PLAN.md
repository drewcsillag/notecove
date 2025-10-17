# Dual Y.Doc Refactor Plan

## Goal
Separate content Y.Doc from metadata Y.Doc to prevent metadata updates from interfering with TipTap's cursor tracking.

## Architecture

### Before (Single Y.Doc)
```
note-id/
  updates/           # All Y.js updates (content + metadata mixed)
  meta/              # Instance sync tracking

Y.Doc contains:
  - Y.XmlFragment 'default'  # Content (TipTap)
  - Y.Map 'metadata'         # Metadata (our code)
```

### After (Dual Y.Doc)
```
note-id/
  updates/           # Content Y.js updates only (TipTap domain)
  metadata-updates/  # Metadata Y.js updates only (our domain)
  meta/              # Instance sync tracking (unchanged)

Content Y.Doc contains:
  - Y.XmlFragment 'default'  # Content ONLY

Metadata Y.Doc contains:
  - Y.Map 'metadata'         # Metadata ONLY
  - contentVersion: number   # Track correlation with content updates
```

## Changes Required

### 1. CRDTManager (crdt-manager.ts)
- [x] Split `docs` → `contentDocs` + `metadataDocs`
- [x] Split `pendingUpdates` → `pendingContentUpdates` + `pendingMetadataUpdates`
- [ ] Replace `getDoc()` with `getContentDoc()` + `getMetadataDoc()`
- [ ] Create separate update handlers for content vs metadata
- [ ] Add `contentVersion` tracking to metadata
- [ ] Update `initializeNote()` to initialize both Y.Docs
- [ ] Update `updateMetadata()` to update `contentVersion`
- [ ] Update `getNoteFromDoc()` to read from both Y.Docs
- [ ] Update all other methods that touch Y.Doc

### 2. UpdateStore (update-store.ts)
- [ ] Handle two directories: `updates/` and `metadata-updates/`
- [ ] Separate tracking for content vs metadata updates
- [ ] `addUpdate()` needs type parameter (content vs metadata)
- [ ] `flush()` needs to flush both types
- [ ] `readAllUpdates()` needs to read both directories
- [ ] `readNewUpdates()` needs to check both directories

### 3. SyncManager (sync-manager.ts)
- [ ] `loadNote()` loads both content and metadata updates
- [ ] `saveNoteWithCRDT()` initializes both Y.Docs
- [ ] Update sync logic to handle both update streams

### 4. Renderer (renderer.ts)
- [ ] `renderCurrentNote()` passes content Y.Doc to TipTap (not metadata)
- [ ] All metadata operations use `getMetadataDoc()`
- [ ] Update `saveCurrentNote()` to update `contentVersion`

### 5. Editor (editor.ts)
- [ ] Receives only content Y.Doc (no changes needed here)

## Correlation Strategy

Add `contentVersion` to metadata to track which content state the metadata corresponds to:

```typescript
metadata Y.Map: {
  title: "Meeting Notes",
  contentVersion: 5,  // Number of content updates when metadata was last updated
  modified: "2025-10-16T20:00:00Z",
  created: "2025-10-16T19:00:00Z",
  tags: ["work"],
  folderId: "all-notes",
  deleted: false
}
```

When updating metadata:
1. Get current content update count
2. Set `contentVersion` in metadata
3. This lets us detect if metadata is stale (contentVersion < actual content updates)

## Testing Strategy

1. Test note creation with dual Y.Docs
2. Test typing doesn't interfere with metadata
3. Test metadata updates don't interfere with typing
4. Test note loading from disk (both update streams)
5. Test multi-instance sync with both streams
6. Test title extraction updates contentVersion correctly

## Migration Path

1. Keep old `getDoc()` method working temporarily
2. Add new `getContentDoc()` and `getMetadataDoc()` methods
3. Migrate callsites one by one
4. Remove old `getDoc()` when all callsites migrated
5. Clean up old single-doc tests
