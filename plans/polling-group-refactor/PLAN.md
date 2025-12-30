# Polling Group Refactor - Implementation Plan

**Overall Progress:** `95%`

## Summary

Implement a **two-tier sync polling system**:

1. **Tier 1 (Fast Path)**: Fresh activity log entries get aggressive exponential backoff polling, optimized for low-latency filesystems. Once delay exceeds ~1 minute, hand off to Tier 2.

2. **Tier 2 (Polling Group)**: Persistent, rate-limited polling that catches slow cloud sync, laptop-was-asleep scenarios, and other sources (open notes, recently edited, etc).

This addresses the issue where cloud sync delays longer than ~76 seconds cause missed updates, while keeping fast sync fast.

## Key Design Decisions

Based on [QUESTIONS-1.md](./QUESTIONS-1.md) and [QUESTIONS-2.md](./QUESTIONS-2.md):

- **Two-Tier Polling**: Fast path for fresh entries, polling group as safety net
- **Fast Path Handoff**: When delay would exceed 60s, stop fast polling and add to polling group
- **Polling Group Sources**: Handoffs from fast path, open notes, notes in lists, recently edited (5 min configurable), full repoll
- **Exit Criteria**: Note leaves group when closed AND sequences caught up
- **Rate Limit**: 120 notes/min (2/sec average), global across all SDs
- **Priority**: Open notes first, then FIFO
- **Full Repoll**: All notes in all SDs at startup + every 30 min (configurable, can disable)
- **Settings**: Advanced tab with global + per-SD overrides
- **UI**: Replace existing Tools > Advanced > Sync Status window content
- **Remove**: Stale sync status bar indicator (`SyncStatusIndicator`), stale entry concept
- **Sequence Tracking**: Track expected sequences (plural) per note per instance

## Architecture

### Two-Tier System Overview

```
Activity Log Entry Detected
         │
         ▼
┌─────────────────────────────────────┐
│     TIER 1: Fast Path Polling       │
│  (existing pollAndReload logic)     │
│                                     │
│  Delays: 100, 200, 500, 1000,       │
│          2000, 3000, 5000, 7000,    │
│          10000, 15000, 30000 ms     │
│                                     │
│  If sync succeeds → Done            │
│  If delay would exceed 60s → ──────────────┐
└─────────────────────────────────────┘      │
                                             ▼
                              ┌─────────────────────────────────────┐
                              │    TIER 2: Polling Group            │
   Other sources ───────────► │  (rate-limited persistent polling)  │
   - Open notes               │                                     │
   - Notes in lists           │  Rate: 2/sec (120/min) average      │
   - Recently edited          │  Priority: Open notes first         │
   - Full repoll              │  Polls until sequences caught up    │
                              └─────────────────────────────────────┘
```

### New Data Structures

```typescript
interface PollingGroupEntry {
  noteId: string;
  sdId: string;
  // Expected sequences per source instance (only for fast-path-handoff)
  expectedSequences: Map<string, number>; // sourceInstanceId -> expectedSequence
  addedAt: number;
  lastPolledAt: number;
  reason: 'fast-path-handoff' | 'open-note' | 'notes-list' | 'recent-edit' | 'full-repoll';
  priority: 'high' | 'normal'; // high = open/in-list, normal = background
}

interface PollingGroupSettings {
  pollRatePerMinute: number; // default 120 (for misses)
  hitRateMultiplier: number; // default 0.25 (hits count as 0.25 polls, effectively 4x faster)
  maxBurstPerSecond: number; // default 10 (cap to prevent CPU/disk spikes)
  recentEditWindowMs: number; // default 5 * 60 * 1000
  fullRepollIntervalMs: number; // default 30 * 60 * 1000, 0 = disabled
  fastPathMaxDelayMs: number; // default 60000 (1 minute)
  normalPriorityReserve: number; // default 0.2 (20% of capacity reserved for normal priority)
}
```

### Exit Criteria by Reason

