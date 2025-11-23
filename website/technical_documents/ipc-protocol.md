# IPC Protocol Documentation

This document describes the Inter-Process Communication (IPC) protocol between NoteCove's main process and renderer processes.

## Overview

NoteCove uses Electron's IPC system for communication between the main process (Node.js) and renderer processes (Chromium). The main process manages CRDT documents in memory, file I/O, and database operations, while renderer processes handle the UI.

## Architecture

```
┌─────────────────┐         IPC Commands            ┌──────────────────┐
│                 │ ──────────────────────────────> │                  │
│   Renderer      │                                 │  Main Process    │
│   (React UI)    │        IPC Events               │  (CRDT Manager)  │
│                 │ <────────────────────────────── │                  │
└─────────────────┘                                 └──────────────────┘
                                                            │
                                                            │
                                                            ▼
                                                    ┌──────────────────┐
                                                    │  File System     │
                                                    │  SQLite DB       │
                                                    └──────────────────┘
```

##Data Flow

### Renderer → Main (Commands)

1. User edits note in TipTap editor
2. TipTap generates Yjs update
3. Renderer sends `note:applyUpdate` command with update bytes
4. Main applies update to in-memory Yjs document
5. Main writes update to disk
6. Main broadcasts `note:updated` event to all renderers

### Main → Renderer (Events)

1. File watcher detects new update file
2. Main reads update from disk
3. Main applies update to in-memory Yjs document
4. Main broadcasts `note:updated` event
5. All renderers receive event and apply update to their local Yjs docs

## Commands (Renderer → Main)

Commands are invoked using `window.electronAPI.<namespace>.<method>()` and return Promises.

### Note Operations

#### `note:load`

Load a note's CRDT document into memory and start watching its files.

**Parameters:**

- `noteId: string` - Note ID

**Returns:** `Promise<void>`

**Usage:**

```typescript
await window.electronAPI.note.load('note-123');
```

#### `note:unload`

Unload a note from memory when no windows have it open (decrements ref count).

**Parameters:**

- `noteId: string` - Note ID

**Returns:** `Promise<void>`

**Usage:**

```typescript
await window.electronAPI.note.unload('note-123');
```

#### `note:applyUpdate`

Apply a Yjs update to a note's CRDT document.

**Parameters:**

- `noteId: string` - Note ID
- `update: Uint8Array` - Yjs update bytes

**Returns:** `Promise<void>`

**Usage:**

```typescript
const update = Y.encodeStateAsUpdate(doc);
await window.electronAPI.note.applyUpdate('note-123', update);
```

#### `note:create`

Create a new note in the specified sync directory and folder.

**Parameters:**

- `sdId: string` - Sync directory ID
- `folderId: string` - Parent folder ID
- `initialContent: string` - Initial note content

**Returns:** `Promise<string>` - New note ID

**Usage:**

```typescript
const noteId = await window.electronAPI.note.create('sd-1', 'folder-inbox', 'Hello World');
```

#### `note:delete`

Mark a note as deleted in the CRDT (soft delete).

**Parameters:**

- `noteId: string` - Note ID

**Returns:** `Promise<void>`

**Usage:**

```typescript
await window.electronAPI.note.delete('note-123');
```

#### `note:move`

Move a note to a different folder.

**Parameters:**

- `noteId: string` - Note ID
- `newFolderId: string` - New parent folder ID

**Returns:** `Promise<void>`

**Usage:**

```typescript
await window.electronAPI.note.move('note-123', 'folder-work');
```

#### `note:getMetadata`

Get note metadata from SQLite cache.

**Parameters:**

- `noteId: string` - Note ID

**Returns:** `Promise<NoteMetadata>`

```typescript
interface NoteMetadata {
  noteId: string;
  title: string;
  folderId: string;
  createdAt: number;
  modifiedAt: number;
}
```

**Usage:**

```typescript
const metadata = await window.electronAPI.note.getMetadata('note-123');
console.log(metadata.title);
```

### Folder Operations

#### `folder:create`

Create a new folder in the specified sync directory.

**Parameters:**

