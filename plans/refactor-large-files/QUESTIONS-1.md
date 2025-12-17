# Refactoring Large Files - Analysis & Questions

## Current State

| File                         | Current Lines | Target | Over By                |
| ---------------------------- | ------------- | ------ | ---------------------- |
| `handlers.ts`                | 5,349         | <750   | 4,599 (needs ~8 files) |
| `handlers.test.ts`           | 4,464         | <750   | 3,714 (needs ~7 files) |
| `main/index.ts`              | 4,037         | <750   | 3,287 (needs ~6 files) |
| `cross-machine-sync.spec.ts` | 3,145         | <750   | 2,395 (needs ~5 files) |
| `preload/index.ts`           | 2,515         | <750   | 1,765 (needs ~4 files) |
| `database.ts`                | 1,874         | <750   | 1,124 (needs ~3 files) |

## File Analysis & Proposed Splits

### 1. `handlers.ts` (~5,349 lines → ~8+ files)

The IPCHandlers class contains handlers grouped by domain. Natural split:

- **note-handlers.ts** - note:\* IPC handlers
- **folder-handlers.ts** - folder:\* IPC handlers
- **sd-handlers.ts** - sd:\* (storage directory) handlers
- **sync-handlers.ts** - sync:\* handlers
- **image-handlers.ts** - image:_, thumbnail:_ handlers
- **window-handlers.ts** - window:_, windowState:_ handlers
- **diagnostics-handlers.ts** - diagnostics:_, recovery:_, backup:\* handlers
- **misc-handlers.ts** - history:_, tag:_, link:_, config:_, telemetry:_, export:_, import:_, comment:_, mention:_, inspector:_, tools:_, appState:_, testing:_, webServer:_ handlers (or split further)

### 2. `handlers.test.ts` (~4,464 lines → aligned with handlers.ts)

Should mirror the handler file structure:

- **note-handlers.test.ts**
- **folder-handlers.test.ts**
- **sd-handlers.test.ts**
- etc.

### 3. `main/index.ts` (~4,037 lines → ~6 files)

Contains app initialization, event handlers, and coordination. Natural split:

- **app-lifecycle.ts** - App ready, before-quit, window-all-closed, activate events
- **window-management.ts** - BrowserWindow creation, window state tracking
- **ipc-setup.ts** - IPC handler registration and coordination
- **sd-watchers.ts** - Storage directory file watchers, activity sync coordination
- **sync-coordination.ts** - Profile presence, stale sync handling
- **index.ts** - Main entry point that composes the above

### 4. `cross-machine-sync.spec.ts` (~3,145 lines → ~5 files)

Contains multiple test.describe blocks. Natural split by test suite:

- **sync-smoke.spec.ts** - "cross-machine sync - smoke test"
- **sync-file-simulator.spec.ts** - "cross-machine sync - file sync simulator"
- **sync-two-instances.spec.ts** - "cross-machine sync - two instances"
- **sync-note-move.spec.ts** - "cross-machine sync - note move"
- **sync-move-conflict.spec.ts** - "cross-machine sync - move conflict"
- **sync-utils.ts** - Shared helpers (getFirstWindow, typeWithMultipleSyncs)

### 5. `preload/index.ts` (~2,515 lines → ~4 files)

The preload exposes IPC API to renderer, grouped by domain. Natural split:

- **note-api.ts** - note operations
- **folder-sd-api.ts** - folder and SD operations
- **sync-api.ts** - sync, appState, shutdown operations
- **window-api.ts** - menu, window, clipboard, shell operations
- **media-api.ts** - image, thumbnail operations
- **comment-api.ts** - comment, mention operations
- **tools-api.ts** - diagnostics, backup, export, import, tools, config, telemetry, recovery
- **index.ts** - Composes all APIs into electronAPI

### 6. `database.ts` (~1,874 lines → ~3 files)

The SqliteDatabase class has clear sections by entity type:

- **database-notes.ts** - Note Cache Operations, Inter-Note Link Operations
- **database-folders.ts** - Folder Cache Operations, Tag Operations
- **database-storage.ts** - Storage Directory Operations, Schema/Migration
- **database-sync.ts** - NoteSyncState, FolderSyncState, Profile Presence Cache
- **database-comments.ts** - Comment Thread, Reply, Reaction Operations
- **database-images.ts** - Image Cache Operations
- **database.ts** - Core class, initialization, transaction handling

## Questions

### Q1: Module Pattern for handlers.ts?

For splitting `handlers.ts`, should we:

**Option A: Single class with delegation**
Keep IPCHandlers as a facade class that delegates to domain-specific handler modules. The modules export functions that receive dependencies.

```typescript
// handlers.ts
export class IPCHandlers {
  constructor(deps: Dependencies) {
    // Register all handlers using imported modules
    registerNoteHandlers(ipcMain, deps);
    registerFolderHandlers(ipcMain, deps);
    // ...
  }
}
```

**Option B: Domain handler classes**
Create separate handler classes per domain that are instantiated and coordinated.

```typescript
// handlers.ts
export class IPCHandlers {
  private noteHandlers: NoteHandlers;
  private folderHandlers: FolderHandlers;

  constructor(deps: Dependencies) {
    this.noteHandlers = new NoteHandlers(deps);
    this.folderHandlers = new FolderHandlers(deps);
  }
}
```

**My recommendation**: Option A (delegation pattern) is simpler and avoids creating more class instances.

A

### Q2: Shared Test Utilities?

For `handlers.test.ts`, the file has extensive mock setup at the top. Should we:

**Option A**: Keep mocks in each test file (some duplication)
**Option B**: Create a `handlers-test-utils.ts` with shared mock factories

**My recommendation**: Option B - the mock setup is substantial (~200 lines) and would benefit from centralization.

B

### Q3: Preload Module Bundling

The preload script must be a single file for Electron's security model. We can:

**Option A**: Use TypeScript's namespace/barrel exports that compile to single file
**Option B**: Keep source split but use a bundler step (already using vite)
**Option C**: Generate the preload file from domain modules

**My recommendation**: Option A or B - the vite build already handles this, so we just need source-level organization.

B

---

## No More Questions

After analysis, I have sufficient clarity to proceed. The patterns are consistent across files:

- Split by domain/entity type
- Maintain aligned structure between handlers.ts and handlers.test.ts
- Use barrel exports to maintain clean imports

Say 'continue' for Phase 2.
