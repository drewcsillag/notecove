# NoteCove iOS

Native iOS application for NoteCove, built with SwiftUI and JavaScriptCore.

## Overview

The iOS app shares CRDT logic with the desktop app via JavaScriptCore bridge, while using native SwiftUI for all UI components (except the rich text editor, which uses WKWebView + TipTap).

## Architecture

- **UI Layer**: SwiftUI (native)
- **CRDT Layer**: TypeScript via JavaScriptCore (shared with desktop)
- **Editor**: WKWebView + TipTap (same as desktop)
- **Storage**: SQLite via GRDB + file-based CRDT
- **Sync**: File system watchers (iCloud Drive, Dropbox, etc.)

## Storage

The iOS app implements a layered storage architecture:

### File I/O Layer (`FileIOManager`)

Handles all file system operations with support for:

- **Basic Operations**: Read, write, delete files
- **Atomic Writes**: Write-to-temp-then-move pattern ensures no partial writes
- **Directory Management**: Create directories with intermediate path support
- **Pattern Matching**: List files with glob patterns (e.g., `*.yjson`)
- **Error Handling**: Comprehensive error types for file operations

**Location**: `packages/ios/Sources/Storage/FileIOManager.swift`

**Usage Example**:

```swift
let fileIO = FileIOManager()

// Write a file atomically
let data = "Hello".data(using: .utf8)!
try fileIO.atomicWrite(data: data, to: "/path/to/file.yjson")

// Read a file
let contents = try fileIO.readFile(at: "/path/to/file.yjson")

// List .yjson files
let yjsonFiles = try fileIO.listFiles(in: "/path/to/directory", matching: "*.yjson")
```

### CRDT Bridge Integration

The FileIOManager is fully integrated with the CRDTBridge, exposing file operations to JavaScript. The shared CRDT logic can now read/write `.yjson` files directly.

**Swift Side** (`CRDTBridge.swift`):

```swift
// File I/O functions exposed to JavaScript:
- _swiftReadFile(path) -> base64 string or null
- _swiftWriteFile(path, base64Data) -> boolean
- _swiftDeleteFile(path) -> boolean
- _swiftListFiles(directory, pattern) -> array of paths
- _swiftFileExists(path) -> boolean
- _swiftCreateDirectory(path) -> boolean
```

**JavaScript Side** (`ios-bridge.ts`):

```typescript
import { readFile, writeFile, listFiles } from './ios-bridge';

// Read a .yjson file
const data = readFile('/path/to/note/update-001.yjson');

// Write atomically
const success = writeFile('/path/to/note/update-002.yjson', updateData);

// List all update files
const files = listFiles('/path/to/note', '*.yjson');
```

### Storage Directory Management

The `StorageDirectoryManager` provides consistent path management:

```swift
let manager = StorageDirectoryManager()

// Get storage directory paths
let sdPath = manager.getStorageDirectoryPath(id: "sd-123")
let notesDir = manager.getNotesDirectory(storageId: "sd-123")
let noteDir = manager.getNoteDirectory(storageId: "sd-123", noteId: "note-456")

// Ensure directories exist
try manager.ensureDirectoriesExist(storageId: "sd-123")
```

### Database Layer (`DatabaseManager`)

The `DatabaseManager` provides SQLite database operations via GRDB:

**Features:**

- **Metadata Storage**: Notes, folders, tags, storage directories
- **Full-Text Search**: FTS5-powered search across note content
- **Relationships**: Many-to-many note-tag relationships
- **Soft Deletes**: Recently deleted notes tracking
- **Migrations**: Automatic schema versioning and migrations

**Location**: `packages/ios/Sources/Database/DatabaseManager.swift`

**Usage Example**:

```swift
// Initialize database
let dbURL = URL(fileURLWithPath: "/path/to/database.sqlite")
let db = try DatabaseManager(at: dbURL)

// Insert a note
try db.insertNote(
    id: "note-123",
    storageDirectoryId: "sd-1",
    folderId: nil,
    title: "My Note"
)

// Full-text search
let results = try db.searchNotes(query: "Swift programming", in: "sd-1")

// Tag operations
try db.insertTag(id: "tag-1", storageDirectoryId: "sd-1", name: "important", color: "#FF0000")
try db.addTagToNote(noteId: "note-123", tagId: "tag-1")

// List notes in a folder
let notes = try db.listNotes(in: "sd-1", folderId: "folder-1")
```

**Database Schema:**

