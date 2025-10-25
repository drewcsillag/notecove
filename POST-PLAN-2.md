# Post-Plan Discussion - Round 2

Thanks for the responses! Let me address your question about folder trees and the local CI script requirement.

---

## Question 3 Follow-up: Folder Trees and CRDT

**Your question:** "Do we have any issue surrounding the folder trees and CRDT stuff?"

**Answer: No fundamental issues, but let me clarify the architecture:**

### How Folder Hierarchy Works with CRDTs

**Desktop (Electron):**
1. Folder structure is a separate Yjs document per SD (stored in `<SD>/folders/updates/`)
2. Main process maintains in-memory Yjs document for folder structure
3. When user creates/renames/moves folders:
   - Renderer sends IPC command to main process
   - Main process updates the Yjs document (folder CRDT)
   - Yjs automatically generates update
   - Main process writes update to `<SD>/folders/updates/<instance-id>.<seq>.yjson`
   - Update is broadcast to all renderer windows via IPC
   - UI updates reactively
4. When file watcher detects changes from other instances:
   - Main process reads new update files
   - Applies them to in-memory Yjs document
   - Broadcasts changes to renderers
   - UI updates

**iOS (with JavaScriptCore):**
Same basic flow, but:
1. Swift layer detects file changes (FileManager notifications)
2. Swift calls into JavaScriptCore bridge to apply updates
3. JavaScriptCore runs our TypeScript CRDT logic (from `packages/shared`)
4. Results flow back to Swift
5. SwiftUI updates

**Potential Concerns & Solutions:**

### Concern 1: Folder TreeView in SwiftUI vs React
- **Issue:** Rendering a tree structure that can be modified via CRDT updates
- **Solution:**
  - Both React (MUI TreeView) and SwiftUI (List with OutlineGroup) can handle dynamic trees
  - CRDT updates trigger state changes → UI re-renders
  - No fundamental incompatibility

### Concern 2: JavaScriptCore Bridge Performance
- **Issue:** Every folder operation requires crossing Swift ↔ JS bridge
- **Mitigation:**
  - Folder operations are infrequent (compared to typing in editor)
  - Bridge is fast enough for this use case
  - We can batch updates if needed
  - SQLite cache provides fast reads (no bridge needed for display)

### Concern 3: Yjs Y.Map for Folders
- **Issue:** Is Y.Map the right structure for a hierarchy?
- **Structure:**
  ```typescript
  // Root Yjs document for an SD's folders
  const foldersDoc = new Y.Doc();
  const foldersMap = foldersDoc.getMap('folders');

  // Each folder is a map entry
  foldersMap.set('folder-uuid-1', {
    id: 'folder-uuid-1',
    name: 'Work',
    parentId: null,  // null = root level
    sdId: 'sd-uuid',
    order: 0
  });

  foldersMap.set('folder-uuid-2', {
    id: 'folder-uuid-2',
    name: 'Projects',
    parentId: 'folder-uuid-1',  // child of Work
    sdId: 'sd-uuid',
    order: 0
  });
  ```
- **Why this works:**
  - Y.Map handles concurrent creates/updates/deletes correctly
  - `parentId` references create hierarchy
  - CRDT automatically resolves conflicts (e.g., two instances rename same folder)
  - Order field allows custom sorting if needed
  - Deleting a folder: set `deleted: true` (like notes)

### Concern 4: Circular Parent References
- **Issue:** What if CRDT merge creates circular reference (A is parent of B, B is parent of A)?
- **Solution:**
  - Validation layer in our code (not in CRDT)
  - When rendering tree, detect cycles and break them
  - Could add "conflict resolution" UI if detected
  - In practice, unlikely due to instance-id write isolation

### Concern 5: "All Notes" and "Recently Deleted" Virtual Folders
- **Issue:** These aren't real folders in CRDT
- **Solution:**
  - They're UI-only constructs
  - Not stored in folder CRDT
  - Always rendered at top/bottom by UI code
  - Notes can have `folderId: null` (orphan) → show in "All Notes"
  - Notes with `deleted: true` → show in "Recently Deleted"

