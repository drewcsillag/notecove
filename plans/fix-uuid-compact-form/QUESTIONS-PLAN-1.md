# Plan Review Questions

## 1. defaultProfileId Migration

When migrating profile IDs, `profiles.json` also has a `defaultProfileId` field that may reference a full-form UUID. This needs to be updated as well.

**Plan update needed:** Add updating `defaultProfileId` to Step 1.

## 2. Error Handling for Directory Rename

If the directory rename fails (permissions, file lock), we could corrupt state if profiles.json is already updated.

**Proposed approach:**

1. Rename directory first
2. Only update profile ID in memory if rename succeeds
3. If rename fails, log warning and keep old ID (app will still work)
4. After all migrations attempted, save profiles.json

This is safe because:

- If rename fails but profiles.json isn't updated → app uses old ID, works fine
- If rename succeeds and profiles.json update fails → directory exists at new path, next startup will find it

**Is this acceptable?** Since you mentioned single-user installed base, I think simple error logging is fine rather than complex rollback logic.

## 3. Debug Logging

Should add console.log statements for profile migration similar to instance ID migration for debugging.

**Plan update needed:** Add logging to Step 1.

---

**Summary of plan updates needed:**

1. Add `defaultProfileId` update to Step 1
2. Add error handling with "skip on failure" approach
3. Add debug logging

These are minor additions to Step 1. No new steps needed.

**If you agree, say 'continue' and I'll update the plan and proceed to Phase 4.**
