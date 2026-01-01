import SwiftUI

/// Debug view for inspecting storage directory contents and database
struct DebugView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var storageManager = StorageDirectoryManager.shared

    @State private var selectedTab = 0
    @State private var files: [FileInfo] = []
    @State private var dbStats: DebugDatabaseStats?
    @State private var activityLogs: [ActivityLogEntry] = []
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("View", selection: $selectedTab) {
                    Text("Files").tag(0)
                    Text("Database").tag(1)
                    Text("Activity").tag(2)
                }
                .pickerStyle(.segmented)
                .padding()

                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    switch selectedTab {
                    case 0:
                        filesView
                    case 1:
                        databaseView
                    case 2:
                        activityView
                    default:
                        EmptyView()
                    }
                }
            }
            .navigationTitle("Debug")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button(action: refresh) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .onAppear {
                refresh()
            }
            .onChange(of: selectedTab) { _, _ in
                refresh()
            }
        }
    }

    // MARK: - Files View

    private var filesView: some View {
        Group {
            if let activeDir = storageManager.activeDirectory,
               let url = activeDir.url {
                List {
                    Section("Storage Directory") {
                        LabeledContent("ID", value: activeDir.id)
                        LabeledContent("Path", value: url.path)
                    }

                    Section("Contents (\(files.count) items)") {
                        ForEach(files) { file in
                            FileRowView(file: file)
                        }
                    }
                }
            } else {
                noStorageDirectoryView
            }
        }
    }

    // MARK: - Database View

    private var databaseView: some View {
        Group {
            if let stats = dbStats {
                List {
                    Section("Tables") {
                        ForEach(stats.tables, id: \.name) { table in
                            LabeledContent(table.name, value: "\(table.rowCount) rows")
                        }
                    }

                    Section("Info") {
                        LabeledContent("Database Path", value: stats.path)
                        LabeledContent("Size", value: formatBytes(stats.sizeBytes))
                    }
                }
            } else {
                ContentUnavailableView(
                    "No Database",
                    systemImage: "cylinder.split.1x2",
                    description: Text("Database not initialized")
                )
            }
        }
    }

    // MARK: - Activity View

    private var activityView: some View {
        Group {
            if activityLogs.isEmpty {
                ContentUnavailableView(
                    "No Activity",
                    systemImage: "clock",
                    description: Text("No activity log entries found")
                )
            } else {
                List {
                    ForEach(activityLogs) { entry in
                        ActivityLogRowView(entry: entry)
                    }
                }
            }
        }
    }

    private var noStorageDirectoryView: some View {
        ContentUnavailableView(
            "No Storage Directory",
            systemImage: "folder.badge.questionmark",
            description: Text("Select a storage directory in settings")
        )
    }

    // MARK: - Actions

    private func refresh() {
        isLoading = true

        Task { @MainActor in
            switch selectedTab {
            case 0:
                files = loadFiles()
            case 1:
                dbStats = loadDatabaseStats()
            case 2:
                activityLogs = loadActivityLogs()
            default:
                break
            }
            isLoading = false
        }
    }

    private func loadFiles() -> [FileInfo] {
        guard let activeDir = storageManager.activeDirectory,
              let url = activeDir.url else {
            return []
        }

        var result: [FileInfo] = []
        let fm = FileManager.default

        // Recursively list files up to 2 levels deep
        func listDir(_ dirURL: URL, depth: Int = 0) {
            guard depth < 3 else { return }

            guard let contents = try? fm.contentsOfDirectory(
                at: dirURL,
                includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey, .contentModificationDateKey]
            ) else { return }

            for itemURL in contents.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) {
                let values = try? itemURL.resourceValues(forKeys: [.isDirectoryKey, .fileSizeKey, .contentModificationDateKey])
                let isDir = values?.isDirectory ?? false
                let size = values?.fileSize ?? 0
                let modified = values?.contentModificationDate ?? Date.distantPast

                let relativePath = itemURL.path.replacingOccurrences(of: url.path + "/", with: "")

                result.append(FileInfo(
                    id: relativePath,
                    name: itemURL.lastPathComponent,
                    path: relativePath,
                    isDirectory: isDir,
                    sizeBytes: Int64(size),
                    modifiedAt: modified
                ))

                if isDir {
                    listDir(itemURL, depth: depth + 1)
                }
            }
        }

        listDir(url)
        return result
    }

    private func loadDatabaseStats() -> DebugDatabaseStats? {
        let dbManager = DatabaseManager.shared

        guard dbManager.isInitialized else {
            return nil
        }

        var tables: [TableInfo] = []

        // Get table counts
        let tableNames = ["notes", "notes_fts", "folders", "storage_directories", "profiles", "sync_state"]

        for name in tableNames {
            if let count = try? dbManager.getRowCount(tableName: name) {
                tables.append(TableInfo(name: name, rowCount: count))
            }
        }

        // Get database file size
        let dbPath = dbManager.databasePath
        let size = (try? FileManager.default.attributesOfItem(atPath: dbPath)[.size] as? Int64) ?? 0

        return DebugDatabaseStats(
            path: dbPath,
            sizeBytes: size,
            tables: tables
        )
    }

    private func loadActivityLogs() -> [ActivityLogEntry] {
        guard let activeDir = storageManager.activeDirectory,
              let url = activeDir.url else {
            return []
        }

        let activityDir = url.appendingPathComponent("activity")
        guard FileManager.default.fileExists(atPath: activityDir.path) else {
            return []
        }

        var entries: [ActivityLogEntry] = []

        guard let files = try? FileManager.default.contentsOfDirectory(
            at: activityDir,
            includingPropertiesForKeys: [.contentModificationDateKey]
        ) else {
            return []
        }

        // Read JSON files
        for file in files.filter({ $0.pathExtension == "json" }).prefix(50) {
            if let data = try? Data(contentsOf: file),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let entry = ActivityLogEntry(
                    id: file.lastPathComponent,
                    timestamp: json["timestamp"] as? String ?? "",
                    action: json["action"] as? String ?? "",
                    details: json["details"] as? String ?? "",
                    instanceId: json["instanceId"] as? String ?? ""
                )
                entries.append(entry)
            }
        }

        return entries.sorted { $0.timestamp > $1.timestamp }
    }

    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - Supporting Types

struct FileInfo: Identifiable {
    let id: String
    let name: String
    let path: String
    let isDirectory: Bool
    let sizeBytes: Int64
    let modifiedAt: Date
}

struct TableInfo {
    let name: String
    let rowCount: Int
}

struct DebugDatabaseStats {
    let path: String
    let sizeBytes: Int64
    let tables: [TableInfo]
}

struct ActivityLogEntry: Identifiable {
    let id: String
    let timestamp: String
    let action: String
    let details: String
    let instanceId: String
}

// MARK: - Row Views

struct FileRowView: View {
    let file: FileInfo

    var body: some View {
        HStack {
            Image(systemName: file.isDirectory ? "folder.fill" : "doc.fill")
                .foregroundStyle(file.isDirectory ? .blue : .secondary)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(file.path)
                    .font(.system(.body, design: .monospaced))
                    .lineLimit(1)

                HStack(spacing: 8) {
                    if !file.isDirectory {
                        Text(formatBytes(file.sizeBytes))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Text(file.modifiedAt, style: .relative)
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }

    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
}

struct ActivityLogRowView: View {
    let entry: ActivityLogEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(entry.action)
                    .font(.headline)
                Spacer()
                Text(entry.timestamp)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if !entry.details.isEmpty {
                Text(entry.details)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            Text("Instance: \(entry.instanceId)")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 2)
    }
}

#Preview {
    DebugView()
}
