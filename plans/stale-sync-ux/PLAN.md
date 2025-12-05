# Stale Sync UX & Non-Blocking Startup

**Overall Progress:** `55%`

## Summary

When activity log entries reference CRDT sequences that will never arrive (due to cloud sync failures, crashes, etc.), startup can block for 44+ seconds per stale entry. This plan addresses:

1. **Non-blocking startup** - Show app immediately, sync in background
2. **Profile presence files** - Identify which device/user wrote each activity log
3. **Stale sync UI** - Toast + Tools menu panel to show sync status and let users take action
4. **Export diagnostics** - Support tool for debugging sync issues

## Subsidiary Documents

- [Profile Presence Design](./PROFILE-PRESENCE.md)
- [Stale Sync UI Design](./STALE-SYNC-UI.md)

---

## Tasks

### Phase 1: Non-Blocking Startup Sync ✅ COMPLETE

- [x] 🟢 **Step 1: Make initial sync non-blocking**
  - [x] 🟢 1.1 Write test: app window shows while sync is pending
  - [x] 🟢 1.2 Move `waitForPendingSyncs()` to after window creation
  - [x] 🟢 1.3 Add background sync status tracking
  - [x] 🟢 1.4 Broadcast sync-complete event when background sync finishes

- [x] 🟢 **Step 2: Add sync status indicator** ✅ COMPLETE
  - [x] 🟢 2.1 Add IPC for sync status (pending count, notes affected)
  - [x] 🟢 2.2 Add subtle spinner/indicator in UI when syncs pending
  - [x] 🟢 2.3 Write e2e tests for sync status IPC and indicator visibility

### Phase 2: Profile Presence Files ✅ COMPLETE

- [x] 🟢 **Step 3: Define profile presence schema**
  - [x] 🟢 3.1 Create TypeScript types for profile presence
  - [x] 🟢 3.2 Add to SD structure: `{SD}/profiles/{profileId}.json`

- [x] 🟢 **Step 4: Write presence file on significant events**
  - [x] 🟢 4.1 Write test: presence file created on first SD connect
  - [x] 🟢 4.2 Write test: presence file updated when @user changes
  - [x] 🟢 4.3 Implement presence writer (first connect, setting changes, version upgrade)
  - [x] 🟢 4.4 Detect hostname change on startup

- [x] 🟢 **Step 5: Read and cache presence files**
  - [x] 🟢 5.1 Write test: presence info cached in local DB
  - [x] 🟢 5.2 Write test: partial/corrupt JSON uses cached value
  - [x] 🟢 5.3 Implement presence reader with fallback to cache
  - [x] 🟢 5.4 Add DB table for cached profile presence

### Phase 3: Stale Sync Detection

- [x] 🟢 **Step 6: Detect stale activity entries** ✅ COMPLETE
  - [x] 🟢 6.1 Write test: entry with large sequence gap detected as stale
  - [x] 🟢 6.2 Define stale threshold (STALE_SEQUENCE_GAP_THRESHOLD = 50)
  - [x] 🟢 6.3 Skip stale entries immediately instead of retrying 10x
  - [x] 🟢 6.4 Track stale entries for UI display (getStaleEntries method)

- [x] 🟢 **Step 7: Self-heal own stale entries** ✅ COMPLETE
  - [x] 🟢 7.1 Write test: own stale entry auto-cleaned on detection
  - [x] 🟢 7.2 If sourceInstanceId === ownInstanceId AND entry is stale, delete it
  - [x] 🟢 7.3 Log self-healing action for debugging
  - [x] 🟢 7.4 cleanupOwnStaleEntries() method implemented

- [ ] 🟡 **Step 8: Expose stale sync state to renderer** (IN PROGRESS)
  - [x] 🟢 8.1 Add IPC types: StaleSyncEntry interface defined
  - [ ] 🟡 8.2 Add IPC handlers: getStaleSyncs, skipStaleEntry, retryStaleEntry
  - [ ] 🟥 8.3 Add preload API and renderer type definitions
  - [ ] 🟥 8.4 Include profile presence info in stale sync data

### Phase 4: Stale Sync Toast

- [ ] 🟥 **Step 9: Add toast notification for pending syncs**
  - [ ] 🟥 9.1 Write test: toast appears when stale syncs detected
  - [ ] 🟥 9.2 Create toast component with sync summary
  - [ ] 🟥 9.3 Toast format: "Waiting for sync from @drew's MacBook (2 notes)"
  - [ ] 🟥 9.4 Click toast opens Sync Status panel

### Phase 5: Sync Status Panel (Tools Menu)

- [ ] 🟥 **Step 10: Add Tools → Sync Status menu item**
  - [ ] 🟥 10.1 Add menu item to Tools menu
  - [ ] 🟥 10.2 Create SyncStatusPanel component

- [ ] 🟥 **Step 11: Implement sync status table**
  - [ ] 🟥 11.1 Display columns: Note, From, Last Activity, Gap, Status, Actions
  - [ ] 🟥 11.2 Show profile info (name, @user, hostname) from presence cache
  - [ ] 🟥 11.3 Derive "last seen" from latest activity log timestamp
  - [ ] 🟥 11.4 Show "(info may be outdated)" if presence file is stale

- [ ] 🟥 **Step 12: Implement actions**
  - [ ] 🟥 12.1 "Skip" button - accept data loss, update watermark
  - [ ] 🟥 12.2 "Retry" button - force immediate retry
  - [ ] 🟥 12.3 Confirmation dialog for Skip action

### Phase 6: Export Diagnostics

- [ ] 🟥 **Step 13: Add export diagnostics feature**
  - [ ] 🟥 13.1 Add "Export Diagnostics" button to Sync Status panel
  - [ ] 🟥 13.2 Collect: stale sync state, activity logs, profile presence, app version
  - [ ] 🟥 13.3 Package as JSON/ZIP for support upload
  - [ ] 🟥 13.4 Redact sensitive note content (titles only, no body)

---

## Success Criteria

1. App window appears immediately on startup (no 44s block)
2. User can see which device/profile is causing sync delays
3. User can skip stale entries to unblock sync
4. Support can diagnose sync issues with exported diagnostics
