# Feature Implementation Plan: Stabilize Cross-Machine E2E Tests

**Overall Progress:** `60%` (3/5 tests fixed; 2 are bug reproduction tests)

## Summary

Analyzed 5 failing cross-machine sync e2e tests. Found that:

- 3 tests had the **same folder creation issue** we fixed in the note-\* tests (missing SD context)
- 2 tests are **bug reproduction tests** documenting real sync bugs in the application

## Tests Fixed (Folder Creation Issue)

These 3 tests had the same pattern as the note-\* tests - they tried to create folders without first clicking "All Notes" to set the active SD context.

| Test File                                   | Test Name                                                     | Fix Applied                                              |
| ------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| cross-machine-sync-creation.spec.ts:329     | should sync note folder move to RUNNING Instance 2            | Added SD context click + proper waits                    |
| cross-machine-sync-move-conflict.spec.ts:82 | should resolve concurrent moves deterministically             | Added SD context click + proper waits for both instances |
| cross-machine-sync-note-move.spec.ts:83     | should sync note move to folder from Instance A to Instance B | Added SD context click + proper waits                    |

All 3 tests now pass in isolation.

## Bug Reproduction Tests (Not Fixable with Test Changes)

These 2 tests document real bugs in the application's sync system:

| Test File                                     | Test Name                                   | Bug Description                                                            |
| --------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| cross-machine-sync-comments.spec.ts:384       | comment sidebar should show synced comments | Badge shows count but sidebar is empty - comment marks don't sync properly |
| cross-machine-sync-deletion-sloppy.spec.ts:87 | should sync note deletion to Instance 2     | Note deletion doesn't sync between instances                               |

These tests were failing in the original testlog and require application code fixes to the sync system, not test fixes. The tests themselves are correct - they expose bugs.

## Changes Made

1. **cross-machine-sync-creation.spec.ts**
   - Added click on "All Notes" to set SD context before folder creation
   - Added proper waits for dialog close and folder appearance

2. **cross-machine-sync-move-conflict.spec.ts**
   - Added click on "All Notes" for Instance 1 before folder A creation
   - Added click on "All Notes" for Instance 2 before folder B creation
   - Added proper waits for dialog close and folder appearance

3. **cross-machine-sync-note-move.spec.ts**
   - Added click on "All Notes" to set SD context before folder creation
   - Added proper waits for dialog close and folder appearance

4. **cross-machine-sync-comments.spec.ts**
   - Changed from fixed waits to retrying assertions (toHaveText, toHaveCount)
   - Test still fails because it documents a real bug

5. **cross-machine-sync-deletion-sloppy.spec.ts**
   - Changed from fixed waits to retrying assertions (not.toBeVisible)
   - Test still fails because it documents a real bug

## Key Pattern: Folder Creation Requirements

Folder creation in NoteCove requires:

1. An active SD context (set by clicking a folder like "All Notes")
2. Proper waits for dialog lifecycle (`state: 'hidden'`)
3. Proper waits for folder appearance in tree

## Verification

Ran each fixed test in isolation:

- cross-machine-sync-note-move: ✅ PASS
- cross-machine-sync-creation (folder move): ✅ PASS
- cross-machine-sync-move-conflict: ✅ PASS
- cross-machine-sync-comments (sidebar): ❌ FAIL (documents real bug)
- cross-machine-sync-deletion-sloppy: ❌ FAIL (documents real bug)
