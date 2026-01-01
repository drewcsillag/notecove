# iOS App Implementation Plan

**Overall Progress:** `20%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)

---

## Summary

Build a native iOS app for NoteCove, initially targeting iPad with adaptive layout for iPhone. The app will sync with the existing desktop app via shared iCloud Drive folders.

### Key Decisions

| Decision | Choice | Source |
|----------|--------|--------|
| Editor approach | Hybrid: Native SwiftUI shell + WKWebView for TipTap editor | [QUESTIONS-2.md](./QUESTIONS-2.md) |
| UI framework | SwiftUI-first, UIKit for WebView and file picker | [QUESTIONS-2.md](./QUESTIONS-2.md) |
| Database | GRDB.swift (FTS5 support required) | [QUESTIONS-2.md](./QUESTIONS-2.md) |
| Cloud storage | User picks folder (iCloud Drive for MVP, then Google Drive) | [QUESTIONS-1.md](./QUESTIONS-1.md) |
| iOS version | iOS 17+ (with iOS 26 enhancements) | [QUESTIONS-1.md](./QUESTIONS-1.md) |
| Bundle ID | `com.notecove.NoteCove` | [QUESTIONS-2.md](./QUESTIONS-2.md) |
| Profile | Single hardcoded profile per device | [QUESTIONS-2.md](./QUESTIONS-2.md) |
| CRDT strategy | JavaScriptCore + ios-bridge.ts | [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) |
| Background sync | Foreground-only (acceptable limitation) | [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) |

### iOS 26 Features to Leverage

Based on [iOS 26 developer documentation](https://www.hackingwithswift.com/articles/278/whats-new-in-swiftui-for-ios-26):

| Feature | Use Case | Priority |
|---------|----------|----------|
| **Liquid Glass** design | Modern UI with `.buttonStyle(.glass)` | Phase 5 |
| **Native WebView** | SwiftUI WebView wrapper (simpler than UIViewRepresentable) | Phase 2 |
| **Rich-text TextView** | Future alternative to WKWebView (investigate) | Future |
| **ToolbarSpacer** | Better toolbar layout | Phase 3 |
| **40% performance gains** | Benefit automatically | - |

### Phase Overview

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Project Foundation | 🟩 Complete |
| 2 | Read-Only MVP | 🟥 To Do |
| 3 | Editing Support | 🟥 To Do |
| 4 | Search & Navigation | 🟥 To Do |
| 5 | Polish & Advanced | 🟥 To Do |

---

## Phase 1: Project Foundation

**Goal:** Set up Xcode project, basic app structure, and database layer.

**Detailed plan:** [PLAN-PHASE-1.md](./PLAN-PHASE-1.md)

### Tasks

- [x] 🟩 **1.1 Xcode Project Setup** ✅
  - [x] 🟩 Create iOS app target in `packages/ios/`
  - [x] 🟩 Configure for iOS 17+, iPad + iPhone (adaptive)
  - [x] 🟩 Set bundle ID `com.notecove.NoteCove`
  - [x] 🟩 Add GRDB.swift via Swift Package Manager
  - [x] 🟩 Configure iCloud entitlements
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **1.2 Database Layer** ✅
  - [x] 🟩 Port SQLite schema from `packages/shared/src/database/schema.ts`
  - [x] 🟩 Create GRDB database manager
  - [x] 🟩 Implement FTS5 virtual table for notes
  - [x] 🟩 Write unit tests for database operations (12 tests)
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **1.3 Storage Directory Access** ✅
  - [x] 🟩 Implement folder picker using fileImporter
  - [x] 🟩 Store security-scoped bookmark for persistent access
  - [x] 🟩 Handle bookmark expiration gracefully
  - [x] 🟩 Create StorageDirectoryManager class
  - [x] 🟩 Write tests for storage directory access (7 tests)
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **1.4 Basic App Shell with Test Data** ✅
  - [x] 🟩 Create main App struct with SwiftUI lifecycle
  - [x] 🟩 Implement NavigationSplitView for 3-column layout
  - [x] 🟩 Load SampleData for folders/notes (UI testing before CRDT works)
  - [x] 🟩 Display hardcoded folder/note list
  - [x] 🟩 Add onboarding flow for first launch (folder selection)
  - [x] 🟩 Update PLAN.md

---

## Phase 2: Read-Only MVP

**Goal:** Browse and read notes synced from desktop. This is the minimum viable product.

**Detailed plan:** [PLAN-PHASE-2.md](./PLAN-PHASE-2.md)

### Tasks

- [ ] 🟥 **2.1 CRDT Integration (JavaScriptCore)**
  - [ ] 🟥 Bundle `ios-bridge.ts` compiled for JavaScriptCore
  - [ ] 🟥 Create Swift wrapper for NoteCoveBridge
  - [ ] 🟥 Implement CRDT document loading from `.yjson` files
  - [ ] 🟥 Extract note content, title from CRDT state
  - [ ] 🟥 Write tests using fixtures from `packages/ios/fixtures/`
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **2.2 Debug Tools (Early)**
  - [ ] 🟥 Add hidden "Debug" tab in settings
  - [ ] 🟥 Show SD file list with file sizes and dates
  - [ ] 🟥 Show database table contents
  - [ ] 🟥 Show activity log entries
  - [ ] 🟥 This becomes foundation for Storage Inspector in Phase 5
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **2.3 Folder Tree Sync**
  - [ ] 🟥 Load folder tree CRDT from storage directory
  - [ ] 🟥 Populate folders table in database
  - [ ] 🟥 Create FolderTreeView SwiftUI component
  - [ ] 🟥 Implement folder selection
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **2.4 Note List**
  - [ ] 🟥 Scan storage directory for note files
  - [ ] 🟥 Extract metadata (title, preview, modified date)
  - [ ] 🟥 Populate notes table in database
  - [ ] 🟥 Create NoteListView SwiftUI component
  - [ ] 🟥 Filter notes by selected folder
  - [ ] 🟥 Sort by modified date (pinned first)
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **2.5 Read-Only Note Viewer**
  - [ ] 🟥 Create WKWebView wrapper for rendering (or iOS 26 native WebView)
  - [ ] 🟥 Bundle minimal TipTap read-only renderer
  - [ ] 🟥 Pass CRDT state to WebView for rendering
  - [ ] 🟥 Handle images: load from storage directory media folder
  - [ ] 🟥 Render tables, code blocks, lists correctly
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **2.6 Sync Monitoring**
  - [ ] 🟥 Implement foreground-only file scanning (no background polling)
  - [ ] 🟥 Trigger rescan on app foreground (UIApplication lifecycle)
  - [ ] 🟥 Detect new/modified notes and reload
  - [ ] 🟥 Add instance ID generation for this device
  - [ ] 🟥 Write activity log entries
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **2.7 Error Handling**
  - [ ] 🟥 Handle: iCloud Drive not configured
  - [ ] 🟥 Handle: Folder access denied
  - [ ] 🟥 Handle: Corrupt CRDT files
  - [ ] 🟥 Handle: Security-scoped bookmark expired
  - [ ] 🟥 Show user-friendly error messages
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **2.8 Desktop-iOS Sync Testing**
  - [ ] 🟥 Test: Create note on desktop, verify appears on iOS
  - [ ] 🟥 Test: Edit note on desktop, verify updates on iOS
  - [ ] 🟥 Test: Create folder on desktop, verify appears on iOS
  - [ ] 🟥 Test: Move note on desktop, verify moves on iOS
  - [ ] 🟥 Test on physical device (not just simulator)
  - [ ] 🟥 Document any sync issues discovered
  - [ ] 🟥 Update PLAN.md

---

## Phase 3: Editing Support

**Goal:** Enable creating and editing notes on iOS.

**Detailed plan:** [PLAN-PHASE-3.md](./PLAN-PHASE-3.md)

### Tasks

- [ ] 🟥 **3.1 TipTap Editor Integration**
  - [ ] 🟥 Bundle full TipTap editor (not just renderer)
  - [ ] 🟥 Configure for iOS-appropriate toolbar (use ToolbarSpacer for layout)
  - [ ] 🟥 Set up JavaScript bridge for Swift ↔ TipTap communication
  - [ ] 🟥 Handle iOS keyboard appearance/dismissal
  - [ ] 🟥 Test with external keyboard
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **3.2 CRDT Updates**
  - [ ] 🟥 Capture editor changes as Yjs updates
  - [ ] 🟥 Write updates to storage directory (append-only log format)
  - [ ] 🟥 Generate proper filenames with instance ID and sequence
  - [ ] 🟥 Update local database cache
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **3.3 Note Creation**
  - [ ] 🟥 Add "New Note" button to UI
  - [ ] 🟥 Create new CRDT document
  - [ ] 🟥 Write initial snapshot to storage directory
  - [ ] 🟥 Add to database and navigate to editor
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **3.4 Rich Text Features**
  - [ ] 🟥 Bold, italic, underline, strikethrough (Priority 1)
  - [ ] 🟥 Headings H1-H3 (Priority 1)
  - [ ] 🟥 Bullet, numbered, task lists (Priority 1)
  - [ ] 🟥 Blockquotes (Priority 1)
  - [ ] 🟥 Tables (Priority 1)
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **3.5 Image Support**
  - [ ] 🟥 View images from notes
  - [ ] 🟥 Insert images from photo library
  - [ ] 🟥 Paste images from clipboard
  - [ ] 🟥 Store images in SD media folder
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **3.6 Bidirectional Sync Testing**
  - [ ] 🟥 Test: Edit on iOS, verify syncs to desktop
  - [ ] 🟥 Test: Concurrent edits on both, verify CRDT merge
  - [ ] 🟥 Test: Offline edit on iOS, sync when back online
  - [ ] 🟥 Update PLAN.md

---

## Phase 4: Search & Navigation

**Goal:** Full-text search and inter-note navigation.

**Detailed plan:** [PLAN-PHASE-4.md](./PLAN-PHASE-4.md)

### Tasks

- [ ] 🟥 **4.1 Full-Text Search**
  - [ ] 🟥 Index note content in FTS5 table
  - [ ] 🟥 Create search UI with results
  - [ ] 🟥 Highlight matching snippets
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **4.2 Inter-Note Links**
  - [ ] 🟥 Parse `[[note-id]]` links in content
  - [ ] 🟥 Make links tappable in viewer/editor
  - [ ] 🟥 Navigate to linked note on tap
  - [ ] 🟥 Handle broken links gracefully
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **4.3 Tags Display**
  - [ ] 🟥 Extract #hashtags from note content
  - [ ] 🟥 Display tags in note list and viewer
  - [ ] 🟥 (Filtering deferred to later phase)
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **4.4 Folder Management**
  - [ ] 🟥 Create new folders
  - [ ] 🟥 Rename folders
  - [ ] 🟥 Move notes between folders
  - [ ] 🟥 Delete folders (move notes to parent)
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **4.5 Keyboard Shortcuts**
  - [ ] 🟥 Implement Mac-style shortcuts for external keyboard
  - [ ] 🟥 Cmd+N: New note
  - [ ] 🟥 Cmd+F: Search
  - [ ] 🟥 Cmd+B/I/U: Bold/Italic/Underline
  - [ ] 🟥 Update PLAN.md

---

## Phase 5: Polish & Advanced Features

**Goal:** Dark mode, comments, Liquid Glass design, and other polish items.

**Detailed plan:** [PLAN-PHASE-5.md](./PLAN-PHASE-5.md)

### Tasks

- [ ] 🟥 **5.1 Dark Mode**
  - [ ] 🟥 Implement system theme detection
  - [ ] 🟥 Apply dark theme to native UI
  - [ ] 🟥 Apply dark theme to WebView editor
  - [ ] 🟥 Persist theme preference
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **5.2 iOS 26 Liquid Glass Design**
  - [ ] 🟥 Apply `.buttonStyle(.glass)` to appropriate buttons
  - [ ] 🟥 Update toolbar styling for Liquid Glass
  - [ ] 🟥 Ensure design consistency with iOS 26 aesthetic
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **5.3 Code Blocks**
  - [ ] 🟥 Syntax highlighting in viewer
  - [ ] 🟥 Language selection in editor
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **5.4 Comments (Priority 3)**
  - [ ] 🟥 Display comment threads on notes
  - [ ] 🟥 Add new comments
  - [ ] 🟥 Reply to comments
  - [ ] 🟥 Emoji reactions
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **5.5 Link Unfurling (Priority 4)**
  - [ ] 🟥 Port oEmbed fetching logic
  - [ ] 🟥 Display preview cards for URLs
  - [ ] 🟥 Cache previews in database
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **5.6 Print (Priority 4)**
  - [ ] 🟥 Generate printable view
  - [ ] 🟥 Use iOS print system
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **5.7 Storage Inspector (Full)**
  - [ ] 🟥 Expand debug view from Phase 2
  - [ ] 🟥 View raw CRDT file contents
  - [ ] 🟥 Hex dump / base64 view
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **5.8 Paranoid Mode (Priority 5)**
  - [ ] 🟥 Disable network features when enabled
  - [ ] 🟥 Block link unfurling
  - [ ] 🟥 Update PLAN.md

---

## Future Phases (Post-MVP)

These are explicitly out of scope for initial release:

- [ ] 🟥 **Google Drive support** (quick follow after MVP)
- [ ] 🟥 **Dropbox/OneDrive support**
- [ ] 🟥 **Multi-window (Stage Manager)**
- [ ] 🟥 **Split View / Slide Over enhancements**
- [ ] 🟥 **Apple Pencil optimizations**
- [ ] 🟥 **Share extension**
- [ ] 🟥 **Widgets**
- [ ] 🟥 **Shortcuts app integration**
- [ ] 🟥 **iPhone-optimized layout**
- [ ] 🟥 **Native rich-text editor** (using iOS 26 TextView - investigate as alternative to WKWebView)

---

## Deferred Items

(Items moved here only with user approval)

- **Markdown import/export** - User marked as "x" (never want)
- **Multiple profiles** - User marked as "x" (never want for iOS)
- **Web server** - User marked as "x" (not applicable to iOS)
- **Thumbnail generation** - User marked as "x" (not needed)

---

## Technical Notes

### Test Fixtures

Test fixtures copied from Dev profile to `packages/ios/fixtures/`:
- `notes/` - Sample note CRDT files
- `folders/` - Folder tree CRDT
- `media/` - Sample images
- `activity/` - Activity log samples
- `SD_ID`, `SD-TYPE` - Storage directory metadata

### File Structure

```
packages/ios/
├── NoteCove/
│   ├── App/
│   │   ├── NoteCoveApp.swift          # App entry point
│   │   └── AppDelegate.swift          # UIKit lifecycle if needed
│   ├── Views/
│   │   ├── ContentView.swift          # Main NavigationSplitView
│   │   ├── FolderTreeView.swift       # Sidebar folder list
│   │   ├── NoteListView.swift         # Note list with previews
│   │   ├── NoteEditorView.swift       # WKWebView wrapper
│   │   ├── SearchView.swift           # Search UI
│   │   ├── SettingsView.swift         # Settings screens
│   │   ├── DebugView.swift            # Debug/inspector view
│   │   └── OnboardingView.swift       # First-launch wizard
│   ├── Models/
│   │   ├── Note.swift                 # Note model
│   │   ├── Folder.swift               # Folder model
│   │   └── StorageDirectory.swift     # SD model
│   ├── Database/
│   │   ├── DatabaseManager.swift      # GRDB wrapper
│   │   ├── Schema.swift               # Table definitions
│   │   └── Migrations.swift           # Schema migrations
│   ├── Storage/
│   │   ├── StorageDirectoryManager.swift
│   │   ├── CRDTManager.swift          # JavaScriptCore + ios-bridge wrapper
│   │   └── SyncMonitor.swift          # Foreground file change detection
│   ├── Editor/
│   │   ├── TipTapWebView.swift        # WKWebView + TipTap
│   │   ├── EditorBridge.swift         # JS ↔ Swift communication
│   │   └── Resources/
│   │       ├── ios-bridge-bundle.js   # Bundled ios-bridge.ts
│   │       └── editor-bundle.js       # Bundled TipTap
│   └── Utilities/
│       ├── InstanceID.swift           # Device instance ID
│       └── ActivityLogger.swift       # Sync activity logging
├── fixtures/                          # Test data from desktop
├── NoteCove.xcodeproj
├── NoteCoveTests/
└── NoteCoveUITests/
```

### Known Limitations

| Limitation | Reason | Workaround |
|------------|--------|------------|
| No background sync | iOS doesn't allow background file polling | Sync on app foreground |
| WebView memory limits | WKWebView has ~300-500MB limit | Only load active note |
| Security-scoped bookmarks expire | iOS security model | Re-prompt user when expired |

### Build Script

A local CI script at `packages/ios/scripts/ci-local.sh`:

```bash
#!/bin/bash
set -e