- `storage_directories` - Storage directory metadata
- `notes` - Note metadata (title, dates, folder, deleted status)
- `notes_fts` - FTS5 virtual table for full-text search
- `folders` - Folder hierarchy
- `tags` - Tags with optional colors
- `note_tags` - Many-to-many note-tag relationships

### File Watching (`FileWatchManager`)

The `FileWatchManager` monitors directories for file system changes, enabling real-time sync with external changes from iCloud Drive, Dropbox, or manual edits.

**Features:**

- **Directory Monitoring**: Uses `DispatchSource` for efficient, event-driven file watching
- **Debouncing**: Configurable debounce interval (default 500ms) to handle rapid changes
- **Battery Efficient**: Event-driven, no polling
- **Thread Safe**: Runs on background queue

**Location**: `packages/ios/Sources/Storage/FileWatchManager.swift`

**Usage Example**:

```swift
let watcher = FileWatchManager()

// Start watching a directory
watcher.watchDirectory(path: "/path/to/notes", debounceInterval: 0.5) {
    print("Files changed, refresh database")
}

// Stop watching
watcher.stopWatching()
```

### File Change Processing (`FileChangeProcessor`)

The `FileChangeProcessor` processes file system changes and updates the database:

1. Loads CRDT updates from `.yjson` files
2. Extracts metadata (title, content)
3. Updates the database
4. Updates the FTS5 search index

**Location**: `packages/ios/Sources/Storage/FileChangeProcessor.swift`

**Usage Example**:

```swift
let processor = FileChangeProcessor(db: db, bridge: bridge, fileIO: fileIO)

// Process all changed files in a directory
try await processor.processChangedFiles(in: "/path/to/notes", storageId: "sd-123")

// Process a single note
try await processor.updateNoteFromFile(noteId: "note-456", storageId: "sd-123")
```

### iCloud Integration (`iCloudManager`)

The `iCloudManager` provides iCloud Drive integration:

**Features:**

- Check iCloud availability
- Access iCloud container
- Monitor iCloud sync changes
- Get Documents directory within iCloud

**Location**: `packages/ios/Sources/Storage/iCloudManager.swift`

**Usage Example**:

```swift
let iCloud = iCloudManager()

// Check if iCloud is available
if iCloud.isICloudAvailable() {
    // Get the iCloud container URL
    if let containerURL = iCloud.getContainerURL() {
        print("iCloud container: \(containerURL)")

        // Watch for iCloud changes
        iCloud.watchICloudChanges {
            print("iCloud files changed")
        }
    }
}
```

### Storage Coordinator (`StorageCoordinator`)

The `StorageCoordinator` ties together file watching, change processing, and database updates:

**Features:**

- Manages multiple storage directories
- Coordinates file watching and database updates
- Publishes changes via Combine for UI observation
- Tracks recently updated notes

**Location**: `packages/ios/Sources/Storage/StorageCoordinator.swift`

**Usage Example**:

```swift
@MainActor
let coordinator = StorageCoordinator(db: db)

// Load storage directories from database
await coordinator.loadStorageDirectories()

// Start watching a storage directory
await coordinator.startWatching(storageId: "sd-123")

// Observe changes in SwiftUI
coordinator.$recentlyUpdatedNotes
    .sink { notes in
        print("Notes updated: \(notes)")
    }
```

### Utilities

**Debouncer** (`packages/ios/Sources/Utilities/Debouncer.swift`):

```swift
let debouncer = Debouncer(delay: 0.5)

// Rapid calls only execute the last one
for i in 1...100 {
    debouncer.debounce {
        print("Processing \(i)") // Only prints once for i=100
    }
}
```

### Storage Format

Notes are stored as `.yjson` files containing Yjs CRDT updates:

- Update files: Sequential CRDT updates
- Snapshot files: Periodic full state snapshots
- Pack files: Compacted update sequences

For more details, see the [JavaScriptCore Bridge Architecture](../../docs/ios/jscore-bridge.md).

## Requirements

- iOS 17.0+
- Xcode 26.1.1+ (or latest version)
- macOS for development
- Apple ID (free account works for development)
- XcodeGen (installed via Homebrew)

## Project Structure

