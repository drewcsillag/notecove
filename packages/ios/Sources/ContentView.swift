//
//  ContentView.swift
//  NoteCove
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import SwiftUI

struct ContentView: View {
    @ObservedObject var viewModel: AppViewModel

    var body: some View {
        TabView {
            StorageDirectoryListView(viewModel: viewModel)
                .tabItem {
                    Label("Notes", systemImage: "note.text")
                }

            TagsTab()
                .tabItem {
                    Label("Tags", systemImage: "tag")
                }

            SettingsTab()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
        }
    }
}

// MARK: - Placeholder Tab Views

struct TagsTab: View {
    var body: some View {
        NavigationView {
            VStack {
                Text("Tags Tab")
                    .font(.largeTitle)
                Text("Phase 3.4 - Combined Folder/Tag View")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .navigationTitle("Tags")
        }
    }
}

struct SettingsTab: View {
    var body: some View {
        NavigationView {
            VStack {
                Text("Settings Tab")
                    .font(.largeTitle)
                Text("Phase 3.6 - Settings")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .navigationTitle("Settings")
        }
    }
}

#Preview {
    let db = try! DatabaseManager.inMemory()
    let viewModel = try! AppViewModel(database: db)
    return ContentView(viewModel: viewModel)
}