# Run unit tests
xcodebuild test \
  -project NoteCove.xcodeproj \
  -scheme NoteCove \
  -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4)'

# Build for release
xcodebuild \
  -project NoteCove.xcodeproj \
  -scheme NoteCove \
  -configuration Release \
  -destination 'generic/platform=iOS'
```

### Testing Strategy

1. **Unit tests (XCTest)**: Database operations, CRDT loading, file parsing
2. **Integration tests**: Sync scenarios with fixture files from `packages/ios/fixtures/`
3. **UI tests (XCTest UI)**: Navigation, folder/note selection
4. **Device testing**: Desktop-iOS sync with real iCloud Drive on physical iPad
5. **Manual testing**: Concurrent editing scenarios

---

## Change Log

| Date | Change |
|------|--------|
| 2025-12-31 | Initial plan created |
| 2025-12-31 | Updated after critique: JavaScriptCore confirmed, debug tools moved to Phase 2, iOS 26 features added, test fixtures added, error handling added |
| 2025-12-31 | Completed Phase 1.1: Xcode project setup with GRDB, iCloud entitlements |
| 2025-12-31 | Completed Phase 1.2: Database layer with GRDB migrations, FTS5 search, 12 unit tests |
| 2025-12-31 | Completed Phase 1.3: StorageDirectoryManager with bookmarks, lifecycle handling, 7 tests |
| 2025-12-31 | Completed Phase 1.4: Basic app shell with SampleData for folders/notes, onboarding flow |
| 2025-12-31 | **Phase 1 Complete**: Project foundation ready (22 tests passing) |
