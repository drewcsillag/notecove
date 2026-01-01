import Foundation
import Combine

/// Manages access to storage directories (SDs) for NoteCove
/// Handles security-scoped bookmarks, file access, and SD validation
@MainActor
final class StorageDirectoryManager: ObservableObject {
    /// Shared instance
    static let shared = StorageDirectoryManager()

    /// The currently active storage directory
    @Published private(set) var activeDirectory: StorageDirectoryInfo?

    /// Whether we currently have access to the storage directory
    @Published private(set) var hasAccess: Bool = false

    /// Error state if access failed
    @Published private(set) var accessError: StorageDirectoryError?

    /// Currently accessing security-scoped resource
    private var isAccessingSecurityScopedResource = false

    private init() {}

    // MARK: - Public API

    /// Set the active storage directory from a URL (e.g., from folder picker)
    /// - Parameter url: The URL from the document picker
    /// - Throws: StorageDirectoryError if validation fails
    func setActiveDirectory(from url: URL) throws {
        // Start accessing security-scoped resource
        guard url.startAccessingSecurityScopedResource() else {
            throw StorageDirectoryError.accessDenied
        }

        defer {
            // We'll keep access open via bookmark, so stop this temporary access
            url.stopAccessingSecurityScopedResource()
        }

        // Validate the directory
        let info = try validateStorageDirectory(at: url)

        // Create and save bookmark
        let bookmarkData = try createBookmark(for: url)
        saveBookmark(bookmarkData, for: info.id)

        // Set as active
        activeDirectory = info
        hasAccess = true
        accessError = nil

        // Save as active SD
        UserDefaults.standard.set(info.id, forKey: "activeStorageDirectoryId")
    }

    /// Restore access to the previously active storage directory
    /// Call this on app launch
    func restoreAccess() {
        guard let activeId = UserDefaults.standard.string(forKey: "activeStorageDirectoryId"),
              let bookmarkData = loadBookmark(for: activeId) else {
            hasAccess = false
            return
        }

        do {
            var isStale = false
            let url = try URL(resolvingBookmarkData: bookmarkData,
                              options: [],
                              relativeTo: nil,
                              bookmarkDataIsStale: &isStale)

            if isStale {
                // Bookmark is stale - need user to re-select
                accessError = .bookmarkStale
                hasAccess = false
                return
            }

            // Start accessing the security-scoped resource
            guard url.startAccessingSecurityScopedResource() else {
                accessError = .accessDenied
                hasAccess = false
                return
            }
            isAccessingSecurityScopedResource = true

            // Validate and restore
            let info = try validateStorageDirectory(at: url)
            activeDirectory = info
            hasAccess = true
            accessError = nil

        } catch let error as StorageDirectoryError {
            accessError = error
            hasAccess = false
        } catch {
            accessError = .unknown(error)
            hasAccess = false
        }
    }

    /// Stop accessing the security-scoped resource
    /// Call this when the app goes to background
    func releaseAccess() {
        if isAccessingSecurityScopedResource, let url = activeDirectory?.url {
            url.stopAccessingSecurityScopedResource()
            isAccessingSecurityScopedResource = false
        }
        hasAccess = false
    }

    /// Resume access after app returns to foreground
    func resumeAccess() {
        guard let info = activeDirectory else { return }

        if let url = info.url, url.startAccessingSecurityScopedResource() {
            isAccessingSecurityScopedResource = true
            hasAccess = true
            accessError = nil
        } else {
            accessError = .accessDenied
            hasAccess = false
        }
    }

    /// Clear the active directory (for resetting/re-onboarding)
    func clearActiveDirectory() {
        releaseAccess()
        if let id = activeDirectory?.id {
            removeBookmark(for: id)
        }
        activeDirectory = nil
        UserDefaults.standard.removeObject(forKey: "activeStorageDirectoryId")
    }

    // MARK: - File Operations

