# iOS Persistence Compatibility Analysis

## Current Persistence Architecture

### 1. SQLite Database (better-sqlite3)

**Purpose**: Metadata cache, search index (FTS5), folder structure, tags, app state
**Location**: Single database file
**iOS Compatibility**: ✅ **COMPATIBLE**

- SQLite is natively supported on iOS
- Schema is platform-agnostic (standard SQL)
- FTS5 is available in iOS SQLite
- Will need to swap `better-sqlite3` (Node.js native addon) for React Native SQLite binding
- **Recommended**: `react-native-sqlite-storage` or `@op-engineering/op-sqlite`

### 2. CRDT Files (Yjs Updates)

**Purpose**: Source of truth for note content and folder structure
**Format**: Binary Yjs updates stored as .yjson files
**Location**: `{sdPath}/notes/{noteId}/updates/*.yjson` and `{sdPath}/folders/updates/*.yjson`
**iOS Compatibility**: ⚠️ **NEEDS ADAPTER**

- File format is platform-agnostic
- File system structure is iOS-compatible
- Need to ensure paths use iOS app sandbox directories
- **Recommended**: Store in app's Documents directory for iCloud backup

### 3. File System Adapter (NodeFileSystemAdapter)

**Purpose**: Abstract file system operations
**Current**: Uses Node.js `fs` module
**iOS Compatibility**: ❌ **REQUIRES REPLACEMENT**

- Already properly abstracted via `FileSystemAdapter` interface ✅
- Need iOS-compatible implementation using React Native File System
- **Recommended**: `react-native-fs` or Expo FileSystem
- Interface is well-designed - just need new implementation

### 4. File Watching (node-file-watcher.ts)

**Purpose**: Cross-instance synchronization via file system events
**Current**: Uses chokidar (Node.js)
**iOS Compatibility**: ❌ **NOT APPLICABLE**

- File watching isn't needed on iOS (single instance)
- For iCloud sync, use CloudKit notifications
- **Action**: Skip file watching on iOS platform

## Phase 4 Features - iOS Compatibility

| Feature                   | Persistence Impact                 | iOS Compatible           |
| ------------------------- | ---------------------------------- | ------------------------ |
| 4.1 Tags System           | SQLite (tags table already exists) | ✅ YES                   |
| 4.2 Inter-Note Links      | Stored in CRDT content             | ✅ YES                   |
| 4.3 Advanced Search       | SQLite FTS5                        | ✅ YES                   |
| 4.4 Export as Markdown    | Read-only, file system write       | ✅ YES (with FS adapter) |
| 4.5 Tri-State Checkboxes  | Stored in CRDT                     | ✅ YES                   |
| 4.6 Color Highlight       | Stored in CRDT                     | ✅ YES                   |
| 4.7 TipTap Extensions     | Stored in CRDT                     | ✅ YES                   |
| 4.8 IPC API (Read)        | Desktop-only feature               | ❌ N/A                   |
| 4.9 Due Dates & @mentions | SQLite indexing                    | ✅ YES                   |
| 4.10 Apple Shortcuts      | iOS automation                     | ✅ YES (iOS-specific)    |
| 4.11 IPC API (Write)      | Desktop-only feature               | ❌ N/A                   |

## Strategy for iOS Compatibility

### Immediate (Phase 4)

1. **Use existing abstractions**: FileSystemAdapter, DatabaseAdapter are already in place
2. **Keep platform-agnostic data structures**: All CRDT and SQLite schemas work cross-platform
3. **Avoid Node.js-specific APIs**: Don't add new Node.js dependencies in shared code
4. **Test with abstracted interfaces**: Unit tests should work with any adapter implementation

### Future (iOS Implementation)

1. **Create iOS adapters**:
   - `IOSFileSystemAdapter` implementing `FileSystemAdapter`
   - `IOSSQLiteAdapter` implementing `DatabaseAdapter`
2. **Use iOS-appropriate paths**:
   - Documents directory: `{appDocuments}/NoteCove/SDs/{sdId}/`
   - Database: `{appDocuments}/NoteCove/cache.db`
3. **Handle platform differences**:
   - Skip file watching initialization on iOS
   - Use CloudKit for cross-device sync instead of file watching
   - Use background fetch for sync checks

## Recommended Implementation Order

Since the user wants iOS-compatible features first, implement in this order:

1. ✅ **4.1 Tags System** - Pure SQLite (already fully compatible)
2. ✅ **4.2 Inter-Note Links** - Pure CRDT (already fully compatible)
3. ✅ **4.5 Tri-State Checkboxes** - Pure CRDT (already fully compatible)
4. ✅ **4.9 Due Dates & @mentions** - SQLite + CRDT (already fully compatible)
5. ✅ **4.6 Color Highlight** - Pure CRDT (already fully compatible)
6. ✅ **4.7 TipTap Extensions** - Pure CRDT (already fully compatible)
7. ✅ **4.3 Advanced Search** - SQLite FTS5 (already fully compatible)
8. ⚠️ **4.4 Export as Markdown** - Needs file picker (platform-specific UI)
9. ✅ **4.10 Apple Shortcuts** - iOS-specific (implement when doing iOS app)

## Key Takeaways

✅ **Good News**: The persistence layer is already well-architected for iOS

- All data structures are platform-agnostic
- Proper abstraction layers exist
- Most Phase 4 features require no persistence changes

⚠️ **Needs Work**: Only two areas need iOS-specific implementations:

1. SQLite adapter (swap better-sqlite3 for React Native binding)
2. File system adapter (swap Node.js fs for React Native FS)

✅ **Can Proceed with Confidence**: All Phase 4 features can be implemented now without concerns about iOS compatibility. The underlying persistence is already portable.
