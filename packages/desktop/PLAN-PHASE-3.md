# Phase 3: Unify SD ID Files

**Progress: 0%**

**Parent:** [PLAN.md](./PLAN.md)

**Dependencies:** None (independent of image discovery work)

## Problem

Two different SD ID systems exist:

- `.sd-id` (hidden) - used by `handleCreateStorageDir` in `handlers.ts`
- `SD_ID` (visible) - used by `SdUuidManager` in shared package, storage format spec

When creating an SD, both files are created with different UUIDs, causing confusion.

## Solution

Switch to `SD_ID` as the single source of truth. Update `handleCreateStorageDir` to use `SdUuidManager` instead of its own `.sd-id` logic.

## Tasks

### 3.1 Write Test for Unified ID Behavior

- [ ] 🟥 Create test: Creating SD should only create `SD_ID` file (not `.sd-id`)
- [ ] 🟥 Create test: Creating SD with existing `SD_ID` should use that ID
- [ ] 🟥 Create test: Database `id` and `uuid` columns should have same value

### 3.2 Update `handleCreateStorageDir`

- [ ] 🟥 Remove `.sd-id` file reading/writing logic (lines 2112-2132 in handlers.ts)
- [ ] 🟥 Import and use `SdUuidManager` from shared package
- [ ] 🟥 Use `SdUuidManager.ensureUuid(path)` to get/create ID
- [ ] 🟥 Pass the UUID as `id` parameter to `database.createStorageDir`
- [ ] 🟥 Verify tests pass

### 3.3 Update `database.createStorageDir`

- [ ] 🟥 Review current implementation (it already uses SdUuidManager internally)
- [ ] 🟥 Modify to accept `id` parameter and skip internal UUID generation if provided
- [ ] 🟥 Ensure it doesn't create duplicate `SD_ID` if already exists
- [ ] 🟥 The `id` and `uuid` columns should store the same value
- [ ] 🟥 Verify tests pass

### 3.4 Handle Legacy `.sd-id` Files

- [ ] 🟥 Write test: SD with only `.sd-id` (no `SD_ID`) should migrate the ID
- [ ] 🟥 Write test: SD with both files (different IDs) should prefer `.sd-id` and create matching `SD_ID`
- [ ] 🟥 Add migration logic in `handleCreateStorageDir`:
  ```
  1. Check for SD_ID first (new standard)
  2. If not found, check for .sd-id (legacy)
  3. If .sd-id found, use that ID and create SD_ID with same value
  4. Log migration: "[SD] Migrated .sd-id to SD_ID: {id}"
  5. Optionally delete .sd-id after successful migration
  ```
- [ ] 🟥 Verify test passes

### 3.5 Code Review - Phase 3

- [ ] 🟥 Launch subagent to review Phase 3 implementation
- Review checklist:
  - **Bugs**: Race conditions during migration? Existing SDs affected?
  - **Edge cases**: Both files exist with different IDs? Neither file exists?
  - **Error handling**: File permission errors during migration?
  - **Test coverage**: All migration paths tested?
  - **Project patterns**: Consistent with SdUuidManager patterns?
  - **Backwards compatibility**: Existing SDs with `.sd-id` still work?
  - **Cross-machine**: What happens when different machines have different file states?
  - **Cleanup**: Should we delete `.sd-id` after migration or leave it?

### 3.6 Manual Verification

- [ ] 🟥 Check the problematic SD at `/Users/drew/My Drive/Shared With Work/NoteCove-Shared`
- [ ] 🟥 Before: has both `.sd-id` (d3772c38...) and `SD_ID` (c3e42263...)
- [ ] 🟥 After running app: should have unified ID files
- [ ] 🟥 Verify app still works correctly with this SD

### 3.7 Commit Phase 3

- [ ] 🟥 Run CI (`pnpm ci-local`)
- [ ] 🟥 Commit with message: `refactor: unify SD ID files to use SD_ID standard`

## Design Notes

### Migration Strategy

When encountering an SD directory:

```
Case 1: Only SD_ID exists
  → Use it (standard case, no migration needed)

Case 2: Only .sd-id exists
  → Read .sd-id, create SD_ID with same value
  → Delete .sd-id (optional, but recommended for cleanliness)

Case 3: Both exist with SAME ID
  → Use the ID, delete .sd-id

Case 4: Both exist with DIFFERENT IDs
  → Use .sd-id value (it's what the app has been using)
  → Overwrite SD_ID with .sd-id value
  → Delete .sd-id
  → Log warning about the inconsistency

Case 5: Neither exists
  → Generate new UUID, write to SD_ID
```

### Why Prefer `.sd-id` When Both Exist

The `.sd-id` file is what `handleCreateStorageDir` has been using. Any notes created reference the ID from `.sd-id`. If we switched to `SD_ID`, existing notes would reference a non-existent SD.

### File Locations Affected

| File                                 | Current Behavior                 | New Behavior                                      |
| ------------------------------------ | -------------------------------- | ------------------------------------------------- |
| `handlers.ts:handleCreateStorageDir` | Reads/writes `.sd-id`            | Uses `SdUuidManager` for `SD_ID`                  |
| `database.ts:createStorageDir`       | Uses `SdUuidManager` for `SD_ID` | Accepts ID from caller, skips internal generation |
| `SdUuidManager`                      | Manages `SD_ID` only             | No change needed                                  |
