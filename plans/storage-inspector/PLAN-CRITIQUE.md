# Storage Inspector - Plan Critique

## Staff Engineer Review

### 1. Ordering Analysis

**Issue: Feedback Loop Too Late**

The current plan builds all infrastructure before we can see anything working. A better approach:

1. **Phase 1 should include a minimal visible window** - Even if it just shows "Hello World", we can verify the menu → window flow works immediately.

2. **Phase 2.1 (SD Reader) should be testable standalone** - We could add a simple CLI tool or test that dumps the tree structure before building UI.

3. **Phase 3 components should be buildable with mock data** - Allows parallel development and visual testing without backend.

**Recommendation:** Reorder to get a visible skeleton window first, then iterate. See revised ordering below.

---

### 2. Missing Items Identified

1. **Loading States**
   - Large SDs may take time to scan
   - File parsing is async
   - Need loading spinners/skeletons

2. **Tree Performance**
   - An SD with 1000+ notes will have a slow tree
   - Need lazy loading or virtualization for tree
   - Consider collapsing notes by default, expand on demand

3. **Large File Handling (Task Missing)**
   - Plan mentions virtualization in risks but no task
   - Need explicit task for virtualizing hex view (large .crdtlog files can be 10MB+)

4. **Error Boundary**
   - React error boundary around inspector to prevent crashes

5. **SD Access Errors**
   - Handle case where SD path is inaccessible (permissions, unmounted drive)

6. **Empty States**
   - What shows when SD has no notes?
   - What shows when note has no logs yet?

---

### 3. Debug Tool Readiness

**Good:** We have existing binary-format.ts parsers with tests.

**Concern:** If the hex view has rendering bugs, how do we debug?

**Recommendation:** Add a "dump to console" button in dev mode that logs the raw parsed structure. Cheap to implement, valuable for debugging.

---

### 4. TDD Compliance

**Data Layer (Phase 2):** Tests should come FIRST

- Write `StorageInspectorService` tests before implementation
- Write parser utility tests before implementation (though we can leverage existing binary-format.ts tests)

**UI Layer (Phase 3):** Integration tests after implementation is reasonable

- Unit testing React components is lower value for this feature
- Focus E2E tests on critical paths

---

### 5. Risk Assessment Additions

| Risk                                    | Likelihood | Impact | Mitigation                                              |
| --------------------------------------- | ---------- | ------ | ------------------------------------------------------- |
| Tree slow with many notes               | Medium     | Medium | Lazy load children, virtualize tree                     |
| SD path inaccessible                    | Low        | Medium | Show error dialog, allow retry                          |
| Memory issues with multiple large files | Low        | High   | Only load one file at a time, clear on selection change |

---

## Recommended Plan Revisions

### Revised Phase Ordering

**Phase 1: Minimal End-to-End (Get Visual Feedback ASAP)**

1. Add menu item → opens stub window
2. SD selection dialog (can use native dialog initially)
3. Basic window with two panes (tree + detail)
4. Tree shows mock data initially

**Phase 2: Real Data (Backend First, TDD)**

1. Write tests for StorageInspectorService
2. Implement StorageInspectorService
3. Wire tree to real SD data
4. Basic file reading (raw bytes display)

**Phase 3: Hex View (Core Feature)**

1. Three-column layout
2. Basic parsing display (no highlighting yet)
3. Color coding
4. Bidirectional highlighting
5. Virtualization for large files

**Phase 4: Content Previews**

1. XML preview
2. Yjs structure preview
3. Image preview
4. Text preview (activity/profile)

**Phase 5: Polish**

1. Copy/Export
2. Error handling refinement
3. Loading states
4. E2E tests
5. Documentation

---

## Questions from Critique

### Q14: Tree Virtualization

The tree could have 1000+ notes. Should we:

- (A) Virtualize the tree (react-window or similar)
- (B) Lazy load - only show 100 notes, "Load more" button
- (C) Collapse all by default, load children on expand
- (D) Assume this is a developer tool, don't optimize initially

D

### Q15: Hex View Row Count

For a 10MB file, that's ~700,000 rows in the hex view. Should we:

- (A) Virtualize (show only visible rows, ~50-100 at a time)
- (B) Paginate (show 1000 rows, next/prev buttons)
- (C) Assume files are small for now, optimize later if needed

B

### Q16: Dev Mode Debug Button

Should we add a "Dump to Console" button that logs the parsed structure? (Helps debug parsing issues)

- Yes / No

yes
