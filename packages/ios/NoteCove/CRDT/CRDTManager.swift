import Foundation
import JavaScriptCore

/// Errors that can occur during CRDT operations
enum CRDTError: Error, LocalizedError {
    case bridgeNotInitialized
    case javaScriptError(String)
    case fileNotFound(String)
    case invalidBase64
    case noteNotOpen(String)
    case folderTreeNotOpen(String)
    case corruptCRDTFile(String)
    case parseError(String)

    var errorDescription: String? {
        switch self {
        case .bridgeNotInitialized:
            return "CRDT bridge is not initialized"
        case .javaScriptError(let message):
            return "JavaScript error: \(message)"
        case .fileNotFound(let path):
            return "File not found: \(path)"
        case .invalidBase64:
            return "Invalid base64 data"
        case .noteNotOpen(let noteId):
            return "Note \(noteId) is not open"
        case .folderTreeNotOpen(let sdId):
            return "Folder tree for SD \(sdId) is not open"
        case .corruptCRDTFile(let path):
            return "The note file is corrupt and cannot be read: \(path)"
        case .parseError(let message):
            return "Failed to parse note data: \(message)"
        }
    }

    /// User-friendly description without technical details
    var userFriendlyDescription: String {
        switch self {
        case .bridgeNotInitialized:
            return "NoteCove is still starting up. Please wait a moment."
        case .javaScriptError:
            return "There was a problem reading the note. Try again later."
        case .fileNotFound:
            return "This note could not be found."
        case .invalidBase64, .corruptCRDTFile, .parseError:
            return "This note appears to be damaged and cannot be opened."
        case .noteNotOpen:
            return "This note is not currently available."
        case .folderTreeNotOpen:
            return "The folder list is not available."
        }
    }
}

/// Metadata extracted from a note
struct NoteMetadata {
    let title: String
    let preview: String
}

/// Folder data from CRDT
struct FolderInfo: Identifiable {
    let id: String
    let name: String
    let parentId: String?
    let sdId: String
    let order: Int
    let deleted: Bool
}

/// Note metadata from CRDT
struct NoteInfo: Identifiable {
    let id: String
    let title: String
    let preview: String
    let folderId: String?
    let createdAt: Date
    let modifiedAt: Date
    let deleted: Bool
    let pinned: Bool
}

/// Manager for CRDT operations using JavaScriptCore
@MainActor
final class CRDTManager: ObservableObject {
    static let shared = CRDTManager()

    private var jsContext: JSContext?
    private var bridge: JSValue?

    /// Whether the bridge has been successfully initialized
    @Published private(set) var isInitialized = false

    /// The storage directory manager for file operations
    private var storageManager: StorageDirectoryManager { StorageDirectoryManager.shared }

    private init() {}

    // MARK: - Initialization

    /// Initialize the JavaScriptCore environment and load the bridge
    func initialize() throws {
        guard !isInitialized else { return }

        // Create JavaScript context
        guard let context = JSContext() else {
            throw CRDTError.bridgeNotInitialized
        }
        jsContext = context

        // Set up exception handler
        context.exceptionHandler = { _, exception in
            if let exc = exception {
                print("[CRDTManager] JS Exception: \(exc)")
            }
        }

        // Register Swift callbacks for file I/O
        registerFileIOCallbacks(in: context)

        // Load the bundled JavaScript
        try loadBridgeScript(in: context)

        // Get reference to NoteCoveBridge
        bridge = context.objectForKeyedSubscript("NoteCoveBridge")
        guard bridge != nil, !bridge!.isUndefined else {
            throw CRDTError.bridgeNotInitialized
        }

        isInitialized = true
        print("[CRDTManager] Initialized successfully")
    }

