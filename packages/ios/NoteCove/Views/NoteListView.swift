import SwiftUI

/// List of notes, optionally filtered by folder
struct NoteListView: View {
    let folder: Folder?
    @Binding var selectedNote: Note?
    @State private var notes: [Note] = []
    @State private var searchText = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    @ObservedObject private var storageManager = StorageDirectoryManager.shared

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading notes...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = errorMessage {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text(error)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(selection: $selectedNote) {
                    ForEach(filteredNotes) { note in
                        NoteRowView(note: note)
                            .tag(note)
                    }
                }
                .listStyle(.plain)
                .searchable(text: $searchText, prompt: "Search notes")
            }
        }
        .onAppear {
            loadNotes()
        }
        .onChange(of: folder) { _, _ in
            // Re-filter, no reload needed
        }
        .onChange(of: storageManager.activeDirectory?.id) { _, _ in
            loadNotes()
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: createNewNote) {
                    Label("New Note", systemImage: "square.and.pencil")
                }
            }
        }
    }

    private var filteredNotes: [Note] {
        var result = notes

        // Filter by folder if selected
        if let folder = folder {
            result = result.filter { $0.folderId == folder.id }
        }

        // Filter by search text
        if !searchText.isEmpty {
            let query = searchText.lowercased()
            result = result.filter {
                $0.title.lowercased().contains(query) ||
                $0.preview.lowercased().contains(query)
            }
        }

        // Sort: pinned first, then by modified date
        return result.sorted { lhs, rhs in
            if lhs.isPinned != rhs.isPinned {
                return lhs.isPinned
            }
            return lhs.modifiedAt > rhs.modifiedAt
        }
    }

    private func loadNotes() {
        // Check if we have an active storage directory
        guard storageManager.activeDirectory != nil else {
            // Fall back to sample data when no storage directory
            notes = SampleData.notes
            return
        }

        isLoading = true
        errorMessage = nil

        Task { @MainActor in
            do {
                let crdtManager = CRDTManager.shared

                // Initialize if needed
                if !crdtManager.isInitialized {
                    try crdtManager.initialize()
                }

                // Load all notes from CRDT
                let noteInfos = try crdtManager.loadAllNotes()
                notes = noteInfos.map { Note(from: $0) }

                isLoading = false
            } catch {
                print("[NoteListView] Error loading notes: \(error)")
                errorMessage = "Could not load notes"
                // Fall back to sample data
                notes = SampleData.notes
                isLoading = false
            }
        }
    }

    private func createNewNote() {
        // TODO: Implement note creation in Phase 3
        print("Create new note")
    }
}

/// A single note row in the list
struct NoteRowView: View {
    let note: Note

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                if note.isPinned {
                    Image(systemName: "pin.fill")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }

                Text(note.title)
                    .font(.headline)
                    .lineLimit(1)
            }

            Text(note.preview)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(2)

            Text(note.modifiedAt, style: .relative)
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    NavigationStack {
        NoteListView(folder: nil, selectedNote: .constant(nil))
    }
}
