# Questions - Fix Sloppy Sync Test

## Context

The `cross-machine-sync-deletion-sloppy.spec.ts:249` test fails because Instance 2 loads CRDT files before they're fully synced by FileSyncSimulator. The test uses "sloppy sync" (50% chance of partial file sync, 30-70% of file content) to simulate real-world cloud sync conditions.

## Understanding Confirmed

From code analysis:

1. **The problem occurs in this sequence:**
   - Instance 1 writes content to CRDT log file (grows to 8178 bytes)
   - Instance 1's ActivityLogger records the activity (sequence N)
   - FileSyncSimulator partially syncs CRDT log (only 4870 of 8178 bytes)
   - FileSyncSimulator syncs activity log faster (activity logs sync in 200-500ms, CRDT logs in 500-1500ms)
   - Instance 2's ActivitySync detects new activity entry with sequence N
   - Instance 2 calls `checkCRDTLogExists()` - file exists but is truncated
   - Instance 2 reads truncated CRDT file, misses content

2. **Current defenses that aren't enough:**
   - `checkCRDTLogExists()` verifies the CRDT log has the expected sequence number
   - BUT: a truncated file can still have valid sequence numbers for the records it contains
   - The problem is the FILE is there and VALID but INCOMPLETE

3. **Key insight from the code:**
   - Activity log entry format: `{noteId}|{instanceId}_{sequence}`
   - The sequence is the CRDT log sequence for that instance
   - `checkCRDTLogExists()` iterates all records to find highest sequence
   - If file is truncated mid-record, it stops reading and returns the highest sequence found
   - If truncation happened AFTER the last complete record, the sequence check passes but content is missing

## Questions

### Q1: What information is available in the activity log entry?

Looking at the code, activity log entries contain:

- `noteId|instanceId_sequence`

**Question**: Can we add the expected file size or a hash to the activity log entry so the receiving instance can verify the CRDT file is complete?

Pros:

- Clean solution - receiver knows exactly what to expect
- Works for real cloud sync scenarios (not just simulator)

Cons:

- Requires format change to activity log
- Backward compatibility concerns

No. The file under normal circumstances will grow as the user edits the doc as it is a log. So it's rarely ever _complete_ per se. The only time it's complete is when it's hit its max size and rolls to a new file. But for this test, that's not going to happen. You do have the length fields in the log to know whether you have a complete record though.

### Q2: Should we prioritize simulator-only fixes or production fixes?

The test uses extreme conditions (50% partial sync, 30-70% content). Real cloud services like iCloud/Dropbox rarely have this level of partial file states.

**Options:**

1. **Simulator fix only**: Make FileSyncSimulator complete CRDT files before activity logs - quick fix, test passes, but doesn't improve production robustness
2. **Production fix**: Add retry/verification logic that handles partial files in real deployments - more work, but benefits real users
3. **Both**: Quick simulator fix to unblock, then production hardening as follow-up

production fix - that's the reason why the test exists in the first place, to test things that may be unlikely, but could happen.

### Q3: What's the acceptable retry behavior for the test?

Currently `checkCRDTLogExists()` is called in a retry loop by `pollAndReload()` with exponential backoff up to 60 seconds. If the CRDT file is partially synced, it will retry.

**Problem**: The current check only verifies sequence number, not file completeness.

**Options:**

1. Add file size verification (requires knowing expected size - see Q1)
2. Add content hash verification (requires computing hash on write)
3. Add "last record complete" verification (check if file ends at record boundary)
4. Track file size changes and wait until stable (poll for stable size)

3

### Q4: Is modifying the activity log format acceptable?

Adding expected file size to activity entries would require:

- Changing ActivityLogger to include file size
- Changing parseActivityFilename to extract file size
- Backward compatibility for old format entries

This is a more invasive change but provides a clean solution.

No. See answer to Q1 as to why.

## Recommendation

Based on analysis, I recommend **Option 3 from Q2 (Both)** with this approach:

1. **Immediate fix (simulator-only)**: Modify FileSyncSimulator to ensure CRDT files are completely synced before their corresponding activity log entries are synced. This unblocks the test.

2. **Production hardening (follow-up)**: Add "file stability check" - if a CRDT file was recently modified (within last 1-2 seconds), wait for it to stabilize before reading. This handles real cloud sync scenarios without format changes.

The immediate fix is cleanest because it addresses the root cause in the test infrastructure. The production hardening is a reasonable defensive measure for real-world deployments.

## Waiting for User Input

Before proceeding with the plan, please confirm:

1. Is Option 3 (simulator fix + production hardening) acceptable?
2. For the simulator fix, should CRDT files complete sync BEFORE activity logs are synced? (This is the cleanest approach)
3. For production hardening, is a "wait for file stability" approach acceptable, or do you prefer a format change to include expected file size?