```
packages/ios/
├── project.yml              # XcodeGen project definition
├── Sources/                 # Swift source files
│   ├── NoteCoveApp.swift   # App entry point
│   ├── ContentView.swift   # Main UI
│   ├── Models.swift        # Data models
│   ├── CRDT/               # JavaScriptCore bridge
│   │   └── CRDTBridge.swift
│   ├── Storage/            # File I/O and storage management
│   │   ├── FileIOManager.swift
│   │   ├── StorageDirectoryManager.swift
│   │   ├── FileWatchManager.swift
│   │   ├── FileChangeProcessor.swift
│   │   ├── iCloudManager.swift
│   │   └── StorageCoordinator.swift
│   ├── Database/           # SQLite database layer (GRDB)
│   │   ├── Schema.swift
│   │   └── DatabaseManager.swift
│   ├── Utilities/          # Utility classes
│   │   └── Debouncer.swift
│   ├── Resources/          # JavaScript bundles
│   │   └── notecove-bridge.js
│   ├── Assets.xcassets/    # Images, colors, etc.
│   ├── Info.plist          # App configuration
│   └── NoteCove.entitlements # App capabilities (iCloud, etc.)
├── Tests/                   # XCTest unit tests
│   ├── NoteCoveTests.swift
│   ├── CRDTBridgeTests.swift
│   ├── Storage/
│   │   ├── FileIOManagerTests.swift
│   │   ├── StorageIntegrationTests.swift
│   │   ├── FileWatchManagerTests.swift
│   │   ├── FileChangeProcessorTests.swift
│   │   ├── iCloudManagerTests.swift
│   │   └── StorageCoordinatorTests.swift
│   ├── Database/
│   │   └── DatabaseManagerTests.swift
│   └── Utilities/
│       └── DebouncerTests.swift
└── scripts/                 # Build and CI scripts
    └── ci-local.sh
```

## Quick Start

### First Time Setup

1. **Install XcodeGen** (if not already installed):

   ```bash
   brew install xcodegen
   ```

2. **Navigate to the iOS package**:

   ```bash
   cd packages/ios
   ```

3. **Generate the Xcode project**:

   ```bash
   xcodegen generate
   ```

4. **Open the project**:
   ```bash
   open NoteCove.xcodeproj
   ```

### Configure Code Signing (First Time Only)

When you first open the project in Xcode, you'll need to set up code signing:

1. **Sign in to Xcode with your Apple ID**:
   - Go to **Xcode** menu > **Settings** (or press **Cmd+,**)
   - Click **Accounts** tab
   - Click the **+** button and select **Apple ID**
   - Sign in with your Apple ID (free account works fine)

2. **Configure the project target**:
   - In Xcode's left sidebar (Project Navigator), click **NoteCove** at the very top
   - In the main editor, select the **NoteCove** target (under "TARGETS")
   - Click the **Signing & Capabilities** tab
   - Under "Signing", check **Automatically manage signing**
   - In the **Team** dropdown, select your Apple ID team (usually "Your Name (Personal Team)")
   - Xcode will automatically generate a provisioning profile

   > **Note**: With a free Apple Developer account, apps expire after 7 days. You'll need to rebuild/reinstall periodically. For production deployment, you'll need a paid developer account ($99/year).

### Running the App

1. **Select a simulator**:
   - At the top of Xcode, click the scheme selector (shows "NoteCove" and a device)
   - Choose any iPhone or iPad simulator (e.g., "iPhone 17", "iPhone Air", "iPad Pro")
   - If you don't see any simulators, go to **Xcode** > **Settings** > **Platforms** and ensure iOS is installed

2. **Build and run**:
   - Press **Cmd+R** (or click the **Play** button at the top left)
   - The simulator will launch and the app will install
   - You should see a tab bar with three tabs: **Notes**, **Tags**, **Settings**
   - Each tab currently shows placeholder text (functionality coming in later phases)

3. **Run tests**:
   - Press **Cmd+U** to run unit tests
   - You should see 4 tests pass in the Test Navigator

### What You'll See

The current app (Phase 3.1) is a skeleton with:

- ✅ Tab bar navigation (Notes, Tags, Settings)
- ✅ Basic SwiftUI views
- ✅ Placeholder text indicating future implementation
- ❌ No actual functionality yet (that's Phase 3.2+)

This is expected! We're building the foundation first.

## Installing to Your Personal iPhone

You can install the app directly to your iPhone without using the App Store or TestFlight:

### Prerequisites

- Personal iPhone with iOS 17.0 or later
- USB cable (or USB-C cable for newer devices)
- Apple ID (free account works for development)

### Installation Steps

1. **Connect your iPhone**:
   - Plug your iPhone into your Mac using a USB/USB-C cable
   - Unlock your iPhone

2. **Trust your Mac** (first time only):
   - On your iPhone, you'll see an alert: "Trust This Computer?"
   - Tap **Trust**
   - Enter your iPhone passcode if prompted

3. **Select your iPhone as the build destination**:
   - In Xcode, click the scheme selector at the top (next to the Play button)
   - Under "iOS Device", select your connected iPhone (it will show your device name)
   - Your iPhone should appear at the top of the list with your device name

4. **Build and run**:
   - Press **Cmd+R** (or click the **Play** button)
   - Xcode will build the app and install it on your iPhone
   - The first build may take a minute or two

5. **Trust the developer certificate** (first time only with free account):
   - After installation, you'll see "Untrusted Developer" when trying to launch the app
   - On your iPhone, go to **Settings** > **General** > **VPN & Device Management**
   - Under "DEVELOPER APP", tap on your Apple ID email
   - Tap **Trust "[Your Apple ID]"**
   - Tap **Trust** in the confirmation dialog
   - Now you can launch the app

### Important Notes

- **Free Apple Developer Account**: Apps signed with a free account expire after **7 days**. You'll need to rebuild and reinstall the app weekly. For longer validity, consider a paid Apple Developer Program membership ($99/year).
- **App stays on device**: Once installed, the app remains on your iPhone until you delete it or the provisioning expires.
- **Wireless debugging** (optional): After the first USB installation, you can enable wireless debugging:
  1. In Xcode, go to **Window** > **Devices and Simulators**
  2. Select your device
  3. Check **Connect via network**
  4. Your device will appear in the scheme selector even when not plugged in

### Troubleshooting

**"Failed to prepare device for development"**:

- Unplug and replug your iPhone
- Restart Xcode
- On your iPhone, go to **Settings** > **Privacy & Security** > **Developer Mode** and enable it (iOS 16+)

**"The operation couldn't be completed. Unable to launch..."**:

- Make sure you've trusted the developer certificate (see step 5 above)
- Check that your iPhone is unlocked

**"Your device has run out of application identifiers"**:

- Free accounts are limited to 3 app identifiers per 7-day period
- Wait a few days or use a different Apple ID
- Consider upgrading to a paid developer account

**App won't install or crashes immediately**:

- Make sure your iPhone is running iOS 17.0 or later
- Clean build folder in Xcode: **Product** > **Clean Build Folder** (Cmd+Shift+K)
- Delete the app from your iPhone and reinstall

## Building

### Regenerate Xcode Project

The Xcode project is generated from `project.yml` using XcodeGen. Any time you modify `project.yml`, regenerate:

```bash
cd packages/ios
xcodegen generate
```

The `.xcodeproj` file is gitignored and should always be regenerated (never edited manually).

### Build from Command Line

> **Note**: Command-line builds may require additional simulator setup. Using Xcode GUI is recommended for now.

```bash
# List available simulators
xcrun simctl list devices available | grep iPhone

# Build for simulator (update device name as needed)
xcodebuild -project NoteCove.xcodeproj \
  -scheme NoteCove \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  build

# Run tests
xcodebuild test \
  -project NoteCove.xcodeproj \
  -scheme NoteCove \
  -destination 'platform=iOS Simulator,name=iPhone 17'
```

## CI/CD

### Running Local CI

Before committing iOS changes, run the local CI script to ensure all tests pass:

```bash
# From repo root
pnpm --filter @notecove/ios ci-local

# Or from packages/ios
./scripts/ci-local.sh
```

The CI script will:

1. Find an available iOS simulator
2. Rebuild the JavaScript bundle from `packages/shared`
3. Copy the bundle to iOS resources
4. Regenerate the Xcode project with XcodeGen
5. Build the iOS app
6. Run all unit tests

All tests must pass before merging to main.

## Troubleshooting

### "No such module" errors

- Make sure you've generated the project with `xcodegen generate`
- Clean the build folder: **Product** > **Clean Build Folder** (Cmd+Shift+K)
- Restart Xcode

### Code signing errors

- Ensure you're signed in to Xcode with your Apple ID (**Xcode** > **Settings** > **Accounts**)
- Make sure "Automatically manage signing" is checked
- Select your team in the Team dropdown
- If using a free account, note that apps expire after 7 days

### Simulator not available

- Go to **Xcode** > **Settings** > **Platforms**
- Ensure iOS platform is installed
- Download additional simulators if needed

### Command-line builds fail

- Use Xcode GUI for building (more reliable)
- Command-line builds are documented but may need simulator runtime configuration

## Phase 3 Implementation Plan

See [PLAN-PHASE-3.md](../../PLAN-PHASE-3.md) for detailed implementation plan.

**Current Status**: Phase 3.2.5 (File Watching) - Complete ✅

### Completed

**Phase 3.1: iOS Project Setup** ✅

- ✅ Xcode project created and configured
- ✅ SwiftUI app structure
- ✅ Basic models (StorageDirectory, Folder, Note, Tag)
- ✅ XCTest framework set up
- ✅ Universal app (iPhone + iPad)
- ✅ iOS 17.0+ target

**Phase 3.2.1: JavaScriptCore CRDT Bridge** ✅

- ✅ JavaScriptCore bridge with CRDT operations
- ✅ JavaScript bundle integration (240KB)
- ✅ Polyfills (crypto.getRandomValues, global, atob/btoa)
- ✅ All 11 CRDT bridge tests passing

**Phase 3.2.2: File I/O Layer** ✅

- ✅ FileIOManager with full file operations
- ✅ Atomic write support (no partial writes)
- ✅ Directory management with recursive creation
- ✅ Pattern matching for file listing (glob support)
- ✅ Comprehensive error handling
- ✅ All 21 FileIOManager tests passing
- ✅ iOS CI infrastructure

**Phase 3.2.3: Storage Integration** ✅

- ✅ FileIOManager exposed to JavaScript via CRDTBridge
- ✅ TypeScript file I/O wrappers (readFile, writeFile, etc.)
- ✅ StorageDirectoryManager for path management
- ✅ All 13 StorageIntegrationTests passing
- ✅ Full Swift ↔ JavaScript file I/O integration

**Phase 3.2.4: SQLite/GRDB Database** ✅

- ✅ GRDB dependency integrated via Swift Package Manager
- ✅ Database schema with migrations (notes, folders, tags, relationships)
- ✅ DatabaseManager with full CRUD operations
- ✅ FTS5 full-text search implementation
- ✅ Soft deletes and recently deleted tracking
- ✅ Tag management with many-to-many relationships
- ✅ All 23 DatabaseManagerTests passing

**Phase 3.2.5: File Watching** ✅

- ✅ FileWatchManager with DispatchSource directory monitoring
- ✅ Debouncer utility for handling rapid changes (500ms default)
- ✅ FileChangeProcessor for database updates from file changes
- ✅ iCloudManager for iCloud Drive integration
- ✅ StorageCoordinator tying together watching, processing, and database
- ✅ All 40 new tests passing (8 FileWatchManager + 8 FileChangeProcessor + 8 iCloudManager + 9 StorageCoordinator + 7 Debouncer)
- ✅ Real-time sync with external changes (iCloud, Dropbox, manual edits)

### Next Steps

- Phase 3.3: Navigation Structure (SD list → folder list → note list → editor)
- Phase 3.4: Combined Folder/Tag View
- Phase 3.5: Editor (WKWebView + TipTap)
- Phase 3.6: Settings
- Phase 3.7: Recently Deleted & Restoration
- Phase 3.8: Search (FTS5)
- Phase 3.9: Accessibility
- Phase 3.10: Note History

## Testing

Unit tests are written using XCTest and located in the `Tests/` directory.

**Current Test Coverage**: 72.15% (target: 80%)

- 158 tests total (all passing ✅)
- Unit tests: 149 tests
  - CRDTBridgeTests: 7 tests
  - FileIOManagerTests: 21 tests
  - StorageIntegrationTests: 13 tests
  - DatabaseManagerTests: 23 tests
  - FileWatchManagerTests: 8 tests
  - FileChangeProcessorTests: 15 tests (includes new error path tests)
  - iCloudManagerTests: 8 tests
  - StorageCoordinatorTests: 9 tests
  - DebouncerTests: 7 tests
  - EditorViewModelTests: 2 tests
  - ModelsTests: 16 tests (data model validation)
  - StorageDirectoryManagerTests: 16 tests (path management)
  - NoteCoveTests: 4 tests
- UI tests: 9 tests
  - AppLaunchTests: 2 tests
  - BasicFlowTests: 4 tests
  - StorageAndNoteTests: 3 tests
- Cross-platform tests: 4 tests (see below)

### Running Unit Tests

Run tests from Xcode (Cmd+U) or from the command line:

```bash
xcodebuild test -project NoteCove.xcodeproj -scheme NoteCove -destination 'platform=iOS Simulator,name=iPhone 17'
```

Or use the iOS CI script (includes coverage reporting):

```bash
pnpm --filter @notecove/ios ci-local
```

The CI script will fail if coverage drops below 80%.

### Running UI Tests

UI tests verify end-to-end user flows:

```bash
xcodebuild test \
  -project NoteCove.xcodeproj \
  -scheme NoteCove \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -only-testing:NoteCoveUITests
```

### Cross-Platform Tests

Cross-platform e2e tests verify that iOS and Desktop can share a storage directory and sync changes bidirectionally.

**Source Files**:
- `packages/ios/scripts/test-cross-platform.sh` - Coordinator script
- `packages/ios/Tests/CrossPlatformTests.swift` - iOS test suite
- `packages/desktop/e2e/cross-platform-setup.spec.ts` - Desktop creates shared note
- `packages/desktop/e2e/cross-platform-verify.spec.ts` - Desktop verifies iOS changes

**Running Cross-Platform Tests**:

```bash
cd packages/ios
./scripts/test-cross-platform.sh
```

The script will:
1. Find and boot the iOS simulator
2. Generate the Xcode project
3. Create a shared directory at `/tmp/notecove-cross-platform-test`
4. Run desktop test to create a note in the shared directory
5. Run iOS test to verify desktop's note
6. Run iOS test to edit the note
7. Run desktop test to verify iOS's changes
8. Clean up the shared directory

**How it Works**:
- Both Desktop and iOS tests use a fixed shared directory: `/tmp/notecove-cross-platform-test`
- Desktop tests read the path from the `NOTECOVE_CROSS_PLATFORM_SD` environment variable (set by the script)
- iOS tests use the hardcoded path (iOS test sandboxes can access `/tmp`)
- No complex environment variable passing or app container discovery needed!
- The tests can even run standalone (they'll create the directory if it doesn't exist)

**What's Tested**:
- ✅ Desktop creates note → iOS can read it with correct title
- ✅ iOS can edit the note → Desktop sees the changes
- ✅ iOS can create new notes → Desktop can see them
- ✅ iOS can create folders → Desktop can see them
- ✅ Directory structure is fully compatible across platforms
- ✅ CRDT sync works bidirectionally
- ✅ Yjs update files are properly formatted and readable by both platforms

**Manual Testing**:

To manually test cross-platform sync outside of the automated tests, you need to use the iOS app's Documents directory (since regular apps can't access `/tmp` like XCTest can).