    /// List all note IDs in the storage directory
    func listNoteIds() throws -> [String] {
        guard let url = activeDirectory?.url, hasAccess else {
            throw StorageDirectoryError.notAccessible
        }

        let notesDir = url.appendingPathComponent("notes")
        guard FileManager.default.fileExists(atPath: notesDir.path) else {
            return []
        }

        let contents = try FileManager.default.contentsOfDirectory(
            at: notesDir,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        )

        // Each note is a directory named with its ID
        return contents.compactMap { url in
            var isDirectory: ObjCBool = false
            if FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory),
               isDirectory.boolValue {
                return url.lastPathComponent
            }
            return nil
        }
    }

    /// Get the path to a note's directory
    func noteDirectory(for noteId: String) -> URL? {
        guard let url = activeDirectory?.url else { return nil }
        return url.appendingPathComponent("notes").appendingPathComponent(noteId)
    }

    /// Get the path to the folders CRDT directory
    func foldersDirectory() -> URL? {
        guard let url = activeDirectory?.url else { return nil }
        return url.appendingPathComponent("folders")
    }

    /// Get the path to the media directory
    func mediaDirectory() -> URL? {
        guard let url = activeDirectory?.url else { return nil }
        return url.appendingPathComponent("media")
    }

    /// Get the path to the activity directory
    func activityDirectory() -> URL? {
        guard let url = activeDirectory?.url else { return nil }
        return url.appendingPathComponent("activity")
    }

    // MARK: - Private Helpers

    private func validateStorageDirectory(at url: URL) throws -> StorageDirectoryInfo {
        // Check SD_ID file exists
        let sdIdURL = url.appendingPathComponent("SD_ID")
        guard FileManager.default.fileExists(atPath: sdIdURL.path) else {
            throw StorageDirectoryError.notStorageDirectory
        }

        // Read SD_ID
        let sdId = try String(contentsOf: sdIdURL, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sdId.isEmpty else {
            throw StorageDirectoryError.invalidSdId
        }

        // Read SD-TYPE (optional, defaults to "local")
        var sdType = "local"
        let sdTypeURL = url.appendingPathComponent("SD-TYPE")
        if FileManager.default.fileExists(atPath: sdTypeURL.path) {
            sdType = (try? String(contentsOf: sdTypeURL, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines)) ?? "local"
        }

        return StorageDirectoryInfo(
            id: sdId,
            type: sdType,
            url: url,
            name: url.lastPathComponent
        )
    }

    private func createBookmark(for url: URL) throws -> Data {
        do {
            return try url.bookmarkData(
                options: .minimalBookmark,
                includingResourceValuesForKeys: nil,
                relativeTo: nil
            )
        } catch {
            throw StorageDirectoryError.bookmarkCreationFailed(error)
        }
    }

    private func saveBookmark(_ data: Data, for sdId: String) {
        UserDefaults.standard.set(data, forKey: "sd_bookmark_\(sdId)")
    }

    private func loadBookmark(for sdId: String) -> Data? {
        UserDefaults.standard.data(forKey: "sd_bookmark_\(sdId)")
    }

    private func removeBookmark(for sdId: String) {
        UserDefaults.standard.removeObject(forKey: "sd_bookmark_\(sdId)")
    }
}

// MARK: - Supporting Types

/// Information about a storage directory
struct StorageDirectoryInfo: Identifiable {
    let id: String      // SD_ID value
    let type: String    // SD-TYPE value (e.g., "local", "icloud")
    let url: URL?       // File URL (nil if access lost)
    let name: String    // Display name (folder name)
}

/// Errors that can occur when working with storage directories
enum StorageDirectoryError: LocalizedError {
    case notStorageDirectory
    case invalidSdId
    case accessDenied
    case notAccessible
    case bookmarkStale
    case bookmarkCreationFailed(Error)
    case iCloudNotConfigured
    case folderNotFound
    case unknown(Error)

    var errorDescription: String? {
        switch self {
        case .notStorageDirectory:
            return "This folder is not a NoteCove storage directory. Please select a folder that contains SD_ID."
        case .invalidSdId:
            return "The storage directory has an invalid or empty SD_ID."
        case .accessDenied:
            return "Cannot access this folder. Please grant permission and try again."
        case .notAccessible:
            return "Storage directory is not currently accessible."
        case .bookmarkStale:
            return "Access to the storage directory has expired. Please select it again."
        case .bookmarkCreationFailed(let error):
            return "Failed to save folder access: \(error.localizedDescription)"
        case .iCloudNotConfigured:
            return "iCloud Drive is not configured. Please enable iCloud Drive in Settings."
        case .folderNotFound:
            return "The selected folder no longer exists."
        case .unknown(let error):
            return "An unexpected error occurred: \(error.localizedDescription)"
        }
    }

    /// Recovery suggestion for user
    var recoverySuggestion: String? {
        switch self {
        case .notStorageDirectory:
            return "Select your NoteCove storage folder (contains SD_ID file)"
        case .accessDenied, .notAccessible:
            return "Tap 'Select Folder Again' to grant access"
        case .bookmarkStale:
            return "Tap 'Select Folder Again' to refresh access"
        case .iCloudNotConfigured:
            return "Go to Settings > Apple Account > iCloud > iCloud Drive"
        case .folderNotFound:
            return "The folder may have been moved or deleted"
        default:
            return nil
        }
    }
}
