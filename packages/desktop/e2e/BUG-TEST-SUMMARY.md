# Folder Bug E2E Test Summary

**File:** `e2e/folder-bugs.spec.ts`

All tests are **expected to FAIL** initially and should **PASS** after implementing fixes.

## Test Cases

### 1. Bug: Right-click rename renames wrong folder

**Test:** `should rename the clicked nested folder, not its parent`

**What it tests:**
- Right-click on "Projects" (nested under "Work")
- Open rename dialog
- Verify dialog shows "Projects" (NOT "Work")
- Rename to "My Projects"
- Verify "Projects" → "My Projects" (Work unchanged)

**Current behavior:** Renames "Work" instead of "Projects"

**Expected behavior:** Should rename the clicked folder

---

### 2. Bug: Drag-and-drop moves wrong folder

**Test:** `should move only the dragged folder, not its parent`

**What it tests:**
- Drag "Recipes" (child of "Personal") to "Work"
- Verify ONLY "Recipes" moved (not entire "Personal" folder)
- Verify "Personal" still exists at root level
- Verify "Ideas" still exists under "Personal"

**Current behavior:** Moves entire "Personal" folder under "Work"

**Expected behavior:** Should move only "Recipes"

---

### 3. Bug: Drag-and-drop stops working after first drag

**Test:** `should continue to work for multiple drag operations`

**What it tests:**
- First drag: Move "Ideas" to "Work"
- Second drag: Move "Recipes" to "Work"
- Third drag: Move "Ideas" back to "Personal"
- All three operations should succeed

**Current behavior:** After first drag, no drop zones work (except "All Notes" which does nothing)

**Expected behavior:** Should allow unlimited drag operations

---

### 4. Bug: Folders don't persist across app restarts

**Test 4a:** `should persist created folders after app restart`

**What it tests:**
- Create a new folder "Persistent Test Folder"
- Close the app
- Relaunch the app
- Verify folder still exists

**Current behavior:** Folder disappears after restart

**Expected behavior:** Folder should persist (saved to disk via CRDT)

**Test 4b:** `should persist renamed folders after app restart`

**What it tests:**
- Rename "Work" to "Career"
- Close the app
- Relaunch the app
- Verify "Career" exists and "Work" does not

**Current behavior:** Folder reverts to "Work" after restart

**Expected behavior:** Renamed folder should persist

---

### 5. Bug: Folder changes don't sync across windows

**Test 5a:** `should sync folder creation across multiple windows in same instance`

**What it tests:**
- Open two windows in same Electron instance
- Create folder "Sync Test Folder" in window 1
- Verify folder appears in window 2 (via folder:updated event)

**Current behavior:** Folder doesn't appear in window 2

**Expected behavior:** Should sync via IPC event broadcasting

**Test 5b:** `should sync folder rename across multiple windows in same instance`

**What it tests:**
- Open two windows
- Rename "Work" to "Office" in window 1
- Verify rename syncs to window 2

**Current behavior:** Window 2 doesn't see the rename

**Expected behavior:** Should sync via folder:updated event

**Test 5c:** `should sync folder move across multiple windows in same instance`

**What it tests:**
- Open two windows
- Move "Ideas" to top level in window 1
- Verify move syncs to window 2

**Current behavior:** Window 2 doesn't see the move

**Expected behavior:** Should sync via folder:updated event

**Test 5d:** `should sync folder changes across separate Electron instances`

**What it tests:**
- Launch TWO separate Electron processes (not just windows)
- Each instance has:
  - Different instance ID
  - Different user data directory
  - **SAME shared storage directory** (for CRDT files)
- Create a folder in instance 1
- Verify it syncs to instance 2 via file system + file watcher
- Rename the folder in instance 2
- Verify rename syncs back to instance 1

**Current behavior:** Changes don't sync across instances

**Expected behavior:** Changes should sync via:
1. Instance 1 writes folder update to shared CRDT file
2. File watcher in instance 2 detects the change
3. Instance 2 loads update and broadcasts folder:updated event
4. All windows in instance 2 refresh folder tree

---

## Test Implementation Notes

### Challenges

1. **Nested folders not visible by default**
   - Tests may need to expand parent folders to see children
   - Current implementation might not expand folders on load

2. **Window creation**
   - Tests attempt to create second window with `Ctrl+N`
   - May need app-level support for new window creation
   - Might need to implement `File → New Window` menu

3. **Multi-instance testing**
   - Very difficult in E2E framework
   - Documented as manual test for now

### Test Structure

- Each test is isolated (uses `beforeAll`/`afterAll`)
- Tests include generous timeouts for async operations
- Tests wait for tree refresh after folder operations
- Sync tests gracefully handle missing window creation support

### Next Steps After Tests Pass

1. ✅ Verify all bugs are fixed
2. Update PLAN.md to mark Phase 2.4.4 complete
3. Consider adding unit tests for specific helper functions
4. Add performance tests for large folder trees
