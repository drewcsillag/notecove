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

[Learn more about sync mechanism →](/architecture/sync-mechanism)

### 🎨 Rich Text Editing

Express yourself with powerful formatting tools:

- **TipTap editor** with extensive formatting options
- Headings, lists, code blocks, and tables
- Markdown shortcuts for fast typing
- Syntax highlighting for code
- Full image support with drag-and-drop

[Learn more about rich text editing →](/features/rich-text-editing)

### 🔗 Link Unfurling

Paste URLs and see rich previews instantly:

- **300+ providers** including YouTube, Twitter, GitHub, and more
- Automatic thumbnail, title, and description extraction
- Interactive preview cards with copy and refresh actions
- Smart caching for fast performance

[Learn more about link unfurling →](/features/link-unfurling)

### 🖼️ Images

Add images to your notes with ease:

- **Drag and drop**: Drop images directly into the editor
- **Paste from clipboard**: Paste screenshots and copied images
- **Thumbnails**: Automatic thumbnail generation for fast loading
- **Lightbox**: Click to view full-size images
- **Text wrapping**: Wrap text around images

### 📊 Tables

Create structured data in your notes:

- **Easy creation**: Insert tables from the toolbar
- **Headers**: Toggle header rows for clarity
- **Keyboard navigation**: Tab through cells efficiently
- **Column resizing**: Drag to adjust column widths
- **Cell alignment**: Left, center, or right align content
- **Markdown export**: Tables export cleanly to markdown

### 💬 Comments

Add threaded discussions to your notes:

- **Google Docs-style**: Select text and add comments
- **Threaded replies**: Have conversations in context
- **Emoji reactions**: Quick feedback with reactions
- **Mentions**: Tag notes and concepts

[Learn more about comments →](/features/collaboration)

### 📁 Smart Organization

Organize notes your way:

- **Folders**: Hierarchical organization with drag-and-drop
- **Tags**: Flexible cross-cutting categorization with filtering
- **Inter-note links**: Connect related notes with wiki-style links
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

### 👤 Profiles & Privacy Modes

Separate note collections with different privacy levels:

- **Multiple profiles**: Work, personal, research - each with its own notes
- **Privacy modes**: Choose Local, Cloud, Paranoid, or Custom
- **Paranoid mode**: Maximum privacy with all network features disabled
- **Cloud mode**: Start with synced storage from day one

[Learn more about profiles →](/features/profiles)

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

### 🌙 Dark Mode

Comfortable viewing in any lighting:

- Toggle between light and dark themes
- Syncs across all open windows
- Respects system preferences

### 📥 Import Markdown

Bring your notes from other apps:

- **Import files or folders**: Single files or entire note hierarchies
- **Preserve structure**: Keep your folder organization
- **Image support**: Local images are automatically copied
- **Inter-note links**: Links to `.md` files are converted automatically
- **Migration ready**: Import from Obsidian, Bear, Notion, and more

[Learn more about importing →](/features/import-export)

## Coming Soon

### Templates

Reusable note templates:

- Create custom templates
- Quick note creation
- Variable substitution
- Template library

### Mobile Apps

Native mobile experience:

- iOS app with SwiftUI (coming soon)
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
| Tables           | ✅       | ✅             | ✅     | Plugin   |
| Images           | ✅       | ✅             | ✅     | ✅       |
| Comments         | ✅       | ❌             | ✅     | ❌       |
| Link Unfurling   | ✅       | ❌             | ✅     | Plugin   |
| Privacy Modes    | ✅       | ❌             | ❌     | ❌       |
| Open Source      | ✅       | ❌             | ❌     | ❌       |
| File-Based Sync  | ✅       | ❌             | ❌     | ✅       |

## Next Steps

- [Get started with NoteCove](/guide/getting-started)
- [Learn about the architecture](/architecture/)
- [Contribute to NoteCove](https://github.com/notecove/notecove)
