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

    @StateObject private var editorViewModel: EditorViewModel

    init(viewModel: AppViewModel, noteId: String, storageId: String) {
        self.viewModel = viewModel
        self.noteId = noteId
        self.storageId = storageId

        // Initialize editor view model
        _editorViewModel = StateObject(wrappedValue: EditorViewModel(
            noteId: noteId,
            storageId: storageId,
            bridge: viewModel.bridge,
            database: viewModel.database
        ))
    }

    var body: some View {
        VStack(spacing: 0) {
            if editorViewModel.isLoading {
                ProgressView("Loading note...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                // Rich text editor
                EditorWebView(viewModel: editorViewModel)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(editorViewModel.noteTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Button {
                    Task {
                        await editorViewModel.executeCommand("toggleBold")
                    }
                } label: {
                    Image(systemName: "bold")
                }

                Button {
                    Task {
                        await editorViewModel.executeCommand("toggleItalic")
                    }
                } label: {
                    Image(systemName: "italic")
                }

                Button {
                    Task {
                        await editorViewModel.executeCommand("toggleUnderline")
                    }
                } label: {
                    Image(systemName: "underline")
                }

                Spacer()

                Button {
                    Task {
                        await editorViewModel.executeCommand("toggleBulletList")
                    }
                } label: {
                    Image(systemName: "list.bullet")
                }

                Button {
                    Task {
                        await editorViewModel.executeCommand("toggleOrderedList")
                    }
                } label: {
                    Image(systemName: "list.number")
                }
            }
        }
        .task {
            // Load note when view appears
            if editorViewModel.editorReady {
                await editorViewModel.loadNote()
            }
        }
        .onChange(of: editorViewModel.editorReady) { _, isReady in
            if isReady {
                Task {
                    await editorViewModel.loadNote()
                }
            }
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
