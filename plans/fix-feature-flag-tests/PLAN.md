# Feature Implementation Plan: Fix Feature Flag Tests

**Overall Progress:** `100%`

## Summary

Tests for features behind feature flags (history, web-server, settings tabs) were failing because the tests didn't enable the required feature flags. The fix was to create config files with the appropriate flags enabled before launching Electron in each test.

## Tasks

- [x] 🟩 **Step 1: Fix history.spec.ts**
  - [x] 🟩 Add config file creation in `beforeEach` with `viewHistory: true`
  - [x] 🟩 Write to `testConfigPath` (already uses `TEST_CONFIG_PATH` env var)
  - [x] 🟩 Verify tests pass in isolation (8/8 passed)

- [x] 🟩 **Step 2: Fix web-server.spec.ts**
  - [x] 🟩 Add config file creation in `beforeEach` with `webServer: true`
  - [x] 🟩 Write to `testUserDataDir + '/config.json'` (uses `--user-data-dir` instead of `TEST_CONFIG_PATH`)
  - [x] 🟩 Verify tests pass in isolation (3 passed, 4 intentionally skipped)

- [x] 🟩 **Step 3: Fix settings-low-priority.spec.ts**
  - [x] 🟩 Add config file creation in `beforeEach` with all three flags
  - [x] 🟩 Write to `testConfigPath` (already uses `TEST_CONFIG_PATH` env var)
  - [x] 🟩 Added wait for `.ProseMirror` to fix flakiness
  - [x] 🟩 Verify tests pass in isolation (2/2 passed)

- [x] 🟩 **Step 4: Verify all three test files together**
  - [x] 🟩 Run all three test files (13 passed, 4 intentionally skipped)

## Implementation Details

### For history.spec.ts
Added before `electron.launch()`:
```typescript
await fs.writeFile(
  testConfigPath,
  JSON.stringify({ featureFlags: { viewHistory: true } }, null, 2)
);
```

### For web-server.spec.ts
Added `writeFileSync` to imports and after `mkdtempSync()`:
```typescript
writeFileSync(
  join(testUserDataDir, 'config.json'),
  JSON.stringify({ featureFlags: { webServer: true } }, null, 2)
);
```

### For settings-low-priority.spec.ts
Added before `electron.launch()`:
```typescript
await fs.writeFile(
  testConfigPath,
  JSON.stringify(
    { featureFlags: { telemetry: true, viewHistory: true, webServer: true } },
    null,
    2
  )
);
```
Also added wait for `.ProseMirror` to fix flakiness.

## Additional Notes

- 4 web-server tests are intentionally skipped with `test.skip()` due to WebSocket instability in Playwright test environment
- The settings-low-priority test needed an additional wait for `.ProseMirror` to ensure the app was fully loaded before pressing keyboard shortcuts
