# Plan Critique - Sync Status Display

## Ordering Review

The plan ordering is correct:
1. Backend tracking first (SDWatcherManager)
2. IPC layer to expose it
3. UI to consume it

This allows testing at each layer before moving up.

## Feedback Loop

**Good**: Step 1 includes tests for the new tracking logic.

**Improvement needed**: We should emit an IPC event when active syncs change, so the UI can react immediately rather than polling. The current SyncStatusIndicator polls every 2 seconds - that's fine for a fallback but immediate updates would be better UX.

agree

## Debug Tools

The existing `SyncStatusPanel` shows polling group diagnostics. Should it also show active syncs? This would help debugging.

**Recommendation**: Add active syncs to SyncStatusPanel as part of Step 4.

yes

## Missing Items Identified

1. **Event emission**: Need to broadcast when active syncs change (start/complete) so UI can update immediately
2. **Minimum display time**: If a sync completes in <500ms, the indicator might flash too quickly to notice. Should we have a minimum display duration (e.g., 1 second)?

## Risk Assessment

### Race Condition Risk
If many notes sync rapidly, the UI might flicker. Consider:
- Debouncing the UI updates
- Minimum display time per sync "session"

### Test Coverage
Need to test:
- Multiple concurrent syncs from different SDs
- Sync completing while another starts
- Very fast syncs (sub-second)

## Questions

### Q1: Event-driven vs polling for UI?

Should the UI:
- **Poll every 2s** (current approach, simple)
- **React to events** (immediate updates, better UX)
- **Both** (events for reactivity, polling as fallback)

### Q2: Minimum display time?

If a sync completes very quickly (< 500ms), should we still show the indicator for a minimum duration (e.g., 1 second) so the user notices something happened?

### Q3: SyncStatusPanel update?

Should the detailed SyncStatusPanel dialog also show active syncs for debugging purposes?
