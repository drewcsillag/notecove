//
//  EditorViewModel.swift
//  NoteCove
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import Foundation
import WebKit

/// View model for the TipTap editor
@MainActor
class EditorViewModel: ObservableObject {
    @Published var noteTitle: String = "Untitled"
    @Published var isLoading: Bool = true
    @Published var editorReady: Bool = false

    var lastDocumentState: Data?

    private let noteId: String
    private let storageId: String
    private let bridge: CRDTBridge
    private let database: DatabaseManager
    private weak var webView: WKWebView?
    private let fileIO = FileIOManager()
    private let sdManager = StorageDirectoryManager()
    private let updateFileManager = UpdateFileManager()
    private let activityLogger: ActivityLogger?

    // Debounce timer for tag extraction
    private var tagExtractionTask: Task<Void, Never>?
    private let tagExtractionDelay: TimeInterval = 1.5 // Wait 1.5 seconds after last keystroke

    init(noteId: String, storageId: String, bridge: CRDTBridge, database: DatabaseManager, activityLogger: ActivityLogger? = nil) {
        print("[EditorViewModel] Initializing for note: \(noteId)")
        self.noteId = noteId
        self.storageId = storageId
        self.bridge = bridge
        self.database = database
        self.activityLogger = activityLogger
        print("[EditorViewModel] Initialized, isLoading=\(isLoading), editorReady=\(editorReady), activityLogger=\(activityLogger != nil ? "present" : "nil")")
    }

    deinit {
        print("[EditorViewModel] Deinitializing for note: \(noteId)")
        // Note: We can't call closeNote here because deinit is non-isolated
        // and closeNote is @MainActor. The JavaScript context will clean up
        // when the bridge is deallocated.
    }

