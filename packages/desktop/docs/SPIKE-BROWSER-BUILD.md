# Phase 0 Spike: Browser Build Feasibility

**Date**: 2024-12-01
**Status**: ✅ SUCCESS - Browser build is feasible

## Summary

Verified that the NoteCove renderer can be built for standalone browser execution without Electron dependencies.

## Findings

### 1. No Direct Electron Imports in Renderer ✅

- Searched all renderer code for `from 'electron` and `require('electron')` - **none found**
- All Electron interactions go through `window.electronAPI` (defined in preload)
- This clean separation was already in place

### 2. Build Configuration ✅

Created `vite.browser.config.ts`:
- Uses standard Vite (not electron-vite)
- Outputs to `dist-browser/`
- Defines `__IS_BROWSER__` flag for runtime detection
- Build script: `pnpm build:browser`

### 3. API Stub ✅

Created `src/renderer/src/api/browser-stub.ts`:
- Provides stub implementation of `window.electronAPI`
- All methods throw "not implemented" errors
- Event subscriptions return no-op unsubscribers
- Allows app to load without crashing immediately

### 4. Browser Entry Point ✅

Created separate entry point for browser:
- `src/renderer/index-browser.html`
- `src/renderer/src/main-browser.tsx`
- Initializes API stub before loading App

## Build Output

```
✓ 12569 modules transformed
dist-browser/index.html        0.32 kB │ gzip:   0.23 kB
dist-browser/assets/index.js   1,348.88 kB │ gzip: 410.84 kB
```

- Single JS bundle (~1.3MB, 411KB gzipped)
- No CSS extracted (using CSS-in-JS via MUI/Emotion)
- Warning about chunk size - can optimize later with code splitting

## Files Created

| File | Purpose |
|------|---------|
| `vite.browser.config.ts` | Browser build configuration |
| `src/renderer/index-browser.html` | Browser HTML entry point |
| `src/renderer/src/main-browser.tsx` | Browser JS entry point |
| `src/renderer/src/api/browser-stub.ts` | API stub for browser |

## No Blockers Found

The spike revealed no architectural blockers:

1. **No refactoring required** for existing renderer code
2. **Clean separation** already exists between renderer and Electron
3. **Standard Vite build** works without special configuration
4. **All dependencies** are browser-compatible

## Recommendations for Phase 4

When implementing the real web client:

1. Replace `browser-stub.ts` with `web-client.ts` that uses fetch/WebSocket
2. Create `api/index.ts` adapter that detects environment and exports correct implementation
3. Consider code splitting for smaller initial bundle
4. Add `__IS_BROWSER__` checks where needed for feature gating

## How to Test

```bash
# Build browser version
pnpm --filter @notecove/desktop build:browser

# Serve and test (app will load but show errors when actions are attempted)
cd packages/desktop/dist-browser
npx serve -s -p 3333
# Open http://localhost:3333
```
