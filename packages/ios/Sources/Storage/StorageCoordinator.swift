import Foundation
import Combine

/// Central coordinator for storage operations, integrating file watching, change processing, and database updates.
///
/// The StorageCoordinator ties together:
/// - FileWatchManager: Monitors directories for changes
/// - FileChangeProcessor: Processes changes and updates the database
/// - ActivitySync: Syncs from other instances' activity logs
/// - DatabaseManager: Stores note metadata
/// - iCloudManager: Monitors iCloud sync status
///
/// Example usage:
/// ```swift
/// let coordinator = StorageCoordinator(db: databaseManager)
///
/// // Load storage directories
/// await coordinator.loadStorageDirectories()
///
/// // Start watching a storage directory
/// await coordinator.startWatching(storageId: "storage-123")
///
/// // Observe changes
/// coordinator.$recentlyUpdatedNotes
///     .sink { notes in
///         print("Notes updated: \(notes)")
///     }
/// ```
@MainActor
public class StorageCoordinator: ObservableObject {
    // Published properties for UI observation
    @Published public var storageDirectories: [StorageDirectoryRecord] = []
    @Published public var recentlyUpdatedNotes: Set<String> = []

    // Dependencies
    private let db: DatabaseManager
    private let bridge: CRDTBridge
    private let fileIO: FileIOManager
    private let iCloud: iCloudManager

    // File watching infrastructure
    private var watchers: [String: FileWatchManager] = [:] // storageId -> watcher
    private var processors: [String: FileChangeProcessor] = [:] // storageId -> processor
    private var activitySyncs: [String: ActivitySync] = [:] // storageId -> activity sync

    // Periodic polling timer (fallback for file watching unreliability)
    private var pollingTimers: [String: Timer] = [:] // storageId -> timer

    // Track currently loaded notes (for ActivitySync)
    private var loadedNotes: Set<String> = []

    /// Creates a new storage coordinator
    /// - Parameter db: The database manager to use
    public init(db: DatabaseManager) {
        self.db = db
        self.bridge = CRDTBridge()
        self.fileIO = FileIOManager()
        self.iCloud = iCloudManager()
    }

    /// Loads storage directories from the database
    public func loadStorageDirectories() async {
        do {
            let directories = try db.listStorageDirectories()
            storageDirectories = directories
            print("[StorageCoordinator] Loaded \(directories.count) storage directories")
        } catch {
            print("[StorageCoordinator] Error loading storage directories: \(error)")
        }
    }

