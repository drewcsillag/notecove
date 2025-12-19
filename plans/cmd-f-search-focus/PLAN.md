# Fix Command+F Not Focusing Search Box

**Overall Progress:** `100%`

## Problem

Command+F (and Edit → Find...) no longer focuses the "Search notes..." input box.

## Root Cause

In `packages/desktop/src/main/index.ts`, `createMenu()` is called at line 979 **before** any window is created (lines 987-991). The menu handlers close over `mainWindow` which is `null` at that point. Even after `mainWindow` is set, the menu handlers still reference the stale `null` value.

See [QUESTIONS-1.md](./QUESTIONS-1.md) for full analysis.

## Solution

Call `createMenu()` after window creation to refresh the menu with the updated `mainWindow` reference.

---

## Tasks

- [x] 🟩 **Step 1: Fix the bug**
  - In `createWindow()`, call `createMenu()` after `mainWindow` is set
  - Only when `result.shouldSetAsMain` is true (line 93-95 of index.ts)

- [x] 🟩 **Step 2: Verify fix manually**
  - Run the app and test Command+F focuses the search box
  - Test Edit → Find... menu item works
  - Test Command+N creates a new note (also affected by this bug)

- [x] 🟩 **Step 3: Run CI**
  - Ensure all tests pass before commit

---

## Critique Notes

See critique reasoning above. A unit test was considered but deemed impractical for this initialization-order bug. The fix is a single line in an obvious location, making regression unlikely.