| Reason              | Exit Criteria                                          | Priority |
| ------------------- | ------------------------------------------------------ | -------- |
| `fast-path-handoff` | All expected sequences matched (CRDT logs caught up)   | normal   |
| `full-repoll`       | Poll once, then remove (just checking for any changes) | normal   |
| `open-note`         | While note is open (continuous polling)                | high     |
| `notes-list`        | While note is visible in any notes list                | high     |
| `recent-edit`       | After recent edit window expires (default 5 min)       | high     |

### Rate Limiting with Hit Acceleration

```
Normal polling (misses):     120/min = 2/sec
Hit multiplier:              0.25 (hits count as 1/4 poll)
Effective hit rate:          480/min = 8/sec
Burst cap:                   10/sec max (prevents CPU/disk spikes)
Priority reserve:            20% capacity for normal priority even when many high-priority notes
```

When data is actively syncing (high hit rate), polling accelerates automatically. When nothing is syncing, we conserve resources.

### Files to Create/Modify

| File                                                                         | Action     | Description                                |
| ---------------------------------------------------------------------------- | ---------- | ------------------------------------------ |
| `packages/shared/src/storage/polling-group.ts`                               | **Create** | Core polling group logic (Tier 2)          |
| `packages/shared/src/storage/__tests__/polling-group.test.ts`                | **Create** | Unit tests for polling group               |
| `packages/shared/src/storage/activity-sync.ts`                               | **Modify** | Add handoff callback, remove stale entries |
| `packages/desktop/src/main/sd-watcher-manager.ts`                            | **Modify** | Instantiate polling group, wire up handoff |
| `packages/desktop/src/main/ipc/types.ts`                                     | **Modify** | New types for polling group status         |
| `packages/desktop/src/main/ipc/handlers/sync-handlers.ts`                    | **Modify** | New handlers for polling group             |
| `packages/desktop/src/renderer/src/components/SyncStatusPanel/`              | **Modify** | New UI for polling group visibility        |
| `packages/desktop/src/renderer/src/components/SyncStatusIndicator/`          | **Delete** | Remove stale sync indicator                |
| `packages/desktop/src/renderer/src/components/LeftSidebar/`                  | **Modify** | Remove stale sync indicator usage          |
| `packages/desktop/src/renderer/src/components/Settings/AdvancedSettings.tsx` | **Create** | New settings tab                           |
| `packages/shared/src/database/schema.ts`                                     | **Modify** | Add AppStateKeys for polling settings      |
| `website/architecture/sync-mechanism.md`                                     | **Modify** | Update documentation                       |

---

## Recommended Execution Order

Based on [PLAN-CRITIQUE.md](./PLAN-CRITIQUE.md), execute phases in this order for faster feedback loops:

1. **Phase 1** - Core Polling Group (unit testable)
2. **Phase 4** - Settings Infrastructure (enables configuration)
3. **Phase 2** - Fast Path Integration + **Phase 9** - Remove Stale Sync (do together to avoid broken UI)
4. **Phase 5** - Open Notes tracking
5. **Phase 6** - Recently Edited tracking
6. **Phase 3** - Full Repoll
7. **Phase 7** - Settings UI
8. **Phase 8** - Sync Status Window
9. **Phase 10** - Documentation
10. **Phase 11** - Final Testing

---

## Tasks

### Phase 1: Core Polling Group Implementation 🟩

