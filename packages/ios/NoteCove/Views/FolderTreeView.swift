import SwiftUI

/// Wrapper to make Folder? work with List selection
/// We use the folder ID string, with empty string for "All Notes" (nil folder)
struct FolderSelection: Hashable {
    let id: String  // Empty string = All Notes, otherwise folder ID

    static let allNotes = FolderSelection(id: "")

    init(from folder: Folder?) {
        self.id = folder?.id ?? ""
    }

    init(id: String) {
        self.id = id
    }
}

/// Sidebar view showing folder hierarchy
struct FolderTreeView: View {
    @Binding var selectedFolder: Folder?
    var onSelect: (() -> Void)?  // Called when user selects any item (for navigation)
    @State private var folders: [Folder] = []
    @State private var expandedFolders: Set<String> = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selection: FolderSelection? = .allNotes

    @ObservedObject private var storageManager = StorageDirectoryManager.shared

    var body: some View {
        List(selection: $selection) {
            // All Notes option
            Label("All Notes", systemImage: "tray.full")
                .tag(FolderSelection.allNotes)

            if isLoading {
                ProgressView("Loading folders...")
            } else if let error = errorMessage {
                Text(error)
                    .foregroundColor(.secondary)
                    .font(.caption)
            } else {
                // Flatten the folder tree for display
                ForEach(visibleFolders, id: \.folder.id) { item in
                    HStack(spacing: 4) {
                        // Indent
                        if item.depth > 0 {
                            Spacer()
                                .frame(width: CGFloat(item.depth) * 20)
                        }

                        // Expand/collapse for folders with children
                        if item.hasChildren {
                            Button {
                                toggleExpand(item.folder.id)
                            } label: {
                                Image(systemName: expandedFolders.contains(item.folder.id) ? "chevron.down" : "chevron.right")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(.secondary)
                                    .frame(width: 20, height: 20)
                            }
                            .buttonStyle(.plain)
                        } else {
                            Spacer().frame(width: 20)
                        }

                        Label(item.folder.name, systemImage: "folder")
                    }
                    .tag(FolderSelection(id: item.folder.id))
                }
            }
        }
        .listStyle(.sidebar)
        .onChange(of: selection) { _, newValue in
            // Sync selection back to selectedFolder binding
            if let sel = newValue {
                if sel.id.isEmpty {
                    selectedFolder = nil
                } else {
                    selectedFolder = folders.first { $0.id == sel.id }
                }
                // Notify parent that selection was made (for iPhone navigation)
                onSelect?()
            }
        }
        .onChange(of: selectedFolder) { _, newFolder in
            // Sync selectedFolder to selection
            selection = FolderSelection(from: newFolder)
        }
        .onAppear {
            loadFolders()
            selection = FolderSelection(from: selectedFolder)
        }
        .onChange(of: storageManager.activeDirectory?.id) { _, _ in
            loadFolders()
        }
        .onReceive(NotificationCenter.default.publisher(for: .notesDidChange)) { _ in
            loadFolders()
        }
    }

    private func toggleExpand(_ folderId: String) {
        if expandedFolders.contains(folderId) {
            expandedFolders.remove(folderId)
        } else {
            expandedFolders.insert(folderId)
        }
    }

    /// Flattened list of visible folders with depth info
    private var visibleFolders: [FolderListItem] {
        var result: [FolderListItem] = []
        let roots = folders.filter { $0.parentId == nil }.sorted { $0.order < $1.order }
        for folder in roots {
            appendFolder(folder, depth: 0, to: &result)
        }
        return result
    }

    private func appendFolder(_ folder: Folder, depth: Int, to result: inout [FolderListItem]) {
        let children = folders.filter { $0.parentId == folder.id }.sorted { $0.order < $1.order }
        result.append(FolderListItem(folder: folder, depth: depth, hasChildren: !children.isEmpty))

        if expandedFolders.contains(folder.id) {
            for child in children {
                appendFolder(child, depth: depth + 1, to: &result)
            }
        }
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

/// Item for flattened folder list
private struct FolderListItem {
    let folder: Folder
    let depth: Int
    let hasChildren: Bool
}

#Preview {
    NavigationSplitView {
        FolderTreeView(selectedFolder: .constant(nil))
    } detail: {
        Text("Detail")
    }
}
