# Tech Stack

NoteCove is built with modern, battle-tested technologies optimized for offline-first, cross-platform development.

## Frontend

### React

**Version**: 18+

**Why React:**

- Component-based architecture
- Virtual DOM for performance
- Large ecosystem
- Excellent TypeScript support
- Hooks for state management

**Usage:**

- All UI components
- State management
- Effects and side effects
- Context for global state

**Example:**

```typescript
import { useState, useEffect } from 'react'

function NoteEditor({ noteId }: Props) {
  const [content, setContent] = useState('')

  useEffect(() => {
    loadNote(noteId).then(setContent)
  }, [noteId])

  return <Editor content={content} />
}
```

### Material-UI (MUI)

**Version**: 5+

**Why Material-UI:**

- Comprehensive component library
- Follows Material Design
- Excellent accessibility
- Customizable theming
- TypeScript support

**Components used:**

- Buttons, inputs, dialogs
- Lists, menus, toolbars
- Layout components (Grid, Box)
- Icons from @mui/icons-material

**Example:**

```typescript
import { Button, TextField, Box } from '@mui/material'

function CreateNoteDialog() {
  return (
    <Box sx={{ p: 2 }}>
      <TextField label="Note title" fullWidth />
      <Button variant="contained">Create</Button>
    </Box>
  )
}
```

### TipTap

**Version**: 2+

**Why TipTap:**

- Built on ProseMirror
- Excellent for rich text
- Extensible architecture
- CRDT support (y-prosemirror)
- TypeScript support

**Extensions used:**

- StarterKit (basic formatting)
- Collaboration (Yjs integration)
- Placeholder
- CharacterCount
- CodeBlockLowlight (syntax highlighting)

**Example:**

```typescript
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';

const editor = useEditor({
  extensions: [
    StarterKit,
    Collaboration.configure({
      document: ydoc,
    }),
  ],
});
```

## Backend (Electron Main Process)

### Electron

**Version**: 28+

**Why Electron:**

- Cross-platform (macOS, Windows, Linux)
- Node.js integration
- Chromium rendering
- Native menus and dialogs
- Auto-updates

**Architecture:**

- Main process (Node.js)
- Renderer processes (Chromium)
- IPC for communication
- Contextual isolation for security

**Example:**

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';

ipcMain.handle('createNote', async (event, data) => {
  const note = await noteService.create(data);
  return note;
});
```

### better-sqlite3

**Version**: 9+

**Why better-sqlite3:**

- Fastest SQLite bindings for Node.js
- Synchronous API (simpler)
- FTS5 support
- Well-maintained

**Usage:**

- Note metadata storage
- Full-text search index
- CRDT update storage
- Application state

**Example:**

```typescript
import Database from 'better-sqlite3';

const db = new Database('notecove.db');
db.pragma('journal_mode = WAL');

const note = db
  .prepare(
    `
  SELECT * FROM notes WHERE id = ?
`
  )
  .get(noteId);
```

## CRDT & Sync

### Yjs

**Version**: 13+

**Why Yjs:**

- Fast CRDT implementation
- Small update sizes
- Rich text support
- Mature and battle-tested
- Excellent ecosystem

**Features used:**

- Y.Doc for documents
- Y.Text for note content
- Y.Map for metadata
- Update encoding/decoding
- State vectors

**Example:**

```typescript
import * as Y from 'yjs';

const ydoc = new Y.Doc();
const ytext = ydoc.getText('content');

// Track updates
ydoc.on('update', (update) => {
  saveUpdate(noteId, update);
});

// Apply remote updates
Y.applyUpdate(ydoc, remoteUpdate);
```

### y-prosemirror

**Version**: 1+

**Why y-prosemirror:**

- Binds Yjs to ProseMirror/TipTap
- Real-time collaboration
- Cursor synchronization
- Undo/redo support

**Example:**

```typescript
import { ySyncPlugin, yCursorPlugin } from 'y-prosemirror';

const editor = useEditor({
  extensions: [
    StarterKit,
    Collaboration.configure({
      document: ydoc,
    }),
  ],
});
```

## Build Tools

### Vite

**Version**: 5+

**Why Vite:**

- Fast HMR (Hot Module Replacement)
- ESM-based dev server
- Optimized production builds
- Excellent TypeScript support
- Plugin ecosystem

**Usage:**

- Dev server for renderer
- Production builds
- Asset optimization

**Config:**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'esnext',
  },
});
```

### Turborepo

**Version**: 1.11+

**Why Turborepo:**

- Monorepo task orchestration
- Intelligent caching
- Parallel execution
- Pipeline optimization

