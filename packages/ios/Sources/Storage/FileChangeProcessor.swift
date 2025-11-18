import Foundation

/// Processes file system changes and updates the database accordingly.
///
/// When files change (detected by FileWatchManager), this processor:
/// 1. Loads CRDT updates from .yjson files
/// 2. Extracts metadata (title, content)
/// 3. Updates the database
/// 4. Updates the FTS5 search index
///
/// Example usage:
/// ```swift
/// let processor = FileChangeProcessor(db: dbManager, bridge: crdtBridge, fileIO: fileIO)
/// try await processor.processChangedFiles(in: "/path/to/notes", storageId: "storage-123")
/// ```
@MainActor
public class FileChangeProcessor {
    nonisolated(unsafe) private let db: DatabaseManager
    nonisolated(unsafe) private let bridge: CRDTBridge
    nonisolated(unsafe) private let fileIO: FileIOManager

    /// Creates a new file change processor
    /// - Parameters:
    ///   - db: Database manager for storing metadata
    ///   - bridge: CRDT bridge for loading and parsing note documents
    ///   - fileIO: File IO manager for reading files
    nonisolated public init(db: DatabaseManager, bridge: CRDTBridge, fileIO: FileIOManager) {
        self.db = db
        self.bridge = bridge
        self.fileIO = fileIO
    }

    /// Processes all changed files in a directory, updating the database
    /// - Parameters:
    ///   - directory: The directory path to scan for changes
    ///   - storageId: The storage directory ID these notes belong to
    public func processChangedFiles(in directory: String, storageId: String) async throws {
        print("[FileChangeProcessor] Processing changes in: \(directory)")

        // List all subdirectories (each subdirectory is a note)
        let url = URL(fileURLWithPath: directory)
        guard let contents = try? FileManager.default.contentsOfDirectory(
            at: url,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            print("[FileChangeProcessor] Could not read directory: \(directory)")
            return
        }

        // Filter to only directories (each note has its own directory)
        let noteDirectories = contents.filter { url in
            var isDirectory: ObjCBool = false
            FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory)
            return isDirectory.boolValue
        }

        print("[FileChangeProcessor] Found \(noteDirectories.count) note directories")

        // Process each note directory
        for noteDir in noteDirectories {
            let noteId = noteDir.lastPathComponent

            do {
                try await updateNoteFromFile(noteId: noteId, storageId: storageId)
            } catch {
                print("[FileChangeProcessor] Error processing note \(noteId): \(error)")
                // Continue processing other notes even if one fails
            }
        }

