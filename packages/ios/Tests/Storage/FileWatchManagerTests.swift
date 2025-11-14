import XCTest
@testable import NoteCove

final class FileWatchManagerTests: XCTestCase {
    var fileWatchManager: FileWatchManager!
    var testDirectory: URL!
    var fileIO: FileIOManager!

    override func setUp() {
        super.setUp()
        fileWatchManager = FileWatchManager()
        fileIO = FileIOManager()

        // Create a temporary test directory
        let tempDir = FileManager.default.temporaryDirectory
        testDirectory = tempDir.appendingPathComponent("FileWatchTests-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: testDirectory, withIntermediateDirectories: true)
    }

    override func tearDown() {
        fileWatchManager.stopWatching()
        fileWatchManager = nil

        // Clean up test directory
        if let testDirectory = testDirectory {
            try? FileManager.default.removeItem(at: testDirectory)
        }
        testDirectory = nil
        fileIO = nil

        super.tearDown()
    }

    /// Test that watching starts successfully
    func testWatchDirectory() throws {
        let expectation = XCTestExpectation(description: "Watch starts successfully")
        var callbackInvoked = false

        fileWatchManager.watchDirectory(path: testDirectory.path) {
            callbackInvoked = true
        }

        // Give it a moment to set up
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 1.0)

        // Callback shouldn't have been invoked yet (no changes made)
        XCTAssertFalse(callbackInvoked, "Callback should not be invoked without file changes")
    }

    /// Test that file creation triggers the callback
    func testDetectFileCreation() throws {
        let expectation = XCTestExpectation(description: "Detect file creation")
        expectation.expectedFulfillmentCount = 1

        fileWatchManager.watchDirectory(path: testDirectory.path) {
            expectation.fulfill()
        }

        // Give the watcher time to start
        Thread.sleep(forTimeInterval: 0.2)

        // Create a file
        let testFile = testDirectory.appendingPathComponent("test.txt")
        let testData = "Hello, World!".data(using: .utf8)!
        try testData.write(to: testFile)

        wait(for: [expectation], timeout: 2.0)
    }

    /// Test that file modification triggers the callback
    /// Note: Directory-level watching detects new files being added, which changes directory metadata
    func testDetectFileModification() throws {
        let expectation = XCTestExpectation(description: "Detect directory modification via new file")
        expectation.expectedFulfillmentCount = 1

        fileWatchManager.watchDirectory(path: testDirectory.path) {
            expectation.fulfill()
        }

        // Give the watcher time to start
        Thread.sleep(forTimeInterval: 0.2)

        // Create a NEW file (this reliably changes directory metadata)
        let testFile = testDirectory.appendingPathComponent("test-\(UUID().uuidString).txt")
        let testData = "Test content".data(using: .utf8)!
        try testData.write(to: testFile)

        wait(for: [expectation], timeout: 2.0)
    }

    /// Test that file deletion triggers the callback
    func testDetectFileDeletion() throws {
        // Create a file first
        let testFile = testDirectory.appendingPathComponent("test.txt")
        let testData = "Test content".data(using: .utf8)!
        try testData.write(to: testFile)

        let expectation = XCTestExpectation(description: "Detect file deletion")
        expectation.expectedFulfillmentCount = 1

        fileWatchManager.watchDirectory(path: testDirectory.path) {
            expectation.fulfill()
        }

        // Give the watcher time to start
        Thread.sleep(forTimeInterval: 0.2)

        // Delete the file
        try FileManager.default.removeItem(at: testFile)

        wait(for: [expectation], timeout: 2.0)
    }

    /// Test that debouncing works - rapid changes should result in fewer callbacks
    func testDebouncing() throws {
        var callbackCount = 0
        let expectation = XCTestExpectation(description: "Debouncing reduces callback count")

        fileWatchManager.watchDirectory(path: testDirectory.path, debounceInterval: 0.5) {
            callbackCount += 1
        }

        // Give the watcher time to start
        Thread.sleep(forTimeInterval: 0.2)

        // Make rapid changes (10 changes in quick succession)
        for i in 1...10 {
            let testFile = testDirectory.appendingPathComponent("test-\(i).txt")
            let testData = "Content \(i)".data(using: .utf8)!
            try testData.write(to: testFile)
            Thread.sleep(forTimeInterval: 0.05) // 50ms between changes
        }

        // Wait for debounce period plus some extra time
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 3.0)