    private func loadBridgeScript(in context: JSContext) throws {
        // Search all bundles for the resource
        // This handles both app bundle and test bundle scenarios
        var scriptContent: String?
        for bundle in Bundle.allBundles {
            if let url = bundle.url(forResource: "ios-bridge-bundle", withExtension: "js"),
               let content = try? String(contentsOf: url, encoding: .utf8) {
                scriptContent = content
                break
            }
        }

        guard let script = scriptContent else {
            throw CRDTError.fileNotFound("ios-bridge-bundle.js")
        }

        context.evaluateScript(script)

        if let exception = context.exception {
            throw CRDTError.javaScriptError(exception.toString())
        }
    }

    // MARK: - File I/O Callbacks

    private func registerFileIOCallbacks(in context: JSContext) {
        // _swiftReadFile: Read file and return base64 content
        let readFile: @convention(block) (String) -> String? = { [weak self] path in
            guard let self = self else { return nil }
            guard let url = self.resolveSecurityScopedPath(path) else { return nil }

            do {
                let data = try Data(contentsOf: url)
                return data.base64EncodedString()
            } catch {
                print("[CRDTManager] Failed to read file: \(error)")
                return nil
            }
        }
        context.setObject(readFile, forKeyedSubscript: "_swiftReadFile" as NSString)

        // _swiftWriteFile: Write base64 content to file
        let writeFile: @convention(block) (String, String) -> Bool = { [weak self] path, base64Data in
            guard let self = self else { return false }
            guard let url = self.resolveSecurityScopedPath(path),
                  let data = Data(base64Encoded: base64Data) else { return false }

            do {
                try data.write(to: url, options: .atomic)
                return true
            } catch {
                print("[CRDTManager] Failed to write file: \(error)")
                return false
            }
        }
        context.setObject(writeFile, forKeyedSubscript: "_swiftWriteFile" as NSString)

        // _swiftDeleteFile: Delete a file
        let deleteFile: @convention(block) (String) -> Bool = { [weak self] path in
            guard let self = self else { return false }
            guard let url = self.resolveSecurityScopedPath(path) else { return false }

            do {
                try FileManager.default.removeItem(at: url)
                return true
            } catch {
                print("[CRDTManager] Failed to delete file: \(error)")
                return false
            }
        }
        context.setObject(deleteFile, forKeyedSubscript: "_swiftDeleteFile" as NSString)

        // _swiftListFiles: List files in directory
        let listFiles: @convention(block) (String, String?) -> [String] = { [weak self] directory, pattern in
            guard let self = self else { return [] }
            guard let url = self.resolveSecurityScopedPath(directory) else { return [] }

            do {
                var files = try FileManager.default.contentsOfDirectory(
                    at: url,
                    includingPropertiesForKeys: nil
                )

                // Filter by pattern if provided (simple glob matching)
                if let pattern = pattern {
                    let regex = self.globToRegex(pattern)
                    files = files.filter { file in
                        let filename = file.lastPathComponent
                        return filename.range(of: regex, options: .regularExpression) != nil
                    }
                }

                return files.map { $0.path }
            } catch {
                print("[CRDTManager] Failed to list files: \(error)")
                return []
            }
        }
        context.setObject(listFiles, forKeyedSubscript: "_swiftListFiles" as NSString)

        // _swiftFileExists: Check if file exists
        let fileExists: @convention(block) (String) -> Bool = { [weak self] path in
            guard let self = self else { return false }
            guard let url = self.resolveSecurityScopedPath(path) else { return false }
            return FileManager.default.fileExists(atPath: url.path)
        }
        context.setObject(fileExists, forKeyedSubscript: "_swiftFileExists" as NSString)

        // _swiftCreateDirectory: Create directory
        let createDirectory: @convention(block) (String) -> Bool = { [weak self] path in
            guard let self = self else { return false }
            guard let url = self.resolveSecurityScopedPath(path) else { return false }

            do {
                try FileManager.default.createDirectory(
                    at: url,
                    withIntermediateDirectories: true
                )
                return true
            } catch {
                print("[CRDTManager] Failed to create directory: \(error)")
                return false
            }
        }
        context.setObject(createDirectory, forKeyedSubscript: "_swiftCreateDirectory" as NSString)
    }

