# Data Models

This document describes the data structures used in NoteCove, including database schemas, CRDT structures, and their relationships.

## Architecture: Cache vs Source of Truth

NoteCove uses a **dual-storage architecture**:

```
┌─────────────────────────────────────────────────────────┐
│                    Source of Truth                       │
│              (CRDT files on disk)                       │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ .crdtlog files  │  │ .crdtsnapshot   │              │
│  │ (append-only)   │  │ (periodic)      │              │
│  └─────────────────┘  └─────────────────┘              │
└───────────────────────────────┬─────────────────────────┘
                            │
                            │ Derived from
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      Cache Layer                         │
│                (SQLite database)                        │
│                                                         │
│  - Fast queries (FTS5 full-text search)                │
│  - Indexed lookups                                      │
│  - UI state persistence                                 │
│  - Can be rebuilt from CRDT at any time                │
└─────────────────────────────────────────────────────────┘
```

**Key principle**: The database is always rebuildable from CRDT files. If the database is corrupted or deleted, the app can reconstruct it by loading all notes from their CRDT files.

## Database Schema

### Storage Directory (storage_dirs)

```sql
CREATE TABLE storage_dirs (
  id TEXT PRIMARY KEY,        -- User-defined ID (e.g., "default", "work")
  name TEXT NOT NULL,         -- Display name
  path TEXT NOT NULL,         -- Absolute path to SD directory
  uuid TEXT,                  -- Globally unique UUID for cross-instance sync
  created INTEGER NOT NULL,   -- Unix timestamp (ms)
  is_active INTEGER NOT NULL DEFAULT 0  -- Only one SD active at a time
);
```

TypeScript interface:

```typescript
interface StorageDirCache {
  id: string;
  name: string;
  path: string;
  uuid: string | null;
  created: number;
  isActive: boolean;
}
```

### Notes (notes)

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,              -- UUID
  title TEXT NOT NULL,              -- Extracted from first heading
  sd_id TEXT NOT NULL,              -- Foreign key to storage_dirs
  folder_id TEXT,                   -- NULL = "All Notes"
  created INTEGER NOT NULL,         -- Unix timestamp (ms)
  modified INTEGER NOT NULL,        -- Unix timestamp (ms)
  deleted INTEGER NOT NULL DEFAULT 0,  -- Soft delete flag
  pinned INTEGER NOT NULL DEFAULT 0,   -- Pinned to top of list
  content_preview TEXT DEFAULT '',  -- First ~200 chars
  content_text TEXT DEFAULT '',     -- Full text for FTS5
  FOREIGN KEY (sd_id) REFERENCES storage_dirs(id)
);

-- Full-text search index
CREATE VIRTUAL TABLE notes_fts USING fts5(
  id,
  title,
  content_text,
  content='notes',
  content_rowid='rowid'
);
```

TypeScript interface:

```typescript
interface NoteCache {
  id: UUID;
  title: string;
  sdId: string;
  folderId: UUID | null;
  created: number;
  modified: number;
  deleted: boolean;
  pinned: boolean;
  contentPreview: string;
  contentText: string;
}
```

### Folders (folders)

```sql
CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,              -- NULL = root folder
  sd_id TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (sd_id) REFERENCES storage_dirs(id),
  FOREIGN KEY (parent_id) REFERENCES folders(id)
);
```

TypeScript interface:

```typescript
interface FolderCache {
  id: UUID;
  name: string;
  parentId: UUID | null;
  sdId: string;
  order: number;
  deleted: boolean;
}
```

### Tags

```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE    -- Case-insensitive
);

