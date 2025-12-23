# Plan Critique

## Ordering: ✅ Good

The current ordering is correct:

1. Step 1 fixes the core bug (false positives)
2. Step 2 adds defense-in-depth (clear on success)
3. Steps 3-4 improve diagnostics (helps debug edge cases)
4. Step 5 is lower priority cosmetic fix

## Feedback Loop: ⚠️ Could Improve

**Current plan**: Write test → Implement → Test

**Better approach**: Add logging first to confirm theory, then implement fix:

1. Add temporary logging to see exactly when stale entries are created
2. Confirm the issue is what we think
3. Then implement fix

However, the evidence from the activity log (582 entries, seq 1-582) already confirms the theory, so we can proceed directly.

## Architecture Insight: ✅ Confirmed

The `checkCRDTLogExists` callback **already exists** and is properly wired up:

- Defined in `ActivitySyncCallbacks` (line 83-87)
- Implemented in `sd-watcher-callbacks.ts` (line 305-306)
- Calls `CRDTManager.checkCRDTLogExists()` which checks all log files for the expected sequence

The problem: It's only called during `pollAndReload()` (line 586-602), NOT during stale detection (lines 387-418).

**Fix is simple**: Add `checkCRDTLogExists` call before marking stale.

## Missing Items: ⚠️ Found Issues

### 1. Performance Concern

Calling `checkCRDTLogExists` for every activity entry with gap > 50 could be slow (disk I/O for each).

**Mitigation**: The check is already async and only happens for entries that would be marked stale (not all entries). This is acceptable.

### 2. Callback is Optional

`checkCRDTLogExists` is optional in the interface (`checkCRDTLogExists?:`). Need to handle the case where it's not provided.

**Fix**: If callback not provided, fall back to current behavior (mark as stale based on gap alone).

### 3. Test Coverage

Need to ensure tests cover:

- First-time sync of note with long history (false positive scenario)
- Actual missing CRDT data (true stale scenario)
- Callback not provided (fallback behavior)

## Risk Assessment: ✅ Low Risk

**Risk 1**: Hiding actual missing data

- **Mitigation**: Only skip stale marking if CRDT log EXISTS with the sequence. If file is missing, still mark stale.

**Risk 2**: Performance regression

- **Mitigation**: Only check for entries already flagged as potentially stale (gap > 50). Not all entries.

**Risk 3**: Breaking existing functionality

- **Mitigation**: TDD approach - write failing tests first, ensure existing tests still pass.

## Recommendation

**Simplify Phase 1**: The fix is straightforward - add one `checkCRDTLogExists` call before marking stale. Step 2 (clear on success) becomes unnecessary if Step 1 works correctly, but is good defense-in-depth.

**Defer Phase 3 if needed**: Enhanced diagnostics are useful but not critical. Could be a separate PR.

**Skip Phase 5 for now**: Hash normalization is cosmetic and lower priority.

## Updated Implementation Approach

```typescript
// In syncFromOtherInstances(), around line 391:
if (gap > STALE_SEQUENCE_GAP_THRESHOLD) {
  // NEW: Check if CRDT log already has this sequence
  if (this.callbacks.checkCRDTLogExists) {
    const hasData = await this.callbacks.checkCRDTLogExists(
      noteId,
      otherInstanceId,
      sequence // Use the current sequence, not highest
    );
    if (hasData) {
      // Not stale - we already have this data, just skip silently
      continue;
    }
  }

  // Only mark as stale if data truly missing
  // ... existing stale entry logic ...
}
```

Wait - actually, should we check if we have the CURRENT sequence, or if we have the HIGHEST sequence?

If we have seq 1, but are checking for seq 1 when highest is 582, we should check if we have seq 582 (the latest). If we have the latest, all earlier sequences are also present (they're in the same file).

**Better approach**: Check if CRDT log has the HIGHEST sequence for this note:

```typescript
if (gap > STALE_SEQUENCE_GAP_THRESHOLD) {
  if (this.callbacks.checkCRDTLogExists) {
    const hasLatest = await this.callbacks.checkCRDTLogExists(
      noteId,
      otherInstanceId,
      highestSeqForNote // Check for highest, not current
    );
    if (hasLatest) {
      // We have all data including this entry, skip silently
      continue;
    }
  }
  // ... mark as stale ...
}
```

This is more efficient - one check per note, not per entry.
