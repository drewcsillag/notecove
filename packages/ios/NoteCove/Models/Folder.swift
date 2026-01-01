import Foundation

/// Represents a folder in the hierarchy
struct Folder: Identifiable, Hashable, Equatable {
    let id: String
    var name: String
    var parentId: String?
    var order: Int

    // MARK: - Hashable

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: Folder, rhs: Folder) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Database Row Conversion

extension Folder {
    /// Initialize from database row (GRDB)
    init(row: [String: Any]) {
        self.id = row["id"] as? String ?? ""
        self.name = row["name"] as? String ?? ""
        self.parentId = row["parent_id"] as? String
        self.order = row["order"] as? Int ?? 0
    }
}

// MARK: - CRDT Conversion

extension Folder {
    /// Initialize from CRDT FolderInfo
    init(from folderInfo: FolderInfo) {
        self.id = folderInfo.id
        self.name = folderInfo.name
        self.parentId = folderInfo.parentId
        self.order = folderInfo.order
    }
}
