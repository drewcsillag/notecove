import Foundation

/// Manages storage directory paths for NoteCove
/// Provides consistent path management for storage directories, notes, and folder trees
class StorageDirectoryManager {
    private let fileManager: FileManager

    /// Initialize with a custom FileManager (mainly for testing)
    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
    }

    // MARK: - Base Paths

    /// Get the app's documents directory
    /// This is where all user data is stored
    func getDocumentsDirectory() -> String {
        let paths = fileManager.urls(for: .documentDirectory, in: .userDomainMask)
        return paths[0].path
    }

    /// Get the base NoteCove data directory
    /// All storage directories are contained within this directory
    func getNoteCoveDataDirectory() -> String {
        let docsDir = getDocumentsDirectory()
        return "\(docsDir)/NoteCove"
    }

    // MARK: - Storage Directory Paths

    /// Get the path for a specific storage directory
    /// - Parameter id: The storage directory ID or absolute path
    /// - Returns: Absolute path to the storage directory
    func getStorageDirectoryPath(id: String) -> String {
        // If the id is already an absolute path, use it as-is
        // This supports cross-platform sync where Desktop uses absolute paths
        if id.hasPrefix("/") {
            return id
        }

        // Otherwise, treat as a storage ID and create path in app sandbox
        let dataDir = getNoteCoveDataDirectory()
        return "\(dataDir)/\(id)"
    }

    /// Get the notes directory within a storage directory
    /// - Parameter storageId: The storage directory ID
    /// - Returns: Absolute path to the notes directory
    func getNotesDirectory(storageId: String) -> String {
        let sdPath = getStorageDirectoryPath(id: storageId)
        return "\(sdPath)/notes"
    }

    /// Get the path for a specific note's directory
    /// - Parameters:
    ///   - storageId: The storage directory ID
    ///   - noteId: The note ID
    /// - Returns: Absolute path to the note's directory
    func getNoteDirectory(storageId: String, noteId: String) -> String {
        let notesDir = getNotesDirectory(storageId: storageId)
        return "\(notesDir)/\(noteId)"
    }

    /// Get the path for a note's updates directory
    /// - Parameters:
    ///   - storageId: The storage directory ID
    ///   - noteId: The note ID
    /// - Returns: Absolute path to the note's updates directory
    func getNoteUpdatesDirectory(storageId: String, noteId: String) -> String {
        let noteDir = getNoteDirectory(storageId: storageId, noteId: noteId)
        return "\(noteDir)/updates"
    }

    /// Get the path for a note's snapshots directory
    /// - Parameters:
    ///   - storageId: The storage directory ID
    ///   - noteId: The note ID
    /// - Returns: Absolute path to the note's snapshots directory
    func getNoteSnapshotsDirectory(storageId: String, noteId: String) -> String {
        let noteDir = getNoteDirectory(storageId: storageId, noteId: noteId)
        return "\(noteDir)/snapshots"
    }

    /// Get the path for a note's packs directory
    /// - Parameters:
    ///   - storageId: The storage directory ID
    ///   - noteId: The note ID
    /// - Returns: Absolute path to the note's packs directory
    func getNotePacksDirectory(storageId: String, noteId: String) -> String {
        let noteDir = getNoteDirectory(storageId: storageId, noteId: noteId)
        return "\(noteDir)/packs"
    }

    /// Get the path for a note's metadata directory
    /// - Parameters:
    ///   - storageId: The storage directory ID
    ///   - noteId: The note ID
    /// - Returns: Absolute path to the note's meta directory
    func getNoteMetaDirectory(storageId: String, noteId: String) -> String {
        let noteDir = getNoteDirectory(storageId: storageId, noteId: noteId)
        return "\(noteDir)/meta"
    }

    /// Get the folder tree file path for a storage directory
    /// - Parameter storageId: The storage directory ID
    /// - Returns: Absolute path to the folder-tree.yjson file
    func getFolderTreePath(storageId: String) -> String {
        let sdPath = getStorageDirectoryPath(id: storageId)
        return "\(sdPath)/folder-tree.yjson"
    }

    // MARK: - Directory Creation

    /// Ensure all necessary directories exist for a storage directory
    /// Creates the storage directory, notes directory, etc.
    /// - Parameter storageId: The storage directory ID
    /// - Throws: FileIOError if directory creation fails
    func ensureDirectoriesExist(storageId: String) throws {
        let fileIO = FileIOManager(fileManager: fileManager)

        // Create main NoteCove data directory
        let dataDir = getNoteCoveDataDirectory()
        if !fileIO.fileExists(at: dataDir) {
            try fileIO.createDirectory(at: dataDir)
        }

        // Create storage directory
        let sdPath = getStorageDirectoryPath(id: storageId)
        if !fileIO.fileExists(at: sdPath) {
            try fileIO.createDirectory(at: sdPath)
        }

        // Create notes directory
        let notesDir = getNotesDirectory(storageId: storageId)
        if !fileIO.fileExists(at: notesDir) {
            try fileIO.createDirectory(at: notesDir)
        }
    }

    /// Ensure a specific note's directory exists with all subdirectories
    /// Creates: noteId/, noteId/updates/, noteId/snapshots/, noteId/packs/, noteId/meta/
    /// - Parameters:
    ///   - storageId: The storage directory ID
    ///   - noteId: The note ID
    /// - Throws: FileIOError if directory creation fails
    func ensureNoteDirectoryExists(storageId: String, noteId: String) throws {
        // First ensure parent directories exist
        try ensureDirectoriesExist(storageId: storageId)

        let fileIO = FileIOManager(fileManager: fileManager)

        // Create note root directory
        let noteDir = getNoteDirectory(storageId: storageId, noteId: noteId)
        if !fileIO.fileExists(at: noteDir) {
            try fileIO.createDirectory(at: noteDir)
        }

        // Create subdirectories (matching desktop structure)
        let updatesDir = getNoteUpdatesDirectory(storageId: storageId, noteId: noteId)
        if !fileIO.fileExists(at: updatesDir) {
            try fileIO.createDirectory(at: updatesDir)
        }

        let snapshotsDir = getNoteSnapshotsDirectory(storageId: storageId, noteId: noteId)
        if !fileIO.fileExists(at: snapshotsDir) {
            try fileIO.createDirectory(at: snapshotsDir)
        }

        let packsDir = getNotePacksDirectory(storageId: storageId, noteId: noteId)
        if !fileIO.fileExists(at: packsDir) {
            try fileIO.createDirectory(at: packsDir)
        }

        let metaDir = getNoteMetaDirectory(storageId: storageId, noteId: noteId)
        if !fileIO.fileExists(at: metaDir) {
            try fileIO.createDirectory(at: metaDir)
        }
    }

    // MARK: - Storage Directory Listing

    /// List all storage directories
    /// - Returns: Array of storage directory IDs
    /// - Throws: FileIOError if listing fails
    func listStorageDirectories() throws -> [String] {
        let fileIO = FileIOManager(fileManager: fileManager)
        let dataDir = getNoteCoveDataDirectory()

        // If data directory doesn't exist yet, return empty array
        if !fileIO.fileExists(at: dataDir) {
            return []
        }

        // List all subdirectories
        let url = URL(fileURLWithPath: dataDir)
        let contents = try fileManager.contentsOfDirectory(
            at: url,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        )

        // Filter to only directories and extract names
        return contents.compactMap { url -> String? in
            var isDirectory: ObjCBool = false
            guard fileManager.fileExists(atPath: url.path, isDirectory: &isDirectory),
                  isDirectory.boolValue else {
                return nil
            }
            return url.lastPathComponent
        }.sorted()
    }

    /// Check if a storage directory exists
    /// - Parameter id: The storage directory ID
    /// - Returns: true if the storage directory exists
    func storageDirectoryExists(id: String) -> Bool {
        let fileIO = FileIOManager(fileManager: fileManager)
        return fileIO.fileExists(at: getStorageDirectoryPath(id: id))
    }
}
