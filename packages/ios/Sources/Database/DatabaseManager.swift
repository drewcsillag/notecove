import Foundation
import GRDB

/// Database manager for NoteCove
/// Handles all database operations including CRUD, search, and transactions
public class DatabaseManager {
    private let dbQueue: DatabaseQueue

    // MARK: - Initialization

    /// Initialize with a database URL
    /// - Parameter url: URL to the database file (will be created if it doesn't exist)
    /// - Throws: Database errors if initialization fails
    public init(at url: URL) throws {
        // Create parent directory if needed
        let parentDir = url.deletingLastPathComponent()
        if !FileManager.default.fileExists(atPath: parentDir.path) {
            try FileManager.default.createDirectory(at: parentDir, withIntermediateDirectories: true)
        }

        // Open/create database
        dbQueue = try DatabaseQueue(path: url.path)

        // Run migrations
        try Schema.migrate(dbQueue)
    }

    /// Initialize with an in-memory database (for testing)
    /// - Throws: Database errors if initialization fails
    public static func inMemory() throws -> DatabaseManager {
        let dbQueue = try DatabaseQueue()
        let manager = DatabaseManager(queue: dbQueue)
        try Schema.migrate(dbQueue)
        return manager
    }

    /// Private initializer for testing
    private init(queue: DatabaseQueue) {
        self.dbQueue = queue
    }

    // MARK: - Storage Directories

    /// Insert or update a storage directory
    func upsertStorageDirectory(id: String, name: String, path: String) throws {
        try dbQueue.write { db in
            let now = Date()
            var record = StorageDirectoryRecord(
                id: id,
                name: name,
                path: path,
                createdAt: now,
                modifiedAt: now
            )

            // Check if exists
            if try StorageDirectoryRecord.exists(db, key: id) {
                record.modifiedAt = now
            }

            try record.save(db)
        }
    }

    /// Get a storage directory by ID
    public func getStorageDirectory(id: String) throws -> StorageDirectoryRecord? {
        return try dbQueue.read { db in
            try StorageDirectoryRecord.fetchOne(db, key: id)
        }
    }

    /// List all storage directories
    public func listStorageDirectories() throws -> [StorageDirectoryRecord] {
        return try dbQueue.read { db in
            try StorageDirectoryRecord.fetchAll(db)
        }
    }

    // MARK: - Notes

    /// Insert a new note
    func insertNote(id: String, storageDirectoryId: String, folderId: String?, title: String) throws {
        try dbQueue.write { db in
            let now = Date()
            let record = NoteRecord(
                id: id,
                storageDirectoryId: storageDirectoryId,
                folderId: folderId,
                title: title,
                createdAt: now,
                modifiedAt: now,
                deletedAt: nil
            )
            try record.insert(db)
        }
    }

    /// Update a note's metadata
    func updateNote(id: String, title: String? = nil, folderId: String? = nil) throws {
        try dbQueue.write { db in
            guard var record = try NoteRecord.fetchOne(db, key: id) else {
                return
            }

            let now = Date()
            if let title = title {
                record.title = title
            }
            if let folderId = folderId {
                record.folderId = folderId
            }
            record.modifiedAt = now

            try record.update(db)
        }
    }

    /// Soft delete a note (move to trash)
    func deleteNote(id: String) throws {
        try dbQueue.write { db in
            guard var record = try NoteRecord.fetchOne(db, key: id) else {
                return
            }

            record.deletedAt = Date()
            try record.update(db)
        }
    }

    /// Permanently delete a note
    func permanentlyDeleteNote(id: String) throws {
        try dbQueue.write { db in
            try NoteRecord.deleteOne(db, key: id)

            // Also delete from FTS
            try db.execute(sql: "DELETE FROM notes_fts WHERE note_id = ?", arguments: [id])
        }
    }

    /// Restore a deleted note
    func restoreNote(id: String) throws {
        try dbQueue.write { db in
            guard var record = try NoteRecord.fetchOne(db, key: id) else {
                return
            }

            record.deletedAt = nil
            try record.update(db)
        }
    }

