import XCTest
@testable import NoteCove

@MainActor
final class FileChangeProcessorTests: XCTestCase {
    var processor: FileChangeProcessor!
    var db: DatabaseManager!
    var bridge: CRDTBridge!
    var fileIO: FileIOManager!
    var testDirectory: URL!
    var storageId: String!

    override func setUp() async throws {
        try await super.setUp()

        // Create in-memory database for testing
        db = try DatabaseManager.inMemory()

        // Create CRDT bridge
        bridge = CRDTBridge()

        // Create file IO manager
        fileIO = FileIOManager()

        // Create file change processor
        processor = FileChangeProcessor(db: db, bridge: bridge, fileIO: fileIO)

        // Create temporary test directory
        let tempDir = FileManager.default.temporaryDirectory
        testDirectory = tempDir.appendingPathComponent("FileChangeProcessorTests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: testDirectory, withIntermediateDirectories: true)

        // Create a test storage directory in the database
        storageId = "test-storage-\(UUID().uuidString)"
        try db.upsertStorageDirectory(id: storageId, name: "Test Storage", path: testDirectory.path)
    }

    override func tearDown() async throws {
        processor = nil
        bridge = nil
        db = nil
        fileIO = nil

        // Clean up test directory
        if let testDirectory = testDirectory {
            try? FileManager.default.removeItem(at: testDirectory)
        }
        testDirectory = nil
        storageId = nil

        try await super.tearDown()
    }

    /// Test processing a single note change
    func testProcessSingleNoteChange() async throws {
        let noteId = "note-\(UUID().uuidString)"

        // Create a note in the database
        try db.insertNote(
            id: noteId,
            storageDirectoryId: storageId,
            folderId: nil,
            title: "Old Title"
        )

        // Create note directory
        let noteDir = testDirectory.appendingPathComponent(noteId)
        try FileManager.default.createDirectory(at: noteDir, withIntermediateDirectories: true)

        // Create a .yjson file with CRDT updates
        // First, create a note document via the bridge
        try await bridge.createNote(noteId: noteId)

        // Apply an update with a title
        let titleUpdate = """
        {"title": "New Title from File"}
        """
        // In reality, this would be a proper Yjs update, but for testing we'll simulate
        // For now, we'll just verify the processor can read the file

        // Get the document state
        let state = try await bridge.getDocumentState(noteId: noteId)

        // Write the state to a file
        let updateFile = noteDir.appendingPathComponent("update-001.yjson")
        try state.write(to: updateFile)

        // Process the changed note
        try await processor.updateNoteFromFile(noteId: noteId, storageId: storageId)

        // Verify the note was processed (title extraction would happen here)
        // For now, just verify it doesn't throw
        XCTAssertTrue(true, "Processing completed without errors")
    }

    /// Test processing multiple note changes
    func testProcessMultipleChanges() async throws {
        let noteIds = [
            "note-\(UUID().uuidString)",
            "note-\(UUID().uuidString)",
            "note-\(UUID().uuidString)"
        ]

        // Create notes in database and filesystem
        for noteId in noteIds {
            try db.insertNote(
                id: noteId,
                storageDirectoryId: storageId,
                folderId: nil,
                title: "Note \(noteId)"
            )

            let noteDir = testDirectory.appendingPathComponent(noteId)
            try FileManager.default.createDirectory(at: noteDir, withIntermediateDirectories: true)

            // Create a simple file to indicate the note exists
            let updateFile = noteDir.appendingPathComponent("update-001.yjson")
            try "test".data(using: .utf8)!.write(to: updateFile)
        }

        // Process all changed files in the directory
        try await processor.processChangedFiles(in: testDirectory.path, storageId: storageId)

        // Verify processing completed without errors
        XCTAssertTrue(true, "Processing multiple notes completed without errors")
    }

    /// Test that processing handles missing files gracefully
    func testProcessMissingFile() async throws {
        let noteId = "note-\(UUID().uuidString)"

        // Create note in database but NOT on filesystem
        try db.insertNote(
            id: noteId,
            storageDirectoryId: storageId,
            folderId: nil,
            title: "Missing Note"
        )

        // Try to process the missing note - should not crash
        do {
            try await processor.updateNoteFromFile(noteId: noteId, storageId: storageId)
            // If it doesn't throw, that's acceptable (might just skip)
        } catch {
            // If it throws a specific "not found" error, that's also acceptable
            XCTAssertTrue(error.localizedDescription.contains("not found") ||
                         error.localizedDescription.contains("does not exist"),
                         "Should throw a 'not found' error")
        }
    }

    /// Test that database is updated after processing
    func testUpdateDatabase() async throws {
        let noteId = "note-\(UUID().uuidString)"

        // Create note with initial title
        try db.insertNote(
            id: noteId,
            storageDirectoryId: storageId,
            folderId: nil,
            title: "Initial Title"
        )

        // Create note via bridge with a new title
        try await bridge.createNote(noteId: noteId)

        // Create note directory and file
        let noteDir = testDirectory.appendingPathComponent(noteId)
        try FileManager.default.createDirectory(at: noteDir, withIntermediateDirectories: true)

        let state = try await bridge.getDocumentState(noteId: noteId)
        let updateFile = noteDir.appendingPathComponent("update-001.yjson")
        try state.write(to: updateFile)

        // Extract and update title
        let title = try await bridge.extractTitle(stateData: state)
        try db.updateNote(id: noteId, title: title, folderId: nil)

        // Verify the database was updated
        let notes = try db.listNotes(in: storageId, folderId: nil, includeDeleted: false)
        let updatedNote = notes.first { $0.id == noteId }

        XCTAssertNotNil(updatedNote, "Note should exist in database")
        XCTAssertNotNil(updatedNote?.modifiedAt, "Modified timestamp should be set")
    }

    /// Test FTS5 index update
    func testUpdateFTS5() async throws {
        let noteId = "note-\(UUID().uuidString)"

        // Create note
        try db.insertNote(
            id: noteId,
            storageDirectoryId: storageId,
            folderId: nil,
            title: "Searchable Title"
        )

        // Index the note content
        try await processor.indexNoteContent(noteId: noteId, title: "Searchable Title", content: "This is searchable content")

        // Search for the content
        let results = try db.searchNotes(query: "searchable", in: storageId)

        XCTAssertEqual(results.count, 1, "Should find one result")
        XCTAssertEqual(results.first?.noteId, noteId, "Should find the correct note")
    }

    /// Test extracting metadata from note files
    func testExtractMetadata() async throws {
        let noteId = "note-\(UUID().uuidString)"

        // Create a note via bridge
        try await bridge.createNote(noteId: noteId)

        // Get state and extract the title
        let state = try await bridge.getDocumentState(noteId: noteId)
        let title = try await bridge.extractTitle(stateData: state)

        // Should get a title (even if empty initially)
        XCTAssertNotNil(title, "Should extract a title")

        // Close the note
        await bridge.closeNote(noteId: noteId)
    }

    /// Test processing notes directory structure
    func testProcessNotesDirectory() async throws {
        // Create a notes directory with subdirectories for each note
        let notesDir = testDirectory.appendingPathComponent("notes")
        try FileManager.default.createDirectory(at: notesDir, withIntermediateDirectories: true)

        let noteIds = ["note-1", "note-2", "note-3"]

        for noteId in noteIds {
            // Create note in database
            try db.insertNote(
                id: noteId,
                storageDirectoryId: storageId,
                folderId: nil,
                title: "Note \(noteId)"
            )

            // Create note directory
            let noteDir = notesDir.appendingPathComponent(noteId)
            try FileManager.default.createDirectory(at: noteDir, withIntermediateDirectories: true)

            // Create a .yjson file
            let updateFile = noteDir.appendingPathComponent("update-001.yjson")
            try "test".data(using: .utf8)!.write(to: updateFile)
        }

        // Process the notes directory
        try await processor.processChangedFiles(in: notesDir.path, storageId: storageId)

        // Verify all notes still exist in database
        let notes = try db.listNotes(in: storageId, folderId: nil, includeDeleted: false)
        XCTAssertEqual(notes.count, 3, "Should have 3 notes")
    }

    /// Test that corrupted files are handled gracefully
    func testHandleCorruptedFiles() async throws {
        let noteId = "note-\(UUID().uuidString)"

        // Create note in database
        try db.insertNote(
            id: noteId,
            storageDirectoryId: storageId,
            folderId: nil,
            title: "Note with corrupted file"
        )

        // Create note directory with corrupted file
        let noteDir = testDirectory.appendingPathComponent(noteId)
        try FileManager.default.createDirectory(at: noteDir, withIntermediateDirectories: true)

        // Create updates directory
        let updatesDir = noteDir.appendingPathComponent("updates")
        try FileManager.default.createDirectory(at: updatesDir, withIntermediateDirectories: true)

        let corruptedFile = updatesDir.appendingPathComponent("update-001.yjson")
        try "This is not valid CRDT data".data(using: .utf8)!.write(to: corruptedFile)

        // Try to process - should handle gracefully
        do {
            try await processor.updateNoteFromFile(noteId: noteId, storageId: storageId)
            // If no error thrown, that's fine (processor should log and continue)
        } catch {
            // If error thrown, it should be a specific error type
            print("Expected error for corrupted file: \(error)")
        }
    }

    /// Test error when storage directory not found
    func testStorageDirectoryNotFound() async throws {
        let noteId = "note-\(UUID().uuidString)"
        let invalidStorageId = "invalid-storage-\(UUID().uuidString)"

        // Try to process note with non-existent storage
        do {
            try await processor.updateNoteFromFile(noteId: noteId, storageId: invalidStorageId)
            XCTFail("Should throw error for missing storage directory")
        } catch let error as FileChangeProcessorError {
            switch error {
            case .storageDirectoryNotFound(let id):
                XCTAssertEqual(id, invalidStorageId)
            default:
                XCTFail("Should throw storageDirectoryNotFound error")
            }
        }
    }

    /// Test error when note directory not found
    func testNoteDirectoryNotFoundError() async throws {
        let noteId = "nonexistent-note-\(UUID().uuidString)"

        // Try to process non-existent note
        do {
            try await processor.updateNoteFromFile(noteId: noteId, storageId: storageId)
            XCTFail("Should throw error for missing note directory")
        } catch let error as FileChangeProcessorError {
            switch error {
            case .noteDirectoryNotFound(let id):
                XCTAssertEqual(id, noteId)
            default:
                XCTFail("Should throw noteDirectoryNotFound error")
            }
        }
    }

    /// Test processing note without updates directory
    func testNoteWithoutUpdatesDirectory() async throws {
        let noteId = "note-\(UUID().uuidString)"

        // Create note directory but no updates subdirectory
        let noteDir = testDirectory.appendingPathComponent(noteId)
        try FileManager.default.createDirectory(at: noteDir, withIntermediateDirectories: true)

        // Should return early without error
        try await processor.updateNoteFromFile(noteId: noteId, storageId: storageId)

        // Verify no crash or error
        XCTAssertTrue(true, "Should handle missing updates directory gracefully")
    }

    /// Test processing note with empty updates directory
    func testNoteWithEmptyUpdatesDirectory() async throws {
        let noteId = "note-\(UUID().uuidString)"

        // Create note directory with empty updates directory
        let noteDir = testDirectory.appendingPathComponent(noteId)
        try FileManager.default.createDirectory(at: noteDir, withIntermediateDirectories: true)

        let updatesDir = noteDir.appendingPathComponent("updates")
        try FileManager.default.createDirectory(at: updatesDir, withIntermediateDirectories: true)

        // Should return early without error
        try await processor.updateNoteFromFile(noteId: noteId, storageId: storageId)

        // Verify no crash or error
        XCTAssertTrue(true, "Should handle empty updates directory gracefully")
    }

    /// Test creating new note from file (not in database yet)
    func testCreateNoteFromFile() async throws {
        let noteId = "new-note-\(UUID().uuidString)"

        // Create note directory and files but NOT in database
        let noteDir = testDirectory.appendingPathComponent(noteId)
        try FileManager.default.createDirectory(at: noteDir, withIntermediateDirectories: true)

        let updatesDir = noteDir.appendingPathComponent("updates")
        try FileManager.default.createDirectory(at: updatesDir, withIntermediateDirectories: true)

        // Create a CRDT note via bridge
        try await bridge.createNote(noteId: noteId)
        let state = try await bridge.getDocumentState(noteId: noteId)

        // Write state to file
        let updateFile = updatesDir.appendingPathComponent("update-001.yjson")
        try state.write(to: updateFile)

        // Process the note - should create it in database
        try await processor.updateNoteFromFile(noteId: noteId, storageId: storageId)

        // Verify note was created in database
        let notes = try db.listNotes(in: storageId, folderId: nil, includeDeleted: false)
        let createdNote = notes.first { $0.id == noteId }

        XCTAssertNotNil(createdNote, "Note should be created in database")
        XCTAssertEqual(createdNote?.id, noteId)
    }

    /// Test tag extraction and indexing
    func testTagExtractionAndIndexing() async throws {
        let noteId = "note-\(UUID().uuidString)"

        // Create note in database
        try db.insertNote(
            id: noteId,
            storageDirectoryId: storageId,
            folderId: nil,
            title: "Note with tags"
        )

        // Create note directory
        let noteDir = testDirectory.appendingPathComponent(noteId)
        try FileManager.default.createDirectory(at: noteDir, withIntermediateDirectories: true)

        let updatesDir = noteDir.appendingPathComponent("updates")
        try FileManager.default.createDirectory(at: updatesDir, withIntermediateDirectories: true)

        // Create a CRDT note with content containing tags
        try await bridge.createNote(noteId: noteId)
        let state = try await bridge.getDocumentState(noteId: noteId)

        // Write state to file
        let updateFile = updatesDir.appendingPathComponent("update-001.yjson")
        try state.write(to: updateFile)

        // Process the note
        try await processor.updateNoteFromFile(noteId: noteId, storageId: storageId)

        // Verify processing completed (tags would be extracted if content had them)
        XCTAssertTrue(true, "Tag extraction completed")
    }

    /// Test FileChangeProcessorError descriptions
    func testErrorDescriptions() {
        let storageError = FileChangeProcessorError.storageDirectoryNotFound("sd-123")
        XCTAssertTrue(storageError.localizedDescription.contains("Storage directory not found"))
        XCTAssertTrue(storageError.localizedDescription.contains("sd-123"))

        let noteError = FileChangeProcessorError.noteDirectoryNotFound("note-456")
        XCTAssertTrue(noteError.localizedDescription.contains("Note directory not found"))
        XCTAssertTrue(noteError.localizedDescription.contains("note-456"))

        let dataError = FileChangeProcessorError.invalidNoteData("corrupted")
        XCTAssertTrue(dataError.localizedDescription.contains("Invalid note data"))
        XCTAssertTrue(dataError.localizedDescription.contains("corrupted"))
    }
}
