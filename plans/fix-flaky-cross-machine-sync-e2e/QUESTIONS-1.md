# Questions - Phase 1

## Root Cause Analysis

After running the test and analyzing the failure, I've confirmed the issue:

1. **Test output shows**: `Instance 2 note count: 2` (note was discovered) but `Instance 2 has note with title "New Note Created By Instance 1": false`

2. **Error context shows**: The note list displays title "New" instead of "New Note Created By Instance 1"

This confirms the hypothesis: the FileSyncSimulator copies file **existence** but not file **completeness**. The current check only verifies note IDs match:

```typescript
expect(sd2Contents.notes.map((n) => n.id).sort()).toEqual(
  sd1Contents.notes.map((n) => n.id).sort()
);
```

But it doesn't verify that the **log sizes match**, meaning the CRDT log content (which contains the title) may not be fully synced.

## Confirmed Fix Approach

The `inspectSDContents` function already returns `totalLogSize` for each note. We should add verification that the log sizes match between SD1 and SD2 before launching Instance 2.

## Questions

### Q1: Other Test Files

Should I apply the same fix pattern to all three test files mentioned in the prompt?

1. `cross-machine-sync-creation.spec.ts` - `totalLogSize` comparison before launch
2. `cross-machine-sync-updates.spec.ts` - Need same verification for live sync tests?
3. `cross-machine-sync-comments.spec.ts` - Same for comment sync tests?

No. Ultimately, part of the test is to ensure that if it starts with incomplete copies, but the data eventually makes it later, that the
second instance will pick up the rest of the data when it finally arrives. I believe the prompt is wrong here. If there are other tests that
were "fixed" to wait until the files made it there, we should "unfix" them to work this way.

But the takehome message is that NoteCove should be able to start with incomplete files, but we shouldn't check for sync completeness in the app until the files have fully synced over.

### Q2: Polling vs Fixed Waits

The tests currently use fixed `waitForTimeout(8000)` calls. Should I:

- Option A: Keep the fixed wait but add log size verification after it
- Option B: Replace with a polling loop that waits for log sizes to match
- Option C: Both - poll for log sizes to match, with a timeout

I'm leaning toward **Option B or C** since it would make tests faster when sync is quick and more reliable when sync is slow.

Option B. The file syncer will ensure that the file eventually has the log sizes matching. It may take a minute (given the current polling mechanism) for the second instance to notice it.

### Q3: Activity Log Sizes

Should I also verify activity log file sizes match, or just the note CRDT logs? Activity logs may contain the activity entries that trigger note discovery.

but the crdt logs tell you when the other instance can acutally see the content which is presumably what we're checking here. The log files are merely a performance optimization to tell the second instance that there's something to go looking for.

### Q4: Helper Function Location

Should I add a new helper function like `waitForSDSync(sd1, sd2, options)` to:

- `sync-simulator.ts` (alongside existing inspection utilities)
- `cross-machine-sync-helpers.ts` (alongside `getFirstWindow`)
- A new file for sync wait utilities

That would be good

### Q5: Folder Log Sizes

The `inspectSDContents` also tracks folder logs. Should folder log sizes be verified too, especially for the folder move tests?

Yes

### Q6: Website Documentation

This is a bug fix for test infrastructure, not a user-facing feature. I don't believe website documentation changes are needed. Please confirm.

confirmed
