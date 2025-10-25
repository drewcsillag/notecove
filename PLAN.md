# NoteCove Implementation Plan

**Overall Progress:** `0%`

---

## Project Overview

NoteCove is a cross-platform notes application (Desktop + iOS) with offline-first architecture and file-based CRDT synchronization. The app syncs via shared file systems (Dropbox, Google Drive, iCloud) without requiring internet servers.

**Tech Stack:**
- **Desktop**: Electron + TypeScript + React + TipTap + Yjs + Material-UI
- **iOS**: Swift + SwiftUI
- **Build System**: Turborepo + pnpm workspaces + Vite
- **Database**: SQLite (better-sqlite3) with FTS5
- **Testing**: Jest + Playwright (desktop), XCTest (iOS)
- **Website**: Vite + React (GitHub Pages)
- **License**: Apache v2

**MVP Definition:** Phases 1-3 (Core Foundation + Desktop UI + iOS App with basic features)

**Post-MVP:** Phase 4 (Advanced Features: tags, inter-note links, advanced search, export)

---

## Phase 1: Core Foundation

### 1.1 Project Setup & Repository Structure 🟥

**Status:** To Do

**Tasks:**
- [ ] 🟥 Initialize git repository with proper .gitignore
- [ ] 🟥 Set up monorepo structure with Turborepo + pnpm workspaces
  - `/packages/desktop` - Electron app
  - `/packages/ios` - iOS app
  - `/packages/shared` - Shared TypeScript code (CRDT logic, types)
  - `/packages/website` - Documentation website
  - `/tools` - Build tools and scripts
- [ ] 🟥 Configure TypeScript (strict mode) for all packages
- [ ] 🟥 Set up ESLint with appropriate rules
- [ ] 🟥 Configure Prettier for code formatting
- [ ] 🟥 Add LICENSE file (Apache v2)
- [ ] 🟥 Create initial README.md with project description
- [ ] 🟥 Set up pnpm workspace configuration
- [ ] 🟥 Configure Turborepo for task orchestration and caching

**Acceptance Criteria:**
- Monorepo builds successfully
- All linting passes
- TypeScript compiles without errors
- Can run `pnpm install` and `pnpm build` from root

---

### 1.2 CRDT Core Implementation 🟥

**Status:** To Do

**Tasks:**
- [ ] 🟥 Design Yjs document structure for notes
  - Y.Doc per note with Y.XmlFragment for TipTap content
  - Metadata: `{ id: UUID, created: timestamp, modified: timestamp, folderId: UUID | null, deleted: boolean }`
- [ ] 🟥 Design Yjs document structure for folder hierarchy (per-SD)
  - Y.Map root: `{ folders: Y.Map<folderId, FolderData> }`
  - FolderData: `{ id: UUID, name: string, parentId: UUID | null, sdId: string, order: number }`
- [ ] 🟥 Implement CRDT update file structure
  - Instance ID generation (UUID v4, persistent, CLI override for testing)
  - Sequence numbering for updates
  - File naming: `<instance-id>.<seq-start>[-<seq-end>].yjson`
- [ ] 🟥 Implement update packing logic
  - Pack after 50-100 updates
  - Pack after 10 seconds of no activity
  - Pack on note blur/window focus loss
- [ ] 🟥 Implement metadata tracking in `meta/<instance-id>.json`
  - Store last processed sequence per remote instance
  - Store computed state snapshot for fast loading
- [ ] 🟥 Add user tracking in Yjs metadata
  - Include `{ userId: UUID, username: string, timestamp: number }` in each update
  - Auto-detect system username as default
- [ ] 🟥 Handle out-of-order update application (sync delays)

**Acceptance Criteria:**
- Can create and update Yjs documents
- Updates are written to correct file structure
- Updates can be read and merged from multiple instances
- Packing logic works correctly
- User metadata is preserved in updates

**Test Coverage:** ~100%

---

### 1.3 File System Operations 🟥

**Status:** To Do

**Tasks:**
- [ ] 🟥 Implement SD (Sync Directory) structure creation
  - `<SD-root>/notes/<note-id>/updates/`
  - `<SD-root>/notes/<note-id>/meta/`
  - `<SD-root>/folders/updates/`
  - `<SD-root>/folders/meta/`
