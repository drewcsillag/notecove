# Fix UUID Compact Form Implementation Plan

**Overall Progress:** `100%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)

## Summary

The desktop app is writing files with full-form UUIDs (36 chars) instead of compact form (22 chars) for:

1. Activity log filenames: `{profileId}_{instanceId}.log`
2. Activity log content: `noteId|profileId_sequenceNumber`
3. CRDT log filenames: `{profileId}_{instanceId}_{timestamp}.crdtlog`

Root cause: `profileId` from profiles.json is not migrated to compact form before use.

## Approach

Full migration (Option B):

1. Migrate profile IDs in profiles.json to compact form on load
2. Rename profile directories from `profiles/<old-uuid>/` to `profiles/<compact-uuid>/`
3. Normalize `profileId` at runtime when passing to storage managers

## Tasks

- [x] 🟩 **Step 1: Add profile ID migration to ProfileStorage**
  - [x] 🟩 Write failing test for profile ID migration in ProfileStorage
  - [x] 🟩 Implement migration logic in `loadProfiles()` to:
    - Detect full-form profile IDs using `isFullUuid()`
    - Convert to compact form using `uuidToCompact()`
    - Rename profile directory from old path to new path
    - Update profile.id with new compact ID
    - Update `defaultProfileId` if it references a migrated profile
    - Handle rename failures gracefully (log warning, skip migration for that profile)
    - Add debug logging for migration events
  - [x] 🟩 Verify test passes
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 2: Add runtime normalization in index.ts**
  - [x] 🟩 Normalize `selectedProfileId` to compact form before creating `profileId`
  - [x] 🟩 This is a safety net in case migration in ProfileStorage hasn't run yet
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 3: Run CI and verify**
  - [x] 🟩 Run full CI suite (format, lint, typecheck, tests)
  - [x] 🟩 Fix any issues found
  - [x] 🟩 Update PLAN.md with final status

## Implementation Summary

### Files Modified

1. **`packages/shared/src/storage/types.ts`** - Added optional `rename` method to FileSystemAdapter interface
2. **`packages/shared/src/profiles/profile-storage.ts`** - Added `migrateProfileIds()` method that:
   - Detects full-form UUIDs on profile load
   - Renames profile directories
   - Updates profile IDs and defaultProfileId
   - Saves migrated config
3. **`packages/desktop/src/main/storage/node-fs-adapter.ts`** - Implemented `rename()` method
4. **`packages/desktop/src/main/index.ts`** - Added runtime normalization of profileId as safety net
5. **`packages/shared/src/profiles/__tests__/profile-storage.test.ts`** - Added 5 tests for migration logic

## Notes

- **SD files (activity/CRDT logs)**: The reading code already supports both full and compact formats for backward compatibility. New files will be written with compact IDs. Old files in SDs remain readable.
- **Profile directories**: These are local app data (`~/Library/Application Support/NoteCove/profiles/<id>/`) and safe to rename.
- **Error handling**: If directory rename fails, log warning and skip that profile's migration. App will continue to work with full-form ID.
- **No doc changes needed** per user confirmation.

## Deferred Items

None
