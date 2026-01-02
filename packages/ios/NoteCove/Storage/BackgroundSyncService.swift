import Foundation
import Combine

/// Sync state for tracking progress
enum SyncState: Equatable {
    case notStarted
    case syncing(progress: SyncProgress)
    case complete
    case pendingDownloads(count: Int)
}

/// Progress information for sync
struct SyncProgress: Equatable {
    var totalNotes: Int
    var syncedNotes: Int
    var pendingDownloads: Int
    var isDownloadingFromCloud: Bool

    var fractionComplete: Double {
        guard totalNotes > 0 else { return 0 }
        return Double(syncedNotes) / Double(totalNotes)
    }
}

/// Background sync service that monitors iCloud files and populates the database
/// This ensures the UI always reads from the fast database, never blocking on file I/O
@MainActor
final class BackgroundSyncService: ObservableObject {
    static let shared = BackgroundSyncService()

    /// Current sync state
    @Published private(set) var syncState: SyncState = .notStarted

    /// Error from last sync attempt
    @Published private(set) var lastError: Error?

    private let crdtManager = CRDTManager.shared
    private let dbManager = DatabaseManager.shared
    private let storageManager = StorageDirectoryManager.shared

    /// Notes that are pending download
    private var pendingNotes: Set<String> = []

    /// Notes that failed to sync (will retry on next poll)
    private var failedNotes: Set<String> = []

    private init() {}

    // MARK: - Full Sync

    /// Perform a full sync of all notes to the database
    /// Call this when selecting a storage directory for the first time
    /// - Returns: Number of notes successfully synced
    @discardableResult
    func fullSync() async throws -> Int {
        guard let activeDir = storageManager.activeDirectory,
              let sdURL = activeDir.url else {
            throw CRDTError.fileNotFound("No active storage directory")
        }

        let sdId = activeDir.id

        // Initialize CRDT manager if needed
        if !crdtManager.isInitialized {
            try crdtManager.initialize()
        }

        // Get list of all note IDs
        let noteIds = try listNoteIds(in: sdURL)
        let totalNotes = noteIds.count

        var syncedCount = 0
        var pendingDownloadCount = 0

        // Update state
        syncState = .syncing(progress: SyncProgress(
            totalNotes: totalNotes,
            syncedNotes: 0,
            pendingDownloads: 0,
            isDownloadingFromCloud: false
        ))

        // Sync each note
        for noteId in noteIds {
            do {
                let success = try await syncNote(noteId: noteId, sdId: sdId, sdURL: sdURL)
                if success {
                    syncedCount += 1
                } else {
                    pendingDownloadCount += 1
                }
            } catch CRDTError.filesDownloading {
                pendingDownloadCount += 1
                pendingNotes.insert(noteId)
            } catch {
                print("[BackgroundSyncService] Error syncing note \(noteId): \(error)")
                failedNotes.insert(noteId)
            }

            // Update progress
            syncState = .syncing(progress: SyncProgress(
                totalNotes: totalNotes,
                syncedNotes: syncedCount,
                pendingDownloads: pendingDownloadCount,
                isDownloadingFromCloud: pendingDownloadCount > 0
            ))
        }

        // Update final state
        if pendingDownloadCount > 0 {
            syncState = .pendingDownloads(count: pendingDownloadCount)
        } else {
            syncState = .complete
        }

        print("[BackgroundSyncService] Full sync complete: \(syncedCount)/\(totalNotes) synced, \(pendingDownloadCount) pending")
        return syncedCount
    }

    /// Sync a single note to the database
    /// - Parameters:
    ///   - noteId: The note ID
    ///   - sdId: The storage directory ID
    ///   - sdURL: The storage directory URL
    /// - Returns: true if synced, false if pending download
    func syncNote(noteId: String, sdId: String, sdURL: URL) async throws -> Bool {
        let notesDir = sdURL.appendingPathComponent("notes").appendingPathComponent(noteId)
        let logsDir = notesDir.appendingPathComponent("logs")

        // Check if files are downloaded
        if FileManager.default.fileExists(atPath: logsDir.path) {
            let pendingCount = iCloudFileHelper.pendingDownloadCount(in: logsDir)
            if pendingCount > 0 {
                // Start downloads
                iCloudFileHelper.startDownloadingDirectory(logsDir)
                print("[BackgroundSyncService] Note \(noteId) has \(pendingCount) files downloading")
                return false
            }
        }

        // Load note info via CRDT manager
        let noteInfo = try crdtManager.loadNoteInfo(noteId: noteId)

        // Convert to database record
        let record = NoteRecord(
            id: noteInfo.id,
            title: noteInfo.title,
            sdId: sdId,
            folderId: noteInfo.folderId,
            created: Int64(noteInfo.createdAt.timeIntervalSince1970 * 1000),
            modified: Int64(noteInfo.modifiedAt.timeIntervalSince1970 * 1000),
            deleted: noteInfo.deleted,
            pinned: noteInfo.pinned,
            contentPreview: noteInfo.preview,
            contentText: noteInfo.preview  // For now, just use preview as full text
        )

        // Upsert to database
        try dbManager.upsertNote(record)

        // Remove from pending/failed sets
        pendingNotes.remove(noteId)
        failedNotes.remove(noteId)

        print("[BackgroundSyncService] Synced note \(noteId): \(noteInfo.title)")
        return true
    }

    /// Sync notes that changed (detected by SyncMonitor)
    /// - Parameter noteIds: IDs of notes that changed
    func syncChangedNotes(_ noteIds: [String]) async {
        guard let activeDir = storageManager.activeDirectory,
              let sdURL = activeDir.url else {
            return
        }

        let sdId = activeDir.id

        for noteId in noteIds {
            do {
                _ = try await syncNote(noteId: noteId, sdId: sdId, sdURL: sdURL)
            } catch {
                print("[BackgroundSyncService] Error syncing changed note \(noteId): \(error)")
            }
        }

        // Notify that notes have changed in database
        NotificationCenter.default.post(name: .notesDidChange, object: nil)
    }

    /// Retry syncing notes that are pending download
    func retryPendingNotes() async {
        guard !pendingNotes.isEmpty else { return }
        guard let activeDir = storageManager.activeDirectory,
              let sdURL = activeDir.url else {
            return
        }

        let sdId = activeDir.id
        var stillPending = 0

        for noteId in pendingNotes {
            do {
                let success = try await syncNote(noteId: noteId, sdId: sdId, sdURL: sdURL)
                if !success {
                    stillPending += 1
                }
            } catch {
                stillPending += 1
            }
        }

        // Update state
        if stillPending > 0 {
            syncState = .pendingDownloads(count: stillPending)
        } else if pendingNotes.isEmpty && failedNotes.isEmpty {
            syncState = .complete
        }
    }

    // MARK: - Helpers

    /// List all note IDs in a storage directory
    private func listNoteIds(in sdURL: URL) throws -> [String] {
        let notesDir = sdURL.appendingPathComponent("notes")

        guard FileManager.default.fileExists(atPath: notesDir.path) else {
            return []
        }

        let contents = try FileManager.default.contentsOfDirectory(
            at: notesDir,
            includingPropertiesForKeys: [.isDirectoryKey]
        )

        return contents.compactMap { url in
            guard let values = try? url.resourceValues(forKeys: [.isDirectoryKey]),
                  values.isDirectory == true else {
                return nil
            }
            return url.lastPathComponent
        }
    }

    /// Reset sync state (e.g., when switching storage directories)
    func reset() {
        syncState = .notStarted
        pendingNotes.removeAll()
        failedNotes.removeAll()
        lastError = nil
    }
}
