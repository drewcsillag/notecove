# Questions for Phase 1 Analysis

## Issue Understanding

After analyzing the codebase, I found:

1. **backup-restore.spec.ts** launches Electron with `NODE_ENV: 'test'` but the windows still show because:
   - Window creation uses `show: false` initially
   - But then calls `window.show()` in `ready-to-show` event

2. **profile-picker.spec.ts** intentionally does NOT set `NODE_ENV=test` because it needs the profile picker to appear (profile picker is skipped when `NODE_ENV=test`)

3. Electron doesn't have a true "headless" mode like browsers do. The standard approaches are:
   - Position windows off-screen
   - Never call `.show()` on windows
   - Use virtual framebuffer (xvfb) on Linux CI

## Questions

### Q1: Which approach do you prefer?

**Option A: Environment variable to suppress window.show() calls**

- Add `E2E_HEADLESS=1` environment variable
- When set, skip all `window.show()` and `window.focus()` calls
- Windows stay hidden but still function for testing
- Simple to implement, works on all platforms

**Option B: Position windows off-screen**

- Set window position to coordinates like `x: -9999, y: -9999`
- Windows technically "show" but are invisible on screen
- Might have issues with multi-monitor setups

**Option C: Set show:false and never show**

- Keep `show: false` in BrowserWindow options
- Never call `.show()` when running tests
- Similar to Option A but implemented differently

My recommendation is **Option A** because:

- It's explicit and clear what's happening
- Easy to enable/disable
- Doesn't affect window positioning logic
- Won't interfere with multi-monitor or different screen resolutions

I'd want to do it however the other tests currently do it

### Q2: Should this apply to all E2E tests?

Currently some tests might rely on visual debugging. Should we:

- A) Make all tests use this new headless mechanism by default
- B) Only apply to specific test files that request it
- C) Default to headless but allow individual tests to opt-out

C

### Q3: Profile picker tests specifically

The profile picker tests intentionally need to NOT be in test mode to exercise the profile picker flow. But they could still be "headless" (windows exist but don't show). Should these tests:

- A) Use the new headless mechanism (windows hidden but functional)
- B) Remain as-is (showing windows) since they test the profile picker UI

B - Use headless mechanism
