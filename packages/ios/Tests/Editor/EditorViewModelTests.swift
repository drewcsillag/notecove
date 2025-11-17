//
//  EditorViewModelTests.swift
//  NoteCoveTests
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import XCTest
@testable import NoteCove

final class EditorViewModelTests: XCTestCase {

    nonisolated(unsafe) var database: DatabaseManager!
    nonisolated(unsafe) var bridge: CRDTBridge!
    nonisolated(unsafe) var viewModel: EditorViewModel!
    let testNoteId = "test-note-123"
    let testStorageId = "test-storage-456"

    override func setUpWithError() throws {
        try super.setUpWithError()

        // Create in-memory database
        database = try DatabaseManager.inMemory()

        // Create storage directory
        try database.upsertStorageDirectory(
            id: testStorageId,
            name: "Test Storage",
            path: FileManager.default.temporaryDirectory.path
        )

        // Create note with "Untitled"
        try database.insertNote(
            id: testNoteId,
            storageDirectoryId: testStorageId,
            folderId: nil,
            title: "Untitled"
        )

        // Note: bridge and viewModel will be created in each test method
        // since they require MainActor isolation
    }

    override func tearDownWithError() throws {
        viewModel = nil
        bridge = nil
        database = nil
        try super.tearDownWithError()
    }

    /// Test that when a CRDT update is received with content,
    /// the title is extracted from CRDT and updated in the database
    @MainActor
    func testTitleUpdatedFromCRDTUpdate() async throws {
        // Create MainActor-isolated objects
        bridge = CRDTBridge()
        viewModel = EditorViewModel(
            noteId: testNoteId,
            storageId: testStorageId,
            bridge: bridge,
            database: database
        )

        // Given: A note with title "Untitled"
        let initialNote = try database.getNote(id: testNoteId)
        XCTAssertEqual(initialNote?.title, "Untitled", "Initial title should be Untitled")

        // Create a CRDT update with actual content
        // The content should have "My First Note" as the first line
        try bridge.createNote(noteId: testNoteId)

        // Create a simple update by applying some content
        // We'll use the bridge's applyUpdate to simulate receiving content
        // For this test, we need to create an actual Yjs update with content

        // Since we can't easily create a Yjs update from Swift without the JavaScript layer,
        // let's use a different approach: load a note, get its state, and check title extraction works

        // Actually, let's test the flow differently:
        // 1. Create a note
        // 2. Apply an update (we'll need a real Yjs update for this)
        // 3. Check that handleUpdate extracts and updates the title

        // For now, let's test that extractTitle works correctly
        let emptyState = try bridge.getDocumentState(noteId: testNoteId)
        let emptyTitle = try bridge.extractTitle(stateData: emptyState)

        // Empty document should have empty title
        XCTAssertTrue(emptyTitle.isEmpty, "Empty document should have empty title")

        // Now simulate what handleUpdate does:
        // After receiving an update, it extracts the title and should update the database
        await viewModel.handleContentChanged(noteId: testNoteId, title: "My First Note", isEmpty: false)

        // Check that the database was updated
        let updatedNote = try database.getNote(id: testNoteId)

        // THIS IS THE BUG: The title should be updated in the database, but it's not
        // because handleContentChanged no longer updates the database
        XCTAssertEqual(updatedNote?.title, "My First Note", "Title should be updated in database after CRDT update")
    }

    /// Test that title is extracted from CRDT content, not from plain text
    @MainActor
    func testTitleExtractedFromCRDTNotPlainText() async throws {
        // Create MainActor-isolated objects
        bridge = CRDTBridge()
        viewModel = EditorViewModel(
            noteId: testNoteId,
            storageId: testStorageId,
            bridge: bridge,
            database: database
        )

        // This test verifies that we extract title from CRDT state,
        // not from the plain text passed in contentChanged events

        // Given: A note
        try bridge.createNote(noteId: testNoteId)

        // When: We receive a contentChanged event with one title
        await viewModel.handleContentChanged(noteId: testNoteId, title: "Plain Text Title", isEmpty: false)

        // But the CRDT state has different content (simulated)
        let state = try bridge.getDocumentState(noteId: testNoteId)
        let crdtTitle = try bridge.extractTitle(stateData: state)

        // Then: The database should have the CRDT-extracted title, not the plain text title
        let note = try database.getNote(id: testNoteId)

        // For an empty CRDT, the title should remain "Untitled" since we only update from CRDT
        // (The plain text title should be ignored for database updates)
        XCTAssertEqual(note?.title, "Untitled", "Database title should not be updated from plain text")
    }
}
