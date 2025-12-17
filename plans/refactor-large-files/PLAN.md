# Refactoring Large Files - Implementation Plan

## Goal

Refactor 6 large files to be under 750 lines each, maintaining aligned structure between related files (handlers.ts ↔ handlers.test.ts).

## Design Decisions (from Q&A)

- **Q1**: Delegation pattern for handlers (functions, not classes)
- **Q2**: Shared test utilities with centralized mock factories
- **Q3**: Source-level split for preload, vite handles bundling

---

## Phase 1: handlers.ts & handlers.test.ts (Coordinated Split)

**Priority**: Highest - largest files, must stay aligned

### 1.1 Create Handler Module Structure

Create `/packages/desktop/src/main/ipc/handlers/` directory with:

| File                        | IPC Prefixes                                                                                                                                                                                            | Est. Lines |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `note-handlers.ts`          | `note:*`                                                                                                                                                                                                | ~600       |
| `folder-handlers.ts`        | `folder:*`                                                                                                                                                                                              | ~300       |
| `sd-handlers.ts`            | `sd:*`                                                                                                                                                                                                  | ~400       |
| `sync-handlers.ts`          | `sync:*`                                                                                                                                                                                                | ~200       |
| `image-handlers.ts`         | `image:*`, `thumbnail:*`                                                                                                                                                                                | ~500       |
| `window-handlers.ts`        | `window:*`, `windowState:*`                                                                                                                                                                             | ~200       |
| `diagnostics-handlers.ts`   | `diagnostics:*`, `recovery:*`, `backup:*`                                                                                                                                                               | ~500       |
| `export-import-handlers.ts` | `export:*`, `import:*`                                                                                                                                                                                  | ~400       |
| `misc-handlers.ts`          | `history:*`, `tag:*`, `link:*`, `config:*`, `telemetry:*`, `comment:*`, `mention:*`, `inspector:*`, `tools:*`, `appState:*`, `testing:*`, `webServer:*`, `app:*`, `profile:*`, `shell:*`, `clipboard:*` | ~600       |
| `types.ts`                  | Callback types, shared interfaces                                                                                                                                                                       | ~100       |
| `index.ts`                  | IPCHandlers facade class                                                                                                                                                                                | ~150       |

### 1.2 Handler Module Pattern

Each handler module exports a registration function:

```typescript
// note-handlers.ts
import { ipcMain } from 'electron';
import type { HandlerDependencies } from './types';

export function registerNoteHandlers(deps: HandlerDependencies): void {
  const { crdtManager, database, ... } = deps;

  ipcMain.handle('note:load', async (_event, noteId: string) => {
    // implementation
  });

  // ... more handlers
}
```

### 1.3 Create Test Module Structure

Create `/packages/desktop/src/main/ipc/__tests__/handlers/` directory with:

| File                             | Tests For                     | Est. Lines |
| -------------------------------- | ----------------------------- | ---------- |
| `test-utils.ts`                  | Mock factories, setup helpers | ~300       |
| `note-handlers.test.ts`          | note-handlers.ts              | ~600       |
| `folder-handlers.test.ts`        | folder-handlers.ts            | ~400       |
| `sd-handlers.test.ts`            | sd-handlers.ts                | ~400       |
| `sync-handlers.test.ts`          | sync-handlers.ts              | ~200       |
| `image-handlers.test.ts`         | image-handlers.ts             | ~500       |
| `window-handlers.test.ts`        | window-handlers.ts            | ~200       |
| `diagnostics-handlers.test.ts`   | diagnostics-handlers.ts       | ~500       |
| `export-import-handlers.test.ts` | export-import-handlers.ts     | ~400       |
| `misc-handlers.test.ts`          | misc-handlers.ts              | ~500       |

### 1.4 Implementation Steps

1. **Create types.ts** - Extract callback types and HandlerDependencies interface
2. **Create test-utils.ts** - Extract mock factories from handlers.test.ts
3. **For each domain (note, folder, sd, etc.):**
   - Create `{domain}-handlers.ts` with extracted handlers
   - Create `{domain}-handlers.test.ts` with extracted tests
   - Update imports, verify tests pass
4. **Create index.ts** - IPCHandlers facade that calls all registration functions
5. **Delete original files** - Replace with re-exports for backwards compatibility
6. **Run CI** - Verify all tests pass

---

## Phase 2: main/index.ts

**Priority**: High - second largest file

### 2.1 Create Main Module Structure

Create `/packages/desktop/src/main/` modules:

| File                   | Responsibility                   | Est. Lines |
| ---------------------- | -------------------------------- | ---------- |
| `app-lifecycle.ts`     | App ready, quit, activate events | ~400       |
| `window-management.ts` | BrowserWindow creation, tracking | ~500       |
| `ipc-setup.ts`         | IPC handler registration         | ~300       |
| `sd-watchers.ts`       | File watchers, activity sync     | ~500       |
| `sync-coordination.ts` | Profile presence, stale sync     | ~400       |
| `menu-setup.ts`        | Application menu creation        | ~300       |
| `index.ts`             | Entry point, composition         | ~200       |

### 2.2 Implementation Steps

1. **Extract menu-setup.ts** - Menu creation and handlers
2. **Extract window-management.ts** - Window creation, state tracking
3. **Extract sd-watchers.ts** - Storage directory watchers
4. **Extract sync-coordination.ts** - Sync status, stale entries
5. **Extract app-lifecycle.ts** - App event handlers
6. **Extract ipc-setup.ts** - IPC registration coordination
7. **Refactor index.ts** - Compose modules
8. **Run CI** - Verify all tests pass

---

