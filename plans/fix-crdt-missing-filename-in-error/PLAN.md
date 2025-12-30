# Fix CRDT Missing Filename in Error Message

**Overall Progress:** `100%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)

## Summary

When `LogReader.readRecords()` encounters an invalid log file (wrong magic number, truncated header, etc.), the error message doesn't include the filename, making it impossible to identify which file is problematic.

## Tasks

- [x] 🟩 **Step 1: Add test for filename in error message**
  - [x] 🟩 Modified test case in `log-reader.test.ts` to verify the filepath is included in error messages
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 2: Fix error message in LogReader.readRecords()**
  - [x] 🟩 Modified `log-reader.ts:133` to include filepath: `Invalid log file '${filePath}': ${header.error}`
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 3: Run tests and verify**
  - [x] 🟩 All 14 log-reader tests pass
  - [x] 🟩 Update PLAN.md

## Deferred Items

None

## Changes Made

1. `packages/shared/src/storage/log-reader.ts:133` - Added filepath to error message
2. `packages/shared/src/storage/__tests__/log-reader.test.ts:239` - Updated test to verify filepath in error
