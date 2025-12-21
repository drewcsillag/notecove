# Questions for Cleanup Backup Tests

## Findings

I found the issue:

1. **Unit tests (`backup-manager.test.ts`)** - These are fine. They use `tmpdir()` to create isolated test directories and clean them up in `afterEach`.

2. **E2E tests (`backup-restore.spec.ts`)** - These are the problem. They:
   - Create a `backupDir` variable in `beforeEach` pointing to a temp directory
   - But the app never actually uses this directory - the test only sets `TEST_DB_PATH`, `TEST_STORAGE_DIR`, and `TEST_CONFIG_PATH`
   - The BackupManager is initialized with `app.getPath('userData')` which is `~/Library/Application Support/@notecove/desktop/`
   - So backups get created in the real location: `~/Library/Application Support/@notecove/desktop/.backups`

3. **Current backup count**: ~448 backups in `~/Library/Application Support/@notecove/desktop/.backups`

## Proposed Solution

1. Add `TEST_BACKUP_DIR` environment variable support in `main/index.ts` (following the existing pattern)
2. Pass this to the BackupManager constructor
3. Update e2e tests to pass `TEST_BACKUP_DIR` pointing to the temp directory they already create
4. Add cleanup logic in `afterEach` to delete the temp backup directory (already exists, just not used)
5. Delete the existing 448 backups as a one-time fix

## Questions

1. **Confirmation**: Does the solution approach sound correct? Essentially making e2e tests use their own isolated backup directory like they do for db/storage/config.

That sounds perfecct.

2. **Deletion scope**: Should I delete ALL entries in `~/Library/Application Support/@notecove/desktop/.backups/` and also `~/Library/Application Support/Electron/.backups/` (which appears empty but exists)?

Yes