**Is there a specific concern you had in mind?** If so, let me know and I can address it specifically.

> No issue, thanks for the clarification
---

## Local "CI" Script Requirement

**Your requirement:** "Local CI script/command to run all lints, tests, etc. before merging to main, before we have real CI/CD"

**Excellent point!** We should have this from day one.

### Proposed Solution

Add to Phase 1.2 (Testing Framework Setup):

**New Task:**
- [ ] 🟥 Create local CI verification script
  - `pnpm ci-local` command that runs:
    - `pnpm lint` (ESLint on all packages)
    - `pnpm format:check` (Prettier check)
    - `pnpm typecheck` (TypeScript compilation check)
    - `pnpm test` (Jest unit tests with coverage)
    - `pnpm test:e2e` (Playwright tests - desktop only initially)
  - Script exits with error code if any step fails
  - Shows clear pass/fail for each step
  - Reports coverage summary
  - Can be run before committing/merging

**Example output:**
```bash
$ pnpm ci-local

Running local CI checks...

✓ Linting (ESLint)           [Passed]
✓ Formatting (Prettier)      [Passed]
✓ TypeScript compilation     [Passed]
✓ Unit tests                 [Passed - 127/127]
  Coverage: 89.2% (target: 70%)
✓ E2E tests (desktop)        [Passed - 12/12]

All checks passed! ✓
Safe to commit/merge.
```

**Integration with CLAUDE.md:**
Your CLAUDE.md already says:
> "before saying that a feature is completed, run all tests to ensure we didn't break anything, you should have a script that acts like a CI build until we have a real CI system"

This `pnpm ci-local` script fulfills that requirement.

**Pre-commit Hook (Optional):**
We could also set up a pre-commit hook (using husky) that runs `pnpm ci-local` automatically before every commit. But this might be annoying during active development. Your preference?

