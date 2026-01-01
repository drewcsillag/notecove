import SwiftUI

/// List of notes, optionally filtered by folder
struct NoteListView: View {
    let folder: Folder?
    @Binding var selectedNote: Note?
    @State private var notes: [Note] = []
    @State private var searchText = ""

    var body: some View {
        List(selection: $selectedNote) {
            ForEach(filteredNotes) { note in
                NoteRowView(note: note)
                    .tag(note)
            }
        }
        .listStyle(.plain)
        .searchable(text: $searchText, prompt: "Search notes")
        .onAppear {
            loadNotes()
        }
        .onChange(of: folder) { _, _ in
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
        // TODO: Load from database
        // For now, use placeholder data
        notes = [
            Note(
                id: "note-1",
                title: "Welcome to NoteCove",
                preview: "This is your first note. Start typing to edit...",
                folderId: nil,
                createdAt: Date().addingTimeInterval(-86400),
                modifiedAt: Date(),
                isPinned: true
            ),
            Note(
                id: "note-2",
                title: "Meeting Notes",
                preview: "Discussed project timeline and deliverables...",
                folderId: "folder-1",
                createdAt: Date().addingTimeInterval(-172800),
                modifiedAt: Date().addingTimeInterval(-3600),
                isPinned: false
            ),
            Note(
                id: "note-3",
                title: "Ideas",
                preview: "Random thoughts and ideas for the weekend...",
                folderId: "folder-2",
                createdAt: Date().addingTimeInterval(-259200),
                modifiedAt: Date().addingTimeInterval(-7200),
                isPinned: false
            ),
        ]
    }

    private func createNewNote() {
        // TODO: Implement note creation
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
