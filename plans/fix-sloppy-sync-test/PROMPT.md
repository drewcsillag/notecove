Prompt for Sloppy Sync Test Fix

Fix the remaining flaky e2e test: e2e/cross-machine-sync-deletion-sloppy.spec.ts:249

## Problem Description

The test "should sync deleted notes with sloppy sync" fails intermittently because Instance 2 loads CRDT log files before they're fully synced by FileSyncSimulator.

## Root Cause Analysis (from previous investigation)

1. FileSyncSimulator does partial syncs of CRDT log files (50% chance, 30-70% of file content)
2. Instance 2's ActivitySync detects new activity log entries via file watcher
3. ActivitySync loads the corresponding CRDT file to get note content
4. But the CRDT file is only partially synced at that moment
5. Instance 2 loads a truncated CRDT state and misses final content

Evidence from debugging:

- CRDT file grows from 4870 bytes to 8178 bytes
- Instance 2 only sees 4870 bytes at load time
- The truncated file is valid (doesn't trigger corruption detection) but incomplete

## Key Files

- `packages/desktop/e2e/cross-machine-sync-deletion-sloppy.spec.ts` - The failing test
- `packages/desktop/e2e/utils/sync-simulator.ts` - FileSyncSimulator with partial sync logic
- `packages/shared/src/storage/activity-sync.ts` - ActivitySync that loads CRDT files
- `packages/desktop/src/main/crdt-manager.ts` - CRDTManager that reads CRDT logs

## Potential Fix Approaches

1. **Atomic CRDT file sync in simulator**: Ensure CRDT log files are always synced completely before activity log files (activity logs reference the CRDT content)

2. **File size verification in ActivitySync**: Activity log entries contain metadata - add expected CRDT file size and verify before loading

3. **Retry logic in CRDTManager**: If loaded CRDT sequence is incomplete, retry after a short delay

4. **Completion markers**: Add a completion marker file that FileSyncSimulator writes only after a file is fully synced

## Constraints

- The fix should work for real cloud sync scenarios, not just the simulator
- Real cloud services (iCloud, Dropbox) can also have partial file states during sync
- Avoid polling/busy-waiting which would impact performance

## Expected Outcome

The test should pass reliably. The solution should handle partial file states gracefully, which benefits real-world usage too.

---

Summary of work completed:

- Fixed 4 of 5 flaky tests (80% complete)
- Discovered parseActivityFilename ID length bug causing self-processing
- Fixed file watcher filter to use proper activity log parsing
- Documented the sloppy sync issue with detailed root cause analysis
- Committed all changes to fix-flaky-sync-tests branch
