# Desktop Coverage & Refactoring Plan

**Overall Progress:** `35%`

**Branch:** `desktop-coverage-and-refactor`

**Goals:**

- Raise overall desktop coverage from 27% → 37%+
- Raise each area by 10%+ (capped at 80%)
- Refactor files >950 lines into smaller, focused modules

**Approach:** Tests first, then incremental refactoring.

**Note:** Initial attempt to extract handler modules revealed significant API complexity.
Revised strategy: Add tests to establish safety net, then refactor with test support.

---

## Phase 1: High-Value Business Logic

### Step 1: handlers.ts (3341 lines → ~5 files)

- [ ] 🟥 **1.1 Analyze and plan split** (Deferred until more tests are in place)
  - [ ] 🟥 Map all handler methods by domain
  - [ ] 🟥 Identify shared utilities/helpers
  - [ ] 🟥 Document dependencies between handlers

- [ ] 🟥 **1.2 Refactor into domain modules** (Deferred until more tests are in place)
  - [ ] 🟥 Create `note-handlers.ts` (note CRUD, load/unload, sync)
  - [ ] 🟥 Create `folder-handlers.ts` (folder CRUD, tree ops)
  - [ ] 🟥 Create `storage-handlers.ts` (SD management, backups)
  - [ ] 🟥 Create `app-handlers.ts` (window, settings, telemetry)
  - [ ] 🟥 Create `sync-handlers.ts` (sync status, activity logs)
  - [ ] 🟥 Update `handlers.ts` to re-export/compose modules
  - [ ] 🟥 Verify all IPC channels still work

- [x] 🟩 **1.3 Add tests to establish safety net**
  - [x] 🟩 Added tests for Note CRUD (create, delete, restore, togglePin, move, updateTitle)
  - [x] 🟩 Added tests for Note Listing (list, search, counts)
  - [x] 🟩 Added tests for Tags and Links (getAll, getBacklinks)
  - [x] 🟩 Added tests for App State and Config handlers
  - [x] 🟩 Added tests for Diagnostics handlers
  - [x] 🟩 Added tests for Backup handlers
  - [x] 🟩 Added tests for Recovery handlers
  - [x] 🟩 Coverage raised from 29% → 40% (118 tests)

### Step 2: note-move-manager.ts (990 lines)

- [ ] 🟥 **2.1 Analyze structure**
  - [ ] 🟥 Identify logical responsibilities
  - [ ] 🟥 Map state machine transitions

- [ ] 🟥 **2.2 Refactor if needed**
  - [ ] 🟥 Extract state machine logic if separable
  - [ ] 🟥 Extract file operations if separable

- [ ] 🟥 **2.3 Enhance tests**
  - [ ] 🟥 Add tests to raise coverage from 68% → 80%
  - [ ] 🟥 Run CI, fix any failures

### Step 3: database.ts (1408 lines)

- [ ] 🟥 **3.1 Analyze structure**
  - [ ] 🟥 Identify query groups by entity
  - [ ] 🟥 Identify migration logic

- [ ] 🟥 **3.2 Refactor into modules**
  - [ ] 🟥 Extract migrations to `migrations.ts`
  - [ ] 🟥 Consider splitting queries by entity if >400 lines remain

- [ ] 🟥 **3.3 Enhance tests**
  - [ ] 🟥 Add tests to raise coverage from 55% → 70%+
  - [ ] 🟥 Run CI, fix any failures

### Step 4: crdt-manager.ts (917 lines, 0% → 31% coverage)

- [x] 🟩 **4.1 Analyze structure**
  - [x] 🟩 Map CRDT operations
  - [x] 🟩 Identify testable units

- [ ] 🟥 **4.2 Refactor if needed** (Deferred)
  - [ ] 🟥 Extract pure functions for easier testing

- [~] 🟨 **4.3 Add tests** (In progress)
  - [x] 🟩 Create `crdt-manager.test.ts` (21 tests)
  - [~] 🟨 Coverage at 31%, target 40%+ (complex module with file system dependencies)
  - [x] 🟩 Run CI, fix any failures

---

## Phase 2: Application Bootstrap

### Step 5: main/index.ts (3201 lines → ~6 files)

- [ ] 🟥 **5.1 Analyze and plan split**
  - [ ] 🟥 Map functions and global state
  - [ ] 🟥 Identify lifecycle vs. feature logic

- [ ] 🟥 **5.2 Refactor into modules**
  - [ ] 🟥 Create `window-manager.ts` (createWindow, window state)
  - [ ] 🟥 Create `menu.ts` (createMenu, menu actions)
  - [ ] 🟥 Create `sd-watcher-manager.ts` (setupSDWatchers, watcher maps)
  - [ ] 🟥 Create `tag-sync.ts` (reindexTagsForNotes)
  - [ ] 🟥 Create `app-lifecycle.ts` (app.on handlers, shutdown)
  - [ ] 🟥 Slim down `index.ts` to orchestration only

