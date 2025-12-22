# Run CI and Fix Things

**Overall Progress:** `62.5%` (5/8 tests fixed)

## Summary

Started with 8 E2E test failures. Fixed 5 of them:

## Fixed Tests ✅

| # | Test | Fix Applied |
|---|------|-------------|
| 2-4 | `backup-restore.spec.ts` (3 tests) | Added `databasePath` parameter to BackupManager to support TEST_DB_PATH |
| 7 | `markdown-export.spec.ts` folder export | Fixed folder dialog selector + check files in subdirectory |
| 8 | `web-server.spec.ts` auth timeout | Simplified wait logic to check HTML content instead of DOM |

## Remaining Tests ❌

| # | Test File | Issue | Status |
|---|-----------|-------|--------|
| 1 | `auto-cleanup.spec.ts:165` | Note list empty after restart | Complex - possibly pre-existing |
| 5 | `cross-machine-sync-comments.spec.ts:384` | Comments not displaying | Complex - sync timing |
| 6 | `cross-machine-sync-deletion-sloppy.spec.ts:87` | Deletion not syncing | Complex - sync timing |

## Analysis of Remaining Failures

### Auto-cleanup test
- Test creates note, soft-deletes it, restarts app, checks Recently Deleted
- After restart, Recently Deleted shows 0 notes
- Issue: The deleted note's state isn't being preserved across restart
- Attempted fix: Added wait for note count to decrease before restart
- Root cause unclear - may be database persistence timing

### Cross-machine sync tests
- These are multi-instance tests simulating 2 machines sharing an SD
- Known to be potentially flaky (see test comments)
- May require deeper sync mechanism investigation
- Comments test: badge=0, sidebar=0 (comments not syncing)
- Deletion test: note not removed from Instance 2 after sync

## Files Changed

- `packages/desktop/src/main/backup-manager.ts` - Added databasePath param
- `packages/desktop/src/main/index.ts` - Pass TEST_DB_PATH to BackupManager
- `packages/desktop/e2e/auto-cleanup.spec.ts` - Wait for note count before restart
- `packages/desktop/e2e/markdown-export.spec.ts` - Fixed folder selector + subdir check
- `packages/desktop/e2e/web-server.spec.ts` - Simplified page load verification
