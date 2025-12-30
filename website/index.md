---
layout: home

hero:
  name: NoteCove
  text: Your notes, everywhere
  tagline: Cross-platform notes with offline-first CRDT synchronization. Like Apple Notes, but better.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/notecove/notecove

features:
  - icon: 🔄
    title: Offline-First Sync
    details: Work completely offline. Your notes sync automatically via Dropbox, Google Drive, or iCloud when connected. No internet servers required.

  - icon: ⚡
    title: Conflict-Free Editing
    details: Edit the same note on multiple devices simultaneously. Built with Yjs CRDTs for seamless, conflict-free synchronization.

  - icon: 🎨
    title: Rich Text Editing
    details: Powerful TipTap editor with formatting, lists, code blocks, and more. Express yourself with the tools you need.

  - icon: 📁
    title: Smart Organization
    details: Folders, tags, inter-note links, and full-text search. Organize your way with flexible, powerful tools.

  - icon: 🖥️
    title: Cross-Platform
    details: Native apps for desktop (Electron) and iOS (Swift). Your notes follow you on every device.

  - icon: 🔒
    title: Your Data, Your Control
    details: All data stored locally in SQLite. Sync via your own cloud storage. No third-party servers accessing your notes.
---

## Why NoteCove?

NoteCove combines the simplicity of Apple Notes with the power and flexibility demanded by power users:

- **True Offline-First**: Unlike cloud-based solutions, NoteCove works perfectly offline and syncs through your existing cloud storage
- **No Vendor Lock-In**: Your notes are stored in open formats on your own storage
- **Privacy First**: No third-party servers, no analytics, no tracking
- **Multi-Device**: Seamless single-user multi-device experience with robust CRDT-based sync
- **Open Source**: Apache 2.0 licensed, community-driven development

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the desktop app
pnpm --filter @notecove/desktop dev
```

[Learn more in the Getting Started guide](/guide/getting-started)

## Current Status

🚧 **In Active Development** - Core features are being implemented incrementally.

### What's Working

✅ Multi-window real-time sync
✅ CRDT synchronization with Yjs
✅ Rich text editing with TipTap
✅ Images, tables, and code blocks
✅ Folder and tag organization
✅ Inter-note links
✅ Threaded comments
✅ Full-text search (FTS5)
✅ Import/export markdown
✅ Dark mode
✅ Profiles with privacy modes (Local, Cloud, Paranoid, Custom)

### Coming Soon

📱 iOS app implementation

## License

Apache License 2.0 - See [LICENSE](https://github.com/notecove/notecove/blob/main/LICENSE) for details.
