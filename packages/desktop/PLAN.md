# Image Sync & Storage Improvements Plan

**Overall Progress: 25%**

**Branch:** `fix/image-sync-discovery`

## Summary

This plan addresses three related issues discovered during investigation of "image not found" errors for synced images:

1. **Primary**: Synced images exist on disk but aren't registered in the database
2. **Secondary**: Dual SD ID files (`.sd-id` and `SD_ID`) with conflicting UUIDs
3. **Enhancement**: Switch to content-addressable storage (hash-based IDs) for new images

## Questions - All Resolved

See [QUESTIONS-PLAN-1.md](./plans/image-sync-discovery/QUESTIONS-PLAN-1.md) for full details.

| Question                       | Decision                                         |
| ------------------------------ | ------------------------------------------------ |
| Q1: Media watcher registration | **B** - Register images when detected            |
| Q2: Cross-SD image references  | **B** - Check all SDs as fallback                |
| Q3: Hash format                | **A** - Full hex string (32 chars, no dashes)    |
| Q4: Startup scan               | **B** - Background (non-blocking)                |
| Q5: Race conditions            | **A** - Use upsert (database handles duplicates) |
| Q6: Debug tooling              | **Storage inspector** enhancement                |

## Phase Overview

| Phase                        | Description                                | Status    | Dependencies                      |
| ---------------------------- | ------------------------------------------ | --------- | --------------------------------- |
| [Phase 1](./PLAN-PHASE-1.md) | On-demand image discovery & registration   | 🟩 Done   | None                              |
| [Phase 2](./PLAN-PHASE-2.md) | Startup scan + media watcher enhancement   | 🟥 To Do  | Reuses Phase 1 discovery function |
| [Phase 3](./PLAN-PHASE-3.md) | Unify SD ID files (switch to `SD_ID`)      | 🟥 To Do  | Independent                       |
| [Phase 4](./PLAN-PHASE-4.md) | Content-addressable storage for new images | 🟥 To Do  | Phase 1 must support hex format   |

## Staff Engineer Review Notes

### Ordering Analysis

- **Phase 1 → Phase 2**: Correct. Phase 2 reuses `discoverImageOnDisk` from Phase 1.
- **Phase 3**: Independent, can run in parallel or any order.
- **Phase 4**: Independent, but Phase 1's `isValidImageId` must accept both UUID and hex formats from the start.

### Key Decisions Impact

- **Cross-SD fallback (Q2)**: Added `discoverImageAcrossSDs` function to Phase 1
- **Media watcher (Q1)**: Phase 2 now includes media watcher enhancement
- **Hex format (Q3)**: Phase 4 uses simple 32-char hex, Phase 1 validates both formats
- **Background scan (Q4)**: Phase 2 scan is non-blocking
- **Storage inspector (Q6)**: Added to Phase 2 for debugging support

### Risk Assessment

1. **Race conditions**: Low risk - using upsert
2. **Cross-SD iteration**: Low risk - typically 1-3 SDs
3. **Hash collisions**: Negligible risk (128 bits)

## Tasks

### Phase 1: On-Demand Image Discovery & Registration

- [x] 🟩 See [PLAN-PHASE-1.md](./PLAN-PHASE-1.md) - Complete

### Phase 2: Startup Scan & Media Watcher Enhancement

- [ ] 🟥 See [PLAN-PHASE-2.md](./PLAN-PHASE-2.md)

### Phase 3: Unify SD ID Files

- [ ] 🟥 See [PLAN-PHASE-3.md](./PLAN-PHASE-3.md)

### Phase 4: Content-Addressable Storage

- [ ] 🟥 See [PLAN-PHASE-4.md](./PLAN-PHASE-4.md)

## Key Files

| File                                             | Purpose                                     |
| ------------------------------------------------ | ------------------------------------------- |
| `packages/desktop/src/main/ipc/handlers.ts`      | Image IPC handlers (getDataUrl, save, etc.) |
| `packages/shared/src/storage/image-storage.ts`   | Image storage layer                         |
| `packages/desktop/src/main/database/database.ts` | Database operations, SD creation            |
| `packages/desktop/src/main/index.ts`             | App init, media watcher setup               |
| `packages/shared/src/storage/sd-uuid.ts`         | SD_ID file management                       |
| `packages/desktop/src/main/storage-inspector/`   | Storage inspector (Phase 2 enhancement)     |

## Success Criteria

1. Images synced from other machines display correctly without manual intervention
2. Single SD ID file (`SD_ID`) used consistently across codebase
3. New images use content-based hashes for automatic deduplication
4. Storage inspector shows image sync status for debugging
5. All existing tests pass, new tests cover the changes
