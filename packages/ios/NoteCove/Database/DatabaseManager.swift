import Foundation
import GRDB

/// Database manager for NoteCove
/// Wraps GRDB database operations and provides typed access to records
@MainActor
final class DatabaseManager {
    /// Shared instance for the app
    static let shared = DatabaseManager()

    /// The database connection pool
    private var dbPool: DatabasePool?

    /// Database file URL
    private var databaseURL: URL?

    private init() {}

    // MARK: - Database Setup

    /// Initialize the database at the specified URL
    /// - Parameter url: URL for the database file
    func setupDatabase(at url: URL) throws {
        databaseURL = url

        // Configure the database
        var config = Configuration()
        config.prepareDatabase { db in
            // Enable foreign keys
            try db.execute(sql: "PRAGMA foreign_keys = ON")
        }

        // Create the database pool
        dbPool = try DatabasePool(path: url.path, configuration: config)

        // Run migrations
        try runMigrations()
    }

    /// Get the database pool (throws if not initialized)
    var pool: DatabasePool {
        guard let dbPool else {
            fatalError("Database not initialized. Call setupDatabase(at:) first.")
        }
        return dbPool
    }

    /// Check if database is initialized
    var isInitialized: Bool {
        dbPool != nil
    }

    /// Get the database file path
    var databasePath: String {
        databaseURL?.path ?? ""
    }

    // MARK: - Migrations

    private func runMigrations() throws {
        guard let dbPool else { return }

        var migrator = DatabaseMigrator()

        // Migration 1: Initial schema
        migrator.registerMigration("v1_initial") { db in
            // Notes table
            try db.create(table: "notes", ifNotExists: true) { t in
                t.column("id", .text).primaryKey()
                t.column("title", .text).notNull()
                t.column("sd_id", .text).notNull()
                t.column("folder_id", .text)
                t.column("created", .integer).notNull()
                t.column("modified", .integer).notNull()
                t.column("deleted", .integer).notNull().defaults(to: 0)
                t.column("pinned", .integer).notNull().defaults(to: 0)
                t.column("content_preview", .text).notNull()
                t.column("content_text", .text).notNull()
            }
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_notes_sd_id ON notes(sd_id)")
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id)")
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(deleted)")
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_notes_modified ON notes(modified)")
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(pinned)")

            // Folders table
            try db.create(table: "folders", ifNotExists: true) { t in
                t.column("id", .text).primaryKey()
                t.column("name", .text).notNull()
                t.column("parent_id", .text)
                t.column("sd_id", .text).notNull()
                t.column("order", .integer).notNull()
                t.column("deleted", .integer).notNull().defaults(to: 0)
            }
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_folders_sd_id ON folders(sd_id)")
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id)")

            // Storage directories table
            try db.create(table: "storage_dirs", ifNotExists: true) { t in
                t.column("id", .text).primaryKey()
                t.column("name", .text).notNull().unique()
                t.column("path", .text).notNull().unique()
                t.column("uuid", .text)
                t.column("created", .integer).notNull()
                t.column("is_active", .integer).notNull().defaults(to: 0)
            }
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_storage_dirs_is_active ON storage_dirs(is_active)")
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_storage_dirs_uuid ON storage_dirs(uuid)")

