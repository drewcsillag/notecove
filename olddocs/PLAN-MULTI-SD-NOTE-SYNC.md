# Implementation Plan: Multi-SD Note Sync

## Overview

Fix note synchronization across instances for non-default Storage Directories by making the note storage architecture SD-aware.

## Current Architecture Problem

```
┌─────────────┐
│  Instance 1 │
│             │
│ Default SD  │◄────┐
│  (works)    │     │
│             │     │
│ Second SD   │     │   Single UpdateManager
│ (broken)────┼─────┼──► points to Default SD
│             │     │
└─────────────┘     │
                    │
┌─────────────┐     │
│  Instance 2 │     │
│             │     │
│ Default SD  │◄────┘
│  (works)    │
│             │
│ Second SD   │
│ (broken)    │
│             │
└─────────────┘
```

**Problem**: All notes write to/read from the default SD path, regardless of their actual SD.

## Target Architecture

```
┌─────────────┐
│  Instance 1 │
│             │
│ Default SD  │◄────► SD-aware UpdateManager
│  (works)    │       ├─ Default SD path
│             │       └─ Second SD path
│ Second SD   │◄────►/
│  (works)    │
│             │
└─────────────┘

┌─────────────┐
│  Instance 2 │
│             │
│ Default SD  │◄────► SD-aware UpdateManager
│  (works)    │       ├─ Default SD path
│             │       └─ Second SD path
│ Second SD   │◄────►/
│  (works)    │
│             │
└─────────────┘
```

## Implementation Phases

### Phase 1: Data Layer (UpdateManager/Storage) ⚠️ BREAKING CHANGES

**Goal**: Make UpdateManager support multiple SDs

**Changes Required**:

1. **Modify UpdateManager to be multi-SD**
   - File: `packages/shared/src/storage/update-manager.ts`
   - Add SD path lookup method
   - Change constructor to not require SyncDirectoryStructure
   - Add method: `setStorageDirectory(sdId: string, path: string): void`
   - Update `writeNoteUpdate` to lookup SD path by noteId's sdId
   - Update `readNoteUpdates` to use correct SD path

2. **Create SD Registry**
   - New file: `packages/desktop/src/main/storage/sd-registry.ts`

   ```typescript
   export class StorageDirectoryRegistry {
     private sdPaths = new Map<string, string>();

     register(sdId: string, path: string): void;
     get(sdId: string): string | undefined;
     getAll(): Map<string, string>;
   }
   ```

3. **Update initialization in main/index.ts**
   - Create SDRegistry
   - Load all SDs from database on startup
   - Register each SD with UpdateManager
   - Listen for SD creation events and register new SDs

**Testing**:

- Unit tests for SD Registry
- Unit tests for UpdateManager with multiple SDs
- Integration test: Write note to SD1, verify file in SD1 path
- Integration test: Write note to SD2, verify file in SD2 path

**Estimated Complexity**: Medium (50-80 lines)

---

### Phase 2: CRDT Layer ⚠️ API CHANGES

**Goal**: Make CRDT Manager track SD for each note

**Changes Required**:

1. **Modify DocumentState type**
   - File: `packages/desktop/src/main/crdt/types.ts`
   - Add `sdId: string` to DocumentState interface

2. **Update CRDT Manager**
   - File: `packages/desktop/src/main/crdt/crdt-manager.ts`
   - Modify `loadNote` to accept optional `sdId` parameter
   - Extract sdId from note metadata when loading
   - Store sdId in DocumentState
   - Use sdId when calling UpdateManager methods

3. **Add helper method**

   ```typescript
   private async getNoteSdId(noteId: string): Promise<string> {
     // Try to get from loaded document
     const state = this.documents.get(noteId);
     if (state?.sdId) return state.sdId;

     // Load first update to read metadata
     const updates = await this.updateManager.readNoteUpdates(noteId);
     if (updates.length > 0) {
       const tempDoc = new NoteDoc(noteId);
       Y.applyUpdate(tempDoc.doc, updates[0]);
       const metadata = tempDoc.getMetadata();
       tempDoc.destroy();
       return metadata.sdId;
     }

     return 'default'; // Fallback
   }
   ```

**Testing**:

- Unit test: Load note with sdId, verify tracked correctly
- Unit test: Load note without sdId, verify extraction from metadata
- Integration test: Note operations use correct SD

**Estimated Complexity**: Medium (60-100 lines)

---

### Phase 3: IPC Layer

**Goal**: Pass SD information through the stack

**Changes Required**:

1. **No API changes needed!**
   - `handleCreateNote` already receives `sdId` parameter
   - `initializeNote` already stores `sdId` in metadata
   - CRDT Manager will extract sdId from metadata

2. **Update note creation flow**
   - File: `packages/desktop/src/main/ipc/handlers.ts`
   - In `handleCreateNote`: Pass sdId to `loadNote` (when Phase 2 complete)
   ```typescript
   await this.crdtManager.loadNote(noteId, sdId); // Add sdId param
   ```

**Testing**:

- E2E test: Create note in SD2, verify written to SD2 path
- E2E test: Load note from SD2, verify read from SD2 path

**Estimated Complexity**: Low (5-10 lines)

---

### Phase 4: File Watching

**Goal**: Monitor all SDs for cross-instance changes

**Changes Required**:

1. **Create per-SD file watchers**
   - File: `packages/desktop/src/main/index.ts`
   - Store watchers in Map: `Map<sdId, FileWatcher>`
   - Create function: `setupSDWatcher(sdId: string, sdPath: string)`
   - Call for each SD on startup
   - Call when new SD created

2. **Watch SD note directories**

   ```typescript
   async function setupSDNoteWatcher(sdId: string, sdPath: string) {
     const activityDir = join(sdPath, '.activity');
     const watcher = new NodeFileWatcher();

     await watcher.watch(activityDir, (event) => {
       // Sync logic (same as current activityWatcher)
       void activitySync.syncFromOtherInstances(sdId);
     });

     sdWatchers.set(sdId, watcher);
   }
   ```

3. **Update ActivitySync**
   - File: `packages/shared/src/storage/activity-sync.ts`
   - Add optional `sdId` parameter to `syncFromOtherInstances`
   - If provided, only sync that SD
   - If not provided, sync all SDs (backward compatible)

**Testing**:

- Integration test: Create SD, verify watcher created
- E2E test: Create note in SD2 instance1, verify appears in instance2
- E2E test: Update note in SD2 instance1, verify syncs to instance2

**Estimated Complexity**: Medium (40-60 lines)

---

### Phase 5: Activity Logging

**Goal**: Track activity per SD

**Changes Required**:

1. **Multi-SD activity logs**
   - Current: Single activity log per instance
   - Target: Activity log per (instance, SD) pair
   - File structure: `.activity/{instanceId}-{sdId}.log`

2. **Update ActivityLogger**
   - File: `packages/shared/src/storage/activity-logger.ts`
   - Add `sdId` to log entries
   - Change log filename to include sdId
   - Update `recordNoteActivity` to include sdId

3. **Update ActivitySync**
   - Parse sdId from activity log filenames
   - Route updates to correct SD

**Testing**:

- Unit test: Activity logged with correct sdId
- Unit test: Activity read filters by sdId correctly
- Integration test: Multi-SD activity logging

**Estimated Complexity**: Medium (50-70 lines)

---

## Migration Strategy

### Backward Compatibility

**For existing notes in default SD:**

- Notes without explicit sdId in filename → assume 'default'
- Activity logs without sdId → assume 'default'
- No data migration required

**For existing multi-SD setups:**

- Notes in wrong location stay there (orphaned)
- New notes go to correct location
- Users can manually move orphaned notes if needed

### Rollout Plan

1. **Phase 1-2**: Internal testing only
   - Breaking changes to storage layer
   - Test thoroughly before proceeding

2. **Phase 3-4**: Feature complete
   - All E2E tests should pass
   - Ready for alpha testing

3. **Phase 5**: Performance optimization
   - Can be done post-launch if needed
   - Improves efficiency but not required for correctness

## Testing Strategy

### Unit Tests

- UpdateManager SD routing
- CRDT Manager sdId tracking
- SD Registry operations
- Activity logging with sdId

### Integration Tests

- Write/read notes from multiple SDs
- File watchers for multiple SDs
- Activity sync across SDs

### E2E Tests

- ✅ Already exist: `e2e/multi-sd-cross-instance.spec.ts`
- Should PASS after implementation
- Add: Note content sync test
- Add: Multiple simultaneous SD operations

### Regression Tests

- Default SD still works
- Single-SD usage unaffected
- Folder sync still works
- Cross-instance sync for default SD

## Risk Assessment

| Risk                      | Probability | Impact   | Mitigation                                     |
| ------------------------- | ----------- | -------- | ---------------------------------------------- |
| Break existing default SD | Medium      | High     | Extensive testing, feature flag                |
| Performance degradation   | Low         | Medium   | Profile before/after, optimize watchers        |
| Data loss                 | Low         | Critical | Backup recommendation, read-only testing phase |
| Incomplete migration      | Medium      | Medium   | Clear documentation, migration tools           |

## Success Criteria

✅ **Phase 1-2 Complete When:**

- Unit tests pass for UpdateManager with multiple SDs
- Integration tests show notes written to correct SD paths

✅ **Phase 3-4 Complete When:**

- E2E test "Bug 1: Note title sync" PASSES
- E2E test "Bug 2: Note creation sync" PASSES
- E2E test "Bug 3: Folder sync" still PASSES (no regression)

✅ **Project Complete When:**

- All E2E tests pass
- No regressions in default SD behavior
- Documentation updated
- Performance acceptable (< 10% overhead per additional SD)

## Timeline Estimate

- **Phase 1**: 3-4 hours (data layer)
- **Phase 2**: 2-3 hours (CRDT layer)
- **Phase 3**: 1 hour (IPC layer)
- **Phase 4**: 2-3 hours (file watching)
- **Phase 5**: 2-3 hours (activity logging)
- **Testing/Debug**: 3-4 hours
- **Documentation**: 1 hour

**Total**: 14-20 hours of development time

## Next Steps

1. Review this plan with team
2. Create feature branch: `feature/multi-sd-note-sync`
3. Implement Phase 1 with TDD
4. Run integration tests before proceeding to Phase 2
5. Continue incrementally through phases
6. Merge when all E2E tests pass

## References

- E2E Tests: `packages/desktop/e2e/multi-sd-cross-instance.spec.ts`
- Known Issues: `packages/desktop/KNOWN-ISSUES.md`
- Current Architecture: `packages/desktop/src/main/index.ts` (lines 320-540)
