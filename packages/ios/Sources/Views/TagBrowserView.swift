//
//  TagBrowserView.swift
//  NoteCove
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import SwiftUI

/// Main view for the Tags tab with segmented control for Folders/Tags
struct TagBrowserView: View {
    @ObservedObject var viewModel: AppViewModel
    @State private var selectedSegment: BrowserSegment = .folders

    enum BrowserSegment: String, CaseIterable {
        case folders = "Folders"
        case tags = "Tags"
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Segmented control for switching views
                Picker("Browse by", selection: $selectedSegment) {
                    ForEach(BrowserSegment.allCases, id: \.self) { segment in
                        Text(segment.rawValue)
                    }
                }
                .pickerStyle(.segmented)
                .padding()

                // Content based on selected segment
                switch selectedSegment {
                case .folders:
                    AllFoldersView(viewModel: viewModel)
                case .tags:
                    AllTagsView(viewModel: viewModel)
                }
            }
            .navigationTitle("Browse")
        }
    }
}

// MARK: - All Folders View

/// Shows folder tree across all storage directories
struct AllFoldersView: View {
    @ObservedObject var viewModel: AppViewModel

    var body: some View {
        List {
            ForEach(viewModel.storageDirectories) { sd in
                Section(header: Text(sd.name)) {
                    FolderSection(
                        viewModel: viewModel,
                        storageId: sd.id,
                        parentFolderId: nil
                    )
                }
            }
        }
        .listStyle(.insetGrouped)
    }
}

/// Recursive folder section showing folders and notes
struct FolderSection: View {
    @ObservedObject var viewModel: AppViewModel
    let storageId: String
    let parentFolderId: String?

    @State private var folders: [FolderRecord] = []
    @State private var notes: [NoteRecord] = []

    var body: some View {
        Group {
            // Subfolders
            ForEach(folders) { folder in
                DisclosureGroup {
                    FolderSection(
                        viewModel: viewModel,
                        storageId: storageId,
                        parentFolderId: folder.id
                    )
                } label: {
                    Label(folder.name, systemImage: "folder")
                }
            }

            // Notes in this folder
            ForEach(notes) { note in
                NavigationLink(destination: NoteEditorView(
                    viewModel: viewModel,
                    noteId: note.id,
                    storageId: storageId
                )) {
                    Label(note.title, systemImage: "doc.text")
                }
            }
        }
        .task {
            loadContent()
        }
        .onChange(of: storageId) { _, _ in
            loadContent()
        }
        .onChange(of: parentFolderId) { _, _ in
            loadContent()
        }
    }

    private func loadContent() {
        do {
            folders = try viewModel.database.listFolders(
                in: storageId,
                parentId: parentFolderId
            )
            notes = try viewModel.database.listNotes(
                in: storageId,
                folderId: parentFolderId
            )
        } catch {
            print("[FolderSection] Error loading content: \(error)")
        }
    }
}

// MARK: - All Tags View

/// Shows all tags with tri-state filtering capabilities
struct AllTagsView: View {
    @ObservedObject var viewModel: AppViewModel

    @State private var allTags: [TagRecord] = []
    @State private var tagStates: [String: TagFilterState] = [:]
    @State private var filteredNotes: [NoteRecord] = []
    @State private var searchText: String = ""

    enum TagFilterState {
        case none      // Tag not selected
        case and       // Must have this tag (blue)
        case or        // Can have this tag (green)
        case not       // Must NOT have this tag (red)

        var color: Color {
            switch self {
            case .none: return .gray
            case .and: return .blue
            case .or: return .green
            case .not: return .red
            }
        }

        var systemImage: String {
            switch self {
            case .none: return "circle"
            case .and: return "checkmark.circle.fill"
            case .or: return "plus.circle.fill"
            case .not: return "xmark.circle.fill"
            }
        }

