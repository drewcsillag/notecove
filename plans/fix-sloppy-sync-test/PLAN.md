# Fix Sloppy Sync Test - Implementation Plan

**Overall Progress:** `60%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)

**Questions & Answers:** [QUESTIONS-1.md](./QUESTIONS-1.md)

## Summary

Fix the failing e2e test `cross-machine-sync-deletion-sloppy.spec.ts:249` by fixing a logic bug in `checkCRDTLogExists()`. This is a production fix (not simulator-only) because the test exists to verify behavior under unlikely but possible real-world conditions.

## Status

### ✅ Completed: Truncated File Detection Fix

The original logic bug in `checkCRDTLogExists()` has been fixed:

**OLD (buggy):**
```typescript
if (!hasExpectedSeq && hasIncompleteFile) {
  return false;
}
return hasExpectedSeq;
```

**NEW (fixed):**
```typescript
if (hasIncompleteFile) {
  return false;
}
return hasExpectedSeq;
```

- Unit tests pass (3 new tests for truncated file handling)
- The fix IS working - logs show truncation detection and proper retries:
  ```
  [CRDT Manager] checkCRDTLogExists: log file ... incomplete/truncated
  [CRDT Manager] checkCRDTLogExists(...): checked 1 files, highestSeq=0, ready=false (some files incomplete)
  ```
- Eventually files complete and syncs succeed:
  ```
  [ActivitySync] SUCCESS on attempt 5 for note default-note, sequence sloppy-instance-1_4
  [ActivitySync] SUCCESS on attempt 1 for note default-note, sequence sloppy-instance-1_91
  ```

### ⚠️ Issue Discovered: Content Still Incorrect After Reload

Even after successful sync (sequence 91 found), the content is wrong:

```
[CRDT Manager] After reload, content length: 24 → 1
[SloppySync] Instance 2 content: Final Title After Sloppy Sync 1767281421881
[SloppySync] Instance 2 has all content: false
```

The content goes from 24 chars (demo content) to 1 char. The delete operation is applied, but the insert operations don't result in expected content (~60 chars for title + 2 lines).

**Analysis:**
1. Delete operation (seq 4) is applied → removes demo content
2. Insert operations (seq 5-91) should add new content
3. But final content is only 1 char (probably just a newline/paragraph marker)

This suggests there may be an issue with:
1. How partial syncs affect CRDT operation ordering/integrity
2. CRDT merge behavior when operations arrive out of order
3. Something specific to how FileSyncSimulator interacts with CRDT files

This is a separate bug from the truncation detection fix.

## Tasks

### Step 1: Write Failing Test ✅
- [x] 🟩 Add unit test for `checkCRDTLogExists` that creates truncated file
- [x] 🟩 Test verifies `checkCRDTLogExists` returns `false` even when expected sequence found
- [x] 🟩 Run test - fails (confirms bug)

### Step 2: Fix the Logic Bug ✅
- [x] 🟩 Modify `checkCRDTLogExists` in `crdt-manager.ts`
- [x] 🟩 Change `if (!hasExpectedSeq && hasIncompleteFile)` to `if (hasIncompleteFile)`
- [x] 🟩 Run unit tests - all pass

### Step 3: Verify E2E Test Passes ⚠️
- [ ] 🟨 Run the sloppy sync test - **STILL FAILING**
- [ ] 🟥 Investigate secondary issue with content not syncing correctly

### Step 4: Run Full Verification
- [ ] 🟥 Pending resolution of Step 3

## Files Modified

1. `packages/desktop/src/main/crdt/crdt-manager.ts` - Fixed checkCRDTLogExists logic
2. `packages/desktop/src/main/crdt/__tests__/crdt-manager.test.ts` - Added 3 tests

## Next Steps (Need User Input)

The truncation detection fix is complete and working. However, there's a secondary issue:

**Options:**
1. **Commit current fix** - The truncation detection improvement is valuable on its own for production robustness
2. **Investigate further** - The content not syncing correctly is a separate bug that may need deeper investigation into CRDT operations or FileSyncSimulator behavior
3. **Skip this test for now** - Mark as known issue and investigate later

What would you like to do?
