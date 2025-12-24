# Feature Flags - Questions Round 1

## 1. Feature Flag Storage Location

The codebase has two persistence mechanisms:

- **ConfigManager** (`~/.notecove/config.json`) - app-level config
- **AppState** (SQLite `app_state` table) - user/window state

Feature flags seem like app-level configuration rather than window state. **Should feature flags be stored in ConfigManager (the JSON file)?**

This would make them easy to:

- Edit manually if needed
- Backup/restore with the config file
- Ship default values via code

I think that makes good sense.

## 2. Telemetry Default Behavior Clarification

You said telemetry should "default to off." Looking at the current code:

- `consoleMetricsEnabled: true` - Console metrics are ON by default
- `remoteMetricsEnabled: false` - Remote Datadog export is OFF by default

**Which specific aspect should default to off?**

- Just remote metrics (already the default)
- Console metrics too (internal logging to console)
- Or should there be a single "telemetry" feature flag that disables _all_ telemetry when off?

Both metrics should default to off. The feature flag should control the appearance (or lack thereof) as a tab in the settings panel. The metrics being enabled or not already has controls there.

## 3. Feature Flag Granularity

Should the feature flags be simple on/off toggles, or do any need additional configuration?

For example:

- **Telemetry**: Just on/off, or also control which specific metrics?
- **Web Server**: Just show/hide the feature, or also remember port/auth settings?
- **View History**: Just on/off toggle?

I'm inclined toward simple on/off flags that control whether the feature is _visible/available_ at all.

Simple on/off for now.

## 4. UI Location Within Advanced Tab

The current Tools menu structure has items at the top level:

- Note Info
- Create Snapshot
- View History
- Sync Status
- Storage Inspector
- Advanced (submenu with dev items)
- Reindex Notes
- Web Server (submenu)

You want to move "all items in the tools menu to the advanced tab."

**Do you mean:**
a) All current top-level Tools menu items should become items in the Advanced submenu (making Advanced the main content)
b) Something else?

The feature flags panel would then be accessed via: Tools > Advanced > Feature Flags (opens a settings-like panel)

yes a, and the flags panel indeed would be accessed as you have it

## 5. What Happens When a Feature is Flagged Off?

When a feature is disabled:

- **Menu items**: Should they be hidden entirely, or shown but disabled/grayed out?
- **Settings tabs**: Hide the corresponding settings tab (e.g., Web Server settings)?
- **Keyboard shortcuts**: Should they be disabled too?

I'd suggest hiding them entirely for cleaner UX.

hide them entirely, menus, settings, keyboard shortcuts all

## 6. Runtime Changes

When a user toggles a feature flag:

- **Telemetry**: Stop/start telemetry immediately
- **Web Server**: Should it auto-stop the server if running? Or just hide the UI?
- **View History**: Close the panel if open?

Should changes take effect immediately, or require an app restart?

Depends. It can vary on the flag

## 7. Default-On Features

You mentioned you might ship with certain features default-on. How should this work?

Option A: Code-level defaults that can be overridden in a config file

```typescript
const FEATURE_DEFAULTS = {
  telemetry: false, // Ships off
  viewHistory: true, // Ships on
  webServer: false, // Ships off
};
```

Option B: A separate "shipped defaults" config vs "user preferences"

I'd suggest Option A - simpler and sufficient.

A sounds just fine

## 8. Any Other Features to Flag?

You listed:

1. Telemetry
2. View History (note history panel)
3. Web Server

Are there any other features you want to flag now or anticipate flagging soon? (This might affect the data structure design.)

None that come to mind

## 9. Settings Dialog Integration

Should "Feature Flags" be:
a) A new tab in the existing Settings dialog (alongside Appearance, Telemetry, etc.)
b) A separate panel accessible from Tools > Advanced > Feature Flags
c) Both?

Since you mentioned it being "under the advanced tab of the tools menu," I'm thinking (b) - a menu item that opens a dedicated Feature Flags panel/dialog.

B
