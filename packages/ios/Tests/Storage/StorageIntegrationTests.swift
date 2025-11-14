import XCTest
import JavaScriptCore
@testable import NoteCove

@MainActor
final class StorageIntegrationTests: XCTestCase {
    var bridge: CRDTBridge!
    var testDirectory: URL!
    var storageManager: StorageDirectoryManager!

    override func setUp() {
        super.setUp()

        // Create CRDTBridge (loads JavaScript)
        bridge = CRDTBridge()

        // Create temporary test directory
        let tempDir = FileManager.default.temporaryDirectory
        testDirectory = tempDir.appendingPathComponent("StorageIntegrationTests-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: testDirectory, withIntermediateDirectories: true)

        storageManager = StorageDirectoryManager()
    }

    override func tearDown() {
        // Clean up test directory
        if let testDirectory = testDirectory {
            try? FileManager.default.removeItem(at: testDirectory)
        }
        super.tearDown()
    }

    // MARK: - Helper Methods

    /// Evaluate JavaScript code and return the result
    private func evalJS(_ script: String) -> Any? {
        guard let context = bridge.getContextForTesting() else {
            XCTFail("Could not access JSContext")
            return nil
        }

        let result = context.evaluateScript(script)
        if let exception = context.exception {
            XCTFail("JavaScript exception: \(exception)")
            return nil
        }

        if result?.isNull == true || result?.isUndefined == true {
            return nil
        }

        return result?.toObject()
    }

    /// Evaluate JavaScript and return boolean result
    private func evalJSBool(_ script: String) -> Bool {
        return evalJS(script) as? Bool ?? false
    }

    /// Evaluate JavaScript and return string result
    private func evalJSString(_ script: String) -> String? {
        return evalJS(script) as? String
    }

    /// Evaluate JavaScript and return array result
    private func evalJSArray(_ script: String) -> [Any]? {
        return evalJS(script) as? [Any]
    }

    // MARK: - File Write Tests

    func testWriteFileViaJavaScript() {
        // Given: A test file path and some data
        let testFile = testDirectory.appendingPathComponent("test-write.txt")
        let testContent = "Hello from JavaScript!"
        let testData = testContent.data(using: .utf8)!
        let base64 = testData.base64EncodedString()

        // When: Writing via JavaScript
        let success = evalJSBool("_swiftWriteFile('\(testFile.path)', '\(base64)')")

        // Then: Write succeeds and file exists
        XCTAssertTrue(success, "Write should succeed")
        XCTAssertTrue(FileManager.default.fileExists(atPath: testFile.path), "File should exist")

        // Verify contents
        let readData = try? Data(contentsOf: testFile)
        XCTAssertEqual(readData, testData, "File should contain the correct data")
    }

    func testWriteFileCreatesParentDirectories() {
        // Given: A nested path where parents don't exist
        let nestedFile = testDirectory
            .appendingPathComponent("level1")
            .appendingPathComponent("level2")
            .appendingPathComponent("file.txt")
        let testData = "Nested".data(using: .utf8)!
        let base64 = testData.base64EncodedString()

        // When: Writing via JavaScript
        let success = evalJSBool("_swiftWriteFile('\(nestedFile.path)', '\(base64)')")

        // Then: Write succeeds and file exists
        XCTAssertTrue(success, "Write should succeed")
        XCTAssertTrue(FileManager.default.fileExists(atPath: nestedFile.path), "File should exist")
    }

    // MARK: - File Read Tests

    func testReadFileViaJavaScript() {
        // Given: An existing file with data
        let testFile = testDirectory.appendingPathComponent("test-read.txt")
        let testContent = "Read me!"
        let testData = testContent.data(using: .utf8)!
        try! testData.write(to: testFile)

        // When: Reading via JavaScript
        let base64Result = evalJSString("_swiftReadFile('\(testFile.path)')")

        // Then: Read succeeds and data matches
        XCTAssertNotNil(base64Result, "Read should return data")
        let readData = Data(base64Encoded: base64Result!)
        XCTAssertEqual(readData, testData, "Read data should match written data")
    }

    func testReadNonExistentFileReturnsNull() {
        // Given: A path to a file that doesn't exist
        let nonExistentFile = testDirectory.appendingPathComponent("does-not-exist.txt")

        // When: Reading via JavaScript
        let result = evalJS("_swiftReadFile('\(nonExistentFile.path)')")

        // Then: Returns null
        XCTAssertNil(result, "Reading non-existent file should return null")
    }

    // MARK: - Round Trip Tests

    func testRoundTripViaJavaScript() {
        // Given: A test file path and data
        let testFile = testDirectory.appendingPathComponent("round-trip.txt")
        let testContent = "Round trip test!"
        let testData = testContent.data(using: .utf8)!
        let base64Write = testData.base64EncodedString()

        // When: Writing then reading via JavaScript
        let writeSuccess = evalJSBool("_swiftWriteFile('\(testFile.path)', '\(base64Write)')")
        let base64Read = evalJSString("_swiftReadFile('\(testFile.path)')")

        // Then: Both succeed and data matches
        XCTAssertTrue(writeSuccess, "Write should succeed")
        XCTAssertNotNil(base64Read, "Read should return data")

        let readData = Data(base64Encoded: base64Read!)
        XCTAssertEqual(readData, testData, "Round-trip data should match")
    }

    // MARK: - List Files Tests

    func testListFilesViaJavaScript() {
        // Given: A directory with multiple files
        let file1 = testDirectory.appendingPathComponent("file1.txt")
        let file2 = testDirectory.appendingPathComponent("file2.txt")
        let file3 = testDirectory.appendingPathComponent("file3.json")
        try! "Content".data(using: .utf8)!.write(to: file1)
        try! "Content".data(using: .utf8)!.write(to: file2)
        try! "Content".data(using: .utf8)!.write(to: file3)

        // When: Listing files via JavaScript (using '*' pattern to match all files)
        let files = evalJSArray("_swiftListFiles('\(testDirectory.path)', '*')")

        // Then: All files are returned
        XCTAssertNotNil(files, "List should return array")
        XCTAssertEqual(files?.count, 3, "Should list 3 files")

        let filePaths = files as? [String] ?? []
        XCTAssertTrue(filePaths.contains(file1.path), "Should include file1")
        XCTAssertTrue(filePaths.contains(file2.path), "Should include file2")
        XCTAssertTrue(filePaths.contains(file3.path), "Should include file3")
    }

    func testListFilesWithPatternViaJavaScript() {
        // Given: Files with different extensions
        let txtFile1 = testDirectory.appendingPathComponent("file1.txt")
        let txtFile2 = testDirectory.appendingPathComponent("file2.txt")
        let jsonFile = testDirectory.appendingPathComponent("file.json")
        try! "Content".data(using: .utf8)!.write(to: txtFile1)
        try! "Content".data(using: .utf8)!.write(to: txtFile2)
        try! "Content".data(using: .utf8)!.write(to: jsonFile)

        // When: Listing only .txt files via JavaScript
        let files = evalJSArray("_swiftListFiles('\(testDirectory.path)', '*.txt')")

        // Then: Only .txt files are returned
        XCTAssertNotNil(files, "List should return array")
        XCTAssertEqual(files?.count, 2, "Should list 2 .txt files")

        let filePaths = files as? [String] ?? []
        XCTAssertTrue(filePaths.contains(txtFile1.path), "Should include file1.txt")
        XCTAssertTrue(filePaths.contains(txtFile2.path), "Should include file2.txt")
        XCTAssertFalse(filePaths.contains(jsonFile.path), "Should not include .json file")
    }

    // MARK: - Delete File Tests

    func testDeleteFileViaJavaScript() {
        // Given: An existing file
        let testFile = testDirectory.appendingPathComponent("delete-me.txt")
        try! "Delete me".data(using: .utf8)!.write(to: testFile)
        XCTAssertTrue(FileManager.default.fileExists(atPath: testFile.path), "File should exist initially")

        // When: Deleting via JavaScript
        let success = evalJSBool("_swiftDeleteFile('\(testFile.path)')")

        // Then: Delete succeeds and file no longer exists
        XCTAssertTrue(success, "Delete should succeed")
        XCTAssertFalse(FileManager.default.fileExists(atPath: testFile.path), "File should not exist after delete")
    }

    func testDeleteNonExistentFileReturnsFalse() {
        // Given: A path to a file that doesn't exist
        let nonExistentFile = testDirectory.appendingPathComponent("does-not-exist.txt")

        // When: Deleting via JavaScript
        let success = evalJSBool("_swiftDeleteFile('\(nonExistentFile.path)')")

        // Then: Delete returns false
        XCTAssertFalse(success, "Deleting non-existent file should return false")
    }

    // MARK: - File Exists Tests

    func testFileExistsViaJavaScript() {
        // Given: An existing file and a non-existent file
        let existingFile = testDirectory.appendingPathComponent("exists.txt")
        let nonExistentFile = testDirectory.appendingPathComponent("does-not-exist.txt")
        try! "Exists".data(using: .utf8)!.write(to: existingFile)

        // When: Checking via JavaScript
        let existsTrue = evalJSBool("_swiftFileExists('\(existingFile.path)')")
        let existsFalse = evalJSBool("_swiftFileExists('\(nonExistentFile.path)')")

        // Then: Returns correct values
        XCTAssertTrue(existsTrue, "Should return true for existing file")
        XCTAssertFalse(existsFalse, "Should return false for non-existent file")
    }

    // MARK: - Create Directory Tests

    func testCreateDirectoryViaJavaScript() {
        // Given: A path for a new directory
        let newDir = testDirectory.appendingPathComponent("new-directory")

        // When: Creating via JavaScript
        let success = evalJSBool("_swiftCreateDirectory('\(newDir.path)')")

        // Then: Create succeeds and directory exists
        XCTAssertTrue(success, "Create should succeed")
        var isDirectory: ObjCBool = false
        XCTAssertTrue(FileManager.default.fileExists(atPath: newDir.path, isDirectory: &isDirectory), "Directory should exist")
        XCTAssertTrue(isDirectory.boolValue, "Path should be a directory")
    }

    func testCreateNestedDirectoryViaJavaScript() {
        // Given: A nested path
        let nestedDir = testDirectory
            .appendingPathComponent("level1")
            .appendingPathComponent("level2")
            .appendingPathComponent("level3")

        // When: Creating via JavaScript
        let success = evalJSBool("_swiftCreateDirectory('\(nestedDir.path)')")

        // Then: Create succeeds and all levels exist
        XCTAssertTrue(success, "Create should succeed")
        var isDirectory: ObjCBool = false
        XCTAssertTrue(FileManager.default.fileExists(atPath: nestedDir.path, isDirectory: &isDirectory), "Directory should exist")
        XCTAssertTrue(isDirectory.boolValue, "Path should be a directory")
    }

    // MARK: - StorageDirectoryManager Tests

    func testStorageDirectoryManagerPaths() {
        // Given: A storage ID
        let storageId = "test-storage-123"

        // When: Getting paths
        let sdPath = storageManager.getStorageDirectoryPath(id: storageId)
        let notesDir = storageManager.getNotesDirectory(storageId: storageId)
        let noteDir = storageManager.getNoteDirectory(storageId: storageId, noteId: "note-456")
        let folderTreePath = storageManager.getFolderTreePath(storageId: storageId)

        // Then: Paths are correct
        XCTAssertTrue(sdPath.hasSuffix("NoteCove/\(storageId)"), "Storage path should include ID")
        XCTAssertTrue(notesDir.hasSuffix("\(storageId)/notes"), "Notes dir should be under storage dir")
        XCTAssertTrue(noteDir.hasSuffix("\(storageId)/notes/note-456"), "Note dir should be under notes dir")
        XCTAssertTrue(folderTreePath.hasSuffix("\(storageId)/folder-tree.yjson"), "Folder tree should be in storage dir")
    }
}
