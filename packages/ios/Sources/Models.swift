//
//  Models.swift
//  NoteCove
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import Foundation

// MARK: - Storage Directory

struct StorageDirectory: Identifiable, Codable {
    let id: String  // UUID
    let path: String
    let name: String
    let isEnabled: Bool

    init(id: String, path: String, name: String, isEnabled: Bool = true) {
        self.id = id
        self.path = path
        self.name = name
        self.isEnabled = isEnabled
    }
}

// MARK: - Folder

struct Folder: Identifiable, Codable {
    let id: String
    let sdId: String
    let parentId: String?
    let name: String
    let order: Int
    var children: [Folder]?

    init(id: String, sdId: String, parentId: String?, name: String, order: Int) {
        self.id = id
        self.sdId = sdId
        self.parentId = parentId
        self.name = name
        self.order = order
        self.children = nil
    }
}

// MARK: - Note

struct Note: Identifiable, Codable {
    let id: String
    let sdId: String
    let folderId: String
    let title: String
    let snippet: String
    let modified: Date
    let created: Date
    let isPinned: Bool
    let isDeleted: Bool
    let tags: [String]

    init(
        id: String,
        sdId: String,
        folderId: String,
        title: String,
        snippet: String,
        modified: Date,
        created: Date,
        isPinned: Bool = false,
        isDeleted: Bool = false,
        tags: [String] = []
    ) {
        self.id = id
        self.sdId = sdId
        self.folderId = folderId
        self.title = title
        self.snippet = snippet
        self.modified = modified
        self.created = created
        self.isPinned = isPinned
        self.isDeleted = isDeleted
        self.tags = tags
    }
}

// MARK: - Tag

struct Tag: Identifiable, Codable {
    let id: String
    let name: String
    let count: Int

    init(id: String, name: String, count: Int) {
        self.id = id
        self.name = name
        self.count = count
    }
}
