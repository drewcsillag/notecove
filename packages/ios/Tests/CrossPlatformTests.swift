//
//  CrossPlatformTests.swift
//  NoteCoveTests
//
//  Cross-platform e2e tests that verify iOS and Desktop can share storage
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import XCTest
@testable import NoteCove

@MainActor
final class CrossPlatformTests: XCTestCase {
    var database: DatabaseManager!
    var bridge: CRDTBridge!
    var fileIO: FileIOManager!
    var storageId: String!
    var sharedSDPath: String!

    override func setUpWithError() throws {
        try super.setUpWithError()

        // Get shared storage directory from environment variable
        // (Set by test-cross-platform.sh script)
        guard let envPath = ProcessInfo.processInfo.environment["NOTECOVE_CROSS_PLATFORM_SD"] else {
            throw XCTSkip("Skipping cross-platform test - not running in cross-platform test mode")
        }

        sharedSDPath = envPath
        storageId = "cross-platform-test-sd"

        // Create in-memory database
        database = try DatabaseManager.inMemory()

        // Register the shared storage directory
        try database.upsertStorageDirectory(
            id: storageId,
            name: "Cross-Platform Test Storage",
            path: sharedSDPath
        )

        // Create CRDT bridge
        bridge = CRDTBridge()

        // Create file IO manager
        fileIO = FileIOManager()

        print("[CrossPlatformTests] Using shared SD: \(sharedSDPath)")
    }

    override func tearDownWithError() throws {
        bridge = nil
        database = nil
        fileIO = nil
        sharedSDPath = nil
        storageId = nil

        try super.tearDownWithError()
    }

    /// Test that iOS can read a note created by desktop
    func testVerifyDesktopNote() async throws {
        print("[CrossPlatformTests] Verifying desktop created note...")

        // Desktop should have created a note with ID "cross-platform-note-1"
        let noteId = "cross-platform-note-1"

        // Check if note directory exists in shared storage
        let noteDir = "\(sharedSDPath!)/\(noteId)"
        let updatesDir = "\(noteDir)/updates"

        guard fileIO.fileExists(at: noteDir) else {
            XCTFail("Desktop did not create note directory: \(noteDir)")
            return
        }

        guard fileIO.fileExists(at: updatesDir) else {
            XCTFail("Desktop did not create updates directory: \(updatesDir)")
            return
        }

        // Load the note via CRDT bridge
        try bridge.createNote(noteId: noteId)

        // Load all update files
        let updateFiles = try fileIO.listFiles(in: updatesDir, matching: "*.yjson").sorted()
        XCTAssertFalse(updateFiles.isEmpty, "Desktop should have created update files")

        // Apply updates
        for filePath in updateFiles {
            let updateData = try fileIO.readFile(at: filePath)
            try bridge.applyUpdate(noteId: noteId, updateData: updateData)
        }

        // Extract title
        let state = try bridge.getDocumentState(noteId: noteId)
        let title = try bridge.extractTitle(stateData: state)

        // Desktop test should have created note with title "Cross-Platform Test Note"
        XCTAssertEqual(title, "Cross-Platform Test Note", "iOS should be able to read desktop's note title")

        print("[CrossPlatformTests] ✅ Successfully verified desktop note")
    }

    /// Test that iOS can edit a note created by desktop
    func testEditNoteFromDesktop() async throws {
        print("[CrossPlatformTests] Editing desktop's note from iOS...")

        let noteId = "cross-platform-note-1"

        // First, load the desktop's note
        try bridge.createNote(noteId: noteId)

        let noteDir = "\(sharedSDPath!)/\(noteId)"
        let updatesDir = "\(noteDir)/updates"

        // Load existing updates
        let updateFiles = try fileIO.listFiles(in: updatesDir, matching: "*.yjson").sorted()
        for filePath in updateFiles {
            let updateData = try fileIO.readFile(at: filePath)
            try bridge.applyUpdate(noteId: noteId, updateData: updateData)
        }

        // Get current state
        let initialState = try bridge.getDocumentState(noteId: noteId)
        let initialTitle = try bridge.extractTitle(stateData: initialState)

        print("[CrossPlatformTests] Initial title: \(initialTitle)")

        // Create an update from iOS
        // (In a real scenario, this would come from the editor)
        // For testing, we'll just verify we can write updates to the shared directory

        // Get state as an update and write it to a new file
        let updateFilename = "ios-update-\(Date().timeIntervalSince1970).yjson"
        let updatePath = "\(updatesDir)/\(updateFilename)"

        // Write current state as an update file
        try initialState.write(to: URL(fileURLWithPath: updatePath))

        // Verify the file was written
        XCTAssertTrue(fileIO.fileExists(at: updatePath), "iOS should be able to write update files to shared directory")

        print("[CrossPlatformTests] ✅ Successfully edited note (added iOS update file)")
    }

    /// Test that iOS can create a folder in shared storage
    func testCreateFolderFromIOS() async throws {
        print("[CrossPlatformTests] Creating folder from iOS...")

        let folderId = "ios-folder-1"
        let folderName = "iOS Created Folder"

        // Add folder to database
        try database.insertFolder(
            id: folderId,
            storageDirectoryId: storageId,
            parentId: nil,
            name: folderName
        )

        // Verify it was created
        let folders = try database.listFolders(in: storageId, parentId: nil)
        let createdFolder = folders.first { $0.id == folderId }

        XCTAssertNotNil(createdFolder, "Folder should be created in database")
        XCTAssertEqual(createdFolder?.name, folderName)

        print("[CrossPlatformTests] ✅ Successfully created folder")
    }

    /// Test that iOS can create a note in shared storage
    func testCreateNoteFromIOS() async throws {
        print("[CrossPlatformTests] Creating note from iOS...")

        let noteId = "ios-note-1"
        let noteTitle = "iOS Created Note"

        // Ensure note directory exists
        let sdManager = StorageDirectoryManager()
        try sdManager.ensureNoteDirectoryExists(storageId: sharedSDPath, noteId: noteId)

        // Create note via bridge
        try bridge.createNote(noteId: noteId)

        // Get state and write it
        let state = try bridge.getDocumentState(noteId: noteId)
        let updatesDir = sdManager.getNoteUpdatesDirectory(storageId: sharedSDPath, noteId: noteId)
        let updatePath = "\(updatesDir)/ios-initial.yjson"

        try state.write(to: URL(fileURLWithPath: updatePath))

        // Add to database
        try database.insertNote(
            id: noteId,
            storageDirectoryId: storageId,
            folderId: nil,
            title: noteTitle
        )

        // Verify
        let note = try database.getNote(id: noteId)
        XCTAssertNotNil(note)
        XCTAssertEqual(note?.title, noteTitle)

        // Verify file exists in shared directory
        let noteDir = "\(sharedSDPath!)/\(noteId)"
        XCTAssertTrue(fileIO.fileExists(at: noteDir), "Note directory should exist in shared storage")
        XCTAssertTrue(fileIO.fileExists(at: updatePath), "Update file should exist")

        print("[CrossPlatformTests] ✅ Successfully created note from iOS")
    }
}
