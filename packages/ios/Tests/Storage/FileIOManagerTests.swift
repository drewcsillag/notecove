import XCTest
@testable import NoteCove

final class FileIOManagerTests: XCTestCase {
    var fileIO: FileIOManager!
    var testDirectory: URL!

    override func setUp() {
        super.setUp()
        fileIO = FileIOManager()

        // Create a temporary test directory
        let tempDir = FileManager.default.temporaryDirectory
        testDirectory = tempDir.appendingPathComponent("FileIOManagerTests-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: testDirectory, withIntermediateDirectories: true)
    }

    override func tearDown() {
        // Clean up test directory
        if let testDirectory = testDirectory {
            try? FileManager.default.removeItem(at: testDirectory)
        }
        super.tearDown()
    }

    // MARK: - Read File Tests

    func testReadFile() throws {
        // Given: A file with some content
        let testFile = testDirectory.appendingPathComponent("test.txt")
        let testData = "Hello, World!".data(using: .utf8)!
        try testData.write(to: testFile)

        // When: Reading the file
        let data = try fileIO.readFile(at: testFile.path)

        // Then: Data matches what was written
        XCTAssertEqual(data, testData)
    }

    func testReadFileNotFound() {
        // Given: A path to a non-existent file
        let nonExistentFile = testDirectory.appendingPathComponent("does-not-exist.txt")

        // When/Then: Reading should throw fileNotFound error
        XCTAssertThrowsError(try fileIO.readFile(at: nonExistentFile.path)) { error in
            guard case FileIOError.fileNotFound(let path) = error else {
                XCTFail("Expected fileNotFound error, got \(error)")
                return
            }
            XCTAssertEqual(path, nonExistentFile.path)
        }
    }

    // MARK: - Write File Tests

    func testWriteFile() throws {
        // Given: Some data to write
        let testFile = testDirectory.appendingPathComponent("write-test.txt")
        let testData = "Test data".data(using: .utf8)!

        // When: Writing the file
        try fileIO.writeFile(data: testData, to: testFile.path)

        // Then: File exists and contains the correct data
        XCTAssertTrue(FileManager.default.fileExists(atPath: testFile.path))
        let readData = try Data(contentsOf: testFile)
        XCTAssertEqual(readData, testData)
    }

    func testWriteFileOverwrite() throws {
        // Given: An existing file with some content
        let testFile = testDirectory.appendingPathComponent("overwrite-test.txt")
        let originalData = "Original".data(using: .utf8)!
        try originalData.write(to: testFile)

        // When: Overwriting the file
        let newData = "New content".data(using: .utf8)!
        try fileIO.writeFile(data: newData, to: testFile.path)

        // Then: File contains the new data
        let readData = try Data(contentsOf: testFile)
        XCTAssertEqual(readData, newData)
    }

    func testWriteFileCreatesParentDirectory() throws {
        // Given: A nested path where parent doesn't exist
        let nestedFile = testDirectory
            .appendingPathComponent("nested")
            .appendingPathComponent("deep")
            .appendingPathComponent("file.txt")
        let testData = "Nested data".data(using: .utf8)!

        // When: Writing to the nested path
        try fileIO.writeFile(data: testData, to: nestedFile.path)

        // Then: File and parent directories are created
        XCTAssertTrue(FileManager.default.fileExists(atPath: nestedFile.path))
        let readData = try Data(contentsOf: nestedFile)
        XCTAssertEqual(readData, testData)
    }

    // MARK: - Delete File Tests

    func testDeleteFile() throws {
        // Given: An existing file
        let testFile = testDirectory.appendingPathComponent("delete-test.txt")
        try "Delete me".data(using: .utf8)!.write(to: testFile)
        XCTAssertTrue(FileManager.default.fileExists(atPath: testFile.path))

        // When: Deleting the file
        try fileIO.deleteFile(at: testFile.path)

        // Then: File no longer exists
        XCTAssertFalse(FileManager.default.fileExists(atPath: testFile.path))
    }

    func testDeleteFileNotFound() {
        // Given: A path to a non-existent file
        let nonExistentFile = testDirectory.appendingPathComponent("does-not-exist.txt")

        // When/Then: Deleting should throw fileNotFound error
        XCTAssertThrowsError(try fileIO.deleteFile(at: nonExistentFile.path)) { error in
            guard case FileIOError.fileNotFound = error else {
                XCTFail("Expected fileNotFound error, got \(error)")
                return
            }
        }
    }

    // MARK: - File Exists Tests

    func testFileExists() throws {
        // Given: An existing file
        let testFile = testDirectory.appendingPathComponent("exists-test.txt")
        try "Exists".data(using: .utf8)!.write(to: testFile)

        // When/Then: fileExists returns true
        XCTAssertTrue(fileIO.fileExists(at: testFile.path))
    }

    func testFileDoesNotExist() {
        // Given: A path to a non-existent file
        let nonExistentFile = testDirectory.appendingPathComponent("does-not-exist.txt")

        // When/Then: fileExists returns false
        XCTAssertFalse(fileIO.fileExists(at: nonExistentFile.path))
    }

    // MARK: - Create Directory Tests

    func testCreateDirectory() throws {
        // Given: A path for a new directory
        let newDir = testDirectory.appendingPathComponent("new-directory")

        // When: Creating the directory
        try fileIO.createDirectory(at: newDir.path)

        // Then: Directory exists
        var isDirectory: ObjCBool = false
        XCTAssertTrue(FileManager.default.fileExists(atPath: newDir.path, isDirectory: &isDirectory))
        XCTAssertTrue(isDirectory.boolValue)
    }

    func testCreateDirectoryRecursive() throws {
        // Given: A nested path with multiple levels
        let nestedDir = testDirectory
            .appendingPathComponent("level1")
            .appendingPathComponent("level2")
            .appendingPathComponent("level3")

        // When: Creating the nested directory
        try fileIO.createDirectory(at: nestedDir.path)

        // Then: All levels are created
        var isDirectory: ObjCBool = false
        XCTAssertTrue(FileManager.default.fileExists(atPath: nestedDir.path, isDirectory: &isDirectory))
        XCTAssertTrue(isDirectory.boolValue)
    }

    // MARK: - List Files Tests

    func testListFiles() throws {
        // Given: A directory with multiple files
        let file1 = testDirectory.appendingPathComponent("file1.txt")
        let file2 = testDirectory.appendingPathComponent("file2.txt")
        let file3 = testDirectory.appendingPathComponent("file3.json")
        try "Content".data(using: .utf8)!.write(to: file1)
        try "Content".data(using: .utf8)!.write(to: file2)
        try "Content".data(using: .utf8)!.write(to: file3)

        // When: Listing files
        let files = try fileIO.listFiles(in: testDirectory.path)

        // Then: All files are returned and sorted
        XCTAssertEqual(files.count, 3)
        XCTAssertTrue(files.contains(file1.path))
        XCTAssertTrue(files.contains(file2.path))
        XCTAssertTrue(files.contains(file3.path))
        // Verify sorted order
        XCTAssertEqual(files, files.sorted())
    }

    func testListFilesWithPattern() throws {
        // Given: A directory with files of different extensions
        let txtFile1 = testDirectory.appendingPathComponent("file1.txt")
        let txtFile2 = testDirectory.appendingPathComponent("file2.txt")
        let jsonFile = testDirectory.appendingPathComponent("file.json")
        let yjsonFile = testDirectory.appendingPathComponent("note.yjson")
        try "Content".data(using: .utf8)!.write(to: txtFile1)
        try "Content".data(using: .utf8)!.write(to: txtFile2)
        try "Content".data(using: .utf8)!.write(to: jsonFile)
        try "Content".data(using: .utf8)!.write(to: yjsonFile)

        // When: Listing only .txt files
        let txtFiles = try fileIO.listFiles(in: testDirectory.path, matching: "*.txt")

        // Then: Only .txt files are returned
        XCTAssertEqual(txtFiles.count, 2)
        XCTAssertTrue(txtFiles.contains(txtFile1.path))
        XCTAssertTrue(txtFiles.contains(txtFile2.path))

        // When: Listing only .yjson files
        let yjsonFiles = try fileIO.listFiles(in: testDirectory.path, matching: "*.yjson")

        // Then: Only .yjson files are returned
        XCTAssertEqual(yjsonFiles.count, 1)
        XCTAssertTrue(yjsonFiles.contains(yjsonFile.path))
    }

    func testListFilesIgnoresDirectories() throws {
        // Given: A directory with files and subdirectories
        let file = testDirectory.appendingPathComponent("file.txt")
        let subdir = testDirectory.appendingPathComponent("subdir")
        try "Content".data(using: .utf8)!.write(to: file)
        try FileManager.default.createDirectory(at: subdir, withIntermediateDirectories: true)

        // When: Listing files
        let files = try fileIO.listFiles(in: testDirectory.path)

        // Then: Only the file is returned, not the directory
        XCTAssertEqual(files.count, 1)
        XCTAssertTrue(files.contains(file.path))
        XCTAssertFalse(files.contains(subdir.path))
    }

    func testListFilesInNonExistentDirectory() {
        // Given: A path to a non-existent directory
        let nonExistentDir = testDirectory.appendingPathComponent("does-not-exist")

        // When/Then: Listing should throw fileNotFound error
        XCTAssertThrowsError(try fileIO.listFiles(in: nonExistentDir.path)) { error in
            guard case FileIOError.fileNotFound = error else {
                XCTFail("Expected fileNotFound error, got \(error)")
                return
            }
        }
    }

    // MARK: - Atomic Write Tests

    func testAtomicWrite() throws {
        // Given: A file path and some data
        let testFile = testDirectory.appendingPathComponent("atomic-test.txt")
        let testData = "Atomic write test".data(using: .utf8)!

        // When: Writing atomically
        try fileIO.atomicWrite(data: testData, to: testFile.path)

        // Then: File exists and contains the correct data
        XCTAssertTrue(FileManager.default.fileExists(atPath: testFile.path))
        let readData = try Data(contentsOf: testFile)
        XCTAssertEqual(readData, testData)
    }

    func testAtomicWriteOverwrite() throws {
        // Given: An existing file with some content
        let testFile = testDirectory.appendingPathComponent("atomic-overwrite.txt")
        let originalData = "Original".data(using: .utf8)!
        try originalData.write(to: testFile)

        // When: Atomically overwriting the file
        let newData = "New atomic content".data(using: .utf8)!
        try fileIO.atomicWrite(data: newData, to: testFile.path)

        // Then: File contains the new data
        let readData = try Data(contentsOf: testFile)
        XCTAssertEqual(readData, newData)
    }

    func testAtomicWriteCreatesParentDirectory() throws {
        // Given: A nested path where parent doesn't exist
        let nestedFile = testDirectory
            .appendingPathComponent("nested")
            .appendingPathComponent("atomic")
            .appendingPathComponent("file.txt")
        let testData = "Nested atomic data".data(using: .utf8)!

        // When: Writing atomically to the nested path
        try fileIO.atomicWrite(data: testData, to: nestedFile.path)

        // Then: File and parent directories are created
        XCTAssertTrue(FileManager.default.fileExists(atPath: nestedFile.path))
        let readData = try Data(contentsOf: nestedFile)
        XCTAssertEqual(readData, testData)
    }

    func testAtomicWriteNoPartialWrites() throws {
        // Given: A file path
        let testFile = testDirectory.appendingPathComponent("partial-test.txt")
        let testData = "Should be written completely or not at all".data(using: .utf8)!

        // When: Writing atomically (this should succeed in normal circumstances)
        try fileIO.atomicWrite(data: testData, to: testFile.path)

        // Then: Either the file exists with complete data, or doesn't exist at all
        // (We can't easily simulate a partial write failure in a unit test,
        // but the atomic write mechanism ensures this property)
        if FileManager.default.fileExists(atPath: testFile.path) {
            let readData = try Data(contentsOf: testFile)
            XCTAssertEqual(readData, testData, "File should contain complete data")
        }

        // Verify no temporary files are left behind
        let parentDir = testDirectory!
        let contents = try FileManager.default.contentsOfDirectory(at: parentDir, includingPropertiesForKeys: nil)
        let tempFiles = contents.filter { $0.lastPathComponent.hasPrefix(".") && $0.lastPathComponent.contains(".tmp.") }
        XCTAssertEqual(tempFiles.count, 0, "No temporary files should remain")
    }

    // MARK: - Pattern Matching Tests

    func testPatternMatchingStar() throws {
        // Given: Files with various names
        let files = [
            "note.yjson",
            "document.yjson",
            "test.txt",
            "data.json"
        ]

        for fileName in files {
            let file = testDirectory.appendingPathComponent(fileName)
            try "Content".data(using: .utf8)!.write(to: file)
        }

        // When: Listing with wildcard pattern
        let yjsonFiles = try fileIO.listFiles(in: testDirectory.path, matching: "*.yjson")

        // Then: Only matching files are returned
        XCTAssertEqual(yjsonFiles.count, 2)
        XCTAssertTrue(yjsonFiles.contains { $0.hasSuffix("note.yjson") })
        XCTAssertTrue(yjsonFiles.contains { $0.hasSuffix("document.yjson") })
    }

    func testPatternMatchingQuestion() throws {
        // Given: Files with similar names
        let files = [
            "file1.txt",
            "file2.txt",
            "file10.txt",
            "test.txt"
        ]

        for fileName in files {
            let file = testDirectory.appendingPathComponent(fileName)
            try "Content".data(using: .utf8)!.write(to: file)
        }

        // When: Listing with ? pattern (matches single character)
        let matchedFiles = try fileIO.listFiles(in: testDirectory.path, matching: "file?.txt")

        // Then: Only single-digit files match
        XCTAssertEqual(matchedFiles.count, 2)
        XCTAssertTrue(matchedFiles.contains { $0.hasSuffix("file1.txt") })
        XCTAssertTrue(matchedFiles.contains { $0.hasSuffix("file2.txt") })
        XCTAssertFalse(matchedFiles.contains { $0.hasSuffix("file10.txt") })
    }
}
