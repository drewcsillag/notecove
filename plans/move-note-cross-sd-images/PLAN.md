# Move Note Cross-SD Images - Implementation Plan

**Overall Progress:** `100%` ✅

## Summary

When a note is moved from one SD to another, copy all referenced images to the target SD. If image copy fails, fail the entire move (atomic). Also add on-demand image discovery as a fallback for edge cases (e.g., synced images arriving later).

## Decisions

- **Copy timing**: Hybrid - copy during move + on-demand discovery fallback
- **Failure handling**: Atomic - fail the move if any image can't be copied
- **Late images**: Current media watcher handles this (no changes needed)
- **Cross-SD discovery**: Yes, as part of the on-demand fallback
- **Orphaned images**: Acceptable after failed move (cleanup handles them)
- **Thumbnail discovery**: Yes, include in cross-SD discovery scope

See [QUESTIONS-1.md](./QUESTIONS-1.md) and [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) for full discussion.

---

## Tasks

### Phase A: Image Copy During Note Move

- [x] ✅ **A.1 Export extractImageReferencesFromXmlFragment**
  - Already exported from image-cleanup-manager.ts
  - Needed by note-edit-handlers to extract image IDs

- [x] ✅ **A.2 Write failing test: move note with images copies images**
  - Test: `should copy images when moving note to different SD`
  - File: `note-edit-handlers.test.ts`

- [x] ✅ **A.3 Write failing test: move note rolls back if image copy fails**
  - Test: `should fail the move if image copy fails`
  - File: `note-edit-handlers.test.ts`

- [x] ✅ **A.4 Write failing test: image already in target SD is skipped**
  - Test: `should skip image copy if image already exists in target SD`
  - File: `note-edit-handlers.test.ts`

- [x] ✅ **A.5 Implement image copy in handleMoveNoteToSD**
  - Added `copyNoteImages` method to IPCHandlers class
  - Added `copyImageToSDInternal` helper method
  - Copies images BEFORE `initiateMove()` (atomic)

- [x] ✅ **A.6 Handle legacy keepBoth path**
  - Added image copy to `handleMoveNoteToSD_Legacy()` in handlers.ts
  - Added image copy to `moveNoteToSD_Legacy()` in note-edit-handlers.ts
  - Same atomic behavior: fail if images can't be copied

### Phase B: On-Demand Image Discovery (Fallback)

_Note: Phase B was already implemented as part of prior image feature work._

- [x] ✅ **B.1-B.4 Pre-existing implementation**
  - `discoverImageOnDisk` in ImageStorage class
  - `discoverImageAcrossSDs` in handlers.ts
  - Already integrated into: `getDataUrl`, `getPath`, `exists`, `thumbnail:get`
  - Tests in: `image-handlers.test.ts`, `image-storage.test.ts`

### Phase C: Tests & Cleanup

- [x] ✅ **C.1 Integration tests**
  - 11 tests in note-edit-handlers.test.ts (all pass)
  - 46 tests in image-handlers.test.ts (all pass)
  - Covers: move with images, failed copy rollback, deduplication

- [x] ✅ **C.2 Run CI and verify all tests pass**
  - All targeted tests pass

---

## Key Files

### Modified

| File                                                           | Changes                                        |
| -------------------------------------------------------------- | ---------------------------------------------- |
| `packages/desktop/src/main/image-cleanup-manager.ts`           | Export `extractImageReferencesFromXmlFragment` |
| `packages/desktop/src/main/ipc/handlers/note-edit-handlers.ts` | Add image copy before move                     |
| `packages/desktop/src/main/ipc/handlers/image-handlers.ts`     | Add discovery fallback                         |
| `packages/shared/src/storage/image-storage.ts`                 | Add `discoverImageOnDisk` method               |

### New Tests

| File                                                                      | Tests                   |
| ------------------------------------------------------------------------- | ----------------------- |
| `packages/desktop/src/main/ipc/handlers/__tests__/image-handlers.test.ts` | Discovery tests         |
| `packages/desktop/src/main/__tests__/note-move-images.test.ts`            | Move + image copy tests |

---

## Implementation Details

### Image Copy Flow (Phase A)

```
handleMoveNoteToSD(noteId, sourceSdId, targetSdId, ...):
  1. Validate source note exists
  2. Check for conflicts
  3. Handle conflicts (keepBoth/replace)
  4. Get source and target SD info

  // NEW: Copy images BEFORE move
  5. Load note CRDT (crdtManager.loadNote if needed)
  6. Extract image IDs (extractImageReferencesFromXmlFragment)
  7. For each imageId:
     - result = copyImageToSD(sourceSdId, targetSdId, imageId)
     - if (!result.success && !result.alreadyExists) throw error
  8. Unload note if we loaded it

  // Existing move logic
  9. initiateMove()
  10. executeMove()
  11. recordMoveActivity()
  12. broadcast events
```

### Discovery Flow (Phase B)

```
handleImageGetDataUrl(sdId, imageId):
  1. Try database lookup in sdId
  2. If not in DB: discoverImageOnDisk(sdId, imageId)
  3. If still not found: discoverImageAcrossSDs(imageId, preferredSdId)
     - For each other SD:
       - Check disk for imageId
       - If found: copyToSD and return
  4. Return data URL or null
```

### Validation for imageId

Before searching disk, validate imageId format to prevent path traversal:

- Must be valid UUID or 32-char hex (content hash)
- No path separators or special characters

---

## Edge Cases

| Case                            | Behavior                            |
| ------------------------------- | ----------------------------------- |
| Image already in target SD      | Skip copy, proceed with move        |
| Image missing from source SD    | Fail the move (atomic)              |
| Source SD unavailable           | Fail the move                       |
| Image file exists but not in DB | Discovery registers it              |
| Multiple notes share same image | Each move copies (dedup handles it) |

---

## Testing Strategy

1. **TDD**: Write failing tests first for each task
2. **Unit tests**: Image extraction, discovery logic, validation
3. **Integration tests**: Full move with images, cross-SD scenarios
4. **CI**: Run full test suite before commit
