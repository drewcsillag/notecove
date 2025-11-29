# Phase 2: Profile-Based Instance ID & Locking

**Phase Progress:** `0%`

**Parent Plan:** [PLAN-DEV-TITLEBAR.md](./PLAN-DEV-TITLEBAR.md)

**Depends on:** [Phase 1](./PLAN-DEV-TITLEBAR-PHASE1.md) (titlebar must work first)

---

## Step 3: Use profile ID as instanceId for activity logs

**Progress:** `0%`

### Problem

Current `instanceId` is a random UUID generated each app launch (`randomUUID()`), causing:

- New activity log file created on every launch
- Orphaned log files accumulate in `{SD}/activity/`
- Sync system sees each launch as a new "instance"

### Solution

Use the profile's stable UUID (`selectedProfileId`) instead of a random one.

### Substeps

- [ ] 🟥 **3.1** Write test: activity log filename uses profile ID
  - File: `packages/desktop/src/main/__tests__/activity-log-profile-id.test.ts`
  - Test: ActivityLogger uses profile ID, not random UUID
  - Test: Same profile ID produces same log filename across restarts

- [ ] 🟥 **3.2** Change instanceId to use selectedProfileId
  - File: `packages/desktop/src/main/index.ts`
  - Location: Line ~1988
  - Change: `const instanceId = process.env['INSTANCE_ID'] ?? randomUUID();`
  - To: `const instanceId = process.env['INSTANCE_ID'] ?? selectedProfileId ?? randomUUID();`
  - Note: Keep randomUUID() as fallback for edge cases (no profile selected)

- [ ] 🟥 **3.3** Verify no code assumes instanceId is ephemeral
  - Review usages of instanceId in sync logic
  - Ensure no code relies on "different instanceId = different app launch"

- [ ] 🟥 **3.4** Manual test: activity logs persist across restarts
  - Start app with profile, make edits, quit
  - Verify activity log exists with profile ID as filename
  - Start app again with same profile
  - Verify same activity log file is used (appended to)

---

## Step 4: Implement single-instance per profile lock

**Progress:** `0%`

### Problem

With profile ID as instanceId, two app instances using the same profile would:

- Write to the same activity log file (corruption risk)
- Potentially cause database conflicts
- Create confusing sync behavior

### Solution

Acquire exclusive lock on profile before initializing database. Show error and quit if profile already in use.

### Substeps

- [ ] 🟥 **4.1** Write test: lock file creation and acquisition
  - File: `packages/shared/src/profiles/__tests__/profile-lock.test.ts`
  - Tests:
    - Lock file created on acquire
    - Lock file contains PID
    - Second acquire fails if lock held
    - Lock released on release()
    - Stale lock (dead PID) can be stolen

- [ ] 🟥 **4.2** Create ProfileLock class
  - File: `packages/shared/src/profiles/profile-lock.ts`
  - Methods:
    - `acquire(profileDataDir: string): Promise<boolean>`
    - `release(): Promise<void>`
    - `isLocked(profileDataDir: string): Promise<boolean>`
  - Lock file: `{profileDataDir}/profile.lock`
  - Contents: JSON `{ pid: number, timestamp: number }`

- [ ] 🟥 **4.3** Add stale lock detection
  - Check if PID in lock file is still running
  - On macOS/Linux: `process.kill(pid, 0)` throws if process doesn't exist
  - On Windows: Use different check or skip (simpler for now)
  - If stale, delete lock and allow acquisition

- [ ] 🟥 **4.4** Integrate lock into app startup
  - File: `packages/desktop/src/main/index.ts`
  - Location: After profile selection, before database init
  - If lock fails: show error dialog, quit app

- [ ] 🟥 **4.5** Release lock on app quit
  - File: `packages/desktop/src/main/index.ts`
  - Add handler: `app.on('will-quit', () => profileLock.release())`
  - Also handle: `app.on('before-quit')` for safety

- [ ] 🟥 **4.6** Write E2E test: second instance fails
  - File: `packages/desktop/e2e/single-instance.spec.ts`
  - Test: Start app, then try to start second with same profile
  - Verify: Second instance shows error and quits

- [ ] 🟥 **4.7** Create user-friendly error dialog
  - Message: "Profile Already In Use"
  - Body: "The profile '{name}' is already open in another NoteCove window. Please close that window first."
  - Button: "OK" (quits app)

---

## Files Modified

| File                                                                  | Changes                                      |
| --------------------------------------------------------------------- | -------------------------------------------- |
| `packages/desktop/src/main/index.ts`                                  | Use profile ID as instanceId, integrate lock |
| `packages/shared/src/profiles/profile-lock.ts`                        | New class                                    |
| `packages/shared/src/profiles/index.ts`                               | Export ProfileLock                           |
| `packages/shared/src/profiles/__tests__/profile-lock.test.ts`         | New test                                     |
| `packages/desktop/src/main/__tests__/activity-log-profile-id.test.ts` | New test                                     |
| `packages/desktop/e2e/single-instance.spec.ts`                        | New E2E test                                 |

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
