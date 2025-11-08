# NoteCove Implementation Plan

**Overall Progress:** `8/21 phases (38%)` + Phase 2.4: 5/5 sub-phases complete + Phase 2.5: 8/10 sub-phases complete + Phase 2.6: Partial

**Last Updated:** 2025-10-31 (Phase 2.5.7.3 Drag & Drop complete)

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

## Phase Details

This plan is organized into 5 phases. Each phase has been split into separate files for better manageability:

### [Phase 1: Core Foundation](./PLAN-PHASE-1.md) ✅

**Status:** Complete

Project setup, monorepo structure, TypeScript configuration, shared CRDT logic, and file-based storage system.

**Sub-phases:**

- 1.1 Project Setup & Repository Structure ✅
- 1.2 Shared Package (CRDT & Storage) ✅
- 1.3 Database Schema & SQLite Integration ✅

---

### [Phase 2: Desktop UI (Basic)](./PLAN-PHASE-2.md) 🟡

**Status:** In Progress (Phase 2.4: 5/5 complete, Phase 2.5: 2/6 complete, Phase 2.6: Partial)

Desktop Electron application with basic UI, note editing, folder management, and multi-window sync.

**Sub-phases:**

- 2.1 Desktop App Basic Structure ✅
- 2.2 Desktop Note Editing & CRDT Integration ✅
- 2.3 Desktop Multi-Window Sync ✅
- 2.4 Folder Management UI ✅ (5/5 sub-phases complete)
- 2.5 Notes List Panel 🟡 (2/6 sub-phases complete)
- 2.6 Settings Window 🟡 (Partial - UI complete, integration pending)
- 2.7 Tags Panel 🟥 (To Do)

---

### [Phase 3: iOS App (Basic)](./PLAN-PHASE-3.md) ⏸️

**Status:** Not Started

iOS native application with basic UI, note editing via WKWebView, and folder management.

**Sub-phases:**

- 3.1 iOS Project Setup
- 3.2 iOS File Storage & JavaScriptCore Bridge
- 3.3 iOS Note Editing (WKWebView + TipTap)
- 3.4 iOS Folder Management
- 3.5 iOS Cross-Device Sync

---

### [Phase 4: Advanced Features (Post-MVP)](./PLAN-PHASE-4.md) 🟡

**Status:** Partially Started

Advanced features for both platforms including tags, CRDT optimization, cross-SD moves, inter-note links, advanced search, and export functionality.

**Sub-phases:**

- 4.1 Tags Implementation 🟡 (Partially Complete)
- 4.1bis CRDT Snapshot and Packing System ✅ (Complete)
- 4.1bis.1 Robust Cross-SD Note Moves 🟥 (To Do - [Plan](./PLAN-PHASE-4.1bis.1.md) | [Architecture](./docs/architecture/cross-sd-move-state-machine.md))
- 4.2 Inter-Note Links 🟥
- 4.3 Advanced Search (FTS5) 🟥
- 4.4 Export Functionality 🟥

---

### [Phase 5: Documentation & Polish](./PLAN-PHASE-5.md) ⏸️

**Status:** Not Started

Documentation website, user guides, and final polish for both platforms.

**Sub-phases:**

- 5.1 Documentation Website
- 5.2 User Documentation
- 5.3 Developer Documentation
- 5.4 Final Polish & Performance
- 5.5 Release Preparation

---

## Progress Summary

**Completed Phases:** 1 (Core Foundation)

**In Progress:** Phase 2 (Desktop UI)

- ✅ 2.1 Desktop App Basic Structure
- ✅ 2.2 Desktop Note Editing & CRDT Integration
- ✅ 2.3 Desktop Multi-Window Sync
- ✅ 2.4 Folder Management UI (5/5 sub-phases complete)
  - ✅ 2.4.1 Basic Folder Tree Display
  - ✅ 2.4.2 Folder Creation & Editing
  - ✅ 2.4.3 Folder Context Menus
  - ✅ 2.4.4 Folder Drag & Drop
  - ✅ 2.4.5 Multi-SD Support
- 🟡 2.5 Notes List Panel (8/10 sub-phases complete)
  - ✅ 2.5.1 Basic Notes List Display
  - ✅ 2.5.2 Note Selection & Creation
  - ✅ 2.5.3 Basic Search Functionality
  - ✅ 2.5.4 Note Context Menu & Deletion
  - ✅ 2.5.5 "Recently Deleted" Virtual Folder
  - ✅ 2.5.6 Pinned Notes
  - ✅ 2.5.7.1 Move to... Context Menu
  - ✅ 2.5.7.2 Multi-Select Support
  - 🟥 2.5.7.3 Drag & Drop (To Do)
- 🟡 2.6 Settings Window (Partial)
- 🟥 2.7 Tags Panel (To Do)

**Remaining Phases:** 3, 4, 5

---

## Key Decisions & Notes

1. **CRDT Choice**: Using Yjs for its excellent performance and TypeScript support
2. **File Format**: `.yjson` files containing Yjs update snapshots
3. **Sync Strategy**: File-based sync via shared file systems (no server required)
4. **Database**: SQLite for caching only (not source of truth)
5. **Activity Sync**: Cross-instance synchronization using activity logs and file watchers
6. **iOS CRDT**: JavaScriptCore bridge to run shared TypeScript CRDT logic
7. **iOS Editor**: WKWebView with TipTap (same as desktop for consistency)