CREATE TABLE note_tags (
  note_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

TypeScript interfaces:

```typescript
interface Tag {
  id: UUID;
  name: string;
}

interface NoteTag {
  noteId: UUID;
  tagId: UUID;
}
```

### Note Links

```sql
CREATE TABLE note_links (
  source_note_id TEXT NOT NULL,
  target_note_id TEXT NOT NULL,
  PRIMARY KEY (source_note_id, target_note_id),
  FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_note_id) REFERENCES notes(id) ON DELETE CASCADE
);
```

TypeScript interface:

```typescript
interface NoteLink {
  sourceNoteId: UUID;
  targetNoteId: UUID;
}
```

### Checkboxes (Tasks)

```sql
CREATE TABLE checkboxes (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  state TEXT NOT NULL,         -- 'unchecked', 'checked', 'nope'
  text TEXT NOT NULL,          -- Text content after checkbox
  position INTEGER NOT NULL,   -- Order within note
  created INTEGER NOT NULL,
  modified INTEGER NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);
```

TypeScript interface:

```typescript
interface Checkbox {
  id: UUID;
  noteId: UUID;
  state: 'unchecked' | 'checked' | 'nope';
  text: string;
  position: number;
  created: number;
  modified: number;
}
```

### App State

```sql
CREATE TABLE app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL          -- JSON-serialized
);
```

Common keys:

```typescript
enum AppStateKey {
  LastOpenedNote = 'lastOpenedNote',
  LeftPanelWidth = 'leftPanelWidth',
  RightPanelWidth = 'rightPanelWidth',
  PanelSizes = 'panelSizes',
  FolderCollapseState = 'folderCollapseState',
  TagFilters = 'tagFilters',
  SearchText = 'searchText',
  ThemeMode = 'themeMode',
  Username = 'username',
  UserHandle = 'userHandle',
  WindowStates = 'windowStates',
}
```

### Window State

```sql
CREATE TABLE window_states (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,          -- 'main', 'minimal', etc.
  note_id TEXT,
  sd_id TEXT,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  is_maximized INTEGER NOT NULL DEFAULT 0,
  is_full_screen INTEGER NOT NULL DEFAULT 0,
  scroll_top INTEGER,
  cursor_position INTEGER
);
```

TypeScript interface:

```typescript
interface WindowState {
  id: string;
  type: 'main' | 'minimal' | 'syncStatus' | 'noteInfo' | 'storageInspector' | 'sdPicker';
  noteId?: string;
  sdId?: string;
  bounds: WindowBounds;
  isMaximized: boolean;
  isFullScreen: boolean;
  editorState?: EditorState;
}
```

### Note Moves

```sql
CREATE TABLE note_moves (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  source_sd_uuid TEXT NOT NULL,
  target_sd_uuid TEXT NOT NULL,
  target_folder_id TEXT,
  state TEXT NOT NULL,         -- NoteMoveState enum
  initiated_by TEXT NOT NULL,  -- Instance ID
  initiated_at INTEGER NOT NULL,
  last_modified INTEGER NOT NULL,
  source_sd_path TEXT,
  target_sd_path TEXT,
  error TEXT
);
```

Move states:

```typescript
type NoteMoveState =
  | 'initiated'
  | 'copying'
  | 'files_copied'
  | 'db_updated'
  | 'cleaning'
  | 'completed'
  | 'cancelled'
  | 'rolled_back';
```

## CRDT Data Structures

### NoteDoc Structure

Notes use Yjs `Y.XmlFragment` for rich text. The structure maps to ProseMirror's document model:

```
Y.XmlFragment ('content')
├── Y.XmlElement ('heading', { level: 1 })
│   └── Y.Text ("My Note Title")
├── Y.XmlElement ('paragraph')
│   └── Y.Text ("Some paragraph text with ")
│       └── Mark: bold
│   └── Y.Text ("bold")
│       └── Mark: bold
│   └── Y.Text (" formatting")
├── Y.XmlElement ('bulletList')
│   ├── Y.XmlElement ('listItem')
│   │   └── Y.XmlElement ('paragraph')
│   │       └── Y.Text ("First item")
│   └── Y.XmlElement ('listItem')
│       └── Y.XmlElement ('paragraph')
│           └── Y.Text ("Second item")
└── Y.XmlElement ('taskItem', { checked: false })
    └── Y.XmlElement ('paragraph')
        └── Y.Text ("A checkbox item")
```

### FolderTreeDoc Structure

Folders use Yjs `Y.Map<string, FolderData>`:

```
Y.Map ('folders')
├── "folder-1" → { id: "folder-1", name: "Work", parentId: null, sdId: "default", order: 0, deleted: false }
├── "folder-2" → { id: "folder-2", name: "Projects", parentId: "folder-1", sdId: "default", order: 0, deleted: false }
├── "folder-3" → { id: "folder-3", name: "Personal", parentId: null, sdId: "default", order: 1, deleted: false }
└── "folder-4" → { id: "folder-4", name: "Ideas", parentId: "folder-3", sdId: "default", order: 0, deleted: false }
```

Tree visualization:

```
root (null parentId)
├── Work (folder-1, order: 0)
│   └── Projects (folder-2)
└── Personal (folder-3, order: 1)
    └── Ideas (folder-4)
```

### Vector Clock Structure

```typescript
interface VectorClock {
  [instanceId: string]: {
    sequence: number; // Last applied sequence number
    offset: number; // Byte offset in log file
    file: string; // Log file name
  };
}
```

Example:

```json
{
  "macbook-abc123": {
    "sequence": 42,
    "offset": 8192,
    "file": "macbook-abc123_1702234567890.crdtlog"
  },
  "iphone-xyz789": {
    "sequence": 17,
    "offset": 2048,
    "file": "iphone-xyz789_1702234600000.crdtlog"
  }
}
```

## CRDT to Cache Relationship

When CRDT data changes, the cache is updated:

```mermaid
flowchart LR
    subgraph CRDT ["CRDT (Source of Truth)"]
        YDoc[Y.Doc]
        Fragment[Y.XmlFragment]
    end

    subgraph Cache ["SQLite Cache"]
        Notes[notes table]
        NotesFTS[notes_fts index]
        Tags[tags table]
        NoteTags[note_tags table]
        Checkboxes[checkboxes table]
        Links[note_links table]
    end

    Fragment -->|Extract title| Notes
    Fragment -->|Extract text| NotesFTS
    Fragment -->|Extract #tags| Tags
    Fragment -->|Extract #tags| NoteTags
    Fragment -->|Extract checkboxes| Checkboxes
    Fragment -->|Extract [[links]]| Links
```

### Extraction Process

When a note is saved or synced:

```typescript
async function updateNoteCache(noteId: string, doc: Y.Doc): Promise<void> {
  const fragment = doc.getXmlFragment('content');

  // 1. Extract title (first heading or first line)
  const title = extractTitle(fragment);

  // 2. Extract plain text for search
  const contentText = extractPlainText(fragment);
  const contentPreview = contentText.slice(0, 200);

  // 3. Update note record
  database.updateNote(noteId, { title, contentText, contentPreview });

  // 4. Extract and sync tags (#tag syntax)
  const tags = extractTags(contentText);
  database.syncNoteTags(noteId, tags);

  // 5. Extract and sync checkboxes
  const checkboxes = extractCheckboxes(fragment);
  database.syncNoteCheckboxes(noteId, checkboxes);

  // 6. Extract and sync links ([[note title]] syntax)
  const links = extractLinks(fragment);
  database.syncNoteLinks(noteId, links);
}
```

## Sync State Schemas

### Activity Log Entry

```
{noteId}|{instanceId}_{sequenceNumber}
```

Example: `550e8400-e29b-41d4-a716-446655440000|macbook-abc123_42`

### Deletion Log Entry

```
{noteId}|{timestamp}
```

Example: `550e8400-e29b-41d4-a716-446655440000|1702234567890`

### Profile Presence

Each instance writes a presence file at `{SD_PATH}/profiles/{instanceId}.json`:

```json
{
  "instanceId": "macbook-abc123",
  "lastSeen": 1702234567890,
  "username": "Drew",
  "userHandle": "@drew",
  "currentNoteId": "550e8400-e29b-41d4-a716-446655440000",
  "currentSdId": "default"
}
```

This enables:

- Showing who else is viewing a note
- Displaying presence indicators in the UI
- Detecting stale instances (not seen for >30 seconds)

## Type Definitions

All TypeScript types are defined in:

| File                                               | Purpose                   |
| -------------------------------------------------- | ------------------------- |
| `packages/shared/src/database/schema.ts`           | Database record types     |
| `packages/shared/src/types.ts`                     | Common types (UUID, etc.) |
| `packages/shared/src/storage/document-snapshot.ts` | VectorClock interface     |
| `packages/shared/src/storage/types.ts`             | FileSystemAdapter, etc.   |

## Schema Migrations

Database schema versions are tracked:

```sql
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL,
  description TEXT
);
```

Migrations are defined in `packages/desktop/src/main/database.ts`:

```typescript
const migrations: Migration[] = [
  { version: 1, description: 'Initial schema', up: async (db) => { ... } },
  { version: 2, description: 'Add pinned column', up: async (db) => { ... } },
  // ...
  { version: 9, description: 'Add comment tables', up: async (db) => { ... } },
];
```

Current schema version: **9**

## Key Files Reference

| File                                               | Purpose                     |
| -------------------------------------------------- | --------------------------- |
| `packages/shared/src/database/schema.ts`           | TypeScript interfaces       |
| `packages/desktop/src/main/database.ts`            | SQLite implementation       |
| `packages/shared/src/crdt/note-doc.ts`             | NoteDoc CRDT wrapper        |
| `packages/shared/src/crdt/folder-tree-doc.ts`      | FolderTreeDoc CRDT wrapper  |
| `packages/shared/src/storage/document-snapshot.ts` | Y.Doc + VectorClock pairing |

## Next Steps

- [Learn about storage architecture](/architecture/storage-architecture)
- [Learn about sync mechanism](/architecture/sync-mechanism)
- [View detailed format specification](/technical_documents/STORAGE-FORMAT-DESIGN)
