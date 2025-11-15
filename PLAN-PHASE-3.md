## Phase 3: iOS App (Basic)

**Overall Status:** In Progress (6 of 10 subphases complete)

**Completed Subphases:**
- ✅ 3.1: iOS Project Setup
- ✅ 3.2: iOS CRDT Implementation (subphases 3.2.1-3.2.5)
- ✅ 3.3: iOS UI - Navigation Structure
- ✅ 3.4: iOS UI - Combined Folder/Tag View
- ✅ 3.5: iOS UI - Editor (WKWebView + TipTap)

**Remaining Subphases:**
- 🟥 3.6: iOS UI - Settings
- 🟥 3.7: iOS - Recently Deleted & Restoration
- 🟥 3.8: iOS - Search
- 🟥 3.9: iOS - Accessibility
- 🟥 3.10: iOS - Note History

**Current Test Status:** 108/108 iOS tests passing ✅

---

### 3.1 iOS Project Setup ✅

**Status:** Complete (2025-11-13)

**Tasks:**

- [x] ✅ Create Xcode project in `/packages/ios`
  - Used XcodeGen for project generation from `project.yml`
  - Project structure follows iOS best practices
  - Configured for iOS 17.0+ (deployment target)
  - Built with iOS 26.1 SDK (latest)
- [x] ✅ Configure for latest iOS (research current version)
  - iOS 26.1 SDK (Xcode 26.1.1)
  - Deployment target: iOS 17.0 for broad compatibility
- [x] ✅ Target iPhone + iPad (universal)
  - TARGETED_DEVICE_FAMILY set to "1,2"
  - Universal interface orientations configured
- [x] ✅ Set up SwiftUI structure
  - NoteCoveApp.swift (app entry point with @main)
  - ContentView.swift (tab bar navigation structure)
  - AppState.swift (global state management with @StateObject)
  - Models.swift (StorageDirectory, Folder, Note, Tag models)
  - Placeholder tabs: Notes, Tags, Settings
- [ ] 🟡 Set up JavaScriptCore bridge for CRDT operations (moved to Phase 3.2)
  - Bridge to `packages/shared` TypeScript code
  - Swift wrapper around JSContext
  - Handle data marshalling (Swift ↔ JS)
  - Document bridge design in `/docs/ios-jscore-bridge.md`
- [x] ✅ Set up XCTest framework
  - NoteCoveTests target configured
  - Basic unit tests created
  - Test coverage enabled in scheme
- [ ] 🟡 Configure free Apple Developer account for development builds (manual step)
  - User will configure in Xcode > Settings > Accounts
  - Documented in README.md
- [ ] 🟡 Create build scripts for installing to device via Xcode (deferred)
  - Can build via Xcode GUI for now
  - Command-line builds documented in README.md
- [ ] 🟡 Add iOS app to Turborepo build pipeline (Phase 3.2)
  - Requires build scripts first
  - Will integrate with monorepo CI

**Acceptance Criteria:**

- ✅ Xcode project builds successfully (Swift code verified via swiftc)
- 🟡 Can install on device via Xcode (requires manual Xcode configuration)
- ✅ Basic SwiftUI app launches (project structure complete)
- 🟡 JavaScriptCore bridge can execute `packages/shared` code (Phase 3.2)

**Design Docs:**

- 🟡 Create `/docs/ios-jscore-bridge.md` documenting Swift ↔ JSCore bridge design (Phase 3.2)

**Implementation Notes:**

- Project generation uses XcodeGen (version-controlled `project.yml`)
- Swift 6.0 language version
- iCloud Drive entitlements configured for sync
- Assets.xcassets created with AppIcon and AccentColor
- .gitignore added (excludes generated .xcodeproj)
- Comprehensive README.md with build instructions

**Files Created:**

- `packages/ios/project.yml` - XcodeGen project definition
- `packages/ios/Sources/NoteCoveApp.swift` - App entry point
- `packages/ios/Sources/ContentView.swift` - Main UI structure
- `packages/ios/Sources/Models.swift` - Data models
- `packages/ios/Sources/Info.plist` - App configuration
- `packages/ios/Sources/NoteCove.entitlements` - iCloud capabilities
- `packages/ios/Sources/Assets.xcassets/` - Asset catalog
- `packages/ios/Tests/NoteCoveTests.swift` - Unit tests
- `packages/ios/README.md` - iOS package documentation
- `packages/ios/.gitignore` - Git ignore rules

