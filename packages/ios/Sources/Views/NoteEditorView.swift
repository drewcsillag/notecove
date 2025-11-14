//
//  NoteEditorView.swift
//  NoteCove
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import SwiftUI

struct NoteEditorView: View {
    @ObservedObject var viewModel: AppViewModel
    let noteId: String
    let storageId: String

    @State private var note: NoteRecord?
    @State private var isLoading = false
    @State private var title = ""

    var body: some View {
        VStack {
            if isLoading {
                ProgressView("Loading note...")
            } else if let note = note {
                // Title editor
                TextField("Note Title", text: $title)
                    .font(.title)
                    .padding()
                    .onChange(of: title) { _, newValue in
                        Task {
                            await updateNoteTitle(newValue)
                        }
                    }

                Divider()

                // TODO: Add WKWebView + TipTap editor here
                // For now, show a placeholder
                VStack {
                    Image(systemName: "doc.richtext")
                        .font(.system(size: 60))
                        .foregroundColor(.secondary)

                    Text("Editor Coming Soon")
                        .font(.title2)
                        .foregroundColor(.secondary)

                    Text("WKWebView + TipTap integration will be added in the next step")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                Spacer()
            } else {
                Text("Note not found")
                    .foregroundColor(.secondary)
            }
        }
        .navigationTitle(title.isEmpty ? "Untitled" : title)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadNote()
        }
    }

    private func loadNote() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let notes = try viewModel.database.listNotes(
                in: storageId,
                folderId: nil,
                includeDeleted: true
            )
            note = notes.first { $0.id == noteId }

            if let note = note {
                title = note.title
            }
        } catch {
            print("[NoteEditorView] Error loading note: \(error)")
        }
    }

    private func updateNoteTitle(_ newTitle: String) async {
        guard let note = note else { return }

        do {
            try viewModel.database.updateNote(
                id: note.id,
                title: newTitle,
                folderId: note.folderId
            )
        } catch {
            print("[NoteEditorView] Error updating title: \(error)")
        }
    }
}

#Preview {
    let db = try! DatabaseManager.inMemory()
    let viewModel = try! AppViewModel(database: db)

    try! db.upsertStorageDirectory(id: "sd-1", name: "My Notes", path: "/test")
    try! db.insertNote(id: "n-1", storageDirectoryId: "sd-1", folderId: nil, title: "Sample Note")

    return NavigationStack {
        NoteEditorView(viewModel: viewModel, noteId: "n-1", storageId: "sd-1")
    }
}
