import Foundation

/// Manages CRDT update file naming and sequencing
/// Matches the desktop implementation for cross-platform sync compatibility
///
/// Filename format: instanceId_noteId_timestamp-sequence.yjson
/// Example: ab04da9a-7b4e-4a33-837d-886d70a7f1db_bc79c37b-8108-4bcd-a1da-8e684488b29c_1763219787329-129.yjson
class UpdateFileManager {
    private let instanceId: String
    private var sequenceCounters: [String: Int] = [:] // noteId -> next sequence number
    private let sequenceLock = NSLock()

    /// Initialize with instance ID
    /// - Parameter instanceId: The instance ID for this iOS client (default: from InstanceIDManager)
    init(instanceId: String = InstanceIDManager.shared.getInstanceId()) {
        self.instanceId = instanceId
    }

    /// Generate an update filename for a note
    /// - Parameters:
    ///   - noteId: The note UUID
    ///   - timestamp: Optional timestamp (defaults to current time)
    /// - Returns: Filename in format: instanceId_noteId_timestamp-sequence.yjson
    func generateUpdateFilename(noteId: String, timestamp: Int64? = nil) -> String {
        let ts = timestamp ?? Int64(Date().timeIntervalSince1970 * 1000)
        let sequence = getNextSequence(for: noteId)

        return "\(instanceId)_\(noteId)_\(ts)-\(sequence).yjson"
    }

    /// Get the next sequence number for a note
    /// - Parameter noteId: The note UUID
    /// - Returns: Next sequence number (monotonically increasing)
    private func getNextSequence(for noteId: String) -> Int {
        sequenceLock.lock()
        defer { sequenceLock.unlock() }

        let current = sequenceCounters[noteId] ?? 0
        let next = current + 1
        sequenceCounters[noteId] = next

        return next
    }

    /// Initialize sequence counter for a note by scanning existing files
    /// - Parameters:
    ///   - noteId: The note UUID
    ///   - updatesDirectory: Path to the note's updates directory
    ///   - fileIO: FileIOManager for reading directory
    func initializeSequence(for noteId: String, updatesDirectory: String, fileIO: FileIOManager) throws {
        sequenceLock.lock()
        defer { sequenceLock.unlock() }

        // Skip if already initialized
        if sequenceCounters[noteId] != nil {
            return
        }

        // Scan existing update files to find highest sequence number
        var maxSequence = 0

        if fileIO.fileExists(at: updatesDirectory) {
            let files = try fileIO.listFiles(in: updatesDirectory, matching: "*.yjson")

            for filename in files {
                if let metadata = parseUpdateFilename(filename) {
                    // Only count files from this instance for this note
                    if metadata.instanceId == instanceId && metadata.noteId == noteId {
                        maxSequence = max(maxSequence, metadata.sequence)
                    }
                }
            }
        }

        // Start from max + 1
        sequenceCounters[noteId] = maxSequence

        print("[UpdateFileManager] Initialized sequence for note \(noteId): starting at \(maxSequence + 1)")
    }

    /// Parse an update filename to extract metadata
    /// - Parameter filename: The filename to parse (e.g., "inst_note_timestamp-seq.yjson")
    /// - Returns: Parsed metadata or nil if invalid
    func parseUpdateFilename(_ filename: String) -> UpdateFileMetadata? {
        // Remove .yjson extension
        guard filename.hasSuffix(".yjson") else {
            return nil
        }

        let baseName = String(filename.dropLast(6))

        // Split by underscore
        let parts = baseName.split(separator: "_")
        guard parts.count >= 3 else {
            return nil
        }

        let instanceId = String(parts[0])
        let lastPart = String(parts[parts.count - 1])

        // Extract timestamp and sequence from last part (format: "timestamp-sequence")
        let timestampParts = lastPart.split(separator: "-")
        guard timestampParts.count == 2,
              let timestamp = Int64(timestampParts[0]),
              let sequence = Int(timestampParts[1]) else {
            return nil
        }

        // Note ID is everything between first and last part
        let noteId = parts[1..<parts.count-1].joined(separator: "_")

        return UpdateFileMetadata(
            instanceId: instanceId,
            noteId: noteId,
            timestamp: timestamp,
            sequence: sequence
        )
    }

    /// Reset all sequence counters (mainly for testing)
    func resetSequenceCounters() {
        sequenceLock.lock()
        defer { sequenceLock.unlock() }
        sequenceCounters.removeAll()
    }
}

/// Metadata extracted from an update filename
struct UpdateFileMetadata {
    let instanceId: String
    let noteId: String
    let timestamp: Int64
    let sequence: Int
}
