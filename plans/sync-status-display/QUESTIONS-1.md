# Questions - Sync Status Display

## Current Behavior Analysis

The `SyncStatusIndicator` in the bottom status bar currently shows "Syncing N notes" based on:

1. **`fastPathPending`**: Count of notes in the "fast path" sync (Tier 1) - notes actively waiting for a specific sequence from another instance
2. **`pollingGroupCount`**: Total entries in the `PollingGroup` (Tier 2) - includes various reasons

The indicator shows whenever `isSyncing` is true, which is calculated as:
```typescript
isSyncing: fastPathStatus.isSyncing || (pollingStatus?.totalEntries ?? 0) > 0
```

### What's in the Polling Group?

Notes are added to the polling group for these reasons:
- `fast-path-handoff`: Fast path timed out, note handed off for persistent polling (actually waiting for sync)
- `open-note`: Note is currently open in editor (just keeping it fresh, not "syncing")
- `notes-list`: Note is visible in a notes list (just keeping it fresh, not "syncing")
- `recent-edit`: Note was recently edited locally (watching for conflicts, not really "syncing")
- `full-repoll`: Added during periodic full repoll every 30 minutes (checking for changes, not "syncing")

### The Problem

The indicator is treating ALL polling group entries as "syncing" activity, but most of them are just:
- Background freshness checks for visible/open notes
- Periodic full repoll to detect any missed changes
- Recently edited notes being watched for potential conflicts

The user's expectation: **Only show syncing when there's actual sync activity happening** - when we've detected remote changes and are pulling them in, NOT when we're just doing routine polling.

## Questions for Clarification

### Q1: What should the indicator show?

**Option A - Actual Syncs Only**: Only show the indicator when we've detected remote changes and are actively loading them (true "syncing" state)

**Option B - Pending Confirmations**: Show when waiting for specific expected sequences (fast-path + handoff entries), but not for routine polling (open-note, notes-list, recent-edit, full-repoll)

**Option C - Something Else**: A different interpretation?

A

### Q2: What about the full repoll?

When the 30-minute full repoll runs, it adds ALL notes to the polling group temporarily. Should this:
- **Not show at all** (it's background activity the user doesn't care about)
- **Show differently** (e.g., "Checking for updates..." with a different indicator style)
- **Show the same** (user sees their notes are being checked)

not show at all

### Q3: Should we track "actual hits"?

The polling group already tracks hits vs misses. Should the indicator only show when there are recent hits (actual changes detected)? This would require tracking:
- When we started syncing a note
- When we finished syncing it
- Only showing during that window

yes, show actual changes detecting
### Q4: Tooltip behavior?

Currently the tooltip shows:
- "X note(s) syncing (fast)"
- "Y note(s) being polled"

If we change the display logic, should the tooltip:
- Still show the detailed breakdown?
- Only show when there's actual sync activity?
- Show different categories (e.g., "Checking 50 notes", "Syncing 2 notes")?

only show when there's actual notes being synced.
