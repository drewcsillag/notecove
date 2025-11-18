//
//  RealWorldCrossPlatformTests.swift
//  NoteCoveTests
//
//  Tests that replicate actual cross-platform usage:
//  - Desktop creates notes → iOS discovers them via file watching
//  - iOS creates notes → Desktop discovers them via activity logs
//
//  This exposes the activity logging bug!
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import XCTest
@testable import NoteCove

@MainActor
final class RealWorldCrossPlatformTests: XCTestCase {
    nonisolated(unsafe) var database: DatabaseManager!
    nonisolated(unsafe) var fileChangeProcessor: FileChangeProcessor!
    nonisolated(unsafe) var bridge: CRDTBridge!
    nonisolated(unsafe) var fileIO: FileIOManager!
    var storageId: String!
    var sharedSDPath: String!
    var instanceId: String!

    override func setUpWithError() throws {
        try super.setUpWithError()

        // Use fixed shared directory like the real cross-platform tests
        sharedSDPath = "/tmp/notecove-real-world-test"

        // Clean up from previous runs
        try? FileManager.default.removeItem(atPath: sharedSDPath)
        try FileManager.default.createDirectory(
            atPath: sharedSDPath,
            withIntermediateDirectories: true,
            attributes: nil
        )

        storageId = "real-world-test-sd"

        // Create in-memory database
        database = try DatabaseManager.inMemory()

        // Register the shared storage directory
        try database.upsertStorageDirectory(
            id: storageId,
            name: "Real World Test Storage",
            path: sharedSDPath
        )

        // Create CRDT bridge
        bridge = CRDTBridge()

        // Create file IO manager
        fileIO = FileIOManager()

        // Create file change processor (this is what the real app uses!)
        fileChangeProcessor = FileChangeProcessor(
            db: database,
            bridge: bridge,
            fileIO: fileIO
        )

        // Generate instance ID (iOS should use uppercase UUIDs)
        instanceId = UUID().uuidString.uppercased()

        print("[RealWorldTest] Using shared SD: \(sharedSDPath)")
        print("[RealWorldTest] Instance ID: \(instanceId)")
    }

    override func tearDownWithError() throws {
        bridge = nil
        database = nil
        fileIO = nil
        fileChangeProcessor = nil
        sharedSDPath = nil
        storageId = nil

        // Clean up test directory
        try? FileManager.default.removeItem(atPath: "/tmp/notecove-real-world-test")

        try super.tearDownWithError()
    }

    /// Test that iOS can discover notes created by Desktop
    ///
    /// This simulates:
    /// 1. Desktop creates a note (we simulate by creating files directly)
    /// 2. iOS scans the storage directory using FileChangeProcessor
    /// 3. iOS should find the note and add it to its database
    func testIOSDiscoversDesktopNote() async throws {
        print("[RealWorldTest] Testing iOS discovers Desktop note...")

        // Simulate Desktop creating a note
        let desktopNoteId = UUID().uuidString.lowercased()
        let desktopInstanceId = UUID().uuidString.lowercased()

        print("[RealWorldTest] Simulating Desktop creating note: \(desktopNoteId)")

        // Create note directory structure (like Desktop would)
        let noteDir = "\(sharedSDPath!)/notes/\(desktopNoteId)"
        let updatesDir = "\(noteDir)/updates"
        try fileIO.createDirectory(at: updatesDir)

        // Create a proper Yjs CRDT update with content
        try bridge.createNote(noteId: desktopNoteId)

        // Simulate Desktop writing content "Hello from Desktop"
        // (In reality, Desktop would use TipTap, but for testing we'll create a simple doc)
        let state = try bridge.getDocumentState(noteId: desktopNoteId)

        // Write update file with Desktop's instance ID
        let updateFilename = "\(desktopInstanceId)_\(desktopNoteId)_\(Int64(Date().timeIntervalSince1970 * 1000))-0.yjson"
        let updatePath = "\(updatesDir)/\(updateFilename)"
        try state.write(to: URL(fileURLWithPath: updatePath))

        print("[RealWorldTest] Created update file: \(updateFilename)")

        // Desktop would also write to activity log - let's simulate that
        let activityDir = "\(sharedSDPath!)/notes/.activity"
        try fileIO.createDirectory(at: activityDir)
        let activityLog = "\(activityDir)/\(desktopInstanceId).log"
        let activityEntry = "\(desktopNoteId)|\(desktopInstanceId)_0\n"
        try activityEntry.write(toFile: activityLog, atomically: true, encoding: .utf8)

        print("[RealWorldTest] Created activity log: \(activityLog)")

        // Now iOS scans the storage directory (like it would on app launch or file change)
        // THIS IS THE KEY TEST: Does iOS discover the Desktop note?

        print("[RealWorldTest] iOS scanning storage directory...")

        // iOS should scan the notes directory and process the Desktop note
        try await fileChangeProcessor.scanStorageDirectory(storageId: storageId)

        // Check if iOS found the note
        let note = try database.getNote(id: desktopNoteId)

        // THIS SHOULD FAIL if iOS doesn't read activity logs!
        XCTAssertNotNil(note, "iOS should have discovered Desktop's note")

        if let note = note {
            print("[RealWorldTest] ✅ iOS found Desktop note: \(note.title)")
        } else {
            print("[RealWorldTest] ❌ iOS did NOT find Desktop note - activity log not being read?")
        }
    }

