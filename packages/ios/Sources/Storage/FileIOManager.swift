import Foundation

/// Errors that can occur during file I/O operations
enum FileIOError: Error, Equatable {
    case fileNotFound(String)
    case permissionDenied(String)
    case diskFull
    case invalidPath(String)
    case atomicWriteFailed(String)
    case directoryCreationFailed(String)
    case deleteFailed(String)
}

/// Manages file system operations for NoteCove storage
/// Provides atomic writes, directory management, and pattern-based file listing
class FileIOManager {
    private let fileManager: FileManager

    /// Initialize with a custom FileManager (mainly for testing)
    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
    }

    // MARK: - Basic File Operations

    /// Read file data from the specified path
    /// - Parameter path: Absolute path to the file
    /// - Returns: File data
    /// - Throws: FileIOError if the file cannot be read
    func readFile(at path: String) throws -> Data {
        let url = URL(fileURLWithPath: path)

        guard fileManager.fileExists(atPath: path) else {
            throw FileIOError.fileNotFound(path)
        }

        do {
            return try Data(contentsOf: url)
        } catch let error as NSError {
            if error.domain == NSCocoaErrorDomain && error.code == NSFileReadNoPermissionError {
                throw FileIOError.permissionDenied(path)
            }
            throw FileIOError.fileNotFound(path)
        }
    }

    /// Write data to the specified path
    /// - Parameters:
    ///   - data: Data to write
    ///   - path: Absolute path where the file should be written
    /// - Throws: FileIOError if the file cannot be written
    func writeFile(data: Data, to path: String) throws {
        let url = URL(fileURLWithPath: path)

        // Ensure parent directory exists
        let parentDir = url.deletingLastPathComponent()
        if !fileManager.fileExists(atPath: parentDir.path) {
            try createDirectory(at: parentDir.path)
        }

        do {
            try data.write(to: url, options: .atomic)
        } catch let error as NSError {
            if error.domain == NSCocoaErrorDomain && error.code == NSFileWriteOutOfSpaceError {
                throw FileIOError.diskFull
            } else if error.domain == NSCocoaErrorDomain && error.code == NSFileWriteNoPermissionError {
                throw FileIOError.permissionDenied(path)
            }
            throw FileIOError.invalidPath(path)
        }
    }

    /// Delete file at the specified path
    /// - Parameter path: Absolute path to the file
    /// - Throws: FileIOError if the file cannot be deleted
    func deleteFile(at path: String) throws {
        guard fileManager.fileExists(atPath: path) else {
            throw FileIOError.fileNotFound(path)
        }

        do {
            try fileManager.removeItem(atPath: path)
        } catch {
            throw FileIOError.deleteFailed(path)
        }
    }

    /// Check if a file exists at the specified path
    /// - Parameter path: Absolute path to check
    /// - Returns: true if file exists, false otherwise
    func fileExists(at path: String) -> Bool {
        return fileManager.fileExists(atPath: path)
    }

    // MARK: - Directory Operations

    /// Create a directory at the specified path
    /// - Parameter path: Absolute path where the directory should be created
    /// - Throws: FileIOError if the directory cannot be created
    func createDirectory(at path: String) throws {
        let url = URL(fileURLWithPath: path)

        do {
            try fileManager.createDirectory(at: url, withIntermediateDirectories: true, attributes: nil)
        } catch let error as NSError {
            if error.domain == NSCocoaErrorDomain && error.code == NSFileWriteNoPermissionError {
                throw FileIOError.permissionDenied(path)
            }
            throw FileIOError.directoryCreationFailed(path)
        }
    }

    /// List files in a directory, optionally filtered by pattern
    /// - Parameters:
    ///   - directory: Absolute path to the directory
    ///   - pattern: Optional glob pattern (e.g., "*.yjson")
    /// - Returns: Array of absolute file paths
    /// - Throws: FileIOError if the directory cannot be read
    func listFiles(in directory: String, matching pattern: String? = nil) throws -> [String] {
        let url = URL(fileURLWithPath: directory)

        guard fileManager.fileExists(atPath: directory) else {
            throw FileIOError.fileNotFound(directory)
        }

        do {
            let contents = try fileManager.contentsOfDirectory(at: url, includingPropertiesForKeys: nil)

            var filePaths = contents
                .filter { !$0.hasDirectoryPath }
                .map { $0.path }

            // Apply pattern matching if provided
            if let pattern = pattern {
                filePaths = filePaths.filter { path in
                    matchesPattern(path: path, pattern: pattern)
                }
            }

            return filePaths.sorted()
        } catch let error as NSError {
            if error.domain == NSCocoaErrorDomain && error.code == NSFileReadNoPermissionError {
                throw FileIOError.permissionDenied(directory)
            }
            throw FileIOError.fileNotFound(directory)
        }
    }

    // MARK: - Atomic Write

    /// Atomically write data to a file (write to temp, then move)
    /// This ensures no partial writes occur if the operation fails
    /// - Parameters:
    ///   - data: Data to write
    ///   - path: Absolute path where the file should be written
    /// - Throws: FileIOError if the atomic write fails
    func atomicWrite(data: Data, to path: String) throws {
        let url = URL(fileURLWithPath: path)
        let parentDir = url.deletingLastPathComponent()

        // Ensure parent directory exists
        if !fileManager.fileExists(atPath: parentDir.path) {
            try createDirectory(at: parentDir.path)
        }

        // Create temporary file in the same directory
        let tempFileName = ".\(url.lastPathComponent).tmp.\(UUID().uuidString)"
        let tempURL = parentDir.appendingPathComponent(tempFileName)

        do {
            // Write to temporary file
            try data.write(to: tempURL, options: .atomic)

            // Atomically replace the target file
            if fileManager.fileExists(atPath: path) {
                _ = try fileManager.replaceItemAt(url, withItemAt: tempURL)
            } else {
                try fileManager.moveItem(at: tempURL, to: url)
            }
        } catch let error as NSError {
            // Clean up temp file if it exists
            if fileManager.fileExists(atPath: tempURL.path) {
                try? fileManager.removeItem(at: tempURL)
            }

            if error.domain == NSCocoaErrorDomain && error.code == NSFileWriteOutOfSpaceError {
                throw FileIOError.diskFull
            } else if error.domain == NSCocoaErrorDomain && error.code == NSFileWriteNoPermissionError {
                throw FileIOError.permissionDenied(path)
            }
            throw FileIOError.atomicWriteFailed(path)
        }
    }

    // MARK: - Private Helpers

    /// Match a file path against a glob pattern
    /// Supports basic wildcards: * (any characters), ? (single character)
    private func matchesPattern(path: String, pattern: String) -> Bool {
        let fileName = URL(fileURLWithPath: path).lastPathComponent

        // Convert glob pattern to regex
        var regexPattern = "^"
        for char in pattern {
            switch char {
            case "*":
                regexPattern += ".*"
            case "?":
                regexPattern += "."
            case ".":
                regexPattern += "\\."
            default:
                regexPattern += String(char)
            }
        }
        regexPattern += "$"

        guard let regex = try? NSRegularExpression(pattern: regexPattern, options: []) else {
            return false
        }

        let range = NSRange(location: 0, length: fileName.utf16.count)
        return regex.firstMatch(in: fileName, options: [], range: range) != nil
    }
}
