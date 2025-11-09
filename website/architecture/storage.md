# Storage Layer

NoteCove uses SQLite for local data storage with FTS5 for full-text search.

## Architecture

```
┌─────────────────────────────────────────┐
│           Application                   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│        better-sqlite3                   │
│      (Node.js SQLite bindings)          │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│           SQLite Database               │
│  ┌────────────┬─────────────────────┐   │
│  │  Tables    │   FTS5 Index        │   │
│  │  - notes   │   - note content    │   │
│  │  - folders │   - note titles     │   │
│  │  - updates │                     │   │
│  └────────────┴─────────────────────┘   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│        File System                      │
│  ~/Library/Application Support/NoteCove/│
│  ├── notecove.db                        │
│  └── notecove.db-wal                    │
└─────────────────────────────────────────┘
```

## Why SQLite?

### Benefits

**Serverless:**

- No separate database process
- Embedded in application
- Simple deployment

**Reliable:**

- ACID transactions
- Crash recovery
- Well-tested (used everywhere)

**Fast:**

- Optimized for local access
- Efficient indexing
- Full-text search (FTS5)

**Portable:**

- Single file database
- Cross-platform
- Easy backup

**Feature-rich:**

- Foreign keys
- Triggers
- Views
- JSON support

### Alternatives Considered

| Database   | Pros                 | Cons                |
| ---------- | -------------------- | ------------------- |
| **SQLite** | Fast, reliable, FTS5 | Single-writer       |
| IndexedDB  | Browser-compatible   | Complex API, slower |
| LevelDB    | Fast writes          | No SQL, no FTS      |
| PostgreSQL | Full SQL, concurrent | Requires server     |

## Database Schema

### Tables

**notes:**

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  folder_id TEXT,
  created_at INTEGER NOT NULL,
  modified_at INTEGER NOT NULL,
  deleted BOOLEAN DEFAULT 0,
  FOREIGN KEY (folder_id) REFERENCES folders(id)
);

CREATE INDEX idx_notes_folder
  ON notes(folder_id);
CREATE INDEX idx_notes_modified
  ON notes(modified_at DESC);
```

**folders:**

```sql
CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  created_at INTEGER NOT NULL,
  position INTEGER DEFAULT 0,
  deleted BOOLEAN DEFAULT 0,
  FOREIGN KEY (parent_id) REFERENCES folders(id)
);

CREATE INDEX idx_folders_parent
  ON folders(parent_id);
```

**note_updates:**

```sql
CREATE TABLE note_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  client_id TEXT NOT NULL,
  update BLOB NOT NULL,
  checksum TEXT NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id)
);

CREATE INDEX idx_updates_note
  ON note_updates(note_id, timestamp);
```

**sync_state:**

```sql
CREATE TABLE sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Full-Text Search

**FTS5 virtual table:**

```sql
CREATE VIRTUAL TABLE notes_fts USING fts5(
  title,
  content,
  content='notes',
  content_rowid='rowid',
  tokenize='porter unicode61'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER notes_fts_insert
  AFTER INSERT ON notes
  BEGIN
    INSERT INTO notes_fts(rowid, title, content)
    VALUES (new.rowid, new.title, '');
  END;

CREATE TRIGGER notes_fts_delete
  AFTER DELETE ON notes
  BEGIN
    DELETE FROM notes_fts WHERE rowid = old.rowid;
  END;

CREATE TRIGGER notes_fts_update
  AFTER UPDATE ON notes
  BEGIN
    UPDATE notes_fts
    SET title = new.title
    WHERE rowid = new.rowid;
  END;
```

## Data Access Patterns

### Insert Note

```typescript
async function createNote(id: string, title: string, folderId: string): Promise<void> {
  const now = Date.now();

  db.prepare(
    `
    INSERT INTO notes (id, title, folder_id, created_at, modified_at)
    VALUES (?, ?, ?, ?, ?)
  `
  ).run(id, title, folderId, now, now);
}
```

### Update Note

```typescript
async function updateNote(id: string, title: string): Promise<void> {
  const now = Date.now();

  db.prepare(
    `
    UPDATE notes
    SET title = ?, modified_at = ?
    WHERE id = ?
  `
  ).run(title, now, id);
}
```

