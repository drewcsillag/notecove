# Feature Implementation Plan: Fix Note Tests

**Overall Progress:** `100%`

## Summary

Three e2e tests were failing because they didn't properly wait for folder creation to complete AND didn't set the active SD context before creating folders.

## Root Cause

The failing tests had two issues:

1. **Missing SD context**: Didn't click "All Notes" first to set `activeSdId` (required for folder creation)
2. **Insufficient waits**: Used `waitForTimeout()` instead of proper `waitForSelector()` for dialog close/folder appearance
3. **Wrong test logic** (note-multi-select only): Expected All Notes count to decrease after move, but All Notes shows all notes including those in folders

## Tasks

- [x] 🟩 **Step 1: Fix note-count-badges.spec.ts**
  - [x] 🟩 Click "All Notes" first to set active SD context
  - [x] 🟩 Add wait for dialog to close
  - [x] 🟩 Add wait for folder to appear in tree
  - [x] 🟩 Verified test passes in isolation

- [x] 🟩 **Step 2: Fix note-info-window.spec.ts**
  - [x] 🟩 Click "All Notes" first to set active SD context
  - [x] 🟩 Add wait for dialog to appear before filling
  - [x] 🟩 Add wait for dialog to close after folder creation
  - [x] 🟩 Add wait for folder to appear in tree
  - [x] 🟩 Verified test passes in isolation

- [x] 🟩 **Step 3: Fix note-multi-select.spec.ts**
  - [x] 🟩 Click "All Notes" first to set active SD context
  - [x] 🟩 Add wait for dialog to appear before filling
  - [x] 🟩 Add wait for dialog to close after folder creation
  - [x] 🟩 Add wait for folder to appear in tree
  - [x] 🟩 Remove incorrect count assertion (All Notes shows all notes)
  - [x] 🟩 Verified test passes in isolation

- [x] 🟩 **Step 4: Run all three tests together**
  - [x] 🟩 All 3 tests pass when run together

## Key Learning

Folder creation in NoteCove requires:

1. An active SD context (set by clicking a folder like "All Notes")
2. Proper waits for dialog lifecycle and folder appearance

The passing `folders.spec.ts` test shows the correct pattern.
