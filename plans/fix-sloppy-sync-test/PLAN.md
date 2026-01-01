# Fix Sloppy Sync Test - Implementation Plan

**Overall Progress:** `100%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)

**Questions & Answers:** [QUESTIONS-1.md](./QUESTIONS-1.md)

## Summary

Fixed the failing e2e test `cross-machine-sync-deletion-sloppy.spec.ts:249` with two fixes:

1. **Production Fix**: Fixed logic bug in `checkCRDTLogExists()` to properly handle truncated files during cloud sync
2. **Test Fix**: Fixed editor focus issue in the test that was preventing Enter keystrokes and additional text from being typed

## Status: Complete

### Fix 1: Truncated File Detection (Production)

**OLD (buggy):**

```typescript
if (!hasExpectedSeq && hasIncompleteFile) {
  return false;
}
return hasExpectedSeq;
```

**NEW (fixed):**

```typescript
if (hasIncompleteFile) {
  return false;
}
return hasExpectedSeq;
```

This ensures that even if the expected sequence is found, we return false if any file is truncated (incomplete), triggering a retry with exponential backoff.

### Fix 2: Test Editor Focus Issue

The test was calling `keyboard.press('Enter')` and `keyboard.type('Second line...')` but the keystrokes weren't being received because the editor had lost focus.

**OLD (buggy):**

```typescript
await window1.keyboard.type(finalTitle);
await window1.waitForTimeout(500);
await window1.keyboard.press('Enter');
await window1.keyboard.type('Second line of content');
```

**NEW (fixed):**

```typescript
await window1.keyboard.type(finalTitle);
await window1.waitForTimeout(500);
await editor1.focus();
await window1.keyboard.press('Enter');
await window1.waitForTimeout(100);
await window1.keyboard.type('Second line of content');
```

Added `editor1.focus()` before each new line and a small wait after Enter to ensure the editor receives the keystrokes.

## Files Modified

1. `packages/desktop/src/main/crdt/crdt-manager.ts` - Fixed checkCRDTLogExists logic
2. `packages/desktop/src/main/crdt/__tests__/crdt-manager.test.ts` - Added 3 unit tests for truncated file handling
3. `packages/desktop/e2e/cross-machine-sync-deletion-sloppy.spec.ts` - Fixed editor focus issue

## Tasks Completed

### Step 1: Write Failing Test

- [x] Added unit test for `checkCRDTLogExists` that creates truncated file
- [x] Test verifies `checkCRDTLogExists` returns `false` even when expected sequence found
- [x] Test initially failed, confirming bug

### Step 2: Fix the Logic Bug

- [x] Modified `checkCRDTLogExists` in `crdt-manager.ts`
- [x] Changed `if (!hasExpectedSeq && hasIncompleteFile)` to `if (hasIncompleteFile)`
- [x] Unit tests pass (3 new tests for truncated file handling)

### Step 3: Investigate E2E Failure

- [x] Discovered test bug: editor losing focus after typing title
- [x] Enter key and additional lines weren't being typed
- [x] Fixed by adding `editor.focus()` before each Enter/type sequence

### Step 4: Verify E2E Tests Pass

- [x] All 3 tests in cross-machine-sync-deletion-sloppy.spec.ts pass consistently
- [x] Truncation detection and retry mechanism working as expected

## Investigation Notes

The original hypothesis (CRDT operations not applying correctly after partial sync) was incorrect. The issue was simpler:

1. **Truncation fix IS working**: Logs showed detection and proper retries
2. **Content WAS syncing**: Records were being applied correctly
3. **Test bug**: The test wasn't typing the content it expected to verify

The XmlFragment length staying at 1 during sync was normal - the fragment contains 1 paragraph element, and text is added inside it. The CRDT sync was working correctly all along.
