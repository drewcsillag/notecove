# iOS Storage Architecture Planning

## Current State Analysis

### ✅ Already in Shared (cross-platform logic)

These are correctly placed and will work for iOS:

- `activity-logger.ts` - Logs SD operations to `.activity` folder
- `activity-sync.ts` - Cross-instance sync coordinator
- `update-manager.ts` - CRDT update file management
- `sd-structure.ts` - SD directory structure definitions
- `types.ts` - Platform-agnostic type definitions

### 🖥️ Currently in Desktop (platform-specific)

These are Node.js/Electron-specific:

- **`node-fs-adapter.ts`** - Node.js filesystem implementation (uses `fs` module)
  - Implements flag byte protocol for `.yjson` files
  - Handles atomic writes, directory creation

- **`node-file-watcher.ts`** - Node.js file watching (uses `chokidar`)
  - Watches SD directories for changes
  - Triggers reloads on external modifications

- **`sd-registry.ts`** - Desktop-specific SD registry
  - Manages list of configured Storage Directories
  - Uses Electron store for persistence

- **`app-state.ts`** - Desktop app state persistence
  - Current folder ID, expanded state, etc.
  - Electron-specific storage

- **`migrate-flag-byte.ts`** - CLI migration tool
  - Node.js-specific CLI for migrating SDs to version 1
  - Not needed in iOS app (migration happens differently)

- **`sd-version.ts`** - SD version checking
  - Uses Node.js `fs` module directly
  - Logic is cross-platform but implementation is not

## Refactoring Plan for iOS Support

### Phase 1: Create Abstraction Layer in Shared

Move to `packages/shared/src/storage/interfaces/`:

1. **`fs-adapter.ts`** - FileSystemAdapter interface

   ```typescript
   export interface FileSystemAdapter {
     readFile(path: string): Promise<Uint8Array>;
     writeFile(path: string, data: Uint8Array): Promise<void>;
     readdir(path: string): Promise<string[]>;
     stat(path: string): Promise<FileStats>;
     mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
     unlink(path: string): Promise<void>;
     exists(path: string): Promise<boolean>;
   }
   ```

2. **`file-watcher.ts`** - FileWatcher interface

   ```typescript
   export interface FileWatcher {
     watch(path: string, callback: (eventType: string, filename: string) => void): void;
     close(): Promise<void>;
   }
   ```

3. **`sd-registry.ts`** - SDRegistry interface

   ```typescript
   export interface SDRegistry {
     listSDs(): Promise<SDConfig[]>;
     addSD(path: string, config: SDConfig): Promise<void>;
     removeSD(id: string): Promise<void>;
     getSD(id: string): Promise<SDConfig | null>;
   }
   ```

4. **`app-state.ts`** - AppState interface
   ```typescript
   export interface AppState {
     getCurrentFolderId(sdId: string): Promise<string | null>;
     setCurrentFolderId(sdId: string, folderId: string): Promise<void>;
     getExpandedFolders(sdId: string): Promise<Set<string>>;
     setExpandedFolders(sdId: string, folderIds: Set<string>): Promise<void>;
   }
   ```

### Phase 2: Move Cross-Platform Logic to Shared

Create `packages/shared/src/storage/versioning/`:

1. **`sd-version.ts`** - Refactor to use FileSystemAdapter
   - Move from `packages/desktop/src/main/storage/sd-version.ts`
   - Accept `FileSystemAdapter` as dependency
   - All logic stays the same, just uses adapter interface

   ```typescript
   export async function checkSDVersion(
     sdPath: string,
     fs: FileSystemAdapter
   ): Promise<...>
   ```

2. **`types.ts`** - Version-related types
   - `CURRENT_SD_VERSION` constant
   - `VersionCheckResult` types

### Phase 3: Refactor Desktop to Use Interfaces

Rename and update in `packages/desktop/src/storage/`:

- `node-fs-adapter.ts` → Implements `FileSystemAdapter`
- `node-file-watcher.ts` → Implements `FileWatcher`
- `sd-registry.ts` → Rename to `desktop-sd-registry.ts`, implements `SDRegistry`
- `app-state.ts` → Rename to `desktop-app-state.ts`, implements `AppState`
- `migrate-flag-byte.ts` → Update to use shared `sd-version.ts`

### Phase 4: iOS Implementation (Future)

Create `packages/ios/src/storage/`:

1. **`ios-fs-adapter.ts`** - iOS filesystem implementation
   - Use iOS FileManager APIs
   - Implement same flag byte protocol as desktop
   - Handle iOS-specific sandboxing/permissions

