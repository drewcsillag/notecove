# Phase 4: Content-Addressable Storage for New Images

**Progress: 100%** ✅

**Parent:** [PLAN.md](./PLAN.md)

**Dependencies:** None (but verify Phase 1 discovery is ID-format agnostic)

**Decisions Applied:**

- Q3: Use full hex string (32 chars, no dashes): `a1b2c3d4e5f67890abcdef1234567890`

## Problem

Currently, images are identified by random UUIDs. Pasting the same image twice creates two separate files.

## Solution

Use content hash (SHA-256, truncated to 128 bits, hex format) as image ID. This provides:

- Automatic deduplication (same content = same ID = same file)
- Content verification capability
- Idempotent saves

**Scope:** Clean break - only new images use hashes. No migration of existing UUID-based images.

**Format:** 32-character lowercase hex string (no dashes)

- Example: `a1b2c3d4e5f67890abcdef1234567890`
- Distinguishable from UUIDs (which have dashes and are 36 chars)

## Tasks

### 4.1 Create Content Hashing Utility

- [x] 🟩 Write tests for `hashImageContent` function:
  - Input: `Uint8Array` of image data
  - Output: 32-char hex string
  - Same input always produces same output
  - Different inputs produce different outputs
- [x] 🟩 Implement in `image-storage.ts`:
  ```typescript
  async function hashImageContent(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    // Use first 16 bytes (128 bits) as hex string
    return Array.from(hashArray.slice(0, 16))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Result: "a1b2c3d4e5f67890abcdef1234567890" (32 chars)
  ```
- [x] 🟩 Verify tests pass (6 tests for hashing)

### 4.2 Update `saveImage` to Use Content Hash

- [x] 🟩 Write test: Saving same image twice returns same imageId
- [x] 🟩 Write test: Saving same image twice doesn't create duplicate file
- [x] 🟩 Write test: Different images get different imageIds
- [x] 🟩 Modify `saveImage` in `image-storage.ts`:
  ```
  1. Hash the content to get imageId
  2. Check if file already exists (dedup)
  3. If exists, return existing imageId (no write needed)
  4. If not, write file and return imageId
  ```
- [x] 🟩 Verify tests pass (5 new tests for content-addressable storage)
- [x] 🟩 Removed unused `generateUuid()` function

### 4.3 Update Database Registration for Dedup

- [x] 🟩 Write test: Saving duplicate image doesn't create duplicate DB entry
- [x] 🟩 In `handleImageSave`, check if image already registered before upsert
- [x] 🟩 Return existing imageId if already registered
- [x] 🟩 Verify test passes

### 4.4 Update Image Download Handler

- [x] 🟩 Write test: Downloading same URL twice returns same imageId (content-addressed dedup)
- [x] 🟩 Apply same dedup logic to `handleImageDownloadAndSave`
- [x] 🟩 Verify test passes

### 4.5 Update Image Pick Handler

- [x] 🟩 Write test: Picking same file twice returns same imageId (content-addressed dedup)
- [x] 🟩 Apply same dedup logic to `handleImagePickAndSave`
- [x] 🟩 Verify test passes

### 4.6 Verify Phase 1 Compatibility

- [x] 🟩 Test: Discovery works for hash-based image IDs (32-char hex) - existing test in image-storage.test.ts
- [x] 🟩 Ensure `isValidImageId` validation accepts new format - already implemented in Phase 1
- [x] 🟩 Verify existing UUID-based images still work - existing test in image-storage.test.ts
- [x] 🟩 Test mixed content (old UUIDs + new hashes) in same SD - supported by `isValidImageId` accepting both formats

### 4.7 Code Review - Phase 4

- [x] 🟩 Launch subagent to review Phase 4 implementation
- Review findings addressed:
  - **H2**: Added crypto.subtle availability check with helpful error message
  - **M1**: Added validation to reject empty image data
  - **M4**: Added validation to reject invalid custom imageId (path traversal protection)
  - **L1**: Improved documentation with collision probability calculation
  - **H1**: Hash collision verification NOT added (see note below)
- Tests added for new validation behaviors (4 new tests)
- All existing tests updated to use valid UUID format IDs

**Note on H1 (hash collision verification):** Deferred. With 128-bit hashes, collision probability is ~1 in 3.4×10^38. The cost of re-hashing every file on save outweighs the theoretical benefit. Filesystem corruption is better handled by backup/recovery systems.

### 4.8 Commit Phase 4

- [x] 🟩 Run CI (`pnpm ci-local`) - All tests passed (360 E2E + unit tests)
- [x] 🟩 Commit with message: `feat: use content-addressable storage for new images`

## Design Notes

### Hash Format (Decision: Option A)

**Chosen format:** 32-character lowercase hex string

```
a1b2c3d4e5f67890abcdef1234567890
```

**Why this format:**

- Clearly distinguishable from UUIDs (no dashes, different length)
- No validity concerns (not pretending to be a UUID)
- Simple to generate and validate
- Same collision resistance (128 bits)

### ID Validation (Updated for Phase 1)

```typescript
function isValidImageId(id: string): boolean {
  // UUID format (old images) - 36 chars with dashes
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Hex format (new images) - 32 chars, no dashes
  const hexRegex = /^[0-9a-f]{32}$/i;
  return uuidRegex.test(id) || hexRegex.test(id);
}
```

### Dedup Logic in `saveImage`

```typescript
async saveImage(data: Uint8Array, mimeType: string): Promise<SaveImageResult> {
  // Hash content to get deterministic ID
  const id = await hashImageContent(data);
  const extension = ImageStorage.getExtensionFromMimeType(mimeType)!;
  const filename = `${id}.${extension}`;
  const filePath = this.getImagePath(id, mimeType);

  // Check if file already exists (dedup)
  if (await this.fs.exists(filePath)) {
    console.log(`[Image] Dedup: image ${id} already exists`);
    return { imageId: id, filename };
  }

  // Write new file
  await this.initializeMediaDir();
  await this.fs.writeFile(filePath, data);

  return { imageId: id, filename };
}
```

### Collision Probability

With 128 bits of SHA-256:

- Birthday paradox: ~2^64 images needed before 50% collision probability
- At 1 million images/day: would take ~50 billion years
- Effectively zero risk in practice

### Backwards Compatibility

| Image Type | ID Format                              | Length | Example                                |
| ---------- | -------------------------------------- | ------ | -------------------------------------- |
| Old (UUID) | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | 36     | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| New (Hash) | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`     | 32     | `a1b2c3d4e5f67890abcdef1234567890`     |

Both formats work with:

- File loading (just filename lookup)
- Database lookup (just ID lookup)
- Discovery (Phase 1 validates both formats)
