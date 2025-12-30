# Fix CRDT Sequence Violation Bug

## Problem

During rapid typing or concurrent operations, the CRDT update mechanism throws sequence violation errors:

```
Error: Sequence violation for instance newnote-instance-1: expected 9, got 8
Error: Sequence violation for instance newnote-instance-1: expected 10, got 9
```

This causes:

1. **Lost keystrokes during typing** - Characters don't appear in the editor
2. **Flaky E2E tests** - Tests that type content fail intermittently
3. **Potential data loss** - User edits may not be saved correctly

## Discovery Context

This was discovered while fixing flaky cross-machine sync E2E tests. When tests used `keyboard.type()` to enter content, characters were frequently lost. The logs showed sequence violation errors occurring during typing.

**Workaround used in tests:** Using `editor.evaluate()` to set heading content directly bypasses the CRDT update mechanism and avoids the issue.

## Root Cause Hypothesis

The sequence numbers for CRDT updates are getting out of sync. Possible causes:

1. **Race condition in update application** - Multiple updates sent before previous ones are acknowledged
2. **Async processing issue** - Updates processed out of order
3. **IPC timing** - Renderer sends updates faster than main process can handle
4. **Debouncing/batching issue** - Updates batched incorrectly

## Key Files to Investigate

Based on the error messages, likely locations:

1. **CRDT log handling** - Where sequence numbers are validated
2. **Note update IPC handlers** - `note:applyUpdate` handler in main process
3. **TipTap editor integration** - How editor changes trigger CRDT updates
4. **Y.js integration** - How Yjs updates are serialized and applied

## Reproduction

1. Run any cross-machine sync E2E test with `keyboard.type()`:

   ```bash
   pnpm --filter @notecove/desktop test:e2e --grep "should sync newly created note"
   ```

2. Or manually: Create a new note and type rapidly - some characters may be lost

## Expected Behavior

- All typed characters should appear in the editor
- CRDT updates should be processed in order without sequence violations
- No data loss during rapid editing

## Acceptance Criteria

1. E2E tests can use `keyboard.type()` without losing characters
2. No sequence violation errors during normal typing
3. Concurrent operations from multiple sources don't cause sequence violations
4. Existing cross-machine sync tests pass without the `evaluate()` workaround

## Test Files Affected

These tests currently work around the issue with `evaluate()`:

- `e2e/cross-machine-sync-creation.spec.ts`
- `e2e/cross-machine-sync-updates.spec.ts`

These tests fail due to sequence violations:

- `e2e/cross-machine-sync-instances.spec.ts` (2 tests)
- `e2e/cross-machine-sync-deletion-sloppy.spec.ts` (1 test)
