import XCTest
@testable import NoteCove

final class DatabaseManagerTests: XCTestCase {
    var db: DatabaseManager!

    override func setUp() {
        super.setUp()
        // Use in-memory database for testing
        db = try! DatabaseManager.inMemory()
    }

    override func tearDown() {
        db = nil
        super.tearDown()
    }

    // MARK: - Storage Directory Tests

    func testUpsertStorageDirectory() throws {
        // When: Inserting a storage directory
        try db.upsertStorageDirectory(id: "sd-1", name: "Test SD", path: "/path/to/sd")

        // Then: Storage directory exists
        let sd = try db.getStorageDirectory(id: "sd-1")
        XCTAssertNotNil(sd)
        XCTAssertEqual(sd?.name, "Test SD")
        XCTAssertEqual(sd?.path, "/path/to/sd")
    }

    func testListStorageDirectories() throws {
        // Given: Multiple storage directories
        try db.upsertStorageDirectory(id: "sd-1", name: "First", path: "/first")
        try db.upsertStorageDirectory(id: "sd-2", name: "Second", path: "/second")

        // When: Listing storage directories
        let sds = try db.listStorageDirectories()

        // Then: All are returned
        XCTAssertEqual(sds.count, 2)
    }

    // MARK: - Note Tests

    func testInsertNote() throws {
        // Given: A storage directory
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")

        // When: Inserting a note
        try db.insertNote(id: "note-1", storageDirectoryId: "sd-1", folderId: nil, title: "Test Note")

        // Then: Note exists
        let note = try db.getNote(id: "note-1")
        XCTAssertNotNil(note)
        XCTAssertEqual(note?.title, "Test Note")
        XCTAssertNil(note?.deletedAt)
    }

    func testUpdateNote() throws {
        // Given: An existing note
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")
        try db.insertNote(id: "note-1", storageDirectoryId: "sd-1", folderId: nil, title: "Original")

        // When: Updating the note
        try db.updateNote(id: "note-1", title: "Updated")

        // Then: Note is updated
        let note = try db.getNote(id: "note-1")
        XCTAssertEqual(note?.title, "Updated")
    }

    func testSoftDeleteNote() throws {
        // Given: An existing note
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")
        try db.insertNote(id: "note-1", storageDirectoryId: "sd-1", folderId: nil, title: "Test")

        // When: Soft deleting the note
        try db.deleteNote(id: "note-1")

        // Then: Note is marked as deleted
        let note = try db.getNote(id: "note-1")
        XCTAssertNotNil(note?.deletedAt)
    }

    func testRestoreNote() throws {
        // Given: A deleted note
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")
        try db.insertNote(id: "note-1", storageDirectoryId: "sd-1", folderId: nil, title: "Test")
        try db.deleteNote(id: "note-1")

        // When: Restoring the note
        try db.restoreNote(id: "note-1")

        // Then: Note is no longer deleted
        let note = try db.getNote(id: "note-1")
        XCTAssertNil(note?.deletedAt)
    }

    func testPermanentlyDeleteNote() throws {
        // Given: An existing note
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")
        try db.insertNote(id: "note-1", storageDirectoryId: "sd-1", folderId: nil, title: "Test")

        // When: Permanently deleting the note
        try db.permanentlyDeleteNote(id: "note-1")

        // Then: Note no longer exists
        let note = try db.getNote(id: "note-1")
        XCTAssertNil(note)
    }

    func testListNotes() throws {
        // Given: Multiple notes
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")
        try db.insertNote(id: "note-1", storageDirectoryId: "sd-1", folderId: nil, title: "First")
        try db.insertNote(id: "note-2", storageDirectoryId: "sd-1", folderId: nil, title: "Second")
        try db.insertNote(id: "note-3", storageDirectoryId: "sd-1", folderId: nil, title: "Third")
        try db.deleteNote(id: "note-3") // Soft delete one

        // When: Listing notes (excluding deleted)
        let notes = try db.listNotes(in: "sd-1", folderId: nil, includeDeleted: false)

        // Then: Only non-deleted notes are returned
        XCTAssertEqual(notes.count, 2)
    }