- `sdId: string` - Sync directory ID
- `parentId: string` - Parent folder ID (or root ID)
- `name: string` - Folder name

**Returns:** `Promise<string>` - New folder ID

**Usage:**

```typescript
const folderId = await window.electronAPI.folder.create('sd-1', 'root', 'Work Projects');
```

#### `folder:delete`

Delete a folder (soft delete in CRDT).

**Parameters:**

- `folderId: string` - Folder ID

**Returns:** `Promise<void>`

**Usage:**

```typescript
await window.electronAPI.folder.delete('folder-old');
```

## Events (Main → Renderer)

Events are received by registering listeners using `window.electronAPI.<namespace>.on<EventName>()`.

### Note Events

#### `note:updated`

Fired when a note's CRDT is updated (from local or remote changes).

**Payload:**

- `noteId: string` - Note ID
- `update: Uint8Array` - Yjs update bytes

**Usage:**

```typescript
const cleanup = window.electronAPI.note.onUpdated((noteId, update) => {
  if (noteId === currentNoteId) {
    Y.applyUpdate(localDoc, update);
  }
});

// Later: cleanup when component unmounts
cleanup();
```

#### `note:deleted`

Fired when a note is deleted.

**Payload:**

- `noteId: string` - Note ID

**Usage:**

```typescript
const cleanup = window.electronAPI.note.onDeleted((noteId) => {
  // Close note if currently open
  if (noteId === currentNoteId) {
    closeNote();
  }
});
```

### Folder Events

#### `folder:updated`

Fired when the folder structure changes.

**Payload:**

- `folderId: string` - Folder ID (or 'root' for entire tree)

**Usage:**

```typescript
const cleanup = window.electronAPI.folder.onUpdated((folderId) => {
  // Refresh folder tree
  refreshFolderTree();
});
```

### Sync Events

#### `sync:progress`

Fired during initial SD indexing to show progress.

**Payload:**

- `sdId: string` - Sync directory ID
- `progress: SyncProgress`

```typescript
interface SyncProgress {
  sdId: string;
  totalFiles: number;
  processedFiles: number;
  phase: 'scanning' | 'indexing' | 'complete';
}
```

**Usage:**

```typescript
const cleanup = window.electronAPI.sync.onProgress((sdId, progress) => {
  updateProgressBar(progress.processedFiles / progress.totalFiles);

  if (progress.phase === 'complete') {
    showNotification('Sync directory indexed');
  }
});
```

## Error Handling

All IPC commands return Promises that reject with an Error if the operation fails:

```typescript
try {
  await window.electronAPI.note.load('note-123');
} catch (error) {
  console.error('Failed to load note:', error);
  showErrorToast(error.message);
}
```

## Security Considerations

- The preload script uses `contextBridge` to safely expose IPC methods
- Renderer processes cannot directly access Node.js APIs
- All IPC communication goes through the preload script
- Update bytes are transferred as Uint8Array (binary data)

## Implementation Notes

### Document Lifecycle

1. **Load**: Renderer calls `note:load` → Main loads all updates from disk → Creates in-memory Yjs doc
2. **Edit**: Renderer generates update → Calls `note:applyUpdate` → Main applies to doc and writes to disk
3. **Sync**: File watcher detects remote update → Main applies to doc → Broadcasts `note:updated` event
4. **Unload**: Renderer calls `note:unload` → Main decrements ref count → Destroys doc if ref count = 0

### Reference Counting

The main process maintains a reference count for each loaded note. Multiple renderer windows can have the same note open simultaneously:

- `note:load` increments ref count
- `note:unload` decrements ref count
- Document is only destroyed when ref count reaches 0

### Event Broadcasting

All events are broadcast to all renderer windows. It's the renderer's responsibility to filter events by note/folder ID if needed.

## Future Enhancements

Planned additions to the IPC protocol:

- `note:pack` - Compact a note's update files
- `sd:add` - Add a new sync directory
- `sd:remove` - Remove a sync directory
- `search:query` - Full-text search
- `tag:add` - Add tag to note
- `tag:remove` - Remove tag from note
