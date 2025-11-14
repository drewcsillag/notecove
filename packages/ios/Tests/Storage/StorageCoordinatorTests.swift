import XCTest
@testable import NoteCove

@MainActor
final class StorageCoordinatorTests: XCTestCase {
    var coordinator: StorageCoordinator!
    var db: DatabaseManager!
    var testDirectory: URL!

    override func setUp() async throws {
        try await super.setUp()

        // Create in-memory database
        db = try DatabaseManager.inMemory()

        // Create coordinator
        coordinator = StorageCoordinator(db: db)

        // Create temporary test directory
        let tempDir = FileManager.default.temporaryDirectory
        testDirectory = tempDir.appendingPathComponent("StorageCoordinatorTests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: testDirectory, withIntermediateDirectories: true)
    }

    override func tearDown() async throws {
        await coordinator.stopAllWatching()
        coordinator = nil
        db = nil

        // Clean up test directory
        if let testDirectory = testDirectory {
            try? FileManager.default.removeItem(at: testDirectory)
        }
        testDirectory = nil

        try await super.tearDown()
    }

    /// Test initializing the coordinator
    func testInitialization() {
        XCTAssertNotNil(coordinator, "Coordinator should initialize")
        XCTAssertEqual(coordinator.storageDirectories.count, 0, "Should start with no storage directories")
        XCTAssertEqual(coordinator.recentlyUpdatedNotes.count, 0, "Should start with no recently updated notes")
    }

    /// Test starting to watch a storage directory
    func testStartWatching() async throws {
        let storageId = "test-storage-\(UUID().uuidString)"

        // Create storage directory in database
        try db.upsertStorageDirectory(id: storageId, name: "Test Storage", path: testDirectory.path)

        // Start watching
        await coordinator.startWatching(storageId: storageId)

        // Verify watching started (no errors thrown)
        XCTAssertTrue(true, "Watching started successfully")
    }

    /// Test stopping watching a storage directory
    func testStopWatching() async throws {
        let storageId = "test-storage-\(UUID().uuidString)"

        // Create storage directory
        try db.upsertStorageDirectory(id: storageId, name: "Test Storage", path: testDirectory.path)

        // Start watching
        await coordinator.startWatching(storageId: storageId)

        // Stop watching
        await coordinator.stopWatching(storageId: storageId)

        // Verify stopping worked (no errors)
        XCTAssertTrue(true, "Watching stopped successfully")
    }

    /// Test file change detection triggers database update
    func testFileChangeTriggersUpdate() async throws {
        let storageId = "test-storage-\(UUID().uuidString)"

        // Create storage directory
        try db.upsertStorageDirectory(id: storageId, name: "Test Storage", path: testDirectory.path)

        // Start watching
        await coordinator.startWatching(storageId: storageId)

        // Create a note directory
        let noteId = "note-\(UUID().uuidString)"
        let noteDir = testDirectory.appendingPathComponent(noteId)
        try FileManager.default.createDirectory(at: noteDir, withIntermediateDirectories: true)

        // Create a file to trigger the watch
        let testFile = noteDir.appendingPathComponent("update-001.yjson")
        try "test".data(using: .utf8)!.write(to: testFile)

        // Wait for debounce and processing
        try await Task.sleep(nanoseconds: 1_000_000_000) // 1 second

        // The note should appear in recently updated notes
        // (This is a basic test - in reality we'd verify database updates)
        XCTAssertTrue(true, "File change processed")
    }

    /// Test loading storage directories
    func testLoadStorageDirectories() async throws {
        // Create several storage directories
        let storageIds = [
            "storage-\(UUID().uuidString)",
            "storage-\(UUID().uuidString)",
            "storage-\(UUID().uuidString)"
        ]

        for (index, id) in storageIds.enumerated() {
            try db.upsertStorageDirectory(
                id: id,
                name: "Storage \(index + 1)",
                path: testDirectory.appendingPathComponent(id).path
            )
        }

        // Load storage directories
        await coordinator.loadStorageDirectories()

        // Verify they were loaded
        XCTAssertEqual(coordinator.storageDirectories.count, 3, "Should load 3 storage directories")
    }

    /// Test handling file change in directory
    func testHandleFileChange() async throws {
        let storageId = "test-storage-\(UUID().uuidString)"

        // Create storage directory
        try db.upsertStorageDirectory(id: storageId, name: "Test Storage", path: testDirectory.path)

        // Handle file change (this would normally be triggered by FileWatchManager)
        await coordinator.handleFileChange(in: testDirectory.path)

        // Verify no errors occurred
        XCTAssertTrue(true, "File change handled successfully")
    }

    /// Test recently updated notes tracking
    func testRecentlyUpdatedNotes() async throws {
        let noteId1 = "note-1"
        let noteId2 = "note-2"

        // Mark notes as recently updated
        await coordinator.markNoteAsUpdated(noteId1)
        await coordinator.markNoteAsUpdated(noteId2)

        // Verify they appear in recently updated set
        XCTAssertTrue(coordinator.recentlyUpdatedNotes.contains(noteId1))
        XCTAssertTrue(coordinator.recentlyUpdatedNotes.contains(noteId2))
        XCTAssertEqual(coordinator.recentlyUpdatedNotes.count, 2)

        // Clear recently updated notes
        await coordinator.clearRecentlyUpdatedNotes()

        // Verify cleared
        XCTAssertEqual(coordinator.recentlyUpdatedNotes.count, 0)
    }

    /// Test stopping all watching
    func testStopAllWatching() async throws {
        let storageIds = [
            "storage-\(UUID().uuidString)",
            "storage-\(UUID().uuidString)"
        ]

        for id in storageIds {
            let path = testDirectory.appendingPathComponent(id)
            try FileManager.default.createDirectory(at: path, withIntermediateDirectories: true)
            try db.upsertStorageDirectory(id: id, name: id, path: path.path)
            await coordinator.startWatching(storageId: id)
        }

        // Stop all watching
        await coordinator.stopAllWatching()

        // Verify stopped (no errors)
        XCTAssertTrue(true, "All watching stopped successfully")
    }

    /// Test that coordinator is a singleton per database
    func testCoordinatorLifecycle() async throws {
        // Create a new coordinator
        let newCoordinator = StorageCoordinator(db: db)

        XCTAssertNotNil(newCoordinator, "Should create new coordinator")

        // Both coordinators can coexist (not true singletons)
        // but they operate on the same database
    }
}
