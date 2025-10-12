# NoteCove

![NoteCove Logo](docs/assets/logo-banner.png)

A cross-platform notes application designed to be like Apple Notes but with advanced organization, collaboration, and power-user features. NoteCove works offline-first and syncs via shared file systems without requiring internet servers.

## 🚀 Features

- **Cross-Platform**: Desktop (Electron) + iOS native apps
- **Offline-First**: Full functionality without internet connection
- **File-Based Sync**: Sync via Dropbox, Google Drive, iCloud, or any shared folder
- **Rich Text Editing**: Powered by TipTap with support for formatting, tables, and more
- **Advanced Organization**: Folders, tags, and inter-note linking
- **Conflict-Free Sync**: CRDT-based synchronization prevents data loss
- **Power User Features**: Scripting API, templates, and extensibility

## 🏗️ Project Status

**Current Phase**: Phase 1 - Project Foundation
- ✅ Basic project structure
- ✅ Electron app skeleton
- 🚧 Basic text editor (in progress)
- ⏳ File-based storage
- ⏳ iOS app foundation

## 🛠️ Development

### Prerequisites

- Node.js 18+ and npm 9+
- For iOS development: Xcode 15+ and iOS 17+ SDK

### Local Development

```bash
# Clone the repository
git clone https://github.com/drewcsillag/notecove.git
cd notecove

# Install dependencies
npm install

# Start desktop app in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Project Structure

```
notecove/
├── desktop/          # Electron desktop app
├── ios/             # iOS native app (SwiftUI)
├── website/         # Static website and documentation
├── shared/          # Shared utilities and schemas
├── docs/           # Documentation and assets
└── plan.txt        # Implementation roadmap
```

### Desktop App Development

```bash
cd desktop

# Development with hot reload
npm run dev

# Run tests
npm test

# Run end-to-end tests
npm run test:e2e

# Build for current platform
npm run build:dist
```

### Testing

- **Unit Tests**: Jest/Vitest for core logic
- **E2E Tests**: Playwright for desktop app testing
- **iOS Tests**: XCTest for iOS-specific functionality

## 📋 Logo Options

### Concept 1: "Protected Harbor"
- Stylized cove/bay silhouette with document icon inside
- Colors: Deep blue (#1B365D) + warm gold (#F4A460)
- Feel: Safe, professional, trustworthy

### Concept 2: "Digital Sanctuary"
- Abstract "N" and "C" letterforms creating protective enclosure
- Colors: Forest green (#2D5840) + light gray (#F8F9FA)
- Feel: Natural, calm, organized

### Concept 3: "Note Layers"
- Stacked document icons with curved edge suggesting a cove
- Colors: Gradient blue-to-teal (#3B82F6 to #06B6D4)
- Feel: Dynamic, layered, structured

### Concept 4: "Minimalist Mark"
- Simple "NC" monogram in custom rounded typeface
- Colors: Charcoal (#374151) with accent color options
- Feel: Professional, timeless, software-focused

### Concept 5: "Flowing Notes"
- Abstract flowing lines forming both "cove" shape and text flow
- Colors: Warm purple (#8B5CF6) + soft white (#FEFEFE)
- Feel: Creative, fluid, thoughtful

**Current Selection**: Concept 1 "Protected Harbor" for main logo, Concept 4 for app icons

## 🤝 Contributing

This is currently a personal project in early development. Contributions, suggestions, and feedback are welcome! Please see the [implementation plan](plan.txt) for current priorities.

## 📄 License

Licensed under the [Apache License 2.0](LICENSE).

## 🔗 Links

- **Website**: https://notecove.github.io
- **Repository**: https://github.com/drewcsillag/notecove
- **Issues**: https://github.com/drewcsillag/notecove/issues

---

Built with ❤️ for the note-taking community.