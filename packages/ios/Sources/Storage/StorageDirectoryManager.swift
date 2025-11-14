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
    /// - Parameter id: The storage directory ID
    /// - Returns: Absolute path to the storage directory
    func getStorageDirectoryPath(id: String) -> String {
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

    /// Ensure a specific note's directory exists
    /// - Parameters:
    ///   - storageId: The storage directory ID
    ///   - noteId: The note ID
    /// - Throws: FileIOError if directory creation fails
    func ensureNoteDirectoryExists(storageId: String, noteId: String) throws {
        // First ensure parent directories exist
        try ensureDirectoriesExist(storageId: storageId)

        // Then create note directory
        let noteDir = getNoteDirectory(storageId: storageId, noteId: noteId)
        let fileIO = FileIOManager(fileManager: fileManager)
        if !fileIO.fileExists(at: noteDir) {
            try fileIO.createDirectory(at: noteDir)
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
