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
        }
    }
}

/// Metadata extracted from a note
struct NoteMetadata {
    let title: String
    let preview: String
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
