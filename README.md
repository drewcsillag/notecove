# NoteCove

A cross-platform notes application with offline-first architecture and file-based CRDT synchronization.

## Overview

NoteCove is designed to be like Apple Notes but with advanced organization and power-user features. The app works offline-first and syncs via shared file systems (Dropbox, Google Drive, iCloud) without requiring internet servers.

## Features

- **Cross-Platform**: Desktop (Electron) and iOS (native Swift) apps
- **Offline-First**: Works completely offline, syncs when connected
- **CRDT Synchronization**: Conflict-free sync using Yjs
- **Rich Text Editing**: TipTap editor with extensive formatting options
- **Organization**: Folders, tags, inter-note links, search
- **Multi-Device**: Single-user multi-device experience with robust sync

## Tech Stack

- **Desktop**: Electron + TypeScript + React + TipTap + Yjs + Material-UI
- **iOS**: Swift + SwiftUI (with JavaScriptCore for CRDT, WKWebView for editor)
- **Build System**: Turborepo + pnpm workspaces + Vite
- **Database**: SQLite (better-sqlite3) with FTS5
- **Testing**: Jest + Playwright (desktop), XCTest (iOS)

## Project Structure

```
nc2/
├── packages/
│   ├── desktop/      # Electron desktop app
│   ├── ios/          # iOS native app
│   ├── shared/       # Shared TypeScript CRDT logic
│   └── website/      # Documentation website
├── tools/            # Build tools and scripts
├── docs/             # Design documentation
└── PLAN.md          # Implementation plan
```

## Documentation

- [Investigating Note Corruption](./docs/investigating-note-corruption.md) - Guide for diagnosing and recovering from corrupted or missing note content

## Development

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- For iOS: Xcode and iOS SDK

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run local CI (before committing)
pnpm ci-local
```

### Development Workflow

1. Work on feature branches: `feature/<name>`
2. Run `pnpm ci-local` before merging to main
3. Merge only after CI passes and code review

## License

Apache License 2.0 - See [LICENSE](./LICENSE) for details.

## Current Status

🚧 **In Active Development** - Core features are being implemented incrementally.

### What's Working

✅ **Multi-Window Sync** - Real-time collaboration between multiple windows in the same app instance
✅ **Note Persistence** - Notes persist across app restarts and windows
✅ **CRDT Synchronization** - Yjs-based conflict-free note editing
✅ **Rich Text Editing** - TipTap editor with formatting toolbar
✅ **Folder Management** - Create, rename, delete, and organize folders
✅ **SQLite Caching** - Fast note metadata lookup with FTS5 search
✅ **Activity Logging** - Infrastructure for cross-instance sync

### In Progress

🔄 **Cross-Instance Sync** - Currently only first change replicates between separate app instances
🔄 **Note Selection** - UI for selecting and switching between notes
🔄 **Search** - Full-text search across note content

### Next Up

📋 Fix cross-instance synchronization (activity sync mechanism)
📋 Note list panel with search and filtering
📋 Tags and inter-note links
📋 iOS app implementation

See [PLAN.md](./PLAN.md) for detailed implementation plan and progress tracking.

# Why Trust NoteCove?

My (Drew's) history is that I've worked at Google in Google Apps. I helped contribute to Spreadsheets and Docs during my time on the Apps Script team.
I also worked at Dropbox on the Paper Infra team where there was more details around working on the backends of these systems. For those who don't know what this means:
both dealt with production quality multiplayer editors at scale. Unrelated they also may be the only places I think the Rhino javascript
engine was used in production products.

Extensive sync testing. There are extensive tests with two independent instances using "sloppy sync" to replicate the syncing behaviors seen with things like iCloud drive,
Google Drive, etc. Specifically replicating files out of order, incomplete replication, and so on to ensure that the state of notecove on both sides converges.

Validated TLA+ model. Just to be double sure that there aren't any sync bugs in the design, there's a TLA+ formal verification model that has been checked. Ironically, there
was a bug discovered in the model, but the code actually handled it.
