# Questions for Fixing Flaky Sync Tests

## Analysis Summary

I've analyzed all 5 failing tests and identified the root causes:

### Test Categories

1. **Cross-machine sync tests** (3 tests):
   - `e2e/cross-machine-sync-deletion-sloppy.spec.ts:249`
   - `e2e/cross-machine-sync-instances.spec.ts:86`
   - `e2e/cross-machine-sync-instances.spec.ts:251`

2. **Multi-SD cross-instance test** (1 test):
   - `e2e/multi-sd-cross-instance.spec.ts:906` - "Bug 11: Editor should show edits from other instance without reloading note"

3. **Tags test** (1 test):
   - `e2e/tags.spec.ts:419` - "should remove tags from index when deleted from note"

### Root Causes Identified

#### Issue 1: FileSyncSimulator Partial Sync Leaves Corrupted Files

The FileSyncSimulator uses `partialSyncProbability` (set to 0.3 in the test) to simulate cloud sync behavior. It:

1. Writes a partial file (e.g., 50-90% of bytes)
2. Schedules a completion to write the full file later

**Problem**: When `stop()` is called, it clears all pending syncs including partial completions:

```typescript
// Clear all pending syncs
for (const timeout of this.pendingSyncs.values()) {
  clearTimeout(timeout);
}
```

This means:

- Partially synced files never get completed
- The sequence validator reads truncated log files
- Garbage sequence numbers like `-113490161` appear in the output

#### Issue 2: Sequence Validation Doesn't Handle Truncated Files

The `parseCRDTLogSequences` function reads whatever bytes are available and interprets them as varint-encoded sequences. On truncated files, it reads garbage:

```
Sequence gap at index 2: expected 3, got 40
Sequence gap at index 4: expected 113, got -113490161
```

The validator should:

- Detect truncated files (partial reads)
- Skip validation for files that are still being synced
- Or wait for sync completion before validating

#### Issue 3: Tags Test Isolation Issue

The tags test (`e2e/tags.spec.ts:419`) passes in isolation but fails when run with other tests. Error seen:

```
Failed to apply update for note: Sequence violation for instance ...: expected 1, got 20
```

This suggests test pollution - leftover state from previous tests affecting subsequent tests.

## Questions

### Q1: Sync Completion Strategy

For the FileSyncSimulator partial sync issue, I see two approaches:

**Option A: Complete all pending syncs before stop()**

- Modify `stop()` to complete all pending partial syncs before stopping
- Pro: Ensures files are always in a valid state at test end
- Con: Increases test duration

**Option B: Skip validation for files that aren't fully synced**

- Modify the sequence validator to detect and skip truncated files
- Pro: Faster, more realistic simulation of real cloud sync
- Con: Doesn't catch real sequence bugs in partial files

Which approach do you prefer? I'm leaning toward **Option A** because:

1. The tests are already using long timeouts (up to 35s waits)
2. We want to validate that sequences ARE correct after sync completes
3. This is a bug in the test infrastructure, not the production code

Agree with A

### Q2: Tags Test Isolation

For the tags test, I have two options:

**Option A: Fix the test isolation**

- Identify what state is bleeding between tests
- Add proper cleanup/reset between tests

**Option B: Skip deeper investigation if it passes when run alone**

- The test passes in isolation (verified)
- Mark as flaky and add to retry policy

Which do you prefer? I'm leaning toward **Option A** since you mentioned "they fail pretty reliably" - there may be a real issue.

Agree with A

### Q3: Multi-SD Live Sync Test (Bug 11)

This test checks that editor content syncs live between instances without needing to reload the note. The test might be:

- A timing issue (not waiting long enough for sync)
- A real bug in the live sync implementation
- An issue with the test's FileSyncSimulator not triggering file watchers properly

Should I:
**A**: Investigate the actual live sync implementation to see if there's a bug
**B**: Focus on the test infrastructure (timing, simulator) first

I'm leaning toward **B** since the other sync tests have simulator-related issues.

Agree B, but don't rule out A

## No Questions About

- **Website documentation**: This is a test fix, no user-facing changes
- **Scope**: Clear - fix these 5 specific tests
- **TDD**: Not applicable since we're fixing tests, not production code
