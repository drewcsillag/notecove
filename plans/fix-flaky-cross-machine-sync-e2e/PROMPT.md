Fix flaky cross-machine sync E2E tests

Problem

Several cross-machine sync E2E tests are flaky/failing:

1. cross-machine-sync-creation.spec.ts:83 - "should sync newly created note when Instance 2 launches after sync"
2. cross-machine-sync-updates.spec.ts - title/pin sync to running instance tests
3. cross-machine-sync-comments.spec.ts:396 - "comment sidebar should show synced comments"

Symptoms

- Tests use FileSyncSimulator to copy files between two SD directories with delays
- Files ARE synced (verified by inspectSDContents checks passing)
- But Instance 2 doesn't see the correct content/title when it launches or receives updates
- Example: Note shows "New Note" instead of "New Note Created By Instance 1"
- Smoke test (shared SD, no simulator) passes - basic sync works

Root Cause Hypothesis

The tests verify file presence but not file completeness before launching Instance 2:
// Only checks note IDs match, not file sizes/content
expect(sd2Contents.notes.map((n) => n.id).sort()).toEqual(
sd1Contents.notes.map((n) => n.id).sort()
);

The FileSyncSimulator may sync the initial note creation but queue later updates (title changes) that complete after Instance 2 launches.

Proposed Fix

1. Add file size/content verification to inspectSDContents checks before launching Instance 2
2. Wait for specific CRDT log sizes to match between SD1 and SD2
3. Consider using observable sync events from sync-wait-helpers.ts instead of arbitrary timeouts
4. For live sync tests, wait for activity sync completion events rather than fixed delays

Files to Investigate

- packages/desktop/e2e/utils/sync-simulator.ts - FileSyncSimulator implementation
- packages/desktop/e2e/utils/sync-wait-helpers.ts - Observable wait utilities (underutilized)
- packages/desktop/e2e/cross-machine-sync-creation.spec.ts
- packages/desktop/e2e/cross-machine-sync-updates.spec.ts
- packages/desktop/e2e/cross-machine-sync-comments.spec.ts
- packages/desktop/src/main/note-discovery.ts - How notes are imported on startup

Success Criteria

- All cross-machine sync tests pass consistently (not flaky)
- Tests should use observable events rather than arbitrary waitForTimeout calls where possible