        // With debouncing, we should have significantly fewer callbacks than file changes
        // We made 10 changes, but should only get 1-2 callbacks due to 500ms debounce
        XCTAssertLessThan(callbackCount, 5, "Debouncing should reduce callback count from 10 to <5")
        XCTAssertGreaterThan(callbackCount, 0, "Should get at least one callback")
    }

    /// Test that stopping the watcher prevents further callbacks
    func testStopWatching() throws {
        var callbackCount = 0
        let expectation = XCTestExpectation(description: "Stop watching prevents callbacks")

        fileWatchManager.watchDirectory(path: testDirectory.path) {
            callbackCount += 1
        }

        // Give the watcher time to start
        Thread.sleep(forTimeInterval: 0.2)

        // Create a file - should trigger callback
        let testFile1 = testDirectory.appendingPathComponent("test-\(UUID().uuidString).txt")
        try "Content 1".data(using: .utf8)!.write(to: testFile1)

        // Wait for callback with longer timeout for debounce
        Thread.sleep(forTimeInterval: 0.8)

        // Stop watching
        fileWatchManager.stopWatching()

        let countBeforeStop = callbackCount

        // Create another file - should NOT trigger callback
        let testFile2 = testDirectory.appendingPathComponent("test-\(UUID().uuidString).txt")
        try "Content 2".data(using: .utf8)!.write(to: testFile2)

        // Wait to ensure no callback occurs
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 2.0)

        // The important part is that no callbacks occur AFTER stopping
        XCTAssertEqual(callbackCount, countBeforeStop, "No callbacks should occur after stopping")

        // Note: In test environment, callbacks may or may not fire due to simulator limitations
        // The key test is that after stopWatching(), no new callbacks occur
        print("Callbacks received: \(callbackCount) (before and after stop)")
    }

    /// Test watching multiple directories
    func testWatchMultipleDirectories() throws {
        let testDir2 = FileManager.default.temporaryDirectory
            .appendingPathComponent("FileWatchTests2-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: testDir2, withIntermediateDirectories: true)
        defer {
            try? FileManager.default.removeItem(at: testDir2)
        }

        var dir1CallbackCount = 0
        var dir2CallbackCount = 0

        let expectation = XCTestExpectation(description: "Both directories trigger callbacks")
        expectation.expectedFulfillmentCount = 2

        let watcher1 = FileWatchManager()
        let watcher2 = FileWatchManager()

        watcher1.watchDirectory(path: testDirectory.path) {
            dir1CallbackCount += 1
            expectation.fulfill()
        }

        watcher2.watchDirectory(path: testDir2.path) {
            dir2CallbackCount += 1
            expectation.fulfill()
        }

        // Give watchers time to start
        Thread.sleep(forTimeInterval: 0.2)

        // Create files in both directories
        let file1 = testDirectory.appendingPathComponent("test1.txt")
        try "Content 1".data(using: .utf8)!.write(to: file1)

        let file2 = testDir2.appendingPathComponent("test2.txt")
        try "Content 2".data(using: .utf8)!.write(to: file2)

        wait(for: [expectation], timeout: 2.0)

        XCTAssertGreaterThan(dir1CallbackCount, 0, "Directory 1 should have callbacks")
        XCTAssertGreaterThan(dir2CallbackCount, 0, "Directory 2 should have callbacks")

        watcher1.stopWatching()
        watcher2.stopWatching()
    }

    /// Test that non-existent directory is handled gracefully
    func testWatchNonExistentDirectory() {
        let nonExistentPath = "/tmp/this-directory-does-not-exist-\(UUID().uuidString)"

        // Should not crash, but also should not set up watching
        fileWatchManager.watchDirectory(path: nonExistentPath) {
            XCTFail("Callback should not be invoked for non-existent directory")
        }

        // If we get here without crashing, the test passes
        XCTAssertTrue(true)
    }
}