    /// Get a note by ID
    func getNote(id: String) throws -> NoteRecord? {
        return try dbQueue.read { db in
            try NoteRecord.fetchOne(db, key: id)
        }
    }

    /// List notes in a folder (or root if folderId is nil)
    func listNotes(in storageDirectoryId: String, folderId: String?, includeDeleted: Bool = false) throws -> [NoteRecord] {
        return try dbQueue.read { db in
            var sql = "SELECT * FROM notes WHERE storage_directory_id = ?"
            var arguments: [DatabaseValueConvertible] = [storageDirectoryId]

            if let folderId = folderId {
                sql += " AND folder_id = ?"
                arguments.append(folderId)
            } else {
                sql += " AND folder_id IS NULL"
            }

            if !includeDeleted {
                sql += " AND deleted_at IS NULL"
            }

            sql += " ORDER BY modified_at DESC"

            return try NoteRecord.fetchAll(db, sql: sql, arguments: StatementArguments(arguments))
        }
    }

    /// List recently deleted notes
    func listDeletedNotes(in storageDirectoryId: String) throws -> [NoteRecord] {
        return try dbQueue.read { db in
            let sql = """
                SELECT * FROM notes
                WHERE storage_directory_id = ? AND deleted_at IS NOT NULL
                ORDER BY deleted_at DESC
            """
            return try NoteRecord.fetchAll(db, sql: sql, arguments: [storageDirectoryId])
        }
    }

    // MARK: - Full-Text Search

    /// Index note content for FTS5 search
    func indexNoteContent(noteId: String, title: String, content: String) throws {
        try dbQueue.write { db in
            // Delete existing entry
            try db.execute(sql: "DELETE FROM notes_fts WHERE note_id = ?", arguments: [noteId])

            // Insert new entry
            try db.execute(
                sql: "INSERT INTO notes_fts (note_id, title, content) VALUES (?, ?, ?)",
                arguments: [noteId, title, content]
            )
        }
    }

    /// Search notes using FTS5
    func searchNotes(query: String, in storageDirectoryId: String, limit: Int = 50) throws -> [NoteSearchResult] {
        return try dbQueue.read { db in
            let sql = """
                SELECT
                    fts.note_id,
                    fts.title,
                    fts.content,
                    fts.rank
                FROM notes_fts fts
                INNER JOIN notes n ON fts.note_id = n.id
                WHERE notes_fts MATCH ?
                  AND n.storage_directory_id = ?
                  AND n.deleted_at IS NULL
                ORDER BY rank
                LIMIT ?
            """

            return try NoteSearchResult.fetchAll(
                db,
                sql: sql,
                arguments: [query, storageDirectoryId, limit]
            )
        }
    }

    // MARK: - Folders

    /// Insert a new folder
    func insertFolder(id: String, storageDirectoryId: String, parentId: String?, name: String) throws {
        try dbQueue.write { db in
            let now = Date()
            let record = FolderRecord(
                id: id,
                storageDirectoryId: storageDirectoryId,
                parentId: parentId,
                name: name,
                createdAt: now,
                modifiedAt: now
            )
            try record.insert(db)
        }
    }

    /// Update a folder
    func updateFolder(id: String, name: String? = nil, parentId: String? = nil) throws {
        try dbQueue.write { db in
            guard var record = try FolderRecord.fetchOne(db, key: id) else {
                return
            }

            let now = Date()
            if let name = name {
                record.name = name
            }
            if let parentId = parentId {
                record.parentId = parentId
            }
            record.modifiedAt = now

            try record.update(db)
        }
    }

    /// Delete a folder (and all its contents)
    func deleteFolder(id: String) throws {
        _ = try dbQueue.write { db in
            try FolderRecord.deleteOne(db, key: id)
            // Cascade delete will handle notes and subfolders
        }
    }

    /// Get a folder by ID
    func getFolder(id: String) throws -> FolderRecord? {
        return try dbQueue.read { db in
            try FolderRecord.fetchOne(db, key: id)
        }
    }

