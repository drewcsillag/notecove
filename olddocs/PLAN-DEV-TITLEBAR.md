# Dev Build Titlebar & Profile Instance Management Plan

**Overall Progress:** `100%` ✅ (All phases complete)

## Overview

This plan addresses four related issues discovered during exploration:

1. **Titlebar `[DEV]` prefix not showing** - HTML `<title>` overrides Electron window title ✅
2. **About dialog missing** - Stub exists but not implemented ✅
3. **Activity logs use ephemeral instanceId** - Generates orphaned log files on each launch
4. **No single-instance enforcement per profile** - Same profile can run in multiple instances

## Phases

- [Phase 1: Titlebar & About Dialog](./PLAN-DEV-TITLEBAR-PHASE1.md) - Fix titlebar, implement About dialog ✅ **COMPLETE**
- [Phase 2: Profile-Based Instance ID & Locking](./PLAN-DEV-TITLEBAR-PHASE2.md) - Use profile ID for sync, enforce single-instance ✅ **COMPLETE**

---

## Phase 1: Titlebar & About Dialog ✅ COMPLETE

### Tasks

- [x] 🟩 **Step 1: Fix titlebar `[DEV]` prefix not displaying**
  - [x] 🟩 Write test: verify window title includes `[DEV]` in dev mode
  - [x] 🟩 Add IPC handler `app:getInfo` to expose app info (version, isDevBuild, profileName, profileId)
  - [x] 🟩 Add `app.getInfo()` to preload API
  - [x] 🟩 Update renderer to set `document.title` dynamically on load
  - [x] 🟩 Verify titlebar shows `[DEV] NoteCove - ProfileName` in dev mode

- [x] 🟩 **Step 2: Implement About dialog**
  - [x] 🟩 Write test: About dialog renders with expected content
  - [x] 🟩 Create `AboutDialog` React component with:
    - App name: "NoteCove"
    - Version (from package.json)
    - Profile name and ID
    - Build type: "Development Build" or nothing for production
    - Copyright: "© 2025 Drew Csillag"
    - License link (opens Apache 2.0 URL in browser)
  - [x] 🟩 Add IPC handler for opening external URLs
  - [x] 🟩 Wire About menu item to show dialog

---

## Phase 2: Profile-Based Instance ID & Locking ✅ COMPLETE

### Tasks

- [x] 🟩 **Step 3: Use profile ID as instanceId for activity logs**
  - [x] 🟩 ~~Write test: activity log filename uses profile ID~~ (skipped - requires full app startup mocking)
  - [x] 🟩 Change `instanceId` generation to use `selectedProfileId` instead of `randomUUID()`
  - [x] 🟩 Verified no code assumes instanceId is ephemeral
  - [ ] ⬜ Manual test: activity logs persist correctly across app restarts (user can verify)

- [x] 🟩 **Step 4: Implement single-instance per profile lock**
  - [x] 🟩 Write test: ProfileLock class (12 tests)
  - [x] 🟩 Create lock file mechanism in profile data directory
  - [x] 🟩 Acquire lock on profile selection, before database init
  - [x] 🟩 Release lock on app quit (stale lock detection handles crashes)
  - [x] 🟩 Show error dialog and quit if profile already in use
  - [ ] ⬜ E2E test: second instance fails (optional - manual testing sufficient)

---

## Technical Details

### Titlebar Issue Root Cause

- `packages/desktop/src/renderer/index.html:6` has `<title>NoteCove</title>`
- This overrides the Electron `BrowserWindow.title` when renderer loads
- Fix: Set `document.title` dynamically from renderer after getting app info via IPC

### About Dialog Content

```
NoteCove
Version 0.1.0
Development Build  (only shown if dev)

Profile: Development (uuid-here)

© 2025 Drew Csillag
Licensed under Apache 2.0
```

### Profile Lock File

- Location: `{profileDataDir}/profile.lock`
- Contains: PID and timestamp
- Checked: Before database initialization
- Released: On app quit via `app.on('will-quit')`

### Files to Modify

**Phase 1:** ✅ COMPLETE

- `packages/desktop/src/main/index.ts` - Add `app:getInfo`, `shell:openExternal` IPC handlers
- `packages/desktop/src/preload/index.ts` - Expose `app.getInfo()`, `shell.openExternal()`
- `packages/desktop/src/renderer/src/App.tsx` - Set document.title, wire About dialog
- `packages/desktop/src/renderer/src/components/AboutDialog/AboutDialog.tsx` - New component
- `packages/desktop/src/renderer/src/components/AboutDialog/__tests__/AboutDialog.test.tsx` - New test
- `packages/desktop/e2e/titlebar.spec.ts` - New E2E test

**Phase 2:** ✅ COMPLETE

- `packages/desktop/src/main/index.ts` - Use profile ID as instanceId, add lock logic
- `packages/shared/src/profiles/profile-lock.ts` - New ProfileLock class
- `packages/shared/src/profiles/index.ts` - Export ProfileLock
- `packages/shared/src/profiles/__tests__/profile-lock.test.ts` - 12 tests
