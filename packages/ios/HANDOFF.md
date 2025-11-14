# iOS Development Session Handoff

**Date**: 2025-11-13
**Branch**: `main` (all phases merged)
**Recent Commits on Main**:
- `15c9f4d` - "Merge branch 'feature/phase-3.2.4-database'"
- `5188d30` - "feat: Implement Phase 3.2.4 - iOS SQLite/GRDB Database Layer"
- `e2e746d` - "Merge branch 'feature/phase-3.2.3-storage-integration'"
- `a250354` - "feat: Implement Phase 3.2.3 - iOS Storage Integration"

---

## What We Accomplished

### Phase 3.2.1 - iOS JavaScriptCore CRDT Bridge ✅ COMPLETE

**Status**: Fully working with all 11 tests passing ✅

#### Completed Tasks

1. **Fixed JavaScript Bundle Resource Issue**
   - Used `preBuildScripts` in `project.yml` to copy JS bundle
   - Bundle successfully loads at runtime
   - Location: `packages/ios/Sources/Resources/notecove-bridge.js` (240KB)

2. **Added JavaScriptCore Polyfills**
   - **crypto.getRandomValues()**: Required by Yjs for random number generation
     - Implemented in Swift with `UInt8.random()`
     - Exposed to JS as `_swiftGetRandomValues`
   - **global object**: JavaScriptCore has no window/global by default
     - Added `var global = this;` to expose global scope
   - **atob/btoa**: Base64 encoding (already implemented)

3. **Fixed iOS Bridge API Compatibility**
   - Updated `NoteDoc` constructor calls (removed non-existent `initializeStructure()`)
   - Updated `FolderTreeDoc` constructor calls (same issue)
   - Fixed `extractTitle()` to create temp Y.Doc and extract from XmlFragment
   - Fixed function signatures for `generateUpdateFilename()` and other utilities

4. **Lint and Type Fixes**
   - Fixed TypeScript type errors in `ios-bridge.ts`
   - Updated type names: `UpdateFileMetadata`, `SnapshotFileMetadata`, `PackFileMetadata`
   - Fixed global type declarations
   - All code passes `pnpm ci-local` (format, lint, typecheck, tests)

#### Test Results

```
✅ CRDTBridgeTests: 7/7 passed
   - testBridgeInitialization
   - testCreateNote
   - testExtractTitle
   - testCloseNote
   - testCreateFolderTree
   - testClearDocumentCache
   - testGetOpenDocumentCount

✅ NoteCoveTests: 4/4 passed
   - testAppStateInitialization
   - testNoteModel
   - testPerformanceExample
   - testStorageDirectoryModel

Total: 11/11 tests passing ✅
```

#### Files Modified

**Swift:**
- `packages/ios/Sources/CRDT/CRDTBridge.swift`
  - Added crypto polyfill (lines 77-146)
  - Added global object setup (line 79)
  - Cleaned up debug logging

**TypeScript:**
- `packages/shared/src/ios-bridge.ts`
  - Fixed NoteDoc/FolderTreeDoc API calls
  - Fixed extractTitle implementation
  - Updated function signatures
  - Fixed lint errors

**Build Artifacts:**
- `packages/ios/Sources/Resources/notecove-bridge.js` - Rebuilt (240.31 KB)

### iOS CI Infrastructure ✅ COMPLETE

**Status**: Fully working, similar to desktop CI

#### Created Files

1. **`packages/ios/scripts/ci-local.sh`** (executable)
   - Finds available iOS simulator automatically
   - Rebuilds JavaScript bundle from `packages/shared`
   - Copies bundle to iOS resources
   - Regenerates Xcode project with XcodeGen
   - Builds iOS app
   - Runs all 11 unit tests
   - Exits with proper status codes

2. **`packages/ios/package.json`**
   - Defines `ci-local` script

3. **Updated `packages/ios/README.md`**
   - Added CI/CD section with usage instructions

#### Usage

```bash
# From repo root
pnpm --filter @notecove/ios ci-local

# Or from packages/ios
./scripts/ci-local.sh
```

#### Test Output Example

