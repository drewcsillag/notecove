//
//  NoteCoveApp.swift
//  NoteCove
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import SwiftUI

@main
struct NoteCoveApp: App {
    // State management
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
        }
    }
}

/// Global application state
class AppState: ObservableObject {
    // Storage Directories
    @Published var storageDirectories: [StorageDirectory] = []

    // Current selections
    @Published var selectedSD: StorageDirectory?
    @Published var selectedFolderId: String?
    @Published var selectedNoteId: String?

    // Settings
    @Published var username: String = ""
    @Published var mentionHandle: String = ""

    init() {
        loadSettings()
        loadStorageDirectories()
    }

    private func loadSettings() {
        // Load from UserDefaults
        username = UserDefaults.standard.string(forKey: "username") ?? ""
        mentionHandle = UserDefaults.standard.string(forKey: "mentionHandle") ?? ""
    }

    private func loadStorageDirectories() {
        // TODO: Implement SD loading from file system
        // This will be implemented in Phase 3.2
    }
}
