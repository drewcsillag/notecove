import XCTest
@testable import NoteCove
import GRDB

@MainActor
final class DatabaseTests: XCTestCase {
    var testDatabaseURL: URL!

    override func setUpWithError() throws {
        // Create a temporary database for testing
        let tempDir = FileManager.default.temporaryDirectory
        testDatabaseURL = tempDir.appendingPathComponent("test-\(UUID().uuidString).sqlite")
        try DatabaseManager.shared.setupDatabase(at: testDatabaseURL)
    }

    override func tearDownWithError() throws {
        // Clean up test database
        if let url = testDatabaseURL {
            try? FileManager.default.removeItem(at: url)
        }
    }

    // MARK: - Note Tests

    func testInsertAndFetchNote() throws {
        let note = NoteRecord(
            id: "note-1",
            title: "Test Note",
            sdId: "sd-1",
            folderId: nil,
            created: Int64(Date().timeIntervalSince1970 * 1000),
            modified: Int64(Date().timeIntervalSince1970 * 1000),
            deleted: false,
            pinned: false,
            contentPreview: "Preview text",
            contentText: "Full content text for searching"
        )

        try DatabaseManager.shared.upsertNote(note)

        let fetched = try DatabaseManager.shared.fetchNote(id: "note-1")
        XCTAssertNotNil(fetched)
        XCTAssertEqual(fetched?.title, "Test Note")
        XCTAssertEqual(fetched?.contentPreview, "Preview text")
    }

    func testFetchNotesFilteredByFolder() throws {
        let note1 = NoteRecord(
            id: "note-1",
            title: "Note in folder",
            sdId: "sd-1",
            folderId: "folder-1",
            created: Int64(Date().timeIntervalSince1970 * 1000),
            modified: Int64(Date().timeIntervalSince1970 * 1000),
            deleted: false,
            pinned: false,
            contentPreview: "",
            contentText: ""
        )

        let note2 = NoteRecord(
            id: "note-2",
            title: "Note without folder",
            sdId: "sd-1",
            folderId: nil,
            created: Int64(Date().timeIntervalSince1970 * 1000),
            modified: Int64(Date().timeIntervalSince1970 * 1000),
            deleted: false,
            pinned: false,
            contentPreview: "",
            contentText: ""
        )

        try DatabaseManager.shared.upsertNote(note1)
        try DatabaseManager.shared.upsertNote(note2)

        let allNotes = try DatabaseManager.shared.fetchNotes()
        XCTAssertEqual(allNotes.count, 2)

        let folderNotes = try DatabaseManager.shared.fetchNotes(folderId: "folder-1")
        XCTAssertEqual(folderNotes.count, 1)
        XCTAssertEqual(folderNotes.first?.title, "Note in folder")
    }

    func testPinnedNotesOrderedFirst() throws {
        let now = Int64(Date().timeIntervalSince1970 * 1000)

        let unpinnedNote = NoteRecord(
            id: "note-1",
            title: "Unpinned",
            sdId: "sd-1",
            folderId: nil,
            created: now,
            modified: now + 1000, // Modified later
            deleted: false,
            pinned: false,
            contentPreview: "",
            contentText: ""
        )

        let pinnedNote = NoteRecord(
            id: "note-2",
            title: "Pinned",
            sdId: "sd-1",
            folderId: nil,
            created: now,
            modified: now, // Modified earlier
            deleted: false,
            pinned: true,
            contentPreview: "",
            contentText: ""
        )

        try DatabaseManager.shared.upsertNote(unpinnedNote)
        try DatabaseManager.shared.upsertNote(pinnedNote)

        let notes = try DatabaseManager.shared.fetchNotes()
        XCTAssertEqual(notes.count, 2)
        XCTAssertEqual(notes.first?.title, "Pinned") // Pinned comes first despite older modified
    }

    func testSoftDeleteNote() throws {
        let note = NoteRecord(
            id: "note-1",
            title: "To Delete",
            sdId: "sd-1",
            folderId: nil,
            created: Int64(Date().timeIntervalSince1970 * 1000),
            modified: Int64(Date().timeIntervalSince1970 * 1000),
            deleted: false,
            pinned: false,
            contentPreview: "",
            contentText: ""
        )

        try DatabaseManager.shared.upsertNote(note)
        try DatabaseManager.shared.softDeleteNote(id: "note-1")

        // Should not appear in normal fetch
        let notes = try DatabaseManager.shared.fetchNotes()
        XCTAssertEqual(notes.count, 0)

        // Should appear when including deleted
        let allNotes = try DatabaseManager.shared.fetchNotes(includeDeleted: true)
        XCTAssertEqual(allNotes.count, 1)
        XCTAssertTrue(allNotes.first?.deleted ?? false)
    }

    // MARK: - Folder Tests

    func testInsertAndFetchFolder() throws {
        let folder = FolderRecord(
            id: "folder-1",
            name: "Work",
            parentId: nil,
            sdId: "sd-1",
            order: 0,
            deleted: false
        )

        try DatabaseManager.shared.upsertFolder(folder)

        let fetched = try DatabaseManager.shared.fetchFolder(id: "folder-1")
        XCTAssertNotNil(fetched)
        XCTAssertEqual(fetched?.name, "Work")
    }