    func testListDeletedNotes() throws {
        // Given: Notes with some deleted
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")
        try db.insertNote(id: "note-1", storageDirectoryId: "sd-1", folderId: nil, title: "Active")
        try db.insertNote(id: "note-2", storageDirectoryId: "sd-1", folderId: nil, title: "Deleted")
        try db.deleteNote(id: "note-2")

        // When: Listing deleted notes
        let deletedNotes = try db.listDeletedNotes(in: "sd-1")

        // Then: Only deleted notes are returned
        XCTAssertEqual(deletedNotes.count, 1)
        XCTAssertEqual(deletedNotes[0].id, "note-2")
    }

    // MARK: - FTS5 Search Tests

    func testIndexNoteContent() throws {
        // Given: A note
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")
        try db.insertNote(id: "note-1", storageDirectoryId: "sd-1", folderId: nil, title: "Test Note")

        // When: Indexing note content
        try db.indexNoteContent(noteId: "note-1", title: "Test Note", content: "This is the note content with searchable text")

        // Then: No error occurs (actual search tested separately)
        XCTAssertTrue(true)
    }

    func testSearchNotes() throws {
        // Given: Indexed notes
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")
        try db.insertNote(id: "note-1", storageDirectoryId: "sd-1", folderId: nil, title: "Swift Tutorial")
        try db.insertNote(id: "note-2", storageDirectoryId: "sd-1", folderId: nil, title: "Python Guide")
        try db.indexNoteContent(noteId: "note-1", title: "Swift Tutorial", content: "Learn Swift programming language")
        try db.indexNoteContent(noteId: "note-2", title: "Python Guide", content: "Learn Python basics")

        // When: Searching for "Swift"
        let results = try db.searchNotes(query: "Swift", in: "sd-1")

        // Then: Only Swift note is returned
        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results[0].noteId, "note-1")
    }

    // MARK: - Folder Tests

    func testInsertFolder() throws {
        // Given: A storage directory
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")

        // When: Inserting a folder
        try db.insertFolder(id: "folder-1", storageDirectoryId: "sd-1", parentId: nil, name: "Test Folder")

        // Then: Folder exists
        let folder = try db.getFolder(id: "folder-1")
        XCTAssertNotNil(folder)
        XCTAssertEqual(folder?.name, "Test Folder")
    }

    func testUpdateFolder() throws {
        // Given: An existing folder
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")
        try db.insertFolder(id: "folder-1", storageDirectoryId: "sd-1", parentId: nil, name: "Original")

        // When: Updating the folder
        try db.updateFolder(id: "folder-1", name: "Updated")

        // Then: Folder is updated
        let folder = try db.getFolder(id: "folder-1")
        XCTAssertEqual(folder?.name, "Updated")
    }

    func testDeleteFolder() throws {
        // Given: An existing folder
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")
        try db.insertFolder(id: "folder-1", storageDirectoryId: "sd-1", parentId: nil, name: "Test")

        // When: Deleting the folder
        try db.deleteFolder(id: "folder-1")

        // Then: Folder no longer exists
        let folder = try db.getFolder(id: "folder-1")
        XCTAssertNil(folder)
    }

    func testListFolders() throws {
        // Given: Multiple folders
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")
        try db.insertFolder(id: "folder-1", storageDirectoryId: "sd-1", parentId: nil, name: "First")
        try db.insertFolder(id: "folder-2", storageDirectoryId: "sd-1", parentId: nil, name: "Second")

        // When: Listing folders
        let folders = try db.listFolders(in: "sd-1", parentId: nil)

        // Then: All folders are returned
        XCTAssertEqual(folders.count, 2)
    }

    // MARK: - Tag Tests

    func testInsertTag() throws {
        // Given: A storage directory
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")

        // When: Inserting a tag
        try db.insertTag(id: "tag-1", storageDirectoryId: "sd-1", name: "important", color: "#FF0000")

        // Then: Tag exists
        let tag = try db.getTag(id: "tag-1")
        XCTAssertNotNil(tag)
        XCTAssertEqual(tag?.name, "important")
        XCTAssertEqual(tag?.color, "#FF0000")
    }

    func testUpdateTag() throws {
        // Given: An existing tag
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")
        try db.insertTag(id: "tag-1", storageDirectoryId: "sd-1", name: "original", color: nil)

        // When: Updating the tag
        try db.updateTag(id: "tag-1", name: "updated", color: "#00FF00")

        // Then: Tag is updated
        let tag = try db.getTag(id: "tag-1")
        XCTAssertEqual(tag?.name, "updated")
        XCTAssertEqual(tag?.color, "#00FF00")
    }

    func testDeleteTag() throws {
        // Given: An existing tag
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")
        try db.insertTag(id: "tag-1", storageDirectoryId: "sd-1", name: "test", color: nil)

        // When: Deleting the tag
        try db.deleteTag(id: "tag-1")

        // Then: Tag no longer exists
        let tag = try db.getTag(id: "tag-1")
        XCTAssertNil(tag)
    }

    func testListTags() throws {
        // Given: Multiple tags
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")
        try db.insertTag(id: "tag-1", storageDirectoryId: "sd-1", name: "first", color: nil)
        try db.insertTag(id: "tag-2", storageDirectoryId: "sd-1", name: "second", color: nil)

        // When: Listing tags
        let tags = try db.listTags(in: "sd-1")

        // Then: All tags are returned
        XCTAssertEqual(tags.count, 2)
    }

    // MARK: - Note-Tag Relationship Tests

    func testAddTagToNote() throws {
        // Given: A note and a tag
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")
        try db.insertNote(id: "note-1", storageDirectoryId: "sd-1", folderId: nil, title: "Test")
        try db.insertTag(id: "tag-1", storageDirectoryId: "sd-1", name: "important", color: nil)

        // When: Adding tag to note
        try db.addTagToNote(noteId: "note-1", tagId: "tag-1")

        // Then: Tag is associated with note
        let tags = try db.getTagsForNote(noteId: "note-1")
        XCTAssertEqual(tags.count, 1)
        XCTAssertEqual(tags[0].id, "tag-1")
    }

    func testRemoveTagFromNote() throws {
        // Given: A note with a tag
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")
        try db.insertNote(id: "note-1", storageDirectoryId: "sd-1", folderId: nil, title: "Test")
        try db.insertTag(id: "tag-1", storageDirectoryId: "sd-1", name: "important", color: nil)
        try db.addTagToNote(noteId: "note-1", tagId: "tag-1")

        // When: Removing tag from note
        try db.removeTagFromNote(noteId: "note-1", tagId: "tag-1")

        // Then: Tag is no longer associated
        let tags = try db.getTagsForNote(noteId: "note-1")
        XCTAssertEqual(tags.count, 0)
    }

    func testGetNotesWithTag() throws {
        // Given: Multiple notes with a tag
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")
        try db.insertNote(id: "note-1", storageDirectoryId: "sd-1", folderId: nil, title: "First")
        try db.insertNote(id: "note-2", storageDirectoryId: "sd-1", folderId: nil, title: "Second")
        try db.insertTag(id: "tag-1", storageDirectoryId: "sd-1", name: "important", color: nil)
        try db.addTagToNote(noteId: "note-1", tagId: "tag-1")
        try db.addTagToNote(noteId: "note-2", tagId: "tag-1")

        // When: Getting notes with tag
        let notes = try db.getNotesWithTag(tagId: "tag-1")

        // Then: Both notes are returned
        XCTAssertEqual(notes.count, 2)
    }

    // MARK: - Transaction Tests

    func testTransaction() throws {
        // Given: A storage directory
        try db.upsertStorageDirectory(id: "sd-1", name: "Test", path: "/test")

        // When: Executing multiple operations in a transaction
        try db.transaction { db in
            let note = NoteRecord(
                id: "note-1",
                storageDirectoryId: "sd-1",
                folderId: nil,
                title: "Test",
                createdAt: Date(),
                modifiedAt: Date(),
                deletedAt: nil
            )
            try note.insert(db)

            let tag = TagRecord(
                id: "tag-1",
                storageDirectoryId: "sd-1",
                name: "test",
                color: nil,
                createdAt: Date()
            )
            try tag.insert(db)
        }

        // Then: Both records exist
        XCTAssertNotNil(try db.getNote(id: "note-1"))
        XCTAssertNotNil(try db.getTag(id: "tag-1"))
    }
}