**Usage:**

- Build coordination
- Test running
- Linting and formatting

**Config:**

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

### pnpm

**Version**: 8+

**Why pnpm:**

- Fast package installation
- Disk space efficient
- Strict node_modules structure
- Workspace support

**Workspaces:**

```yaml
packages:
  - packages/*
```

## Development Tools

### TypeScript

**Version**: 5.3+

**Why TypeScript:**

- Type safety
- Better IDE support
- Catch errors early
- Self-documenting code

**Config:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "strict": true,
    "esModuleInterop": true
  }
}
```

### ESLint

**Version**: 8+

**Why ESLint:**

- Code quality
- Consistent style
- Catch common errors
- Customizable rules

**Plugins:**

- @typescript-eslint
- eslint-plugin-react
- eslint-plugin-react-hooks

### Prettier

**Version**: 3+

**Why Prettier:**

- Consistent formatting
- No style debates
- Automatic formatting

**Config:**

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5"
}
```

## Testing

### Jest

**Version**: 29+

**Why Jest:**

- Fast unit testing
- Great TypeScript support
- Snapshot testing
- Coverage reports

**Usage:**

- Unit tests for shared logic
- CRDT operations
- Utility functions

**Example:**

```typescript
describe('NoteService', () => {
  test('creates note', async () => {
    const note = await noteService.create({
      title: 'Test Note',
    });
    expect(note.id).toBeDefined();
  });
});
```

### Playwright

**Version**: 1.40+

**Why Playwright:**

- End-to-end testing
- Electron support
- Multi-browser testing
- Auto-waiting

**Usage:**

- E2E tests for desktop app
- User workflow testing
- Integration testing

**Example:**

```typescript
test('creates and edits note', async ({ page }) => {
  await page.click('[data-testid="new-note"]');
  await page.fill('[data-testid="note-title"]', 'My Note');
  await page.click('[data-testid="save"]');

  expect(await page.textContent('.note-title')).toBe('My Note');
});
```

## Package Structure

### Monorepo Layout

```
nc2/
├── packages/
│   ├── desktop/          # Electron app
│   │   ├── src/
│   │   │   ├── main/    # Main process
│   │   │   └── renderer/ # React app
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   ├── shared/           # Shared CRDT logic
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ios/              # iOS app (future)
│   │   └── NoteCove.xcodeproj
│   │
│   └── website/          # Documentation
│       ├── docs/
│       └── package.json
│
├── tools/               # Build scripts
├── turbo.json          # Turborepo config
├── package.json        # Root package.json
└── pnpm-workspace.yaml # pnpm workspaces
```

### Dependencies

**Core:**

- react: UI framework
- electron: Desktop platform
- yjs: CRDT engine
- better-sqlite3: Database

**UI:**

- @mui/material: Component library
- @tiptap/react: Rich text editor
- @tiptap/extension-\*: Editor extensions

**Build:**

- vite: Build tool
- typescript: Type system
- turborepo: Monorepo orchestration

**Test:**

- jest: Unit testing
- playwright: E2E testing
- @testing-library/react: React testing

## Future Stack

### Planned Additions

**iOS:**

- Swift 5.9+
- SwiftUI for UI
- JavaScriptCore for CRDT
- WKWebView for editor

**Android (maybe):**

- Kotlin
- Jetpack Compose
- React Native (alternative)

**Web (maybe):**

- Same React codebase
- IndexedDB for storage
- WebRTC for P2P sync

## Performance

### Bundle Size

**Desktop app:**

- Electron: ~150 MB (framework)
- App code: ~5 MB
- Dependencies: ~20 MB
- Total: ~175 MB

**Startup time:**

- Cold start: < 2s
- Window open: < 500ms
- First paint: < 200ms

### Memory Usage

**Idle:**

- Main process: ~50 MB
- Renderer: ~100 MB
- Total: ~150 MB

**Active (100 notes):**

- Main process: ~100 MB
- Renderer: ~200 MB
- Total: ~300 MB

## Platform Support

### Desktop

**macOS:**

- 10.13 High Sierra or later
- Intel and Apple Silicon

**Windows:**

- Windows 10 or later
- 64-bit only

**Linux:**

- Ubuntu 18.04 or equivalent
- Debian-based distros
- AppImage distribution

### Mobile (Coming Soon)

**iOS:**

- iOS 15.0 or later
- iPhone and iPad

**Android:**

- Android 10 or later (maybe)

## Next Steps

- [Understand sync mechanism](/architecture/sync-mechanism)
- [Learn about storage architecture](/architecture/storage-architecture)
- [Explore architecture overview](/architecture/)
