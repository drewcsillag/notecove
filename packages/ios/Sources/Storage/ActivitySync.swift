//
//  ActivitySync.swift
//  NoteCove
//
//  Activity Sync - Synchronizes note activity across multiple instances
//
//  Reads other instances' activity logs and triggers note reloads to discover
//  cross-platform changes.
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import Foundation

/// Callbacks for activity sync operations
public protocol ActivitySyncDelegate: AnyObject {
    /// Reload a note from disk
    func reloadNote(noteId: String, storageId: String) async throws

    /// Get list of currently loaded note IDs
    func getLoadedNotes() -> [String]
}

/// Synchronizes note activity across multiple instances by reading activity logs
@MainActor
public class ActivitySync {
    // MARK: - Properties

    private let fileIO: FileIOManager
    private let instanceId: String
    private let activityDir: String
    private let storageId: String
    private weak var delegate: ActivitySyncDelegate?

    /// Watermarks tracking last seen sequence per instance
    private var lastSeenSequences: [String: Int] = [:]

    /// Pending sync operations (noteId -> task)
    private var pendingSyncs: [String: Task<Void, Never>] = [:]

    // MARK: - Initialization

    /// Creates a new activity sync instance
    /// - Parameters:
    ///   - fileIO: File IO manager for reading logs
    ///   - instanceId: This instance's ID (to skip own logs)
    ///   - activityDir: Path to .activity directory
    ///   - storageId: Storage directory ID
    ///   - delegate: Callback delegate for reloading notes
    public init(
        fileIO: FileIOManager,
        instanceId: String,
        activityDir: String,
        storageId: String,
        delegate: ActivitySyncDelegate?
    ) {
        self.fileIO = fileIO
        self.instanceId = instanceId
        self.activityDir = activityDir
        self.storageId = storageId
        self.delegate = delegate
    }

    // MARK: - Public Methods

    /// Wait for all pending syncs to complete
    public func waitForPendingSyncs() async {
        if pendingSyncs.isEmpty {
            return
        }

        await withTaskGroup(of: Void.self) { group in
            for task in pendingSyncs.values {
                group.addTask {
                    await task.value
                }
            }
        }
    }

    /// Sync from other instances' activity logs
    /// - Returns: Set of note IDs that were affected
    public func syncFromOtherInstances() async -> Set<String> {
        var affectedNotes = Set<String>()

        do {
            let files = try fileIO.listFiles(in: activityDir, matching: "*.log")

            for file in files {
                let filename = URL(fileURLWithPath: file).lastPathComponent
                guard filename.hasSuffix(".log") else { continue }

                let otherInstanceId = filename.replacingOccurrences(of: ".log", with: "")

                // Skip our own activity log
                if otherInstanceId == instanceId {
                    continue
                }

                do {
                    let data = try fileIO.readFile(at: file)
                    guard let content = String(data: data, encoding: .utf8) else {
                        print("[ActivitySync] Failed to decode log file: \(filename)")
                        continue
                    }

                    let lines = content.components(separatedBy: "\n").filter { !$0.isEmpty }

                    if lines.isEmpty {
                        continue
                    }

                    let lastSeen = lastSeenSequences[otherInstanceId] ?? -1

                    // Gap detection: check if oldest entry is newer than last seen
                    if let firstLine = lines.first {
                        let parts = firstLine.split(separator: "|", maxSplits: 1)
                        if parts.count >= 2 {
                            let instanceSeq = String(parts[1])
                            let seqParts = instanceSeq.split(separator: "_")
                            if let seqStr = seqParts.last, let firstSequence = Int(seqStr) {
                                // Gap detected - some entries were compacted before we saw them
                                if firstSequence > lastSeen + 1 && lastSeen > 0 {
                                    print("[ActivitySync] Gap detected for \(otherInstanceId) (oldest: \(firstSequence), last seen: \(lastSeen)), performing full scan")
                                    let reloadedNotes = await fullScanAllNotes()
                                    affectedNotes.formUnion(reloadedNotes)
                                }
                            }
                        }
                    }

                    // Process new entries (those with sequence > lastSeen)
                    for line in lines {
                        let parts = line.split(separator: "|", maxSplits: 1)
                        guard parts.count >= 2 else { continue }

                        let noteId = String(parts[0])
                        let instanceSeq = String(parts[1])

                        let seqParts = instanceSeq.split(separator: "_")
                        guard let seqStr = seqParts.last, let sequence = Int(seqStr) else {
                            continue
                        }

                        if sequence > lastSeen {
                            affectedNotes.insert(noteId)

                            // Launch parallel poll for this update (fire and forget)
                            if pendingSyncs[noteId] == nil {
                                let syncTask = Task {
                                    await pollAndReload(instanceSeq: instanceSeq, noteId: noteId)
                                }
                                pendingSyncs[noteId] = syncTask

                                // Clean up when done
                                Task {
                                    await syncTask.value
                                    pendingSyncs.removeValue(forKey: noteId)
                                }
                            }
                        }
                    }

                    updateWatermark(instanceId: otherInstanceId, lines: lines)

                } catch {
                    print("[ActivitySync] Failed to read \(filename): \(error)")
                }
            }
        } catch {
            print("[ActivitySync] Failed to sync from other instances: \(error)")
        }

        return affectedNotes
    }