```
🚀 Running iOS local CI checks...
📱 Using iPhone simulator: 94377897-91F4-494C-9FA6-3B94ED2908DF
📦 Rebuilding JavaScript bundle...
✅ JavaScript bundle rebuilt
📋 Copying bundle to iOS resources...
✅ Bundle copied
🔨 Regenerating Xcode project...
✅ Xcode project regenerated
🏗️  Building iOS app...
✅ Build succeeded
🧪 Running iOS tests...
✅ All iOS CI checks passed! Safe to merge.
```

### Phase 3.2.2 - File I/O Layer ✅ COMPLETE

**Status**: Fully working with all 21 tests passing ✅

#### Completed Tasks

1. **Created FileIOManager Class**
   - Location: `packages/ios/Sources/Storage/FileIOManager.swift`
   - Comprehensive file system operations
   - Thread-safe with proper error handling

2. **Implemented Core File Operations**
   - `readFile(at:)` - Read file data with error handling
   - `writeFile(data:to:)` - Write with automatic parent directory creation
   - `deleteFile(at:)` - Safe file deletion
   - `fileExists(at:)` - Check file existence

3. **Implemented Directory Operations**
   - `createDirectory(at:)` - Recursive directory creation
   - `listFiles(in:matching:)` - List files with glob pattern support
   - Pattern matching supports `*` (any chars) and `?` (single char)
   - Automatically filters out subdirectories

4. **Implemented Atomic Writes**
   - `atomicWrite(data:to:)` - Write-to-temp-then-move pattern
   - No partial writes on failure
   - Automatic temp file cleanup
   - Uses `FileManager.replaceItemAt()` for atomic replacement

5. **Error Handling**
   - Custom `FileIOError` enum with detailed error cases:
     - `fileNotFound(String)`
     - `permissionDenied(String)`
     - `diskFull`
     - `invalidPath(String)`
     - `atomicWriteFailed(String)`
     - `directoryCreationFailed(String)`
     - `deleteFailed(String)`

6. **Comprehensive Test Suite**
   - Location: `packages/ios/Tests/Storage/FileIOManagerTests.swift`
   - 21 tests covering all functionality:
     - Basic file operations (read, write, delete)
     - Overwrite scenarios
     - Parent directory auto-creation
     - Directory operations (create, recursive)
     - File listing with and without patterns
     - Pattern matching (wildcards)
     - Atomic write behavior
     - Error cases (file not found, etc.)

#### Test Results

```
✅ FileIOManagerTests: 21/21 passed
   - testReadFile
   - testReadFileNotFound
   - testWriteFile
   - testWriteFileOverwrite
   - testWriteFileCreatesParentDirectory
   - testDeleteFile
   - testDeleteFileNotFound
   - testFileExists
   - testFileDoesNotExist
   - testCreateDirectory
   - testCreateDirectoryRecursive
   - testListFiles
   - testListFilesWithPattern
   - testListFilesIgnoresDirectories
   - testListFilesInNonExistentDirectory
   - testAtomicWrite
   - testAtomicWriteOverwrite
   - testAtomicWriteCreatesParentDirectory
   - testAtomicWriteNoPartialWrites
   - testPatternMatchingStar
   - testPatternMatchingQuestion

Total iOS Tests: 32/32 passing ✅
(7 CRDT + 21 FileIO + 4 NoteCove)
```

#### Files Created

**Swift:**
- `packages/ios/Sources/Storage/FileIOManager.swift` (273 lines)
  - FileIOError enum
  - FileIOManager class with all operations
  - Pattern matching helper

**Tests:**
- `packages/ios/Tests/Storage/FileIOManagerTests.swift` (372 lines)
  - 21 comprehensive test cases
  - Full coverage of all FileIOManager functionality

#### Documentation Updates

**Updated Files:**
- `packages/ios/README.md`
  - Added Storage section with FileIOManager documentation
  - Updated project structure to show Storage directory
  - Updated Phase 3 status to reflect Phase 3.2.2 completion
  - Updated test count (32 tests total)

### Phase 3.2.3 - Storage Integration ✅ COMPLETE

**Status**: Fully working with all 13 tests passing ✅

#### Completed Tasks

1. **Exposed FileIOManager to JavaScript**
   - Location: `packages/ios/Sources/CRDT/CRDTBridge.swift` (lines 167-263)
   - Added `setupFileIO()` method in CRDTBridge
   - Exposed 6 file operations to JavaScript:
     - `_swiftReadFile(path)` - Returns base64-encoded data or null
     - `_swiftWriteFile(path, base64Data)` - Atomic write, returns boolean
     - `_swiftDeleteFile(path)` - Delete file, returns boolean
     - `_swiftListFiles(directory, pattern)` - List files with optional glob pattern
     - `_swiftFileExists(path)` - Check file existence
     - `_swiftCreateDirectory(path)` - Create directory with intermediates

