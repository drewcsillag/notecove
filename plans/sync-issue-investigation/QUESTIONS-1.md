# Sync Issue Investigation - Questions

## Context Summary

Investigating a sync issue where:

- Note `f8530b80-3e99-42d5-bb16-186cb84efd9c` has different content on two machines
- **Local machine** (profile `af7545b4-c309-4bc0-942e-bfef06130437`): Full text "Editor isn't updating live as it's supposed to with slower syncs at least I did get a sync error that I could retry"
- **Other machine** (profile `5d03d6a1-3910-4c84-96d2-026c651ea6b5`): Truncated "Editor isn't updating live as it's supposed to with slower syncs at\n least"
- "Reload Note from CRDT Logs" was tried on the other machine but didn't help

## Findings from CRDT Log Analysis

The CRDT log files on the **local machine** are complete:

- **7 log files** total
- **Instance 352c1597** (70 records, sequence 1-70, no gaps)
- **Instance cc614188** (278 records, sequence 1-278, no gaps)
- When all 348 records are applied, the document contains the **full text**

This means the CRDT data IS complete on disk (at least on this machine).

## Questions to Clarify

### 1. Cloud Storage Sync Status

When you checked the other machine, were all the log files fully synced?

The files on this machine:

```
352c1597-8ee6-49b8-b59d-a85aade26e9c_1766351469799.crdtlog (1023 bytes)
352c1597-8ee6-49b8-b59d-a85aade26e9c_1766414350352.crdtlog (549 bytes)
352c1597-8ee6-49b8-b59d-a85aade26e9c_1766414582369.crdtlog (1315 bytes)
cc614188-8e7e-4821-865f-6f8cfcc41b18_1766413775700.crdtlog (373 bytes)
cc614188-8e7e-4821-865f-6f8cfcc41b18_1766414400467.crdtlog (805 bytes)
cc614188-8e7e-4821-865f-6f8cfcc41b18_1766414574789.crdtlog (2665 bytes)
cc614188-8e7e-4821-865f-6f8cfcc41b18_1766414787090.crdtlog (4158 bytes)
```

- Are all 7 files present on the other machine?
- Do they have the same sizes?
- Is there any cloud sync indicator (e.g., iCloud "downloading" badge)?

They are all there and the same size.

### 2. What is the Instance ID on the Other Machine?

Which instance ID is the other machine using?

- If it's `352c1597...`, that's the one with 70 records
- If it's `cc614188...`, that's the one with 278 records (the more active one)
- Or is it a different instance ID entirely?

This will help determine if it's a "can't see own updates" vs "can't see other instance's updates" issue.

cc614188-8e7e-4821-865f-6f8cfcc41b18

### 3. Database Cache State

After "Reload Note from CRDT Logs" on the other machine:

- Did you observe any errors in the console/logs?
- Was the note open in the editor at the time?

The reload function deletes the DB cache first, so stale cache isn't likely the issue. But errors during reload could explain it.

I don't but I also can't see the terminal console logs as it's running as a regular macos app (so there is no terminal)
The note was open at the time. Though I have switched between it and another note.

Also which may be important, they're both running the version of the software at the v0.1.8 git tag. I don't believe there are any significant changes since then, but please double check. Actually going back as var as v0.1.6 might be needed now that I think of it.

### 4. Higher Sync Latency Hypothesis

You mentioned sync latency is "much higher" now. This could cause:

1. **Truncated files** - File sync starts but doesn't complete before read
2. **Activity log race** - Activity log syncs before CRDT log files
3. **Stale entry detection** - Old entries marked as stale incorrectly

How much higher is the latency? Seconds? Minutes?

Probably about a minute or so. When last I had tested sync, both instances were on the same machine. Now it's syncing across Google Drive.

### 5. Sync Error Details

You mentioned getting a "sync error that I could retry". Can you provide:

- What the error said?
- When did it appear (during normal operation or after reload)?
- Is the error persistent or did retrying work?

It showed up in the sync status panel (I got the toast for it, but it would've shown up in the panel that you get to via the Tools>Sync Status menu item

### 6. Live Sync Issues

You mentioned "live syncing used to work ok" but is now problematic.

- When did this change?
- Did you update Google Drive, the OS, or anything that might affect file watching?
- Are both machines seeing each other's activity logs?

Somewhere since v0.1.6 to v0.1.8

Sometimes switching notes showed the updates, mostly from the instance on the other machine to the local machine, less so the other way.
IDK if they're seeing the activity logs.

---

## Next Steps After Answers

Based on answers, I'll investigate:

1. If files aren't synced: Cloud sync reliability issue (outside NoteCove's control, but we can add better detection/retry)
2. If files are synced but wrong sizes: Possible file truncation during sync
3. If files match but still wrong: Bug in CRDT loading/merging logic
4. If activity log issues: Activity sync polling/stale detection problem

I can also:

- Add diagnostic logging you could capture from the other machine
- Build a tool to compare CRDT logs between machines (run on both, compare outputs)
- Add better sync status indication in the UI

I would be interested in more tooling availble in the app to diagnose these sorts of things better for when they happen, to go along side the tooling we have already via the Tools menu. I can see that the plan might wind up creating another plan after implementing these.
