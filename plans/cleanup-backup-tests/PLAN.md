# Cleanup Backup Tests - Implementation Plan

**Overall Progress:** `80%`

## Summary

E2E backup tests are creating backups in the real user data directory instead of isolated temp directories. This causes hundreds of orphaned backup files to accumulate.

## Tasks

- [x] 🟩 **Step 1: Add TEST_BACKUP_DIR support in main/index.ts**
  - [x] 🟩 Add `TEST_BACKUP_DIR` environment variable check following existing pattern
  - [x] 🟩 Pass custom backup path to BackupManager constructor when set

- [x] 🟩 **Step 2: Update e2e tests to use isolated backup directory**
  - [x] 🟩 Add `TEST_BACKUP_DIR: backupDir` to env object in e2e/backup-restore.spec.ts
  - [x] 🟩 Verify cleanup in afterEach already handles backupDir (it does)

- [x] 🟩 **Step 3: Verify fix works**
  - [x] 🟩 Run backup e2e test and verify no new files in real backup location

- [x] 🟩 **Step 4: One-time cleanup of existing backups**
  - [x] 🟩 Delete all files in `~/Library/Application Support/@notecove/desktop/.backups/`
  - [x] 🟩 Delete `~/Library/Application Support/Electron/.backups/` directory

- [ ] 🟨 **Step 5: Run CI and commit**
  - [ ] 🟥 Run ci-runner to verify all tests pass
  - [ ] 🟥 Commit changes
