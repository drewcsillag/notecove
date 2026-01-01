import XCTest
@testable import NoteCove

@MainActor
final class NoteCoveTests: XCTestCase {

    override func setUpWithError() throws {
        // Put setup code here
    }

    override func tearDownWithError() throws {
        // Put teardown code here
    }

    func testNoteModel() throws {
        let note = Note(
            id: "test-123",
            title: "Test Note",
            preview: "This is a test",
            folderId: nil,
            createdAt: Date(),
            modifiedAt: Date(),
            isPinned: false
        )

        XCTAssertEqual(note.id, "test-123")
        XCTAssertEqual(note.title, "Test Note")
        XCTAssertFalse(note.isPinned)
    }

    func testFolderModel() throws {
        let folder = Folder(
            id: "folder-1",
            name: "Work",
            parentId: nil,
            order: 0
        )

        XCTAssertEqual(folder.id, "folder-1")
        XCTAssertEqual(folder.name, "Work")
        XCTAssertNil(folder.parentId)
    }

    func testInstanceIdGeneration() throws {
        let appState = AppState()
        XCTAssertFalse(appState.instanceId.isEmpty)
        XCTAssertEqual(appState.instanceId.count, 12) // 12 character hex ID
    }
}
