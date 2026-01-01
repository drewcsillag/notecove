import Foundation
import GRDB

// MARK: - Schema Version

/// Database schema version
/// Matches desktop schema for compatibility
let schemaVersion = 11

// MARK: - Note Record

/// Note cache entry
/// Cached data extracted from CRDT for fast access
struct NoteRecord: Codable, FetchableRecord, PersistableRecord, Identifiable {
    var id: String
    var title: String
    var sdId: String
    var folderId: String?
    var created: Int64
    var modified: Int64
    var deleted: Bool
    var pinned: Bool
    var contentPreview: String
    var contentText: String

    static let databaseTableName = "notes"

    enum CodingKeys: String, CodingKey {
        case id, title
        case sdId = "sd_id"
        case folderId = "folder_id"
        case created, modified, deleted, pinned
        case contentPreview = "content_preview"
        case contentText = "content_text"
    }

    enum Columns: String, ColumnExpression {
        case id, title, sdId = "sd_id", folderId = "folder_id"
        case created, modified, deleted, pinned
        case contentPreview = "content_preview", contentText = "content_text"
    }
}

// MARK: - Folder Record

/// Folder cache entry
struct FolderRecord: Codable, FetchableRecord, PersistableRecord, Identifiable {
    var id: String
    var name: String
    var parentId: String?
    var sdId: String
    var order: Int
    var deleted: Bool

    static let databaseTableName = "folders"

    enum CodingKeys: String, CodingKey {
        case id, name
        case parentId = "parent_id"
        case sdId = "sd_id"
        case order, deleted
    }

    enum Columns: String, ColumnExpression {
        case id, name, parentId = "parent_id", sdId = "sd_id", order, deleted
    }
}

// MARK: - Storage Directory Record

/// Storage Directory entry
struct StorageDirRecord: Codable, FetchableRecord, PersistableRecord, Identifiable {
    var id: String
    var name: String
    var path: String
    var uuid: String?
    var created: Int64
    var isActive: Bool

    static let databaseTableName = "storage_dirs"

    enum CodingKeys: String, CodingKey {
        case id, name, path, uuid, created
        case isActive = "is_active"
    }

    enum Columns: String, ColumnExpression {
        case id, name, path, uuid, created, isActive = "is_active"
    }
}

// MARK: - Tag Record

/// Tag definition
struct TagRecord: Codable, FetchableRecord, PersistableRecord, Identifiable {
    var id: String
    var name: String

    static let databaseTableName = "tags"

    enum Columns: String, ColumnExpression {
        case id, name
    }
}

// MARK: - Note-Tag Association

/// Note-Tag association
struct NoteTagRecord: Codable, FetchableRecord, PersistableRecord {
    var noteId: String
    var tagId: String

    static let databaseTableName = "note_tags"

    enum CodingKeys: String, CodingKey {
        case noteId = "note_id"
        case tagId = "tag_id"
    }

    enum Columns: String, ColumnExpression {
        case noteId = "note_id", tagId = "tag_id"
    }
}

// MARK: - App State Record

/// App state key-value pairs
struct AppStateRecord: Codable, FetchableRecord, PersistableRecord {
    var key: String
    var value: String

    static let databaseTableName = "app_state"

    enum Columns: String, ColumnExpression {
        case key, value
    }
}

// MARK: - App State Keys

/// Common app state keys (subset relevant to iOS)
enum AppStateKey: String {
    case instanceId = "instanceId"
    case lastOpenedNote = "lastOpenedNote"
    case themeMode = "themeMode"
    case selectedFolderId = "selectedFolderId"
}

// MARK: - Schema Version Record

/// Schema version tracking
struct SchemaVersionRecord: Codable, FetchableRecord, PersistableRecord {
    var version: Int
    var appliedAt: Int64
    var description: String

    static let databaseTableName = "schema_version"

    enum CodingKeys: String, CodingKey {
        case version
        case appliedAt = "applied_at"
        case description
    }

    enum Columns: String, ColumnExpression {
        case version, appliedAt = "applied_at", description
    }
}

// MARK: - Note Sync State

/// Note sync state for CRDT documents
struct NoteSyncStateRecord: Codable, FetchableRecord, PersistableRecord {
    var noteId: String
    var sdId: String
    var vectorClock: String
    var documentState: Data
    var updatedAt: Int64

    static let databaseTableName = "note_sync_state"

    enum CodingKeys: String, CodingKey {
        case noteId = "note_id"
        case sdId = "sd_id"
        case vectorClock = "vector_clock"
        case documentState = "document_state"
        case updatedAt = "updated_at"
    }

    enum Columns: String, ColumnExpression {
        case noteId = "note_id", sdId = "sd_id", vectorClock = "vector_clock"
        case documentState = "document_state", updatedAt = "updated_at"
    }
}

// MARK: - Folder Sync State

/// Folder tree sync state
struct FolderSyncStateRecord: Codable, FetchableRecord, PersistableRecord {
    var sdId: String
    var vectorClock: String
    var documentState: Data
    var updatedAt: Int64

    static let databaseTableName = "folder_sync_state"

    enum CodingKeys: String, CodingKey {
        case sdId = "sd_id"
        case vectorClock = "vector_clock"
        case documentState = "document_state"
        case updatedAt = "updated_at"
    }

    enum Columns: String, ColumnExpression {
        case sdId = "sd_id", vectorClock = "vector_clock"
        case documentState = "document_state", updatedAt = "updated_at"
    }
}

// MARK: - Image Cache Record

/// Image metadata cache
struct ImageCacheRecord: Codable, FetchableRecord, PersistableRecord, Identifiable {
    var id: String
    var sdId: String
    var filename: String
    var mimeType: String
    var width: Int?
    var height: Int?
    var size: Int64
    var created: Int64

    static let databaseTableName = "images"

    enum CodingKeys: String, CodingKey {
        case id
        case sdId = "sd_id"
        case filename
        case mimeType = "mime_type"
        case width, height, size, created
    }

    enum Columns: String, ColumnExpression {
        case id, sdId = "sd_id", filename, mimeType = "mime_type"
        case width, height, size, created
    }
}

// MARK: - Activity Log State

/// Activity log consumption state
struct ActivityLogStateRecord: Codable, FetchableRecord, PersistableRecord {
    var sdId: String
    var instanceId: String
    var lastOffset: Int64
    var logFile: String

    static let databaseTableName = "activity_log_state"

    enum CodingKeys: String, CodingKey {
        case sdId = "sd_id"
        case instanceId = "instance_id"
        case lastOffset = "last_offset"
        case logFile = "log_file"
    }

    enum Columns: String, ColumnExpression {
        case sdId = "sd_id", instanceId = "instance_id"
        case lastOffset = "last_offset", logFile = "log_file"
    }
}

// MARK: - FTS5 Search Result

/// Search result from FTS5 query
struct SearchResult: Codable, FetchableRecord {
    var noteId: String
    var title: String
    var snippet: String
    var rank: Double

    enum CodingKeys: String, CodingKey {
        case noteId = "note_id"
        case title, snippet, rank
    }

    enum Columns: String, ColumnExpression {
        case noteId = "note_id", title, snippet, rank
    }
}
