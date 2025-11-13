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
- Xcode 26.1.1+
- macOS for development

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

## Building

### Generate Xcode Project

The Xcode project is generated from `project.yml` using XcodeGen:

```bash
cd packages/ios
xcodegen generate
```

This creates `NoteCove.xcodeproj`. The project file is gitignored and should be regenerated as needed.

### Open in Xcode

```bash
open NoteCove.xcodeproj
```

### Build from Command Line

```bash
# Build for simulator
xcodebuild -project NoteCove.xcodeproj \
  -scheme NoteCove \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  build

# Run tests
xcodebuild test \
  -project NoteCove.xcodeproj \
  -scheme NoteCove \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

## Development Setup

1. **Install XcodeGen** (if not already installed):
   ```bash
   brew install xcodegen
   ```

2. **Generate the Xcode project**:
   ```bash
   xcodegen generate
   ```

3. **Open in Xcode**:
   ```bash
   open NoteCove.xcodeproj
   ```

4. **Set up code signing**:
   - Open the project in Xcode
   - Select the NoteCove target
   - Go to "Signing & Capabilities"
   - Select your development team
   - Xcode will handle provisioning profiles automatically (free Apple Developer account is fine for development)

5. **Run on simulator or device**:
   - Select a simulator or connected device
   - Press Cmd+R to build and run

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