2. **TypeScript File I/O Wrappers**
   - Location: `packages/shared/src/ios-bridge.ts` (lines 102-163)
   - Added global type declarations for Swift functions
   - Implemented wrapper functions:
     - `readFile(path)` - Returns Uint8Array or null
     - `writeFile(path, data)` - Takes Uint8Array, returns boolean
     - `deleteFile(path)` - Returns boolean
     - `listFiles(directory, pattern?)` - Returns string array
     - `fileExists(path)` - Returns boolean
     - `createDirectory(path)` - Returns boolean
   - All wrappers handle base64 encoding/decoding automatically

3. **StorageDirectoryManager**
   - Location: `packages/ios/Sources/Storage/StorageDirectoryManager.swift`
   - Provides consistent path management for storage
   - Path helpers:
     - `getDocumentsDirectory()` - App's documents directory
     - `getNoteCoveDataDirectory()` - NoteCove data root
     - `getStorageDirectoryPath(id)` - Storage directory path
     - `getNotesDirectory(storageId)` - Notes subdirectory
     - `getNoteDirectory(storageId, noteId)` - Individual note directory
     - `getFolderTreePath(storageId)` - Folder tree file path
   - Directory creation:
     - `ensureDirectoriesExist(storageId)` - Create all required dirs
     - `ensureNoteDirectoryExists(storageId, noteId)` - Create note dir
   - Listing:
     - `listStorageDirectories()` - List all storage directories
     - `storageDirectoryExists(id)` - Check if storage dir exists

4. **StorageIntegrationTests**
   - Location: `packages/ios/Tests/Storage/StorageIntegrationTests.swift`
   - 13 comprehensive integration tests:
     - testWriteFileViaJavaScript
     - testWriteFileCreatesParentDirectories
     - testReadFileViaJavaScript
     - testReadNonExistentFileReturnsNull
     - testRoundTripViaJavaScript
     - testListFilesViaJavaScript
     - testListFilesWithPatternViaJavaScript
     - testDeleteFileViaJavaScript
     - testDeleteNonExistentFileReturnsFalse
     - testFileExistsViaJavaScript
     - testCreateDirectoryViaJavaScript
     - testCreateNestedDirectoryViaJavaScript
     - testStorageDirectoryManagerPaths

5. **Testing Infrastructure Improvements**
   - Added `getContextForTesting()` method to CRDTBridge (DEBUG only)
   - Tests use proper testing API instead of reflection
   - All tests marked with `@MainActor` for proper actor isolation

#### Test Results

```
✅ All Tests: 45/45 passed (0.648 seconds)

CRDTBridgeTests: 7 tests (0.051s)
FileIOManagerTests: 21 tests (0.035s)
StorageIntegrationTests: 13 tests (0.096s)
NoteCoveTests: 4 tests (0.466s)
```

#### Files Created/Modified

**Swift:**
- `packages/ios/Sources/CRDT/CRDTBridge.swift` - Modified
  - Added FileIOManager instance
  - Added `setupFileIO()` method (97 lines)
  - Added `getContextForTesting()` for tests
- `packages/ios/Sources/Storage/StorageDirectoryManager.swift` - New (145 lines)
  - Complete path management system
  - Directory creation utilities
  - Storage directory listing

**TypeScript:**
- `packages/shared/src/ios-bridge.ts` - Modified
  - Added Swift function declarations
  - Added 6 file I/O wrapper functions (62 lines)

**Tests:**
- `packages/ios/Tests/Storage/StorageIntegrationTests.swift` - New (268 lines)
  - 13 integration tests
  - Full Swift ↔ JavaScript file I/O coverage

#### Documentation Updates

**Updated Files:**
- `packages/ios/README.md`
  - Updated CRDT Bridge Integration section (now complete)
  - Added Storage Directory Management section with examples
  - Updated project structure to show StorageDirectoryManager
  - Updated test structure to show StorageIntegrationTests
  - Added Phase 3.2.3 completion status
  - Updated test count (45 tests total)