- [ ] 🟥 Implement file watching with native APIs (chokidar for Node.js)
  - Watch frequency: ~2 seconds
  - Detect new update files from other instances
  - Handle file creation, modification, deletion
- [ ] 🟥 Implement CRDT file reading/writing
  - Read all updates for a note/folder
  - Write new updates atomically
  - Handle concurrent writes (shouldn't happen with instance-id naming)
- [ ] 🟥 Implement sync detection and application
  - Detect new updates from other instances
  - Apply updates to in-memory Yjs document
  - Merge changes automatically (CRDT handles conflicts)
- [ ] 🟥 Handle SD unavailability scenarios
  - SD folder deleted: Alert user, remove from active SDs
  - No write permissions: Alert user, mark SD as read-only
  - Network drive disconnected: Continue working, resume when reconnected

**Acceptance Criteria:**
- Can create SD structure on disk
- File watching detects changes reliably
- Updates sync between simulated instances
- Error scenarios are handled gracefully

**Test Coverage:** ~100% (critical for data integrity)

---

### 1.4 Local Database & Cache 🟥

**Status:** To Do

**Tasks:**
- [ ] 🟥 Set up SQLite database with better-sqlite3
- [ ] 🟥 Design schema for note index
  - `notes` table: id, title, sdId, folderId, created, modified, deleted, content_preview
  - FTS5 table for full-text search: note content
  - Index on: sdId, folderId, deleted, modified
- [ ] 🟥 Design schema for folder index
  - `folders` table: id, name, parentId, sdId, order
  - Index on: sdId, parentId
- [ ] 🟥 Design schema for tags
  - `tags` table: id, name (case-insensitive)
  - `note_tags` table: noteId, tagId
  - Index on: noteId, tagId, name
- [ ] 🟥 Design schema for user tracking
  - `users` table: id, username, lastSeen
  - Link to note modifications
- [ ] 🟥 Design schema for app state
  - `app_state` table: key-value pairs for UI state
  - Store: last opened note, panel widths, folder collapse state, tag filters, search text, window position/size
- [ ] 🟥 Implement initial SD indexing with progress reporting
  - Read all CRDT updates
  - Build current state
  - Extract metadata
  - Show progress dialog: "Indexing notes... X/Y"
- [ ] 🟥 Implement incremental cache updates
  - Update cache when local changes occur
  - Update cache when remote changes detected
- [ ] 🟥 Implement cache invalidation strategy
  - Detect when CRDT files are newer than cache
  - Re-index as needed

**Acceptance Criteria:**
- SQLite database is created and accessible
- Can index notes and folders from CRDT files
- FTS5 search works correctly
- Cache stays in sync with CRDT state
- Initial indexing shows progress

**Test Coverage:** ~100% (critical for data integrity)

---

### 1.5 Testing Framework Setup 🟥

**Status:** To Do

**Tasks:**
- [ ] 🟥 Configure Jest for unit tests
  - TypeScript support
  - Coverage reporting (target: 70% overall, ~100% for CRDT/storage)
- [ ] 🟥 Configure Playwright for E2E tests (desktop)
  - Test multiple window scenarios
  - Test multi-instance sync
- [ ] 🟥 Set up XCTest project for iOS
- [ ] 🟥 Create test utilities
  - Mock file system
  - Mock CRDT instances
  - Test fixtures (sample notes, folders)
- [ ] 🟥 Implement CI script (runs tests, linting, builds)
  - `pnpm test` - runs all tests
  - `pnpm lint` - runs ESLint
  - `pnpm build` - builds all packages
  - `pnpm ci` - runs all CI checks
- [ ] 🟥 Create GitHub Actions workflow for CI
  - Run on push and PR
  - Test on: macOS, Windows, Linux
  - Report coverage

**Acceptance Criteria:**
- All test frameworks are configured
- Can run unit tests with coverage
- Can run E2E tests
- CI script works locally
- GitHub Actions workflow runs successfully

**Test Coverage:** N/A (this is the setup)

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
  - Commands: loadNote, saveNote, createNote, deleteNote, etc.
  - Events: noteUpdated, noteDeleted, syncProgress, etc.

**Acceptance Criteria:**
- Electron app launches
- React renders in window
- MUI components work
- IPC communication established
- Main process can manage CRDT documents

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

### 2.3 Folder Tree Panel 🟥

**Status:** To Do

**Tasks:**
- [ ] 🟥 Implement folder tree component (MUI TreeView)
  - Header: "FOLDERS" + plus icon
  - Tree per SD (labeled with SD name)
  - Each SD has "All Notes" (top) and "Recently Deleted" (bottom)
  - User folders in between
  - Folder expand/collapse (persist state)
  - Note count badges on folders
- [ ] 🟥 Implement folder creation
  - Click plus icon: create folder in active SD
  - Context menu: New Folder
  - Default location: root level if "All Notes" selected, subfolder otherwise
- [ ] 🟥 Implement folder drag & drop
  - Drag folder to another folder (nesting)
  - Drag folder to "All Notes" (move to root)
  - Cannot drag folder to be its own descendant
  - Cannot drag across SDs
  - Visual feedback during drag
- [ ] 🟥 Implement folder context menu
  - Rename Folder
  - Move to Top Level
  - Delete (confirmation dialog, recursive delete to Recently Deleted)
- [ ] 🟥 Implement folder selection
  - Click folder to select
  - Selection persists across restarts
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

---

### 2.4 Tags Panel 🟥

**Status:** To Do

**Tasks:**
- [ ] 🟥 Implement tags panel below folder tree
  - Header: "TAGS" + search box
  - Draggable splitter between folder tree and tags panel
  - List of tag buttons (all known tags)
  - Tri-state buttons: off / positive (blue) / negative (red)
  - Fuzzy search for tag filtering
- [ ] 🟥 Implement tag filtering logic
  - Multiple positive tags: AND logic (note must have all)
  - Negative tags: exclude even if positive match
  - Update notes list when tag filters change
  - Persist tag filter state across restarts
- [ ] 🟥 Extract tags from note content
  - Parse `#tagname` from notes (case-insensitive)
  - No spaces in tag names
  - Update tag index in SQLite

**Acceptance Criteria:**
- Tags panel displays all tags
- Can toggle tag states (off/positive/negative)
- Tag search filters tag list (fuzzy)
- Tag filtering updates notes list correctly
- Tag state persists across restarts

---

### 2.5 Notes List Panel 🟥

**Status:** To Do

**Tasks:**
- [ ] 🟥 Implement notes list component
  - Header: search box
  - Sub-header: "NOTES" + note count + plus button
  - List of note items (virtual scrolling for >1000 notes)
  - Each note shows: title, last modified time (relative, with tooltip)
  - Sort: pinned notes first, then by most recently edited
  - Multi-select support (platform-standard: Ctrl/Cmd+Click, Shift+Click)
  - Multi-select badge (floating near selection)
- [ ] 🟥 Implement search functionality
  - Live/incremental search (debounced 250-300ms)
  - Search full note content + tags
  - Case-sensitive toggle (icon/button next to search box)
  - Regex toggle
  - Whole word toggle
  - Advanced search dialog (additional options)
  - Search scope selector: Current SD / All SDs / Current Folder
  - Persist search text across restarts
  - Use SQLite FTS5 for fast searching
- [ ] 🟥 Implement note creation
  - Click plus button: create note in active folder
  - If "All Notes" selected: create orphan note (no folder)
  - Context menu: New Note
  - Auto-focus editor on new note
- [ ] 🟥 Implement note selection
  - Click note to open in editor
  - Selection persists across restarts
- [ ] 🟥 Implement note drag & drop
  - Drag note to folder (move)
  - Drag multiple selected notes
  - Cross-SD move: show warning dialog ("copying note to new SD, deleting from old SD")
  - "Don't show again" checkbox (global setting)
  - Drag to "Recently Deleted" = delete
  - Visual feedback during drag
- [ ] 🟥 Implement note context menu
  - New Note
  - Pin / Unpin (toggle based on state)
  - Open in New Window
  - Move to... (submenu of folders)
  - Duplicate to... (submenu of folders, can cross SDs)
  - Delete
- [ ] 🟥 Implement pinned notes
  - Visual indicator (pin icon)
  - Show at top of list
  - Sort among themselves by edit time
- [ ] 🟥 Handle note title extraction
  - First line with text = title
  - If only whitespace: "Untitled"
  - Long titles: truncate with ellipsis in UI
  - Update title in real-time as user types

**Acceptance Criteria:**
- Notes list displays correctly
- Search works (live, with options)
- Can create, select, pin, delete notes
- Drag & drop works correctly
- Multi-select works
- Note counts and times are accurate
- Virtual scrolling performs well with many notes

---

### 2.6 Note Editor (Basic TipTap) 🟥

**Status:** To Do

**Tasks:**
- [ ] 🟥 Set up TipTap editor with Yjs binding
  - Start with Simple Template from TipTap docs
  - Integrate with Yjs document from main process (via IPC)
  - Research TipTap extensions for Yjs compatibility
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
  - Save state automatically (Yjs handles this)

**Acceptance Criteria:**
- Editor renders and is editable
- Formatting works (toolbar + shortcuts)
- Changes sync to CRDT immediately
- Changes from other instances appear in real-time
- Collaborative cursors show other users (if available)

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
- Can add/remove/configure SDs
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
  - Organization: Cmd/Ctrl+D (duplicate note)
  - Organization: Cmd/Ctrl+Backspace (delete note)
  - Organization: Cmd/Ctrl+P (pin/unpin note)
  - Tags: Cmd/Ctrl+T (focus tag search)
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
  - Persist size and position
- [ ] 🟥 Implement secondary note windows
  - Editor only (no folder/notes list)
  - Connects to same main process Yjs document
  - Persist size and position per note
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
  - Shows deleted notes
  - Deleted notes don't appear in search or tag filtering
- [ ] 🟥 Implement note deletion
  - Move note to "Recently Deleted" (mark deleted flag in CRDT)
  - Update SQLite cache
  - Notes stay indefinitely until manually purged
- [ ] 🟥 Implement note restoration
  - Context menu: Restore
  - Drag from "Recently Deleted" to another folder
  - Clears deleted flag
- [ ] 🟥 Implement permanent deletion
  - Context menu on note: Delete Permanently (confirmation dialog)
  - Context menu on "Recently Deleted" folder: Empty Trash (confirmation dialog)
  - Actually delete CRDT files from disk
- [ ] 🟥 Implement folder deletion
  - Recursive delete: all notes and subfolders go to "Recently Deleted"
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
    - User who made change
    - Brief summary (characters added/deleted)
  - Right side: Preview of note at selected point
  - Bottom: "Restore to this version" button
- [ ] 🟥 Implement version restoration
  - Creates new CRDT update that reverts to old state
  - Preserves history (doesn't delete recent updates)
- [ ] 🟥 (Future) Implement diff view
  - Side-by-side or inline
  - Additions in green, deletions in red
  - Filter by user

**Acceptance Criteria:**
- History view shows timeline of changes
- Can preview old versions
- Can restore to old version
- User attribution works

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
  - Skip button if CLI settings provided
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
- [ ] 🟥 Configure shared Swift package for CRDT logic
  - Bridge to TypeScript shared package, or reimplement in Swift?
  - Decision: Reimplement CRDT reading/writing in Swift for native performance
- [ ] 🟥 Set up XCTest framework
- [ ] 🟥 Configure free Apple Developer account for development builds
- [ ] 🟥 Create build scripts for installing to device via Xcode
- [ ] 🟥 Add iOS app to Turborepo build pipeline (as separate task)

**Acceptance Criteria:**
- Xcode project builds successfully
- Can install on device via Xcode
- Basic SwiftUI app launches

---

### 3.2 iOS CRDT Implementation 🟥

**Status:** To Do

**Tasks:**
- [ ] 🟥 Port CRDT reading/writing logic to Swift
  - Yjs update file reading
  - Yjs update file writing
  - Sequence numbering, packing logic
  - File structure handling
- [ ] 🟥 Implement file watching on iOS
  - Use FileManager notifications
  - Handle iCloud Drive sync delays
- [ ] 🟥 Implement SQLite integration on iOS
  - Use GRDB or similar Swift SQLite library
  - Same schema as desktop
  - FTS5 for search

**Acceptance Criteria:**
- iOS app can read/write CRDT files
- Syncs correctly with desktop instances
- File watching detects changes

**Test Coverage:** ~100%

---

### 3.3 iOS UI - Navigation Structure 🟥

**Status:** To Do

**Tasks:**
- [ ] 🟥 Implement tab bar navigation
  - Tab 1: Notes (hierarchical: SD list → folder list → note list → editor)
  - Tab 2: Tags
  - Tab 3: Settings
- [ ] 🟥 Implement SD list view
  - List of configured SDs
  - Tap to navigate to folder list
- [ ] 🟥 Implement folder list view
  - Shows folder tree for selected SD
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
- [ ] 🟥 Implement combined folder and tag view in Notes tab
  - Segmented control: Folders / Tags
  - Or collapsible sections
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
- [ ] 🟥 Research iOS rich text editing options
  - UITextView with attributed strings?
  - Third-party library compatible with Yjs?
  - WebView with TipTap (fallback option)?
- [ ] 🟥 Implement editor view (full-screen)
  - Keyboard accessory view with formatting shortcuts
  - Toolbar for formatting options
  - Same editing capabilities as desktop (subset initially)
- [ ] 🟥 Implement Yjs integration
  - Sync with CRDT files
  - Real-time updates

**Acceptance Criteria:**
- Editor works for basic text editing
- Formatting toolbar functions
- Changes sync to CRDT
- Changes from other instances appear

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
  - Live search
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
  - Theme-dependent color (different from tags)
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
  - Creates folder structure on disk
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
  - Placeholder initially, professional design later
  - Blue accent color
  - Clean, minimalist style
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
  - iOS (TestFlight / direct install)
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
- [ ] 🟥 Write API documentation
  - IPC API reference
  - CLI tool usage
  - TypeScript SDK (if created)
- [ ] 🟥 Write contribution guide
  - How to build from source
  - Testing
  - Code style
  - PR process

**Acceptance Criteria:**
- Developer docs are comprehensive
- API is fully documented
- Easy for contributors to understand codebase

---

### 5.4 CI/CD Pipeline 🟥

**Status:** To Do

**Tasks:**
- [ ] 🟥 Enhance GitHub Actions workflow
  - Run tests, linting, builds on every push/PR
  - Test on: macOS, Windows, Linux
  - Report coverage
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
  - TestFlight for iOS (requires paid Apple account)
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

---

## Development Workflow

### Branch Strategy
- `main` branch: stable, tested code
- Feature branches: `feature/<name>` for each major task
- Merge to `main` only after review and CI passes
- Each phase gets a feature branch (e.g., `feature/phase-1-core`)

### Code Review Process
- After implementing each phase, perform self-review
- Run full test suite
- Check code coverage
- Update documentation as needed
- Get user approval before merging to `main`

### Bug Fixes
- Any bug report gets a test first (TDD)
- Fix the bug
- Verify test passes
- Expand existing test or create new one

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

## Notes

- This plan is a living document and will be updated as implementation progresses
- Phase durations are not specified; progress is tracked by task completion
- Testing is integrated into each phase, not a separate phase
- Documentation is built incrementally as features are completed
- User feedback and reality of implementation may require plan adjustments
- All plan changes will be documented and previous versions preserved in git history

---

## Linked Documents

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial clarification questions
- [QUESTIONS-2.md](./QUESTIONS-2.md) - Follow-up questions
- [QUESTIONS-3.md](./QUESTIONS-3.md) - Technical decisions
- [QUESTIONS-4.md](./QUESTIONS-4.md) - Implementation details
- [QUESTIONS-5.md](./QUESTIONS-5.md) - Feature clarifications
- [QUESTIONS-6.md](./QUESTIONS-6.md) - Final clarifications
- [QUESTIONS-7.md](./QUESTIONS-7.md) - iOS and MVP definition

---

**End of Plan**
