# iOS App Implementation Plan

**Overall Progress:** `60%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)

---

## Summary

Build a native iOS app for NoteCove, initially targeting iPad with adaptive layout for iPhone. The app will sync with the existing desktop app via shared iCloud Drive folders.

### Key Decisions

| Decision        | Choice                                                       | Source                                       |
| --------------- | ------------------------------------------------------------ | -------------------------------------------- |
| Editor approach | Hybrid: Native SwiftUI shell + WKWebView for TipTap editor   | [QUESTIONS-2.md](./QUESTIONS-2.md)           |
| UI framework    | SwiftUI-first, UIKit for WebView and file picker             | [QUESTIONS-2.md](./QUESTIONS-2.md)           |
| Database        | GRDB.swift (FTS5 support required)                           | [QUESTIONS-2.md](./QUESTIONS-2.md)           |
| Cloud storage   | User picks folder (iCloud Drive for MVP, then Google Drive)  | [QUESTIONS-1.md](./QUESTIONS-1.md)           |
| iOS version     | iOS 17+ (with iOS 26 enhancements)                           | [QUESTIONS-1.md](./QUESTIONS-1.md)           |
| Bundle ID       | `com.notecove.NoteCove`                                      | [QUESTIONS-2.md](./QUESTIONS-2.md)           |
| Profile         | Single hardcoded profile per device                          | [QUESTIONS-2.md](./QUESTIONS-2.md)           |
| Multi-SD        | Multiple SDs supported; folder tree shows all SDs as parents | Phase 6 planning (2026-01-01)                |
| CRDT strategy   | JavaScriptCore + ios-bridge.ts                               | [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) |
| Background sync | Foreground-only (acceptable limitation)                      | [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) |

### iOS 26 Features to Leverage

Based on [iOS 26 developer documentation](https://www.hackingwithswift.com/articles/278/whats-new-in-swiftui-for-ios-26):

| Feature                   | Use Case                                                   | Priority |
| ------------------------- | ---------------------------------------------------------- | -------- |
| **Liquid Glass** design   | Modern UI with `.buttonStyle(.glass)`                      | Phase 5  |
| **Native WebView**        | SwiftUI WebView wrapper (simpler than UIViewRepresentable) | Phase 2  |
| **Rich-text TextView**    | Future alternative to WKWebView (investigate)              | Future   |
| **ToolbarSpacer**         | Better toolbar layout                                      | Phase 3  |
| **40% performance gains** | Benefit automatically                                      | -        |

### Phase Overview

| Phase | Focus               | Status         |
| ----- | ------------------- | -------------- |
| 1     | Project Foundation  | 🟩 Complete    |
| 2     | Read-Only MVP       | 🟨 In Progress |
| 3     | Editing Support     | 🟨 In Progress |
| 4     | Search & Navigation | 🟥 To Do       |
| 5     | Polish & Advanced   | 🟥 To Do       |
| 6     | Multi-SD Support    | 🟥 To Do       |

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

- [x] 🟩 **2.1 CRDT Integration (JavaScriptCore)** ✅
  - [x] 🟩 Bundle `ios-bridge.ts` compiled for JavaScriptCore
  - [x] 🟩 Create Swift wrapper for NoteCoveBridge (CRDTManager.swift)
  - [x] 🟩 Implement CRDT document loading from `.crdtlog` files (binary format, not .yjson)
  - [x] 🟩 Extract note content, title from CRDT state
  - [x] 🟩 Add polyfills for JavaScriptCore (crypto, TextEncoder/TextDecoder, atob/btoa)
  - [x] 🟩 Write tests (9 CRDT tests passing)
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **2.2 Debug Tools (Early)** ✅
  - [x] 🟩 Add hidden debug access (5 taps on gear icon)
  - [x] 🟩 Show SD file list with file sizes and dates
  - [x] 🟩 Show database table contents and row counts
  - [x] 🟩 Show activity log entries
  - [x] 🟩 This becomes foundation for Storage Inspector in Phase 5
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **2.3 Folder Tree Sync** ✅
  - [x] 🟩 Load folder tree CRDT from storage directory (via CRDTManager)
  - [x] 🟩 Add extractFolders method to ios-bridge.ts and CRDTManager
  - [x] 🟩 Update FolderTreeView to load from CRDT when SD available
  - [x] 🟩 Implement folder selection (NavigationLink)
  - [x] 🟩 Fall back to SampleData when no SD configured
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **2.4 Note List** ✅
  - [x] 🟩 Scan storage directory for note folders
  - [x] 🟩 Add extractNoteMetadata to ios-bridge.ts
  - [x] 🟩 Add NoteInfo struct and loadAllNotes to CRDTManager
  - [x] 🟩 Update NoteListView to load from CRDT
  - [x] 🟩 Filter notes by selected folder
  - [x] 🟩 Sort by modified date (pinned first)
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **2.5 Read-Only Note Viewer** ✅
  - [x] 🟩 Create WKWebView wrapper for rendering (ReadOnlyNoteWebView)
  - [x] 🟩 Convert CRDT Y.XmlFragment to HTML via extractContentAsHTML
  - [x] 🟩 CSS styling with dark/light mode support
  - [x] 🟩 Render tables, code blocks, lists, task items correctly
  - [x] 🟩 External links open in Safari
  - [x] 🟩 11 CRDT tests, 35 total tests
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **2.6 Sync Monitoring** ✅
  - [x] 🟩 Implement foreground-only file scanning (SyncMonitor)
  - [x] 🟩 Trigger rescan on app foreground (UIApplication lifecycle)
  - [x] 🟩 Detect new/modified notes and reload via notification
  - [x] 🟩 Add InstanceID class for device identification
  - [x] 🟩 Write activity log entries on sync
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **2.7 Error Handling** ✅
  - [x] 🟩 Handle: iCloud Drive not configured (StorageDirectoryError.iCloudNotConfigured)
  - [x] 🟩 Handle: Folder access denied (StorageDirectoryError.accessDenied)
  - [x] 🟩 Handle: Corrupt CRDT files (CRDTError.corruptCRDTFile)
  - [x] 🟩 Handle: Security-scoped bookmark expired (StorageDirectoryError.bookmarkStale)
  - [x] 🟩 User-friendly error messages with recovery suggestions
  - [x] 🟩 Context-aware error icons and colors in UI
  - [x] 🟩 Update PLAN.md

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

- [x] 🟩 **3.1 TipTap Editor Integration** ✅
  - [x] 🟩 Bundle full TipTap editor (ios-editor.ts with esbuild)
  - [x] 🟩 Create ios-editor.html template for WKWebView
  - [x] 🟩 Set up JavaScript bridge for Swift ↔ TipTap communication (webkit.messageHandlers)
  - [x] 🟩 Add syncAndGetUpdate() for capturing editor changes as Yjs
  - [x] 🟩 Handle iOS keyboard appearance/dismissal
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **3.2 CRDT Updates** ✅
  - [x] 🟩 Capture editor changes as Yjs updates (syncAndGetUpdate in ios-editor.ts)
  - [x] 🟩 Write updates to storage directory (append-only log format)
  - [x] 🟩 Generate proper filenames with instance ID and sequence (generateLogFilename)
  - [x] 🟩 Add createLogFileFromUpdate to ios-bridge for binary log creation
  - [x] 🟩 Add saveNoteUpdate to CRDTManager.swift
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **3.3 Note Creation** ✅
  - [x] 🟩 "New Note" button already in UI (toolbar)
  - [x] 🟩 Add generateNoteId to ios-bridge using generateCompactId
  - [x] 🟩 Add createNewNote to CRDTManager.swift
  - [x] 🟩 Write initial log file to storage directory
  - [x] 🟩 Navigate to editor (with startInEditMode flag)
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **3.4 Rich Text Features** ✅
  - [x] 🟩 Bold, italic, underline, strikethrough
  - [x] 🟩 Headings H1-H3 (via menu dropdown)
  - [x] 🟩 Bullet, numbered, task lists
  - [x] 🟩 Blockquotes
  - [x] 🟩 Code blocks
  - [x] 🟩 Tables (insert, add/delete rows/columns)
  - [x] 🟩 Undo/Redo
  - [x] 🟩 EditorFormattingToolbar with scrollable button bar
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **3.5 Image Support** ✅
  - [x] 🟩 View images from notes (notecove:// URL scheme with WKURLSchemeHandler)
  - [x] 🟩 Insert images from photo library (PhotosPicker integration)
  - [x] 🟩 Paste images from clipboard (handlePaste in TipTap)
  - [x] 🟩 Store images in SD media folder (ImageStorage with content-addressed naming)
  - [x] 🟩 Update PLAN.md

- [ ] 🟨 **3.6 Bidirectional Sync Testing**
  - [ ] 🟨 Test: Edit on iOS, verify syncs to desktop
  - [ ] 🟨 Test: Concurrent edits on both, verify CRDT merge
  - [ ] 🟨 Test: Offline edit on iOS, sync when back online
  - [ ] 🟨 Test: Images added on iOS sync to desktop
  - [ ] 🟨 Test: Images from desktop display on iOS
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

## Phase 6: Multi-SD Support

**Goal:** Support multiple Storage Directories, SD creation, and unified folder tree.

**Detailed plan:** [PLAN-PHASE-6.md](./PLAN-PHASE-6.md)

### Design Decisions

| Decision             | Choice                                | Rationale                                      |
| -------------------- | ------------------------------------- | ---------------------------------------------- |
| SD Creation Location | User chooses: Cloud (iCloud) or Local | Mirrors desktop flexibility                    |
| Default folder name  | `NoteCove` in chosen location         | Simple, recognizable                           |
| Folder tree          | All SDs shown as top-level parents    | No separate "switcher" - unified view          |
| Bookmark storage     | Multiple bookmarks keyed by SD ID     | Each SD needs its own security-scoped bookmark |

### Tasks

- [ ] 🟥 **6.1 StorageDirectoryManager Multi-SD Refactor**
  - [ ] 🟥 Change from single `activeDirectory` to `registeredDirectories: [StorageDirectoryInfo]`
  - [ ] 🟥 Store multiple security-scoped bookmarks (keyed by SD ID)
  - [ ] 🟥 Add `registerDirectory(url:)` → validates, creates bookmark, adds to list
  - [ ] 🟥 Add `unregisterDirectory(id:)` → removes bookmark, removes from list
  - [ ] 🟥 Keep `activeDirectory` concept for "currently focused" SD (for note creation context)
  - [ ] 🟥 Persist registered SD list to database (`storage_dirs` table)
  - [ ] 🟥 Restore all bookmarks on app launch
  - [ ] 🟥 Write tests for multi-SD bookmark management
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **6.2 SD Creation**
  - [ ] 🟥 Add `createStorageDirectory(at:name:)` to StorageDirectoryManager
  - [ ] 🟥 Generate SD_ID using `generateCompactId()` from ios-bridge
  - [ ] 🟥 Create directory structure: `notes/`, `folders/`, `activity/`, `media/`
  - [ ] 🟥 Write `SD_ID` file
  - [ ] 🟥 Write `SD-TYPE` file ("icloud" or "local")
  - [ ] 🟥 Initialize empty folder tree CRDT
  - [ ] 🟥 Register the new SD (bookmark + database)
  - [ ] 🟥 Write tests for SD creation
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **6.3 Onboarding Flow Redesign**
  - [ ] 🟥 First screen: "Where do you want to store your notes?"
    - [ ] 🟥 Option: "In the cloud" (syncs across devices)
    - [ ] 🟥 Option: "On this device only" (local storage)
  - [ ] 🟥 Cloud path: Choose provider (iCloud only for now), default folder `NoteCove`
  - [ ] 🟥 Local path: Default to `NoteCove` in On My iPad, allow customization
  - [ ] 🟥 Both paths: Allow picking existing SD folder instead of creating new
  - [ ] 🟥 After setup: Show folder tree with new SD
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **6.4 Unified Folder Tree**
  - [ ] 🟥 Refactor FolderTreeView to show all registered SDs
  - [ ] 🟥 Each SD appears as a top-level "folder" with its name
  - [ ] 🟥 SD folders are expandable/collapsible, contain their folder trees
  - [ ] 🟥 Visual distinction for SD vs regular folder (different icon, maybe bold)
  - [ ] 🟥 "All Notes" option shows notes from ALL SDs
  - [ ] 🟥 Tapping SD name selects it (shows its notes, sets as active for new note creation)
  - [ ] 🟥 Context menu on SD: Rename, Remove (unregister, doesn't delete files)
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **6.5 Add SD Flow**
  - [ ] 🟥 "Add Storage" button in folder sidebar (or settings)
  - [ ] 🟥 Same flow as onboarding: Cloud vs Local → pick/create folder
  - [ ] 🟥 Can also "Add Existing" to pick a folder that already has SD_ID
  - [ ] 🟥 New SD appears in folder tree immediately
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **6.6 SyncMonitor Multi-SD**
  - [ ] 🟥 Monitor all registered SDs for changes (not just one)
  - [ ] 🟥 Track `lastKnownNoteModTimes` per SD
  - [ ] 🟥 Post notifications with SD ID so views know which SD changed
  - [ ] 🟥 Handle SD becoming inaccessible (bookmark expired, folder moved)
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **6.7 Note List Multi-SD**
  - [ ] 🟥 "All Notes" shows notes from all SDs (with SD indicator badge?)
  - [ ] 🟥 When SD selected, show only that SD's notes
  - [ ] 🟥 When folder selected, show that folder's notes (already works)
  - [ ] 🟥 New note created in currently selected SD (or first SD if "All Notes")
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **6.8 Database Integration**
  - [ ] 🟥 Use existing `storage_dirs` table for persistence
  - [ ] 🟥 Add DatabaseManager methods: `getAllStorageDirs()`, `createStorageDir()`, `deleteStorageDir()`
  - [ ] 🟥 Ensure notes/folders properly filtered by `sd_id`
  - [ ] 🟥 Clean up orphaned data when SD removed
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **6.9 Testing & Edge Cases**
  - [ ] 🟥 Test: Create new SD (cloud), verify files created correctly
  - [ ] 🟥 Test: Create new SD (local), verify files created correctly
  - [ ] 🟥 Test: Add existing SD, verify notes load
  - [ ] 🟥 Test: Multiple SDs in folder tree, switch between them
  - [ ] 🟥 Test: Remove SD (should unregister, not delete files)
  - [ ] 🟥 Test: SD bookmark expires, handle gracefully with re-auth prompt
  - [ ] 🟥 Test: App restart restores all registered SDs
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

| Limitation                       | Reason                                    | Workaround                  |
| -------------------------------- | ----------------------------------------- | --------------------------- |
| No background sync               | iOS doesn't allow background file polling | Sync on app foreground      |
| WebView memory limits            | WKWebView has ~300-500MB limit            | Only load active note       |
| Security-scoped bookmarks expire | iOS security model                        | Re-prompt user when expired |

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

| Date       | Change                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2025-12-31 | Initial plan created                                                                                                                             |
| 2025-12-31 | Updated after critique: JavaScriptCore confirmed, debug tools moved to Phase 2, iOS 26 features added, test fixtures added, error handling added |
| 2025-12-31 | Completed Phase 1.1: Xcode project setup with GRDB, iCloud entitlements                                                                          |
| 2025-12-31 | Completed Phase 1.2: Database layer with GRDB migrations, FTS5 search, 12 unit tests                                                             |
| 2025-12-31 | Completed Phase 1.3: StorageDirectoryManager with bookmarks, lifecycle handling, 7 tests                                                         |
| 2025-12-31 | Completed Phase 1.4: Basic app shell with SampleData for folders/notes, onboarding flow                                                          |
| 2025-12-31 | **Phase 1 Complete**: Project foundation ready (22 tests passing)                                                                                |
| 2025-12-31 | Completed Phase 2.1: CRDT Integration with JavaScriptCore, polyfills, binary .crdtlog format, 9 CRDT tests                                       |
| 2025-12-31 | Completed Phase 2.3: Folder Tree Sync with extractFolders in bridge, FolderTreeView loads from CRDT                                              |
| 2025-12-31 | Completed Phase 2.4: Note List with extractNoteMetadata, loadAllNotes, NoteListView loads from CRDT, 32 tests                                    |
| 2025-12-31 | Completed Phase 2.5: Read-Only Note Viewer with HTML rendering via WKWebView, dark/light mode CSS, 35 tests                                      |
| 2025-12-31 | Completed Phase 2.2: Debug Tools with hidden access, file browser, database stats, activity logs                                                 |
| 2025-12-31 | Completed Phase 2.6: Sync Monitoring with SyncMonitor, InstanceID, foreground lifecycle, activity logging                                        |
| 2025-12-31 | Completed Phase 2.7: Error Handling with user-friendly messages, recovery suggestions, context-aware icons                                       |
| 2026-01-01 | Completed Phase 3.1: TipTap Editor Integration with ios-editor.ts, WKWebView wrapper, webkit.messageHandlers                                     |
| 2026-01-01 | Completed Phase 3.2: CRDT Updates with syncAndGetUpdate, createLogFileFromUpdate, saveNoteUpdate                                                 |
| 2026-01-01 | Completed Phase 3.3: Note Creation with generateNoteId, createNewNote in CRDTManager, startInEditMode for new notes                              |
| 2026-01-01 | Completed Phase 3.4: Rich Text Features with EditorFormattingToolbar (bold, italic, lists, headings, blockquotes, tables, undo/redo)             |
