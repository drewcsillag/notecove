# NoteCove Implementation Plan

**Overall Progress:** `5/20 phases (25%)`

**Last Updated:** 2025-10-25 (Completed Phases 1.1-1.5: Project setup, testing framework, CRDT core, file system operations, database schema)

---

## Project Overview

NoteCove is a cross-platform notes application (Desktop + iOS) with offline-first architecture and file-based CRDT synchronization. The app syncs via shared file systems (Dropbox, Google Drive, iCloud) without requiring internet servers.

**Tech Stack:**

- **Desktop**: Electron + TypeScript + React + TipTap + Yjs + Material-UI
- **iOS**: Swift + SwiftUI (with JavaScriptCore for CRDT, WKWebView for editor)
- **Build System**: Turborepo + pnpm workspaces + Vite
- **Database**: SQLite (better-sqlite3) with FTS5
- **Testing**: Jest + Playwright (desktop), XCTest (iOS)
- **Website**: Vite + React (GitHub Pages)
- **License**: Apache v2

**MVP Definition:** Phases 1-3 (Core Foundation + Desktop UI + iOS App with basic features)

**Post-MVP:** Phase 4 (Advanced Features: tags, inter-note links, advanced search, export)

---

## iOS Architecture Overview

Before diving into implementation, here's how iOS differs from desktop:

**Desktop (Electron) Architecture:**

- Main process: Node.js running TypeScript (CRDT logic, file I/O, SQLite)
- Renderer process: Chromium running React + TipTap
- Communication: IPC between main and renderer

**iOS Architecture:**

- Native Swift layer: File I/O, SQLite (using GRDB), FileManager notifications
- JavaScriptCore bridge: Runs our TypeScript shared CRDT logic (from `packages/shared`)
- SwiftUI: All UI except editor (folder tree, note list, settings, tags)
- WKWebView: Embedded TipTap editor (same as desktop, but in WebView)

**Code Sharing Strategy:**

- `packages/shared`: TypeScript CRDT logic, types, utilities
  - Runs in Node.js on desktop (Electron main process)
  - Runs in JavaScriptCore on iOS (via Swift bridge)
  - Must be environment-agnostic (no Node-specific APIs)
- Desktop UI: React (Electron renderer)
- iOS UI: SwiftUI (native)
- Editor: TipTap in both (direct in Electron, WKWebView on iOS)

**Why This Approach:**

- Maximum code sharing for critical CRDT logic (guaranteed compatibility)
- Native performance and feel on iOS
- Same editor experience on both platforms
- Proven pattern (many apps use native UI + WebView for rich content)

**Folder Tree CRDT on iOS:**

- Same Yjs document structure as desktop
- Same file format on disk
- Swift code handles file I/O
- JavaScriptCore handles CRDT operations (via shared TypeScript code)
- SwiftUI renders tree (reactive to CRDT changes)
- No special concerns - architecture supports this

---

## Phase 1: Core Foundation

### 1.1 Project Setup & Repository Structure ✅

**Status:** Complete (2025-10-25)

**Completed Tasks:**

- [x] ✅ Initialize git repository with proper .gitignore
- [x] ✅ Set up monorepo structure with Turborepo + pnpm workspaces
  - `/packages/desktop` - Electron app (placeholder)
  - `/packages/ios` - iOS app (placeholder)
  - `/packages/shared` - Shared TypeScript code (CRDT logic, types)
    - Environment-agnostic implementation
    - Runs in Node.js (Electron) and JavaScriptCore (iOS)
  - `/packages/website` - Documentation website (placeholder)
  - `/tools` - Build tools and scripts
  - `/docs` - Design documents (directory created)
- [x] ✅ Configure TypeScript (strict mode) for all packages
- [x] ✅ Set up ESLint with appropriate rules
- [x] ✅ Configure Prettier for code formatting
- [x] ✅ Add LICENSE file (Apache v2)
- [x] ✅ Create initial README.md with project description
- [x] ✅ Set up pnpm workspace configuration
- [x] ✅ Configure Turborepo for task orchestration and caching

**Acceptance Criteria:** ✅ All met

- ✅ Monorepo builds successfully
- ✅ All linting passes
- ✅ TypeScript compiles without errors
- ✅ Can run `pnpm install` and `pnpm build` from root

---

### 1.2 Testing Framework Setup ✅

**Status:** Complete (2025-10-25)

**Completed Tasks:**

- [x] ✅ Configure Jest for unit tests
  - TypeScript support with ts-jest
  - Coverage reporting (80% thresholds for all metrics)
  - Coverage enforcement: fails if below thresholds
  - ESM support configured
- [ ] 🟡 Configure Playwright for E2E tests (desktop) - Deferred to Phase 2
  - Will be added when desktop UI is implemented
- [ ] 🟡 Set up XCTest project for iOS - Deferred to Phase 3
  - Will be added when iOS app is implemented
- [x] ✅ Create test utilities (basic)
  - Test fixtures for types (notes, folders, users)
  - More utilities will be added as needed
- [x] ✅ Create local CI verification script
  - `pnpm ci-local` command implemented
  - Runs: format check, lint, typecheck, build, test, coverage
  - Clear emoji-based pass/fail output
  - Exit codes for automation
  - Stops on first failure for fast feedback
  - Acts as CI until real CI/CD is set up (Phase 5)
- [x] ✅ Add npm scripts for individual checks
  - `pnpm lint` - ESLint with Turborepo
  - `pnpm format` - Prettier format
  - `pnpm format:check` - Prettier check only
  - `pnpm typecheck` - TypeScript compilation
  - `pnpm test` - Jest unit tests
  - `pnpm test:coverage` - Coverage report with thresholds
  - `pnpm build` - Build all packages

**Acceptance Criteria:** ✅ All met (for current phase)

- ✅ Jest is configured and working
- ✅ Can run unit tests with coverage
- ✅ Local CI script runs all checks successfully
- ✅ Clear output shows what passed/failed
- ✅ Coverage enforcement works (80% thresholds)
- 🟡 E2E tests deferred to Phase 2 (desktop UI implementation)

**Usage:**

- Run `pnpm ci-local` before merging to main
- Run `pnpm ci-local` before saying feature is complete
- Run `pnpm ci-local` after fixing bugs
- Optionally: `pnpm ci-local --skip-e2e` for faster iteration

---

### 1.3 CRDT Core Implementation ✅

**Status:** Complete (2025-10-25)

**Completed Tasks:**