**When to run:**
- Before merging feature branch to main
- Before saying a feature is complete
- After fixing a bug (to ensure fix works and didn't break other things)
- Optionally: before every commit (if we add pre-commit hook)

> all of the above except before every commit - that kind of thing is always annoying for me

### Updated Phase 1.2 Section

```markdown
### 1.2 Testing Framework Setup 🟥

**Status:** To Do

**Tasks:**
- [ ] 🟥 Configure Jest for unit tests
  - TypeScript support
  - Coverage reporting (target: 70% overall, ~100% for CRDT/storage)
- [ ] 🟥 Configure Playwright for E2E tests (desktop)
  - Test multiple window scenarios
  - Test multi-instance sync
- [ ] 🟥 Set up XCTest project for iOS (placeholder structure)
- [ ] 🟥 Create test utilities
  - Mock file system
  - Mock CRDT instances
  - Test fixtures (sample notes, folders)
- [ ] 🟥 Create local CI verification script
  - `pnpm ci-local` command
  - Runs: lint, format check, typecheck, unit tests, e2e tests
  - Clear pass/fail output with coverage summary
  - Exit codes for automation
  - Acts as CI until real CI/CD is set up (Phase 5)
- [ ] 🟥 Add npm scripts for individual checks
  - `pnpm lint` - ESLint
  - `pnpm format` - Prettier format
  - `pnpm format:check` - Prettier check only
  - `pnpm typecheck` - TypeScript compilation
  - `pnpm test` - Jest unit tests
  - `pnpm test:e2e` - Playwright E2E tests
  - `pnpm test:coverage` - Coverage report

**Acceptance Criteria:**
- All test frameworks are configured
- Can run unit tests with coverage
- Can run E2E tests
- Local CI script runs all checks successfully
- Clear output shows what passed/failed
```

---

## Summary of Plan Updates Needed

Based on all our discussions, here are the changes to make to PLAN.md:

### 1. Reorder Phase 1
```
1.1 Project Setup & Repository Structure
1.2 Testing Framework Setup ← was 1.5, add local CI script
1.3 CRDT Core Implementation ← was 1.2
1.4 File System Operations ← was 1.3
1.5 Local Database & Cache ← was 1.4
1.6 Logging and Error Handling ← was 1.6
```

### 2. Update Section 2.1 (Electron App Structure)
- Remove misleading `saveNote` from IPC commands list
- Clarify IPC commands:
  - `loadNote`, `unloadNote`, `createNote`, `deleteNote`, `moveNote`, `getNoteMetadata`
  - Events: `noteUpdated`, `noteDeleted`, `syncProgress`
- Add explanation of CRDT flow: renderer → main → disk → other renderers

### 3. Reorder Phase 2
```
2.1 Electron App Structure
2.2 Three-Panel Layout
2.3 Note Editor (Basic TipTap) ← was 2.6, moved earlier
2.4 Folder Tree Panel ← was 2.3
2.5 Tags Panel ← was 2.4
2.6 Notes List Panel ← was 2.5
2.7 Settings Window ← was 2.7 (no change)
... rest in order
```

### 4. Add iOS Architecture Explanation
Before Phase 3, add new section:

```markdown
---

## iOS Architecture Overview

Before diving into Phase 3 (iOS implementation), here's how iOS will differ from desktop:

**Desktop (Electron) Architecture:**
- Main process: Node.js running TypeScript (CRDT logic, file I/O, SQLite)
- Renderer process: Chromium running React + TipTap
- Communication: IPC between main and renderer

**iOS Architecture:**
- Native Swift layer: File I/O, SQLite (using GRDB), FileManager notifications
- JavaScriptCore bridge: Runs our TypeScript shared CRDT logic (from `packages/shared`)
- SwiftUI: All UI except editor (folder tree, note list, settings, tags)
- WKWebView: Embedded TipTap editor (same as desktop, but in WebView)

**Code Sharing Strategy:**
- `packages/shared`: TypeScript CRDT logic, types, utilities
  - Runs in Node.js on desktop (Electron main process)
  - Runs in JavaScriptCore on iOS (via Swift bridge)
  - Must be environment-agnostic (no Node-specific APIs)
- Desktop UI: React (Electron renderer)
- iOS UI: SwiftUI (native)
- Editor: TipTap in both (direct in Electron, WKWebView on iOS)

**Why This Approach:**
- Maximum code sharing for critical CRDT logic (guaranteed compatibility)
- Native performance and feel on iOS
- Same editor experience on both platforms
- Proven pattern (many apps use native UI + WebView for rich content)

**Folder Tree CRDT on iOS:**
- Same Yjs document structure as desktop
- Same file format on disk
- Swift code handles file I/O
- JavaScriptCore handles CRDT operations (via shared TypeScript code)
- SwiftUI renders tree (reactive to CRDT changes)
- No special concerns - architecture supports this

---
```

### 5. Update Phase 3 Tasks
Add clarifications to each iOS task about what's rewritten in Swift vs what's shared.

---

## Questions

1. **Pre-commit Hook:** Do you want automatic `pnpm ci-local` before every commit, or just manual usage?
> manual

2. **Coverage Enforcement:** Should `pnpm ci-local` fail if coverage drops below 70% (or below ~100% for CRDT/storage)?
> yes

3. **E2E in Local CI:** Should `pnpm ci-local` include E2E tests (slower) or just unit tests? Or make it optional (`pnpm ci-local --skip-e2e`)?
> I like the optional ability to skip the e2e checks

4. **Plan Update:** Should I now update PLAN.md with all these changes, or any other concerns first?
> yes

> something else to do is to make sure to document the various designs that you come up with that are complicated enough that they're not obvious from the plan docs

Let me know and I'll update the main PLAN.md file!