    /// Convert a simple glob pattern to regex
    private func globToRegex(_ pattern: String) -> String {
        var regex = "^"
        for char in pattern {
            switch char {
            case "*":
                regex += ".*"
            case "?":
                regex += "."
            case ".":
                regex += "\\."
            default:
                regex += String(char)
            }
        }
        regex += "$"
        return regex
    }

    /// Resolve a path to a URL with security scoped access
    private func resolveSecurityScopedPath(_ path: String) -> URL? {
        // If it's an absolute path within the storage directory, use that
        if let activeDir = storageManager.activeDirectory,
           let sdURL = activeDir.url {
            let sdPath = sdURL.path
            if path.hasPrefix(sdPath) {
                return URL(fileURLWithPath: path)
            }
            // If it's a relative path, resolve against the storage directory
            if !path.hasPrefix("/") {
                return sdURL.appendingPathComponent(path)
            }
        }
        // Otherwise just use the path as-is
        return URL(fileURLWithPath: path)
    }

    // MARK: - Note Operations

    /// Load a note's CRDT state from storage directory
    /// - Parameter noteId: The note ID
    /// - Returns: Base64-encoded CRDT state
    func loadNoteState(noteId: String) throws -> String {
        guard isInitialized, let bridge = bridge else {
            throw CRDTError.bridgeNotInitialized
        }

        guard let activeDir = storageManager.activeDirectory,
              let sdURL = activeDir.url else {
            throw CRDTError.fileNotFound("No active storage directory")
        }

        // Read all update files for this note
        let notesDir = sdURL.appendingPathComponent("notes").appendingPathComponent(noteId)

        guard FileManager.default.fileExists(atPath: notesDir.path) else {
            throw CRDTError.fileNotFound(notesDir.path)
        }

        // Create the note in JS
        bridge.invokeMethod("createNote", withArguments: [noteId])

        // Look for log files in the logs subdirectory
        let logsDir = notesDir.appendingPathComponent("logs")
        if FileManager.default.fileExists(atPath: logsDir.path) {
            let files = try FileManager.default.contentsOfDirectory(
                at: logsDir,
                includingPropertiesForKeys: [.contentModificationDateKey]
            )

            // Sort by filename to apply in order (timestamp in filename)
            let sortedFiles = files.sorted { $0.lastPathComponent < $1.lastPathComponent }

            for file in sortedFiles {
                let filename = file.lastPathComponent
                // Only process .crdtlog files
                guard filename.hasSuffix(".crdtlog") else {
                    continue
                }

                let data = try Data(contentsOf: file)
                let base64 = data.base64EncodedString()

                bridge.invokeMethod("applyLogFile", withArguments: [noteId, base64])

                if let exception = jsContext?.exception {
                    print("[CRDTManager] Error applying log file \(filename): \(exception)")
                    jsContext?.exception = nil
                }
            }
        }

        // Get the combined state
        guard let state = bridge.invokeMethod("getDocumentState", withArguments: [noteId]),
              let stateString = state.toString() else {
            throw CRDTError.noteNotOpen(noteId)
        }

        return stateString
    }

    /// Extract metadata (title, preview) from a note's CRDT state
    /// - Parameter stateBase64: Base64-encoded CRDT state
    /// - Returns: Extracted metadata
    func extractMetadata(from stateBase64: String) throws -> NoteMetadata {
        guard isInitialized, let bridge = bridge else {
            throw CRDTError.bridgeNotInitialized
        }

        guard let titleValue = bridge.invokeMethod("extractTitle", withArguments: [stateBase64]),
              let title = titleValue.toString() else {
            throw CRDTError.javaScriptError("Failed to extract title")
        }

        guard let contentValue = bridge.invokeMethod("extractContent", withArguments: [stateBase64]),
              let content = contentValue.toString() else {
            throw CRDTError.javaScriptError("Failed to extract content")
        }

        // Generate preview from content (first ~100 chars, excluding title)
        let preview = String(content.prefix(200)).trimmingCharacters(in: .whitespacesAndNewlines)

        return NoteMetadata(title: title, preview: preview)
    }

