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
│   │   └── StorageDirectoryManager.swift
│   ├── Resources/          # JavaScript bundles
│   │   └── notecove-bridge.js
│   ├── Assets.xcassets/    # Images, colors, etc.
│   ├── Info.plist          # App configuration
│   └── NoteCove.entitlements # App capabilities (iCloud, etc.)
├── Tests/                   # XCTest unit tests
│   ├── NoteCoveTests.swift
│   ├── CRDTBridgeTests.swift
│   └── Storage/
│       ├── FileIOManagerTests.swift
│       └── StorageIntegrationTests.swift
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

**Current Status**: Phase 3.2.3 (Storage Integration) - Complete ✅

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

### Next Steps

- Phase 3.2.4: SQLite/GRDB (database schema, FTS5 search, indexing)
- Phase 3.2.5: File Watching (FileManager notifications, iCloud sync)
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

**Current Test Coverage**:
- 45 tests total (all passing ✅)
- CRDTBridgeTests: 7 tests
- FileIOManagerTests: 21 tests
- StorageIntegrationTests: 13 tests
- NoteCoveTests: 4 tests

Run tests from Xcode (Cmd+U) or from the command line:

```bash
xcodebuild test -project NoteCove.xcodeproj -scheme NoteCove -destination 'platform=iOS Simulator,name=iPhone 16'
```

Or use the iOS CI script:

```bash
pnpm --filter @notecove/ios ci-local
```

## License

Apache-2.0 - See LICENSE in the root directory.