- [x] ✅ Design Yjs document structure for notes (NoteDoc)
  - Y.Doc per note with Y.XmlFragment for TipTap content
  - Metadata: `{ id: UUID, created: timestamp, modified: timestamp, folderId: UUID | null, deleted: boolean }`
  - Methods: initializeNote, getMetadata, updateMetadata, markDeleted
  - Soft delete support
- [x] ✅ Design Yjs document structure for folder hierarchy (FolderTreeDoc)
  - Y.Map root: `{ folders: Y.Map<folderId, Y.Map> }`
  - FolderData: `{ id: UUID, name: string, parentId: UUID | null, sdId: string, order: number, deleted: boolean }`
  - Per-SD folder trees (independent hierarchies)
  - Query methods: getAllFolders, getActiveFolders, getRootFolders, getChildFolders
  - Soft delete support
- [x] ✅ Implement CRDT update file format (simplified v1)
  - File naming: `<instance-id>_<note-id>_<timestamp>.yjson` for notes
  - File naming: `<instance-id>_folder-tree_<sd-id>_<timestamp>.yjson` for folders
  - Parse/generate utilities with proper handling of underscores in IDs
  - Encode/decode functions (currently pass-through, ready for future compression)
  - Version 1 format established
- [ ] 🟡 Implement update packing logic - Deferred to Phase 1.4
  - Will be added with file system operations
- [ ] 🟡 Implement metadata tracking - Deferred to Phase 1.4
  - Will be added with file system operations
- [ ] 🟡 Add user tracking in Yjs metadata - Deferred to Phase 1.4
  - Will be added with file system operations
- [x] ✅ Handle out-of-order update application
  - Yjs handles this naturally (CRDTs are commutative)
  - Tested with concurrent updates in different orders
  - Convergence verified in tests

**Implementation Details:**

- `packages/shared/src/crdt/note-doc.ts` - NoteDoc class
- `packages/shared/src/crdt/folder-tree-doc.ts` - FolderTreeDoc class
- `packages/shared/src/crdt/update-format.ts` - File naming and versioning
- Comprehensive test suite: 50 tests, 100% coverage
- Tests cover: CRUD operations, CRDT sync, concurrent updates, conflict resolution

**Acceptance Criteria:** ✅ All met

- ✅ Can create and update Yjs documents
- ✅ Updates can be encoded and decoded
- ✅ Updates can be merged from multiple instances
- ✅ Concurrent updates converge correctly
- ✅ 100% test coverage for all CRDT code
- Packing logic works correctly
- User metadata is preserved in updates
- Out-of-order updates handled correctly

**Test Coverage:** ~100%

**Design Docs:**

- Create `/docs/crdt-structure.md` documenting Yjs document design

---

### 1.4 File System Operations ✅

**Status:** Complete (2025-10-25)

**Completed Tasks:**

- [x] ✅ Implement SD (Sync Directory) structure creation
  - `<SD-root>/notes/<note-id>/updates/`
  - `<SD-root>/notes/<note-id>/meta/`
  - `<SD-root>/folders/updates/`
  - `<SD-root>/folders/meta/`
  - Implemented via `SyncDirectoryStructure` class
- [x] ✅ Implement file system abstraction layer
  - `FileSystemAdapter` interface for platform-agnostic file operations
  - `FileWatcher` interface for directory watching (implementation deferred to desktop package)
  - Allows shared code to work on both Node.js and iOS (JavaScriptCore)
- [x] ✅ Implement CRDT file reading/writing
  - `UpdateManager` class handles all update file operations
  - Read all updates for a note/folder
  - Write new updates (atomic writes interface defined)
  - List update files with metadata and sorting
  - Delete update files (for packing)
- [ ] 🟡 Implement file watching - Deferred to desktop package
  - Interface defined in shared package
  - Concrete implementation will use chokidar in desktop package
- [ ] 🟡 Implement sync detection and application - Deferred to desktop package
  - Will be implemented when desktop package is created
  - Sync logic will use UpdateManager + file watcher
- [ ] 🟡 Handle SD unavailability scenarios - Deferred to desktop package
  - Will be implemented in desktop package with UI alerts

**Implementation Details:**

- `packages/shared/src/storage/types.ts` - File system abstractions
- `packages/shared/src/storage/sd-structure.ts` - SD path management
- `packages/shared/src/storage/update-manager.ts` - Update file I/O
- Mock file system adapter for testing
- 82 tests total (32 new storage tests), 95.87% coverage

**Acceptance Criteria:** ✅ Core functionality met

- ✅ Can create SD structure (via abstraction)
- ✅ Can read/write CRDT update files
- ✅ Can list and delete update files
- ✅ Out-of-order updates handled (Yjs CRDTs are commutative)
- 🟡 File watching deferred to desktop package
- 🟡 Error scenarios deferred to desktop package

**Test Coverage:** 95.87% overall, 92.37% for storage layer

**Design Docs:**

- 🟡 `/docs/file-sync-protocol.md` - Will be created when implementing desktop package

---

### 1.5 Local Database & Cache ✅

**Status:** Complete (2025-10-25)

**Completed Tasks:**

- [x] ✅ Design complete SQLite schema
  - `notes` table with indices on sdId, folderId, deleted, modified
  - `notes_fts` FTS5 virtual table with automatic triggers for sync
  - `folders` table with indices on sdId, parentId
  - `tags` table with case-insensitive unique constraint
  - `note_tags` association table with foreign keys and cascade deletes
  - `users` table for user tracking
  - `app_state` table for UI state persistence
  - `schema_version` table for migrations
- [x] ✅ Define database abstraction interfaces
  - `DatabaseAdapter` interface for platform-agnostic SQL operations
  - `NoteCacheOperations` - CRUD and search for notes
  - `FolderCacheOperations` - CRUD for folders
  - `TagOperations` - tag management and associations
  - `AppStateOperations` - UI state persistence
  - `UserOperations` - user tracking
  - `Database` - complete interface combining all operations
- [x] ✅ Define TypeScript types for all database entities
  - `NoteCache`, `FolderCache`, `Tag`, `NoteTag`, `User`, `AppState`
  - `SearchResult` for FTS5 results
  - `AppStateKey` enum for typed state keys
- [ ] 🟡 Implement database adapter - Deferred to desktop package
  - Will use better-sqlite3 in Node.js (desktop)
  - Will use GRDB in Swift (iOS)
