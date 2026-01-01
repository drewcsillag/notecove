import SwiftUI

/// Main content view with three-column navigation
struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var storageManager: StorageDirectoryManager
    @State private var selectedFolder: Folder?
    @State private var selectedNote: Note?
    @State private var columnVisibility: NavigationSplitViewVisibility = .all
    @State private var showingDebug = false
    @State private var debugTapCount = 0

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
                .toolbar {
                    ToolbarItem(placement: .bottomBar) {
                        // Hidden debug access: tap 5 times to reveal
                        Button(action: handleDebugTap) {
                            Image(systemName: "gearshape")
                        }
                    }
                }
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
        .sheet(isPresented: $showingDebug) {
            DebugView()
        }
    }

    private func handleDebugTap() {
        debugTapCount += 1
        if debugTapCount >= 5 {
            debugTapCount = 0
            showingDebug = true
        }

        // Reset tap count after 2 seconds of inactivity
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            if debugTapCount > 0 && debugTapCount < 5 {
                debugTapCount = 0
            }
        }
    }

    // MARK: - Error Views

    private var accessErrorView: some View {
        VStack(spacing: 24) {
            Image(systemName: errorIcon)
                .font(.system(size: 60))
                .foregroundStyle(errorColor)

            Text(errorTitle)
                .font(.title2)
                .fontWeight(.semibold)

            if let error = storageManager.accessError {
                VStack(spacing: 8) {
                    Text(error.errorDescription ?? "Unknown error")
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)

                    if let suggestion = error.recoverySuggestion {
                        Text(suggestion)
                            .font(.callout)
                            .foregroundStyle(.tertiary)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal)
            }

            Button("Select Folder Again") {
                appState.resetOnboarding()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }

    private var errorIcon: String {
        guard let error = storageManager.accessError else {
            return "folder.badge.questionmark"
        }

        switch error {
        case .bookmarkStale:
            return "clock.badge.exclamationmark"
        case .accessDenied, .notAccessible:
            return "lock.shield"
        case .iCloudNotConfigured:
            return "icloud.slash"
        case .folderNotFound:
            return "folder.badge.minus"
        default:
            return "folder.badge.questionmark"
        }
    }

    private var errorColor: Color {
        guard let error = storageManager.accessError else {
            return .orange
        }

        switch error {
        case .bookmarkStale, .accessDenied, .notAccessible:
            return .orange
        case .iCloudNotConfigured:
            return .blue
        default:
            return .red
        }
    }

    private var errorTitle: String {
        guard let error = storageManager.accessError else {
            return "Storage Access Required"
        }

        switch error {
        case .bookmarkStale:
            return "Access Expired"
        case .accessDenied, .notAccessible:
            return "Access Denied"
        case .iCloudNotConfigured:
            return "iCloud Not Set Up"
        case .folderNotFound:
            return "Folder Not Found"
        default:
            return "Storage Access Required"
        }
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