    /// Close a note and free its memory
    func closeNote(noteId: String) {
        guard isInitialized, let bridge = bridge else { return }
        bridge.invokeMethod("closeNote", withArguments: [noteId])
    }

    /// Load a note and get its content as HTML for rendering
    /// - Parameter noteId: The note ID
    /// - Returns: HTML string of the note content
    func loadNoteContentAsHTML(noteId: String) throws -> String {
        guard isInitialized, let bridge = bridge else {
            throw CRDTError.bridgeNotInitialized
        }

        guard let activeDir = storageManager.activeDirectory,
              let sdURL = activeDir.url else {
            throw CRDTError.fileNotFound("No active storage directory")
        }

        let notesDir = sdURL.appendingPathComponent("notes").appendingPathComponent(noteId)

        guard FileManager.default.fileExists(atPath: notesDir.path) else {
            throw CRDTError.fileNotFound(notesDir.path)
        }

        // Create the note in JS
        bridge.invokeMethod("createNote", withArguments: [noteId])

        // Look for log files in the logs subdirectory
        let logsDir = notesDir.appendingPathComponent("logs")
        if FileManager.default.fileExists(atPath: logsDir.path) {
            let files = try FileManager.default.contentsOfDirectory(
                at: logsDir,
                includingPropertiesForKeys: nil
            )

            let sortedFiles = files.sorted { $0.lastPathComponent < $1.lastPathComponent }

            for file in sortedFiles {
                let filename = file.lastPathComponent
                guard filename.hasSuffix(".crdtlog") else {
                    continue
                }

                let data = try Data(contentsOf: file)
                let base64 = data.base64EncodedString()

                bridge.invokeMethod("applyLogFile", withArguments: [noteId, base64])

                if let exception = jsContext?.exception {
                    print("[CRDTManager] Error applying log file \(filename): \(exception)")
                    jsContext?.exception = nil
                }
            }
        }

        // Extract content as HTML
        guard let result = bridge.invokeMethod("extractContentAsHTML", withArguments: [noteId]),
              let html = result.toString() else {
            bridge.invokeMethod("closeNote", withArguments: [noteId])
            throw CRDTError.javaScriptError("Failed to extract HTML content")
        }

        if let exception = jsContext?.exception {
            let message = exception.toString() ?? "Unknown error"
            jsContext?.exception = nil
            bridge.invokeMethod("closeNote", withArguments: [noteId])
            throw CRDTError.javaScriptError(message)
        }

        // Close the note to free memory
        bridge.invokeMethod("closeNote", withArguments: [noteId])

        return html
    }

    /// Load a note and get its Yjs state as base64 for the TipTap editor
    /// Note: This keeps the note open for editing. Call closeNote() when done.
    /// - Parameter noteId: The note ID
    /// - Returns: Base64-encoded Yjs state
    func loadNoteStateForEditor(noteId: String) throws -> String {
        guard isInitialized, let bridge = bridge else {
            throw CRDTError.bridgeNotInitialized
        }

        guard let activeDir = storageManager.activeDirectory,
              let sdURL = activeDir.url else {
            throw CRDTError.fileNotFound("No active storage directory")
        }

        let notesDir = sdURL.appendingPathComponent("notes").appendingPathComponent(noteId)

        guard FileManager.default.fileExists(atPath: notesDir.path) else {
            throw CRDTError.fileNotFound(notesDir.path)
        }

        // Create the note in JS
        bridge.invokeMethod("createNote", withArguments: [noteId])

        // Look for log files in the logs subdirectory
        let logsDir = notesDir.appendingPathComponent("logs")
        if FileManager.default.fileExists(atPath: logsDir.path) {
            let files = try FileManager.default.contentsOfDirectory(
                at: logsDir,
                includingPropertiesForKeys: nil
            )

            let sortedFiles = files.sorted { $0.lastPathComponent < $1.lastPathComponent }

            for file in sortedFiles {
                let filename = file.lastPathComponent
                guard filename.hasSuffix(".crdtlog") else {
                    continue
                }

                let data = try Data(contentsOf: file)
                let base64 = data.base64EncodedString()

                bridge.invokeMethod("applyLogFile", withArguments: [noteId, base64])

                if let exception = jsContext?.exception {
                    print("[CRDTManager] Error applying log file \(filename): \(exception)")
                    jsContext?.exception = nil
                }
            }
        }

        // Get the document state as base64
        guard let result = bridge.invokeMethod("getDocumentState", withArguments: [noteId]),
              let stateBase64 = result.toString() else {
            bridge.invokeMethod("closeNote", withArguments: [noteId])
            throw CRDTError.javaScriptError("Failed to get document state")
        }

        if let exception = jsContext?.exception {
            let message = exception.toString() ?? "Unknown error"
            jsContext?.exception = nil
            bridge.invokeMethod("closeNote", withArguments: [noteId])
            throw CRDTError.javaScriptError(message)
        }

        // Note: We don't close the note here - it stays open for editing
        return stateBase64
    }