    func testFoldersOrderedByOrder() throws {
        let folder1 = FolderRecord(id: "f1", name: "Third", parentId: nil, sdId: "sd-1", order: 2, deleted: false)
        let folder2 = FolderRecord(id: "f2", name: "First", parentId: nil, sdId: "sd-1", order: 0, deleted: false)
        let folder3 = FolderRecord(id: "f3", name: "Second", parentId: nil, sdId: "sd-1", order: 1, deleted: false)

        try DatabaseManager.shared.upsertFolder(folder1)
        try DatabaseManager.shared.upsertFolder(folder2)
        try DatabaseManager.shared.upsertFolder(folder3)

        let folders = try DatabaseManager.shared.fetchFolders()
        XCTAssertEqual(folders.map(\.name), ["First", "Second", "Third"])
    }

    // MARK: - Storage Directory Tests

    func testStorageDirectoryActiveState() throws {
        let sd1 = StorageDirRecord(
            id: "sd-1",
            name: "Primary",
            path: "/path/to/sd1",
            uuid: "uuid-1",
            created: Int64(Date().timeIntervalSince1970 * 1000),
            isActive: true
        )

        let sd2 = StorageDirRecord(
            id: "sd-2",
            name: "Secondary",
            path: "/path/to/sd2",
            uuid: "uuid-2",
            created: Int64(Date().timeIntervalSince1970 * 1000),
            isActive: false
        )

        try DatabaseManager.shared.upsertStorageDir(sd1)
        try DatabaseManager.shared.upsertStorageDir(sd2)

        var active = try DatabaseManager.shared.fetchActiveStorageDir()
        XCTAssertEqual(active?.id, "sd-1")

        // Switch active
        try DatabaseManager.shared.setActiveStorageDir(id: "sd-2")
        active = try DatabaseManager.shared.fetchActiveStorageDir()
        XCTAssertEqual(active?.id, "sd-2")
    }

    // MARK: - App State Tests

    func testAppStateStorage() throws {
        try DatabaseManager.shared.setAppState(key: .instanceId, value: "test-instance")

        let value = try DatabaseManager.shared.getAppState(key: .instanceId)
        XCTAssertEqual(value, "test-instance")
    }

    func testAppStateUpdate() throws {
        try DatabaseManager.shared.setAppState(key: .themeMode, value: "light")
        try DatabaseManager.shared.setAppState(key: .themeMode, value: "dark")

        let value = try DatabaseManager.shared.getAppState(key: .themeMode)
        XCTAssertEqual(value, "dark")
    }

    // MARK: - FTS5 Search Tests

    func testFullTextSearch() throws {
        let note1 = NoteRecord(
            id: "note-1",
            title: "Swift Programming",
            sdId: "sd-1",
            folderId: nil,
            created: Int64(Date().timeIntervalSince1970 * 1000),
            modified: Int64(Date().timeIntervalSince1970 * 1000),
            deleted: false,
            pinned: false,
            contentPreview: "Learn Swift",
            contentText: "Swift is a powerful programming language for iOS and macOS development"
        )

        let note2 = NoteRecord(
            id: "note-2",
            title: "Python Basics",
            sdId: "sd-1",
            folderId: nil,
            created: Int64(Date().timeIntervalSince1970 * 1000),
            modified: Int64(Date().timeIntervalSince1970 * 1000),
            deleted: false,
            pinned: false,
            contentPreview: "Learn Python",
            contentText: "Python is a versatile programming language for data science"
        )

        try DatabaseManager.shared.upsertNote(note1)
        try DatabaseManager.shared.upsertNote(note2)

        // Search for Swift
        let swiftResults = try DatabaseManager.shared.searchNotes(query: "Swift")
        XCTAssertEqual(swiftResults.count, 1)
        XCTAssertEqual(swiftResults.first?.noteId, "note-1")

        // Search for programming (should find both)
        let programmingResults = try DatabaseManager.shared.searchNotes(query: "programming")
        XCTAssertEqual(programmingResults.count, 2)
    }

    func testSearchExcludesDeletedNotes() throws {
        let note = NoteRecord(
            id: "note-1",
            title: "Deleted Note",
            sdId: "sd-1",
            folderId: nil,
            created: Int64(Date().timeIntervalSince1970 * 1000),
            modified: Int64(Date().timeIntervalSince1970 * 1000),
            deleted: false,
            pinned: false,
            contentPreview: "",
            contentText: "searchable content"
        )

        try DatabaseManager.shared.upsertNote(note)
        try DatabaseManager.shared.softDeleteNote(id: "note-1")

        let results = try DatabaseManager.shared.searchNotes(query: "searchable")
        XCTAssertEqual(results.count, 0)
    }

    // MARK: - Stats Tests

    func testDatabaseStats() throws {
        let note = NoteRecord(
            id: "note-1",
            title: "Note",
            sdId: "sd-1",
            folderId: nil,
            created: 0,
            modified: 0,
            deleted: false,
            pinned: false,
            contentPreview: "",
            contentText: ""
        )

        let folder = FolderRecord(
            id: "folder-1",
            name: "Folder",
            parentId: nil,
            sdId: "sd-1",
            order: 0,
            deleted: false
        )

        let sd = StorageDirRecord(
            id: "sd-1",
            name: "SD",
            path: "/path",
            uuid: nil,
            created: 0,
            isActive: true
        )

        try DatabaseManager.shared.upsertStorageDir(sd)
        try DatabaseManager.shared.upsertNote(note)
        try DatabaseManager.shared.upsertFolder(folder)

        let stats = try DatabaseManager.shared.getStats()
        XCTAssertEqual(stats.noteCount, 1)
        XCTAssertEqual(stats.folderCount, 1)
        XCTAssertEqual(stats.sdCount, 1)
    }
}
