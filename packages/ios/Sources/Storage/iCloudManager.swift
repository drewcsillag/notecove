import Foundation

/// Manages iCloud Drive integration for NoteCove.
///
/// Provides access to the iCloud container and monitors changes to files stored in iCloud.
/// This enables seamless sync across devices when users store their NoteCove data in iCloud Drive.
///
/// Example usage:
/// ```swift
/// let iCloudManager = iCloudManager()
///
/// if iCloudManager.isICloudAvailable() {
///     if let containerURL = iCloudManager.getContainerURL() {
///         print("iCloud container: \(containerURL)")
///
///         iCloudManager.watchICloudChanges {
///             print("Files changed in iCloud")
///         }
///     }
/// }
/// ```
public class iCloudManager {
    private let containerIdentifier = "iCloud.com.notecove.NoteCove"
    private var metadataQuery: NSMetadataQuery?
    private var changeHandler: (() -> Void)?

    /// Creates a new iCloud manager
    public init() {}

    /// Checks if iCloud is available and accessible
    /// - Returns: true if iCloud is available, false otherwise
    public func isICloudAvailable() -> Bool {
        return FileManager.default.ubiquityIdentityToken != nil
    }

    /// Gets the URL for the iCloud container
    /// - Returns: The container URL, or nil if iCloud is not available
    public func getContainerURL() -> URL? {
        return FileManager.default.url(
            forUbiquityContainerIdentifier: containerIdentifier
        )
    }

    /// Gets the Documents directory within the iCloud container
    /// - Returns: The Documents directory URL, or nil if iCloud is not available
    public func getDocumentsDirectory() -> URL? {
        guard let containerURL = getContainerURL() else {
            return nil
        }

        let documentsURL = containerURL.appendingPathComponent("Documents")

        // Create the directory if it doesn't exist
        if !FileManager.default.fileExists(atPath: documentsURL.path) {
            do {
                try FileManager.default.createDirectory(
                    at: documentsURL,
                    withIntermediateDirectories: true,
                    attributes: nil
                )
            } catch {
                print("[iCloudManager] Error creating Documents directory: \(error)")
                return nil
            }
        }

        return documentsURL
    }

    /// Starts watching for changes to files in the iCloud container
    /// - Parameter onChange: Callback invoked when files change in iCloud
    public func watchICloudChanges(onChange: @escaping () -> Void) {
        guard isICloudAvailable() else {
            print("[iCloudManager] iCloud not available, cannot watch for changes")
            return
        }

        // Store the change handler
        changeHandler = onChange

        // Create a metadata query to watch for file changes
        let query = NSMetadataQuery()
        query.predicate = NSPredicate(format: "%K LIKE '*'", NSMetadataItemPathKey)
        query.searchScopes = [NSMetadataQueryUbiquitousDocumentsScope]

        // Observe query notifications
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(metadataQueryDidUpdate(_:)),
            name: NSNotification.Name.NSMetadataQueryDidUpdate,
            object: query
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(metadataQueryDidFinishGathering(_:)),
            name: NSNotification.Name.NSMetadataQueryDidFinishGathering,
            object: query
        )

        // Start the query
        query.start()
        metadataQuery = query

        print("[iCloudManager] Started watching iCloud changes")
    }

    /// Stops watching for iCloud changes
    public func stopWatching() {
        guard let query = metadataQuery else { return }

        query.stop()

        NotificationCenter.default.removeObserver(
            self,
            name: NSNotification.Name.NSMetadataQueryDidUpdate,
            object: query
        )

        NotificationCenter.default.removeObserver(
            self,
            name: NSNotification.Name.NSMetadataQueryDidFinishGathering,
            object: query
        )

        metadataQuery = nil
        changeHandler = nil

        print("[iCloudManager] Stopped watching iCloud changes")
    }

    @objc private func metadataQueryDidUpdate(_ notification: Notification) {
        print("[iCloudManager] iCloud files updated")
        changeHandler?()
    }

    @objc private func metadataQueryDidFinishGathering(_ notification: Notification) {
        print("[iCloudManager] iCloud metadata gathering finished")
        changeHandler?()
    }

    deinit {
        stopWatching()
    }
}
