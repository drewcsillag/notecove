import SwiftUI

/// Main content view with three-column navigation
struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var storageManager: StorageDirectoryManager
    @State private var selectedFolder: Folder?
    @State private var selectedNote: Note?
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    var body: some View {
        Group {
            if !appState.hasCompletedOnboarding {
                OnboardingView()
            } else if !storageManager.hasAccess {
                // Storage directory not accessible - show appropriate UI
                accessErrorView
            } else {
                mainNavigationView
            }
        }
    }

    // MARK: - Main Navigation View

    private var mainNavigationView: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            // Sidebar: Folder tree
            FolderTreeView(selectedFolder: $selectedFolder)
                .navigationTitle("Folders")
        } content: {
            // Middle column: Note list
            NoteListView(folder: selectedFolder, selectedNote: $selectedNote)
                .navigationTitle(selectedFolder?.name ?? "All Notes")
        } detail: {
            // Detail: Note editor
            if let note = selectedNote {
                NoteEditorView(note: note)
            } else {
                noNoteSelectedView
            }
        }
        .navigationSplitViewStyle(.balanced)
    }

    // MARK: - Error Views

    private var accessErrorView: some View {
        VStack(spacing: 24) {
            Image(systemName: "folder.badge.questionmark")
                .font(.system(size: 60))
                .foregroundStyle(.orange)

            Text("Storage Access Required")
                .font(.title2)
                .fontWeight(.semibold)

            if let error = storageManager.accessError {
                Text(error.errorDescription ?? "Unknown error")
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            Button("Select Folder Again") {
                appState.resetOnboarding()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }

    private var noNoteSelectedView: some View {
        VStack(spacing: 16) {
            Image(systemName: "doc.text")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            Text("Select a note")
                .font(.title3)
                .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
        .environmentObject(StorageDirectoryManager.shared)
}
