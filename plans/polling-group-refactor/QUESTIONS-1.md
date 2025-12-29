# Polling Group Refactor - Questions

## Current State Understanding

Based on my analysis, here's how the current sync system works:

1. **Activity Logging**: When a note is edited, `ActivityLogger` writes `noteId|instanceId_sequence` to the instance's activity log file
2. **Activity Sync**: `ActivitySync` polls other instances' activity logs every 3 seconds and processes new entries
3. **Exponential Backoff**: When an activity log entry is found, `pollAndReload()` tries to reload the note with exponential backoff delays: `[100, 200, 500, 1000, 2000, 3000, 5000, 7000, 10000, 15000]` ms - total ~76 seconds timeout
4. **Stale Detection**: If an entry is >50 sequences behind the highest for that note/instance, it's marked stale

**The Problem**: After the 76-second timeout, the polling stops for that entry. If the cloud sync is slower (e.g., laptop was closed for hours), the change may arrive later but we've already given up.

## Questions

### 1. Polling Group Membership

You mentioned three sources of notes for the polling group:

- Notes where activity log said there was a change but we haven't seen it yet
- Notes currently open in the editor

**Question**: Are there any other sources you'd want to add notes to the polling group? For example:

- Recently edited notes (within last N minutes)?
- Notes that had sync failures (currently marked as "stale")?

Both of those, yes. Great Idea!

### 2. Polling Group Exit Criteria

**Question**: When should a note leave the polling group?

- When we successfully reload and the sequence matches?
- After a certain number of failed attempts (effectively giving up)?
- Never automatically (user must dismiss)?
- When the note is no longer open AND the change was synced?

When the note is no longer open and the sequence numbers are caught up with what we have from the activity logs.

### 3. Rate Limiting Granularity

You said "120 notes per minute (2/sec)".

**Question**: Should this be:

- A strict rate limit (never exceed 2/sec even momentarily)?
- An average over time (could burst to 4 then slow down)?
- Per-SD rate limit or global across all SDs?

average over time. and global across all SDs

### 4. Polling Priority

When there are more than 120 notes in the polling group:

**Question**: Should there be priority ordering?

- FIFO (circular queue as you mentioned)
- Open notes get priority over background notes
- Notes with more recent activity log entries get priority
- All equal (pure round-robin)

Open notes get priority over background notes, but otherwise FIFO

### 5. Full Background Repoll

You mentioned a background poll of "all notes" every 30 minutes.

**Questions**:
a. Does "all notes" mean all notes in the SD, or just notes in the database/index?
b. Should this repoll also run at startup with a configurable delay (e.g., 5 minutes after startup)?
c. If there are 1000 notes and we poll at 2/sec, a full repoll takes ~8 minutes. Is that acceptable?
d. Should repolls be cancelable (e.g., if user starts editing, pause the background repoll)?

a. all notes in all SDs
b. No need to delay, but yes at startup
c. this is fine. I just want to ensure that they eventually show up
d. I don't think there's a need to cancel a repoll. At worst we'll poll more than necessary.

### 6. Settings Granularity

You want an "Advanced" tab with:

- Polling rate / max-per-minute
- Periodic all-poll interval (default 30 minutes)

**Questions**:
a. Should there be a way to disable periodic all-poll entirely (set to 0 or "never")?
b. Should there be per-SD settings or just global settings?
c. Should there be a "Sync Now" button to trigger immediate full repoll?
d. Should there be visibility into the polling group (show which notes are being polled)?

a. yes
b. Good point, global with per-sd-overrides
d. yes, via a window accessible via tools>advanced.
c. yes, in the window I mentioned in (d) above

### 7. Interaction with Existing Code

The current implementation has:

- `pendingSyncs` map tracking notes with active poll-and-reload chains
- `staleEntries` array for entries that exceeded the gap threshold
- 3-second poll interval for activity log changes

**Question**: Should the new polling group:

- Replace the existing `pendingSyncs` mechanism entirely?
- Work alongside it (pendingSyncs for fast/recent, polling group for slow/persistent)?
- Absorb notes from `staleEntries` (retry even after timeout)?

replace entirely

### 8. CRDT Log Check

Currently, `pollAndReload()` checks if the CRDT log has the expected sequence before reloading.

**Question**: For the polling group, should we:

- Always check CRDT logs exist before attempting reload?
- Just attempt reload and handle errors (simpler but may generate noise)?
- Track the expected sequence per note in the polling group?

Give me pros and cons and a recommendation

### 9. Memory/Resource Concerns

With potentially hundreds of notes in the polling group:

**Question**: Any concerns about:

- Memory usage for tracking polling group state?
- CPU/disk usage from continuous polling?
- Network/cloud sync implications (frequent file reads)?

no concerns. as to network/cloud implications, being configurable allows users to tune if they want.

### 10. Testing Strategy

**Question**: How would you like to test this?

- Unit tests for the polling group data structure and rate limiting
- Integration tests with mock file system
- E2E tests with real cloud sync delays
- Manual testing scenarios you want to verify?

I think the existing cross machine tests might cover this nicely. For testing we may need to tune polling rates and such, but they hopefully will pass more reliably.

Also, at the end of this, we'll want to update the documentation about this stuff that's on the website (in the website directory).
