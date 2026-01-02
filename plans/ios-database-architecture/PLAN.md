# iOS Database Architecture Plan

## Problem

The iOS app currently reads CRDT files directly from iCloud Drive, which causes:
- App stalls when files aren't downloaded locally
- Blocking file I/O on the main thread
- Poor user experience with "Loading..." states

## Solution

Adopt the same architecture as the desktop app:
1. **SQLite database** is the source of truth for UI
2. **Background sync service** monitors file system and updates database
3. **UI reads from database only** - never blocks on file I/O

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      SwiftUI Views                       │
│  (NoteListView, NoteEditorView, FolderTreeView, etc.)   │
└─────────────────────────┬───────────────────────────────┘
                          │ reads
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   SQLite Database                        │
│  (notes, folders, tags, sync_state - local to device)   │
└─────────────────────────┬───────────────────────────────┘
                          │ updates
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Background Sync Service                 │
│  - Monitors iCloud directory for changes                 │
│  - Downloads files when they appear                      │
│  - Applies CRDT updates to database                      │
│  - Writes local changes to CRDT files                    │
└─────────────────────────┬───────────────────────────────┘
                          │ reads/writes
                          ▼
┌─────────────────────────────────────────────────────────┐
│               iCloud Drive (File System)                 │
│  notes/{noteId}/logs/*.crdtlog                          │
│  .notecove/activity/*.log                               │
│  .notecove/deleted/*.log                                │
└─────────────────────────────────────────────────────────┘
```

## Phase 1: Add SQLite Database

### 1.1 Add SQLite Dependency
- Use GRDB.swift (Swift wrapper for SQLite)
- Add via Swift Package Manager

### 1.2 Create Database Schema
Reuse types from shared package:
- `notes` table (id, title, sdId, folderId, created, modified, deleted, pinned, contentPreview)
- `folders` table (id, name, parentId, sdId, order, deleted)
- `sync_state` table (noteId, lastSequence, lastSyncTime)

### 1.3 Create DatabaseManager
- Initialize database in app's documents directory
- Provide CRUD operations for notes/folders
- Observable for SwiftUI integration

## Phase 2: Background Sync Service

### 2.1 File Monitoring
- Use `NSFilePresenter` or `DispatchSource` to monitor iCloud directory
- Detect new/modified CRDT log files
- Handle iCloud download status (trigger downloads, don't block)

### 2.2 Inbound Sync (Files → Database)
- When new CRDT files appear:
  1. Check if downloaded, trigger download if not
  2. Once downloaded, apply to JS bridge
  3. Extract metadata (title, preview)
  4. Update database

### 2.3 Outbound Sync (Edits → Files)
- When user edits a note:
  1. Update database immediately (optimistic)
  2. Write CRDT update to file in background
  3. Record activity in activity log

## Phase 3: Update UI Layer

### 3.1 NoteListView
- Read notes from database, not CRDT files
- Subscribe to database changes for live updates
- Show notes immediately (no iCloud wait)

### 3.2 NoteEditorView
- Load note content from database cache
- On edit: update database + trigger background file write
- No blocking on iCloud

### 3.3 FolderTreeView
- Read folders from database
- Subscribe to database changes

## Phase 4: Handle Edge Cases

### 4.1 Offline Mode
- Database always available
- Queue outbound changes when offline
- Sync when connection restored

### 4.2 Conflict Resolution
- CRDT handles content conflicts automatically
- Database updated with merged result

### 4.3 First Launch / Empty Database
- Scan iCloud directory for existing notes
- Trigger downloads
- Populate database as files become available
- Show progress indicator

## Implementation Order

1. Add GRDB.swift dependency
2. Create database schema and DatabaseManager
3. Create background sync service (read-only first)
4. Update NoteListView to read from database
5. Update NoteEditorView to read from database
6. Add write-through for edits
7. Test sync scenarios

## Files to Create/Modify

### New Files
- `Database/DatabaseManager.swift` - SQLite wrapper
- `Database/NoteRepository.swift` - Note CRUD operations
- `Database/FolderRepository.swift` - Folder CRUD operations
- `Sync/BackgroundSyncService.swift` - File monitoring and sync
- `Sync/iCloudSyncQueue.swift` - Download queue management

### Modified Files
- `Views/NoteListView.swift` - Read from database
- `Views/NoteEditorView.swift` - Read/write through database
- `Views/FolderTreeView.swift` - Read from database
- `App/NoteCoveApp.swift` - Initialize database and sync service

## Success Criteria

- App never stalls waiting for iCloud downloads
- Notes appear in list as soon as files are downloaded
- Editing works offline
- Changes sync to other devices within seconds