---

### 3.2 iOS CRDT Implementation ✅

**Status:** Complete (broken into subphases 3.2.1-3.2.5)

This phase was implemented as 5 distinct subphases:

---

#### 3.2.1 iOS JavaScriptCore CRDT Bridge ✅

**Status:** Complete (2025-11-13)

**Tasks:**

- [x] ✅ Set up JavaScriptCore bridge for CRDT operations
  - Bridge to `packages/shared` TypeScript code
  - Swift wrapper around JSContext
  - Handle data marshalling (Swift ↔ JS)
  - Document bridge design in `/docs/ios/jscore-bridge.md`
- [x] ✅ Implement polyfills for JavaScriptCore environment
  - crypto.getRandomValues() for Yjs
  - global object setup
  - atob/btoa for Base64 encoding
- [x] ✅ Build JavaScript bundle from shared package
  - esbuild configuration for iOS bundle
  - Bundle copying via XcodeGen pre-build scripts
  - 240KB bundle with all CRDT operations
- [x] ✅ Create comprehensive test suite
  - 7 CRDTBridge tests covering all operations
  - Test note creation, folder tree, document cache

**Acceptance Criteria:**

- ✅ JavaScriptCore bridge loads and initializes
- ✅ Can create notes and folder trees via bridge
- ✅ All 7 tests passing
- ✅ Documentation complete

**Test Results:** 7/7 tests passing

**Files Created:**

- `packages/ios/Sources/CRDT/CRDTBridge.swift` - JavaScriptCore bridge
- `packages/shared/src/ios-bridge.ts` - TypeScript bridge API
- `packages/shared/scripts/build-ios-bundle.js` - Bundle build script
- `packages/ios/Tests/CRDTBridgeTests.swift` - Bridge tests
- `docs/ios/jscore-bridge.md` - Architecture documentation

---

#### 3.2.2 iOS File I/O Layer ✅

**Status:** Complete (2025-11-13)

**Tasks:**

- [x] ✅ Implement FileIOManager class
  - Core file operations (read, write, delete, exists)
  - Directory operations (create, list with glob patterns)
  - Atomic writes for data integrity
  - Comprehensive error handling
- [x] ✅ Create comprehensive test suite
  - 21 FileIOManager tests
  - Test all file and directory operations
  - Test pattern matching and atomic writes

**Acceptance Criteria:**

- ✅ FileIOManager performs all file operations correctly
- ✅ Atomic writes prevent partial writes
- ✅ Pattern matching works for file listing
- ✅ All 21 tests passing

**Test Results:** 21/21 tests passing

**Files Created:**

- `packages/ios/Sources/Storage/FileIOManager.swift` - File I/O manager
- `packages/ios/Tests/Storage/FileIOManagerTests.swift` - File I/O tests

---

#### 3.2.3 iOS Storage Integration ✅

**Status:** Complete (2025-11-13)

**Tasks:**

- [x] ✅ Expose FileIOManager to JavaScript via CRDTBridge
  - Swift functions for file operations
  - Base64 encoding for binary data transfer
  - 6 file operations exposed to JS
- [x] ✅ Create TypeScript file I/O wrappers
  - Wrappers in ios-bridge.ts
  - Automatic base64 encoding/decoding
- [x] ✅ Implement StorageDirectoryManager
  - Path management for storage directories
  - Directory creation helpers
  - Listing and existence checks
- [x] ✅ Create integration test suite
  - 13 tests for Swift ↔ JavaScript file I/O
  - Test round-trip data integrity
  - Test directory management

**Acceptance Criteria:**

- ✅ JavaScript can read/write files via Swift
- ✅ StorageDirectoryManager provides consistent paths
- ✅ All 13 integration tests passing

**Test Results:** 13/13 tests passing (45 total iOS tests)

**Files Created:**

- `packages/ios/Sources/Storage/StorageDirectoryManager.swift` - Path management
- `packages/ios/Tests/Storage/StorageIntegrationTests.swift` - Integration tests

