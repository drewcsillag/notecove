# Phase 1: On-Demand Image Discovery & Registration

**Progress: 100%** ✅

**Parent:** [PLAN.md](./PLAN.md)

**Decisions Applied:**

- Q2: Cross-SD fallback enabled (check all SDs if primary fails)
- Q5: Use upsert for race condition handling

## Problem

When `handleImageGetDataUrl` is called for a synced image:

1. It queries `database.getImage(imageId)`
2. Returns `null` because the image isn't registered (only the file exists on disk)
3. Returns "image not found" even though the file exists

## Solution

When database lookup fails, scan the SD's `media/` directory for matching file, register it, then return the data. If not found in specified SD, check all other registered SDs as fallback.

## Tasks

### 1.1 Write Failing Test for Bug

- [ ] 🟥 Create test that demonstrates the bug: image file exists on disk but `getDataUrl` returns null
- [ ] 🟥 Test should:
  - Create an SD in test
  - Manually place an image file in `{SD}/media/` (simulating sync)
  - Call `handleImageGetDataUrl`
  - Assert it currently returns `null` (confirming the bug)

### 1.2 Add Image Discovery Function

- [ ] 🟥 Write tests for new `discoverImageOnDisk` function in `image-storage.ts`:
  - Given imageId, scan media directory for `{imageId}.*`
  - Return `{ filename, mimeType, size }` if found, `null` if not
  - Handle multiple extensions (png, jpg, gif, webp, svg, heic, heif)
  - Validate imageId format to prevent path traversal (security)
  - Accept both UUID format (old) and hex format (new/Phase 4)
- [ ] 🟥 Implement `discoverImageOnDisk` function
- [ ] 🟥 Verify tests pass

### 1.3 Add Cross-SD Discovery Function

- [ ] 🟥 Write tests for `discoverImageAcrossSDs` function:
  - Takes imageId and primary sdId
  - First checks primary SD
  - If not found, iterates through all other registered SDs
  - Returns `{ sdId, sdPath, filename, mimeType, size }` or null
  - Logs warning if found in different SD than specified
- [ ] 🟥 Implement function
- [ ] 🟥 Verify tests pass

### 1.4 Update `handleImageGetDataUrl` with Fallback

- [ ] 🟥 Write test: image not in DB but on disk → should return data URL and register image
- [ ] 🟥 Write test: image in different SD than specified → should find it and return data URL
- [ ] 🟥 Modify `handleImageGetDataUrl` in `handlers.ts`:
  ```
  1. Try database lookup (existing)
  2. If null, call discoverImageAcrossSDs
  3. If found, register in database via upsertImage
  4. Read file and return data URL
  ```
- [ ] 🟥 Verify the original failing test now passes

### 1.4.1 Early Manual Verification (Feedback Loop)

- [ ] 🟥 **CHECKPOINT**: Test the core fix with actual problematic note
- [ ] 🟥 Start the app, navigate to note `2d1c99c5-70ef-4da8-8d8f-7b68e716a301`
- [ ] 🟥 Verify image `a6f78e16-5bbf-4a19-9e7a-9cd3d62276cf` displays
- [ ] 🟥 If not working, debug before proceeding further

### 1.5 Update `handleThumbnailGet` with Same Fallback

- [ ] 🟥 Write test: thumbnail generation for unregistered image should work
- [ ] 🟥 Apply same fallback pattern to `handleThumbnailGet`
- [ ] 🟥 Verify tests pass

### 1.6 Update Other Image Handlers (if needed)

- [ ] 🟥 Review these handlers for same pattern:
  - `handleImageGetPath`
  - `handleImageExists`
  - `handleImageGetMetadata`
- [ ] 🟥 Add fallback where appropriate
- [ ] 🟥 Add tests for each modified handler

### 1.7 Code Review - Phase 1

- [ ] 🟥 Launch subagent to review Phase 1 implementation
- Review checklist:
  - **Bugs**: Race conditions between discovery and registration? (mitigated by upsert)
  - **Edge cases**: Image deleted mid-operation? Invalid file content? Corrupt images?
  - **Error handling**: File read failures, database write failures, permission errors
  - **Test coverage**: All new code paths tested? Cross-SD fallback tested?
  - **Project patterns**: Follows existing handler patterns? Consistent error handling?
  - **Performance**: Multiple disk scans if called rapidly? Cross-SD iteration performance?
  - **Security**: Path traversal in imageId? Validate imageId format before disk scan
  - **Phase 2 reuse**: Is `discoverImageOnDisk` easily reusable for startup scan?
  - **Phase 4 ready**: Does `isValidImageId` accept both UUID and hex formats?

### 1.8 Final Manual Verification

- [ ] 🟥 Full app restart and test with the problematic note
- [ ] 🟥 Verify image displays correctly
- [ ] 🟥 Check database: image should now be registered
- [ ] 🟥 Verify thumbnail generation works

### 1.9 Commit Phase 1

- [ ] 🟥 Run CI (`pnpm ci-local`)
- [ ] 🟥 Commit with message: `fix: discover and register synced images on-demand`

## Design Notes

### ImageId Validation (Phase 4 Ready)

```typescript
function isValidImageId(id: string): boolean {
  // UUID format (old images)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Hex format (new images after Phase 4)
  const hexRegex = /^[0-9a-f]{32}$/i;
  return uuidRegex.test(id) || hexRegex.test(id);
}
```

### Discovery Function Signatures

```typescript
interface DiscoveredImage {
  filename: string; // e.g., "abc123.png"
  mimeType: string; // e.g., "image/png"
  size: number; // file size in bytes
}

// Single SD discovery (used by Phase 2)
async function discoverImageOnDisk(
  sdPath: string,
  imageId: string
): Promise<DiscoveredImage | null>;

// Cross-SD discovery (used by handlers)
interface CrossSDDiscoveryResult extends DiscoveredImage {
  sdId: string;
  sdPath: string;
}

async function discoverImageAcrossSDs(
  database: Database,
  imageId: string,
  primarySdId: string
): Promise<CrossSDDiscoveryResult | null>;
```

### Cross-SD Discovery Logic

```typescript
async function discoverImageAcrossSDs(...) {
  // 1. Try primary SD first
  const primarySD = await database.getStorageDir(primarySdId);
  if (primarySD) {
    const result = await discoverImageOnDisk(primarySD.path, imageId);
    if (result) {
      return { ...result, sdId: primarySdId, sdPath: primarySD.path };
    }
  }

  // 2. Try all other SDs as fallback
  const allSDs = await database.getAllStorageDirs();
  for (const sd of allSDs) {
    if (sd.id === primarySdId) continue; // Already tried

    const result = await discoverImageOnDisk(sd.path, imageId);
    if (result) {
      console.warn(`[Image] Found image ${imageId} in SD ${sd.id} instead of ${primarySdId}`);
      return { ...result, sdId: sd.id, sdPath: sd.path };
    }
  }

  return null;
}
```
