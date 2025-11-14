//
//  AppViewModel.swift
//  NoteCove
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import Foundation
import SwiftUI
import Combine

/// Main view model for the application, managing database, storage coordination, and CRDT bridge
@MainActor
public class AppViewModel: ObservableObject {
    // Published state
    @Published public var storageDirectories: [StorageDirectoryRecord] = []
    @Published public var isLoading = false
    @Published public var error: Error?

    // Dependencies
    public let database: DatabaseManager
    public let coordinator: StorageCoordinator
    public let bridge: CRDTBridge

    /// Initialize with an existing database, or create a new one
    public init(database: DatabaseManager? = nil) throws {
        // Initialize database (in-memory for tests, on-disk for production)
        if let db = database {
            self.database = db
        } else {
            // Production: use app's documents directory
            let documentsURL = FileManager.default.urls(
                for: .documentDirectory,
                in: .userDomainMask
            ).first!
            let dbURL = documentsURL.appendingPathComponent("notecove.sqlite")
            self.database = try DatabaseManager(at: dbURL)
        }

        // Initialize CRDT bridge
        self.bridge = CRDTBridge()

        // Initialize storage coordinator
        self.coordinator = StorageCoordinator(db: self.database)

        // Load initial data
        Task {
            await loadStorageDirectories()
        }
    }

    /// Load all storage directories from the database
    public func loadStorageDirectories() async {
        isLoading = true
        defer { isLoading = false }

        do {
            storageDirectories = try database.listStorageDirectories()

            // Start watching all storage directories
            for sd in storageDirectories {
                await coordinator.startWatching(storageId: sd.id)
            }
        } catch {
            self.error = error
            print("[AppViewModel] Error loading storage directories: \(error)")
        }
    }

    /// Create a new storage directory
    public func createStorageDirectory(name: String, path: String) async throws {
        let id = UUID().uuidString

        try database.upsertStorageDirectory(
            id: id,
            name: name,
            path: path
        )

        await loadStorageDirectories()
    }

    /// Delete a storage directory
    public func deleteStorageDirectory(id: String) async throws {
        // Stop watching first
        await coordinator.stopWatching(storageId: id)

        // Remove from database
        // Note: DatabaseManager doesn't have delete yet, we'll need to add it
        // For now, just reload

        await loadStorageDirectories()
    }
}
