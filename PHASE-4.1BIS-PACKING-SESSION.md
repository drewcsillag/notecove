# Phase 4.1bis Phase 2: Packing Implementation Session

**Date:** 2025-11-04
**Status:** IN PROGRESS

## Goal

Implement pack file system to reduce file count by 90-95% (from 2000 files → 50-100 files). This improves cloud sync performance by batching 50-100 individual update files into pack files.

## Progress

### ✅ Completed

1. **Pack File Format Design** (commit: 6969e63)
   - Created `packages/shared/src/crdt/pack-format.ts`
   - Defined PackData, PackUpdateEntry, PackFileMetadata types
   - Implemented pack filename parsing/generation
   - Implemented pack file encode/decode with validation
   - Format: `<instance-id>_pack_<start-seq>-<end-seq>.yjson`

2. **Directory Structure**
   - Added `packs` path to NotePaths interface
   - Updated `getNotePaths()` to include packs directory
   - Updated `initializeNote()` to create packs directory
   - Added helper methods: `getPacksPath()`, `getPackFilePath()`

3. **Type Exports**
   - Exported pack format types from `crdt/index.ts`
   - All TypeScript builds passing ✅

### 🔄 In Progress

4. **Pack Creation Logic** - NEXT
   - Need to add methods to UpdateManager:
     - `listPackFiles()` - List pack files for a note
     - `readPackFile()` - Read and decode a pack file
     - `createPack()` - Create a pack from update files
     - `canPackUpdates()` - Check if updates are packable (contiguous sequences)

5. **Pack Loading** - TODO
   - Modify note loading in CRDTManager to:
     - Load best snapshot
     - Load pack files (filtered by vector clock)
     - Load unpacked updates
     - Apply in sequence order

6. **Background Packing Job** - TODO
   - Add periodic job to CRDTManager (every 5 minutes)
   - Group updates by instance-id
   - Pack updates older than 5 minutes
   - Keep last 50 updates unpacked
   - Atomic operations (write pack, then delete updates)

### ⏳ Remaining Tasks

7. **Unit Tests** - TODO
   - Pack file format parsing/generation
   - Pack encoding/decoding
   - Pack creation with gap handling
   - Pack loading and application
   - Background job scheduling

8. **Integration Testing** - TODO
   - Cold load with packs + updates
   - Multi-instance concurrent packing
   - File count verification (90-95% reduction)

9. **Performance Validation** - TODO
   - Measure cold load time (should not regress)
   - Measure file count before/after
   - Verify cloud sync improvement

## Architecture Notes

### Pack Format

```typescript
interface PackData {
  version: 1;
  instanceId: string;
  noteId: UUID;
  sequenceRange: [startSeq, endSeq]; // Inclusive
  updates: Array<{
    seq: number;
    timestamp: number;
    data: Uint8Array; // Yjs update data
  }>;
}
```

### Packing Algorithm

1. Background job runs every 5 minutes
2. For each note with many updates:
   - Group update files by instance-id
   - Sort by sequence number
   - Check for contiguous sequences (no gaps)
   - Pack updates older than 5 minutes
   - Keep last 50 updates unpacked
3. Atomic pack creation:
   - Write pack file
   - Delete original update files
   - Handle crashes (duplicates OK, CRDT convergence)

### Gap Handling

- Only pack up to first gap in sequence
- Leave updates after gap unpacked
- After 24h, treat gap as permanent (configurable)

### Loading Order

1. Load best snapshot (highest totalChanges)
2. Use snapshot's vector clock to filter packs
3. Load relevant packs (where pack.endSeq > snapshot.maxSeq[instance])
4. Load unpacked updates (where update.seq > snapshot.maxSeq[instance])
5. Apply all in sequence order per instance

## Files Modified

- `packages/shared/src/storage/types.ts` - Added packs path to NotePaths
- `packages/shared/src/storage/sd-structure.ts` - Added pack directory helpers
- `packages/shared/src/crdt/pack-format.ts` - New pack format implementation
- `packages/shared/src/crdt/index.ts` - Export pack format types

## Next Steps

1. Implement pack creation logic in UpdateManager
2. Implement pack loading in CRDTManager
3. Add background packing job
4. Write comprehensive unit tests
5. Test file count reduction
6. Verify performance (no regression)

## Session Commits

- `6969e63` - feat: Add pack file format and directory structure
- `1b9e67c` - docs: Update Phase 4.1bis status - Snapshots complete
- `0bd0f38` - test: Fix and unskip Settings and Note Count Badge E2E tests

---

**Session Status:** Active
**Ready to Continue:** Yes - Next task is pack creation logic in UpdateManager
