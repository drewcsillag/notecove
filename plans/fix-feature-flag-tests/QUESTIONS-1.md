# Questions - Fix Feature Flag Tests

## Analysis Summary

From analyzing `testlog.out`, I found:

### Failed Tests (24 total)

Most relevant to feature flags:

1. **history.spec.ts** - 8 tests failing - `viewHistory` feature flag is `false`
2. **web-server.spec.ts** - 1 test failing + 6 skipped - `webServer` feature flag is `false`
3. **settings-low-priority.spec.ts** - 2 tests failing - expect Telemetry/Web Server tabs which are hidden when flags are off

Other failures (likely not feature-flag related):

- cross-machine-sync-\*.spec.ts - 5 tests
- markdown-export.spec.ts - 1 test
- note-context-menu.spec.ts - 1 test
- note-count-badges.spec.ts - 1 test
- note-info-window.spec.ts - 3 tests
- note-multi-select.spec.ts - 1 test
- permanent-delete-duplicate.spec.ts - 1 test

### Skipped Tests (20 total + 22 did not run)

From the web-server.spec.ts file itself, there are tests that use `test.skip()`:

- `should show connected clients count` - skipped due to WebSocket instability
- `should disconnect client when requested` - skipped due to WebSocket instability
- `edits in Electron should appear in browser` - skipped due to WebSocket instability

The 22 "did not run" are the cascading web-server tests that depend on the first one that failed.

### Root Cause

The feature flags are all set to `false` by default (`DEFAULT_FEATURE_FLAGS`):

```typescript
export const DEFAULT_FEATURE_FLAGS: FeatureFlagConfig = {
  [FeatureFlag.Telemetry]: false,
  [FeatureFlag.ViewHistory]: false,
  [FeatureFlag.WebServer]: false,
};
```

Tests use `TEST_CONFIG_PATH` env var but don't create a config file with flags enabled.

### Proposed Fix

Each test file that needs specific feature flags should:

1. Create a config file at `testConfigPath` with the required flags enabled BEFORE launching Electron
2. The file format is JSON: `{"featureFlags": {"telemetry": true, "viewHistory": true, "webServer": true}}`

## Questions

1. **For settings-low-priority.spec.ts**: This test expects to see the Telemetry and Web Server tabs. Should all three feature flags be enabled for this test, or should we modify the test to only check for tabs that are always visible?

modify the test to set the feature flags

2. **Confirm scope**: Should I only fix the feature-flag-related test failures, or do you want me to also investigate the other failing tests (cross-machine-sync, note-context-menu, etc.)?
   right now, just the feature flag tests.