        print("[FileChangeProcessor] Finished processing changes")
    }

    /// Updates a single note from its file system representation
    /// - Parameters:
    ///   - noteId: The note ID to update
    ///   - storageId: The storage directory ID this note belongs to
    public func updateNoteFromFile(noteId: String, storageId: String) async throws {
        print("[FileChangeProcessor] Updating note from file: \(noteId)")

        // Get the storage directory info
        guard let storageDir = try db.getStorageDirectory(id: storageId) else {
            throw FileChangeProcessorError.storageDirectoryNotFound(storageId)
        }

        // Construct the note directory path
        let notePath = URL(fileURLWithPath: storageDir.path)
            .appendingPathComponent(noteId)
            .path

        // Verify the note directory exists
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: notePath, isDirectory: &isDirectory),
              isDirectory.boolValue else {
            throw FileChangeProcessorError.noteDirectoryNotFound(noteId)
        }

        // List all .yjson files in the note's updates directory
        let updatesPath = URL(fileURLWithPath: notePath)
            .appendingPathComponent("updates")
            .path

        // Check if updates directory exists
        isDirectory = false
        guard FileManager.default.fileExists(atPath: updatesPath, isDirectory: &isDirectory),
              isDirectory.boolValue else {
            print("[FileChangeProcessor] No updates directory found for note: \(noteId)")
            return
        }

        let yjsonFiles = try fileIO.listFiles(in: updatesPath, matching: "*.yjson")

        guard !yjsonFiles.isEmpty else {
            print("[FileChangeProcessor] No .yjson files found in updates directory for note: \(noteId)")
            return
        }

        // Load the note document via the bridge
        // First, check if it's already open
        let openCount = bridge.getOpenDocumentCount()
        print("[FileChangeProcessor] Currently \(openCount) documents open")

        // Create or reopen the note
        do {
            try bridge.createNote(noteId: noteId)
        } catch {
            // Note might already be open, which is fine
            print("[FileChangeProcessor] Note already open or error creating: \(error)")
        }

        // Apply updates from the files (in sorted order)
        for fileName in yjsonFiles.sorted() {
            let filePath = URL(fileURLWithPath: updatesPath)
                .appendingPathComponent(fileName)
                .path

            // Read the update file
            guard let updateData = try? fileIO.readFile(at: filePath) else {
                print("[FileChangeProcessor] Could not read file: \(filePath)")
                continue
            }

            // Apply the update to the note
            do {
                try bridge.applyUpdate(noteId: noteId, updateData: updateData)
            } catch {
                print("[FileChangeProcessor] Error applying update from \(fileName): \(error)")
                // Continue with other updates
            }
        }

        // Extract metadata from the document
        let state = try bridge.getDocumentState(noteId: noteId)
        let title = try bridge.extractTitle(stateData: state)
        print("[FileChangeProcessor] Extracted title: \(title)")

        // Extract content for indexing and tag extraction
        let content = try bridge.extractContent(stateData: state)

        // Update the database
        // Check if note exists in database
        let existingNotes = try db.listNotes(in: storageId, folderId: nil, includeDeleted: true)
        let noteExists = existingNotes.contains { $0.id == noteId }

        if noteExists {
            try db.updateNote(
                id: noteId,
                title: title,
                folderId: nil
            )
        } else {
            try db.insertNote(
                id: noteId,
                storageDirectoryId: storageId,
                folderId: nil,
                title: title
            )
        }

        // Update the FTS5 index
        try await indexNoteContent(noteId: noteId, title: title, content: content)

        // Extract and index tags
        let tags = TagExtractor.extractTags(from: content)
        try db.reindexTags(for: noteId, in: storageId, tags: tags)
        print("[FileChangeProcessor] Re-indexed \(tags.count) tags for note: \(noteId)")

        print("[FileChangeProcessor] Successfully updated note: \(noteId)")
    }

    /// Updates the FTS5 search index for a note
    /// - Parameters:
    ///   - noteId: The note ID to index
    ///   - title: The note title
    ///   - content: The note content
    public func indexNoteContent(noteId: String, title: String, content: String) async throws {
        try db.indexNoteContent(noteId: noteId, title: title, content: content)
        print("[FileChangeProcessor] Indexed content for note: \(noteId)")
    }

    /// Scans an entire storage directory for notes
    ///
    /// This simulates what happens when:
    /// - The app first launches
    /// - A storage directory is first added
    /// - The user manually refreshes
    ///
    /// It discovers all notes by scanning the notes/ subdirectory
    ///
    /// - Parameter storageId: The storage directory ID to scan
    public func scanStorageDirectory(storageId: String) async throws {
        print("[FileChangeProcessor] Scanning storage directory: \(storageId)")

        // Get storage directory path
        guard let sd = try? db.getStorageDirectory(id: storageId) else {
            throw FileChangeProcessorError.storageDirectoryNotFound(storageId)
        }

        let notesDir = "\(sd.path)/notes"

        // Check if notes directory exists
        guard fileIO.fileExists(at: notesDir) else {
            print("[FileChangeProcessor] Notes directory doesn't exist yet: \(notesDir)")
            return
        }

        // Process all notes in the directory
        try await processChangedFiles(in: notesDir, storageId: storageId)
    }
}

/// Errors that can occur during file change processing
public enum FileChangeProcessorError: Error, LocalizedError {
    case storageDirectoryNotFound(String)
    case noteDirectoryNotFound(String)
    case invalidNoteData(String)

    public var errorDescription: String? {
        switch self {
        case .storageDirectoryNotFound(let id):
            return "Storage directory not found: \(id)"
        case .noteDirectoryNotFound(let id):
            return "Note directory not found: \(id)"
        case .invalidNoteData(let reason):
            return "Invalid note data: \(reason)"
        }
    }
}
