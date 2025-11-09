# Features Overview

NoteCove combines simplicity with powerful features designed for both casual users and power users.

## Core Features

### 🔄 Offline-First Sync

Work anywhere, anytime. NoteCove is designed to work perfectly offline:

- All notes stored locally in SQLite
- Full functionality without internet
- Automatic sync when connection is restored
- No cloud servers required

[Learn more about offline sync →](/features/offline-sync)

### ⚡ Conflict-Free Synchronization

Edit the same note on multiple devices simultaneously:

- Powered by Yjs CRDTs (Conflict-free Replicated Data Types)
- All edits preserved and merged automatically
- No "last write wins" - true collaborative editing
- Mathematically guaranteed convergence

[Learn more about CRDT sync →](/architecture/crdt-sync)

### 🎨 Rich Text Editing

Express yourself with powerful formatting tools:

- **TipTap editor** with extensive formatting options
- Headings, lists, code blocks, tables
- Markdown shortcuts for fast typing
- Syntax highlighting for code
- Image support (coming soon)

[Learn more about rich text editing →](/features/rich-text-editing)

### 📁 Smart Organization

Organize notes your way:

- **Folders**: Hierarchical organization with drag-and-drop
- **Tags**: Flexible cross-cutting categorization (coming soon)
- **Inter-note links**: Connect related notes (coming soon)
- **Full-text search**: Find anything instantly with SQLite FTS5

[Learn more about organization →](/features/folders-organization)

### 🖥️ Cross-Platform

Native apps for every device:

- **Desktop**: Electron app for macOS, Windows, Linux
- **iOS**: Native Swift app (coming soon)
- Consistent experience across all platforms
- Platform-specific optimizations

### 🔒 Privacy & Control

Your data, your rules:

- All data stored locally
- No third-party servers
- No telemetry or tracking
- Sync via your own cloud storage (Dropbox, Google Drive, iCloud)
- Open source (Apache 2.0 license)

## Advanced Features

### Multi-Window Support

Open multiple windows to view different notes side-by-side. Perfect for research and reference materials.

### Real-Time Collaboration

Multiple windows of the same app instance see changes in real-time. CRDT-based sync ensures consistency.

### Full-Text Search

Lightning-fast search powered by SQLite FTS5:

- Search across all note content
- Filter by folder, tags, dates
- Fuzzy matching
- Instant results

[Learn more about search →](/features/search)

### Activity Logging

Monitor sync activity and debug issues:

- View all sync operations
- Track update propagation
- Diagnose sync problems
- Export logs for support

## Coming Soon

### Tags

Flexible tagging system:

- Multiple tags per note
- Tag hierarchy
- Tag filtering and search
- Tag-based organization

### Inter-Note Links

Connect your knowledge:

- `[[Note Title]]` syntax for linking
- Backlinks panel
- Graph view of connections
- Orphaned note detection

### Templates

Reusable note templates:

- Create custom templates
- Quick note creation
- Variable substitution
- Template library

### Export & Import

Take your data anywhere:

- Export to Markdown, HTML, PDF
- Import from other note apps
- Bulk export/import
- Preserve formatting

### Mobile Apps

Native mobile experience:

- iOS app with SwiftUI
- Android app (planned)
- Full offline support
- Touch-optimized interface

## Feature Comparison

| Feature          | NoteCove | Apple Notes    | Notion | Obsidian |
| ---------------- | -------- | -------------- | ------ | -------- |
| Offline-First    | ✅       | ✅             | ❌     | ✅       |
| CRDT Sync        | ✅       | ?              | ❌     | ❌       |
| Cross-Platform   | ✅       | macOS/iOS only | ✅     | ✅       |
| No Cloud Servers | ✅       | ❌             | ❌     | ✅       |
| Rich Text        | ✅       | ✅             | ✅     | Markdown |
| Open Source      | ✅       | ❌             | ❌     | ❌       |
| File-Based Sync  | ✅       | ❌             | ❌     | ✅       |

## Next Steps

- [Get started with NoteCove](/guide/getting-started)
- [Learn about the architecture](/architecture/)
- [Contribute to NoteCove](https://github.com/notecove/notecove)
