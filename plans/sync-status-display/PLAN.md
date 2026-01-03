# Sync Status Display - Implementation Plan

**Overall Progress:** `100%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)

**Questions:** [QUESTIONS-1.md](./QUESTIONS-1.md) | [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md)

## Summary

Change the sync status indicator to only show when there are **actual remote changes being synced**, not during routine polling or full repolls.

## Design Decisions

| Decision | Choice |
|----------|--------|
| UI updates | Event-driven (react to IPC events) |
| Minimum display time | 1 second |
| SyncStatusPanel | Include active syncs for debugging |

## Current vs Desired Behavior

| Scenario | Current | Desired |
|----------|---------|---------|
| Fast path waiting for sequence | Shows | Don't show (waiting, not syncing) |
| Polling group entries (any reason) | Shows | Don't show |
| Full repoll (30 min cycle) | Shows all notes | Don't show |
| **Actual remote changes detected** | Shows (buried in count) | **Show only this** |

## Architecture Approach

Instead of tracking polling group entries, track **active syncs** - notes where we've detected remote changes and are actively loading them.

New state to track:
- `activeSyncs: Map<string, Set<string>>` (sdId -> noteIds) - notes currently being synced
- Emit IPC event when active syncs change
- UI listens for events and shows indicator with 1s minimum display time

## Tasks

- [x] 🟩 **Step 1: Add active sync tracking to SDWatcherManager**
  - [x] 🟩 Add `activeSyncs: Map<string, Set<string>>` (sdId -> noteIds)
  - [x] 🟩 Add `addActiveSyncs(sdId, noteIds)` and `removeActiveSyncs(sdId, noteIds)` methods
  - [x] 🟩 Add `getActiveSyncs(): {sdId: string, noteId: string}[]` method
  - [x] 🟩 Add `onActiveSyncsChanged` callback for event emission
  - [x] 🟩 Update `runPollingGroupTick()` to track syncs when hits detected
  - [x] 🟩 Update file watcher sync handler to track syncs
  - [x] 🟩 Write tests for the new tracking logic
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 2: Add IPC for active syncs**
  - [x] 🟩 Add `sync:getActiveSyncs` handler in sync-handlers.ts
  - [x] 🟩 Add `sync:activeSyncsChanged` event emission in main/index.ts
  - [x] 🟩 Add `getActiveSyncs` to HandlerContext type
  - [x] 🟩 Add to preload API (invoke + listener)
  - [x] 🟩 Add to electron.d.ts types
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 3: Update SyncStatusIndicator component**
  - [x] 🟩 Replace polling with event listener for `sync:activeSyncsChanged`
  - [x] 🟩 Add 1 second minimum display time logic
  - [x] 🟩 Only show indicator when `activeSyncs.length > 0`
  - [x] 🟩 Simplify tooltip to just "Syncing N note(s)"
  - [x] 🟩 Keep existing styling/animation
  - [x] 🟩 No existing tests to update
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 4: Update SyncStatusPanel for debugging**
  - [x] 🟩 Add "Active Syncs" section showing currently syncing notes
  - [x] 🟩 Keep existing polling group diagnostics
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 5: Clean up**
  - [x] 🟩 Kept `isSyncing` field for backward compatibility (still used in tests)
  - [x] 🟩 Polling interval already removed (SyncStatusIndicator rewritten)
  - [x] 🟩 Update PLAN.md

## Deferred Items

None

## Notes

- The `SyncStatusPanel` keeps polling group info for diagnostics - that's separate from the indicator
- We don't need to change the polling group itself - it's working correctly for its purpose
- The 1-second minimum display prevents flickering for fast syncs
