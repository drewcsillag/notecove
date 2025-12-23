# Questions for Fix App Name Display

## Issue Summary

The application name displays as `@notecove/desktop` in:

1. **macOS Application Menu** - The first menu item shows `@notecove/desktop` instead of `NoteCove` (e.g., "Hide @notecove/desktop", "Quit @notecove/desktop")
2. **File paths** - e.g., `~/Library/Application Support/@notecove` (though you're OK with `desktop` in paths)

## Root Cause Analysis

The issue is that Electron's `app.name` property defaults to the `name` field from `package.json`, which is `@notecove/desktop` (an npm scoped package name). This affects:

1. **`menu.ts:79`** - Uses `app.name` for the macOS application menu label
2. **`app.getPath('userData')`** - Electron uses `app.name` to construct the userData path (e.g., `~/Library/Application Support/{app.name}`)

The `electron-builder.json5` has `productName: "NoteCove"`, but that only affects the **built/packaged** app, not development mode.

## Questions

### 1. Application Menu Behavior

**In production builds**, Electron Builder sets `app.name` from `productName`, so the menu should already show "NoteCove" correctly.

**In development**, it shows "@notecove/desktop".

**Question:** Are you primarily concerned about:

- A) Development mode appearance only
- B) Both development and production (implying production is also broken)
- C) You haven't tested production builds yet

Production builds. In the current production build, In the upper right, it does properly have `NoteCove` as the app name but has @notecove/desktop in the menu items - see @ncappmenu.png

Either that, or running `pnpm build:mac` when run in the packages/desktop directory is not doing production builds, and I'm just silly like that.

### 2. File Path Behavior

On macOS, `app.getPath('userData')` returns `~/Library/Application Support/{app.name}`. In dev mode, this would be `~/Library/Application Support/@notecove` (Electron sanitizes the `/desktop` part).

**Question:** Regarding the file path:

- Do you currently have data stored at `~/Library/Application Support/@notecove`?
- Are you OK with changing this path going forward (which would mean a migration)?
- Or do you want to keep the existing path and just fix the display name?

I'm ok with this changing going forward. No super crucial data lives there.

### 3. Scope Clarification

You mentioned "Hide @notecove/desktop" as an example. This comes from macOS using `app.name` for the menu label.

**Question:** To confirm, the fix should ensure:

- The macOS app menu first item says "NoteCove" (not "@notecove/desktop")
- The "Hide", "Quit" labels say "Hide NoteCove", "Quit NoteCove"
- Is there anything else showing the wrong name?

That's all I've noticed so far. And to be clear, I'm fine with dev builds showing whatever. It's the prod builds that I build via:

```
cd packages/desktop
pnpm build:mac
```

which produces builds in the `release` directory there.