    /// Get the storage directory path from database
    private func getStoragePath() throws -> String {
        guard let storage = try database.getStorageDirectory(id: storageId) else {
            throw NSError(domain: "EditorViewModel", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Storage directory not found: \(storageId)"])
        }
        return storage.path
    }

    /// Initialize note directory structure and sequence counter
    private func initializeNoteStructure() throws {
        let storagePath = try getStoragePath()

        // Ensure note directory structure exists
        try sdManager.ensureNoteDirectoryExists(storageId: storagePath, noteId: noteId)

        // Initialize sequence counter by scanning existing update files
        let updatesDir = sdManager.getNoteUpdatesDirectory(storageId: storagePath, noteId: noteId)
        try updateFileManager.initializeSequence(for: noteId, updatesDirectory: updatesDir, fileIO: fileIO)
    }

    /// Set the web view reference
    func setWebView(_ webView: WKWebView) {
        self.webView = webView
    }

    /// Load the note into the editor
    func loadNote() async {
        isLoading = true

        do {
            // Initialize note directory structure and sequence counter
            try initializeNoteStructure()

            // First, create/open the note in the CRDT bridge
            try bridge.createNote(noteId: noteId)
            print("[EditorViewModel] Created/opened note in CRDT bridge: \(noteId)")

            // Load all existing update files from the updates/ directory
            let storagePath = try getStoragePath()
            let updatesDir = sdManager.getNoteUpdatesDirectory(storageId: storagePath, noteId: noteId)

            if fileIO.fileExists(at: updatesDir) {
                let updateFiles = try fileIO.listFiles(in: updatesDir, matching: "*.yjson").sorted()

                print("[EditorViewModel] Found \(updateFiles.count) update files for note: \(noteId)")

                // Apply each update file in order
                for filePath in updateFiles {
                    // listFiles returns full paths, use them directly
                    var updateData = try fileIO.readFile(at: filePath)

                    // Strip flag byte if present (for cross-platform compatibility)
                    // Update files use a flag byte protocol:
                    // - First byte 0x00 = file still being written
                    // - First byte 0x01 = file complete and ready
                    // - Remaining bytes = actual CRDT data
                    if updateData.count > 0 {
                        let flagByte = updateData[0]
                        if flagByte == 0x00 {
                            print("[EditorViewModel] Warning: Update file incomplete: \(filePath)")
                            continue // Skip incomplete files
                        } else if flagByte == 0x01 {
                            // Strip flag byte, keep CRDT data
                            updateData = updateData.subdata(in: 1..<updateData.count)
                        }
                        // If flagByte is something else, assume it's raw Yjs data (old format)
                        // and apply it as-is for backward compatibility
                    }

                    try bridge.applyUpdate(noteId: noteId, updateData: updateData)
                }
            } else {
                print("[EditorViewModel] No updates directory, starting with empty note")
            }

            // Get the current CRDT state (merged from all updates)
            let state = try bridge.getDocumentState(noteId: noteId)

            // Convert to base64 for JavaScript
            let base64 = state.base64EncodedString()

            // Load note in editor
            await callJavaScript(function: "loadNote", args: [noteId, base64])

            // Extract title for display
            let title = try bridge.extractTitle(stateData: state)
            self.noteTitle = title.isEmpty ? "Untitled" : title

        } catch {
            print("[EditorViewModel] Error loading note: \(error)")
            // Try to create note and load empty
            do {
                try initializeNoteStructure()
                try bridge.createNote(noteId: noteId)
                await callJavaScript(function: "loadNote", args: [noteId, ""])
            } catch {
                print("[EditorViewModel] Failed to create note: \(error)")
            }
        }
    }

    /// Handle content changes from the editor
    /// Note: Only updates UI. Database title is updated in handleUpdate() after extracting from CRDT.
    func handleContentChanged(noteId: String, title: String, isEmpty: Bool) async {
        // Update title in UI
        self.noteTitle = title.isEmpty ? "Untitled" : title

        // Don't update database here - title will be extracted from CRDT and updated in handleUpdate()
        // This ensures the database title matches what desktop extracts from CRDT, avoiding sync conflicts
    }

    /// Handle CRDT updates from the editor
    func handleUpdate(_ updateData: Data) async {
        do {
            // Apply update to CRDT bridge
            try bridge.applyUpdate(noteId: noteId, updateData: updateData)

            // Write update to disk as a new update file
            let storagePath = try getStoragePath()
            let updatesDir = sdManager.getNoteUpdatesDirectory(storageId: storagePath, noteId: noteId)

            // Generate filename with instance ID, note ID, timestamp, and sequence number
            let filename = updateFileManager.generateUpdateFilename(noteId: noteId)
            let filePath = "\(updatesDir)/\(filename)"

            // Prepend flag byte protocol for cross-platform compatibility
            // Flag byte 0x01 indicates the file is complete and ready to read
            // (0x00 would indicate file is still being written)
            var flaggedUpdate = Data(count: 1 + updateData.count)
            flaggedUpdate[0] = 0x01 // Ready flag
            flaggedUpdate.replaceSubrange(1..<flaggedUpdate.count, with: updateData)

            // Write the update file with flag byte
            try fileIO.atomicWrite(data: flaggedUpdate, to: filePath)
            print("[EditorViewModel] Saved update to: \(filename)")

            // Record activity for cross-platform sync
            if let activityLogger = activityLogger {
                // Extract sequence number from filename
                if let metadata = updateFileManager.parseUpdateFilename(filename) {
                    try activityLogger.recordNoteActivity(noteId: noteId, sequenceNumber: metadata.sequence)
                    print("[EditorViewModel] Recorded activity: \(noteId) sequence \(metadata.sequence)")
                } else {
                    print("[EditorViewModel] Warning: Could not parse filename for activity logging: \(filename)")
                }
            }

            // Get updated state for title extraction
            let state = try bridge.getDocumentState(noteId: noteId)

            // Extract and update title (immediate, users expect live updates)
            let title = try bridge.extractTitle(stateData: state)

            // Update database with extracted title from CRDT
            // This ensures the database title matches what desktop extracts from CRDT
            let displayTitle = title.isEmpty ? "Untitled" : title
            try database.updateNote(id: noteId, title: displayTitle)

            await handleContentChanged(noteId: noteId, title: title, isEmpty: title.isEmpty)

            // Debounce tag extraction to avoid indexing partial tags while typing
            tagExtractionTask?.cancel()
            tagExtractionTask = Task { [weak self] in
                guard let self = self else { return }

                // Wait for the debounce delay
                try? await Task.sleep(nanoseconds: UInt64(self.tagExtractionDelay * 1_000_000_000))

                // Check if task was cancelled
                guard !Task.isCancelled else { return }

                // Extract and index tags
                do {
                    let content = try self.bridge.extractContent(stateData: state)
                    let tags = TagExtractor.extractTags(from: content)
                    try self.database.reindexTags(for: self.noteId, in: self.storageId, tags: tags)
                    print("[EditorViewModel] Re-indexed \(tags.count) tags for note: \(self.noteId)")
                } catch {
                    print("[EditorViewModel] Error extracting tags: \(error)")
                }
            }

        } catch {
            print("[EditorViewModel] Error handling update: \(error)")
        }
    }

    /// Execute an editor command
    func executeCommand(_ command: String, params: [String: Any] = [:]) async {
        await callJavaScript(function: "executeCommand", args: [command, params])
    }

    /// Call JavaScript function
    private func callJavaScript(function: String, args: [Any]) async {
        guard let webView = webView else {
            print("[EditorViewModel] WebView not set")
            return
        }

        // Build JavaScript call
        var jsArgs: [String] = []
        for arg in args {
            if let str = arg as? String {
                jsArgs.append("'\(str.replacingOccurrences(of: "'", with: "\\'"))'")
            } else if let dict = arg as? [String: Any] {
                if let jsonData = try? JSONSerialization.data(withJSONObject: dict),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    jsArgs.append(jsonString)
                }
            } else {
                jsArgs.append("\(arg)")
            }
        }

        let script = "\(function)(\(jsArgs.joined(separator: ", ")))"

        do {
            _ = try await webView.evaluateJavaScript(script)
        } catch {
            print("[EditorViewModel] JavaScript error: \(error)")
        }
    }
}