### Phase 3.2.4 - SQLite/GRDB Database Layer ✅ COMPLETE

**Status**: Fully working with all 23 tests passing ✅

#### Completed Tasks

1. **GRDB Integration**
   - Added GRDB 6.29.3 dependency via Swift Package Manager
   - Updated `project.yml` with package dependency
   - Integrated with both NoteCove app and test targets

2. **Database Schema (Schema.swift)**
   - Location: `packages/ios/Sources/Database/Schema.swift` (224 lines)
   - Complete schema with migrations system
   - Tables:
     - `storage_directories` - Storage directory metadata
     - `notes` - Note metadata (title, dates, folder, soft delete status)
     - `notes_fts` - FTS5 virtual table for full-text search
     - `folders` - Hierarchical folder structure with parent relationships
     - `tags` - Tags with optional hex colors
     - `note_tags` - Many-to-many note-tag relationships
   - Indexes for common queries (folder, storage directory, deleted status, modified date)
   - Proper cascading deletes for relationships
   - Record structs with Codable/FetchableRecord/PersistableRecord conformance
   - CodingKeys enums for snake_case database column mapping

3. **DatabaseManager (DatabaseManager.swift)**
   - Location: `packages/ios/Sources/Database/DatabaseManager.swift` (370 lines)
   - Full CRUD operations for all entities:
     - Storage Directories: upsert, get, list
     - Notes: insert, update, soft delete, permanent delete, restore, list
     - Folders: insert, update, delete, get, list with hierarchy support
     - Tags: insert, update, delete, get, list
     - Note-Tag Relationships: add, remove, query by note/tag
   - FTS5 Search:
     - `indexNoteContent()` - Index title and content
     - `searchNotes()` - Full-text search with ranking
   - Soft delete support with `deletedAt` timestamps
   - Recently deleted notes tracking
   - Transaction support for atomic operations
   - In-memory database support for testing

4. **DatabaseManagerTests**
   - Location: `packages/ios/Tests/Database/DatabaseManagerTests.swift` (379 lines)
   - 23 comprehensive tests:
     - testUpsertStorageDirectory
     - testListStorageDirectories
     - testInsertNote, testUpdateNote
     - testSoftDeleteNote, testRestoreNote, testPermanentlyDeleteNote
     - testListNotes, testListDeletedNotes
     - testIndexNoteContent, testSearchNotes
     - testInsertFolder, testUpdateFolder, testDeleteFolder, testListFolders
     - testInsertTag, testUpdateTag, testDeleteTag, testListTags
     - testAddTagToNote, testRemoveTagFromNote, testGetNotesWithTag
     - testTransaction
   - Uses in-memory database for fast, isolated tests
   - Full coverage of all DatabaseManager functionality

5. **CI Script Improvements**
   - Fixed bug in `ci-local.sh` that was falsely reporting success
   - Now uses `PIPESTATUS[0]` to capture actual xcodebuild exit code
   - Properly fails when tests fail

#### Test Results

```
✅ All Tests: 68/68 passed (0.768 seconds)

CRDTBridgeTests: 7 tests (0.052s)
FileIOManagerTests: 21 tests (0.034s)
StorageIntegrationTests: 13 tests (0.094s)
DatabaseManagerTests: 23 tests (0.118s) ← NEW
NoteCoveTests: 4 tests (0.471s)
```

#### Files Created

**Swift:**
- `packages/ios/Sources/Database/Schema.swift` (224 lines)
  - Database schema with migrations
  - All table definitions with indexes
  - Record structs for all entities
- `packages/ios/Sources/Database/DatabaseManager.swift` (370 lines)
  - Complete database manager
  - Full CRUD for all entities
  - FTS5 search implementation
  - Transaction support

**Tests:**
- `packages/ios/Tests/Database/DatabaseManagerTests.swift` (379 lines)
  - 23 comprehensive database tests
  - Full coverage of all operations

#### Files Modified

- `packages/ios/project.yml`
  - Added GRDB package dependency
  - Added dependency to both app and test targets
- `packages/ios/scripts/ci-local.sh`
  - Fixed test failure detection using PIPESTATUS
- `packages/ios/README.md`
  - Added Database Layer section with usage examples
  - Updated project structure to show Database directory
  - Updated test count (68 tests total)
  - Updated Phase 3 status to 3.2.4 completion

