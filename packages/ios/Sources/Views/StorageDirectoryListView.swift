//
//  StorageDirectoryListView.swift
//  NoteCove
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import SwiftUI

struct StorageDirectoryListView: View {
    @ObservedObject var viewModel: AppViewModel
    @State private var showingAddSheet = false
    @State private var newSDName = ""
    @State private var newSDPath = ""

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading {
                    ProgressView("Loading...")
                } else if viewModel.storageDirectories.isEmpty {
                    emptyState
                } else {
                    storageDirectoryList
                }
            }
            .navigationTitle("Storage Directories")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingAddSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingAddSheet) {
                addStorageDirectorySheet
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 20) {
            Image(systemName: "folder.badge.plus")
                .font(.system(size: 60))
                .foregroundColor(.secondary)

            Text("No Storage Directories")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Add a storage directory to get started")
                .font(.body)
                .foregroundColor(.secondary)

            Button {
                showingAddSheet = true
            } label: {
                Label("Add Storage Directory", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }

    private var storageDirectoryList: some View {
        List {
            ForEach(viewModel.storageDirectories) { sd in
                NavigationLink(destination: FolderListView(
                    viewModel: viewModel,
                    storageId: sd.id,
                    parentFolderId: nil
                )) {
                    StorageDirectoryRow(sd: sd)
                }
            }
        }
    }

    private var addStorageDirectorySheet: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $newSDName)
                    TextField("Path", text: $newSDPath)
                        .autocapitalization(.none)

                    Button("Use Documents Directory") {
                        if let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?.path {
                            newSDPath = documentsPath
                            if newSDName.isEmpty {
                                newSDName = "My Notes"
                            }
                        }
                    }
                    .buttonStyle(.borderless)

                    Button("Use iCloud Drive") {
                        let iCloudMgr = iCloudManager()
                        if let iCloudPath = iCloudMgr.getDocumentsDirectory()?.path {
                            newSDPath = iCloudPath
                            if newSDName.isEmpty {
                                newSDName = "iCloud Notes"
                            }
                        }
                    }
                    .buttonStyle(.borderless)
                } header: {
                    Text("Storage Directory Details")
                } footer: {
                    Text("The path should point to a local or iCloud Drive directory. Use the buttons above for quick setup.")
                }
            }
            .navigationTitle("Add Storage Directory")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showingAddSheet = false
                        resetForm()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        Task {
                            await addStorageDirectory()
                        }
                    }
                    .disabled(newSDName.isEmpty || newSDPath.isEmpty)
                }
            }
        }
    }

    private func addStorageDirectory() async {
        do {
            try await viewModel.createStorageDirectory(
                name: newSDName,
                path: newSDPath
            )
            showingAddSheet = false
            resetForm()
        } catch {
            print("Error creating storage directory: \(error)")
            // TODO: Show error alert
        }
    }

    private func resetForm() {
        newSDName = ""
        newSDPath = ""
    }
}

struct StorageDirectoryRow: View {
    let sd: StorageDirectoryRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(sd.name)
                .font(.headline)

            Text(sd.path)
                .font(.caption)
                .foregroundColor(.secondary)
                .lineLimit(1)
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    let db = try! DatabaseManager.inMemory()
    let viewModel = try! AppViewModel(database: db)

    // Add sample data
    try! db.upsertStorageDirectory(id: "sd-1", name: "My Notes", path: "/Users/test/Notes")
    try! db.upsertStorageDirectory(id: "sd-2", name: "Work Notes", path: "/Users/test/Work")

    return StorageDirectoryListView(viewModel: viewModel)
}
