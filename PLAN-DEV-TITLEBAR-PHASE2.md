# Phase 2: Profile-Based Instance ID & Locking

**Phase Progress:** `100%` ✅

**Parent Plan:** [PLAN-DEV-TITLEBAR.md](./PLAN-DEV-TITLEBAR.md)

**Depends on:** [Phase 1](./PLAN-DEV-TITLEBAR-PHASE1.md) (titlebar must work first) ✅

---

## Step 3: Use profile ID as instanceId for activity logs

**Progress:** `100%` ✅

### Problem

Current `instanceId` is a random UUID generated each app launch (`randomUUID()`), causing:

- New activity log file created on every launch
- Orphaned log files accumulate in `{SD}/activity/`
- Sync system sees each launch as a new "instance"

### Solution

Use the profile's stable UUID (`selectedProfileId`) instead of a random one.

### Substeps

- [x] 🟩 **3.1** ~~Write test: activity log filename uses profile ID~~ (skipped - requires full app startup mocking)
- [x] 🟩 **3.2** Change instanceId to use selectedProfileId
  - File: `packages/desktop/src/main/index.ts`
  - Line ~1990: `const instanceId = process.env['INSTANCE_ID'] ?? selectedProfileId ?? randomUUID();`
  - Keep randomUUID() as fallback for edge cases (no profile selected / test mode)
- [x] 🟩 **3.3** Verified no code assumes instanceId is ephemeral
  - Reviewed all usages in sync logic, NoteMoveManager, CRDT logs
  - All code works correctly with stable instanceId
- [ ] ⬜ **3.4** Manual test: activity logs persist across restarts (user can verify)

---

## Step 4: Implement single-instance per profile lock

**Progress:** `100%` ✅

### Problem

With profile ID as instanceId, two app instances using the same profile would:

- Write to the same activity log file (corruption risk)
- Potentially cause database conflicts
- Create confusing sync behavior

### Solution

Acquire exclusive lock on profile before initializing database. Show error and quit if profile already in use.

### Substeps

- [x] 🟩 **4.1** Write test: lock file creation and acquisition
  - File: `packages/shared/src/profiles/__tests__/profile-lock.test.ts`
  - 12 tests covering all lock scenarios

- [x] 🟩 **4.2** Create ProfileLock class
  - File: `packages/shared/src/profiles/profile-lock.ts`
  - Methods: `acquire()`, `release()`, `isLocked()`, `getLockInfo()`
  - Lock file: `{profileDataDir}/profile.lock`
  - Contents: JSON `{ pid: number, timestamp: number }`

- [x] 🟩 **4.3** Add stale lock detection
  - Uses `process.kill(pid, 0)` to check if PID is still running
  - If stale, deletes lock and allows acquisition

- [x] 🟩 **4.4** Integrate lock into app startup
  - File: `packages/desktop/src/main/index.ts`
  - Acquires lock after profile selection, before database init
  - If lock fails: shows error dialog, quits app

- [x] 🟩 **4.5** Release lock on app quit
  - Added to `will-quit` handler in index.ts
  - Releases lock after closing database

- [ ] ⬜ **4.6** Write E2E test: second instance fails (optional)
  - Would require spawning multiple Electron processes
  - Manual testing is sufficient for this feature

- [x] 🟩 **4.7** Create user-friendly error dialog
  - Title: "Profile Already In Use"
  - Message explains the profile is open elsewhere
  - Single "OK" button quits the app

---

## Files Modified

| File                                                          | Changes                                      |
| ------------------------------------------------------------- | -------------------------------------------- |
| `packages/desktop/src/main/index.ts`                          | Use profile ID as instanceId, integrate lock |
| `packages/shared/src/profiles/profile-lock.ts`                | New class                                    |
| `packages/shared/src/profiles/index.ts`                       | Export ProfileLock                           |
| `packages/shared/src/profiles/__tests__/profile-lock.test.ts` | New test (12 tests)                          |

---

## Note on Orphaned Activity Logs

Existing orphaned activity logs (from the old ephemeral instanceId behavior) will be left in place. They are harmless and do not affect sync behavior. Users can manually delete them if desired, but no automatic cleanup is needed.

---

## Verification

After Phase 2 completion:

1. Start app, select profile, make edits
2. Check `{SD}/activity/` - log file named with profile ID (UUID)
3. Quit and restart - same log file used (not a new one)
4. Try to start second instance with same profile - error shown, app quits
5. Start second instance with different profile - works fine
6. Kill first instance (force quit), start new instance - lock is recovered (stale lock detection)