- [ ] 🟥 **5.3 Add tests for extractable modules**
  - [ ] 🟥 Test `tag-sync.ts` (pure-ish logic)
  - [ ] 🟥 Test `sd-watcher-manager.ts` with mocks
  - [ ] 🟥 Target 20%+ coverage for main process
  - [ ] 🟥 Run CI, fix any failures

---

## Phase 3: UI Components

### Step 6: FolderTree.tsx (1661 lines)

- [ ] 🟥 **6.1 Analyze component structure**
  - [ ] 🟥 Identify sub-components
  - [ ] 🟥 Identify hooks and utilities

- [ ] 🟥 **6.2 Refactor into smaller components**
  - [ ] 🟥 Extract reusable sub-components
  - [ ] 🟥 Extract custom hooks

- [ ] 🟥 **6.3 Enhance tests**
  - [ ] 🟥 Add integration tests for key interactions
  - [ ] 🟥 Raise coverage from 41% → 55%+
  - [ ] 🟥 Run CI, fix any failures

### Step 7: NotesListPanel.tsx (1627 lines)

- [ ] 🟥 **7.1 Analyze component structure**
- [ ] 🟥 **7.2 Refactor into smaller components**
- [ ] 🟥 **7.3 Enhance tests**
  - [ ] 🟥 Raise coverage from 37% → 50%+
  - [ ] 🟥 Run CI, fix any failures

### Step 8: TipTapEditor.tsx (1273 lines, 4% coverage)

- [ ] 🟥 **8.1 Analyze component structure**
- [ ] 🟥 **8.2 Refactor into smaller components**
  - [ ] 🟥 Extract toolbar components
  - [ ] 🟥 Extract editor hooks

- [ ] 🟥 **8.3 Add tests**
  - [ ] 🟥 Create integration tests for editor behavior
  - [ ] 🟥 Raise coverage from 4% → 25%+
  - [ ] 🟥 Run CI, fix any failures

### Step 9: RecoverySettings.tsx (1021 lines)

- [ ] 🟥 **9.1 Analyze component structure**
- [ ] 🟥 **9.2 Refactor into smaller components**
- [ ] 🟥 **9.3 Enhance tests**
  - [ ] 🟥 Raise coverage from 47% → 60%+
  - [ ] 🟥 Run CI, fix any failures

---

## Phase 4: Preload Layer

### Step 10: preload/index.ts (1415 lines)

- [ ] 🟥 **10.1 Analyze API structure**
  - [ ] 🟥 Group by domain (note, folder, storage, app)

- [ ] 🟥 **10.2 Refactor into domain modules**
  - [ ] 🟥 Create `preload/note-api.ts`
  - [ ] 🟥 Create `preload/folder-api.ts`
  - [ ] 🟥 Create `preload/storage-api.ts`
  - [ ] 🟥 Create `preload/app-api.ts`
  - [ ] 🟥 Update `index.ts` to compose APIs

- [ ] 🟥 **10.3 Add tests if practical**
  - [ ] 🟥 Test type definitions compile correctly
  - [ ] 🟥 Target 15%+ coverage
  - [ ] 🟥 Run CI, fix any failures

---

## Final Validation

- [ ] 🟥 **Verify coverage targets met**
  - [ ] 🟥 Run full coverage report
  - [ ] 🟥 Confirm overall desktop: 37%+
  - [ ] 🟥 Confirm no area regressed
  - [ ] 🟥 Update coverage thresholds in jest.config.js

- [ ] 🟥 **Final CI run**
  - [ ] 🟥 All tests pass
  - [ ] 🟥 No lint errors
  - [ ] 🟥 Build succeeds

---

## Coverage Targets Summary

| File/Area            | Before | Current | Target | Cap |
| -------------------- | ------ | ------- | ------ | --- |
| Overall Desktop      | 27%    | 30.42%  | 37%+   | -   |
| handlers.ts          | 29%    | 48.87%  | 45%+   | 80% |
| note-move-manager.ts | 68%    | 68%     | 80%    | 80% |
| database.ts          | 55%    | 55.55%  | 70%+   | 80% |
| crdt-manager.ts      | 0%     | 31.42%  | 40%+   | 80% |
| main/index.ts        | 0%     | 0%      | 20%+   | 80% |
| events.ts            | 0%     | 100%    | -      | -   |
| app-state.ts         | 0%     | 100%    | -      | -   |
| FolderTree.tsx       | 41%    | 41%     | 55%+   | 80% |
| NotesListPanel.tsx   | 37%    | 37%     | 50%+   | 80% |
| TipTapEditor.tsx     | 4%     | 4%      | 25%+   | 80% |
| RecoverySettings.tsx | 47%    | 47%     | 60%+   | 80% |
| preload/index.ts     | 0%     | 0%      | 15%+   | 80% |

---

## Subsidiary Plans

None yet. Will be created if individual steps require detailed breakdown.