## Phase 3: cross-machine-sync.spec.ts

**Priority**: Medium - E2E test file

### 3.1 Create Test Module Structure

Split into `/packages/desktop/e2e/` files:

| File                          | Test Suite                                          | Est. Lines |
| ----------------------------- | --------------------------------------------------- | ---------- |
| `sync-test-utils.ts`          | getFirstWindow, typeWithMultipleSyncs, shared setup | ~150       |
| `sync-smoke.spec.ts`          | "cross-machine sync - smoke test"                   | ~250       |
| `sync-file-simulator.spec.ts` | "cross-machine sync - file sync simulator"          | ~500       |
| `sync-two-instances.spec.ts`  | "cross-machine sync - two instances"                | ~700       |
| `sync-note-move.spec.ts`      | "cross-machine sync - note move"                    | ~400       |
| `sync-move-conflict.spec.ts`  | "cross-machine sync - move conflict"                | ~400       |

### 3.2 Implementation Steps

1. **Create sync-test-utils.ts** - Extract shared helpers
2. **Create each spec file** - Extract corresponding test.describe block
3. **Update imports** - Each spec imports from sync-test-utils
4. **Delete original** - cross-machine-sync.spec.ts
5. **Run E2E tests** - Verify all pass

---

## Phase 4: preload/index.ts

**Priority**: Medium - must remain bundled output

### 4.1 Create Preload Module Structure

Create `/packages/desktop/src/preload/` modules:

| File             | API Domains                                                                                                          | Est. Lines |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- | ---------- |
| `note-api.ts`    | note operations + events                                                                                             | ~300       |
| `folder-api.ts`  | folder operations + events                                                                                           | ~150       |
| `sd-api.ts`      | sd operations + events                                                                                               | ~150       |
| `sync-api.ts`    | sync, appState, shutdown                                                                                             | ~150       |
| `media-api.ts`   | image, thumbnail                                                                                                     | ~300       |
| `comment-api.ts` | comment, mention                                                                                                     | ~400       |
| `window-api.ts`  | menu, window, windowState, clipboard, shell                                                                          | ~300       |
| `tools-api.ts`   | diagnostics, backup, export, import, tools, config, telemetry, recovery, inspector, testing, webServer, profile, app | ~600       |
| `index.ts`       | Compose all APIs into electronAPI                                                                                    | ~100       |

### 4.2 Module Pattern

Each API module exports an object:

```typescript
// note-api.ts
import { ipcRenderer } from 'electron';

export const noteAPI = {
  load: (noteId: string): Promise<void> =>
    ipcRenderer.invoke('note:load', noteId),
  // ...
  onUpdated: (callback: ...) => { ... },
};
```

### 4.3 Implementation Steps

1. **Create API modules** - One per domain
2. **Update index.ts** - Import and compose
3. **Verify vite builds** - Single bundled output
4. **Run tests** - Verify IPC still works

---

## Phase 5: database.ts

**Priority**: Lower - smallest of the large files

### 5.1 Create Database Module Structure

Create `/packages/desktop/src/main/database/` modules:

| File                       | Operations                          | Est. Lines |
| -------------------------- | ----------------------------------- | ---------- |
| `note-operations.ts`       | Note CRUD, FTS search               | ~350       |
| `folder-operations.ts`     | Folder CRUD, tags                   | ~250       |
| `link-operations.ts`       | Inter-note links                    | ~100       |
| `storage-operations.ts`    | SD operations, cleanup              | ~250       |
| `sync-state-operations.ts` | NoteSyncState, FolderSyncState      | ~150       |
| `profile-operations.ts`    | Profile presence cache              | ~150       |
| `image-operations.ts`      | Image cache                         | ~150       |
| `comment-operations.ts`    | Comment threads, replies, reactions | ~300       |
| `schema.ts`                | Schema creation, migrations         | ~150       |
| `database.ts`              | SqliteDatabase class, composition   | ~200       |

### 5.2 Module Pattern

Use mixins or composition:

```typescript
// database.ts
import { createNoteOperations } from './note-operations';
import { createFolderOperations } from './folder-operations';

export class SqliteDatabase implements Database {
  constructor(private readonly adapter: DatabaseAdapter) {}

  // Core methods
  async initialize(): Promise<void> { ... }
  async transaction<T>(fn: () => Promise<T>): Promise<T> { ... }

  // Composed operations
  ...createNoteOperations(this.adapter),
  ...createFolderOperations(this.adapter),
}
```

### 5.3 Implementation Steps

1. **Extract schema.ts** - Schema SQL, migrations
2. **Extract operation modules** - One per entity type
3. **Refactor database.ts** - Compose operations
4. **Run tests** - Verify database operations work

---

## Execution Order

1. **Phase 1** (handlers.ts + handlers.test.ts) - Most critical, highest complexity
2. **Phase 2** (main/index.ts) - High impact on app structure
3. **Phase 3** (cross-machine-sync.spec.ts) - Independent E2E tests
4. **Phase 4** (preload/index.ts) - Must verify bundling works
5. **Phase 5** (database.ts) - Smallest scope

---

## Success Criteria

- [ ] All files under 750 lines
- [ ] handlers.ts structure mirrors handlers.test.ts structure
- [ ] All existing tests pass
- [ ] CI passes (pnpm ci-local)
- [ ] No runtime regressions
- [ ] Clean imports (no circular dependencies)

---

## Risk Mitigation

1. **Incremental commits** - Commit after each successful module extraction
2. **Run tests frequently** - After each file move
3. **Keep backwards compatibility** - Re-export from original locations if needed
4. **Feature branch** - All work on `refactor-large-files` branch