            // Tags table
            try db.create(table: "tags", ifNotExists: true) { t in
                t.column("id", .text).primaryKey()
                t.column("name", .text).notNull().unique().collate(.nocase)
            }
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)")

            // Note-Tags association table
            try db.create(table: "note_tags", ifNotExists: true) { t in
                t.column("note_id", .text).notNull()
                t.column("tag_id", .text).notNull()
                t.primaryKey(["note_id", "tag_id"])
                t.foreignKey(["note_id"], references: "notes", columns: ["id"], onDelete: .cascade)
                t.foreignKey(["tag_id"], references: "tags", columns: ["id"], onDelete: .cascade)
            }
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON note_tags(note_id)")
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id)")

            // App state table
            try db.create(table: "app_state", ifNotExists: true) { t in
                t.column("key", .text).primaryKey()
                t.column("value", .text).notNull()
            }

            // Schema version table
            try db.create(table: "schema_version", ifNotExists: true) { t in
                t.column("version", .integer).primaryKey()
                t.column("applied_at", .integer).notNull()
                t.column("description", .text).notNull()
            }

            // Note sync state table
            try db.create(table: "note_sync_state", ifNotExists: true) { t in
                t.column("note_id", .text).notNull()
                t.column("sd_id", .text).notNull()
                t.column("vector_clock", .text).notNull()
                t.column("document_state", .blob).notNull()
                t.column("updated_at", .integer).notNull()
                t.primaryKey(["note_id", "sd_id"])
            }
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_note_sync_state_sd_id ON note_sync_state(sd_id)")
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_note_sync_state_updated_at ON note_sync_state(updated_at)")

            // Folder sync state table
            try db.create(table: "folder_sync_state", ifNotExists: true) { t in
                t.column("sd_id", .text).primaryKey()
                t.column("vector_clock", .text).notNull()
                t.column("document_state", .blob).notNull()
                t.column("updated_at", .integer).notNull()
            }

            // Activity log state table
            try db.create(table: "activity_log_state", ifNotExists: true) { t in
                t.column("sd_id", .text).notNull()
                t.column("instance_id", .text).notNull()
                t.column("last_offset", .integer).notNull()
                t.column("log_file", .text).notNull()
                t.primaryKey(["sd_id", "instance_id"])
            }
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_activity_log_state_sd_id ON activity_log_state(sd_id)")

            // Images table
            try db.create(table: "images", ifNotExists: true) { t in
                t.column("id", .text).primaryKey()
                t.column("sd_id", .text).notNull()
                t.column("filename", .text).notNull()
                t.column("mime_type", .text).notNull()
                t.column("width", .integer)
                t.column("height", .integer)
                t.column("size", .integer).notNull()
                t.column("created", .integer).notNull()
                t.foreignKey(["sd_id"], references: "storage_dirs", columns: ["id"], onDelete: .cascade)
            }
            try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_images_sd_id ON images(sd_id)")
        }

        // Migration 2: FTS5 for full-text search
        migrator.registerMigration("v2_fts5") { db in
            // Create standalone FTS5 virtual table (not content-synced)
            // This is simpler than external content tables and avoids trigger complexity
            try db.execute(sql: """
                CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
                    note_id UNINDEXED,
                    title,
                    content
                )
            """)

            // Triggers to keep FTS index in sync with notes table
            try db.execute(sql: """
                CREATE TRIGGER IF NOT EXISTS notes_fts_insert AFTER INSERT ON notes BEGIN
                    INSERT INTO notes_fts(note_id, title, content)
                    VALUES (new.id, new.title, new.content_text);
                END
            """)

            try db.execute(sql: """
                CREATE TRIGGER IF NOT EXISTS notes_fts_delete AFTER DELETE ON notes BEGIN
                    DELETE FROM notes_fts WHERE note_id = old.id;
                END
            """)

            try db.execute(sql: """
                CREATE TRIGGER IF NOT EXISTS notes_fts_update AFTER UPDATE ON notes BEGIN
                    DELETE FROM notes_fts WHERE note_id = old.id;
                    INSERT INTO notes_fts(note_id, title, content)
                    VALUES (new.id, new.title, new.content_text);
                END
            """)
        }

        try migrator.migrate(dbPool)
    }

    // MARK: - Note Operations

    /// Fetch all notes, optionally filtered by folder
    func fetchNotes(folderId: String? = nil, includeDeleted: Bool = false) throws -> [NoteRecord] {
        try pool.read { db in
            var request = NoteRecord.all()
            if !includeDeleted {
                request = request.filter(NoteRecord.Columns.deleted == false)
            }
            if let folderId {
                request = request.filter(NoteRecord.Columns.folderId == folderId)
            }
            // Order by pinned DESC (pinned first), then modified DESC (newest first)
            return try request
                .order(NoteRecord.Columns.pinned.desc, NoteRecord.Columns.modified.desc)
                .fetchAll(db)
        }
    }

    /// Fetch a single note by ID
    func fetchNote(id: String) throws -> NoteRecord? {
        try pool.read { db in
            try NoteRecord.fetchOne(db, key: id)
        }
    }

    /// Insert or update a note
    func upsertNote(_ note: NoteRecord) throws {
        try pool.write { db in
            try note.save(db)
        }
    }

    /// Delete a note (soft delete)
    func softDeleteNote(id: String) throws {
        try pool.write { db in
            if var note = try NoteRecord.fetchOne(db, key: id) {
                note.deleted = true
                try note.update(db)
            }
        }
    }

    // MARK: - Folder Operations

    /// Fetch all folders
    func fetchFolders(sdId: String? = nil, includeDeleted: Bool = false) throws -> [FolderRecord] {
        try pool.read { db in
            var request = FolderRecord.all()
            if !includeDeleted {
                request = request.filter(FolderRecord.Columns.deleted == false)
            }
            if let sdId {
                request = request.filter(FolderRecord.Columns.sdId == sdId)
            }
            return try request
                .order(FolderRecord.Columns.order.asc)
                .fetchAll(db)
        }
    }

    /// Fetch a single folder by ID
    func fetchFolder(id: String) throws -> FolderRecord? {
        try pool.read { db in
            try FolderRecord.fetchOne(db, key: id)
        }
    }

    /// Insert or update a folder
    func upsertFolder(_ folder: FolderRecord) throws {
        try pool.write { db in
            try folder.save(db)
        }
    }

    // MARK: - Storage Directory Operations

    /// Fetch all storage directories
    func fetchStorageDirs() throws -> [StorageDirRecord] {
        try pool.read { db in
            try StorageDirRecord.fetchAll(db)
        }
    }

    /// Fetch the active storage directory
    func fetchActiveStorageDir() throws -> StorageDirRecord? {
        try pool.read { db in
            try StorageDirRecord
                .filter(StorageDirRecord.Columns.isActive == true)
                .fetchOne(db)
        }
    }

    /// Set a storage directory as active (deactivates others)
    func setActiveStorageDir(id: String) throws {
        try pool.write { db in
            // Deactivate all
            try db.execute(sql: "UPDATE storage_dirs SET is_active = 0")
            // Activate the specified one
            try db.execute(sql: "UPDATE storage_dirs SET is_active = 1 WHERE id = ?", arguments: [id])
        }
    }

    /// Insert or update a storage directory
    func upsertStorageDir(_ sd: StorageDirRecord) throws {
        try pool.write { db in
            try sd.save(db)
        }
    }

    // MARK: - App State Operations

    /// Get an app state value
    func getAppState(key: AppStateKey) throws -> String? {
        try pool.read { db in
            try AppStateRecord
                .filter(AppStateRecord.Columns.key == key.rawValue)
                .fetchOne(db)?
                .value
        }
    }

    /// Set an app state value
    func setAppState(key: AppStateKey, value: String) throws {
        try pool.write { db in
            let record = AppStateRecord(key: key.rawValue, value: value)
            try record.save(db)
        }
    }

    // MARK: - Search Operations

    /// Search notes using FTS5
    func searchNotes(query: String, limit: Int = 50) throws -> [SearchResult] {
        try pool.read { db in
            // Escape FTS5 query for safety - wrap in quotes for phrase search
            let escapedQuery = query.replacingOccurrences(of: "\"", with: "\"\"")

            let sql = """
                SELECT
                    notes.id AS note_id,
                    notes.title,
                    snippet(notes_fts, -1, '<mark>', '</mark>', '...', 32) AS snippet,
                    bm25(notes_fts) AS rank
                FROM notes_fts
                JOIN notes ON notes.id = notes_fts.note_id
                WHERE notes_fts MATCH ?
                  AND notes.deleted = 0
                ORDER BY rank
                LIMIT ?
            """

            return try SearchResult.fetchAll(db, sql: sql, arguments: ["\"\(escapedQuery)\"*", limit])
        }
    }

    // MARK: - Bulk Operations

    /// Clear all cached data (for re-sync from CRDT)
    func clearCache() throws {
        try pool.write { db in
            try db.execute(sql: "DELETE FROM notes")
            try db.execute(sql: "DELETE FROM folders")
            try db.execute(sql: "DELETE FROM note_sync_state")
            try db.execute(sql: "DELETE FROM folder_sync_state")
        }
    }

    /// Get database statistics
    func getStats() throws -> DatabaseStats {
        try pool.read { db in
            let noteCount = try NoteRecord.filter(NoteRecord.Columns.deleted == false).fetchCount(db)
            let folderCount = try FolderRecord.filter(FolderRecord.Columns.deleted == false).fetchCount(db)
            let sdCount = try StorageDirRecord.fetchCount(db)
            return DatabaseStats(noteCount: noteCount, folderCount: folderCount, sdCount: sdCount)
        }
    }

    /// Get row count for a table (for debug purposes)
    func getRowCount(tableName: String) throws -> Int {
        try pool.read { db in
            // Sanitize table name to prevent SQL injection
            let validTables = ["notes", "notes_fts", "folders", "storage_dirs", "tags", "note_tags",
                               "app_state", "schema_version", "note_sync_state", "folder_sync_state",
                               "activity_log_state", "images"]
            guard validTables.contains(tableName) else {
                return 0
            }
            let count = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM \(tableName)")
            return count ?? 0
        }
    }

    // MARK: - Database Observation

    /// Observe notes for reactive updates
    /// Returns an observation that publishes note arrays when the database changes
    func observeNotes(folderId: String? = nil) -> ValueObservation<ValueReducers.Fetch<[NoteRecord]>> {
        ValueObservation.tracking { db in
            var request = NoteRecord.filter(NoteRecord.Columns.deleted == false)
            if let folderId {
                request = request.filter(NoteRecord.Columns.folderId == folderId)
            }
            return try request
                .order(NoteRecord.Columns.pinned.desc, NoteRecord.Columns.modified.desc)
                .fetchAll(db)
        }
    }

    /// Observe folders for reactive updates
    func observeFolders(sdId: String? = nil) -> ValueObservation<ValueReducers.Fetch<[FolderRecord]>> {
        ValueObservation.tracking { db in
            var request = FolderRecord.filter(FolderRecord.Columns.deleted == false)
            if let sdId {
                request = request.filter(FolderRecord.Columns.sdId == sdId)
            }
            return try request
                .order(FolderRecord.Columns.order.asc)
                .fetchAll(db)
        }
    }
}

// MARK: - Database Stats

struct DatabaseStats {
    let noteCount: Int
    let folderCount: Int
    let sdCount: Int
}
