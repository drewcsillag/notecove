# Questions - CRDT Log Instance ID Feature

## Understanding the Request

Based on my analysis of the codebase, I want to confirm my understanding:

### Current State

1. **CRDT log files** are named `{instanceId}_{timestamp}.crdtlog`
2. **Instance ID** is unique per app installation, persisted in the database
3. **Profile ID** is unique per user profile (e.g., "Work", "Personal")
4. **Activity logs** are named `{instanceId}.log`
5. **About window** currently shows profile name and profile ID, but NOT instance ID

### My Understanding of the Request

1. **Log file prefixes stay as instance ID** (current behavior is correct) - you're describing current state, not requesting a change
2. **Append to existing log files** on startup instead of creating new ones (until hitting rotation limit)
3. **Add instance ID to About window** so it can be seen for debugging/support

Is this understanding correct? If so, I have a few clarifying questions:

No -- logfile prefixes move to profile ID

---

## Q1: Log File Append Behavior

Currently, `LogWriter` always creates a new file on first write (with a unique timestamp). You want it to:

**Option A**: Find the latest log file for this instance and append to it (if under rotation size limit)

**Option B**: Find the latest log file for this instance, verify it's from a recent session, then append

The difference is whether we append to an arbitrarily old file or only to files from recent sessions.

My recommendation is **Option A** - it's simpler and the rotation size limit (10MB) is the natural boundary. The timestamp in the filename still tells us when the file was created.

Which do you prefer?

## It should find the latest log file for this _profile_ and append to it.

## Q2: About Window - Instance ID Display

For the About window, should the instance ID:

**Option A**: Be shown as a separate item below Profile ID (always visible)

```
Profile: Work
{profile-uuid}

Instance: {instance-uuid}
```

**Option B**: Be shown in a collapsed/expandable "Technical Details" section

**Option C**: Be copyable with a "Copy Debug Info" button that copies all IDs

My recommendation is **Option A** - simple and consistent with how Profile ID is shown.

Which do you prefer?

## Agree, option A

## Q3: Truncated Log Files

When appending to an existing log file that might have been truncated (e.g., due to power loss or cloud sync issues), the current code writes a termination sentinel on clean shutdown.

Should we:

**Option A**: Validate the file is intact before appending (reject truncated files)

**Option B**: Always try to append, let the reader handle partial records

The current LogReader already handles truncated records gracefully, so **Option B** is likely fine.

## option A. Correctness is more important than _likely_ fine

## Q4: Existing Behavior Changes

The current behavior (always creating new files) is simpler but creates more files over time. The new behavior (append to latest) is more efficient but adds complexity:

- Need to track which file was last written to
- Need to read file size to check against rotation limit
- Need to handle edge cases (file deleted, corrupted, etc.)

Are you okay with the added complexity? This is a mild recommendation to proceed - the efficiency gain seems worth it.

## I'm good with the added complexity

## Q5: Scope Confirmation

Please confirm this is the full scope:

1. Modify `LogWriter` to append to latest existing file instead of always creating new
2. Add instance ID to About window
3. Update any tests that depend on the old behavior

Is there anything else you wanted included?

No - but again, I want the files to be prefixed with profile id, not instance id. I want the ability for an SD to be opened by multiple profiles on the same instance.