    /// List folders in a parent folder (or root if parentId is nil)
    func listFolders(in storageDirectoryId: String, parentId: String?) throws -> [FolderRecord] {
        return try dbQueue.read { db in
            var sql = "SELECT * FROM folders WHERE storage_directory_id = ?"
            var arguments: [DatabaseValueConvertible] = [storageDirectoryId]

            if let parentId = parentId {
                sql += " AND parent_id = ?"
                arguments.append(parentId)
            } else {
                sql += " AND parent_id IS NULL"
            }

            sql += " ORDER BY name ASC"

            return try FolderRecord.fetchAll(db, sql: sql, arguments: StatementArguments(arguments))
        }
    }

    // MARK: - Tags

    /// Insert a new tag
    func insertTag(id: String, storageDirectoryId: String, name: String, color: String?) throws {
        try dbQueue.write { db in
            let now = Date()
            let record = TagRecord(
                id: id,
                storageDirectoryId: storageDirectoryId,
                name: name,
                color: color,
                createdAt: now
            )
            try record.insert(db)
        }
    }

    /// Update a tag
    func updateTag(id: String, name: String? = nil, color: String? = nil) throws {
        try dbQueue.write { db in
            guard var record = try TagRecord.fetchOne(db, key: id) else {
                return
            }

            if let name = name {
                record.name = name
            }
            if let color = color {
                record.color = color
            }

            try record.update(db)
        }
    }

    /// Delete a tag
    func deleteTag(id: String) throws {
        _ = try dbQueue.write { db in
            try TagRecord.deleteOne(db, key: id)
            // Cascade delete will handle note_tags relationships
        }
    }

    /// Get a tag by ID
    func getTag(id: String) throws -> TagRecord? {
        return try dbQueue.read { db in
            try TagRecord.fetchOne(db, key: id)
        }
    }

    /// List all tags in a storage directory
    func listTags(in storageDirectoryId: String) throws -> [TagRecord] {
        return try dbQueue.read { db in
            let sql = "SELECT * FROM tags WHERE storage_directory_id = ? ORDER BY name ASC"
            return try TagRecord.fetchAll(db, sql: sql, arguments: [storageDirectoryId])
        }
    }

    /// Add a tag to a note
    func addTagToNote(noteId: String, tagId: String) throws {
        try dbQueue.write { db in
            let now = Date()
            let record = NoteTagRecord(
                noteId: noteId,
                tagId: tagId,
                createdAt: now
            )

            // Use insertOrIgnore to avoid errors if relationship already exists
            try record.insert(db)
        }
    }

    /// Remove a tag from a note
    func removeTagFromNote(noteId: String, tagId: String) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM note_tags WHERE note_id = ? AND tag_id = ?",
                arguments: [noteId, tagId]
            )
        }
    }

    /// Get all tags for a note
    func getTagsForNote(noteId: String) throws -> [TagRecord] {
        return try dbQueue.read { db in
            let sql = """
                SELECT t.* FROM tags t
                INNER JOIN note_tags nt ON t.id = nt.tag_id
                WHERE nt.note_id = ?
                ORDER BY t.name ASC
            """
            return try TagRecord.fetchAll(db, sql: sql, arguments: [noteId])
        }
    }

    /// Get all notes with a specific tag
    func getNotesWithTag(tagId: String) throws -> [NoteRecord] {
        return try dbQueue.read { db in
            let sql = """
                SELECT n.* FROM notes n
                INNER JOIN note_tags nt ON n.id = nt.note_id
                WHERE nt.tag_id = ? AND n.deleted_at IS NULL
                ORDER BY n.modified_at DESC
            """
            return try NoteRecord.fetchAll(db, sql: sql, arguments: [tagId])
        }
    }

    // MARK: - Transactions

    /// Execute a block within a transaction
    func transaction<T>(_ block: (Database) throws -> T) throws -> T {
        return try dbQueue.write(block)
    }
}
