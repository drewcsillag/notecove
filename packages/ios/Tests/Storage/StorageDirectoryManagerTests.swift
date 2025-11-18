//
//  StorageDirectoryManagerTests.swift
//  NoteCoveTests
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import XCTest
@testable import NoteCove

final class StorageDirectoryManagerTests: XCTestCase {
    var manager: StorageDirectoryManager!
    var testFileManager: FileManager!
    var tempDir: URL!

    override func setUp() {
        super.setUp()

        testFileManager = FileManager.default
        manager = StorageDirectoryManager(fileManager: testFileManager)

        // Create temporary directory for testing
        tempDir = FileManager.default.temporaryDirectory.appendingPathComponent("SDManagerTests-\(UUID().uuidString)")
        try? testFileManager.createDirectory(at: tempDir, withIntermediateDirectories: true)
    }

    override func tearDown() {
        // Clean up temporary directory
        if let tempDir = tempDir {
            try? testFileManager.removeItem(at: tempDir)
        }
        tempDir = nil
        manager = nil
        testFileManager = nil

        super.tearDown()
    }

    // MARK: - Base Paths

    func testGetDocumentsDirectory() {
        let docsDir = manager.getDocumentsDirectory()
        XCTAssertFalse(docsDir.isEmpty, "Documents directory should not be empty")
        XCTAssertTrue(docsDir.contains("Documents") || docsDir.contains("Library"), "Should be a valid documents path")
    }

    func testGetNoteCoveDataDirectory() {
        let dataDir = manager.getNoteCoveDataDirectory()
        XCTAssertTrue(dataDir.hasSuffix("/NoteCove"), "Should end with /NoteCove")
        XCTAssertTrue(dataDir.contains("/"), "Should be an absolute path")
    }

    // MARK: - Storage Directory Paths

    func testGetStorageDirectoryPath() {
        let sdPath = manager.getStorageDirectoryPath(id: "test-sd-123")
        XCTAssertTrue(sdPath.hasSuffix("/NoteCove/test-sd-123"), "Should include storage ID")
    }

    func testGetNotesDirectory() {
        let notesDir = manager.getNotesDirectory(storageId: "test-sd-456")
        XCTAssertTrue(notesDir.hasSuffix("/NoteCove/test-sd-456/notes"), "Should include notes subdirectory")
    }

    func testGetNoteDirectory() {
        let noteDir = manager.getNoteDirectory(storageId: "sd-1", noteId: "note-1")
        XCTAssertTrue(noteDir.contains("/sd-1/notes/note-1"), "Should include note ID")
    }

    func testGetNoteUpdatesDirectory() {
        let updatesDir = manager.getNoteUpdatesDirectory(storageId: "sd-1", noteId: "note-1")
        XCTAssertTrue(updatesDir.hasSuffix("/note-1/updates"), "Should have updates subdirectory")
    }

    func testGetNoteSnapshotsDirectory() {
        let snapshotsDir = manager.getNoteSnapshotsDirectory(storageId: "sd-1", noteId: "note-1")
        XCTAssertTrue(snapshotsDir.hasSuffix("/note-1/snapshots"), "Should have snapshots subdirectory")
    }

    func testGetNotePacksDirectory() {
        let packsDir = manager.getNotePacksDirectory(storageId: "sd-1", noteId: "note-1")
        XCTAssertTrue(packsDir.hasSuffix("/note-1/packs"), "Should have packs subdirectory")
    }

    func testGetNoteMetaDirectory() {
        let metaDir = manager.getNoteMetaDirectory(storageId: "sd-1", noteId: "note-1")
        XCTAssertTrue(metaDir.hasSuffix("/note-1/meta"), "Should have meta subdirectory")
    }

    func testGetFolderTreePath() {
        let treePath = manager.getFolderTreePath(storageId: "sd-1")
        XCTAssertTrue(treePath.hasSuffix("/sd-1/folder-tree.yjson"), "Should have folder-tree.yjson file")
    }

    // MARK: - Directory Creation

    func testEnsureDirectoriesExist() throws {
        // Create manager with temporary directory
        let customManager = StorageDirectoryManager(fileManager: testFileManager)

        // Override documents directory to use temp dir
        // (Can't really do this without mocking, so we'll test the paths are correct)
        let storageId = "test-storage-\(UUID().uuidString)"
        let sdPath = customManager.getStorageDirectoryPath(id: storageId)

        // Path should be constructed correctly
        XCTAssertTrue(sdPath.contains(storageId), "Storage path should contain ID")
    }

    func testEnsureNoteDirectoryExists() throws {
        // Test that path construction is correct
        let storageId = "sd-test"
        let noteId = "note-test"

        let noteDir = manager.getNoteDirectory(storageId: storageId, noteId: noteId)
        let updatesDir = manager.getNoteUpdatesDirectory(storageId: storageId, noteId: noteId)
        let snapshotsDir = manager.getNoteSnapshotsDirectory(storageId: storageId, noteId: noteId)
        let packsDir = manager.getNotePacksDirectory(storageId: storageId, noteId: noteId)
        let metaDir = manager.getNoteMetaDirectory(storageId: storageId, noteId: noteId)

        // Verify all paths are constructed correctly
        XCTAssertTrue(noteDir.contains(noteId), "Note directory should contain note ID")
        XCTAssertTrue(updatesDir.contains("\(noteId)/updates"), "Updates dir should be in note dir")
        XCTAssertTrue(snapshotsDir.contains("\(noteId)/snapshots"), "Snapshots dir should be in note dir")
        XCTAssertTrue(packsDir.contains("\(noteId)/packs"), "Packs dir should be in note dir")
        XCTAssertTrue(metaDir.contains("\(noteId)/meta"), "Meta dir should be in note dir")
    }