2. **`ios-file-watcher.ts`** - iOS file observation
   - Use NSFileCoordinator/NSFilePresenter
   - Or use DispatchSource for file monitoring

3. **`ios-sd-registry.ts`** - iOS SD registry
   - Use UserDefaults or Core Data
   - Handle iOS document picker integration

4. **`ios-app-state.ts`** - iOS app state
   - Use UserDefaults or similar iOS persistence

## Directory Structure (After Refactoring)

```
packages/shared/src/storage/
  ├── core/                          # Platform-agnostic business logic
  │   ├── activity-logger.ts         # ✅ Already here
  │   ├── activity-sync.ts           # ✅ Already here
  │   ├── update-manager.ts          # ✅ Already here
  │   └── sd-structure.ts            # ✅ Already here
  │
  ├── versioning/                    # 🔄 MOVE HERE
  │   ├── sd-version.ts              # Uses FileSystemAdapter
  │   └── types.ts                   # Version constants/types
  │
  └── interfaces/                    # 🆕 NEW - Platform abstraction
      ├── fs-adapter.ts              # FileSystemAdapter interface
      ├── file-watcher.ts            # FileWatcher interface
      ├── sd-registry.ts             # SDRegistry interface
      └── app-state.ts               # AppState interface

packages/desktop/src/storage/
  ├── node-fs-adapter.ts             # ✅ Keep - implements FileSystemAdapter
  ├── node-file-watcher.ts           # ✅ Keep - implements FileWatcher
  ├── desktop-sd-registry.ts         # 🔄 Rename - implements SDRegistry
  ├── desktop-app-state.ts           # 🔄 Rename - implements AppState
  └── migrate-flag-byte.ts           # ✅ Keep - CLI tool (Node.js only)

packages/ios/src/storage/            # 🆕 FUTURE
  ├── ios-fs-adapter.ts              # Implements FileSystemAdapter
  ├── ios-file-watcher.ts            # Implements FileWatcher
  ├── ios-sd-registry.ts             # Implements SDRegistry
  └── ios-app-state.ts               # Implements AppState
```

## Migration Concerns

### SD Version Migration on iOS

Desktop has CLI migration tool (`migrate-flag-byte.ts`), but iOS needs different approach:

**Option 1: On-demand migration**

- First time app opens SD with version 0, show dialog
- "Migrate Storage Directory to latest version?"
- Run migration in background with progress indicator
- Can't use SD until migration completes

**Option 2: Automatic migration**

- App detects version 0 on SD open
- Automatically migrates in background
- Lock file prevents other instances from accessing during migration
- Show progress indicator

**Option 3: Share migration via iCloud**

- Desktop migrates SD
- SD_VERSION file and migrated .yjson files sync via iCloud
- iOS sees version 1, no migration needed
- Requires user to open desktop app first

### Flag Byte Protocol on iOS

The flag byte protocol (0x00/0x01) **must work identically** on iOS:

1. **Reading `.yjson` files:**
   - Strip first byte if it's 0x01
   - Throw error if first byte is 0x00 (incomplete write)
   - Throw error if first byte is anything else

2. **Writing `.yjson` files:**
   - Write data with 0x00 flag
   - fsync/flush
   - Overwrite first byte with 0x01
   - fsync/flush again

3. **iOS-specific considerations:**
   - iOS file coordination for iCloud Drive
   - Sandboxing permissions for accessing SD
   - Background app limitations during sync

## Action Items

- [x] Create abstraction interfaces in shared package (Already existed!)
- [x] Move sd-version.ts to shared with FileSystemAdapter dependency
- [x] Refactor desktop storage to implement interfaces (Already done!)
- [x] Update desktop migration tool to use shared sd-version
- [ ] Test desktop still works after refactoring
- [ ] Design iOS migration UX
- [ ] Implement iOS storage adapters
- [ ] Test cross-platform SD compatibility

## Notes

- Most storage logic is **already shared** ✅
- Main work is defining clear interfaces and moving sd-version.ts
- Desktop and iOS can share same SD directory structure
- Migration tool approach differs between platforms but core logic is same
- Flag byte protocol is critical for both platforms - prevents partial read race conditions

## Related Files

- `/packages/desktop/src/main/storage/` - Desktop-specific storage implementation
- `/packages/shared/src/storage/` - Shared cross-platform storage logic
- `/packages/shared/src/storage/versioning/` - ✅ SD version management (cross-platform)
- `/packages/desktop/src/main/storage/MIGRATIONS.md` - Migration documentation
- `/packages/desktop/src/main/storage/migrate-flag-byte.ts` - Desktop migration CLI tool
