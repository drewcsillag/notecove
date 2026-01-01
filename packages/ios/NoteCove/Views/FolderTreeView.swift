import SwiftUI

/// Sidebar view showing folder hierarchy
struct FolderTreeView: View {
    @Binding var selectedFolder: Folder?
    @State private var folders: [Folder] = []
    @State private var expandedFolders: Set<String> = []

    var body: some View {
        List(selection: $selectedFolder) {
            // All Notes option
            NavigationLink(value: nil as Folder?) {
                Label("All Notes", systemImage: "tray.full")
            }
            .tag(nil as Folder?)

            // Folder tree
            ForEach(rootFolders) { folder in
                FolderRow(
                    folder: folder,
                    allFolders: folders,
                    expandedFolders: $expandedFolders
                )
            }
        }
        .listStyle(.sidebar)
        .onAppear {
            loadFolders()
        }
    }

    private var rootFolders: [Folder] {
        folders.filter { $0.parentId == nil }
            .sorted { $0.order < $1.order }
    }

    private func loadFolders() {
        // TODO: Load from database/CRDT in Phase 2
        // For now, use sample data for UI development
        folders = SampleData.folders
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