    /// Reset watermark tracking (useful for testing)
    public func resetWatermarks() {
        lastSeenSequences.removeAll()
    }

    /// Get current watermarks (useful for debugging)
    public func getWatermarks() -> [String: Int] {
        return lastSeenSequences
    }

    // MARK: - Private Methods

    /// Poll for an update file and reload the note when it appears
    /// Uses exponential backoff to avoid hammering the filesystem
    private func pollAndReload(instanceSeq: String, noteId: String) async {
        let parts = instanceSeq.split(separator: "_")
        guard parts.count >= 2,
              let seqStr = parts.last,
              let _ = Int(seqStr) else {
            return
        }

        // Exponential backoff delays (ms)
        let delays: [UInt64] = [100, 200, 500, 1000, 2000, 5000, 10000]

        for delay in delays {
            do {
                // Try to reload the note - this will check file existence AND flag byte
                try await delegate?.reloadNote(noteId: noteId, storageId: storageId)
                return // Success!
            } catch {
                let errorMessage = error.localizedDescription

                // Check if file doesn't exist yet
                if errorMessage.contains("does not exist") || errorMessage.contains("not found") {
                    // Wait and retry
                    try? await Task.sleep(nanoseconds: delay * 1_000_000)
                    continue
                }

                // Check if file is incomplete (still being written)
                if errorMessage.contains("incomplete") || errorMessage.contains("still being written") {
                    // Wait and retry - file sync is in progress
                    try? await Task.sleep(nanoseconds: delay * 1_000_000)
                    continue
                }

                // Other error (corrupted file, permissions, etc.) - give up
                print("[ActivitySync] Failed to reload note \(noteId): \(error)")
                return
            }
        }

        // Timeout - log warning but don't fail
        print("[ActivitySync] Timeout waiting for note \(noteId). File may sync later.")
    }

    /// Update our watermark for an instance
    private func updateWatermark(instanceId: String, lines: [String]) {
        guard let lastLine = lines.last else { return }

        let parts = lastLine.split(separator: "|", maxSplits: 1)
        guard parts.count >= 2 else { return }

        let instanceSeq = String(parts[1])
        let seqParts = instanceSeq.split(separator: "_")
        guard let seqStr = seqParts.last, let sequence = Int(seqStr) else {
            return
        }

        lastSeenSequences[instanceId] = sequence
    }

    /// Full scan fallback when gap is detected
    /// Reloads all currently loaded notes from disk
    private func fullScanAllNotes() async -> Set<String> {
        guard let delegate = delegate else { return [] }

        let loadedNotes = delegate.getLoadedNotes()
        var reloadedNotes = Set<String>()

        for noteId in loadedNotes {
            do {
                try await delegate.reloadNote(noteId: noteId, storageId: storageId)
                reloadedNotes.insert(noteId)
            } catch {
                print("[ActivitySync] Failed to reload note \(noteId): \(error)")
            }
        }

        return reloadedNotes
    }
}
