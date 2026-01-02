/**
 * Activity Logger
 *
 * Tracks note editing activity for cross-instance synchronization.
 * Each instance maintains its own log file to avoid multi-writer conflicts.
 *
 * Log format: noteId|profileId|sequenceNumber
 */

import Foundation

@MainActor
class ActivityLogger {
    static let shared = ActivityLogger()

    private var profileId: String = ""
    private var instanceId: String = ""
    private var activityDir: URL?

    /// Tracks the last sequence number used for each note
    /// Key: noteId, Value: last sequence number
    private var sequenceNumbers: [String: Int] = [:]

    private init() {}

    /// Configure the activity logger with profile and instance IDs
    /// - Parameters:
    ///   - profileId: The profile ID (SD ID)
    ///   - instanceId: The instance ID for this device
    func configure(profileId: String, instanceId: String) {
        self.profileId = profileId
        self.instanceId = instanceId

        // Get the activity directory from the active SD
        if let activeDir = StorageDirectoryManager.shared.activeDirectory,
           let sdURL = activeDir.url {
            self.activityDir = sdURL.appendingPathComponent(".notecove").appendingPathComponent("activity")

            // Ensure directory exists
            try? FileManager.default.createDirectory(at: activityDir!, withIntermediateDirectories: true)
        }

        print("[ActivityLogger] Configured with profileId=\(profileId), instanceId=\(instanceId)")
    }

    /// Get the next sequence number for a note
    /// - Parameter noteId: The note ID
    /// - Returns: The next sequence number to use
    func getNextSequenceNumber(for noteId: String) -> Int {
        let current = sequenceNumbers[noteId] ?? 0
        let next = current + 1
        sequenceNumbers[noteId] = next
        return next
    }

    /// Record note activity to the log file
    /// - Parameters:
    ///   - noteId: The note ID that was modified
    ///   - sequenceNumber: The sequence number of this update
    func recordNoteActivity(noteId: String, sequenceNumber: Int) {
        guard !profileId.isEmpty, !instanceId.isEmpty else {
            print("[ActivityLogger] Not configured, skipping activity recording")
            return
        }

        guard let activityDir = activityDir else {
            print("[ActivityLogger] Activity directory not set")
            return
        }

        // Filename format: {profileId}.{instanceId}.log
        let filename = "\(profileId).\(instanceId).log"
        let fileURL = activityDir.appendingPathComponent(filename)

        // Line format: noteId|profileId|sequenceNumber
        let line = "\(noteId)|\(profileId)|\(sequenceNumber)\n"

        do {
            if FileManager.default.fileExists(atPath: fileURL.path) {
                // Append to existing file
                let handle = try FileHandle(forWritingTo: fileURL)
                handle.seekToEndOfFile()
                if let data = line.data(using: .utf8) {
                    handle.write(data)
                }
                handle.closeFile()
            } else {
                // Create new file
                try line.write(to: fileURL, atomically: true, encoding: .utf8)
            }

            print("[ActivityLogger] Recorded activity: noteId=\(noteId), seq=\(sequenceNumber)")
        } catch {
            print("[ActivityLogger] Failed to record activity: \(error)")
        }
    }

    /// Get the path to this instance's activity log
    func getLogPath() -> URL? {
        guard let activityDir = activityDir else { return nil }
        let filename = "\(profileId).\(instanceId).log"
        return activityDir.appendingPathComponent(filename)
    }
}
