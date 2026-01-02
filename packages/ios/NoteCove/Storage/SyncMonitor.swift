import Foundation
import Combine
import UIKit

/// Monitors storage directory for changes and triggers reloads
/// Polls while app is in foreground, pauses in background
@MainActor
final class SyncMonitor: ObservableObject {
    static let shared = SyncMonitor()

    /// Published event for when notes have been updated
    @Published private(set) var lastSyncTime: Date?
    @Published private(set) var isSyncing = false
    @Published private(set) var syncError: Error?

    /// Polling interval in seconds (while app is in foreground)
    var pollingInterval: TimeInterval = 30

    private var cancellables = Set<AnyCancellable>()
    private var lastKnownNoteModTimes: [String: Date] = [:]
    private var pollingTimer: Timer?
    private var isInForeground = true

    private let storageManager = StorageDirectoryManager.shared
    private let crdtManager = CRDTManager.shared

    private init() {
        setupLifecycleObservers()
        startPolling()
    }

    // MARK: - Lifecycle

    private func setupLifecycleObservers() {
        // Listen for app becoming active
        NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)
            .sink { [weak self] _ in
                self?.isInForeground = true
                self?.startPolling()
                Task { @MainActor in
                    await self?.performSync()
                }
            }
            .store(in: &cancellables)

        // Listen for app entering foreground
        NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)
            .sink { [weak self] _ in
                self?.isInForeground = true
                self?.startPolling()
                Task { @MainActor in
                    await self?.performSync()
                }
            }
            .store(in: &cancellables)

        // Listen for app going to background
        NotificationCenter.default.publisher(for: UIApplication.didEnterBackgroundNotification)
            .sink { [weak self] _ in
                self?.isInForeground = false
                self?.stopPolling()
            }
            .store(in: &cancellables)
    }

    // MARK: - Polling

    private func startPolling() {
        stopPolling() // Clear any existing timer

        pollingTimer = Timer.scheduledTimer(withTimeInterval: pollingInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.performSync()
            }
        }
    }

    private func stopPolling() {
        pollingTimer?.invalidate()
        pollingTimer = nil
    }

    // MARK: - Sync

    /// Trigger a manual sync
    func triggerSync() async {
        await performSync()
    }

    private func performSync() async {
        guard !isSyncing else { return }

        guard let activeDir = storageManager.activeDirectory,
              let url = activeDir.url else {
            return
        }

        isSyncing = true
        syncError = nil

        do {
            // Scan for new/modified notes
            let changes = try scanForChanges(in: url)

            if changes.hasChanges {
                // Clear CRDT cache to force reload
                crdtManager.clearCache()

                // Post notification for views to reload
                NotificationCenter.default.post(name: .notesDidChange, object: nil)

                print("[SyncMonitor] Detected changes - new: \(changes.newNotes.count), modified: \(changes.modifiedNotes.count), deleted: \(changes.deletedNotes.count)")
            }

            lastSyncTime = Date()
        } catch {
            print("[SyncMonitor] Sync error: \(error)")
            syncError = error
        }

        isSyncing = false
    }

    // MARK: - Change Detection

    private struct SyncChanges {
        var newNotes: [String] = []
        var modifiedNotes: [String] = []
        var deletedNotes: [String] = []

        var hasChanges: Bool {
            !newNotes.isEmpty || !modifiedNotes.isEmpty || !deletedNotes.isEmpty
        }
    }

    private func scanForChanges(in sdURL: URL) throws -> SyncChanges {
        let fm = FileManager.default
        let notesDir = sdURL.appendingPathComponent("notes")

        guard fm.fileExists(atPath: notesDir.path) else {
            return SyncChanges()
        }

        var changes = SyncChanges()
        var currentNoteIds = Set<String>()

        // Scan note directories
        let contents = try fm.contentsOfDirectory(
            at: notesDir,
            includingPropertiesForKeys: [.contentModificationDateKey, .isDirectoryKey]
        )

        for itemURL in contents {
            guard let values = try? itemURL.resourceValues(forKeys: [.isDirectoryKey, .contentModificationDateKey]),
                  values.isDirectory == true else {
                continue
            }

            let noteId = itemURL.lastPathComponent
            currentNoteIds.insert(noteId)

            // Get latest modification time from logs folder
            let logsDir = itemURL.appendingPathComponent("logs")
            var latestModTime: Date = .distantPast

            if let logFiles = try? fm.contentsOfDirectory(
                at: logsDir,
                includingPropertiesForKeys: [.contentModificationDateKey]
            ) {
                for logFile in logFiles {
                    if let logValues = try? logFile.resourceValues(forKeys: [.contentModificationDateKey]),
                       let modDate = logValues.contentModificationDate,
                       modDate > latestModTime {
                        latestModTime = modDate
                    }
                }
            }

            // Check against last known state
            if let lastKnown = lastKnownNoteModTimes[noteId] {
                if latestModTime > lastKnown {
                    changes.modifiedNotes.append(noteId)
                }
            } else {
                changes.newNotes.append(noteId)
            }

            lastKnownNoteModTimes[noteId] = latestModTime
        }

        // Check for deleted notes
        for (noteId, _) in lastKnownNoteModTimes {
            if !currentNoteIds.contains(noteId) {
                changes.deletedNotes.append(noteId)
            }
        }

        // Remove deleted notes from tracking
        for noteId in changes.deletedNotes {
            lastKnownNoteModTimes.removeValue(forKey: noteId)
        }

        return changes
    }

    /// Clear the change tracking cache
    func clearCache() {
        lastKnownNoteModTimes.removeAll()
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let notesDidChange = Notification.Name("NoteCove.notesDidChange")
}