    /// Save a CRDT update to disk as a new log file
    /// - Parameters:
    ///   - noteId: The note ID
    ///   - updateBase64: The Yjs update as base64 string
    /// - Throws: CRDTError if save fails
    func saveNoteUpdate(noteId: String, updateBase64: String) throws {
        guard isInitialized, let bridge = bridge else {
            throw CRDTError.bridgeNotInitialized
        }

        guard let activeDir = storageManager.activeDirectory,
              let sdURL = activeDir.url else {
            throw CRDTError.fileNotFound("No active storage directory")
        }

        let logsDir = sdURL.appendingPathComponent("notes")
            .appendingPathComponent(noteId)
            .appendingPathComponent("logs")

        // Create logs directory if needed
        try FileManager.default.createDirectory(at: logsDir, withIntermediateDirectories: true)

        // Get profile ID (SD ID), instance ID, and timestamp
        let profileId = activeDir.id
        let instanceId = InstanceID.shared.id
        let timestamp = Int(Date().timeIntervalSince1970 * 1000)

        // Generate log filename: {profileId}_{instanceId}_{timestamp}.crdtlog
        guard let filenameResult = bridge.invokeMethod("generateLogFilename", withArguments: [profileId, instanceId, timestamp]),
              let filename = filenameResult.toString() else {
            throw CRDTError.javaScriptError("Failed to generate log filename")
        }

        // Create log file from update
        guard let logDataResult = bridge.invokeMethod("createLogFileFromUpdate", withArguments: [updateBase64, timestamp, 1]),
              let logDataBase64 = logDataResult.toString() else {
            throw CRDTError.javaScriptError("Failed to create log file")
        }

        if let exception = jsContext?.exception {
            let message = exception.toString() ?? "Unknown error"
            jsContext?.exception = nil
            throw CRDTError.javaScriptError(message)
        }

        // Decode and write the log file
        guard let logData = Data(base64Encoded: logDataBase64) else {
            throw CRDTError.invalidBase64
        }

        let fileURL = logsDir.appendingPathComponent(filename)
        try logData.write(to: fileURL)

        // Record activity for sync
        let sequenceNumber = ActivityLogger.shared.getNextSequenceNumber(for: noteId)
        ActivityLogger.shared.recordNoteActivity(noteId: noteId, sequenceNumber: sequenceNumber)

        print("[CRDTManager] Saved note update to \(filename)")
    }

