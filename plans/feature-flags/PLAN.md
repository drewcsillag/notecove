# Feature Flagging System - Implementation Plan

**Overall Progress:** `90%`

## Summary

Implement a feature flagging system that allows features to be enabled/disabled. Feature flags control visibility of menu items, settings tabs, and keyboard shortcuts. When a feature is flagged off, it's hidden entirely from the UI.

**Initial Feature Flags:**
| Flag | Default | Controls |
|------|---------|----------|
| `telemetry` | OFF | Telemetry settings tab, metrics collection (completely disabled when off) |
| `viewHistory` | OFF | View History menu item, keyboard shortcut, panel |
| `webServer` | OFF | Web Server settings tab, menu items, server (immediately stopped when off) |

**Key Decisions:**

- Storage: ConfigManager (`~/.notecove/config.json`) - see [QUESTIONS-1.md](./QUESTIONS-1.md)
- Granularity: Simple on/off toggles
- When off: Hide entirely (menus, settings, shortcuts)
- UI: Tools > Advanced > Feature Flags opens modal dialog
- Defaults: Code-level, can be overridden
- Menu changes require app restart; settings tabs/panels update dynamically
- Types in `packages/shared/` for future iOS app - see [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md)

---

## Phase 1: Core Feature Flag Infrastructure

- [x] 🟩 **1.1 Define feature flag types and defaults**
  - [x] 🟩 Create `packages/shared/src/feature-flags/types.ts` with FeatureFlag enum and config interface
  - [x] 🟩 Create `packages/shared/src/feature-flags/index.ts` barrel export
  - [x] 🟩 Define default values for each flag (all OFF)

- [x] 🟩 **1.2 Extend ConfigManager for feature flags**
  - [x] 🟩 Add `featureFlags` section to AppConfig interface
  - [x] 🟩 Add getFeatureFlag/setFeatureFlag methods
  - [x] 🟩 Handle migration for existing configs (add defaults)

- [x] 🟩 **1.3 Create IPC handlers for feature flags**
  - [x] 🟩 Write tests for feature flag handlers
  - [x] 🟩 Implement `featureFlags:getAll` handler
  - [x] 🟩 Implement `featureFlags:get(flag)` handler
  - [x] 🟩 Implement `featureFlags:set(flag, value)` handler
  - [x] 🟩 Broadcast flag changes to all windows

- [x] 🟩 **1.4 Expose feature flags API in preload**
  - [x] 🟩 Add featureFlags API to preload bridge (misc-api.ts)
  - [x] 🟩 Update electron.d.ts types
  - [x] 🟩 Update browser-stub.ts and web-client.ts

---

## Phase 2: Telemetry Default Change

- [x] 🟩 **2.1 Change telemetry defaults**
  - [x] 🟩 Update DEFAULT_TELEMETRY_CONFIG: set both consoleMetricsEnabled and remoteMetricsEnabled to false
  - [x] 🟩 No tests depended on old defaults

---

## Phase 3: Tools Menu Restructure

- [x] 🟩 **3.1 Move all Tools menu items into Advanced submenu**
  - [x] 🟩 Restructure menu.ts to nest all items under Advanced
  - [x] 🟩 Keep same keyboard shortcuts working
  - [x] 🟩 Add "Feature Flags..." menu item that opens feature flags dialog
  - [x] 🟩 Add menu event handler in window-api.ts

---

## Phase 4: Feature Flags Dialog UI

- [x] 🟩 **4.1 Create Feature Flags dialog component**
  - [ ] 🟥 Write tests for FeatureFlagsDialog component (deferred to Phase 6)
  - [x] 🟩 Create `FeatureFlagsDialog.tsx` as modal dialog with toggle for each flag
  - [x] 🟩 Add descriptions for each feature flag
  - [x] 🟩 Show "restart required" message when flags change
  - [x] 🟩 Handle flag persistence via IPC

