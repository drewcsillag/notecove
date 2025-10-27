# NoteCove Desktop

The Electron desktop application for NoteCove - a CRDT-based notes app with real-time multi-window collaboration.

## Features

### ✅ Currently Working

- **Multi-Window Collaboration**: Open multiple windows and see edits sync in real-time
- **Note Persistence**: Notes persist across app restarts using CRDT update files
- **Rich Text Editing**: TipTap editor with formatting toolbar (bold, italic, underline, headings, lists, code blocks)
- **Folder Management**: Create, rename, delete, and move folders with drag-and-drop
- **SQLite Caching**: Fast note metadata and folder structure lookups
- **Activity Logging**: Infrastructure for cross-instance synchronization

### 🔄 In Progress

- **Cross-Instance Sync**: Currently only first change replicates between separate app instances
- **Note Selection UI**: Selecting and switching between notes in the UI
- **Full-Text Search**: Search across all note content

## Architecture

The desktop app uses a three-layer architecture:

1. **Main Process** (Node.js)
   - CRDT document management (Yjs)
   - File-based storage and sync
   - SQLite database for caching
   - Activity logging for cross-instance sync

2. **Preload Layer** (Secure Bridge)
   - IPC communication between renderer and main
   - Exposes safe APIs to renderer via contextBridge

3. **Renderer Process** (React)
   - TipTap editor with Yjs collaboration
   - Material-UI components
   - Folder tree with drag-and-drop
   - Three-panel layout (folders, notes list, editor)

## Development

To run the desktop app in development mode:

```bash
# From the workspace root
pnpm dev

# Or from the desktop package directory
cd packages/desktop
pnpm dev
```

This will:

1. Build the main and preload processes
2. Start the Vite dev server for the renderer process
3. Launch the Electron app with hot module replacement

**Note:** On first run, you may need to manually install the Electron binary:

```bash
node /Users/drew/devel/nc2/node_modules/.pnpm/electron@28.3.3/node_modules/electron/install.js
```

## Testing

### Unit Tests

Run the unit test suite (React components):

```bash
pnpm test

# With coverage
pnpm test:coverage
```

### E2E Tests

Run the end-to-end tests (launches actual Electron app):

```bash
pnpm test:e2e

# With UI mode for debugging
pnpm test:e2e:ui

# With step-by-step debugging
pnpm test:e2e:debug
```

**Note:** E2E tests require the app to be built first. Run `pnpm build` before running E2E tests.

## Building

Build the application for production:

```bash
pnpm build
```

## Project Structure

```
packages/desktop/
├── src/
│   ├── main/               # Electron main process (Node.js)
│   │   ├── crdt/          # CRDT document management
│   │   │   ├── crdt-manager.ts   # In-memory Yjs document management
│   │   │   └── types.ts          # CRDT type definitions
│   │   ├── database/      # SQLite caching layer
│   │   │   ├── adapter.ts        # better-sqlite3 adapter
│   │   │   └── database.ts       # Database operations
│   │   ├── ipc/           # IPC communication
│   │   │   ├── handlers.ts       # IPC request handlers
│   │   │   └── types.ts          # IPC type definitions
│   │   ├── storage/       # File system operations
│   │   │   ├── node-fs-adapter.ts   # File system adapter
│   │   │   └── node-file-watcher.ts # File watching for sync
│   │   └── index.ts       # Main process entry point
│   │
│   ├── preload/           # Preload scripts (secure IPC bridge)
│   │   └── index.ts       # contextBridge API exposure
│   │
│   └── renderer/          # React UI application
│       ├── src/
│       │   ├── components/
│       │   │   ├── EditorPanel/      # TipTap editor
│       │   │   ├── FolderPanel/      # Folder tree
│       │   │   ├── NotesListPanel/   # Notes list
│       │   │   └── Layout/           # Three-panel layout
│       │   ├── i18n/                 # Internationalization
│       │   └── __tests__/            # Component tests
│       └── index.html
│
├── e2e/                   # End-to-end tests (Playwright)
│   ├── app.spec.ts               # Basic app tests
│   ├── folders.spec.ts           # Folder management tests
│   ├── note-sync.spec.ts         # Multi-window sync tests
│   └── collaboration.spec.ts     # Cross-instance sync tests
│
└── dist-electron/         # Build output (generated)
    ├── main/
    ├── preload/
    └── renderer/
```

## CRDT Synchronization

NoteCove uses Yjs CRDTs for conflict-free synchronization:

- **In-Memory Documents**: Main process maintains Yjs documents for all open notes
- **Update Files**: Each edit generates a CRDT update saved to disk as `.yjson` file
- **Multi-Window Sync**: Updates broadcast via IPC to all renderer windows
- **Cross-Instance Sync**: Activity logger tracks edits, file watcher detects changes
- **Persistence**: Notes load by applying all update files on startup

## Technology Stack

- **Electron** - Desktop application framework
- **React** - UI library with hooks
- **TypeScript** - Type-safe JavaScript
- **Material-UI (MUI)** - Component library and theming
- **TipTap** - Rich text editor built on ProseMirror
- **Yjs** - CRDT implementation for conflict-free sync
- **better-sqlite3** - SQLite with FTS5 for caching and search
- **Vite** - Build tool and dev server with HMR
- **Jest** - Unit testing framework
- **Playwright** - E2E testing with Electron support
- **@minoru/react-dnd-treeview** - Drag-and-drop folder tree
