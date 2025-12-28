# Phase 6: CI Stabilization & Test Fixes

**Status:** 🟡 In Progress
**Goal:** Fix flaky E2E tests and prevent Electron crash dialogs during testing.

---

## Background

During oEmbed implementation (Phases 1-5), several E2E tests began failing due to:

1. **Link Display Mode Changes**: The default `displayMode` changed to `'unfurl'`, causing links to be rendered as chips with hidden text. Tests looking for visible `a.web-link` elements failed because the actual link element has `font-size: 0`.

2. **Electron Session Restore Dialogs**: macOS remembers when Electron crashes during tests and shows "The last time you opened Electron, it unexpectedly quit while reopening windows" dialogs. These block test execution.

3. **Pre-existing Flaky Tests**: Several cross-machine sync and UI tests have intermittent failures unrelated to oEmbed changes.

---

## Tasks

### 6.1 Link Display Preference in Tests ✅

**Problem:** Default `displayMode: 'unfurl'` causes links to render with hidden text.

**Solution:** Set `linkDisplayPreference` to `'none'` in test setup.

**Files Changed:**

- `e2e/web-links.spec.ts` - Added preference setup + page reload
- `e2e/tags.spec.ts` - Added preference setup + page reload

**Implementation:**

```typescript
// In beforeAll, after app initialization:
await page.evaluate(async () => {
  await window.electronAPI.appState.set('linkDisplayPreference', 'none');
});
// Reload to pick up the preference in React context
await page.reload();
await page.waitForLoadState('domcontentloaded');
```

---

### 6.2 Electron Crash Dialog Prevention 🟥

**Problem:** macOS shows "unexpectedly quit" dialogs that block E2E tests.

**Root Cause:** When Playwright force-closes Electron windows during test cleanup, macOS registers this as a crash and enables session restore on next launch.

**Proposed Solutions:**

1. **Disable Session Restore**
   - Add `--disable-session-crashed-bubble` flag
   - Clear Electron's session state directory before tests

2. **Clean Shutdown in Tests**
   - Ensure `electronApp.close()` is called properly in afterAll
   - Add graceful shutdown timeout before force kill

3. **Clear macOS Session State**
   - Before each test suite, clear:
     - `~/Library/Saved Application State/com.electron.notecove.savedState/`
     - User data directory session files

**Files to Change:**

- `e2e/*.spec.ts` - All test files with Electron launch
- Potentially create shared `e2e/utils/electron-launcher.ts`

---

### 6.3 Flaky E2E Test Fixes 🟥

The following tests have intermittent failures (unrelated to oEmbed):

| Test File                                    | Issue                                   | Priority |
| -------------------------------------------- | --------------------------------------- | -------- |
| `cross-machine-sync-deletion-sloppy.spec.ts` | `toBeVisible()` fails on note list sync | High     |
| `cross-machine-sync-updates.spec.ts`         | Title change not syncing to closed note | High     |
| `cross-sd-move-sync.spec.ts`                 | Timeout on database consistency check   | Medium   |
| `folders.spec.ts`                            | Folder collapse/drag operations timeout | Medium   |
| `history.spec.ts`                            | Version restore visibility issues       | Low      |
| `markdown-export.spec.ts`                    | Multi-note export visibility            | Low      |
| `note-switching.spec.ts`                     | Multi-window content clearing           | Medium   |

**Common Patterns:**

- Timing-dependent operations need longer waits
- Sync operations need explicit completion signals
- Multi-window tests are inherently flaky on CI

**Proposed Fixes:**

1. Add explicit wait conditions instead of fixed timeouts
2. Add retry logic for sync operations
3. Increase timeouts for slow CI environments
4. Consider marking known flaky tests with `test.fixme()` temporarily

---

### 6.4 Test Infrastructure Improvements 🟥

**Proposed Improvements:**

1. **Shared Electron Launcher**
   - Create `e2e/utils/launch-electron.ts` with best practices
   - Include preference setup, session clearing, graceful shutdown

2. **Test Stability Metrics**
   - Track which tests fail most often
   - Add flakiness detection in CI

3. **Better Error Messages**
   - Log full page content on visibility failures
   - Capture screenshots on failure
   - Log timing information

4. **Retry Configuration**
   - Configure Playwright's built-in retry for known flaky tests
   - Add `test.retry(2)` for sync-dependent tests

---

## Implementation Order

1. ✅ **6.1** - Done (web-links.spec.ts, tags.spec.ts)
2. 🟥 **6.2** - Next priority (blocks many test runs)
3. 🟥 **6.3** - After 6.2 (individual test fixes)
4. 🟥 **6.4** - Low priority (nice-to-have improvements)

---

## Notes

- Phase 6 is not strictly oEmbed-related but arose during oEmbed implementation
- These fixes benefit the entire test suite, not just oEmbed tests
- Consider splitting into a separate stabilization effort if it grows too large