- [x] 🟩 **4.2 Wire up menu item to open dialog**
  - [x] 🟩 Add IPC event for `menu:featureFlags`
  - [x] 🟩 Add state in App.tsx to show/hide dialog
  - [x] 🟩 Style dialog consistently with Settings dialog

---

## Phase 5: Apply Feature Flags to Features

- [x] 🟩 **5.1 Create React context for feature flags**
  - [x] 🟩 Create FeatureFlagsContext to provide flags to components
  - [x] 🟩 Create useFeatureFlag hook
  - [x] 🟩 Load flags on app init, subscribe to changes

- [x] 🟩 **5.2 Apply telemetry feature flag**
  - [x] 🟩 Conditionally render Telemetry tab in SettingsDialog
  - [x] 🟩 Check flag before initializing telemetry in main process
  - [x] 🟩 Stop telemetry immediately when flag toggled off

- [x] 🟩 **5.3 Apply viewHistory feature flag**
  - [x] 🟩 Menu item visibility handled at startup (requires restart)
  - [x] 🟩 Close history panel if open when flag toggled off
  - [x] 🟩 Keyboard shortcut disabled when flag off (check flag in handler)

- [x] 🟩 **5.4 Apply webServer feature flag**
  - [x] 🟩 Conditionally render Web Server tab in SettingsDialog
  - [x] 🟩 Menu items visibility handled at startup (requires restart)
  - [x] 🟩 Stop server immediately when flag toggled off

---

## Phase 6: Testing & Polish

- [ ] 🟥 **6.1 Integration testing**
  - [ ] 🟥 Test feature flag persistence across app restarts
  - [ ] 🟥 Test flag changes broadcast to all windows
  - [ ] 🟥 Test UI correctly hides/shows based on flags
  - [ ] 🟥 Test telemetry completely disabled when flag off
  - [ ] 🟥 Test web server stops when flag toggled off

- [ ] 🟥 **6.2 Edge cases**
  - [ ] 🟥 Handle flag change while feature is in use (e.g., history panel open)
  - [ ] 🟥 Ensure clean state when toggling flags

---

## Files Created/Modified

**New Files:**

- `packages/shared/src/feature-flags/types.ts` - Flag enum and config types
- `packages/shared/src/feature-flags/index.ts` - Barrel export
- `packages/desktop/src/main/ipc/handlers/feature-flag-handlers.ts` - IPC handlers
- `packages/desktop/src/main/ipc/__tests__/handlers/feature-flag-handlers.test.ts` - Handler tests
- `packages/desktop/src/renderer/src/components/FeatureFlagsDialog/FeatureFlagsDialog.tsx` - Dialog UI
- `packages/desktop/src/renderer/src/components/FeatureFlagsDialog/index.ts` - Barrel export
- `packages/desktop/src/renderer/src/contexts/FeatureFlagsContext.tsx` - React context for feature flags

**Modified Files:**

- `packages/shared/src/index.ts` - Export feature-flags
- `packages/desktop/src/main/config/manager.ts` - Add feature flag storage
- `packages/desktop/src/main/menu.ts` - Restructure Tools menu, add Feature Flags item
- `packages/desktop/src/main/ipc/handlers/index.ts` - Register new handlers
- `packages/desktop/src/main/telemetry/config.ts` - Change defaults to OFF
- `packages/desktop/src/preload/index.ts` - Expose feature flags API
- `packages/desktop/src/preload/api/misc-api.ts` - Add featureFlagsApi
- `packages/desktop/src/preload/api/window-api.ts` - Add onFeatureFlags handler
- `packages/desktop/src/renderer/src/types/electron.d.ts` - Add types
- `packages/desktop/src/renderer/src/api/browser-stub.ts` - Add featureFlags stub
- `packages/desktop/src/renderer/src/api/web-client.ts` - Add featureFlags stub
- `packages/desktop/src/renderer/src/App.tsx` - Add dialog state
- `packages/desktop/src/main/ipc/__tests__/handlers/test-utils.ts` - Add feature flag mocks
