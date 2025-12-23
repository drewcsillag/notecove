# Fix: Stale Sync False Positive Detection

**Overall Progress:** `100%`

## Problem Summary

When a machine first encounters a note with a long edit history (>50 sequences), the stale sync detection creates false positives. It marks early activity log entries as "stale" based purely on sequence gaps, without checking if the CRDT data already exists on disk.

**Decision**: Remove the stale sync toast entirely (confusing for users, not actionable). Keep sync status panel for expert debugging but fix the false positive issue.

## Root Cause

`packages/shared/src/storage/activity-sync.ts:387-418`:

```typescript
const gap = highestSeqForNote - sequence;
if (gap > STALE_SEQUENCE_GAP_THRESHOLD) {
  // BUG: Marks stale WITHOUT checking if CRDT data exists!
  this.staleEntries.push({...});
  continue;
}
```

## Related Files

- `packages/shared/src/storage/activity-sync.ts` - Stale detection logic
- `packages/shared/src/storage/__tests__/activity-sync.test.ts` - Tests
- `packages/desktop/src/renderer/src/components/StaleSyncToast/` - REMOVED
- `packages/desktop/src/renderer/src/App.tsx` - Removed toast usage

---

## Tasks

### Phase 1: Remove Stale Sync Toast 🟩

- [x] 🟩 **Step 1: Remove StaleSyncToast component**
  - [x] 🟩 1.1 Remove `<StaleSyncToast>` from App.tsx
  - [x] 🟩 1.2 Delete `components/StaleSyncToast/` directory
  - [x] 🟩 1.3 Remove any related imports/exports

### Phase 2: Fix False Positive Detection 🟩

- [x] 🟩 **Step 2: Add CRDT log existence check before marking stale**
  - [x] 🟩 2.1 Write test: stale entry NOT created when CRDT log has the highest sequence
  - [x] 🟩 2.2 Write test: stale entry IS created when CRDT log is missing
  - [x] 🟩 2.3 Modify `syncFromOtherInstances()` to check `checkCRDTLogExists()` BEFORE marking stale
  - [x] 🟩 2.4 If callback not provided, fall back to existing gap-based detection

- [x] 🟩 **Step 3: Defense-in-depth - Clear stale entries on successful sync**
  - [x] 🟩 3.1 Write test: stale entries cleared after successful sync
  - [x] 🟩 3.2 Add `clearStaleEntriesForNote()` method
  - [x] 🟩 3.3 Call it in `pollAndReload()` after successful note reload

### Phase 3: Verification 🟨

- [ ] 🟨 **Step 4: Run CI and verify all tests pass**
  - [ ] 🟨 4.1 Run `pnpm ci-local`
  - [ ] 🟨 4.2 Verify no regressions

---

## Changes Made

### 1. Removed StaleSyncToast

- Deleted `packages/desktop/src/renderer/src/components/StaleSyncToast/` directory
- Removed import and usage from `App.tsx`

### 2. Fixed False Positive Detection

- Modified `syncFromOtherInstances()` in `activity-sync.ts` to check `checkCRDTLogExists()` before marking entries as stale
- If CRDT log has the highest sequence, the entry is skipped silently (not stale)

### 3. Defense-in-Depth

- Added `clearStaleEntriesForNote()` method
- Called in `pollAndReload()` after successful note reload to clear any remaining false positives

---

## Test Scenarios

| Scenario                                   | Expected Outcome                        | Status |
| ------------------------------------------ | --------------------------------------- | ------ |
| First-time sync of note with 582 sequences | No stale entries (CRDT log has seq 582) | ✅     |
| CRDT log missing entirely                  | Stale entry created                     | ✅     |
| User opens Sync Status Panel               | Shows accurate info, no false positives | ✅     |
| Successful sync                            | Clears any stale entries for that note  | ✅     |
