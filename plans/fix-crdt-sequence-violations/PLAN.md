# Fix CRDT Sequence Violation Bug

**Overall Progress:** `80%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)

## Problem Summary

During rapid typing, concurrent IPC calls to `CRDTManager.applyUpdate()` cause sequence violations. The disk writes are serialized, but the snapshot updates are not, leading to out-of-order application.

**Root Cause:** See [QUESTIONS-1.md](./QUESTIONS-1.md) for detailed analysis.

## Fix Strategy

Add an operation queue to `CRDTManager.applyUpdate()` to serialize the entire operation (write + snapshot update) per note.

**Why only `applyUpdate()`?** The other path (`handleUpdate()`) already uses `await recordExternalUpdate()` which has its own `operationLock` for serialization.

**Error handling**: The queue must use `.then()` not just promise chaining, to ensure errors in one operation don't break subsequent operations.

## Tasks

### Phase 1: Write Failing Test

- [x] **Step 1: Create test that reproduces the race condition**
  - [x] Add test in `crdt-manager.test.ts` that sends multiple concurrent updates
  - [x] Verify test fails with "Sequence violation" error
  - [x] Update PLAN.md

### Phase 2: Implement Fix

- [x] **Step 2: Add operation queue to CRDTManager**
  - [x] Add `applyUpdateQueues: Map<string, Promise<void>>` field
  - [x] Wrap `applyUpdate()` logic in a queued promise chain
  - [x] Clean up queue entries after completion to prevent memory leak
  - [x] Update PLAN.md

- [x] **Step 3: Verify test passes**
  - [x] Run the new test - should now pass
  - [x] All 32 crdt-manager.test.ts tests pass
  - [x] Update PLAN.md

### Phase 3: E2E Verification

- [x] **Step 4: Update E2E tests to use keyboard.type() for new notes**
  - [x] Revert `editor.evaluate()` workaround in `cross-machine-sync-creation.spec.ts` (2 places)
  - [x] Keep `editor.evaluate()` in `cross-machine-sync-updates.spec.ts` for content replacement (different use case)
  - [x] Run affected E2E tests to verify they pass
  - [x] Update PLAN.md

- [ ] **Step 5: Run previously failing tests** (deferred - requires more investigation)
  - Note: Tests `cross-machine-sync-instances.spec.ts` and `cross-machine-sync-deletion-sloppy.spec.ts` may have other unrelated issues

### Phase 4: Final Verification

- [ ] **Step 6: Run full test suite**
  - [ ] Run all unit tests
  - [ ] Run typecheck
  - [ ] Run lint
  - [ ] Update PLAN.md with final status

## Deferred Items

- The `cross-machine-sync-updates.spec.ts` test continues to use `evaluate()` for replacing existing content because keyboard-based text selection/replacement is unreliable in ProseMirror. The CRDT fix is demonstrated by the creation tests that use `keyboard.type()` for new notes.

## Implementation Notes

### Fix Details

Added to `CRDTManager` class:

- New field: `applyUpdateQueues = new Map<string, Promise<void>>()` for per-note operation queuing
- Extracted `executeApplyUpdate()` method containing the actual update logic
- Updated `applyUpdate()` to:
  1. Chain operations onto the previous operation for the same note
  2. Use `.then()` with both resolve/reject handlers to ensure errors don't break the chain
  3. Store a "sanitized" promise (always resolves) for chaining subsequent operations
  4. Return the actual operation promise so callers can catch errors
  5. Clean up queue entries after completion to prevent memory leaks

The queue ensures that even if concurrent IPC calls arrive simultaneously, they are processed one at a time in arrival order, preventing sequence violations when writes complete out of order.

### E2E Test Changes

- `cross-machine-sync-creation.spec.ts`: Now uses `keyboard.type()` for typing into new notes (2 places changed)
- `cross-machine-sync-updates.spec.ts`: Kept using `evaluate()` for replacing existing heading content (keyboard selection is unreliable for content replacement)