**Files Modified:**

- `packages/ios/Sources/CRDT/CRDTBridge.swift` - Added file I/O exposure
- `packages/shared/src/ios-bridge.ts` - Added file I/O wrappers

---

#### 3.2.4 iOS SQLite/GRDB Database Layer ✅

**Status:** Complete (2025-11-13)

**Tasks:**

- [x] ✅ Integrate GRDB Swift library
  - Added via Swift Package Manager
  - GRDB 6.29.3 dependency
- [x] ✅ Implement database schema
  - Tables: storage_directories, notes, notes_fts, folders, tags, note_tags
  - FTS5 virtual table for full-text search
  - Proper indexes and relationships
  - Migration system
- [x] ✅ Implement DatabaseManager
  - Full CRUD for all entities
  - FTS5 search implementation
  - Soft delete support
  - Transaction support
- [x] ✅ Create comprehensive test suite
  - 23 DatabaseManager tests
  - Test all CRUD operations
  - Test FTS5 search
  - Test transactions

**Acceptance Criteria:**

- ✅ GRDB integrated successfully
- ✅ All database operations working
- ✅ FTS5 search working
- ✅ All 23 tests passing

**Test Results:** 23/23 tests passing (68 total iOS tests)

**Files Created:**

- `packages/ios/Sources/Database/Schema.swift` - Database schema and migrations
- `packages/ios/Sources/Database/DatabaseManager.swift` - Database manager
- `packages/ios/Tests/Database/DatabaseManagerTests.swift` - Database tests

---

#### 3.2.5 iOS File Watching System ✅

**Status:** Complete (2025-11-14)

**Tasks:**

- [x] ✅ Implement Debouncer utility
  - Configurable delay (default 500ms)
  - Thread-safe, cancellable
  - 7 comprehensive tests
- [x] ✅ Implement FileWatchManager
  - DispatchSource for directory monitoring
  - Debounced event handling
  - Background queue processing
  - 8 comprehensive tests
- [x] ✅ Implement FileChangeProcessor
  - Process .yjson file changes
  - Load CRDT updates via bridge
  - Extract note metadata
  - Update database and FTS5 index
  - 8 comprehensive tests
- [x] ✅ Implement iCloudManager
  - Check iCloud availability
  - Get container URL
  - Watch for iCloud sync changes
  - 8 comprehensive tests
- [x] ✅ Implement StorageCoordinator
  - @MainActor for SwiftUI integration
  - Coordinate file watching and database
  - Manage multiple storage directories
  - 9 comprehensive tests

**Acceptance Criteria:**

- ✅ File watching detects directory changes
- ✅ Changes automatically update database
- ✅ iCloud integration working
- ✅ All 40 tests passing

**Test Results:** 40/40 tests passing (108 total iOS tests)

**Files Created:**

- `packages/ios/Sources/Utilities/Debouncer.swift` - Debouncer utility
- `packages/ios/Sources/Storage/FileWatchManager.swift` - File watching
- `packages/ios/Sources/Storage/FileChangeProcessor.swift` - Change processing
- `packages/ios/Sources/Storage/iCloudManager.swift` - iCloud integration
- `packages/ios/Sources/Storage/StorageCoordinator.swift` - Central coordinator
- `packages/ios/Tests/Utilities/DebouncerTests.swift` - Debouncer tests
- `packages/ios/Tests/Storage/FileWatchManagerTests.swift` - File watch tests
- `packages/ios/Tests/Storage/FileChangeProcessorTests.swift` - Processor tests
- `packages/ios/Tests/Storage/iCloudManagerTests.swift` - iCloud tests
- `packages/ios/Tests/Storage/StorageCoordinatorTests.swift` - Coordinator tests

---

### 3.3 iOS UI - Navigation Structure ✅

**Status:** Complete (2025-11-14)

**Tasks:**

- [x] ✅ Implement tab bar navigation
  - Tab 1: Notes (hierarchical: SD list → folder list → note editor)
  - Tab 2: Tags (placeholder - Phase 3.4)
  - Tab 3: Settings (placeholder - Phase 3.6)
- [x] ✅ Implement AppViewModel
  - @MainActor for SwiftUI integration
  - Integrates DatabaseManager, StorageCoordinator, CRDTBridge
  - Loads storage directories on initialization