**Quick Setup (Recommended):**
```bash
cd packages/ios
./scripts/setup-manual-test.sh
```

This will:
- Find your booted simulator
- Locate the NoteCove app container
- Create a shared directory
- Print the paths to use in both apps

**Or manually:**

1. **Find the iOS app's Documents directory:**
   ```bash
   # Boot simulator and run NoteCove app first
   SIMULATOR_ID=$(xcrun simctl list devices booted | grep "iPhone" | head -1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')
   APP_CONTAINER=$(xcrun simctl get_app_container "$SIMULATOR_ID" com.notecove.NoteCove data)
   SHARED_DIR="$APP_CONTAINER/Documents/ManualTestStorage"
   mkdir -p "$SHARED_DIR"
   echo "Shared directory: $SHARED_DIR"
   ```

2. **On Desktop (Electron app):**
   - Open NoteCove Desktop
   - Create a new storage directory pointing to the path from step 1
   - Example: `/Users/you/Library/Developer/CoreSimulator/.../Documents/ManualTestStorage`
   - Create some notes and folders
   - Edit notes and verify content is saved

3. **On iOS (Simulator):**
   - Run the iOS app in Xcode
   - Add a storage directory in Settings
   - Use the relative path: `Documents/ManualTestStorage`
   - Navigate to the storage directory
   - You should see the notes and folders created by Desktop
   - Edit the notes and create new ones

4. **On iOS (Real Device):**
   - Use iCloud Drive or another cloud storage service
   - Both iOS and Desktop apps can point to the same iCloud folder
   - Or use a network share accessible to both

5. **Verify Bidirectional Sync:**
   - Check that Desktop sees the iOS changes
   - Check that iOS sees the Desktop changes
   - Verify note titles, content, and folder structure match
   - Check that CRDT updates are properly merged (no conflicts)

6. **Inspect the File Structure:**
   ```bash
   # Browse in Finder
   open "$SHARED_DIR"

   # Check a note's update files
   ls -la "$SHARED_DIR/<note-id>/updates/"

   # View update file contents (Yjs binary format)
   hexdump -C "$SHARED_DIR/<note-id>/updates/*.yjson"
   ```

## License

Apache-2.0 - See LICENSE in the root directory.