#### Fixes Applied by CI Runner

During CI execution, the following issues were automatically fixed:
- Added `Codable` conformance to `NoteSearchResult` struct
- Changed `Schema.migrate()` parameter from `Database` to `some DatabaseWriter`
- Added `CodingKeys` enum to `StorageDirectoryRecord` for proper column mapping

### Git Status

**Branch**: `main` (merged from `feature/phase-3-ios-app`)

**Recent Commits on Main:**
```
2341cc4 feat: Add iOS local CI script
a4c378b fix: Complete iOS JavaScriptCore bridge with working tests
565a6d3 docs: Add session handoff document for iOS development
bf5b255 feat: Implement Phase 3.2.1 - iOS JavaScriptCore CRDT bridge
c4aae2e docs: Add iOS JavaScriptCore bridge architecture design
d87fea4 fix: Correct JavaScriptCore framework dependency type
2b70921 docs: Enhance iOS README with detailed setup instructions
a1efd47 feat: Complete Phase 3.1 - iOS Project Setup
```

**Files in Working Tree:**
- `.claude/settings.local.json` - Modified (not committed, local settings)

---

## Current State

### What's Working

1. **iOS App Skeleton**
   - SwiftUI structure with tab navigation
   - Basic models (StorageDirectory, Folder, Note, Tag)
   - Asset catalog with AppIcon
   - Universal (iPhone + iPad)

2. **JavaScriptCore Bridge**
   - Fully functional with all polyfills
   - Loads 240KB JavaScript bundle
   - Marshals data between Swift and JavaScript
   - All CRDT operations exposed:
     - createNote, applyUpdate, getDocumentState, extractTitle, closeNote
     - createFolderTree, loadFolderTree, getFolderTreeState, closeFolderTree
     - clearDocumentCache, getOpenDocumentCount

3. **Build System**
   - XcodeGen project generation from `project.yml`
   - JavaScript bundling via esbuild
   - iOS CI script for automated testing

4. **File I/O Layer**
   - FileIOManager with atomic writes, pattern matching
   - 21 comprehensive file operation tests
   - All operations working correctly

5. **Storage Integration**
   - FileIOManager fully exposed to JavaScript
   - TypeScript file I/O wrappers
   - StorageDirectoryManager for path management
   - 13 integration tests passing
   - Full Swift ↔ JavaScript file I/O working

6. **Database Layer**
   - GRDB integrated with full schema
   - DatabaseManager with all CRUD operations
   - FTS5 full-text search working
   - 23 comprehensive database tests
   - Soft deletes and tag relationships

7. **Testing**
   - 68 total tests (7 CRDT + 21 FileIO + 13 Integration + 23 Database + 4 NoteCove)
   - All tests passing with iOS simulator
   - iOS CI script for automated validation
   - CI properly detects test failures

### What's Not Yet Implemented

1. **File Watching** (Phase 3.2.5 - Next)
   - FileManager notifications for local file changes
   - iCloud Drive sync monitoring
   - Debouncing rapid changes
   - Integration with database updates

2. **UI Implementation** (Phase 3.3+)
   - Notes list view
   - Editor (WKWebView + TipTap)
   - Folder navigation
   - Tags view
   - Settings
   - Search interface

---

## Next Steps: Phase 3.2.5 - File Watching

### Overview

Implement file system monitoring to detect changes to `.yjson` files, enabling real-time sync with external changes (iCloud Drive, Dropbox, manual edits). When files change, update the database and notify the UI.

### Architecture

```
File System (.yjson files)
    ↓
FileManager Notifications → FileWatchManager
    ↓                              ↓
Parse changed files         Update DatabaseManager
    ↓                              ↓
Load via CRDTBridge         Update FTS5 index
    ↓                              ↓
Extract metadata            Notify UI (Combine publishers)
```

### Implementation Plan

#### 1. FileWatchManager

**Create**: `packages/ios/Sources/Storage/FileWatchManager.swift`

Monitor file system changes:

```swift
class FileWatchManager {
    private var dispatchSource: DispatchSourceFileSystemObject?
    private let queue = DispatchQueue(label: "com.notecove.filewatcher")

    func watchDirectory(path: String, onChange: @escaping () -> Void)
    func stopWatching()
}
```