---

## Context Documents

For detailed design decisions, answered questions, and implementation context, see:

- **[QUESTIONS-1.md](./QUESTIONS-1.md)** - Initial requirements clarification (CRDT architecture, folder organization, tags, links, etc.)
- **[QUESTIONS-2.md](./QUESTIONS-2.md)** - Follow-up questions on CRDT structure, username handling, etc.
- **[QUESTIONS-3.md](./QUESTIONS-3.md)** - Database/cache technology decisions (SQLite vs alternatives)
- **[QUESTIONS-4.md](./QUESTIONS-4.md)** - User tracking in CRDT updates, metadata handling
- **[QUESTIONS-5.md](./QUESTIONS-5.md)** - Keyboard shortcuts and additional UI patterns
- **[QUESTIONS-6.md](./QUESTIONS-6.md)** - Note history UI design
- **[QUESTIONS-7.md](./QUESTIONS-7.md)** - iOS deployment strategy and IPC API scope
- **[POST-PLAN-0.md](./POST-PLAN-0.md)** - Initial plan review and feedback
- **[POST-PLAN-1.md](./POST-PLAN-1.md)** - Plan structure reorganization decisions
- **[POST-PLAN-2.md](./POST-PLAN-2.md)** - Folder tree CRDT architecture, local CI script requirements

**Key Topics by Document:**

- Search behavior: QUESTIONS-1.md (Q6.1-6.3)
- Tag filtering logic: QUESTIONS-1.md (Q3.1-3.4)
- Inter-note links: QUESTIONS-1.md (Q4.1-4.3)
- Multi-window behavior: QUESTIONS-1.md (Q5.1-5.3)
- Folder structure CRDT: POST-PLAN-2.md
- Storage Directory management: QUESTIONS-1.md (Q7.1-7.4)
- iOS architecture: POST-PLAN-2.md (iOS Architecture Overview)

---

## Recent Updates

**2025-10-31:**

- Completed Phase 2.5.7.3: Drag & Drop
  - Implemented drag & drop for single notes to folders
  - Extended drag & drop for multi-select (drag any selected note moves all)
  - Drag to "Recently Deleted" performs soft delete
  - Visual feedback: reduced opacity during drag, folder highlighting
  - Created DraggableNoteItem and DroppableFolderNode components
  - Moved DndProvider to App level for unified drag context
  - E2E tests created (currently skipped due to test infrastructure issues)
- Remediated all 4 ESLint React hook dependency warnings
  - Fixed with proper useCallback wrapping and dependency arrays
  - All lint checks now pass with 0 warnings
- Verified CI tests after Phase 2.5.7.2 completion
  - All format, lint, typecheck, build, unit, and E2E tests passing (67/67 E2E)
  - 4 ESLint warnings remain (React hook dependency issues - non-blocking)

**2025-10-30:**

- Completed Phase 2.5.7.2: Multi-Select Support
  - Implemented Cmd+Click (Meta key) to toggle individual note selection
  - Implemented Shift+Click for range selection
  - Added visual indication (blue-tinted background) for multi-selected notes
  - Added multi-select badge showing count with "Clear Selection" button
  - Updated context menu for bulk operations ("Delete 2 notes", "Move 2 notes to...")
  - Disabled Pin/Unpin for multi-select (ambiguous operation)
  - Bulk delete and move operations working correctly
  - 10 E2E tests created (2 passing, 8 with isolation issues)
  - All CI tests passing
- Completed Phase 2.5.7.1: Move to... Context Menu
  - Implemented "Move to..." dialog with folder tree selection
  - Fixed multi-SD mode bug in note:moved event handler
  - All 18 E2E tests passing in note-context-menu.spec.ts
  - 64/67 E2E tests passing overall (3 pre-existing flaky tests)
- Fixed welcome note appearing in wrong folders bug (Phase 2.5.2)
- Added E2E test for welcome note bug (welcome-note-deletion-bug.spec.ts)
- Documented 3 failing folder sync tests in PLAN-PHASE-2.md (should be fixed in Phase 2.3)

**2025-10-29:**

- Reviewed and confirmed completion status of all phases
- Phase 2.4 (Folder Management UI) is fully complete (5/5 sub-phases)
- Phase 2.5 (Notes List Panel) has 2/6 sub-phases complete
- Phase 2.6 (Settings Window) is partially complete (UI done, integration pending)
- Phases 2.5.3-2.5.6 and 2.7 remain to be implemented

**2025-10-26:**

- Split PLAN.md into separate phase files for better manageability
- Completed Phase 2.4.3: Folder Context Menus
- Completed Phase 2.4.4: Folder Drag & Drop
- Completed Phase 2.4.5: Multi-SD Support
- Completed Phase 2.5.1: Basic Notes List Display
- Completed Phase 2.5.2: Note Selection & Creation
- Swapped Phase 2.5 (Notes List Panel) with 2.6 (Tags Panel) - implementing Notes List next
- Fixed cross-instance sync bug (gap detection not returning affected notes)

**2025-10-25:**

- Completed Phase 2.3: Desktop Multi-Window Sync
- Implemented activity logging and file watching for cross-instance sync
- Enhanced E2E test coverage for multi-window and cross-instance scenarios
