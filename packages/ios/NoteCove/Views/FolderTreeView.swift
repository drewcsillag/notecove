import SwiftUI

/// Sidebar view showing folder hierarchy
struct FolderTreeView: View {
    @Binding var selectedFolder: Folder?
    @State private var folders: [Folder] = []
    @State private var expandedFolders: Set<String> = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    @ObservedObject private var storageManager = StorageDirectoryManager.shared

    var body: some View {
        List(selection: $selectedFolder) {
            // All Notes option
            NavigationLink(value: nil as Folder?) {
                Label("All Notes", systemImage: "tray.full")
            }
            .tag(nil as Folder?)

            if isLoading {
                ProgressView("Loading folders...")
            } else if let error = errorMessage {
                Text(error)
                    .foregroundColor(.secondary)
                    .font(.caption)
            } else {
                // Folder tree
                ForEach(rootFolders) { folder in
                    FolderRow(
                        folder: folder,
                        allFolders: folders,
                        expandedFolders: $expandedFolders
                    )
                }
            }
        }
        .listStyle(.sidebar)
        .onAppear {
            loadFolders()
        }
        .onChange(of: storageManager.activeDirectory?.id) { _, _ in
            loadFolders()
        }
    }

    private var rootFolders: [Folder] {
        folders.filter { $0.parentId == nil }
            .sorted { $0.order < $1.order }
    }

    private func loadFolders() {
        // Check if we have an active storage directory
        guard let activeDir = storageManager.activeDirectory else {
            // Fall back to sample data when no storage directory
            folders = SampleData.folders
            return
        }

        let sdId = activeDir.id

        isLoading = true
        errorMessage = nil

        Task { @MainActor in
            do {
                let crdtManager = CRDTManager.shared

                // Initialize if needed
                if !crdtManager.isInitialized {
                    try crdtManager.initialize()
                }

                // Load folder tree from CRDT
                _ = try crdtManager.loadFolderTreeState(sdId: sdId)

                // Get visible folders and convert to Folder model
                let folderInfos = try crdtManager.getVisibleFolders(sdId: sdId)
                folders = folderInfos.map { Folder(from: $0) }

                // Close the folder tree to free memory (we have the data now)
                crdtManager.closeFolderTree(sdId: sdId)

                isLoading = false
            } catch {
                print("[FolderTreeView] Error loading folders: \(error)")
                errorMessage = "Could not load folders"
                // Fall back to sample data
                folders = SampleData.folders
                isLoading = false
            }
        }
    }
}

/// A single folder row in the tree
struct FolderRow: View {
    let folder: Folder
    let allFolders: [Folder]
    @Binding var expandedFolders: Set<String>

    var body: some View {
        let children = allFolders.filter { $0.parentId == folder.id }
            .sorted { $0.order < $1.order }

        if children.isEmpty {
            NavigationLink(value: folder) {
                Label(folder.name, systemImage: "folder")
            }
            .tag(folder)
        } else {
            DisclosureGroup(
                isExpanded: Binding(
                    get: { expandedFolders.contains(folder.id) },
                    set: { isExpanded in
                        if isExpanded {
                            expandedFolders.insert(folder.id)
                        } else {
                            expandedFolders.remove(folder.id)
                        }
                    }
                )
            ) {
                ForEach(children) { child in
                    FolderRow(
                        folder: child,
                        allFolders: allFolders,
                        expandedFolders: $expandedFolders
                    )
                }
            } label: {
                NavigationLink(value: folder) {
                    Label(folder.name, systemImage: "folder")
                }
                .tag(folder)
            }
        }
    }
}

#Preview {
    NavigationSplitView {
        FolderTreeView(selectedFolder: .constant(nil))
    } detail: {
        Text("Detail")
    }
}