**Features:**
- Use `DispatchSource.makeFileSystemObjectSource()` for directory monitoring
- Monitor `DISPATCH_VNODE_WRITE` and `DISPATCH_VNODE_EXTEND` events
- Debounce rapid changes (500ms window)
- Support multiple storage directories

#### 2. Change Detection and Processing

**Create**: `packages/ios/Sources/Storage/FileChangeProcessor.swift`

Process file changes and update database:

```swift
class FileChangeProcessor {
    private let db: DatabaseManager
    private let bridge: CRDTBridge
    private let fileIO: FileIOManager

    func processChangedFiles(in directory: String) async throws
    func updateNoteFromFile(noteId: String, storageId: String) async throws
    func indexNoteContent(noteId: String) async throws
}
```

**Logic:**
1. List all `.yjson` files in changed directory
2. For each note, load CRDT updates via bridge
3. Extract title and content
4. Update database metadata
5. Update FTS5 index

#### 3. iCloud Integration

**Update**: `packages/ios/Sources/NoteCove.entitlements`

Enable iCloud Drive:

```xml
<key>com.apple.developer.icloud-container-identifiers</key>
<array>
    <string>iCloud.com.notecove.app</string>
</array>
<key>com.apple.developer.ubiquity-container-identifiers</key>
<array>
    <string>iCloud.com.notecove.app</string>
</array>
```

**Create**: `packages/ios/Sources/Storage/iCloudManager.swift`

```swift
class iCloudManager {
    func getContainerURL() -> URL?
    func isICloudAvailable() -> Bool
    func watchICloudChanges(onChange: @escaping () -> Void)
}
```

#### 4. Debouncing

**Create**: `packages/ios/Sources/Utilities/Debouncer.swift`

```swift
class Debouncer {
    private var workItem: DispatchWorkItem?
    private let delay: TimeInterval

    init(delay: TimeInterval)

    func debounce(_ action: @escaping () -> Void)
    func cancel()
}
```

**Usage:**
- Debounce file system events (500ms)
- Prevent multiple updates for rapid file changes
- Cancel pending updates when new changes arrive

#### 5. Integration with UI

**Update**: `packages/ios/Sources/Storage/StorageCoordinator.swift`

Central coordinator for storage operations:

```swift
@MainActor
class StorageCoordinator: ObservableObject {
    @Published var storageDirectories: [StorageDirectory] = []
    @Published var recentlyUpdatedNotes: Set<String> = []

    private let db: DatabaseManager
    private let fileWatch: FileWatchManager
    private let changeProcessor: FileChangeProcessor

    func startWatching(storageId: String)
    func stopWatching(storageId: String)
    func handleFileChange(in directory: String)
}
```

#### 6. Tests

**Create**: `packages/ios/Tests/Storage/FileWatchManagerTests.swift`

Tests to write:
- `testWatchDirectory()` - Verify watching starts successfully
- `testDetectFileCreation()` - Detect when files are created
- `testDetectFileModification()` - Detect when files are modified
- `testDebouncing()` - Verify rapid changes are debounced
- `testStopWatching()` - Verify cleanup works correctly

**Create**: `packages/ios/Tests/Storage/FileChangeProcessorTests.swift`

Tests to write:
- `testProcessSingleNoteChange()` - Process one changed note
- `testProcessMultipleChanges()` - Process multiple notes
- `testUpdateDatabase()` - Verify database updates correctly
- `testUpdateFTS5()` - Verify search index updates
- `testExtractMetadata()` - Verify title extraction

### Acceptance Criteria

- [ ] FileWatchManager implemented with directory monitoring
- [ ] Debouncing works correctly (500ms window)
- [ ] File changes trigger database updates
- [ ] FTS5 index updated when notes change
- [ ] iCloud Drive support configured (entitlements)
- [ ] All tests passing (10+ new tests)
- [ ] CI tests pass (`pnpm --filter @notecove/ios ci-local`)
- [ ] Documentation updated

### Design Considerations

1. **Performance**
   - Only process files that actually changed (use modification dates)
   - Batch database updates where possible
   - Use background queue for file processing

2. **Reliability**
   - Handle partial file writes (use modification time + size checks)
   - Gracefully handle corrupted files
   - Log errors without crashing

3. **Battery Life**
   - Don't poll, use event-driven notifications
   - Debounce rapid changes to reduce processing
   - Suspend watching when app is backgrounded

