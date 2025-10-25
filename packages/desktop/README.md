# NoteCove Desktop

The Electron desktop application for NoteCove.

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

- `src/main/` - Electron main process (Node.js)
  - `crdt/` - CRDT document management
  - `ipc/` - IPC handlers and events
- `src/preload/` - Preload scripts (secure IPC bridge)
- `src/renderer/` - React UI application
  - `i18n/` - Internationalization
  - `__tests__/` - Component tests

## Technology Stack

- **Electron** - Desktop application framework
- **React** - UI library
- **TypeScript** - Type-safe JavaScript
- **Material-UI** - Component library
- **Yjs** - CRDT implementation
- **Vite** - Build tool and dev server
- **Jest** - Testing framework
