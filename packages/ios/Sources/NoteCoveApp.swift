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
    // Main view model with database and storage coordination
    @StateObject private var viewModel: AppViewModel = {
        do {
            // Check if running in UI test mode and should reset
            let isUITesting = ProcessInfo.processInfo.arguments.contains("-UITesting")

            if isUITesting {
                // Reset app state for UI testing
                resetAppStateForUITesting()
            }

            return try AppViewModel()
        } catch {
            fatalError("Failed to initialize app: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView(viewModel: viewModel)
        }
    }

    /// Reset app state for UI testing (delete database and user defaults)
    private static func resetAppStateForUITesting() {
        let fileManager = FileManager.default

        // Delete the database file
        if let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first {
            let dbURL = documentsURL.appendingPathComponent("notecove.sqlite")
            try? fileManager.removeItem(at: dbURL)
            try? fileManager.removeItem(at: dbURL.appendingPathExtension("shm"))
            try? fileManager.removeItem(at: dbURL.appendingPathExtension("wal"))

            // Also clean up any note files
            let notesURL = documentsURL.appendingPathComponent("notes")
            try? fileManager.removeItem(at: notesURL)
        }

        // Reset UserDefaults (including instance ID)
        if let bundleID = Bundle.main.bundleIdentifier {
            UserDefaults.standard.removePersistentDomain(forName: bundleID)
            UserDefaults.standard.synchronize()
        }

        print("[UITesting] App state reset complete")
    }
}
