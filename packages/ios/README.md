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
│   ├── Assets.xcassets/    # Images, colors, etc.
│   ├── Info.plist          # App configuration
│   └── NoteCove.entitlements # App capabilities (iCloud, etc.)
└── Tests/                   # XCTest unit tests
    └── NoteCoveTests.swift
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

**Current Status**: Phase 3.1 (iOS Project Setup) - Complete ✅

### Completed

- ✅ Xcode project created and configured
- ✅ SwiftUI app structure
- ✅ Basic models (StorageDirectory, Folder, Note, Tag)
- ✅ XCTest framework set up
- ✅ Universal app (iPhone + iPad)
- ✅ iOS 17.0+ target

### Next Steps

- Phase 3.2: iOS CRDT Implementation (JavaScriptCore bridge)
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

Run tests from Xcode (Cmd+U) or from the command line:

```bash
xcodebuild test -project NoteCove.xcodeproj -scheme NoteCove -destination 'platform=iOS Simulator,name=iPhone 16'
```

## License

Apache-2.0 - See LICENSE in the root directory.