4. **iCloud Sync**
   - Detect iCloud availability before enabling
   - Handle iCloud container URL changes
   - Support both local and iCloud storage directories

### Documentation to Update

After implementation:
- [ ] Update `packages/ios/README.md` with file watching details
- [ ] Update architecture docs with sync flow
- [ ] Add inline documentation to new classes
- [ ] Update HANDOFF.md with completion status

---

## Key File Locations

### iOS Package
- **Xcode project config**: `packages/ios/project.yml`
- **Swift source**: `packages/ios/Sources/`
- **Tests**: `packages/ios/Tests/`
- **CI script**: `packages/ios/scripts/ci-local.sh`
- **README**: `packages/ios/README.md`

### CRDT Bridge
- **Swift bridge**: `packages/ios/Sources/CRDT/CRDTBridge.swift`
- **Bridge tests**: `packages/ios/Tests/CRDTBridgeTests.swift`
- **JS bundle source**: `packages/shared/dist/ios/notecove-bridge.js`
- **JS bridge entry**: `packages/shared/src/ios-bridge.ts`
- **Bundle build script**: `packages/shared/scripts/build-ios-bundle.js`

### Documentation
- **Architecture**: `docs/ios/jscore-bridge.md`
- **Phase plan**: `PLAN-PHASE-3.md`
- **This handoff**: `packages/ios/HANDOFF.md`

### iOS Simulator
```bash
# List available simulators
xcrun simctl list devices available | grep iPhone

# Currently using (from CI):
iPhone 17 Pro: 94377897-91F4-494C-9FA6-3B94ED2908DF
```

---

## Running Tests

### Full iOS CI
```bash
# From repo root
pnpm --filter @notecove/ios ci-local
```

### Manual Testing
```bash
cd packages/ios
xcodegen generate
xcodebuild test \
  -project NoteCove.xcodeproj \
  -scheme NoteCove \
  -destination 'platform=iOS Simulator,id=94377897-91F4-494C-9FA6-3B94ED2908DF'
```

### Building in Xcode
1. Open `packages/ios/NoteCove.xcodeproj` in Xcode
2. Select iPhone simulator from scheme selector
3. Press Cmd+R to build and run
4. Press Cmd+U to run tests

---

## Common Issues & Solutions

### "JavaScript bundle not found"
- Run `cd packages/shared && pnpm build:ios`
- Copy bundle: `cp packages/shared/dist/ios/notecove-bridge.js packages/ios/Sources/Resources/`
- Regenerate project: `cd packages/ios && xcodegen generate`

### "No such module" errors
- Clean build folder in Xcode (Cmd+Shift+K)
- Regenerate project: `xcodegen generate`
- Restart Xcode

### Tests fail with crypto errors
- Check that crypto polyfill is in `CRDTBridge.swift` (lines 77-146)
- Verify global object setup is present (line 79)
- Check JavaScript bundle is up to date

### CI script can't find simulator
- Install iOS Simulator via Xcode > Settings > Platforms
- List available: `xcrun simctl list devices available`
- Update simulator ID in script if needed

---

## Development Environment

### Required Software
- Xcode 26.1.1+ (iOS 26.1 SDK)
- XcodeGen (via Homebrew)
- Node.js (for pnpm and esbuild)
- pnpm

### Swift Version
- Swift 6.0

### iOS Target
- Deployment target: iOS 17.0
- SDK: iOS 26.1

---

## Session End Notes

- Phase 3.2.4 (SQLite/GRDB Database Layer) is **COMPLETE** and merged to `main` ✅
- Complete database layer with GRDB 6.29.3 integrated
- Database schema with 6 tables (storage_directories, notes, folders, tags, note_tags, notes_fts)
- DatabaseManager with full CRUD operations for all entities
- FTS5 full-text search implementation working
- Soft delete support with deletedAt timestamps
- Many-to-many tag relationships
- All 68 tests passing (7 CRDT + 21 FileIO + 13 Integration + 23 Database + 4 NoteCove) ✅
- CI infrastructure working correctly with proper test failure detection
- Documentation fully updated (README.md, HANDOFF.md)
- Storage stack complete: File I/O → Storage Integration → Database Layer
- Ready to proceed with Phase 3.2.5 (File Watching)
- No blocking issues
