# Feature Implementation Plan: Fix Headless E2E Tests

**Overall Progress:** `100%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)

## Summary

The main window-manager already respects `NODE_ENV=test` for headless mode (line 227). However:

1. Profile picker window (`profile-picker/index.ts`) has NO headless check - always shows
2. Profile picker tests can't use `NODE_ENV=test` because that skips the picker entirely

Solution: Add `E2E_HEADLESS=1` env var check to both window-manager and profile-picker.

## Tasks:

- [x] 🟩 **Step 1: Add E2E_HEADLESS support to window-manager.ts**
  - [x] 🟩 Update the `ready-to-show` handler to check for `E2E_HEADLESS=1` in addition to `NODE_ENV=test`
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 2: Add E2E_HEADLESS support to profile-picker/index.ts**
  - [x] 🟩 Add headless check to the `ready-to-show` handler (currently always shows)
  - [x] 🟩 Check for either `NODE_ENV=test` OR `E2E_HEADLESS=1`
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 3: Update test fixtures to set E2E_HEADLESS=1 by default**
  - [x] 🟩 Update `e2e/fixtures.ts` to include `E2E_HEADLESS: '1'` in env
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 4: Update profile-picker.spec.ts to use E2E_HEADLESS**
  - [x] 🟩 Add `E2E_HEADLESS: '1'` to all `electron.launch()` calls in this file
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 5: Update backup-restore.spec.ts to use E2E_HEADLESS**
  - [x] 🟩 Add `E2E_HEADLESS: '1'` to the env (belt and suspenders with NODE_ENV=test)
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 6: Test the changes**
  - [x] 🟩 Run profile-picker tests and verify windows don't pop up - 7/7 passed
  - [x] 🟩 Run backup-restore tests and verify windows don't pop up - 5/5 passed (1 skipped)
  - [x] 🟩 Update PLAN.md

## Deferred Items

None

## Notes

- 71 test files call `electron.launch()` directly
- Most already set `NODE_ENV=test` which hides main windows via window-manager.ts
- Profile picker tests CANNOT use `NODE_ENV=test` (it skips the picker entirely)
- The profile picker window has NO headless check - this is the main bug
- Adding `E2E_HEADLESS` allows headless mode independent of test mode logic
- Tests that want to see windows can set `E2E_HEADLESS: '0'` to opt out