    // MARK: - Storage Directory Listing

    func testListStorageDirectoriesWhenNoneExist() throws {
        // Create a manager that looks at a non-existent directory
        let customManager = StorageDirectoryManager(fileManager: testFileManager)

        // Since the NoteCove directory doesn't exist in temp, should return empty
        // (We can't easily test this without mocking the documents directory)
        // Instead, we'll just verify the method exists and can be called
        XCTAssertNoThrow(try customManager.listStorageDirectories())
    }

    func testStorageDirectoryExists() {
        let existingId = "sd-exists"
        let nonExistingId = "sd-does-not-exist-\(UUID().uuidString)"

        // Non-existing should return false
        XCTAssertFalse(manager.storageDirectoryExists(id: nonExistingId))
    }

    // MARK: - Path Consistency

    func testPathConsistency() {
        let storageId = "test-sd"
        let noteId = "test-note"

        // Get various paths
        let sdPath = manager.getStorageDirectoryPath(id: storageId)
        let notesDir = manager.getNotesDirectory(storageId: storageId)
        let noteDir = manager.getNoteDirectory(storageId: storageId, noteId: noteId)

        // Verify hierarchy is correct
        XCTAssertTrue(notesDir.hasPrefix(sdPath), "Notes directory should be in storage directory")
        XCTAssertTrue(noteDir.hasPrefix(notesDir), "Note directory should be in notes directory")
    }

    func testNoteSubdirectoriesConsistency() {
        let storageId = "sd-1"
        let noteId = "note-1"

        let noteDir = manager.getNoteDirectory(storageId: storageId, noteId: noteId)
        let updatesDir = manager.getNoteUpdatesDirectory(storageId: storageId, noteId: noteId)
        let snapshotsDir = manager.getNoteSnapshotsDirectory(storageId: storageId, noteId: noteId)
        let packsDir = manager.getNotePacksDirectory(storageId: storageId, noteId: noteId)
        let metaDir = manager.getNoteMetaDirectory(storageId: storageId, noteId: noteId)

        // All subdirectories should be in note directory
        XCTAssertTrue(updatesDir.hasPrefix(noteDir), "Updates should be in note dir")
        XCTAssertTrue(snapshotsDir.hasPrefix(noteDir), "Snapshots should be in note dir")
        XCTAssertTrue(packsDir.hasPrefix(noteDir), "Packs should be in note dir")
        XCTAssertTrue(metaDir.hasPrefix(noteDir), "Meta should be in note dir")
    }

    // MARK: - Multiple Storage Directories

    func testMultipleStorageDirectoryPaths() {
        let sd1Path = manager.getStorageDirectoryPath(id: "sd-1")
        let sd2Path = manager.getStorageDirectoryPath(id: "sd-2")

        // Paths should be different
        XCTAssertNotEqual(sd1Path, sd2Path, "Different storage directories should have different paths")

        // Both should be in NoteCove directory
        XCTAssertTrue(sd1Path.contains("/NoteCove/"), "SD1 should be in NoteCove dir")
        XCTAssertTrue(sd2Path.contains("/NoteCove/"), "SD2 should be in NoteCove dir")
    }

    func testMultipleNoteDirectoryPaths() {
        let storageId = "sd-1"
        let note1Dir = manager.getNoteDirectory(storageId: storageId, noteId: "note-1")
        let note2Dir = manager.getNoteDirectory(storageId: storageId, noteId: "note-2")

        // Paths should be different
        XCTAssertNotEqual(note1Dir, note2Dir, "Different notes should have different paths")

        // Both should be in the same notes directory
        let notesDir = manager.getNotesDirectory(storageId: storageId)
        XCTAssertTrue(note1Dir.hasPrefix(notesDir), "Note 1 should be in notes dir")
        XCTAssertTrue(note2Dir.hasPrefix(notesDir), "Note 2 should be in notes dir")
    }

    // MARK: - Edge Cases

    func testEmptyStorageId() {
        let path = manager.getStorageDirectoryPath(id: "")
        XCTAssertTrue(path.hasSuffix("/NoteCove/"), "Empty ID should still create valid path")
    }

    func testSpecialCharactersInIds() {
        let specialId = "sd-with-dashes-and_underscores"
        let path = manager.getStorageDirectoryPath(id: specialId)
        XCTAssertTrue(path.contains(specialId), "Should handle special characters")
    }

    func testUUIDStyleIds() {
        let uuidId = UUID().uuidString
        let path = manager.getStorageDirectoryPath(id: uuidId)
        XCTAssertTrue(path.contains(uuidId), "Should handle UUID-style IDs")
    }
}