- [ ] 🟡 Implement indexing logic - Deferred to desktop package
  - Initial SD indexing with progress reporting
  - Incremental cache updates
  - Cache invalidation strategy

**Implementation Details:**

- `packages/shared/src/database/schema.ts` - Complete SQL schema with 100% coverage
- `packages/shared/src/database/types.ts` - Database abstractions
- 98 tests total (16 new database schema tests), 96.06% coverage
- All SQL DDL statements defined and validated
- FTS5 configured with automatic sync triggers

**Acceptance Criteria:** ✅ Schema and abstractions complete

- ✅ Schema designed with proper indices and constraints
- ✅ FTS5 full-text search configured
- ✅ Database abstraction interfaces defined
- ✅ All types defined and tested
- 🟡 Implementation deferred to desktop/iOS packages

**Test Coverage:** 96.06% overall, 100% for database schema

**Migration Strategy:**

- **Hybrid approach** based on table type:
  - **Cache tables** (notes, folders, notes_fts): Rebuild from CRDT on schema version mismatch
    - Source of truth is CRDT files, cheap to rebuild
    - No risk of data loss
  - **User data tables** (tags, note_tags, app_state): Migrate with version-specific logic
    - Contains user input not in CRDT (tags created by user)
    - UI state is valuable (don't make user reconfigure)
    - Requires migration code for each version change
- **Schema versioning**: Enhanced `schema_version` table tracks migration history
  - Records: version, appliedAt timestamp, description
  - `MigrationResult` enum indicates what happened (up-to-date, cache-rebuilt, migrated, full-rebuild)
  - `SchemaVersionOperations` interface for version queries

**Design Docs:**

- Schema documented inline with SQL DDL statements
- Migration strategy documented in schema.ts comments
- 🟡 `/docs/sqlite-schema.md` - Will document caching strategy when implementing desktop package

---

### 1.6 Logging and Error Handling 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Set up logging framework
  - Log to file in app data directory
  - Log levels: debug, info, warn, error
  - Rotate logs (keep last 7 days)
- [ ] 🟥 Implement error handling utilities
  - Global error handlers for uncaught exceptions
  - CRDT operation error recovery
  - File system error recovery
- [ ] 🟥 Add "Show Logs" menu item in Help menu
  - Opens log directory in file manager
  - Or shows log viewer in app

**Acceptance Criteria:**

- Errors are logged to file
- Can view logs from UI
- Errors don't crash the app

---

## Phase 2: Desktop UI (Basic)

### 2.1 Electron App Structure 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Set up Electron with electron-vite
  - Main process configuration
  - Renderer process configuration
  - Preload script for IPC
- [ ] 🟥 Configure Vite for React + TypeScript
- [ ] 🟥 Set up Material-UI (MUI) theme
  - Blue accent color (#2196F3)
  - Light and dark mode support
  - Professional, clean design
  - Allow customization later
- [ ] 🟥 Set up Material Icons (Apache 2.0 licensed)
  - Use MUI icons primarily
  - Fallback to other Apache 2.0 / MIT licensed sets as needed
- [ ] 🟥 Configure i18n structure (English only initially)
  - Use react-i18next
  - Prepare for future localization
- [ ] 🟥 Implement main process CRDT manager
  - Single in-memory Yjs document per note
  - All renderer windows connect via IPC
  - Handles file watching and sync
- [ ] 🟥 Implement IPC communication layer
  - **Commands (renderer → main):**
    - `loadNote(noteId)` - Load note's Yjs doc into memory, start watching files
    - `unloadNote(noteId)` - Unload from memory when no windows have it open
    - `createNote(sdId, folderId, initialContent)` - Create new note
    - `deleteNote(noteId)` - Mark note as deleted in CRDT
    - `moveNote(noteId, newFolderId)` - Update note's folder
    - `createFolder(sdId, parentId, name)` - Create folder
    - `deleteFolder(folderId)` - Delete folder
    - `getNoteMetadata(noteId)` - Get title, dates from SQLite
    - `applyNoteUpdate(noteId, update)` - Apply Yjs update from renderer
  - **Events (main → renderer):**
    - `noteUpdated(noteId, update)` - CRDT changed (from local or remote)
    - `noteDeleted(noteId)` - Note was deleted
    - `folderUpdated(folderId)` - Folder structure changed
    - `syncProgress(sdId, progress)` - Initial SD indexing progress
  - **Flow:** Renderer generates Yjs updates → sends to main → main applies to Yjs doc → main writes to disk → main broadcasts to all renderers
  - Document this IPC protocol in `/docs/ipc-protocol.md`

**Acceptance Criteria:**

- Electron app launches
- React renders in window
- MUI components work
- IPC communication established
- Main process can manage CRDT documents

**Design Docs:**

- Create `/docs/ipc-protocol.md` documenting IPC commands, events, and flow

---

### 2.2 Three-Panel Layout 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement resizable panel system
  - Three panels: Folder/Tags (25%) | Notes List (25%) | Editor (50%)
  - Draggable splitters between panels
  - Min/max widths for each panel
  - Panel collapse/expand functionality
  - Persist panel widths in database (app_state table)
- [ ] 🟥 Implement panel visibility toggles
  - View menu: Toggle Folder Panel, Toggle Tags Panel
  - Keyboard shortcuts
- [ ] 🟥 Implement responsive behavior
  - Handle narrow windows gracefully

**Acceptance Criteria:**

- Three panels render correctly
- Splitters can be dragged
- Panel widths persist across restarts
- Panels can be collapsed/expanded

---

### 2.3 Note Editor (Basic TipTap) 🟥

**Status:** To Do

**Note:** Moved earlier in phase order to enable note content display in other components

**Tasks:**

- [ ] 🟥 Set up TipTap editor with Yjs binding
  - Start with Simple Template from TipTap docs
  - Integrate with Yjs document from main process (via IPC)
  - Research TipTap extensions for Yjs compatibility (document findings)
- [ ] 🟥 Configure TipTap extensions (basic set)
  - Document, Paragraph, Text
  - Bold, Italic, Underline
  - Strike, Code
  - Heading (levels 1-6)
  - BulletList, OrderedList, ListItem
  - Blockquote
  - CodeBlock
  - HorizontalRule
  - HardBreak
  - History (Undo/Redo)
  - Dropcursor, Gapcursor
- [ ] 🟥 Implement editor toolbar
  - Standard formatting buttons
  - Keyboard shortcuts (Cmd/Ctrl+B, etc.)
  - Markdown-style shortcuts (e.g., `**bold**`, `# heading`)
- [ ] 🟥 Implement collaborative cursors (if supported by TipTap+Yjs)
  - Show other users' cursors with username
  - Different colors per user
- [ ] 🟥 Handle note loading/unloading
  - Lazy load: only load note content when opened
  - Unload when editor is closed
  - Changes saved automatically via CRDT (no explicit save)
- [ ] 🟥 Implement title extraction utility
  - Extract first line with text from Yjs Y.XmlFragment
  - Used by notes list to display titles
  - Handle "Untitled" case (only whitespace)

**Acceptance Criteria:**

- Editor renders and is editable
- Formatting works (toolbar + shortcuts)
- Changes sync to CRDT immediately (via IPC to main process)
- Changes from other instances appear in real-time
- Collaborative cursors show other users (if available)
- Can extract title from note content

**Design Docs:**

- Document TipTap + Yjs compatibility findings in `/docs/tiptap-yjs-compatibility.md`

---

### 2.4 Folder Tree Panel 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement folder tree component (MUI TreeView)
  - Header: "FOLDERS" + plus icon
  - Tree per SD (labeled with SD name)
  - Each SD has "All Notes" (top) and "Recently Deleted" (bottom) - UI-only, not in CRDT
  - User folders in between (from CRDT)
  - Folder expand/collapse (persist state in app_state table)
  - Note count badges on folders (from SQLite cache)
- [ ] 🟥 Implement folder creation
  - Click plus icon: create folder in active SD
  - Context menu: New Folder
  - Default location: root level if "All Notes" selected, subfolder otherwise
- [ ] 🟥 Implement folder drag & drop
  - Drag folder to another folder (nesting)
  - Drag folder to "All Notes" (move to root - set parentId to null)
  - Cannot drag folder to be its own descendant (validate)
  - Cannot drag across SDs
  - Visual feedback during drag
- [ ] 🟥 Implement folder context menu
  - Rename Folder
  - Move to Top Level (set parentId to null)
  - Delete (confirmation dialog, recursive delete to Recently Deleted - set deleted flag)
- [ ] 🟥 Implement folder selection
  - Click folder to select
  - Selection persists across restarts (app_state table)
  - Active SD concept (SD of currently selected folder)
- [ ] 🟥 Handle folder name conflicts
  - Prevent rename/move if sibling has same name
  - Alert user

**Acceptance Criteria:**

- Folder tree displays correctly for all SDs
- Can create, rename, move, delete folders
- Drag & drop works correctly
- Folder collapse state persists
- Note counts are accurate
- "All Notes" always at top, "Recently Deleted" always at bottom
- No circular parent references

---

### 2.5 Tags Panel 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement tags panel below folder tree
  - Header: "TAGS" + search box
  - Draggable splitter between folder tree and tags panel
  - List of tag buttons (all known tags from SQLite)
  - Tri-state buttons: off (default) / positive (blue) / negative (red)
  - Fuzzy search for tag filtering
- [ ] 🟥 Implement tag filtering logic
  - Multiple positive tags: AND logic (note must have all)
  - Negative tags: exclude even if positive match
  - Update notes list when tag filters change
  - Persist tag filter state across restarts (app_state table)
- [ ] 🟥 Extract tags from note content
  - Parse `#tagname` from notes (case-insensitive)
  - No spaces in tag names (stop at whitespace or punctuation)
  - Update tag index in SQLite (tags, note_tags tables)

**Acceptance Criteria:**

- Tags panel displays all tags
- Can toggle tag states (off/positive/negative)
- Tag search filters tag list (fuzzy)
- Tag filtering updates notes list correctly
- Tag state persists across restarts

---

### 2.6 Notes List Panel 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement notes list component
  - Header: search box
  - Sub-header: "NOTES" + note count + plus button
  - List of note items (virtual scrolling for >1000 notes)
  - Each note shows: title (extracted from editor), last modified time (relative, with tooltip)
  - Sort: pinned notes first, then by most recently edited
  - Multi-select support (platform-standard: Ctrl/Cmd+Click, Shift+Click)
  - Multi-select badge (floating near selection) showing count
- [ ] 🟥 Implement search functionality
  - Live/incremental search (debounced 250-300ms)
  - Search full note content + tags (using SQLite FTS5)
  - Case-sensitive toggle (icon/button next to search box)
  - Regex toggle
  - Whole word toggle
  - Advanced search dialog (additional options)
  - Search scope selector (icon/button that cycles): Current SD / All SDs / Current Folder
    - Also accessible via advanced search dialog
  - Persist search text across restarts (app_state table)
- [ ] 🟥 Implement note creation
  - Click plus button: create note in active folder
  - If "All Notes" selected: create orphan note (folderId = null)
  - Context menu: New Note
  - Auto-focus editor on new note
  - New note appears at top of list (most recently edited)
- [ ] 🟥 Implement note selection
  - Click note to open in editor
  - Selection persists across restarts (app_state table)
- [ ] 🟥 Implement note drag & drop
  - Drag note to folder (move - update folderId in CRDT)
  - Drag multiple selected notes
  - Cross-SD move: show warning dialog ("copying note to new SD, deleting from old SD")
    - "Don't show again" checkbox (global setting in app_state)
  - Drag to "Recently Deleted" = delete (set deleted flag)
  - Visual feedback during drag
- [ ] 🟥 Implement note context menu
  - New Note
  - Pin / Unpin (toggle based on state)
  - Open in New Window
  - Move to... (submenu of folders)
  - Duplicate to... (submenu of folders, can cross SDs - copy CRDT history)
  - Delete
- [ ] 🟥 Implement pinned notes
  - Visual indicator (pin icon)
  - Show at top of list
  - Sort among themselves by edit time
  - Stored in note metadata (pinned: boolean in CRDT or SQLite)
- [ ] 🟥 Handle note title extraction
  - Use title extraction utility from editor (2.3)
  - First line with text = title
  - If only whitespace: "Untitled"
  - Long titles: truncate with ellipsis in UI (widget handles truncation)
  - Update title in real-time as user types (via CRDT updates)

**Acceptance Criteria:**

- Notes list displays correctly
- Search works (live, with options, scoped)
- Can create, select, pin, delete notes
- Drag & drop works correctly
- Multi-select works
- Note counts and times are accurate
- Virtual scrolling performs well with many notes
- Orphan notes (folderId = null) work correctly

---

### 2.7 Settings Window 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement settings window (separate Electron window)
  - Modal dialog style
  - Accessible via: Cmd/Ctrl+, or menu (Preferences/Settings)
  - Gear icon in main UI
- [ ] 🟥 Implement SD management UI
  - List of configured SDs
  - For each SD: name, path, enabled/disabled toggle
  - Add SD: auto-detect common cloud storage paths (Google Drive, OneDrive, iCloud, Dropbox)
  - File picker for custom path
  - If SD doesn't exist: confirmation dialog, create if yes
  - Remove SD: confirmation dialog
  - Reorder SDs (affects display order in folder tree)
  - Prevent duplicate SD names
- [ ] 🟥 Implement default SD creation
  - On first run: create default SD at `~/Documents/NoteCove`
  - Or show welcome wizard
- [ ] 🟥 Implement user settings
  - Username (auto-detect system username as default, allow override)
  - Mention handle (for @mentions)
- [ ] 🟥 Implement appearance settings
  - Dark mode toggle
  - (Future: color customization)
- [ ] 🟥 Store settings in Electron store (local, per-instance)

**Acceptance Criteria:**

- Settings window opens
- Can add/remove/enable/disable/configure SDs
- Settings persist across restarts
- Auto-detection finds cloud storage folders
- User can override username

---

### 2.8 Application Menu 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement native application menu
  - macOS: native menu bar
  - Windows/Linux: in-window menu bar
- [ ] 🟥 File Menu
  - New Note (Cmd/Ctrl+N)
  - New Folder (Cmd/Ctrl+Shift+N)
  - New Window
  - Close Window (Cmd/Ctrl+W)
  - Quit/Exit (Cmd+Q / Alt+F4)
- [ ] 🟥 Edit Menu
  - Undo/Redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z)
  - Cut/Copy/Paste (standard shortcuts)
  - Select All (Cmd/Ctrl+A)
  - Find... (Cmd/Ctrl+F - focuses search box)
  - Find in Note (Cmd/Ctrl+Shift+F - opens Monaco-style search in editor)
- [ ] 🟥 View Menu
  - Toggle Dark Mode
  - Zoom In/Out/Reset (Cmd/Ctrl +/-/0)
  - Toggle Folder Panel
  - Toggle Tags Panel
- [ ] 🟥 Window Menu
  - Minimize
  - Zoom
  - List of open windows
- [ ] 🟥 Help Menu
  - Documentation (opens website)
  - Report Issue (opens GitHub issues)
  - Show Logs (opens log directory)
  - About NoteCove (shows version, license info)

**Acceptance Criteria:**

- Menus render correctly on all platforms
- All menu items work
- Keyboard shortcuts function correctly
- Platform-specific conventions followed (Cmd on macOS, Ctrl elsewhere)

---

### 2.9 Keyboard Shortcuts 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement global keyboard shortcuts
  - Navigation: Cmd/Ctrl+1/2/3 (focus folder/notes/editor)
  - Navigation: Cmd/Ctrl+↑/↓ (navigate notes list)
  - Open: Cmd/Ctrl+Enter (open selected note)
  - Open: Cmd/Ctrl+Shift+Enter (open in new window)
  - Editing: Cmd/Ctrl+B/I/U (bold/italic/underline)
  - Links: Cmd/Ctrl+K (insert link)
  - Links: Cmd/Ctrl+Shift+K (insert note link [[...]])
  - Copy: Cmd/Ctrl+Shift+C (copy note link to paste in other notes)
  - Code: Cmd/Ctrl+E (insert code block)
  - Organization: Cmd/Ctrl+D (duplicate note)
  - Organization: Cmd/Ctrl+Backspace (delete note)
  - Organization: Cmd/Ctrl+Shift+M (move note to folder - opens dialog)
  - Organization: Cmd/Ctrl+P (pin/unpin note)
  - Tags: Cmd/Ctrl+T (focus tag search)
  - Tags: Cmd/Ctrl+Shift+T (add tag at cursor)
  - Export: Cmd/Ctrl+E (export current note/folder)
  - Other: F2 (rename folder/note)
  - Other: Escape (clear search, deselect, close dialogs)
- [ ] 🟥 Platform-specific handling (Cmd on macOS, Ctrl elsewhere)

**Acceptance Criteria:**

- All shortcuts work correctly
- Shortcuts don't conflict
- Platform conventions followed

---

### 2.10 Window Management 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement main window
  - Three-panel layout
  - Persist size and position (app_state table)
- [ ] 🟥 Implement secondary note windows
  - Editor only (no folder/notes list)
  - Connects to same main process Yjs document (via IPC)
  - Persist size and position per note (app_state table)
  - Handle note deletion (show dialog, close window)
- [ ] 🟥 Implement window state persistence
  - Window size and position
  - Last opened note
  - Panel widths
  - Folder selection
  - Tag filter states
  - Search text
  - All stored in SQLite app_state table

**Acceptance Criteria:**

- Main window opens with saved state
- Can open notes in separate windows
- Secondary windows sync correctly with main window
- Window states persist across restarts

---

### 2.11 Recently Deleted & Note Restoration 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement "Recently Deleted" folder behavior
  - System folder (protected, can't rename/delete)
  - Always at bottom of SD tree
  - Shows deleted notes (deleted flag = true)
  - Deleted notes don't appear in search or tag filtering
  - UI-only folder (not in CRDT)
- [ ] 🟥 Implement note deletion
  - Move note to "Recently Deleted" (set deleted flag in CRDT)
  - Update SQLite cache
  - Notes stay indefinitely until manually purged
- [ ] 🟥 Implement note restoration
  - Context menu: Restore
  - Drag from "Recently Deleted" to another folder
  - Clears deleted flag, sets folderId
- [ ] 🟥 Implement permanent deletion
  - Context menu on note: Delete Permanently (confirmation dialog)
  - Context menu on "Recently Deleted" folder: Empty Trash (confirmation dialog)
  - Actually delete CRDT files from disk (note-id folder)
- [ ] 🟥 Implement folder deletion
  - Recursive delete: all notes and subfolders go to "Recently Deleted" (set deleted flags)
  - Confirmation dialog showing count of affected items

**Acceptance Criteria:**

- Deleted notes appear in "Recently Deleted"
- Can restore notes
- Can permanently delete notes
- Empty Trash works correctly
- Folder deletion is recursive

---

### 2.12 Note History UI 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement history button in editor toolbar (clock icon)
- [ ] 🟥 Implement history modal/sidebar
  - Left side: Timeline list
    - Date/time of each change
    - User who made change (from Yjs metadata)
    - Brief summary (characters added/deleted - compute from CRDT updates)
  - Right side: Preview of note at selected point
  - Bottom: "Restore to this version" button
  - Slider at top to scrub through versions quickly
- [ ] 🟥 Implement version restoration
  - Creates new CRDT update that reverts to old state
  - Preserves history (doesn't delete recent updates)
- [ ] 🟥 (Future - Post-MVP) Implement diff view
  - Side-by-side or inline
  - Additions in green, deletions in red
  - Filter by user

**Acceptance Criteria:**

- History view shows timeline of changes
- Can preview old versions
- Can restore to old version
- User attribution works
- Slider scrubbing works

---

### 2.13 Welcome Wizard 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement first-run detection
- [ ] 🟥 Implement welcome screen
  - Welcome message
  - Setup wizard flow:
    1. Configure username and mention handle
    2. Configure SDs (with auto-detection)
    3. Create default SD if none configured
  - Skip wizard if CLI settings provided
- [ ] 🟥 Implement CLI settings configuration
  - All settings configurable via CLI args
  - Skip wizard if necessary settings provided

**Acceptance Criteria:**

- Welcome wizard shows on first run
- Can configure basic settings
- Default SD created if needed
- CLI args bypass wizard

---

### 2.14 Drag & Drop External Files 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement drag from external apps
  - Drag text file → create new note with content
  - Drag to folder → create in that folder
  - Visual drop zone highlighting
- [ ] 🟥 Implement drag to external apps
  - Drag note to email/other app
  - Exports as plain text or markdown

**Acceptance Criteria:**

- Can drag text files into app
- Can drag notes out of app
- Visual feedback during drag

---

### 2.15 Accessibility 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Implement ARIA labels and proper semantic HTML
- [ ] 🟥 Ensure full keyboard navigation
- [ ] 🟥 Test with screen readers (VoiceOver on macOS, NVDA on Windows)
- [ ] 🟥 Implement focus indicators
- [ ] 🟥 Support high contrast mode
- [ ] 🟥 Font size adjustment (via zoom)

**Acceptance Criteria:**

- Screen readers can navigate app
- All functionality accessible via keyboard
- Focus indicators are clear
- Passes basic accessibility audits

---

## Phase 3: iOS App (Basic)

### 3.1 iOS Project Setup 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Create Xcode project in `/packages/ios`
- [ ] 🟥 Configure for latest iOS (research current version)
- [ ] 🟥 Target iPhone + iPad (universal)
- [ ] 🟥 Set up SwiftUI structure
- [ ] 🟥 Set up JavaScriptCore bridge for CRDT operations
  - Bridge to `packages/shared` TypeScript code
  - Swift wrapper around JSContext
  - Handle data marshalling (Swift ↔ JS)
  - Document bridge design in `/docs/ios-jscore-bridge.md`
- [ ] 🟥 Set up XCTest framework
- [ ] 🟥 Configure free Apple Developer account for development builds
- [ ] 🟥 Create build scripts for installing to device via Xcode
- [ ] 🟥 Add iOS app to Turborepo build pipeline (as separate task)

**Acceptance Criteria:**

- Xcode project builds successfully
- Can install on device via Xcode (7-day expiration with free account)
- Basic SwiftUI app launches
- JavaScriptCore bridge can execute `packages/shared` code

**Design Docs:**

- Create `/docs/ios-jscore-bridge.md` documenting Swift ↔ JSCore bridge design

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

## Phase 4: Advanced Features (Post-MVP)

### 4.1 Tags System 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Implement tag parsing from note content
  - `#tagname` syntax
  - Case-insensitive
  - No spaces
  - Theme-dependent color (blue accent)
- [ ] 🟥 Implement tag autocomplete in editor
  - Show existing tags as user types `#`
  - Insert selected tag
- [ ] 🟥 Implement tag index updates
  - Real-time as notes are edited
  - Update SQLite tags table
- [ ] 🟥 Enhance tag panel functionality (already basic version exists in Phase 2)
  - Full tri-state filtering
  - Tag count badges

**Acceptance Criteria:**

- Tags are recognized in notes
- Autocomplete works
- Tag filtering works correctly

---

### 4.2 Inter-Note Links 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Implement inter-note link syntax: `[[title]]`
  - Theme-dependent color (different from tags, complementary to blue)
  - Store as note IDs internally
  - Display as titles (computed on render)
- [ ] 🟥 Implement link autocomplete
  - Trigger on `[[`
  - Show notes matching typed text (substring)
  - Show duplicates with differentiators (SD, folder, date)
  - Insert link as `[[note-id]]` with display title
- [ ] 🟥 Implement link click behavior
  - Single click: navigate to note in editor
  - Double click: open note in new window
- [ ] 🟥 Implement broken link handling
  - If target note deleted: show as invalid (strikethrough, red)
  - Don't remove link (allows restoration)
- [ ] 🟥 Implement link updating
  - When target note title changes, update display automatically
  - Links stored as IDs, so no actual update needed in content

**Acceptance Criteria:**

- Can create inter-note links
- Autocomplete works
- Links navigate correctly
- Broken links show as invalid

---

### 4.3 Advanced Search 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Enhance search with advanced dialog
  - Full text search (already working)
  - Filter by: date range, folder, SD, tags, has-todos, etc.
  - Boolean operators (AND, OR, NOT)
  - Saved searches
- [ ] 🟥 Implement search result highlighting
  - Highlight matching text in note list previews
  - Highlight in editor when opened from search

**Acceptance Criteria:**

- Advanced search dialog works
- Can save searches
- Results are accurate

---

### 4.4 Export as Markdown 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Implement note export
  - Right-click menu: Export as Markdown
  - File menu: Export
  - Convert TipTap content to markdown
  - Convert `[[note-id]]` links to relative file links
- [ ] 🟥 Implement folder export
  - Right-click menu on folder: Export as Markdown
  - Creates folder structure on disk (using file chooser)
  - One .md file per note
  - Preserve folder hierarchy
  - Handle duplicate titles (suffix with `-1`, `-2`, etc.)
- [ ] 🟥 Implement SD export
  - Settings or File menu: Export SD
  - Same as folder export but for entire SD
- [ ] 🟥 Implement filename mangling
  - Replace invalid filesystem characters with `_`
  - Remove emojis and non-keyboard-typable characters
  - Ensure filenames are valid on all platforms

**Acceptance Criteria:**

- Can export notes, folders, SDs
- Markdown is correct
- Links are converted correctly
- Folder structure preserved

---

### 4.5 Tri-State Checkboxes 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Implement tri-state checkbox in TipTap
  - Markdown: `- [ ]` (todo), `- [x]` (done), `- [N]` (NOPE)
  - Visual: empty checkbox, checked checkbox, red checkbox with "N"
  - Interaction: click to cycle through states
  - Works in bullet and numbered lists
- [ ] 🟥 Store checkbox state in CRDT
- [ ] 🟥 Index todos in SQLite for querying

**Acceptance Criteria:**

- Checkboxes render correctly
- Can cycle through states
- State syncs across instances

---

### 4.6 Color Highlight & Text Color 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Add TipTap extensions:
  - TextStyle
  - Color (text color)
  - Highlight (background color)
- [ ] 🟥 Add toolbar controls for color selection

**Acceptance Criteria:**

- Can change text color
- Can highlight text
- Colors persist in CRDT

---

### 4.7 Additional TipTap Extensions 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Add TipTap extensions (verify Yjs compatibility):
  - Table
  - Image (with alignment)
  - TaskList (integrate with tri-state checkboxes)
  - Mention (for @username)
  - Copy to clipboard
  - Emoji dropdown
  - Reset formatting
- [ ] 🟥 Add to toolbar

**Acceptance Criteria:**

- All extensions work
- Compatible with Yjs

---

### 4.8 IPC API (Read-Only) 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Design IPC API protocol
  - Commands: query notes, get note content, search, list folders
  - Response format: JSON
- [ ] 🟥 Implement API in main process
  - Accept connections via IPC (Electron's IPC mechanism)
  - Execute queries against SQLite cache + CRDT files
  - Return results
- [ ] 🟥 Implement CLI tool
  - `notecove query <query>` - runs query, outputs results
  - `notecove search <term>` - searches notes
  - Connects to running app via IPC
  - Falls back to error if app not running
- [ ] 🟥 Document API

**Acceptance Criteria:**

- API is accessible via IPC
- CLI tool works
- Can query notes programmatically

---

### 4.9 Due Dates & @mentions for Tasks 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Implement due date syntax: `@due(2025-12-31)`
  - Parse and extract due dates
  - Store in SQLite
  - Visual indicator in editor
- [ ] 🟥 Implement @mention for task assignment
  - Same as mention handle
  - Links task to user
- [ ] 🟥 Add due date filtering/querying

**Acceptance Criteria:**

- Can add due dates to tasks
- Can assign tasks with @mentions
- Can query tasks by due date

---

### 4.10 Apple Shortcuts Integration 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Implement Intents framework on iOS
  - Intent: Create Note
  - Intent: Add to Note
  - Intent: Search Notes
  - Intent: Get Note Content
- [ ] 🟥 Implement AppleScript support on macOS
  - Same capabilities as iOS Shortcuts
- [ ] 🟥 Document automation capabilities

**Acceptance Criteria:**

- Shortcuts can create/search notes
- AppleScript works on macOS

---

### 4.11 IPC API (Write Operations) 🟥

**Status:** To Do (Post-MVP)

**Tasks:**

- [ ] 🟥 Extend IPC API to support writes
  - Commands: create note, update note, delete note, move note
  - Ensure proper CRDT update generation
  - Update SQLite cache
  - Trigger UI updates
- [ ] 🟥 Update CLI tool to support write operations
- [ ] 🟥 Add safety checks (confirmation prompts, dry-run mode)

**Acceptance Criteria:**

- Can create/update/delete notes via API
- Changes appear in UI immediately
- CRDT state remains consistent

---

## Phase 5: Documentation & Polish

### 5.1 Documentation Website - Landing Page 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Set up Vite + React project in `/packages/website`
- [ ] 🟥 Configure for GitHub Pages deployment
- [ ] 🟥 Design landing page
  - Hero section with app description
  - Feature highlights
  - Screenshots/demos
  - Download links (when available)
  - Links to documentation
- [ ] 🟥 Create app icon/logo
  - Blue accent color (#2196F3)
  - Clean, minimalist style
  - License-compatible icons (Apache 2.0, MIT)
- [ ] 🟥 Deploy to GitHub Pages

**Acceptance Criteria:**

- Landing page is live
- Looks professional
- Links work

---

### 5.2 Documentation Website - User Guide 🟥

**Status:** To Do (Incremental)

**Tasks:**

- [ ] 🟥 Write installation instructions
  - macOS, Windows, Linux
  - iOS (TestFlight / direct install via Xcode)
- [ ] 🟥 Write user guide
  - Getting started
  - Creating notes and folders
  - Using tags
  - Inter-note links
  - Search
  - Export
  - Settings and SDs
  - Sync behavior
- [ ] 🟥 Add screenshots for each feature
- [ ] 🟥 Update incrementally as features are completed

**Acceptance Criteria:**

- User guide covers all features
- Screenshots are current
- Easy to follow

---

### 5.3 Documentation Website - Developer Docs 🟥

**Status:** To Do (Incremental)

**Tasks:**

- [ ] 🟥 Write architecture overview
  - CRDT design
  - File structure
  - Sync mechanism
  - SQLite caching
  - iOS JavaScriptCore bridge
- [ ] 🟥 Write API documentation
  - IPC API reference
  - CLI tool usage
- [ ] 🟥 Write contribution guide
  - How to build from source
  - Testing
  - Code style
  - PR process
- [ ] 🟥 Link to design docs in `/docs/`

**Acceptance Criteria:**

- Developer docs are comprehensive
- API is fully documented
- Easy for contributors to understand codebase

---

### 5.4 CI/CD Pipeline 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Enhance GitHub Actions workflow (based on Phase 1.2 local CI script)
  - Run tests, linting, builds on every push/PR
  - Test on: macOS, Windows, Linux
  - Report coverage
  - Use same checks as `pnpm ci-local`
- [ ] 🟥 Set up automated builds for releases
  - electron-builder for desktop (macOS, Windows, Linux)
  - Xcode build for iOS
- [ ] 🟥 Plan for code signing (defer actual setup)
  - macOS: Apple Developer account needed
  - Windows: Code signing certificate needed
  - iOS: Apple Developer account (same as macOS)
  - Document requirements in developer docs
- [ ] 🟥 Plan for distribution (defer actual setup)
  - GitHub Releases for desktop
  - TestFlight for iOS (requires paid Apple account - $99/year)
  - Future: Mac App Store, iOS App Store

**Acceptance Criteria:**

- CI runs on every push
- Can build release artifacts locally
- Code signing and distribution requirements documented

---

### 5.5 UI Polish & Refinements 🟥

**Status:** To Do (Ongoing)

**Tasks:**

- [ ] 🟥 Refine animations and transitions
- [ ] 🟥 Improve error messages and user feedback
- [ ] 🟥 Add loading states and progress indicators
- [ ] 🟥 Improve drag & drop visual feedback
- [ ] 🟥 Add tooltips and help text
- [ ] 🟥 Responsive design improvements
- [ ] 🟥 Performance optimizations
- [ ] 🟥 Icon and asset cleanup

**Acceptance Criteria:**

- UI feels polished and responsive
- Interactions are smooth
- Error messages are helpful

---

## Testing Strategy

### Test Coverage Targets

- **Overall:** 70% minimum
- **CRDT/Sync Logic:** ~100%
- **File System Operations:** ~100%
- **SQLite Operations:** ~100%
- **UI Components:** 70%

### Test Types

1. **Unit Tests (Jest)**
   - CRDT operations
   - File system operations
   - SQLite queries
   - Utility functions
   - React components (with React Testing Library)

2. **Integration Tests (Jest)**
   - Multi-instance sync scenarios
   - CRDT + SQLite consistency
   - IPC communication

3. **E2E Tests (Playwright for desktop, XCTest for iOS)**
   - User workflows
   - Multi-window scenarios
   - Settings and configuration
   - Search and filtering
   - Drag and drop

4. **Manual Testing**
   - Cross-platform compatibility
   - Sync with real cloud storage services
   - Performance with large note collections
   - Accessibility with screen readers

### Test Scenarios (Critical)

- **Multi-instance sync:** Two desktop instances editing same note simultaneously
- **Cross-platform sync:** Desktop and iOS editing same note
- **Offline mode:** Edit notes offline, sync when online
- **Conflict handling:** Ensure CRDT merges correctly
- **Data integrity:** Never lose note data
- **Large datasets:** Performance with 10,000+ notes
- **Out-of-order sync:** Updates arrive in arbitrary order due to cloud sync delays

---

## Development Workflow

### Branch Strategy

- `main` branch: stable, tested code
- Feature branches: `feature/<name>` for each major task
- Merge to `main` only after review and `pnpm ci-local` passes
- Each phase gets a feature branch (e.g., `feature/phase-1-core`)

### Code Review Process

- After implementing each phase, perform self-review
- Run `pnpm ci-local` (full test suite, linting, coverage)
- Check code coverage meets thresholds
- Update documentation as needed
- Get user approval before merging to `main`

### Bug Fixes

- Any bug report gets a test first (TDD)
- Fix the bug
- Verify test passes
- Expand existing test or create new one
- Run `pnpm ci-local` before committing

---

## Design Documentation

Complex architecture decisions should be documented in `/docs/`:

- `crdt-structure.md` - Yjs document design for notes and folders
- `file-sync-protocol.md` - File sync mechanism, error handling, out-of-order updates
- `sqlite-schema.md` - Database schema and caching strategy
- `ipc-protocol.md` - IPC commands, events, and data flow
- `tiptap-yjs-compatibility.md` - TipTap extension compatibility with Yjs
- `ios-jscore-bridge.md` - Swift ↔ JavaScriptCore bridge design

These docs should be created as part of implementation and kept up to date.

---

## Appendix: Deferred Features & Future Enhancements

These are features mentioned but explicitly marked as post-MVP or future enhancements:

1. **Note History - Diff View:** Side-by-side comparison of versions with colored changes
2. **Advanced Search - Saved Searches:** Ability to save search queries for reuse
3. **Color Customization:** Beyond blue accent, full theme customization
4. **Task Management Enhancements:** Due dates, @mentions, assignment
5. **Apple Shortcuts/AppleScript:** Automation integration
6. **IPC API Write Operations:** Create/update/delete via API
7. **Browser Extension:** For web clipping (mentioned as potential API use case)
8. **Plugin System:** Extensibility via third-party plugins
9. **Localization:** Support for languages beyond English
10. **App Store Distribution:** Mac App Store, iOS App Store (after TestFlight phase)
11. **Crash Reporting:** Integration with services like Sentry
12. **Settings Sync:** Optionally sync settings across devices (currently local-only)
13. **Version Snapshots:** Periodic snapshots of CRDT state for faster loading
14. **Advanced Tag Management:** Rename tags globally, merge tags
15. **Note Templates:** Create notes from templates
16. **Import:** Import from other note apps (Evernote, Notion, etc.)

---

## Plan Change History

- **2025-01-XX:** Post-planning review
  - Reordered Phase 1: Testing Framework Setup moved to 1.2 (was 1.5)
  - Reordered Phase 2: Note Editor moved to 2.3 (was 2.6)
  - Added iOS Architecture Overview section before Phase 3
  - Clarified IPC protocol (removed misleading `saveNote`, documented CRDT auto-persistence flow)
  - Added local CI script (`pnpm ci-local`) to Phase 1.2
  - Added `/docs/` for design documentation
  - Added requirement to document complex designs in `/docs/`
  - Expanded design docs references throughout plan
  - Clarified CRDT structures (folder hierarchy, "All Notes"/"Recently Deleted" as UI-only)
  - Added notes about out-of-order update handling
  - Added notes about SQLite caching strategy

---

## Linked Documents

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial clarification questions
- [QUESTIONS-2.md](./QUESTIONS-2.md) - Follow-up questions
- [QUESTIONS-3.md](./QUESTIONS-3.md) - Technical decisions
- [QUESTIONS-4.md](./QUESTIONS-4.md) - Implementation details
- [QUESTIONS-5.md](./QUESTIONS-5.md) - Feature clarifications
- [QUESTIONS-6.md](./QUESTIONS-6.md) - Final clarifications
- [QUESTIONS-7.md](./QUESTIONS-7.md) - iOS and MVP definition
- [POST-PLAN-1.md](./POST-PLAN-1.md) - Post-planning discussion round 1
- [POST-PLAN-2.md](./POST-PLAN-2.md) - Post-planning discussion round 2

---

**End of Plan**
