import Foundation

/// Represents a note in the database cache
struct Note: Identifiable, Hashable, Equatable {
    let id: String
    var title: String
    var preview: String
    var folderId: String?
    var createdAt: Date
    var modifiedAt: Date
    var isPinned: Bool

    // MARK: - Hashable

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: Note, rhs: Note) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Database Row Conversion

extension Note {
    /// Initialize from database row (GRDB)
    init(row: [String: Any]) {
        self.id = row["id"] as? String ?? ""
        self.title = row["title"] as? String ?? ""
        self.preview = row["content_preview"] as? String ?? ""
        self.folderId = row["folder_id"] as? String
        self.createdAt = Date(timeIntervalSince1970: TimeInterval(row["created"] as? Int ?? 0) / 1000)
        self.modifiedAt = Date(timeIntervalSince1970: TimeInterval(row["modified"] as? Int ?? 0) / 1000)
        self.isPinned = (row["pinned"] as? Int ?? 0) == 1
    }
}

// MARK: - CRDT Conversion

extension Note {
    /// Initialize from CRDT NoteInfo
    init(from noteInfo: NoteInfo) {
        self.id = noteInfo.id
        self.title = noteInfo.title
        self.preview = noteInfo.preview
        self.folderId = noteInfo.folderId
        self.createdAt = noteInfo.createdAt
        self.modifiedAt = noteInfo.modifiedAt
        self.isPinned = noteInfo.pinned
    }
}

// MARK: - Database Record Conversion

extension Note {
    /// Initialize from database NoteRecord
    init(from record: NoteRecord) {
        self.id = record.id
        self.title = record.title
        self.preview = record.contentPreview
        self.folderId = record.folderId
        self.createdAt = Date(timeIntervalSince1970: TimeInterval(record.created) / 1000)
        self.modifiedAt = Date(timeIntervalSince1970: TimeInterval(record.modified) / 1000)
        self.isPinned = record.pinned
    }
}