    /// Starts watching a storage directory for changes
    /// - Parameter storageId: The storage directory ID to watch
    public func startWatching(storageId: String) async {
        // Get the storage directory info
        guard let storageDir = try? db.getStorageDirectory(id: storageId) else {
            print("[StorageCoordinator] Storage directory not found: \(storageId)")
            return
        }

        // Stop any existing watcher for this storage ID
        await stopWatching(storageId: storageId)

        // Create a file change processor for this storage directory
        let processor = FileChangeProcessor(db: db, bridge: bridge, fileIO: fileIO)
        processors[storageId] = processor

        // Create activity sync for cross-platform sync
        let activityDir = "\(storageDir.path)/.activity"
        let activitySync = ActivitySync(
            fileIO: fileIO,
            instanceId: InstanceIDManager.shared.getInstanceId(),
            activityDir: activityDir,
            storageId: storageId,
            delegate: self
        )
        activitySyncs[storageId] = activitySync

        // Create a file watcher
        let watcher = FileWatchManager()

        // Start watching the directory
        watcher.watchDirectory(path: storageDir.path, debounceInterval: 0.5) { [weak self] in
            Task { @MainActor [weak self] in
                guard let self = self else { return }
                await self.handleFileChange(in: storageDir.path, storageId: storageId)
            }
        }

        watchers[storageId] = watcher

        print("[StorageCoordinator] Started watching storage directory: \(storageId) at \(storageDir.path)")

        // Perform initial sync from other instances' activity logs
        // This catches any changes that happened before we started watching
        print("[StorageCoordinator] ========================================")
        print("[StorageCoordinator] PERFORMING INITIAL ACTIVITY SYNC")
        print("[StorageCoordinator] Storage ID: \(storageId)")
        print("[StorageCoordinator] Storage Path: \(storageDir.path)")
        print("[StorageCoordinator] Activity Dir: \(activityDir)")
        print("[StorageCoordinator] ========================================")

        let affectedNotes = await activitySync.syncFromOtherInstances()

        if !affectedNotes.isEmpty {
            print("[StorageCoordinator] ✅ Initial sync affected \(affectedNotes.count) notes: \(affectedNotes)")
            for noteId in affectedNotes {
                recentlyUpdatedNotes.insert(noteId)
            }
        } else {
            print("[StorageCoordinator] Initial sync found no new notes")
        }

        print("[StorageCoordinator] ========================================")

        // Start periodic polling as fallback (every 5 seconds)
        // This ensures cross-platform sync works even if file watching fails
        print("[StorageCoordinator] Starting periodic activity sync timer (5s interval)")
        let timer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self = self else { return }
                print("[StorageCoordinator] ⏰ Periodic sync triggered for \(storageId)")

                if let activitySync = self.activitySyncs[storageId] {
                    let affected = await activitySync.syncFromOtherInstances()
                    if !affected.isEmpty {
                        print("[StorageCoordinator] Periodic sync found \(affected.count) notes")
                        for noteId in affected {
                            self.recentlyUpdatedNotes.insert(noteId)
                        }
                    }
                }
            }
        }
        pollingTimers[storageId] = timer
        print("[StorageCoordinator] Periodic polling timer started for \(storageId)")
    }

    /// Stops watching a storage directory
    /// - Parameter storageId: The storage directory ID to stop watching
    public func stopWatching(storageId: String) async {
        if let watcher = watchers[storageId] {
            watcher.stopWatching()
            watchers.removeValue(forKey: storageId)
        }

        // Stop periodic polling timer
        if let timer = pollingTimers[storageId] {
            timer.invalidate()
            pollingTimers.removeValue(forKey: storageId)
            print("[StorageCoordinator] Stopped periodic polling timer for \(storageId)")
        }

        processors.removeValue(forKey: storageId)
        activitySyncs.removeValue(forKey: storageId)

        print("[StorageCoordinator] Stopped watching storage directory: \(storageId)")
    }

    /// Stops watching all storage directories
    public func stopAllWatching() async {
        for storageId in watchers.keys {
            await stopWatching(storageId: storageId)
        }

        print("[StorageCoordinator] Stopped watching all storage directories")
    }

    /// Handles a file change in a directory
    /// - Parameters:
    ///   - directory: The directory path where changes occurred
    ///   - storageId: The storage directory ID (optional, will be looked up if not provided)
    public func handleFileChange(in directory: String, storageId: String? = nil) async {
        print("[StorageCoordinator] ========================================")
        print("[StorageCoordinator] 🔔 HANDLE FILE CHANGE CALLED")
        print("[StorageCoordinator] Timestamp: \(Date())")
        print("[StorageCoordinator] Directory: \(directory)")
        print("[StorageCoordinator] Provided storage ID: \(storageId ?? "nil")")
        print("[StorageCoordinator] ========================================")

        // Find the storage ID if not provided
        var storageIdToUse = storageId
        if storageIdToUse == nil {
            // Look up the storage directory by path
            if let storageDir = storageDirectories.first(where: { $0.path == directory }) {
                storageIdToUse = storageDir.id
            }
        }

        guard let storageId = storageIdToUse else {
            print("[StorageCoordinator] Could not find storage ID for directory: \(directory)")
            return
        }

        // Sync from other instances' activity logs (cross-platform sync)
        if let activitySync = activitySyncs[storageId] {
            print("[StorageCoordinator] Running activity sync...")
            let affectedNotes = await activitySync.syncFromOtherInstances()
            if !affectedNotes.isEmpty {
                print("[StorageCoordinator] Activity sync affected \(affectedNotes.count) notes: \(affectedNotes)")
                for noteId in affectedNotes {
                    recentlyUpdatedNotes.insert(noteId)
                }
            }
        }

        // Get the processor for this storage directory
        guard let processor = processors[storageId] else {
            print("[StorageCoordinator] No processor found for storage ID: \(storageId)")
            return
        }

        // Process the changes (scan note directories)
        do {
            try await processor.processChangedFiles(in: directory, storageId: storageId)
            print("[StorageCoordinator] Successfully processed file changes")

            // Reload storage directories to reflect any changes
            await loadStorageDirectories()
        } catch {
            print("[StorageCoordinator] Error processing file changes: \(error)")
        }
    }

    /// Marks a note as recently updated
    /// - Parameter noteId: The note ID
    public func markNoteAsUpdated(_ noteId: String) async {
        recentlyUpdatedNotes.insert(noteId)
        print("[StorageCoordinator] Marked note as updated: \(noteId)")
    }

    /// Clears the set of recently updated notes
    public func clearRecentlyUpdatedNotes() async {
        recentlyUpdatedNotes.removeAll()
        print("[StorageCoordinator] Cleared recently updated notes")
    }

    deinit {
        // Stop all watching when coordinator is deallocated
        Task { [weak self] in
            await self?.stopAllWatching()
        }
    }
}

// MARK: - ActivitySyncDelegate

@MainActor
extension StorageCoordinator: ActivitySyncDelegate {
    /// Reload a note from disk (called by ActivitySync)
    public func reloadNote(noteId: String, storageId: String) async throws {
        print("[StorageCoordinator] Reloading note from disk: \(noteId)")

        // Get the processor for this storage directory
        guard let processor = processors[storageId] else {
            throw NSError(
                domain: "StorageCoordinator",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "No processor found for storage ID: \(storageId)"]
            )
        }

        // Update the note from file system
        try await processor.updateNoteFromFile(noteId: noteId, storageId: storageId)

        // Mark as loaded
        loadedNotes.insert(noteId)

        // Mark as recently updated for UI
        recentlyUpdatedNotes.insert(noteId)

        print("[StorageCoordinator] Successfully reloaded note: \(noteId)")
    }

    /// Get list of currently loaded note IDs (called by ActivitySync)
    public func getLoadedNotes() -> [String] {
        return Array(loadedNotes)
    }
}
