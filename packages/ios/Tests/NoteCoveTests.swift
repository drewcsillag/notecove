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

    @MainActor
    func testAppViewModelInitialization() throws {
        let db = try DatabaseManager.inMemory()
        let viewModel = try AppViewModel(database: db)

        // Verify initial state
        XCTAssertNil(viewModel.error, "No error should be present initially")
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

    @MainActor
    func testPerformanceExample() throws {
        // This is an example of a performance test case.
        self.measure {
            // Put the code you want to measure the time of here.
            let db = try! DatabaseManager.inMemory()
            _ = try! AppViewModel(database: db)
        }
    }
}