    /// Create a new empty note
    /// - Parameter folderId: Optional folder ID to place the note in
    /// - Returns: The new note ID
    func createNewNote(folderId: String? = nil) throws -> String {
        guard isInitialized, let bridge = bridge else {
            throw CRDTError.bridgeNotInitialized
        }

        guard let activeDir = storageManager.activeDirectory,
              let sdURL = activeDir.url else {
            throw CRDTError.fileNotFound("No active storage directory")
        }

        // Generate a new note ID
        guard let idResult = bridge.invokeMethod("generateNoteId", withArguments: []),
              let noteId = idResult.toString(), !noteId.isEmpty else {
            throw CRDTError.javaScriptError("Failed to generate note ID")
        }

        // Create the note folder structure
        let notesDir = sdURL.appendingPathComponent("notes").appendingPathComponent(noteId)
        let logsDir = notesDir.appendingPathComponent("logs")
        try FileManager.default.createDirectory(at: logsDir, withIntermediateDirectories: true)

        // Create an empty note document in JS
        bridge.invokeMethod("createNote", withArguments: [noteId])

        // Get the initial state
        guard let stateResult = bridge.invokeMethod("getDocumentState", withArguments: [noteId]),
              let stateBase64 = stateResult.toString() else {
            throw CRDTError.javaScriptError("Failed to get initial note state")
        }

        // Save the initial state as a log file
        let profileId = activeDir.id
        let instanceId = InstanceID.shared.id
        let timestamp = Int(Date().timeIntervalSince1970 * 1000)

        // Generate log filename: {profileId}_{instanceId}_{timestamp}.crdtlog
        guard let filenameResult = bridge.invokeMethod("generateLogFilename", withArguments: [profileId, instanceId, timestamp]),
              let filename = filenameResult.toString() else {
            throw CRDTError.javaScriptError("Failed to generate log filename")
        }

        guard let logDataResult = bridge.invokeMethod("createLogFileFromUpdate", withArguments: [stateBase64, timestamp, 1]),
              let logDataBase64 = logDataResult.toString() else {
            throw CRDTError.javaScriptError("Failed to create log file")
        }

        guard let logData = Data(base64Encoded: logDataBase64) else {
            throw CRDTError.invalidBase64
        }

        let fileURL = logsDir.appendingPathComponent(filename)
        try logData.write(to: fileURL)

        // Record activity for sync (sequence 1 for new note)
        ActivityLogger.shared.recordNoteActivity(noteId: noteId, sequenceNumber: 1)

        // Close the note after creating
        bridge.invokeMethod("closeNote", withArguments: [noteId])

        print("[CRDTManager] Created new note: \(noteId)")
        return noteId
    }