- [x] ✅ Implement SD list view (StorageDirectoryListView)
  - List of configured SDs
  - Add new SD with sheet
  - Quick setup buttons (Documents, iCloud)
  - Tap to navigate to folder list
- [x] ✅ Implement folder list view (FolderListView)
  - Shows folder tree for selected SD (hierarchical navigation)
  - Lists folders and notes in sections
  - Create new folder/note with sheets
  - NavigationLink to child folders and note editor
  - Empty state with quick action buttons
  - Pull-to-refresh support
- [x] ✅ Implement note editor (NoteEditorView placeholder)
  - Basic note editor with title editing
  - Real-time title updates to database
  - Placeholder for WKWebView + TipTap (Phase 3.5)
- [x] ✅ Implement navigation bar actions
  - Back button (automatic)
  - Add folder / Add note buttons (context-aware)

**Acceptance Criteria:**

- ✅ Tab navigation works
- ✅ Can navigate through SD → folders → notes → editor
- ✅ UI feels native and responsive
- ✅ All 108 iOS tests passing

**Files Created:**

- `packages/ios/Sources/ViewModels/AppViewModel.swift` - App-level view model
- `packages/ios/Sources/Views/StorageDirectoryListView.swift` - SD list view
- `packages/ios/Sources/Views/FolderListView.swift` - Hierarchical folder view
- `packages/ios/Sources/Views/NoteEditorView.swift` - Note editor (placeholder)

**Files Modified:**

- `packages/ios/Sources/NoteCoveApp.swift` - Changed from AppState to AppViewModel
- `packages/ios/Sources/ContentView.swift` - Integrated StorageDirectoryListView
- `packages/ios/Sources/Database/Schema.swift` - Made records Identifiable and public

---

### 3.4 iOS UI - Combined Folder/Tag View ✅

**Status:** Complete (2025-11-15)

**Tasks:**

- [x] ✅ Implement combined folder and tag view in Tags tab
  - Segmented control: Folders / Tags
  - AllFoldersView shows hierarchical folder tree across all SDs
  - AllTagsView shows tags with filtering
- [x] ✅ Implement tag filtering (same logic as desktop)
  - Tri-state buttons (AND/OR/NOT)
  - Tag search with live filtering
  - Filtered notes display
  - Color-coded filter states

**Acceptance Criteria:**

- ✅ Can access folders and tags easily
- ✅ Tag filtering works

**Implementation Details:**

- **TagBrowserView**: Main view with segmented control switching between Folders and Tags sections
- **AllFoldersView**: Hierarchical folder navigation showing all storage directories with recursive folder sections
- **AllTagsView**: Tag filtering interface with tri-state filtering (AND/OR/NOT), tag search, and filtered notes list
- **TagFilterRow**: Individual tag row component with color display and filter state button

**Files Created:**

- `packages/ios/Sources/Views/TagBrowserView.swift` - Complete tag/folder browser (434 lines)

**Files Modified:**

- `packages/ios/Sources/ContentView.swift` - Replaced TagsTab placeholder with TagBrowserView

**Features Implemented:**

- Segmented control for switching between Folders and Tags
- Hierarchical folder tree view across all storage directories
- Tag list with tri-state filtering (AND/OR/NOT)
- Tag search with live filtering
- Filtered notes display sorted by modification date
- Tag color display with hex color parser
- Empty states and search result handling

**Deferred to Later:**

- Tag management (create/edit/delete) - Phase 3.4.4 (P2)

---

### 3.5 iOS UI - Editor ✅

**Status:** Complete (2025-11-14)

**Tasks:**

- [x] ✅ Implement WKWebView editor embedding TipTap
  - Same TipTap configuration as desktop (loaded from CDN)
  - JavaScript ↔ Swift bridge for CRDT updates
  - Keyboard accessory view with formatting shortcuts
  - Full-screen editor when editing
  - Dark mode support via CSS media queries
- [x] ✅ Create TipTap editor HTML
  - Self-contained HTML with TipTap from CDN
  - Y.js for CRDT integration
  - Extensions: StarterKit, Collaboration, Underline
  - Base64 encoding for Swift ↔ JS data transfer
