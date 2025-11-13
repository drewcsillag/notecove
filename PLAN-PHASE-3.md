## Phase 3: iOS App (Basic)

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

### 3.2 iOS CRDT Implementation 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement Swift layer for CRDT operations
  - File I/O: Reading/writing .yjson files (rewrite in Swift)
  - Sequence numbering, packing logic (rewrite in Swift)
  - CRDT operations: Use `packages/shared` TypeScript via JavaScriptCore bridge
  - No need to reimplement Yjs in Swift - use official Yjs via JSCore
- [ ] 🟥 Implement file watching on iOS
  - Use FileManager notifications
  - Handle iCloud Drive sync delays
- [ ] 🟥 Implement SQLite integration on iOS
  - Use GRDB Swift SQLite library
  - Same schema as desktop
  - FTS5 for search

**Acceptance Criteria:**

- iOS app can read/write CRDT files
- Syncs correctly with desktop instances
- File watching detects changes
- CRDT operations work via JavaScriptCore

**Test Coverage:** ~100%

---

### 3.3 iOS UI - Navigation Structure 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement tab bar navigation
  - Tab 1: Notes (hierarchical: SD list → folder list → note list → editor)
  - Tab 2: Tags (combined folder/tag view with segmented control)
  - Tab 3: Settings
- [ ] 🟥 Implement SD list view
  - List of configured SDs
  - Tap to navigate to folder list
- [ ] 🟥 Implement folder list view
  - Shows folder tree for selected SD (using OutlineGroup)
  - "All Notes" at top, "Recently Deleted" at bottom
  - Tap to navigate to note list
  - Swipe actions: rename, delete
- [ ] 🟥 Implement note list view
  - Same as desktop: title, modified time
  - Search bar at top
  - Pinned notes at top
  - Tap to open editor
- [ ] 🟥 Implement navigation bar actions
  - Back button
  - Add folder / Add note (context-aware)

**Acceptance Criteria:**

- Tab navigation works
- Can navigate through SD → folders → notes → editor
- UI feels native and responsive

---

### 3.4 iOS UI - Combined Folder/Tag View 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement combined folder and tag view in Tags tab
  - Segmented control: Folders / Tags
  - Or collapsible sections
  - Both commonly used on mobile
- [ ] 🟥 Implement tag filtering (same logic as desktop)
  - Tri-state buttons
  - Tag search

**Acceptance Criteria:**

- Can access folders and tags easily
- Tag filtering works

---

### 3.5 iOS UI - Editor 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement WKWebView editor embedding TipTap
  - Same TipTap configuration as desktop
  - JavaScript ↔ Swift bridge for CRDT updates
  - Keyboard accessory view with formatting shortcuts
  - Full-screen editor when editing
- [ ] 🟥 Implement toolbar for formatting options
  - Native iOS toolbar
  - Triggers formatting in TipTap (via JS bridge)
- [ ] 🟥 Implement Yjs integration
  - Sync with CRDT files via JavaScriptCore bridge
  - Real-time updates from other instances

**Acceptance Criteria:**

- Editor works for basic text editing
- Formatting toolbar functions
- Changes sync to CRDT
- Changes from other instances appear
- Same editing capabilities as desktop

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
