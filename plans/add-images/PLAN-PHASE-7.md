# Phase 7: Cleanup

**Status:** 🟥 To Do
**Progress:** `0%`

**Depends on:** Phase 1 (Foundation), Phase 6 (Sync handling)

## Overview

Implement mark-and-sweep garbage collection for orphaned images.

> **Design Decision**: Mark-and-sweep with 14-day grace period chosen over reference counting.
> See [QUESTIONS-1.md#10-orphan-image-cleanup](./QUESTIONS-1.md#10-orphan-image-cleanup)

---

## Architecture

### Mark-and-Sweep Algorithm

**Mark Phase:**

1. Scan all notes in all SDs
2. Extract all imageIds referenced in content
3. Build set of `referencedImageIds`

**Sweep Phase:**

1. List all files in each SD's `media/` folder
2. For each file, check if imageId is in `referencedImageIds`
3. If NOT referenced AND file older than 14 days → delete

### Why 14-Day Grace Period?

- Allows time for sync delays
- Covers undo scenarios (deleted reference might be restored)
- Prevents race conditions during active editing

---

## Tasks

### 7.1 Mark-and-Sweep Orphan Detection

**Status:** 🟥 To Do

Implement the detection algorithm.

#### Implementation

```typescript
interface OrphanDetectionResult {
  sdId: string;
  imageId: string;
  filename: string;
  fileCreated: number;
  isOrphan: boolean;
  safeToDelete: boolean; // isOrphan AND older than grace period
}

async function detectOrphanedImages(
  sdId: string,
  gracePeriodDays: number = 14
): Promise<OrphanDetectionResult[]>;
```

#### Scanning Notes for References

- Use existing database/CRDT infrastructure
- Parse Y.XmlFragment content for image nodes
- Extract `imageId` from each image node

#### Steps

- [ ] 🟥 Write test: orphan detection finds unreferenced images
- [ ] 🟥 Write test: recently added orphans not marked for deletion
- [ ] 🟥 Write test: referenced images never marked for deletion
- [ ] 🟥 Create `image-cleanup.ts` in shared package
- [ ] 🟥 Implement `extractImageReferences(noteContent)` helper
- [ ] 🟥 Implement `detectOrphanedImages(sdId, gracePeriod)`
- [ ] 🟥 Add IPC handler for orphan detection

---

### 7.2 Integrate Cleanup with Existing Indexing

**Status:** 🟥 To Do

Run cleanup automatically alongside existing background tasks.

#### Integration Points

1. **App startup**: Run cleanup after initial indexing completes
2. **After sync**: Run cleanup after processing external changes
3. **Manual trigger**: Add to diagnostics/settings UI

#### Cleanup Flow

```
App Startup
    │
    ▼
Index Notes (existing)
    │
    ▼
Extract Image References
    │
    ▼
Detect Orphans
    │
    ▼
Delete Safe-to-Delete Orphans
    │
    ▼
Log Results
```

#### Also Clean Thumbnails

- After deleting orphaned image, delete corresponding thumbnail
- This keeps thumbnail cache in sync

#### Steps

- [ ] 🟥 Write test: cleanup runs on app startup
- [ ] 🟥 Write test: cleanup removes orphaned thumbnails too
- [ ] 🟥 Integrate with `runAutoCleanup` in `handlers.ts`
- [ ] 🟥 Add orphan cleanup to sync completion callback
- [ ] 🟥 Add cleanup stats to logs
- [ ] 🟥 Add manual cleanup trigger to diagnostics UI (optional)

---

## Safety Measures

### Logging

Every deletion should be logged:

```
[image-cleanup] Deleted orphaned image: sdId=abc, imageId=xyz, age=21 days
```

### Dry Run Mode

For debugging/testing:

```typescript
async function cleanupOrphanedImages(
  sdId: string,
  options: { dryRun: boolean; gracePeriodDays: number }
): Promise<{ deleted: string[]; wouldDelete: string[] }>;
```

### Deletion Confirmation (Optional)

For sensitive deployments, could add a setting to require confirmation before bulk deletion. Not implementing now, but architecture should allow it.

---

## Handling Edge Cases

### Image Referenced in Deleted Note

- Deleted notes (soft delete) still exist in CRDT
- Their image references should still count
- Only after permanent deletion should image become orphan

**Solution:** Scan ALL notes, including soft-deleted ones.

### Image Referenced in Old History

- History reconstructions may reference images
- If we ever support "restore to point in time," images might be needed

**Decision:** Don't consider history. Cleanup only considers current state. Users can restore deleted notes within 30 days, which is > 14-day grace period.

### Concurrent Editing

- While cleanup runs, user might add/remove image references
- Grace period handles this (recent changes protected)

---

## Metrics to Track

For diagnostics/debugging:

```typescript
interface CleanupStats {
  sdId: string;
  totalImages: number;
  referencedImages: number;
  orphanedImages: number;
  deletedImages: number;
  skippedImages: number; // Within grace period
  thumbnailsDeleted: number;
  bytesReclaimed: number;
  timestamp: number;
}
```

#### Steps

- [ ] 🟥 Define and implement CleanupStats
- [ ] 🟥 Store recent cleanup stats for diagnostics
- [ ] 🟥 Show stats in diagnostics UI (optional)

---

## Testing Checklist

- [ ] Orphan detection correctly identifies unreferenced images
- [ ] Referenced images never deleted
- [ ] Images within grace period not deleted
- [ ] Images older than grace period deleted
- [ ] Soft-deleted note images still protected
- [ ] Thumbnails cleaned up with orphaned images
- [ ] Cleanup runs automatically on startup
- [ ] Cleanup integrates with sync completion
- [ ] Dry run mode works correctly
- [ ] Deletion logging works
- [ ] CI passes