    /// List all note IDs in the storage directory
    /// - Returns: Array of note ID strings
    func listNoteIds() throws -> [String] {
        guard let activeDir = storageManager.activeDirectory,
              let sdURL = activeDir.url else {
            throw CRDTError.fileNotFound("No active storage directory")
        }

        let notesDir = sdURL.appendingPathComponent("notes")
        guard FileManager.default.fileExists(atPath: notesDir.path) else {
            return []
        }

        let contents = try FileManager.default.contentsOfDirectory(at: notesDir, includingPropertiesForKeys: [.isDirectoryKey])
        return contents.compactMap { url in
            var isDir: ObjCBool = false
            if FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir), isDir.boolValue {
                return url.lastPathComponent
            }
            return nil
        }
    }

    /// Load a note and extract its metadata
    /// - Parameter noteId: The note ID
    /// - Returns: NoteInfo with title, preview, folder, dates, etc.
    func loadNoteInfo(noteId: String) throws -> NoteInfo {
        guard isInitialized, let bridge = bridge else {
            throw CRDTError.bridgeNotInitialized
        }

        guard let activeDir = storageManager.activeDirectory,
              let sdURL = activeDir.url else {
            throw CRDTError.fileNotFound("No active storage directory")
        }

        let notesDir = sdURL.appendingPathComponent("notes").appendingPathComponent(noteId)

        guard FileManager.default.fileExists(atPath: notesDir.path) else {
            throw CRDTError.fileNotFound(notesDir.path)
        }

        // Create the note in JS
        bridge.invokeMethod("createNote", withArguments: [noteId])

        // Look for log files in the logs subdirectory
        let logsDir = notesDir.appendingPathComponent("logs")
        if FileManager.default.fileExists(atPath: logsDir.path) {
            let files = try FileManager.default.contentsOfDirectory(
                at: logsDir,
                includingPropertiesForKeys: nil
            )

            // Sort by filename to apply in order
            let sortedFiles = files.sorted { $0.lastPathComponent < $1.lastPathComponent }

            for file in sortedFiles {
                let filename = file.lastPathComponent
                guard filename.hasSuffix(".crdtlog") else {
                    continue
                }

                let data = try Data(contentsOf: file)
                let base64 = data.base64EncodedString()

                bridge.invokeMethod("applyLogFile", withArguments: [noteId, base64])

                if let exception = jsContext?.exception {
                    print("[CRDTManager] Error applying log file \(filename): \(exception)")
                    jsContext?.exception = nil
                }
            }
        }

        // Extract metadata using the bridge
        guard let result = bridge.invokeMethod("extractNoteMetadata", withArguments: [noteId]) else {
            throw CRDTError.noteNotOpen(noteId)
        }

        if let exception = jsContext?.exception {
            let message = exception.toString() ?? "Unknown error"
            jsContext?.exception = nil
            bridge.invokeMethod("closeNote", withArguments: [noteId])
            throw CRDTError.javaScriptError(message)
        }

        guard let dict = result.toDictionary() as? [String: Any],
              let id = dict["id"] as? String,
              let title = dict["title"] as? String,
              let preview = dict["preview"] as? String,
              let created = dict["created"] as? Double,
              let modified = dict["modified"] as? Double,
              let deleted = dict["deleted"] as? Bool,
              let pinned = dict["pinned"] as? Bool else {
            bridge.invokeMethod("closeNote", withArguments: [noteId])
            throw CRDTError.javaScriptError("Failed to extract note metadata")
        }

        let folderId = dict["folderId"] as? String

        // Close the note to free memory
        bridge.invokeMethod("closeNote", withArguments: [noteId])

        return NoteInfo(
            id: id,
            title: title,
            preview: preview,
            folderId: folderId,
            createdAt: Date(timeIntervalSince1970: created / 1000),
            modifiedAt: Date(timeIntervalSince1970: modified / 1000),
            deleted: deleted,
            pinned: pinned
        )
    }

    /// Load all notes and return their metadata
    /// - Returns: Array of NoteInfo, excluding deleted notes
    func loadAllNotes() throws -> [NoteInfo] {
        let noteIds = try listNoteIds()
        var notes: [NoteInfo] = []

        for noteId in noteIds {
            do {
                let noteInfo = try loadNoteInfo(noteId: noteId)
                if !noteInfo.deleted {
                    notes.append(noteInfo)
                }
            } catch {
                print("[CRDTManager] Error loading note \(noteId): \(error)")
                // Continue with other notes
            }
        }

        // Sort by modified date descending (newest first)
        return notes.sorted { $0.modifiedAt > $1.modifiedAt }
    }

    // MARK: - Folder Tree Operations

    /// Load the folder tree CRDT from storage directory
    /// - Parameter sdId: The storage directory ID
    /// - Returns: Base64-encoded CRDT state
    func loadFolderTreeState(sdId: String) throws -> String {
        guard isInitialized, let bridge = bridge else {
            throw CRDTError.bridgeNotInitialized
        }

        guard let activeDir = storageManager.activeDirectory,
              let sdURL = activeDir.url else {
            throw CRDTError.fileNotFound("No active storage directory")
        }

        let foldersDir = sdURL.appendingPathComponent("folders")

        // Create the folder tree in JS
        bridge.invokeMethod("createFolderTree", withArguments: [sdId])

        // Look for log files in the logs subdirectory
        let logsDir = foldersDir.appendingPathComponent("logs")
        if FileManager.default.fileExists(atPath: logsDir.path) {
            let files = try FileManager.default.contentsOfDirectory(
                at: logsDir,
                includingPropertiesForKeys: nil
            )

            let sortedFiles = files.sorted { $0.lastPathComponent < $1.lastPathComponent }

            for file in sortedFiles {
                let filename = file.lastPathComponent
                guard filename.hasSuffix(".crdtlog") else {
                    continue
                }

                let data = try Data(contentsOf: file)
                let base64 = data.base64EncodedString()

                bridge.invokeMethod("applyFolderTreeLogFile", withArguments: [sdId, base64])

                if let exception = jsContext?.exception {
                    print("[CRDTManager] Error applying folder log file \(filename): \(exception)")
                    jsContext?.exception = nil
                }
            }
        }

        // Get the state
        guard let state = bridge.invokeMethod("getFolderTreeState", withArguments: [sdId]),
              let stateString = state.toString() else {
            throw CRDTError.folderTreeNotOpen(sdId)
        }

        return stateString
    }

    /// Close a folder tree and free its memory
    func closeFolderTree(sdId: String) {
        guard isInitialized, let bridge = bridge else { return }
        bridge.invokeMethod("closeFolderTree", withArguments: [sdId])
    }

    /// Extract folders from a loaded folder tree
    /// - Parameter sdId: The storage directory ID
    /// - Returns: Array of FolderInfo objects (includes deleted folders)
    func extractFolders(sdId: String) throws -> [FolderInfo] {
        guard isInitialized, let bridge = bridge else {
            throw CRDTError.bridgeNotInitialized
        }

        guard let result = bridge.invokeMethod("extractFolders", withArguments: [sdId]) else {
            throw CRDTError.folderTreeNotOpen(sdId)
        }

        if let exception = jsContext?.exception {
            let message = exception.toString() ?? "Unknown error"
            jsContext?.exception = nil
            throw CRDTError.javaScriptError(message)
        }

        guard result.isArray, let array = result.toArray() else {
            throw CRDTError.javaScriptError("extractFolders did not return an array")
        }

        var folders: [FolderInfo] = []
        for item in array {
            guard let dict = item as? [String: Any],
                  let id = dict["id"] as? String,
                  let name = dict["name"] as? String,
                  let sdId = dict["sdId"] as? String,
                  let order = dict["order"] as? Int,
                  let deleted = dict["deleted"] as? Bool else {
                continue
            }

            let parentId = dict["parentId"] as? String

            folders.append(FolderInfo(
                id: id,
                name: name,
                parentId: parentId,
                sdId: sdId,
                order: order,
                deleted: deleted
            ))
        }

        return folders
    }

    /// Get visible folders (non-deleted, sorted by order)
    /// - Parameter sdId: The storage directory ID
    /// - Returns: Array of visible FolderInfo objects
    func getVisibleFolders(sdId: String) throws -> [FolderInfo] {
        let allFolders = try extractFolders(sdId: sdId)
        return allFolders.filter { !$0.deleted }
    }

    /// Get root folders (parentId is nil)
    /// - Parameter sdId: The storage directory ID
    /// - Returns: Array of root FolderInfo objects
    func getRootFolders(sdId: String) throws -> [FolderInfo] {
        return try getVisibleFolders(sdId: sdId).filter { $0.parentId == nil }
    }

    /// Get child folders of a parent
    /// - Parameters:
    ///   - sdId: The storage directory ID
    ///   - parentId: The parent folder ID
    /// - Returns: Array of child FolderInfo objects
    func getChildFolders(sdId: String, parentId: String) throws -> [FolderInfo] {
        return try getVisibleFolders(sdId: sdId).filter { $0.parentId == parentId }
    }

    // MARK: - Memory Management

    /// Clear all cached documents
    func clearCache() {
        guard isInitialized, let bridge = bridge else { return }
        bridge.invokeMethod("clearDocumentCache", withArguments: [])
    }

    /// Get the number of currently open documents
    var openDocumentCount: Int {
        guard isInitialized, let bridge = bridge else { return 0 }
        guard let count = bridge.invokeMethod("getOpenDocumentCount", withArguments: []),
              let intValue = count.toNumber()?.intValue else {
            return 0
        }
        return intValue
    }
}
