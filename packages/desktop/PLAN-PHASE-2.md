# Phase 2: Startup Media Directory Scan & Media Watcher Enhancement

**Progress: 100%** ✅

**Parent:** [PLAN.md](./PLAN.md)

**Dependencies:** Phase 1 (reuses `discoverImageOnDisk` function)

**Decisions Applied:**

- Q1: Media watcher should register images (not just broadcast)
- Q4: Background scan (non-blocking startup)
- Q5: Use upsert for race condition handling
- Q6: Add storage inspector enhancement for image debugging

## Problem

1. When the app starts, images that synced while the app was closed remain unregistered until someone tries to view them
2. When images sync while the app is running, the media watcher broadcasts events but doesn't register images

## Solution

1. On SD load, scan `media/` directory in background and register unregistered images
2. Update media watcher to register images when detected (not just broadcast)
3. Add storage inspector image debugging capabilities

## Tasks

### 2.1 Write Tests for Media Scan Function

- [x] 🟩 Create tests for new `scanAndRegisterMedia` function:
  - Scans `{SD}/media/` directory
  - For each image file, checks if registered in database
  - Registers unregistered images (reuses `discoverImageOnDisk` from Phase 1)
  - Returns count of newly registered images
  - Handles empty media directory gracefully
  - Handles non-existent media directory gracefully
  - Uses upsert to handle race conditions

### 2.2 Implement `scanAndRegisterMedia`

- [x] 🟩 Add function to new `media-sync.ts` module (better organization)
- [x] 🟩 Function signature: `scanAndRegisterMedia(sdId: string, sdPath: string, database: Database): Promise<number>`
- [x] 🟩 Reuse `discoverImageOnDisk` and `ImageStorage.parseImageFilename` from Phase 1
- [x] 🟩 Verify tests pass

### 2.3 Integrate Background Scan into SD Initialization

- [x] 🟩 Write integration test: SD setup should discover existing images (non-blocking)
- [x] 🟩 Call `scanAndRegisterMedia` in `setupWatchersForSD` (in `index.ts`)
- [x] 🟩 Run as background task (don't await, use `void` prefix)
- [x] 🟩 Log results: `[Init] Discovered N synced images in SD: {sdId}`
- [x] 🟩 Verify test passes

### 2.4 Integrate into Runtime SD Addition

- [x] 🟩 Write test: Adding new SD via UI discovers existing images
- [x] 🟩 Call `scanAndRegisterMedia` in `onStorageDirCreated` callback
- [x] 🟩 Verify test passes

### 2.5 Update Media Watcher to Register Images

- [x] 🟩 Write test: New image file in media directory → should be registered in database
- [x] 🟩 Modify media watcher in `index.ts` (lines 1589-1623):
  ```
  Current: Broadcasts 'image:available' event
  New: Also registers image in database via upsertImage
  ```
- [x] 🟩 Keep broadcasting event (UI still needs it for immediate refresh)
- [x] 🟩 Use upsert to handle race with startup scan
- [x] 🟩 Verify test passes

### 2.6 Add Storage Inspector Image Debugging

- [x] 🟩 Write test: Storage inspector should show image sync status
- [x] 🟩 Add to storage inspector service:
  - List images on disk vs in database
  - Show discrepancies (on disk but not in DB, in DB but not on disk)
  - Show image metadata (size, mimeType, registration date)
- [ ] ⏭️ Update storage inspector UI to display image info (deferred - backend is complete)
- [x] 🟩 Verify test passes

### 2.7 Code Review - Phase 2

- [x] 🟩 Launch subagent to review Phase 2 implementation
- Review checklist:
  - **Bugs**: Race with media watcher? Double registration? (mitigated by upsert) ✅
  - **Edge cases**: Very large media directories? Thousands of images? ⚠️ (noted, not blocking)
  - **Error handling**: Partial scan failures? Should continue on single file error? ✅
  - **Test coverage**: All paths tested? Empty/missing directory cases? ✅
  - **Project patterns**: Consistent with existing SD initialization flow? ✅
  - **Performance**: Background scan doesn't block startup? Memory usage for large scans? ✅
  - **Logging**: Appropriate log levels? Not too verbose? ✅
  - **Code reuse**: Properly sharing code with Phase 1? ✅
  - **Storage inspector**: UI usable for debugging? ✅ (backend complete)

### 2.8 Commit Phase 2

- [x] 🟩 Run CI (`pnpm ci-local`)
- [x] 🟩 Commit with message: `feat: scan media on startup, register images from media watcher`

## Design Notes

### Background Scan Implementation

```typescript
// In setupWatchersForSD
void scanAndRegisterMedia(sdId, sdPath, database)
  .then((count) => {
    if (count > 0) {
      console.log(`[Init] Discovered ${count} synced images in SD: ${sdId}`);
    }
  })
  .catch((error) => {
    console.error(`[Init] Failed to scan media for SD ${sdId}:`, error);
  });
```

### Media Watcher Enhancement

```typescript
// Current (index.ts ~line 1608)
console.log(`[MediaWatcher ${sdId}] Image file available:`, { imageId, filename });
for (const window of BrowserWindow.getAllWindows()) {
  window.webContents.send('image:available', { sdId, imageId, filename });
}

// New: Add registration before broadcast
const filePath = path.join(mediaDir, filename);
const stats = await fs.stat(filePath);
const mimeType = ImageStorage.getMimeTypeFromExtension(extension);

if (mimeType) {
  await database.upsertImage({
    id: imageId,
    sdId,
    filename,
    mimeType,
    size: stats.size,
    created: Date.now(),
  });
  console.log(`[MediaWatcher ${sdId}] Registered synced image:`, { imageId, filename });
}

// Then broadcast as before
for (const window of BrowserWindow.getAllWindows()) {
  window.webContents.send('image:available', { sdId, imageId, filename });
}
```

### Storage Inspector Image View

New section in storage inspector showing:

```
Images in SD: {sdName}
─────────────────────────
On Disk: 15 images (45.2 MB)
In Database: 13 images

Discrepancies:
  ⚠️ On disk but not in DB: 2
    - abc123.png (1.2 MB)
    - def456.jpg (2.3 MB)

  ❌ In DB but not on disk: 0
```
