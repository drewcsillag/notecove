# Questions for UUID Compact Form Fix

## Analysis Summary

I've analyzed the codebase and found the following:

### The Issue

The `profileId` that gets passed to `AppendLogManager` (and subsequently to activity files and CRDT log files) is taken directly from the profile configuration:

```typescript
// index.ts line 452
const profileId = selectedProfileId ?? instanceId;
```

While `instanceId` IS migrated to compact form (lines 437-450), the `selectedProfileId` comes directly from `profiles.json` and is NOT normalized. Old profiles created before the compact UUID migration may have full-form 36-char UUIDs.

### Affected Files

1. **Activity log files**: `{profileId}_{instanceId}.log`
2. **CRDT log files**: `{profileId}_{instanceId}_{timestamp}.crdtlog`
3. **Activity log content**: The line format is `noteId|profileId_sequenceNumber`

### Complication

The profile ID is used as a directory name: `profiles/<profile-id>/` for storing the profile's database. We cannot change the actual stored profile ID without renaming directories, which would be a more invasive migration.

---

## Questions

### 1. Profile ID Migration Scope

There are two approaches:

**Option A: Normalize at runtime only**

- Convert `selectedProfileId` to compact form when creating `profileId` for AppendLogManager
- The profiles.json still stores the original ID (directory mapping preserved)
- Simple, non-breaking change

**Option B: Full profile ID migration**

- Migrate profile IDs in profiles.json to compact form
- Rename profile directories from `profiles/<old-uuid>/` to `profiles/<compact-uuid>/`
- More invasive but consistent

**Which approach do you want?**

- My recommendation is **Option A** since profile IDs are just used for filenames in the SD, not for the profile data directory, and it's much simpler.

Option B - better if all of the profile and instance ids are the new format everywhere, rather than having to chase this down in other places.

### 2. Existing Files

There will be activity and CRDT log files that were already written with full-form UUIDs in their names and content.

**For file NAMES (`{profileId}_{instanceId}*.log` or `.crdtlog`):**

- The reading code (log-writer.ts, activity-sync.ts) already supports both formats for backward compatibility
- New files will use compact form; old files will still be read correctly

**For activity log CONTENT (`noteId|profileId_sequenceNumber`):**

- Old lines will still work because sync just parses the format
- New lines will use compact profileId

**Does this gradual transition approach work for you?** (Old files keep old format, new files use new format, everything remains compatible)

No need to gradually transition, I've got an installed base that's just me, so I can manage my own stuff.

### 3. Website Documentation

This is an internal bug fix with no user-facing feature changes. The fix doesn't add/remove/change any documented features.

No doc changes
**Confirm: No website documentation update needed?**
