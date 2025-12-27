# Questions - Part 2: Profile ID Implications

Thanks for the clarification. Switching from instance ID to profile ID for log file naming is a more significant change with CRDT implications. A few follow-up questions:

---

## Q6: Multi-Machine Same Profile Scenario

If the same profile is used on two different machines (e.g., "Work" profile on laptop and desktop), they would have:

- Same **profile ID**
- Different **instance IDs**

With log files named by profile ID, both machines would try to append to files with the same prefix. This could cause:

- Sequence number conflicts (both machines start at sequence 1)
- Cloud sync conflicts when writing to the same file

**How should this be handled?**

**Option A**: Keep instance ID in the filename, but also include profile ID

- Format: `{profileId}_{instanceId}_{timestamp}.crdtlog`
- Allows multiple profiles per instance AND multiple instances per profile

**Option B**: Use only profile ID, but each machine creates separate files (via unique timestamp)

- Format: `{profileId}_{timestamp}.crdtlog`
- On restart, only append to files YOU created (need to track this somehow)

**Option C**: Use only profile ID, accept that same-profile-multi-machine is not a supported scenario

- If someone uses the same profile on two machines, things may break

My recommendation is **Option A** - it's the most flexible and handles all scenarios.

Profiles have locks associated with them to prevent multiple running copies of the app from opening with the same profile.

## I like A, but with a more dense encoding of the uuids that's filesystem naming safe.

## Q7: Vector Clock Impact

The vector clock currently tracks sequences per instance ID:

```typescript
interface VectorClock {
  [instanceId: string]: {
    sequence: number;
    offset: number;
    file: string;
  };
}
```

If we change file naming but keep vector clocks keyed by instance ID, the system still works correctly for CRDT merging. But if we also change vector clocks to profile ID, we'd have the multi-machine conflict issue.

**Should vector clocks remain keyed by instance ID?**

My recommendation: **Yes, keep instance ID for vector clocks**. The file naming prefix doesn't need to match the vector clock key.

## If there are multiple profiles from the same instance id, this won't work. I want it by profile, or we could do by instance and profile

## Q8: Activity Logger and Deletion Logger

These also use instance ID for their log file names:

- `{activityDir}/{instanceId}.log`
- `{deletedDir}/{instanceId}.log`

**Should these also change to profile ID?**

If yes, the same multi-machine considerations apply.

## yes

## Q9: Migration Strategy

Existing storage directories have log files named with instance ID. When we change to profile ID:

**Option A**: Ignore old files, start fresh with new naming

- Old files still readable (LogReader parses any prefix)
- May cause duplicate content if old files are re-read

**Option B**: Migrate old files on startup (rename them)

- Clean transition
- Risk if migration fails

**Option C**: Support both naming conventions during a transition period

- Read old files, write new format
- Eventually old files get compacted/archived

My recommendation is **Option C** - graceful transition.

## C

## Q10: Profile ID Availability

Currently, `LogWriter` and related classes receive `instanceId` at construction. Profile ID would need to be passed instead.

Looking at the code path:

```
index.ts → AppendLogManager(instanceId) → NoteStorageManager(instanceId) → LogWriter(instanceId)
```

The `selectedProfileId` is available in `index.ts`. Should be straightforward to pass it through.

**Is `selectedProfileId` always available?** (I believe it is, just confirming)

It should be
