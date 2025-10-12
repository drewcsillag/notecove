# NoteCove

![NoteCove Logo](docs/assets/logos/concept-2-main.svg)

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

## 🎨 Brand & Design

**Main Logo**: "Digital Sanctuary" - N and C letterforms creating a protective enclosure
**App Icon**: "Minimalist Mark" - Clean NC monogram
**Colors**: Forest green (#2D5840) with charcoal accents (#374151)

View all logo concepts and assets in [`docs/assets/logos/`](docs/assets/logos/)

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