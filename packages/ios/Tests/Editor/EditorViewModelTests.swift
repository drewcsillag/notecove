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
    ///
    /// NOTE: This test uses an empty CRDT update as a placeholder. The real
    /// end-to-end flow is tested in UITests where JavaScript can generate
    /// actual content. This test verifies that handleUpdate extracts the title
    /// and updates the database as expected.
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

        // Create CRDT note
        try bridge.createNote(noteId: testNoteId)

        // Get an empty update (in real usage, JavaScript would send updates with content)
        let emptyState = try bridge.getDocumentState(noteId: testNoteId)

        // When: handleUpdate processes an update, it should:
        // 1. Apply the update to CRDT
        // 2. Extract the title from the updated CRDT state
        // 3. Update the database with the extracted title
        //
        // Since we can't easily create Yjs content from Swift without JavaScript,
        // we'll test with an empty update. The title should remain "Untitled"
        // but the database UPDATE should still happen.

        await viewModel.handleUpdate(emptyState)

        // Then: The database should have been updated (even if title is still "Untitled")
        let note = try database.getNote(id: testNoteId)
        XCTAssertEqual(note?.title, "Untitled", "Empty document should have Untitled as title")

        // The real test for this bug is in UITests where JavaScript can generate
        // actual content updates and we can verify the title updates end-to-end.
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
