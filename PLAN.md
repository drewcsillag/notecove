# NoteCove Implementation Plan

**Overall Progress:** `8/21 phases (38%)` + Phase 2.4: 3/5 sub-phases complete

**Last Updated:** 2025-10-26 (Completed Phase 2.4.3: Folder Context Menus)

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

**Status:** In Progress (Phase 2.4: 3/5 sub-phases complete)

Desktop Electron application with basic UI, note editing, folder management, and multi-window sync.

**Sub-phases:**

- 2.1 Desktop App Basic Structure ✅
- 2.2 Desktop Note Editing & CRDT Integration ✅
- 2.3 Desktop Multi-Window Sync ✅
- 2.4 Folder Management UI 🟡 (3/5 sub-phases complete)
- 2.5 Notes List Panel 🔜 (Next up)
- 2.6 Tags Panel ⏸️

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

### [Phase 4: Advanced Features (Post-MVP)](./PLAN-PHASE-4.md) ⏸️

**Status:** Not Started

Advanced features for both platforms including tags, inter-note links, advanced search, and export functionality.

**Sub-phases:**

- 4.1 Tags Implementation
- 4.2 Inter-Note Links
- 4.3 Advanced Search (FTS5)
- 4.4 Export Functionality

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
- 🟡 2.4 Folder Management UI (3/5 sub-phases complete)
  - ✅ 2.4.1 Basic Folder Tree Display
  - ✅ 2.4.2 Folder Creation & Editing
  - ✅ 2.4.3 Folder Context Menus
  - ⏸️ 2.4.4 Folder Drag & Drop
  - ⏸️ 2.4.5 Folder Deletion & Validation
- 🔜 2.5 Notes List Panel (Next up)
- ⏸️ 2.6 Tags Panel

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

## Recent Updates

**2025-10-26:**

- Split PLAN.md into separate phase files for better manageability
- Completed Phase 2.4.3: Folder Context Menus
- Swapped Phase 2.5 (Notes List Panel) with 2.6 (Tags Panel) - implementing Notes List next
- Fixed cross-instance sync bug (gap detection not returning affected notes)

**2025-10-25:**

- Completed Phase 2.3: Desktop Multi-Window Sync
- Implemented activity logging and file watching for cross-instance sync
- Enhanced E2E test coverage for multi-window and cross-instance scenarios
