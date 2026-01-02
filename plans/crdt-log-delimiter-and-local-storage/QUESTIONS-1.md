# Questions - Round 1

## CRDT Log Delimiter Change

### Question 1: Backward Compatibility for CRDT Logs

The activity logs and deletion logs were recently migrated from `_` to `.` delimiters (commit `decef6e`). They maintain backward compatibility by still reading old formats.

For CRDT logs, should we also maintain backward compatibility (read both old `_` format and new `.` format)?

**Current CRDT formats:**

- New format: `{profileId}_{instanceId}_{timestamp}.crdtlog`
- Old format: `{instanceId}_{timestamp}.crdtlog` (already has backward compat)

**Proposed change:**

- New format: `{profileId}.{instanceId}.{timestamp}.crdtlog`
- Still read old `_` formats for backward compatibility

**Recommendation:** Yes, maintain backward compatibility since CRDT logs sync between instances that may be on different versions.

Do you agree with maintaining backward compatibility?

yes

### Question 2: Timestamp Collision Prefix

The `getUniqueTimestamp()` function in `log-writer.ts` checks for existing files using the prefix pattern. Should this also use `.` delimiter?

```typescript
const prefix = `${this.profileId}_${this.instanceId}_`; // Currently uses _
```

**My assumption:** Yes, update this to use `.` as well.

yes

---

## Local/Paranoid Storage Path Display

### Question 3: Display Path Clarification

I found an interesting discrepancy:

1. **UI displays:** `~/Documents/NoteCove` (via `getDefaultStoragePath()`)
2. **Actual storage location:** `~/Library/Application Support/NoteCove/profiles/{profileId}/storage/`

The UI is currently showing the wrong path! When creating a local/paranoid profile, the actual storage goes to the profile directory, not `~/Documents/NoteCove`.

Should I:

- **Option A:** Fix the display to show the actual path (profile directory + /storage)
- **Option B:** Also update the description text as you requested

**My assumption:** Both - the path display needs to be accurate, and the description should change as you specified.

Don't even show the path. If a user is picking it, they don't care. They shouldn't have to.

B

### Question 4: Path Display Format

Since the profile ID isn't known until profile creation, should the storage config step show:

- **Option A:** A generic placeholder like "Profile directory/storage"
- **Option B:** The actual expanded path template like `~/Library/Application Support/NoteCove/profiles/{ProfileID}/storage`
- **Option C:** Something else?

**My recommendation:** Option A ("Profile directory/storage") since the path with profile ID won't be known at wizard time.

## Just the text I included in the prompt -- don't point at a path or hint at that.

## Website Documentation

This feature doesn't add/remove/change any user-facing features - it's an internal implementation detail (CRDT log naming) and a UI text correction. I don't believe website documentation updates are needed.

Do you agree?

agree
