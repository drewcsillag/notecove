import XCTest
@testable import NoteCove

final class UpdateFileManagerTests: XCTestCase {
    var manager: UpdateFileManager!
    var testInstanceId: String!

    override func setUp() {
        super.setUp()
        testInstanceId = "test-instance-123"
        manager = UpdateFileManager(instanceId: testInstanceId)
    }

    override func tearDown() {
        manager = nil
        testInstanceId = nil
        super.tearDown()
    }

    func testGenerateUpdateFilename() {
        // Given
        let noteId = "note-abc-123"
        let timestamp: Int64 = 1763219787329

        // When
        let filename = manager.generateUpdateFilename(noteId: noteId, timestamp: timestamp)

        // Then
        // Format should be: instanceId_noteId_timestamp-sequence.yjson
        XCTAssertTrue(filename.hasPrefix("\(testInstanceId)_\(noteId)_"))
        XCTAssertTrue(filename.hasSuffix(".yjson"))
        XCTAssertTrue(filename.contains("-"), "Should contain timestamp-sequence separator")
    }

    func testGenerateUpdateFilenameSequence() {
        // Given
        let noteId = "note-abc-123"

        // When: Generate multiple filenames for same note
        let filename1 = manager.generateUpdateFilename(noteId: noteId)
        let filename2 = manager.generateUpdateFilename(noteId: noteId)
        let filename3 = manager.generateUpdateFilename(noteId: noteId)

        // Then: Sequence numbers should increment
        let metadata1 = manager.parseUpdateFilename(filename1)!
        let metadata2 = manager.parseUpdateFilename(filename2)!
        let metadata3 = manager.parseUpdateFilename(filename3)!

        XCTAssertEqual(metadata1.sequence, 1)
        XCTAssertEqual(metadata2.sequence, 2)
        XCTAssertEqual(metadata3.sequence, 3)
    }

    func testGenerateUpdateFilenameIndependentSequences() {
        // Given
        let noteId1 = "note-1"
        let noteId2 = "note-2"

        // When: Generate filenames for different notes
        let filename1a = manager.generateUpdateFilename(noteId: noteId1)
        let filename2a = manager.generateUpdateFilename(noteId: noteId2)
        let filename1b = manager.generateUpdateFilename(noteId: noteId1)

        // Then: Each note should have independent sequence
        let metadata1a = manager.parseUpdateFilename(filename1a)!
        let metadata2a = manager.parseUpdateFilename(filename2a)!
        let metadata1b = manager.parseUpdateFilename(filename1b)!

        XCTAssertEqual(metadata1a.sequence, 1)
        XCTAssertEqual(metadata2a.sequence, 1)
        XCTAssertEqual(metadata1b.sequence, 2)
    }

    func testParseUpdateFilename() {
        // Given
        let filename = "inst-123_note-abc_1763219787329-42.yjson"

        // When
        let metadata = manager.parseUpdateFilename(filename)

        // Then
        XCTAssertNotNil(metadata)
        XCTAssertEqual(metadata?.instanceId, "inst-123")
        XCTAssertEqual(metadata?.noteId, "note-abc")
        XCTAssertEqual(metadata?.timestamp, 1763219787329)
        XCTAssertEqual(metadata?.sequence, 42)
    }

    func testParseUpdateFilenameWithUUIDsContainingHyphens() {
        // Given: Realistic filename with UUIDs
        let filename = "ab04da9a-7b4e-4a33-837d-886d70a7f1db_bc79c37b-8108-4bcd-a1da-8e684488b29c_1763219787329-129.yjson"

        // When
        let metadata = manager.parseUpdateFilename(filename)

        // Then
        XCTAssertNotNil(metadata)
        XCTAssertEqual(metadata?.instanceId, "ab04da9a-7b4e-4a33-837d-886d70a7f1db")
        XCTAssertEqual(metadata?.noteId, "bc79c37b-8108-4bcd-a1da-8e684488b29c")
        XCTAssertEqual(metadata?.timestamp, 1763219787329)
        XCTAssertEqual(metadata?.sequence, 129)
    }

    func testParseUpdateFilenameInvalid() {
        // Given: Invalid filenames
        let invalidFilenames = [
            "invalid.yjson",
            "no-timestamp.yjson",
            "inst_note.yjson",
            "inst_note_notimestamp.yjson",
            "inst_note_123.txt", // Wrong extension
        ]

        // When/Then
        for filename in invalidFilenames {
            let metadata = manager.parseUpdateFilename(filename)
            XCTAssertNil(metadata, "Should return nil for invalid filename: \(filename)")
        }
    }

    func testInitializeSequence() throws {
        // Given: A test directory with existing update files
        let tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("UpdateFileManagerTests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let noteId = "note-123"
        let fileIO = FileIOManager()

        // Create mock update files with various sequence numbers
        let existingFiles = [
            "\(testInstanceId)_\(noteId)_1763219787329-5.yjson",
            "\(testInstanceId)_\(noteId)_1763219787330-6.yjson",
            "\(testInstanceId)_\(noteId)_1763219787331-7.yjson",
            // File from different instance (should be ignored for sequence)
            "other-instance_\(noteId)_1763219787332-99.yjson",
        ]

        for filename in existingFiles {
            let filePath = tempDir.appendingPathComponent(filename).path
            try fileIO.atomicWrite(data: Data(), to: filePath)
        }

        // When: Initialize sequence by scanning directory
        try manager.initializeSequence(for: noteId, updatesDirectory: tempDir.path, fileIO: fileIO)

        // Then: Next sequence should be max + 1 (7 + 1 = 8)
        let nextFilename = manager.generateUpdateFilename(noteId: noteId)
        let metadata = manager.parseUpdateFilename(nextFilename)
        XCTAssertEqual(metadata?.sequence, 8, "Should start from max sequence + 1")
    }

    func testResetSequenceCounters() {
        // Given: Manager with sequence counters
        let noteId = "note-123"
        _ = manager.generateUpdateFilename(noteId: noteId) // seq 1
        _ = manager.generateUpdateFilename(noteId: noteId) // seq 2

        // When: Reset sequence counters
        manager.resetSequenceCounters()

        // Then: Should start from 1 again
        let filename = manager.generateUpdateFilename(noteId: noteId)
        let metadata = manager.parseUpdateFilename(filename)
        XCTAssertEqual(metadata?.sequence, 1)
    }
}
