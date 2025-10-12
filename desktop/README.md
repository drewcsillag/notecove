# NoteCove Desktop

Electron-based desktop application for NoteCove.

## Features

- ✅ Rich text editing with TipTap
- ✅ File-based note storage
- ✅ Automatic title extraction from first line
- ✅ Real-time note search
- ✅ Folder organization
- ✅ Auto-save functionality
- ✅ Cross-platform (macOS, Windows, Linux)

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build main process
npm run build:main

# Build renderer process
npm run build:renderer

# Build for production
npm run build:dist
```

## Testing

### Test Data Isolation

All tests use a separate `.test-data/` directory that is automatically:
- Created before each test run
- Cleaned up after each test run
- Excluded from version control

This ensures:
- Your actual notes are never modified by tests
- Tests are repeatable and deterministic
- You can safely run destructive tests on the notes database
- Easy regression test creation

### Unit Tests (Vitest)

```bash
# Run in watch mode
npm test

# Run once
npm test -- --run

# Run with coverage
npm test -- --coverage
```

**Test Files:**
- `src/lib/utils.test.js` - Utility function tests (12 tests)
- `src/lib/note-manager.test.js` - Note CRUD operations (17 tests)
- `src/lib/folder-manager.test.js` - Folder management (33 tests)
- `src/renderer.test.js` - Renderer logic tests (4 tests)

**Total: 66 unit tests**

### E2E Tests (Playwright)

```bash
# First time: Install browsers
npx playwright install

# Run E2E tests
npm run test:e2e

# Run E2E tests in UI mode
npx playwright test --ui

# View test report
npx playwright show-report
```

**Test Files:**
- `tests/e2e/basic.spec.js` - Basic user workflows (5 tests)
- `tests/e2e/folders.spec.js` - Folder UI and operations (11 tests)

**Total: 16 E2E tests**

### Linting

```bash
# Run ESLint
npm run lint

# Auto-fix issues
npm run lint:fix
```

## Project Structure

```
desktop/
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # Preload script
│   ├── renderer.js          # Renderer process entry
│   └── lib/
│       ├── editor.js        # TipTap editor wrapper
│       ├── note-manager.js  # Note CRUD operations
│       ├── file-storage.js  # File system operations
│       ├── folder-manager.js # Folder management
│       └── utils.js         # Utility functions
├── tests/
│   └── e2e/
│       └── basic.spec.js    # End-to-end tests
├── dist/                    # Built files (gitignored)
├── index.html               # App HTML
├── package.json
├── vitest.config.js         # Vitest configuration
└── playwright.config.js     # Playwright configuration
```

## Architecture

### Main Process (`main.js`)
- Window management
- IPC handlers for file operations
- Settings persistence with electron-store
- Menu configuration

### Renderer Process (`renderer.js`)
- UI state management
- Editor integration
- Note list rendering
- Search functionality

### Key Design Decisions

1. **Title from First Line**: The note title is automatically derived from the first line of content, eliminating the need for a separate title field
2. **Debounced Updates**: Editor updates are debounced (1000ms) to reduce flickering in the notes list
3. **File-based Storage**: Each note is stored as a JSON file for easy syncing via Dropbox/iCloud
4. **CRDT-ready**: Structure supports future CRDT integration for conflict-free sync

## Configuration

### Vite (Renderer Process)
- Dev server on port 5173
- Hot module replacement
- ES modules

### esbuild (Main Process)
- Bundles main.js and preload.js
- External: electron, fsevents
- Target: node

## Debugging

### VS Code
Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Electron Main",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/desktop",
      "runtimeExecutable": "${workspaceFolder}/desktop/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/desktop/node_modules/.bin/electron.cmd"
      },
      "args": ["."],
      "outputCapture": "std"
    }
  ]
}
```

### Chrome DevTools
The renderer process dev tools open automatically in development mode.

## Building for Distribution

```bash
# Build for current platform
npm run build:dist

# Output in dist-electron/
```

Builds are configured in package.json under the "build" section.

## Troubleshooting

**Issue**: `npm run dev` fails with module errors
- **Solution**: Run `npm install` to ensure all dependencies are installed

**Issue**: E2E tests fail to start browsers
- **Solution**: Run `npx playwright install` to download test browsers

**Issue**: Hot reload not working
- **Solution**: Restart the dev server with `npm run dev`

## Contributing

When adding new features:
1. Write unit tests in `src/**/*.test.js`
2. Add E2E tests in `tests/e2e/` for user-facing features
3. Update this README if architecture changes
4. Run `npm run lint:fix` before committing

## License

Apache License 2.0