### Search Notes

```typescript
async function searchNotes(query: string): Promise<SearchResult[]> {
  return db
    .prepare(
      `
    SELECT
      n.id,
      n.title,
      n.folder_id,
      n.modified_at,
      snippet(notes_fts, 1, '<mark>', '</mark>', '...', 32) as snippet,
      rank
    FROM notes_fts
    JOIN notes n ON notes_fts.rowid = n.rowid
    WHERE notes_fts MATCH ?
      AND n.deleted = 0
    ORDER BY rank
    LIMIT 100
  `
    )
    .all(query);
}
```

### Get Note Updates

```typescript
async function getNoteUpdates(noteId: string): Promise<Uint8Array[]> {
  const rows = db
    .prepare(
      `
    SELECT update
    FROM note_updates
    WHERE note_id = ?
    ORDER BY timestamp ASC
  `
    )
    .all(noteId);

  return rows.map((row) => row.update);
}
```

### Store CRDT Update

```typescript
async function storeUpdate(noteId: string, update: Uint8Array, clientId: string): Promise<void> {
  const timestamp = Date.now();
  const checksum = sha256(update);

  db.prepare(
    `
    INSERT INTO note_updates
    (note_id, timestamp, client_id, update, checksum)
    VALUES (?, ?, ?, ?, ?)
  `
  ).run(noteId, timestamp, clientId, update, checksum);
}
```

## Performance Optimizations

### Indexes

Strategic indexes for common queries:

```sql
-- Fast note lookup by folder
CREATE INDEX idx_notes_folder_modified
  ON notes(folder_id, modified_at DESC);

-- Fast update retrieval
CREATE INDEX idx_updates_note_timestamp
  ON note_updates(note_id, timestamp);

-- Fast folder hierarchy
CREATE INDEX idx_folders_parent_position
  ON folders(parent_id, position);
```

### Prepared Statements

Reuse compiled queries:

```typescript
// Prepare once
const insertNote = db.prepare(`
  INSERT INTO notes (id, title, folder_id, created_at, modified_at)
  VALUES (?, ?, ?, ?, ?)
`);

// Use many times
for (const note of notes) {
  insertNote.run(note.id, note.title, note.folderId, note.createdAt, note.modifiedAt);
}
```

### Transactions

Batch operations for better performance:

```typescript
const insertMany = db.transaction((notes) => {
  for (const note of notes) {
    insertNote.run(note.id, note.title, ...)
  }
})

// Runs in single transaction
insertMany(notes)
```

### Write-Ahead Logging (WAL)

Enable WAL mode for better concurrency:

```typescript
db.pragma('journal_mode = WAL');
```

**Benefits:**

- Readers don't block writers
- Writers don't block readers
- Better performance
- Safer crashes

## Full-Text Search (FTS5)

### Features

**Porter stemming:**

- "run" matches "running", "ran"
- Language-aware
- Configurable

**Unicode support:**

- Full Unicode normalization
- Case-insensitive search
- Diacritic folding

**Ranking:**

- BM25 relevance ranking
- Position-aware scoring
- Field weighting

### Query Syntax

**Simple queries:**

```sql
SELECT * FROM notes_fts
WHERE notes_fts MATCH 'search term'
```

**Phrase search:**

```sql
WHERE notes_fts MATCH '"exact phrase"'
```

**Boolean operators:**

```sql
WHERE notes_fts MATCH 'term1 AND term2'
WHERE notes_fts MATCH 'term1 OR term2'
WHERE notes_fts MATCH 'term1 NOT term2'
```

**Field-specific:**

```sql
WHERE notes_fts MATCH 'title:search'
WHERE notes_fts MATCH 'content:term'
```

**Proximity:**

```sql
WHERE notes_fts MATCH 'NEAR(term1 term2, 5)'
```

### Snippets

Generate search result snippets:

```sql
SELECT
  id,
  title,
  snippet(notes_fts, 1, '<b>', '</b>', '...', 32) as snippet
FROM notes_fts
WHERE notes_fts MATCH ?
```

## Migration Strategy

### Schema Versioning

Track schema version:

