//
//  ModelsTests.swift
//  NoteCoveTests
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import XCTest
@testable import NoteCove

final class ModelsTests: XCTestCase {

    // MARK: - StorageDirectory Tests

    func testStorageDirectoryInit() {
        let sd = StorageDirectory(
            id: "sd-123",
            path: "/path/to/storage",
            name: "My Storage",
            isEnabled: true
        )

        XCTAssertEqual(sd.id, "sd-123")
        XCTAssertEqual(sd.path, "/path/to/storage")
        XCTAssertEqual(sd.name, "My Storage")
        XCTAssertTrue(sd.isEnabled)
    }

    func testStorageDirectoryDefaultEnabled() {
        let sd = StorageDirectory(
            id: "sd-456",
            path: "/path",
            name: "Test"
        )

        XCTAssertTrue(sd.isEnabled, "Should be enabled by default")
    }

    func testStorageDirectoryCodable() throws {
        let sd = StorageDirectory(
            id: "sd-789",
            path: "/test/path",
            name: "Codable Test",
            isEnabled: false
        )

        // Encode
        let encoder = JSONEncoder()
        let data = try encoder.encode(sd)

        // Decode
        let decoder = JSONDecoder()
        let decoded = try decoder.decode(StorageDirectory.self, from: data)

        XCTAssertEqual(decoded.id, sd.id)
        XCTAssertEqual(decoded.path, sd.path)
        XCTAssertEqual(decoded.name, sd.name)
        XCTAssertEqual(decoded.isEnabled, sd.isEnabled)
    }

    // MARK: - Folder Tests

    func testFolderInit() {
        let folder = Folder(
            id: "f-123",
            sdId: "sd-456",
            parentId: "f-parent",
            name: "My Folder",
            order: 1
        )

        XCTAssertEqual(folder.id, "f-123")
        XCTAssertEqual(folder.sdId, "sd-456")
        XCTAssertEqual(folder.parentId, "f-parent")
        XCTAssertEqual(folder.name, "My Folder")
        XCTAssertEqual(folder.order, 1)
        XCTAssertNil(folder.children)
    }

    func testFolderWithNilParent() {
        let folder = Folder(
            id: "f-root",
            sdId: "sd-123",
            parentId: nil,
            name: "Root Folder",
            order: 0
        )

        XCTAssertNil(folder.parentId)
    }

    func testFolderCodable() throws {
        let folder = Folder(
            id: "f-789",
            sdId: "sd-123",
            parentId: nil,
            name: "Test Folder",
            order: 5
        )

        // Encode
        let encoder = JSONEncoder()
        let data = try encoder.encode(folder)

        // Decode
        let decoder = JSONDecoder()
        let decoded = try decoder.decode(Folder.self, from: data)

        XCTAssertEqual(decoded.id, folder.id)
        XCTAssertEqual(decoded.sdId, folder.sdId)
        XCTAssertEqual(decoded.parentId, folder.parentId)
        XCTAssertEqual(decoded.name, folder.name)
        XCTAssertEqual(decoded.order, folder.order)
    }

    // MARK: - Note Tests

    func testNoteInit() {
        let now = Date()
        let note = Note(
            id: "n-123",
            sdId: "sd-456",
            folderId: "f-789",
            title: "My Note",
            snippet: "Note content preview",
            modified: now,
            created: now,
            isPinned: true,
            isDeleted: false,
            tags: ["tag1", "tag2"]
        )

        XCTAssertEqual(note.id, "n-123")
        XCTAssertEqual(note.sdId, "sd-456")
        XCTAssertEqual(note.folderId, "f-789")
        XCTAssertEqual(note.title, "My Note")
        XCTAssertEqual(note.snippet, "Note content preview")
        XCTAssertEqual(note.modified, now)
        XCTAssertEqual(note.created, now)
        XCTAssertTrue(note.isPinned)
        XCTAssertFalse(note.isDeleted)
        XCTAssertEqual(note.tags.count, 2)
    }

    func testNoteDefaultValues() {
        let now = Date()
        let note = Note(
            id: "n-456",
            sdId: "sd-123",
            folderId: "f-123",
            title: "Test",
            snippet: "Preview",
            modified: now,
            created: now
        )

        XCTAssertFalse(note.isPinned, "Should not be pinned by default")
        XCTAssertFalse(note.isDeleted, "Should not be deleted by default")
        XCTAssertTrue(note.tags.isEmpty, "Should have no tags by default")
    }

    func testNoteCodable() throws {
        let now = Date()
        let note = Note(
            id: "n-789",
            sdId: "sd-123",
            folderId: "f-456",
            title: "Codable Note",
            snippet: "Test snippet",
            modified: now,
            created: now,
            isPinned: false,
            isDeleted: true,
            tags: ["work", "important"]
        )

        // Encode
        let encoder = JSONEncoder()
        let data = try encoder.encode(note)

        // Decode
        let decoder = JSONDecoder()
        let decoded = try decoder.decode(Note.self, from: data)

        XCTAssertEqual(decoded.id, note.id)
        XCTAssertEqual(decoded.sdId, note.sdId)
        XCTAssertEqual(decoded.folderId, note.folderId)
        XCTAssertEqual(decoded.title, note.title)
        XCTAssertEqual(decoded.snippet, note.snippet)
        XCTAssertEqual(decoded.isPinned, note.isPinned)
        XCTAssertEqual(decoded.isDeleted, note.isDeleted)
        XCTAssertEqual(decoded.tags, note.tags)
    }

    // MARK: - Tag Tests

    func testTagInit() {
        let tag = Tag(
            id: "t-123",
            name: "important",
            count: 5
        )

        XCTAssertEqual(tag.id, "t-123")
        XCTAssertEqual(tag.name, "important")
        XCTAssertEqual(tag.count, 5)
    }

    func testTagWithZeroCount() {
        let tag = Tag(id: "t-456", name: "unused", count: 0)
        XCTAssertEqual(tag.count, 0)
    }

    func testTagCodable() throws {
        let tag = Tag(
            id: "t-789",
            name: "work",
            count: 10
        )

        // Encode
        let encoder = JSONEncoder()
        let data = try encoder.encode(tag)

        // Decode
        let decoder = JSONDecoder()
        let decoded = try decoder.decode(Tag.self, from: data)

        XCTAssertEqual(decoded.id, tag.id)
        XCTAssertEqual(decoded.name, tag.name)
        XCTAssertEqual(decoded.count, tag.count)
    }

    // MARK: - Identifiable Protocol Tests

    func testStorageDirectoryIdentifiable() {
        let sd = StorageDirectory(id: "unique-id", path: "/path", name: "Test")
        XCTAssertEqual(sd.id, "unique-id")
    }

    func testFolderIdentifiable() {
        let folder = Folder(id: "folder-id", sdId: "sd", parentId: nil, name: "Test", order: 0)
        XCTAssertEqual(folder.id, "folder-id")
    }

    func testNoteIdentifiable() {
        let note = Note(
            id: "note-id",
            sdId: "sd",
            folderId: "f",
            title: "Test",
            snippet: "",
            modified: Date(),
            created: Date()
        )
        XCTAssertEqual(note.id, "note-id")
    }

    func testTagIdentifiable() {
        let tag = Tag(id: "tag-id", name: "test", count: 1)
        XCTAssertEqual(tag.id, "tag-id")
    }
}
