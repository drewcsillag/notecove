# Critical Bugs - Investigation and Fix Plan

## Context

Multiple critical bugs discovered during multi-instance sync testing over Google Drive with two machines.

## Bug 1: Title Changes to "Untitled" When Clicking Away During Load

### Symptoms

- Click on a note, then click away before it finishes loading
- Title in notes list changes to "Untitled"
- More easily reproduced with notes that have many CRDT files
- Underlying note data appears to be OK
- If you click back to the note and let it fully load, then click away, the title updates correctly

### Investigation Plan

1. Understand note loading flow (especially CRDT file loading)
2. Find where "Untitled" is used as a default value
3. Identify what triggers a save when navigating away from a note
4. Look for race condition where we're saving the note before loading completes

### Fix Strategy

- Likely need to prevent saving or title extraction until note is fully loaded
- May need to add a loading state flag
- Need test that simulates clicking away before load completes

---

## Bug 2: Batch Move Across SDs Causes Multiple Issues

### Symptoms

- Moved multiple notes in a batch move across Storage Directories
- UI showed same notes appearing in every folder (or notes list wasn't updating)
- Notes appeared to remain in original location (didn't actually move)
- Folder operations seemed to stop working on the source instance
- Notes didn't get deleted from source SD
- Setting up new user data directory fixed the issue (points to sqlite caching problem)

### Expected Behavior

- Same as single note moves:
  - Delete note from source SD
  - Create note on target SD with same UUID
  - UI updates immediately on both instances

### Investigation Plan

1. Review batch move implementation
2. Compare with single note move (which presumably works correctly)
3. Look for sqlite caching issues
4. Check UI state update logic after batch operations
5. Investigate why folder operations might break

### Fix Strategy

- Likely issue with batch operation not properly deleting/creating notes
- May need to ensure cache invalidation after batch moves
- Need to ensure UI state updates correctly
- Add E2E test for batch moves across SDs

---

## Bug 3: Note Deletion Doesn't Sync Correctly

### Symptoms

- Delete a note
- Folder count badges (in folder tree, to right of folder name) don't update
- Notes list doesn't update correctly
- Once you click the Deleted folder, the note appears there
- After clicking Deleted folder, note disappears from original list

### Expected Behavior

- Folder count badges should update immediately (on both sender and receiver)
- Notes list should update immediately
- Deleted note should appear in Deleted folder immediately

### Investigation Plan

1. Review note deletion implementation
2. Understand how folder count badges are calculated/updated
3. Check notes list UI update logic
4. Investigate why clicking Deleted folder triggers the update

### Fix Strategy

- Likely missing UI invalidation/refresh after deletion
- May need to ensure folder counts recalculate immediately
- Add E2E test for deletion sync across instances

---

## Testing Strategy

For each bug:

1. Write failing test first (TDD approach) -- ensure tests use two app instances and ensure they see the same things on both instances.
2. Fix the bug
3. Verify test passes
4. Run full CI suite to ensure no regressions
5. Code review all changes

## Questions/Clarifications Needed

[User to add comments/clarifications here]