```sql
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

INSERT INTO schema_version (version, applied_at)
VALUES (1, strftime('%s', 'now'));
```

### Migration Scripts

```typescript
const migrations = [
  // Version 1 → 2
  {
    version: 2,
    up: (db) => {
      db.exec(`
        ALTER TABLE notes
        ADD COLUMN color TEXT
      `);
    },
  },
  // Version 2 → 3
  {
    version: 3,
    up: (db) => {
      db.exec(`
        CREATE TABLE tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE
        )
      `);
    },
  },
];

function migrate(db: Database): void {
  const currentVersion = db.prepare('SELECT MAX(version) as v FROM schema_version').get().v || 0;

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      migration.up(db);
      db.prepare(
        `
        INSERT INTO schema_version (version, applied_at)
        VALUES (?, ?)
      `
      ).run(migration.version, Date.now());
    }
  }
}
```

## Backup & Recovery

### Backup

```typescript
async function backup(destPath: string): Promise<void> {
  // WAL checkpoint first
  db.pragma('wal_checkpoint(TRUNCATE)');

  // Copy database file
  await fs.copyFile(dbPath, destPath);
}
```

### Restore

```typescript
async function restore(sourcePath: string): Promise<void> {
  // Close current database
  db.close();

  // Copy backup over current
  await fs.copyFile(sourcePath, dbPath);

  // Reopen database
  db = new Database(dbPath);
}
```

### Export

```typescript
async function exportToJSON(): Promise<string> {
  const notes = db
    .prepare(
      `
    SELECT id, title, folder_id, created_at, modified_at
    FROM notes
    WHERE deleted = 0
  `
    )
    .all();

  const folders = db
    .prepare(
      `
    SELECT id, name, parent_id
    FROM folders
    WHERE deleted = 0
  `
    )
    .all();

  return JSON.stringify({ notes, folders }, null, 2);
}
```

## File Locations

### macOS

```
~/Library/Application Support/NoteCove/
├── notecove.db           # Main database
├── notecove.db-wal       # WAL file
├── notecove.db-shm       # Shared memory
└── backups/              # Automatic backups
    ├── 2024-01-15.db
    └── 2024-01-14.db
```

### Windows

```
%APPDATA%\NoteCove\
├── notecove.db
├── notecove.db-wal
├── notecove.db-shm
└── backups\
```

### Linux

```
~/.config/NoteCove/
├── notecove.db
├── notecove.db-wal
├── notecove.db-shm
└── backups/
```

## Monitoring

### Database Statistics

```typescript
function getDatabaseStats(): Stats {
  const { page_count, page_size } = db.pragma('page_count; page_size', { simple: true });

  return {
    sizeBytes: page_count * page_size,
    pageCount: page_count,
    pageSize: page_size,
    ...db.prepare('SELECT COUNT(*) as count FROM notes').get(),
    ...db.prepare('SELECT COUNT(*) as updateCount FROM note_updates').get(),
  };
}
```

### Query Performance

```typescript
db.prepare('EXPLAIN QUERY PLAN ' + query).all();
```

Analyze slow queries and add indexes as needed.

## Best Practices

### Do's

✅ Use transactions for multiple writes
✅ Use prepared statements
✅ Enable WAL mode
✅ Create indexes for common queries
✅ Validate data before insertion
✅ Use foreign keys for referential integrity

### Don'ts

❌ Don't use string concatenation for queries
❌ Don't store large BLOBs (use files instead)
❌ Don't skip error handling
❌ Don't disable foreign keys
❌ Don't use synchronous I/O in main thread

## Security

### SQL Injection Prevention

Always use parameterized queries:

```typescript
// ✅ Good - parameterized
db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);

// ❌ Bad - SQL injection risk
db.prepare(`SELECT * FROM notes WHERE id = '${noteId}'`).get();
```

### Data Validation

Validate before insertion:

```typescript
function createNote(data: unknown): void {
  const note = noteSchema.parse(data); // Zod validation
  db.prepare('INSERT INTO notes ...').run(note);
}
```

## Next Steps

- [Learn about CRDT sync](/architecture/crdt-sync)
- [Understand the tech stack](/architecture/tech-stack)
- [Explore search features](/features/search)
