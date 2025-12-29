# Plan Critique - Staff Engineer Review

## 1. Ordering Issues

### Problem: Settings comes too late

Phase 4 (Settings Infrastructure) is after Phases 2-3 which need configurable settings:

- Fast path max delay (60s default)
- Poll rate per minute (120 default)
- Full repoll interval (30 min default)

**Fix**: Move Phase 4 to right after Phase 1. This way when we implement handoff and full repoll, settings are already wired up.

### Problem: Stale Sync removal is split awkwardly

Phase 2.3 removes `staleEntries` from ActivitySync, but Phase 9 removes the UI that displays them. This leaves a broken UI (calling APIs that no longer work) from Phase 2 until Phase 9.

**Fix**: Combine stale sync removal into a single phase right after the polling group is integrated. Remove backend + frontend together.

### Problem: Sync Status Window is late

Phase 8 (visibility window) comes after most implementation. We'll be debugging blind.

**Fix**: Add minimal logging/IPC for polling group status early (Phase 2), expand to full UI later.

---

## 2. Feedback Loop

**Current order** gets us to something testable at Phase 2, but we can't:

- Configure settings until Phase 4/7
- See what's happening until Phase 8

**Better order for faster feedback**:

1. Phase 1: Core Polling Group (testable via unit tests)
2. Phase 4: Settings Infrastructure (can configure behavior)
3. Phase 2: Fast Path Integration (core feature working)
4. Phase 9: Remove Stale Sync (clean up broken UI immediately)
5. Phase 8 (partial): Basic IPC for polling group status (debugging visibility)
6. Phase 5: Open Notes tracking
7. Phase 6: Recently Edited tracking
8. Phase 3: Full Repoll
9. Phase 7: Settings UI
10. Phase 8 (complete): Full Sync Status Window
11. Phase 10: Documentation
12. Phase 11: Testing

---

## 3. Debug Tools

**Gap**: No visibility into polling group until Phase 8.

**Recommendation**: Add these early (Phase 2):

- Console logging for polling group add/remove/poll events
- Simple IPC to get polling group snapshot (can use existing sync:getStatus pattern)
- Leverage existing test instrumentation patterns (test:activity-watcher-debug, etc.)

---

## 4. Missing Items

### 4.1 Timer/Interval Driver

The plan mentions rate limiting (2/sec) but doesn't specify what drives the polling loop.

**Add to Phase 1**: Polling group needs an internal timer that fires every 500ms (for 2/sec) and calls `pollNext()`. Should be:

- Startable/stoppable
- Respects rate limit
- Skips if nothing to poll

### 4.2 Cleanup on Note Removal

What happens when a note leaves the polling group? Need to:

- Cancel any pending operations for that note
- Update UI state

**Add to Phase 1.2**: `remove()` method should handle cleanup.

### 4.3 Multi-Window Coordination

Multiple windows can report open notes. Need to:

- Union all open notes across all windows
- Handle window close (remove that window's notes from priority set)

**Add to Phase 5**: Track open notes per-window, union for priority.

### 4.4 Sequence Caught-Up Check

When a poll succeeds, how do we know if all sequences are caught up?

**Clarify in Phase 2**: After successful reload, check if CRDT log sequences >= expected sequences for all instances. If yes, remove from polling group. If no, update expected and keep polling.

### 4.5 Max Age / Unbounded Growth Protection

What if notes never sync? The polling group could grow forever.

**Add to Phase 1**: Consider max entries (e.g., 10,000) with LRU eviction, or max age (e.g., 7 days) with warning in UI.

---

## 5. Risk Assessment Gaps

### Unbounded Growth

Not addressed. If cloud sync is broken for days, polling group grows.

**Mitigation**: Add max size limit with UI warning ("X notes haven't synced in Y days").

### Rate Limit Edge Case

What if there are 1000 high-priority notes? All get polled before any normal-priority notes.

**Mitigation**: Reserve some capacity for normal priority (e.g., 80% high, 20% normal minimum).

---

## 6. Questions for User

Based on the critique, a few questions emerged:

1. **Max polling group size**: Should we cap at some number (e.g., 10,000) to prevent memory issues? What happens to entries over the cap?

The polling group shouldn't grow without bound except in extremely pathological cases. This would require that an instance adds a ton of activity log messages for different notes and _none_ of the crdtlogs make it for a long amount of time.

Would another case be the periodic resync be the concern? While 83 minutes for that amount of polling is a lot, if things are that backed up, it could take a while. Maybe if it's gone once around and exceedingly few have left the polling group?

I'm debating about another tweak to this: if a note in the polling group gets a hit (we find crdt updates for it), that we don't count it towards the rate limit (or at least not at full value). So if for some reason you do have an instance that was disconnected and was very productive, and resyncs, that the resync would happen pretty quickly, rather than having to wait 83 minute for catchup.

Critique the idea and any other concerns you have in this space. But give me a rough estimate of how much meory 10k notes would take).

2. **Priority fairness**: If there are 500 open notes, should normal-priority notes still get some polling time? (Suggest: yes, reserve 20% for normal)

yes

3. **App restart behavior**: The polling group doesn't persist across restarts. Startup full repoll covers this. Is that acceptable?

That's fine