        mutating func cycle() {
            switch self {
            case .none: self = .and
            case .and: self = .or
            case .or: self = .not
            case .not: self = .none
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Search bar
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                TextField("Search tags...", text: $searchText)
                    .textFieldStyle(.plain)
                if !searchText.isEmpty {
                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding()
            .background(Color(.systemGray6))

            // Filter legend
            HStack(spacing: 20) {
                Label("AND", systemImage: "checkmark.circle.fill")
                    .foregroundColor(.blue)
                    .font(.caption)
                Label("OR", systemImage: "plus.circle.fill")
                    .foregroundColor(.green)
                    .font(.caption)
                Label("NOT", systemImage: "xmark.circle.fill")
                    .foregroundColor(.red)
                    .font(.caption)
            }
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity)
            .background(Color(.systemGray6).opacity(0.5))

            // Main content
            if filteredTags.isEmpty && searchText.isEmpty {
                // No tags at all
                ContentUnavailableView(
                    "No Tags",
                    systemImage: "tag.slash",
                    description: Text("Create tags to organize your notes")
                )
            } else if filteredTags.isEmpty {
                // No tags match search
                ContentUnavailableView.search(text: searchText)
            } else {
                List {
                    // Tags section
                    Section("Tags") {
                        ForEach(filteredTags) { tag in
                            TagFilterRow(
                                tag: tag,
                                state: tagStates[tag.id] ?? .none,
                                onTap: {
                                    var state = tagStates[tag.id] ?? .none
                                    state.cycle()
                                    tagStates[tag.id] = state
                                    filterNotes()
                                }
                            )
                        }
                    }

                    // Filtered notes section
                    if hasActiveFilters {
                        Section("Filtered Notes (\(filteredNotes.count))") {
                            if filteredNotes.isEmpty {
                                Text("No notes match the selected tags")
                                    .foregroundColor(.secondary)
                                    .font(.caption)
                            } else {
                                ForEach(filteredNotes) { note in
                                    NavigationLink(destination: NoteEditorView(
                                        viewModel: viewModel,
                                        noteId: note.id,
                                        storageId: note.storageDirectoryId
                                    )) {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(note.title)
                                            Text(note.modifiedAt, style: .relative)
                                                .font(.caption)
                                                .foregroundColor(.secondary)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .task {
            loadTags()
        }
        .onChange(of: viewModel.storageDirectories.count) { _, _ in
            loadTags()
        }
    }

    private var filteredTags: [TagRecord] {
        if searchText.isEmpty {
            return allTags
        }
        return allTags.filter { tag in
            tag.name.localizedCaseInsensitiveContains(searchText)
        }
    }

    private var hasActiveFilters: Bool {
        !tagStates.values.filter({ $0 != .none }).isEmpty
    }

    private func loadTags() {
        allTags = []
        for sd in viewModel.storageDirectories {
            do {
                let tags = try viewModel.database.listTags(in: sd.id)
                allTags.append(contentsOf: tags)
            } catch {
                print("[AllTagsView] Error loading tags for SD \(sd.id): \(error)")
            }
        }
    }

    private func filterNotes() {
        let andTags = Set(tagStates.filter({ $0.value == .and }).map({ $0.key }))
        let orTags = Set(tagStates.filter({ $0.value == .or }).map({ $0.key }))
        let notTags = Set(tagStates.filter({ $0.value == .not }).map({ $0.key }))

        // If no filters active, clear results
        guard !andTags.isEmpty || !orTags.isEmpty || !notTags.isEmpty else {
            filteredNotes = []
            return
        }

        var results: [NoteRecord] = []

        // Get notes for each storage directory
        for sd in viewModel.storageDirectories {
            do {
                // Start with all notes in this SD
                var notes = try viewModel.database.listNotes(in: sd.id, folderId: nil, includeDeleted: false)

                // Also get notes from all folders in this SD
                let allFolders = try getAllFolders(in: sd.id)
                for folder in allFolders {
                    let folderNotes = try viewModel.database.listNotes(
                        in: sd.id,
                        folderId: folder.id,
                        includeDeleted: false
                    )
                    notes.append(contentsOf: folderNotes)
                }

                // Filter notes by tag logic
                for note in notes {
                    let noteTags = try viewModel.database.getTagsForNote(noteId: note.id)
                    let noteTagIds = Set(noteTags.map({ $0.id }))

                    // NOT logic: exclude if note has any NOT tags
                    if !notTags.isEmpty && !notTags.isDisjoint(with: noteTagIds) {
                        continue
                    }

                    // AND logic: note must have ALL AND tags
                    if !andTags.isEmpty && !andTags.isSubset(of: noteTagIds) {
                        continue
                    }

                    // OR logic: note must have at least ONE OR tag (if OR tags specified)
                    if !orTags.isEmpty && orTags.isDisjoint(with: noteTagIds) {
                        continue
                    }

                    results.append(note)
                }
            } catch {
                print("[AllTagsView] Error filtering notes for SD \(sd.id): \(error)")
            }
        }

        // Sort by modified date (most recent first)
        filteredNotes = results.sorted(by: { $0.modifiedAt > $1.modifiedAt })
    }

    private func getAllFolders(in storageId: String) throws -> [FolderRecord] {
        var allFolders: [FolderRecord] = []
        var toProcess: [String?] = [nil] // Start with root

        while !toProcess.isEmpty {
            let parentId = toProcess.removeFirst()
            let folders = try viewModel.database.listFolders(in: storageId, parentId: parentId)
            allFolders.append(contentsOf: folders)
            toProcess.append(contentsOf: folders.map({ $0.id }))
        }

        return allFolders
    }
}

/// Row showing a tag with its filter state button
struct TagFilterRow: View {
    let tag: TagRecord
    let state: AllTagsView.TagFilterState
    let onTap: () -> Void

    var body: some View {
        HStack {
            // Tag name and color
            HStack(spacing: 8) {
                Circle()
                    .fill(Color(hex: tag.color ?? "#808080"))
                    .frame(width: 12, height: 12)
                Text(tag.name)
            }

            Spacer()

            // Filter state button
            Button(action: onTap) {
                Image(systemName: state.systemImage)
                    .foregroundColor(state.color)
                    .font(.title3)
            }
            .buttonStyle(.plain)
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
    }
}

// MARK: - Color Extension

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Preview

#Preview {
    let db = try! DatabaseManager.inMemory()
    let viewModel = try! AppViewModel(database: db)

    // Add sample data
    try! db.upsertStorageDirectory(id: "sd-1", name: "My Notes", path: "/test1")
    try! db.insertFolder(id: "f-1", storageDirectoryId: "sd-1", parentId: nil, name: "Work")
    try! db.insertFolder(id: "f-2", storageDirectoryId: "sd-1", parentId: "f-1", name: "Projects")
    try! db.insertNote(id: "n-1", storageDirectoryId: "sd-1", folderId: "f-1", title: "Meeting Notes")
    try! db.insertNote(id: "n-2", storageDirectoryId: "sd-1", folderId: "f-2", title: "Project Plan")

    return TagBrowserView(viewModel: viewModel)
}
