import SwiftUI

/// Main content view with three-column navigation
struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedFolder: Folder?
    @State private var selectedNote: Note?
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    var body: some View {
        Group {
            if !appState.hasCompletedOnboarding || appState.storageDirectoryURL == nil {
                OnboardingView()
            } else {
                mainNavigationView
            }
        }
    }

    private var mainNavigationView: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            // Sidebar: Folder tree
            FolderTreeView(selectedFolder: $selectedFolder)
                .navigationTitle("Folders")
        } content: {
            // Content: Note list
            NoteListView(folder: selectedFolder, selectedNote: $selectedNote)
                .navigationTitle(selectedFolder?.name ?? "All Notes")
        } detail: {
            // Detail: Note editor/viewer
            if let note = selectedNote {
                NoteEditorView(note: note)
            } else {
                ContentUnavailableView(
                    "Select a Note",
                    systemImage: "doc.text",
                    description: Text("Choose a note from the list to view or edit it.")
                )
            }
        }
        .navigationSplitViewStyle(.balanced)
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
}
