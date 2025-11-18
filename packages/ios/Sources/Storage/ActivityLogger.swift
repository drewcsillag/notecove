//
//  ActivityLogger.swift
//  NoteCove
//
//  Activity Logger - Tracks note editing activity for cross-instance synchronization
//
//  Each instance maintains its own log file to avoid multi-writer conflicts.
//  Format: noteId|instanceId_sequenceNumber
//
//  This allows other instances to poll for specific update files and know
//  which notes have been modified.
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import Foundation

/// Tracks note editing activity for cross-instance synchronization
///
/// Each instance writes to its own log file in the `.activity` directory:
/// - `.activity/<instance-id>.log`
///
/// Log format: `noteId|instanceId_sequenceNumber`
///
/// Example:
/// ```
/// F931030E-DF9C-4C4C-901F-8C3EE15B3DEC|E59CAD34-C9E8-492D-88CA-DAF248B4485A_24
/// ac5912fb-1033-436f-8944-b4201639c6d1|0d054130-2868-4810-8c92-10296dd36847_38
/// ```
///
/// This allows Desktop and other iOS instances to:
/// 1. Scan activity logs to find modified notes
/// 2. Load only the specific update files that changed
/// 3. Avoid scanning entire directory structures
@MainActor
public class ActivityLogger {
    private let fileIO: FileIOManager
    private let activityDir: String
    private var instanceId: String
    private var activityLogPath: String
    private var lastNoteWritten: String?

    /// Creates a new activity logger
    /// - Parameters:
    ///   - fileIO: File IO manager for reading/writing log files
    ///   - activityDir: Directory path for activity logs (.activity)
    ///   - instanceId: Unique identifier for this instance (usually uppercase UUID)
    public init(fileIO: FileIOManager, activityDir: String, instanceId: String) {
        self.fileIO = fileIO
        self.activityDir = activityDir
        self.instanceId = instanceId
        self.activityLogPath = "\(activityDir)/\(instanceId).log"
    }

    /// Initialize activity logger (ensure directory exists)
    public func initialize() throws {
        try fileIO.createDirectory(at: activityDir)
        print("[ActivityLogger] Initialized with instance ID: \(instanceId)")
        print("[ActivityLogger] Log path: \(activityLogPath)")
    }

    /// Record note activity
    ///
    /// If the same note is edited consecutively, replaces the last line.
    /// Otherwise, appends a new line.
    ///
    /// - Parameters:
    ///   - noteId: The note that was modified
    ///   - sequenceNumber: The CRDT sequence number for this update
    public func recordNoteActivity(noteId: String, sequenceNumber: Int) throws {
        let line = "\(noteId)|\(instanceId)_\(sequenceNumber)"

        if lastNoteWritten == noteId {
            // Same note edited consecutively - replace last line
            try replaceLastLine(line)
        } else {
            // Different note - append new line
            try appendLine(line)
            lastNoteWritten = noteId
        }
    }

    /// Append a line to the activity log
    private func appendLine(_ line: String) throws {
        let newLine = line + "\n"

        if fileIO.fileExists(at: activityLogPath) {
            // Read existing content
            let existingData = try fileIO.readFile(at: activityLogPath)
            let existingText = String(data: existingData, encoding: .utf8) ?? ""
            let newText = existingText + newLine

            // Write updated content
            guard let newData = newText.data(using: .utf8) else {
                throw ActivityLoggerError.encodingFailed
            }
            try fileIO.writeFile(data: newData, to: activityLogPath)
        } else {
            // File doesn't exist, create it
            guard let newData = newLine.data(using: .utf8) else {
                throw ActivityLoggerError.encodingFailed
            }
            try fileIO.writeFile(data: newData, to: activityLogPath)
        }
    }

    /// Replace the last line in the activity log
    ///
    /// This is used when the same note is edited consecutively to avoid
    /// creating thousands of entries during continuous typing.
    private func replaceLastLine(_ newLine: String) throws {
        guard fileIO.fileExists(at: activityLogPath) else {
            // File doesn't exist, just append
            try appendLine(newLine)
            return
        }

        let data = try fileIO.readFile(at: activityLogPath)
        guard let content = String(data: data, encoding: .utf8) else {
            throw ActivityLoggerError.decodingFailed
        }

        var lines = content.split(separator: "\n", omittingEmptySubsequences: true).map(String.init)

        if lines.isEmpty {
            // File is empty, just append
            try appendLine(newLine)
            return
        }

        // Replace last line
        lines[lines.count - 1] = newLine
        let newContent = lines.joined(separator: "\n") + "\n"

        guard let newData = newContent.data(using: .utf8) else {
            throw ActivityLoggerError.encodingFailed
        }

        try fileIO.writeFile(data: newData, to: activityLogPath)
    }

    /// Read all activity from all instances in this storage directory
    ///
    /// Returns a dictionary mapping note IDs to their latest update references
    /// Format: `["noteId": "instanceId_sequenceNumber", ...]`
    ///
    /// - Returns: Dictionary of note IDs to update references
    public func readAllActivity() throws -> [String: String] {
        var activity: [String: String] = [:]

        // List all .log files in activity directory
        let logFiles = try fileIO.listFiles(in: activityDir, matching: "*.log")

        for logFile in logFiles {
            let data = try fileIO.readFile(at: logFile)
            guard let content = String(data: data, encoding: .utf8) else {
                print("[ActivityLogger] Warning: Could not decode \(logFile)")
                continue
            }

            // Parse each line: noteId|instanceId_sequenceNumber
            let lines = content.split(separator: "\n", omittingEmptySubsequences: true)
            for line in lines {
                let parts = line.split(separator: "|", maxSplits: 1)
                guard parts.count == 2 else {
                    print("[ActivityLogger] Warning: Invalid line format: \(line)")
                    continue
                }

                let noteId = String(parts[0])
                let updateRef = String(parts[1])

                // Keep the latest entry for each note
                // (Later entries in the file override earlier ones)
                activity[noteId] = updateRef
            }
        }

        print("[ActivityLogger] Read activity for \(activity.count) notes from \(logFiles.count) log files")
        return activity
    }
}

/// Errors that can occur during activity logging
public enum ActivityLoggerError: Error, LocalizedError {
    case encodingFailed
    case decodingFailed

    public var errorDescription: String? {
        switch self {
        case .encodingFailed:
            return "Failed to encode activity log content"
        case .decodingFailed:
            return "Failed to decode activity log content"
        }
    }
}
