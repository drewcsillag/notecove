import Foundation
import GRDB

/// Database schema for NoteCove
/// Defines all tables, indexes, and FTS5 virtual tables for the app
struct Schema {
    // MARK: - Schema Version

    static let currentVersion: Int = 1

    // MARK: - Migration

    /// Apply all database migrations
    static func migrate(_ writer: some DatabaseWriter) throws {
        var migrator = DatabaseMigrator()

        // Migration v1: Initial schema
        migrator.registerMigration("v1_initial_schema") { db in
            // Storage Directories table
            try db.create(table: "storage_directories") { t in
                t.column("id", .text).primaryKey()
                t.column("name", .text).notNull()
                t.column("path", .text).notNull()
                t.column("created_at", .datetime).notNull()
                t.column("modified_at", .datetime).notNull()
            }

            // Notes table (metadata only, not content)
            try db.create(table: "notes") { t in
                t.column("id", .text).primaryKey()
                t.column("storage_directory_id", .text).notNull()
                    .references("storage_directories", onDelete: .cascade)
                t.column("folder_id", .text) // null for root level notes
                t.column("title", .text).notNull()
                t.column("created_at", .datetime).notNull()
                t.column("modified_at", .datetime).notNull()
                t.column("deleted_at", .datetime) // null if not deleted
            }

            // Index for common queries
            try db.create(index: "idx_notes_storage_directory", on: "notes", columns: ["storage_directory_id"])
            try db.create(index: "idx_notes_folder", on: "notes", columns: ["folder_id"])
            try db.create(index: "idx_notes_deleted", on: "notes", columns: ["deleted_at"])
            try db.create(index: "idx_notes_modified", on: "notes", columns: ["modified_at"])

            // Full-text search for notes (FTS5)
            try db.create(virtualTable: "notes_fts", using: FTS5()) { t in
                t.column("note_id")
                t.column("title")
                t.column("content")
            }

            // Folders table
            try db.create(table: "folders") { t in
                t.column("id", .text).primaryKey()
                t.column("storage_directory_id", .text).notNull()
                    .references("storage_directories", onDelete: .cascade)
                t.column("parent_id", .text) // null for root level folders
                    .references("folders", onDelete: .cascade)
                t.column("name", .text).notNull()
                t.column("created_at", .datetime).notNull()
                t.column("modified_at", .datetime).notNull()
            }

            try db.create(index: "idx_folders_storage_directory", on: "folders", columns: ["storage_directory_id"])
            try db.create(index: "idx_folders_parent", on: "folders", columns: ["parent_id"])

            // Tags table
            try db.create(table: "tags") { t in
                t.column("id", .text).primaryKey()
                t.column("storage_directory_id", .text).notNull()
                    .references("storage_directories", onDelete: .cascade)
                t.column("name", .text).notNull()
                t.column("color", .text) // hex color code, null for default
                t.column("created_at", .datetime).notNull()
            }

            try db.create(index: "idx_tags_storage_directory", on: "tags", columns: ["storage_directory_id"])
            try db.create(index: "idx_tags_name", on: "tags", columns: ["name"])

            // Note-Tag relationships (many-to-many)
            try db.create(table: "note_tags") { t in
                t.column("note_id", .text).notNull()
                    .references("notes", onDelete: .cascade)
                t.column("tag_id", .text).notNull()
                    .references("tags", onDelete: .cascade)
                t.column("created_at", .datetime).notNull()

                t.primaryKey(["note_id", "tag_id"])
            }

            try db.create(index: "idx_note_tags_note", on: "note_tags", columns: ["note_id"])
            try db.create(index: "idx_note_tags_tag", on: "note_tags", columns: ["tag_id"])
        }

        try migrator.migrate(writer)
    }
}

// MARK: - Model Records

/// Storage Directory record
public struct StorageDirectoryRecord: Codable, FetchableRecord, PersistableRecord {
    public static let databaseTableName = "storage_directories"

    public var id: String
    public var name: String
    public var path: String
    public var createdAt: Date
    public var modifiedAt: Date

    public enum CodingKeys: String, CodingKey {
        case id
        case name
        case path
        case createdAt = "created_at"
        case modifiedAt = "modified_at"
    }
}

/// Note metadata record
struct NoteRecord: Codable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "notes"

    var id: String
    var storageDirectoryId: String
    var folderId: String?
    var title: String
    var createdAt: Date
    var modifiedAt: Date
    var deletedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case storageDirectoryId = "storage_directory_id"
        case folderId = "folder_id"
        case title
        case createdAt = "created_at"
        case modifiedAt = "modified_at"
        case deletedAt = "deleted_at"
    }
}

/// FTS5 search result
struct NoteSearchResult: Codable, FetchableRecord {
    var noteId: String
    var title: String
    var content: String
    var rank: Double

    enum CodingKeys: String, CodingKey {
        case noteId = "note_id"
        case title
        case content
        case rank
    }
}

/// Folder record
struct FolderRecord: Codable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "folders"

    var id: String
    var storageDirectoryId: String
    var parentId: String?
    var name: String
    var createdAt: Date
    var modifiedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case storageDirectoryId = "storage_directory_id"
        case parentId = "parent_id"
        case name
        case createdAt = "created_at"
        case modifiedAt = "modified_at"
    }
}

/// Tag record
struct TagRecord: Codable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "tags"

    var id: String
    var storageDirectoryId: String
    var name: String
    var color: String?
    var createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case storageDirectoryId = "storage_directory_id"
        case name
        case color
        case createdAt = "created_at"
    }
}

/// Note-Tag relationship record
struct NoteTagRecord: Codable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "note_tags"

    var noteId: String
    var tagId: String
    var createdAt: Date

    enum CodingKeys: String, CodingKey {
        case noteId = "note_id"
        case tagId = "tag_id"
        case createdAt = "created_at"
    }
}
