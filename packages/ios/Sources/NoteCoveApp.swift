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
}
