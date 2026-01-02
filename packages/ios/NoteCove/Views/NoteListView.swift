import SwiftUI
import Combine
import GRDB

/// List of notes, optionally filtered by folder
struct NoteListView: View {
    let folder: Folder?
    @Binding var selectedNote: Note?
    @Binding var newlyCreatedNoteId: String?
    @State private var notes: [Note] = []
    @State private var searchText = ""
    @State private var isLoading = false
    @State private var isRefreshing = false
    @State private var errorMessage: String?
    @State private var observationCancellable: AnyDatabaseCancellable?

    @ObservedObject private var storageManager = StorageDirectoryManager.shared
    @ObservedObject private var syncMonitor = SyncMonitor.shared

    init(folder: Folder?, selectedNote: Binding<Note?>, newlyCreatedNoteId: Binding<String?> = .constant(nil)) {
        self.folder = folder
        self._selectedNote = selectedNote
        self._newlyCreatedNoteId = newlyCreatedNoteId
    }

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
                .refreshable {
                    await refreshNotes()
                }
            }
        }
        .onAppear {
            startObservingNotes()
        }
        .onDisappear {
            observationCancellable?.cancel()
        }
        .onChange(of: folder?.id) { _, _ in
            // Restart observation with new folder filter
            startObservingNotes()
        }
        .onChange(of: storageManager.activeDirectory?.id) { _, _ in
            startObservingNotes()
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                HStack(spacing: 12) {
                    // Sync status indicator
                    if syncMonitor.isSyncing {
                        ProgressView()
                            .scaleEffect(0.8)
                    } else if let lastSync = syncMonitor.lastSyncTime {
                        Button(action: { Task { await refreshNotes() } }) {
                            Image(systemName: "arrow.clockwise")
                                .foregroundStyle(.secondary)
                        }
                        .help("Last synced: \(lastSync.formatted(.relative(presentation: .numeric)))")
                    }

                    Button(action: createNewNote) {
                        Label("New Note", systemImage: "square.and.pencil")
                    }
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

    private func startObservingNotes() {
        // Cancel any existing observation
        observationCancellable?.cancel()

        // Check if we have an active storage directory
        guard storageManager.activeDirectory != nil else {
            // Fall back to sample data when no storage directory
            notes = SampleData.notes
            return
        }

        let dbManager = DatabaseManager.shared
        guard dbManager.isInitialized else {
            // Database not ready yet - will be called again when it's ready
            isLoading = true
            return
        }

        isLoading = true
        errorMessage = nil

        // Create observation for notes
        // This will automatically update the notes array when database changes
        let observation = dbManager.observeNotes(folderId: folder?.id)

        observationCancellable = observation.start(
            in: dbManager.pool,
            onError: { error in
                Task { @MainActor in
                    print("[NoteListView] Database observation error: \(error)")
                    errorMessage = "Could not load notes"
                    isLoading = false
                }
            },
            onChange: { noteRecords in
                Task { @MainActor in
                    notes = noteRecords.map { Note(from: $0) }
                    isLoading = false
                }
            }
        )
    }

    private func createNewNote() {
        // Check if we have an active storage directory
        guard storageManager.activeDirectory != nil else {
            print("[NoteListView] Cannot create note: no active storage directory")
            return
        }

        Task { @MainActor in
            do {
                let crdtManager = CRDTManager.shared

                // Initialize if needed
                if !crdtManager.isInitialized {
                    try crdtManager.initialize()
                }

                // Create the new note with the current folder
                let noteId = try crdtManager.createNewNote(folderId: folder?.id)

                // Create a Note object for the new note
                let newNote = Note(
                    id: noteId,
                    title: "Untitled",
                    preview: "",
                    folderId: folder?.id,
                    createdAt: Date(),
                    modifiedAt: Date(),
                    isPinned: false
                )

                // Add to the local notes array
                notes.insert(newNote, at: 0)

                // Track as newly created so it opens in edit mode
                newlyCreatedNoteId = noteId

                // Select the new note to open it in the editor
                selectedNote = newNote

                // Notify that notes have changed
                NotificationCenter.default.post(name: .notesDidChange, object: nil)

                print("[NoteListView] Created new note: \(noteId)")
            } catch {
                print("[NoteListView] Error creating note: \(error)")
                errorMessage = "Could not create note"
            }
        }
    }

    private func refreshNotes() async {
        // Trigger sync monitor to check for changes
        // Database observation will automatically update UI when changes are detected
        await syncMonitor.triggerSync()
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
