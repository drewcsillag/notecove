# Fix App Name Display

**Overall Progress:** `100%`

## Problem

In production builds, the macOS application menu shows "@notecove/desktop" instead of "NoteCove" for:
- "Hide @notecove/desktop" → should be "Hide NoteCove"
- "Quit @notecove/desktop" → should be "Quit NoteCove"

## Root Cause

The `role: 'hide'` and `role: 'quit'` menu items use Electron's built-in labels which incorporate `app.name`. Electron's `app.name` defaults to the `name` field from `package.json` (`@notecove/desktop`), regardless of electron-builder's `productName` setting.

## Solution

Call `app.setName('NoteCove')` at the very start of the main process, before any Electron APIs that depend on `app.name` are invoked.

## Tasks

- [x] 🟩 **Step 1: Add `app.setName('NoteCove')` to main process entry point**
  - Add at line 50 of `packages/desktop/src/main/index.ts`, immediately after imports
  - Must be before any variable declarations or `app.getPath()` calls

- [x] 🟩 **Step 2: Build and verify the fix**
  - Run `pnpm build:mac` in packages/desktop
  - Install the built app
  - Verify menu shows "Hide NoteCove" and "Quit NoteCove"

## Notes

- No tests needed - this is a one-line configuration fix
- File path change (`~/Library/Application Support/NoteCove`) is acceptable per user confirmation
- Development mode can show whatever - only production matters
- See [QUESTIONS-1.md](./QUESTIONS-1.md) for clarification details
