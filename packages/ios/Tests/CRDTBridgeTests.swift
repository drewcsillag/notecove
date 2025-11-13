//
//  CRDTBridgeTests.swift
//  NoteCoveTests
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import XCTest
@testable import NoteCove

final class CRDTBridgeTests: XCTestCase {

    var bridge: CRDTBridge!

    @MainActor
    override func setUpWithError() throws {
        try super.setUpWithError()
        bridge = CRDTBridge()
    }

    @MainActor
    override func tearDownWithError() throws {
        bridge = nil
        try super.tearDownWithError()
    }

    @MainActor
    func testBridgeInitialization() throws {
        // Bridge should initialize without error
        XCTAssertNotNil(bridge, "Bridge should be initialized")
    }

    @MainActor
    func testCreateNote() throws {
        let noteId = "test-note-1"

        // Should be able to create a note
        XCTAssertNoThrow(try bridge.createNote(noteId: noteId))

        // Should be able to get the document state
        let state = try bridge.getDocumentState(noteId: noteId)
        XCTAssertGreaterThan(state.count, 0, "Document state should not be empty")
    }

    @MainActor
    func testExtractTitle() throws {
        let noteId = "test-note-2"

        // Create a note
        try bridge.createNote(noteId: noteId)

        // Get its state
        let state = try bridge.getDocumentState(noteId: noteId)

        // Extract title (should be "Untitled" for a new note)
        let title = try bridge.extractTitle(stateData: state)
        XCTAssertEqual(title, "Untitled", "New note should have 'Untitled' as title")
    }

    @MainActor
    func testCloseNote() throws {
        let noteId = "test-note-3"

        // Create a note
        try bridge.createNote(noteId: noteId)

        // Close it (should not throw)
        XCTAssertNoThrow(bridge.closeNote(noteId: noteId))
    }

    @MainActor
    func testCreateFolderTree() throws {
        let sdId = "test-sd-1"

        // Should be able to create a folder tree
        XCTAssertNoThrow(try bridge.createFolderTree(sdId: sdId))

        // Should be able to get the folder tree state
        let state = try bridge.getFolderTreeState(sdId: sdId)
        XCTAssertGreaterThan(state.count, 0, "Folder tree state should not be empty")
    }

    @MainActor
    func testGetOpenDocumentCount() throws {
        // Initially should be 0
        XCTAssertEqual(bridge.getOpenDocumentCount(), 0)

        // Create a note
        try bridge.createNote(noteId: "test-1")
        XCTAssertEqual(bridge.getOpenDocumentCount(), 1)

        // Create a folder tree
        try bridge.createFolderTree(sdId: "test-sd")
        XCTAssertEqual(bridge.getOpenDocumentCount(), 2)

        // Close note
        bridge.closeNote(noteId: "test-1")
        XCTAssertEqual(bridge.getOpenDocumentCount(), 1)

        // Close folder tree
        bridge.closeFolderTree(sdId: "test-sd")
        XCTAssertEqual(bridge.getOpenDocumentCount(), 0)
    }

    @MainActor
    func testClearDocumentCache() throws {
        // Create some documents
        try bridge.createNote(noteId: "test-1")
        try bridge.createNote(noteId: "test-2")
        try bridge.createFolderTree(sdId: "test-sd")

        XCTAssertEqual(bridge.getOpenDocumentCount(), 3)

        // Clear cache
        bridge.clearDocumentCache()

        // Should be empty now
        XCTAssertEqual(bridge.getOpenDocumentCount(), 0)
    }
}