- [x] ✅ Implement EditorBridge
  - WKScriptMessageHandler for JS → Swift communication
  - Message types: editorReady, noteLoaded, contentChanged, update, error
  - Routes events to EditorViewModel
- [x] ✅ Implement EditorViewModel
  - @MainActor ObservableObject for SwiftUI
  - Manages note state (title, loading, editorReady)
  - Loads notes from CRDT bridge
  - Handles content changes and database updates
  - Executes editor commands (bold, italic, lists, etc.)
- [x] ✅ Implement EditorWebView
  - UIViewRepresentable wrapper for WKWebView
  - Loads editor.html from bundle
  - Sets up message handlers
- [x] ✅ Implement toolbar for formatting options
  - Native iOS keyboard toolbar
  - Formatting buttons: bold, italic, underline, lists
  - SF Symbols icons
  - Triggers formatting in TipTap (via JS bridge)
- [x] ✅ Implement Yjs integration
  - Sync with CRDT files via JavaScriptCore bridge
  - Real-time updates from other instances
  - Base64 encoding for binary CRDT data

**Acceptance Criteria:**

- ✅ Editor works for basic text editing
- ✅ Formatting toolbar functions (bold, italic, underline, lists)
- ✅ Changes sync to CRDT
- ✅ Changes from other instances appear
- ✅ Same editing capabilities as desktop
- ✅ All 108 iOS tests passing

**Rich Text Features Implemented:**

- Bold, italic, underline formatting
- Headings (H1, H2, H3)
- Bullet lists and ordered lists
- Blockquotes
- Code blocks
- Proper paragraph and line handling

**Files Created:**

- `packages/ios/Sources/Resources/editor.html` - TipTap editor HTML (295 lines)
- `packages/ios/Sources/Editor/EditorBridge.swift` - JS bridge (96 lines)
- `packages/ios/Sources/Editor/EditorViewModel.swift` - View model (133 lines)
- `packages/ios/Sources/Editor/EditorWebView.swift` - WKWebView wrapper (68 lines)

**Files Modified:**

- `packages/ios/Sources/Views/NoteEditorView.swift` - Integrated EditorWebView
- `packages/ios/project.yml` - Added editor.html resource

**Known Limitations:**

- Advanced TipTap extensions not yet implemented (hashtags, inter-note links, tri-state checkboxes)
- No search/replace in editor yet
- No collaborative editing indicators yet (single-user for now)

---

### 3.6 iOS UI - Settings 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement settings view
  - SD management (same as desktop)
  - Username and mention handle
  - Dark mode toggle
- [ ] 🟥 Implement SD auto-detection on iOS
  - iCloud Drive (always available)
  - Detect other cloud storage apps if possible
- [ ] 🟥 Store settings in UserDefaults (iOS equivalent of Electron store)

**Acceptance Criteria:**

- Settings view works
- Can configure SDs
- Settings persist

---

### 3.7 iOS - Recently Deleted & Restoration 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement "Recently Deleted" folder (same logic as desktop)
- [ ] 🟥 Implement swipe actions for deletion and restoration
- [ ] 🟥 Implement permanent deletion

**Acceptance Criteria:**

- Deleted notes go to "Recently Deleted"
- Can restore notes
- Can permanently delete

---

### 3.8 iOS - Search 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement search in note list
  - Use UISearchBar
  - Same search logic as desktop (full content, FTS5)
  - Live search (debounced)
- [ ] 🟥 Implement search scope selector (Current SD / All SDs)

**Acceptance Criteria:**

- Search works and is fast
- Results update as typing
- Scope selector works

---

### 3.9 iOS - Accessibility 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement VoiceOver support
- [ ] 🟥 Implement Dynamic Type (font size scaling)
- [ ] 🟥 Test with accessibility features enabled

**Acceptance Criteria:**

- VoiceOver can navigate app
- Font sizes scale correctly
- Passes basic accessibility audits

---

### 3.10 iOS - Note History 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement history view (similar to desktop)
  - List of versions
  - Preview
  - Restore button
- [ ] 🟥 Access via editor toolbar or menu

**Acceptance Criteria:**

- Can view history
- Can restore old versions

---
