//
//  NoteCoveTests.swift
//  NoteCoveTests
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import XCTest
@testable import NoteCove

final class NoteCoveTests: XCTestCase {

    override func setUpWithError() throws {
        // Put setup code here. This method is called before the invocation of each test method in the class.
    }

    override func tearDownWithError() throws {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
    }

    func testAppStateInitialization() throws {
        let appState = AppState()

        // Verify initial state
        XCTAssertTrue(appState.storageDirectories.isEmpty, "Storage directories should be empty initially")
        XCTAssertNil(appState.selectedSD, "No SD should be selected initially")
        XCTAssertNil(appState.selectedFolderId, "No folder should be selected initially")
        XCTAssertNil(appState.selectedNoteId, "No note should be selected initially")
    }

    func testStorageDirectoryModel() throws {
        let sd = StorageDirectory(
            id: "test-id",
            path: "/path/to/storage",
            name: "Test Storage",
            isEnabled: true
        )

        XCTAssertEqual(sd.id, "test-id")
        XCTAssertEqual(sd.path, "/path/to/storage")
        XCTAssertEqual(sd.name, "Test Storage")
        XCTAssertTrue(sd.isEnabled)
    }

    func testNoteModel() throws {
        let note = Note(
            id: "note-1",
            sdId: "sd-1",
            folderId: "folder-1",
            title: "Test Note",
            snippet: "This is a test note",
            modified: Date(),
            created: Date()
        )

        XCTAssertEqual(note.id, "note-1")
        XCTAssertEqual(note.title, "Test Note")
        XCTAssertFalse(note.isPinned)
        XCTAssertFalse(note.isDeleted)
        XCTAssertTrue(note.tags.isEmpty)
    }

    func testPerformanceExample() throws {
        // This is an example of a performance test case.
        self.measure {
            // Put the code you want to measure the time of here.
            _ = AppState()
        }
    }
}
