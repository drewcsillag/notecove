# Architecture Overview

NoteCove is built with a modern, offline-first architecture designed for reliability, performance, and cross-platform compatibility.

## System Architecture

```
┌─────────────────────────────────────────────┐
│              User Interface                 │
│         (React + Material-UI)              │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│           Main Process                      │
│         (Electron IPC)                      │
└──────┬──────────────┬───────────────────────┘
       │              │
┌──────▼──────┐  ┌───▼────────────────────────┐
│   SQLite    │  │   CRDT Engine (Yjs)        │
│   Database  │  │   - Document management     │
│   - FTS5    │  │   - Sync coordination       │
│   - Metadata│  │   - Conflict resolution     │
└──────┬──────┘  └───┬────────────────────────┘
       │              │
       │         ┌────▼─────────────────────────┐
       │         │   File System Sync           │
       │         │   - Watch sync folder        │
       └─────────┤   - Read/write CRDT updates  │
                 │   - Cloud storage integration │
                 └──────────────────────────────┘
```

## Core Components

### Frontend Layer

**Technology:**

- **React**: UI component framework
- **Material-UI**: Component library
- **TipTap**: Rich text editor
- **Vite**: Build tool

**Responsibilities:**

- Render user interface
- Handle user interactions
- Display note content
- Manage UI state

[Learn more about the tech stack →](/architecture/tech-stack)

### Main Process (Electron)

**Technology:**

- **Electron**: Cross-platform desktop framework
- **TypeScript**: Type-safe development
- **IPC**: Inter-process communication

**Responsibilities:**

- Window management
- System integration
- IPC message routing
- Resource management

### CRDT Engine

**Technology:**

- **Yjs**: CRDT implementation
- **Y-prosemirror**: ProseMirror binding
- **IndexedDB**: Browser-side storage (future)

**Responsibilities:**

- Document state management
- Change tracking
- Conflict-free merging
- Update generation

[Learn more about CRDT sync →](/architecture/crdt-sync)

### Storage Layer

**Technology:**

- **better-sqlite3**: SQLite bindings
- **FTS5**: Full-text search extension
- **File system**: CRDT update storage

**Responsibilities:**

- Note metadata storage
- Search index management
- Update file I/O
- Database transactions

[Learn more about storage →](/architecture/storage)

## Data Flow

### Creating a Note

```
User creates note
     ↓
React UI captures input
     ↓
IPC message to main process
     ↓
Create Yjs document
     ↓
Insert into SQLite
     ↓
Return note ID to UI
     ↓
Update UI state
```

### Editing a Note

```
User types in editor
     ↓
TipTap captures change
     ↓
Yjs generates CRDT update
     ↓
IPC: Send update to main
     ↓
Apply update to Yjs doc
     ↓
Write update to sync folder
     ↓
Update SQLite metadata
     ↓
Broadcast to other windows
```

### Syncing Between Devices

```
Device A edits note
     ↓
CRDT update written to sync folder
     ↓
Cloud storage syncs file
     ↓
Device B detects new file
     ↓
Read CRDT update
     ↓
Apply to local Yjs document
     ↓
Update SQLite
     ↓
Notify UI of change
     ↓
UI re-renders note
```

## Design Principles

### Offline-First

Everything works without internet:

- All data stored locally
- Full feature set offline
- Sync when connection available

**Benefits:**

- Reliability
- Performance
- Privacy

[Learn more about offline sync →](/features/offline-sync)

### CRDT-Based Sync

Conflict-free synchronization:

- No manual conflict resolution
- All edits preserved
- Guaranteed convergence

**Benefits:**

- Multi-device editing
- Real-time collaboration
- Robust merge semantics

### File-Based Storage

Sync via cloud file systems:

- No proprietary servers
- User owns their data
- Standard file formats

**Benefits:**

- Privacy
- Portability
- No vendor lock-in

### Event-Driven Architecture

Reactive to changes:

- File system watching
- IPC events
- State subscriptions

**Benefits:**

- Real-time updates
- Efficient resource use
- Loose coupling

## Multi-Process Architecture

### Main Process

**Runs in Node.js:**

- Full Node.js API access
- File system operations
- SQLite database
- Window management

**Single instance:**

- One main process per app
- Manages all windows
- Shared state coordination

### Renderer Process

**Runs in Chromium:**

- Web technologies (HTML/CSS/JS)
- React rendering
- TipTap editor
- Limited Node.js access (via IPC)

**Multiple instances:**

- One per window
- Isolated state
- IPC for communication

### IPC Communication

**Bidirectional messaging:**

```typescript
// Renderer → Main
ipcRenderer.invoke('createNote', { title, content });

// Main → Renderer
mainWindow.webContents.send('noteUpdated', { noteId, update });
```

**Benefits:**

- Security isolation
- Type-safe messaging
- Async operations

## Cross-Platform Support

### Desktop

**Electron enables:**

- Single codebase
- Native installers
- System integration
- Auto-updates

**Supported platforms:**

- macOS (10.13+)
- Windows (10+)
- Linux (Ubuntu 18.04+)

### iOS (Coming Soon)

**Native Swift:**

- SwiftUI for UI
- JavaScriptCore for CRDT
- WKWebView for editor
- CloudKit for sync

**Shared logic:**

- CRDT engine (TypeScript)
- Sync protocol
- Data formats

## Performance Considerations

### Fast Startup

**Optimizations:**

- Lazy load notes
- Cache metadata
- Incremental rendering
- Background indexing

**Metrics:**

- Cold start: < 2s
- Window open: < 500ms
- Note load: < 100ms

### Efficient Sync

**Optimizations:**

- Incremental updates
- Compression
- Deduplication
- Batch processing

**Metrics:**

- Sync latency: < 5s
- Update size: ~1-10 KB
- CPU usage: < 5%

### Large Documents

**Optimizations:**

- Virtual scrolling
- Lazy loading
- Efficient CRDT operations
- Streaming updates

**Supported:**

- 100,000+ words per note
- 10,000+ notes total
- Real-time editing

## Security

### Data Protection

**Local storage:**

- File permissions
- Database encryption (optional)
- Secure key storage

**Sync:**

- Cloud provider encryption
- HTTPS transfers
- No third-party access

### Code Safety

**Best practices:**

- Input validation
- SQL parameterization
- Content Security Policy
- Sandboxed renderers

## Scalability

### Vertical Scaling

Handle more data per device:

- Efficient indexing
- Incremental operations
- Lazy loading
- Database optimization

### Horizontal Scaling

Support more devices:

- CRDT convergence
- Efficient sync
- Conflict-free merging
- No central coordination

## Future Architecture

### Planned Improvements

**P2P Sync:**

- Direct device communication
- WebRTC data channels
- No cloud dependency

**End-to-End Encryption:**

- Encrypt before cloud upload
- Zero-knowledge architecture
- Client-side key management

**Plugin System:**

- Extend functionality
- Custom editors
- Third-party integrations

**Mobile Apps:**

- Native iOS (Swift)
- Native Android (Kotlin)
- Shared CRDT logic

## Next Steps

- [Learn about CRDT synchronization](/architecture/crdt-sync)
- [Understand storage layer](/architecture/storage)
- [Explore tech stack](/architecture/tech-stack)
- [View TLA+ formal specification](/architecture/tla-spec)
