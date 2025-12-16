# Plan Critique & Questions

## Ordering Concerns

### 1. Documentation vs Bug Fixes Order

**Current plan**: Write documentation first, then fix bugs.

**Concern**: If I write docs first, they'll describe the buggy behavior. Then I fix the bugs, and the docs need updating.

**Proposal**: Reorder to:

1. Fix bugs first (they inform my understanding)
2. Write documentation after (describes correct behavior)
3. This also gets you working fixes sooner

**Question**: Do you agree with reordering?

## Bug #2 Edge Cases

### 2. Deletion During Sleep

**Scenario**:

- Node A creates note X while B is sleeping
- Node A deletes note X (permanently)
- Node B wakes up

**Current plan**: Discovery scans notes directory, finds note X's CRDT files, imports it.

**Problem**: The note was deleted, but B imports it as a new note.

**Proposed fix**: Before importing a discovered note, check if it appears in any deletion log. Skip import if found.

**Question**: Do you want me to handle this edge case?

### 3. Folder Tree Sync

**Concern**: If node A creates a note in a NEW folder while B is sleeping, B will:

1. Discover the note (via disk scan)
2. Load the note, see `folderId: "folder-123"`
3. Insert into database with that folder ID
4. But folder-123 doesn't exist in B's folder tree yet

**Impact**: Note appears but folder is missing. Folder will sync eventually via folder tree CRDT, but there may be UI glitches.

**Proposed mitigation**: During discovery, also trigger a folder tree reload for the SD.

**Question**: Is this worth addressing, or is the "folder syncs eventually" behavior acceptable?

### 4. Discovery Running During Active Sync

**Concern**: If discovery runs while cloud storage is actively syncing CRDT files, we might:

- Find a note directory that exists
- Fail to load it (files incomplete)
- Skip it (but not retry)

**Proposed mitigation**:

- Use the same retry logic as `pollAndReload()` (exponential backoff)
- If all retries fail, log a warning but don't mark as "processed" so next discovery will retry

**Question**: Acceptable approach?

## Testing Concerns

### 5. Manual Testing for Bug #2

The "wake from sleep" scenario is hard to automate.

**Proposal**:

- Unit test the `discoverNewNotes()` function in isolation
- Add a hidden debug menu item or IPC call to trigger discovery manually
- Manual testing: create note on A, put B to sleep, wake B, verify note appears

**Question**: Is this sufficient, or do you want me to try to create an E2E test that simulates this (harder)?

## Missing Debug Tools

### 6. Diagnostic Visibility

**Proposal**: Add the following for debugging:

- Log line when discovery finds a note not in DB
- Log line when discovery successfully imports a note
- Log line when discovery skips a note (and why)
- Expose discovery results via IPC for the Storage Inspector UI

**Question**: Which level of logging/visibility do you want?

---

## Summary of Proposed Plan Changes

1. **Reorder**: Bug fixes before documentation
2. **Add**: Deletion log check before importing discovered notes
3. **Add**: Folder tree reload during discovery
4. **Add**: Retry logic in discovery for incomplete files
5. **Add**: Debug trigger for manual testing
6. **Add**: Diagnostic logging

Awaiting your feedback before finalizing the plan.
