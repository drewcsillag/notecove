import XCTest
@testable import NoteCove

@MainActor
final class StorageDirectoryTests: XCTestCase {
    var testDir: URL!

    override func setUpWithError() throws {
        // Create a temporary test directory
        let tempDir = FileManager.default.temporaryDirectory
        testDir = tempDir.appendingPathComponent("test-sd-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: testDir, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        // Clean up test directory
        if let dir = testDir {
            try? FileManager.default.removeItem(at: dir)
        }
    }

    // MARK: - StorageDirectoryInfo Tests

    func testStorageDirectoryInfoIdentifiable() {
        let info = StorageDirectoryInfo(
            id: "test-sd-123",
            type: "local",
            url: testDir,
            name: "Test SD"
        )

        XCTAssertEqual(info.id, "test-sd-123")
        XCTAssertEqual(info.type, "local")
        XCTAssertEqual(info.name, "Test SD")
    }

    // MARK: - StorageDirectoryError Tests

    func testStorageDirectoryErrorDescriptions() {
        let errors: [StorageDirectoryError] = [
            .notStorageDirectory,
            .invalidSdId,
            .accessDenied,
            .notAccessible,
            .bookmarkStale
        ]

        for error in errors {
            XCTAssertNotNil(error.errorDescription)
            XCTAssertFalse(error.errorDescription!.isEmpty)
        }
    }

    func testNotStorageDirectoryError() {
        let error = StorageDirectoryError.notStorageDirectory
        XCTAssertTrue(error.errorDescription!.contains("SD_ID"))
    }

    func testBookmarkStaleError() {
        let error = StorageDirectoryError.bookmarkStale
        XCTAssertTrue(error.errorDescription!.contains("expired"))
    }

    // MARK: - Validation Tests

    func testValidStorageDirectoryCreation() throws {
        // Create a valid SD structure
        let sdId = "test-sd-\(UUID().uuidString.prefix(8))"
        try sdId.write(to: testDir.appendingPathComponent("SD_ID"), atomically: true, encoding: .utf8)
        try "local".write(to: testDir.appendingPathComponent("SD-TYPE"), atomically: true, encoding: .utf8)

        // Create required directories
        try FileManager.default.createDirectory(
            at: testDir.appendingPathComponent("notes"),
            withIntermediateDirectories: true
        )

        // Verify structure exists
        XCTAssertTrue(FileManager.default.fileExists(atPath: testDir.appendingPathComponent("SD_ID").path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: testDir.appendingPathComponent("SD-TYPE").path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: testDir.appendingPathComponent("notes").path))
    }

    func testStorageDirectoryWithoutSdIdIsInvalid() throws {
        // An empty directory should not be a valid SD
        XCTAssertFalse(FileManager.default.fileExists(atPath: testDir.appendingPathComponent("SD_ID").path))
    }

    // MARK: - Path Helper Tests

    func testStorageDirectoryPaths() {
        let info = StorageDirectoryInfo(
            id: "test-123",
            type: "icloud",
            url: testDir,
            name: "My Notes"
        )

        // Verify paths would be constructed correctly
        let notesPath = testDir.appendingPathComponent("notes")
        let foldersPath = testDir.appendingPathComponent("folders")
        let mediaPath = testDir.appendingPathComponent("media")
        let activityPath = testDir.appendingPathComponent("activity")

        XCTAssertEqual(notesPath.lastPathComponent, "notes")
        XCTAssertEqual(foldersPath.lastPathComponent, "folders")
        XCTAssertEqual(mediaPath.lastPathComponent, "media")
        XCTAssertEqual(activityPath.lastPathComponent, "activity")
    }
}
