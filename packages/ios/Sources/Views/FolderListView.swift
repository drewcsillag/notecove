//
//  FolderListView.swift
//  NoteCove
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import SwiftUI

struct FolderListView: View {
    @ObservedObject var viewModel: AppViewModel
    let storageId: String
    let parentFolderId: String?

    @State private var folders: [FolderRecord] = []
    @State private var notes: [NoteRecord] = []
    @State private var isLoading = false
    @State private var showingAddFolderSheet = false
    @State private var showingAddNoteSheet = false
    @State private var newFolderName = ""
    @State private var newNoteTitle = ""

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading...")
            } else if folders.isEmpty && notes.isEmpty {
                emptyState
            } else {
                contentList
            }
        }
        .navigationTitle(navigationTitle)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button {
                        showingAddNoteSheet = true
                    } label: {
                        Label("New Note", systemImage: "doc.badge.plus")
                    }

                    Button {
                        showingAddFolderSheet = true
                    } label: {
                        Label("New Folder", systemImage: "folder.badge.plus")
                    }
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showingAddFolderSheet) {
            addFolderSheet
        }
        .sheet(isPresented: $showingAddNoteSheet) {
            addNoteSheet
        }
        .task {
            await loadContent()
        }
        .refreshable {
            await loadContent()
        }
    }

    private var navigationTitle: String {
        if let parentFolderId = parentFolderId,
           let folder = folders.first(where: { $0.parentId == parentFolderId }) {
            return folder.name
        }
        return "Notes"
    }

    private var emptyState: some View {
        VStack(spacing: 20) {
            Image(systemName: "tray")
                .font(.system(size: 60))
                .foregroundColor(.secondary)

            Text("No Notes or Folders")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Create a note or folder to get started")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            HStack(spacing: 16) {
                Button {
                    showingAddNoteSheet = true
                } label: {
                    Label("New Note", systemImage: "doc.badge.plus")
                }
                .buttonStyle(.bordered)

                Button {
                    showingAddFolderSheet = true
                } label: {
                    Label("New Folder", systemImage: "folder.badge.plus")
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
    }

    private var contentList: some View {
        List {
            // Folders section
            if !folders.isEmpty {
                Section {
                    ForEach(folders) { folder in
                        NavigationLink(destination: FolderListView(
                            viewModel: viewModel,
                            storageId: storageId,
                            parentFolderId: folder.id
                        )) {
                            FolderRow(folder: folder)
                        }
                    }
                } header: {
                    Text("Folders")
                }
            }

            // Notes section
            if !notes.isEmpty {
                Section {
                    ForEach(notes) { note in
                        NavigationLink(destination: NoteEditorView(
                            viewModel: viewModel,
                            noteId: note.id,
                            storageId: storageId
                        )) {
                            NoteRow(note: note)
                        }
                    }
                } header: {
                    Text("Notes")
                }
            }
        }
    }

    private var addFolderSheet: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Folder Name", text: $newFolderName)
                }
            }
            .navigationTitle("New Folder")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showingAddFolderSheet = false
                        newFolderName = ""
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task {
                            await createFolder()
                        }
                    }
                    .disabled(newFolderName.isEmpty)
                }
            }
        }
    }

    private var addNoteSheet: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Note Title", text: $newNoteTitle)
                }
            }
            .navigationTitle("New Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showingAddNoteSheet = false
                        newNoteTitle = ""
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task {
                            await createNote()
                        }
                    }
                    .disabled(newNoteTitle.isEmpty)
                }
            }
        }
    }

    private func loadContent() async {
        isLoading = true
        defer { isLoading = false }

        do {
            // Load folders for this parent
            folders = try viewModel.database.listFolders(
                in: storageId,
                parentId: parentFolderId
            )

            // Load notes for this folder
            notes = try viewModel.database.listNotes(
                in: storageId,
                folderId: parentFolderId,
                includeDeleted: false
            )
        } catch {
            print("[FolderListView] Error loading content: \(error)")
        }
    }

    private func createFolder() async {
        do {
            let folderId = UUID().uuidString

            try viewModel.database.insertFolder(
                id: folderId,
                storageDirectoryId: storageId,
                parentId: parentFolderId,
                name: newFolderName
            )

            showingAddFolderSheet = false
            newFolderName = ""
            await loadContent()
        } catch {
            print("[FolderListView] Error creating folder: \(error)")
        }
    }

    private func createNote() async {
        do {
            let noteId = UUID().uuidString

            try viewModel.database.insertNote(
                id: noteId,
                storageDirectoryId: storageId,
                folderId: parentFolderId,
                title: newNoteTitle
            )

            // Create the note in the CRDT bridge
            try viewModel.bridge.createNote(noteId: noteId)

            showingAddNoteSheet = false
            newNoteTitle = ""
            await loadContent()
        } catch {
            print("[FolderListView] Error creating note: \(error)")
        }
    }
}

struct FolderRow: View {
    let folder: FolderRecord

    var body: some View {
        HStack {
            Image(systemName: "folder.fill")
                .foregroundColor(.blue)

            Text(folder.name)
        }
        .padding(.vertical, 4)
    }
}

struct NoteRow: View {
    let note: NoteRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(note.title)
                .font(.headline)

            HStack {
                Text(formatDate(note.modifiedAt))
                    .font(.caption)
                    .foregroundColor(.secondary)

                if note.deletedAt != nil {
                    Text("• Deleted")
                        .font(.caption)
                        .foregroundColor(.red)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

#Preview {
    let db = try! DatabaseManager.inMemory()
    let viewModel = try! AppViewModel(database: db)

    _ = try! db.upsertStorageDirectory(id: "sd-1", name: "My Notes", path: "/test")
    _ = try! db.insertFolder(id: "f-1", storageDirectoryId: "sd-1", parentId: nil, name: "Work")
    _ = try! db.insertFolder(id: "f-2", storageDirectoryId: "sd-1", parentId: nil, name: "Personal")
    _ = try! db.insertNote(id: "n-1", storageDirectoryId: "sd-1", folderId: nil, title: "Welcome to NoteCove")
    _ = try! db.insertNote(id: "n-2", storageDirectoryId: "sd-1", folderId: nil, title: "Getting Started")

    return FolderListView(viewModel: viewModel, storageId: "sd-1", parentFolderId: nil)
}