    /// Test that Desktop can discover notes created by iOS
    ///
    /// This simulates:
    /// 1. iOS creates a note
    /// 2. Desktop scans the storage directory
    /// 3. Desktop should find the note via activity log
    ///
    /// THIS WILL FAIL because iOS doesn't write activity logs!
    func testDesktopDiscoversIOSNote() async throws {
        print("[RealWorldTest] Testing Desktop discovers iOS note...")

        // iOS creates a note
        let iosNoteId = UUID().uuidString.uppercased()

        print("[RealWorldTest] iOS creating note: \(iosNoteId)")

        // Create note directory structure
        let noteDir = "\(sharedSDPath!)/notes/\(iosNoteId)"
        let updatesDir = "\(noteDir)/updates"
        try fileIO.createDirectory(at: updatesDir)

        // Create note via bridge
        try bridge.createNote(noteId: iosNoteId)

        // Get state and write update file
        let state = try bridge.getDocumentState(noteId: iosNoteId)
        let updateFilename = "\(instanceId!)_\(iosNoteId)_\(Int64(Date().timeIntervalSince1970 * 1000))-0.yjson"
        let updatePath = "\(updatesDir)/\(updateFilename)"
        try state.write(to: URL(fileURLWithPath: updatePath))

        print("[RealWorldTest] Created update file: \(updateFilename)")

        // Add note to iOS database
        let title = try bridge.extractTitle(stateData: state)
        try database.insertNote(
            id: iosNoteId,
            storageDirectoryId: storageId,
            folderId: nil,
            title: title
        )

        // Record activity (simulating what EditorViewModel does)
        let activityDir = "\(sharedSDPath!)/.activity"
        let activityLogger = ActivityLogger(
            fileIO: fileIO,
            activityDir: activityDir,
            instanceId: instanceId
        )
        try activityLogger.initialize()
        try activityLogger.recordNoteActivity(noteId: iosNoteId, sequenceNumber: 0)

        // Check if iOS wrote an activity log
        // Activity logs are at <sdPath>/.activity/, not <sdPath>/notes/.activity/
        let activityLog = "\(activityDir)/\(instanceId!).log"

        let activityLogExists = fileIO.fileExists(at: activityLog)

        print("[RealWorldTest] Activity log exists: \(activityLogExists)")

        // THIS SHOULD FAIL - iOS doesn't write activity logs!
        XCTAssertTrue(activityLogExists, "iOS should have written activity log for Desktop to discover")

        if activityLogExists {
            let logContents = try String(contentsOfFile: activityLog)
            print("[RealWorldTest] Activity log contents:\n\(logContents)")
            XCTAssertTrue(logContents.contains(iosNoteId), "Activity log should contain iOS note ID")
        } else {
            print("[RealWorldTest] ❌ iOS did NOT write activity log - Desktop won't discover this note!")
        }
    }
}
