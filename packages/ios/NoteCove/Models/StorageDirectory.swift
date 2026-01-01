import Foundation

/// Represents a storage directory (SD) where notes are synced
struct StorageDirectory: Identifiable {
    let id: String
    let name: String
    let path: String
    let uuid: String?
    let createdAt: Date
    var isActive: Bool

    /// Read the SD_ID from the storage directory
    static func readSDId(from url: URL) -> String? {
        let sdIdURL = url.appendingPathComponent("SD_ID")
        guard let data = try? Data(contentsOf: sdIdURL),
              let content = String(data: data, encoding: .utf8) else {
            return nil
        }
        return content.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Check if a URL appears to be a valid NoteCove storage directory
    static func isValidStorageDirectory(_ url: URL) -> Bool {
        let sdIdURL = url.appendingPathComponent("SD_ID")
        let notesURL = url.appendingPathComponent("notes")
        let foldersURL = url.appendingPathComponent("folders")

        return FileManager.default.fileExists(atPath: sdIdURL.path) &&
               FileManager.default.fileExists(atPath: notesURL.path) &&
               FileManager.default.fileExists(atPath: foldersURL.path)
    }
}

// MARK: - Database Row Conversion

extension StorageDirectory {
    /// Initialize from database row (GRDB)
    init(row: [String: Any]) {
        self.id = row["id"] as? String ?? ""
        self.name = row["name"] as? String ?? ""
        self.path = row["path"] as? String ?? ""
        self.uuid = row["uuid"] as? String
        self.createdAt = Date(timeIntervalSince1970: TimeInterval(row["created"] as? Int ?? 0) / 1000)
        self.isActive = (row["is_active"] as? Int ?? 0) == 1
    }
}
