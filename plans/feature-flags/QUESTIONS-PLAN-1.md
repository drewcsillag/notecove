# Plan Critique Questions

## 1. Feature Flags Panel Type

Should the Feature Flags panel be:
a) A modal dialog (like Settings) that overlays the app
b) A panel in the sidebar area (like History Panel)
c) A new tab within the existing Settings dialog (despite earlier answer of "B")

I'm leaning toward (a) - a modal dialog similar to Settings but simpler, since it's a separate concern from Settings.

A

## 2. Menu Rebuild on Flag Change

When a feature flag changes at runtime, the Electron menu needs to be rebuilt to show/hide items. This means:

- Storing feature flag state accessible from main process
- Calling `Menu.setApplicationMenu()` again after changes

Is rebuilding the menu on flag change acceptable, or should flags require an app restart?

I'm fine with them requiring a restart

## 3. Telemetry Flag Behavior

When the telemetry flag is OFF:

- Hide the Telemetry settings tab (clear)
- But what about actual telemetry collection?

Options:
a) Feature flag OFF = telemetry completely disabled (no collection regardless of stored settings)
b) Feature flag OFF = just hides the UI, existing telemetry settings still apply

I lean toward (a) - if the feature is flagged off, it shouldn't run at all.

a

## 4. Web Server Flag Behavior

When the web server flag is toggled OFF while the server is running:
a) Immediately stop the server and hide UI
b) Show a confirmation dialog first
c) Just hide UI but leave server running until restart

I lean toward (a) for consistency.

a

## 5. Shared Package Location

I proposed creating `packages/shared/src/feature-flags/` for types. However, feature flags are currently desktop-only (not needed for the website package).

Should this be:
a) In shared (for potential future use)
b) In desktop only (`packages/desktop/src/main/feature-flags/` for main process, types can be in shared types)

Leaning toward (b) since it's desktop-specific.

a - work towards an iOS app is going to be starting up soon