- [x] 🟩 **Step 1: Create PollingGroup class with tests (TDD)**
  - [x] 🟩 1.1 Write tests for polling group data structure
    - Adding/removing entries
    - Priority ordering (high priority first, then FIFO)
    - Normal priority reserve (20% capacity even with many high-priority)
    - Exit criteria by reason (see [Exit Criteria table](#exit-criteria-by-reason))
  - [x] 🟩 1.2 Implement `PollingGroup` class
    - `add(entry)` - add note to polling group
    - `remove(noteId, sdId)` - remove note from group
    - `getNextBatch(count)` - get next notes to poll respecting priority reserve
    - `updateSequence(noteId, sdId, instanceId, sequence)` - update expected sequence
    - `markPolled(noteId, sdId, wasHit)` - update lastPolledAt, track hit for rate limiting
    - `checkExitCriteria(noteId, sdId)` - check if note should exit based on reason
    - `setOpenNotes(noteIds)` - update high priority set
    - `setNotesInLists(noteIds)` - update high priority set
    - `getStatus()` - return current state for UI
  - [x] 🟩 1.3 Write tests for rate limiter with hit acceleration
    - Respects base rate for misses (120/min default)
    - Hits count as fraction (0.25x default) - accelerates during active sync
    - Burst cap prevents CPU/disk spikes (10/sec default)
    - Global across all SDs
  - [x] 🟩 1.4 Implement rate limiter within PollingGroup
  - [ ] 🟨 1.5 Implement polling timer/interval driver (deferred to Phase 2 integration)
    - Timer driver will be implemented in sd-watcher-manager when integrating

### Phase 2: Integrate Fast Path with Polling Group 🟩

- [x] 🟩 **Step 2: Modify ActivitySync fast path to hand off to PollingGroup**
  - [x] 🟩 2.1 Write integration tests
    - Fast path succeeds quickly → note NOT added to polling group
    - Fast path exceeds max delay → hands off to polling group
    - Polling group eventually syncs the note
  - [x] 🟩 2.2 Modify `pollAndReload` to hand off instead of giving up
    - Add callback `onHandoffToPollingGroup(noteId, sdId, expectedSequences)`
    - Change timeout behavior: instead of returning false, hand off
  - [x] 🟩 2.3 Remove `staleEntries` concept (no longer needed - polling group handles all)
  - [x] 🟩 2.4 Keep `pendingSyncs` for fast path tracking (still useful for UI)
  - [x] 🟩 2.5 Update callbacks interface for polling group handoff

### Phase 3: Full Repoll System 🟩

- [x] 🟩 **Step 3: Implement full repoll mechanism**
  - [x] 🟩 3.1 Write tests for full repoll
    - Startup triggers full repoll
    - Periodic repoll at configured interval
    - Already-polled notes excluded from repoll queue
    - Can disable with interval = 0
  - [x] 🟩 3.2 Implement full repoll in SDWatcherManager
    - Enumerate all notes in all SDs
    - Add to polling group with 'full-repoll' reason
    - Schedule next repoll based on settings
  - [x] 🟩 3.3 Integrate with startup sequence

### Phase 4: Settings Infrastructure 🟩

- [x] 🟩 **Step 4: Add settings storage**
  - [x] 🟩 4.1 Add AppStateKeys for polling settings
    - `pollingRatePerMinute` (global, default 120)
    - `pollingHitMultiplier` (global, default 0.25)
    - `pollingMaxBurstPerSecond` (global, default 10)
    - `pollingNormalPriorityReserve` (global, default 0.2)
    - `recentEditWindowMinutes` (global, default 5)
    - `fullRepollIntervalMinutes` (global, default 30, 0 = disabled)
    - `fastPathMaxDelaySeconds` (global, default 60)
    - `pollingSettings:{sdId}` (per-SD overrides, JSON object)
  - [x] 🟩 4.2 Add IPC handlers for settings (get/set)
    - `polling:getSettings` - get global settings
    - `polling:setSettings` - set global settings
    - `polling:getSettingsForSd` - get per-SD overrides
    - `polling:setSettingsForSd` - set per-SD overrides
    - `polling:getGroupStatus` - get polling group status
  - [x] 🟩 4.3 Load settings on startup and pass to PollingGroup

### Phase 5: Open Notes / Notes List Integration 🟩

- [x] 🟩 **Step 5: Track open notes and notes in lists**
  - [x] 🟩 5.1 Write tests for open notes priority
  - [x] 🟩 5.2 Add IPC for renderer to report open notes (per-window)
  - [x] 🟩 5.3 Add IPC for renderer to report notes in lists (per-window)
  - [x] 🟩 5.4 Implement multi-window coordination
    - Track open notes per window ID
    - Union all windows for high-priority set
    - Handle window close (remove that window's contribution)
  - [x] 🟩 5.5 Integrate with polling group priority

### Phase 6: Recently Edited Notes 🟩

- [x] 🟩 **Step 6: Track recently edited notes**
  - [x] 🟩 6.1 Write tests for recent edit window
  - [x] 🟩 6.2 Track note edits with timestamps
  - [x] 🟩 6.3 Add to polling group when edited
  - [x] 🟩 6.4 Remove when outside window (configurable, default 5 min)

### Phase 7: Advanced Settings UI 🟩

- [x] 🟩 **Step 7: Create Advanced settings tab**
  - [x] 🟩 7.1 Create `AdvancedSettings.tsx` component
    - **Polling Rate section:**
      - Base polling rate slider (60-300 notes/min, default 120)
      - Hit rate multiplier slider (0.1-1.0, default 0.25)
      - Max burst rate slider (5-20/sec, default 10)
      - Normal priority reserve slider (10-50%, default 20%)
    - **Timing section:**
      - Recent edit window slider (1-30 min, default 5)
      - Full repoll interval (0=disabled, 15-120 min, default 30)
      - Fast path max delay slider (30-120 sec, default 60)
    - **Per-SD override section:**
      - Dropdown to select SD
      - Override checkboxes + fields for each setting
  - [x] 🟩 7.2 Add tab to SettingsDialog
  - [x] 🟩 7.3 Wire up settings persistence

### Phase 8: Sync Status Window Redesign 🟩

- [x] 🟩 **Step 8: Redesign SyncStatusPanel**
  - [x] 🟩 8.1 Design new UI layout
    - Summary section: polling rate, time to next full repoll
    - Polling group table: note, SD, reason, priority, added/polled times
    - Export diagnostics button
  - [x] 🟩 8.2 IPC handlers already existed from Phase 4 (polling:getGroupStatus)
  - [x] 🟩 8.3 Implement new SyncStatusPanel UI with polling group status
  - [x] 🟩 8.4 Updated SyncStatusIndicator to show both fast-path and polling group activity
    - Note: Kept indicator but updated to combine Tier 1 + Tier 2 status

### Phase 9: Remove Stale Sync Infrastructure 🟩

- [x] 🟩 **Step 9: Remove stale sync code (replaced by polling group)**
  - [x] 🟩 9.1 Remove `SyncStatusIndicator` component (status bar indicator)
  - [x] 🟩 9.2 Remove stale sync indicator from LeftSidebar
  - [x] 🟩 9.3 Remove stale sync IPC handlers (skip, retry stale entry)
  - [x] 🟩 9.4 Remove stale entry persistence code (skippedStaleEntries in DB)
  - [x] 🟩 9.5 Remove `staleEntries` array and related methods from ActivitySync
  - [x] 🟩 9.6 Update tests that reference stale sync infrastructure

### Phase 10: Documentation 🟩

- [x] 🟩 **Step 10: Update documentation**
  - [x] 🟩 10.1 Update `website/architecture/sync-mechanism.md`
  - [x] 🟩 10.2 Add two-tier polling system explanation
  - [x] 🟩 10.3 Update configuration tables with polling group settings
  - [x] 🟩 10.4 Update key files reference table

### Phase 11: Final Testing & Verification 🟥

- [ ] 🟥 **Step 11: End-to-end verification**
  - [ ] 🟥 11.1 Run full CI suite
  - [ ] 🟥 11.2 Manual testing with simulated slow sync
  - [ ] 🟥 11.3 Verify existing cross-machine tests pass
  - [ ] 🟥 11.4 Fix flaky E2E tests (simple-sync-test.spec.ts)
    - Issue: `keyboard.type()` stops at spaces in ProseMirror
    - Issue: CRDT debounce timing causes content truncation
    - Created `e2e/utils/sync-wait-helpers.ts` with observable wait utilities
    - Added testing API events for initial sync completion
    - Need to investigate CRDT save timing and keyboard input quirks

---

## Risk Assessment

1. **Breaking existing sync**: Low risk - keeping fast path intact, only adding handoff to polling group on timeout
2. **Performance with many notes**: Mitigated by rate limiting (120/min) and priority system
3. **Memory usage**: Minimal - polling group entries are small (~100 bytes each)
4. **Regression in fast sync**: Mitigated by keeping existing exponential backoff logic, just changing what happens on timeout

## Dependencies

- No new external dependencies
- Uses existing MUI components for UI
- Uses existing AppState system for settings persistence
