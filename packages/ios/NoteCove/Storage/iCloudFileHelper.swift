/**
 * iCloud File Helper
 *
 * Utilities for working with iCloud Drive files that may not be downloaded locally.
 * Prevents app stalls by checking download status before accessing files.
 */

import Foundation

enum iCloudDownloadStatus {
    case downloaded
    case downloading
    case notDownloaded
    case notUbiquitous  // Local file, not in iCloud
    case unknown
}

struct iCloudFileHelper {

    /// Check the download status of a file
    /// - Parameter url: The file URL to check
    /// - Returns: The download status
    static func downloadStatus(for url: URL) -> iCloudDownloadStatus {
        do {
            let resourceValues = try url.resourceValues(forKeys: [
                .ubiquitousItemDownloadingStatusKey,
                .ubiquitousItemIsDownloadingKey
            ])

            if let status = resourceValues.ubiquitousItemDownloadingStatus {
                if status == .current || status == .downloaded {
                    return .downloaded
                } else if status == .notDownloaded {
                    if resourceValues.ubiquitousItemIsDownloading == true {
                        return .downloading
                    }
                    return .notDownloaded
                } else {
                    return .unknown
                }
            }

            // No ubiquitous status means it's a local file
            return .notUbiquitous
        } catch {
            // If we can't get resource values, assume it's local
            return .notUbiquitous
        }
    }

    /// Check if a file is available locally (downloaded or not in iCloud)
    /// - Parameter url: The file URL to check
    /// - Returns: true if file can be read without blocking on download
    static func isAvailableLocally(_ url: URL) -> Bool {
        let status = downloadStatus(for: url)
        return status == .downloaded || status == .notUbiquitous
    }

    /// Start downloading a file from iCloud if needed
    /// - Parameter url: The file URL to download
    /// - Returns: true if download was started, false if already downloaded or not in iCloud
    @discardableResult
    static func startDownloadIfNeeded(_ url: URL) -> Bool {
        let status = downloadStatus(for: url)

        guard status == .notDownloaded else {
            return false
        }

        do {
            try FileManager.default.startDownloadingUbiquitousItem(at: url)
            print("[iCloudFileHelper] Started downloading: \(url.lastPathComponent)")
            return true
        } catch {
            print("[iCloudFileHelper] Failed to start download: \(error)")
            return false
        }
    }

    /// Start downloading all files in a directory from iCloud
    /// - Parameter directoryURL: The directory to scan
    /// - Returns: Number of files that started downloading
    @discardableResult
    static func startDownloadingDirectory(_ directoryURL: URL) -> Int {
        guard FileManager.default.fileExists(atPath: directoryURL.path) else {
            return 0
        }

        var count = 0

        do {
            let contents = try FileManager.default.contentsOfDirectory(
                at: directoryURL,
                includingPropertiesForKeys: [.ubiquitousItemDownloadingStatusKey]
            )

            for url in contents {
                if startDownloadIfNeeded(url) {
                    count += 1
                }
            }
        } catch {
            print("[iCloudFileHelper] Failed to scan directory: \(error)")
        }

        return count
    }

    /// Check if all files in a directory are downloaded
    /// - Parameter directoryURL: The directory to check
    /// - Returns: true if all files are available locally
    static func isDirectoryFullyDownloaded(_ directoryURL: URL) -> Bool {
        guard FileManager.default.fileExists(atPath: directoryURL.path) else {
            return true // Empty/missing directory is "downloaded"
        }

        do {
            let contents = try FileManager.default.contentsOfDirectory(
                at: directoryURL,
                includingPropertiesForKeys: [.ubiquitousItemDownloadingStatusKey]
            )

            for url in contents {
                if !isAvailableLocally(url) {
                    return false
                }
            }

            return true
        } catch {
            return true // On error, assume downloaded
        }
    }

    /// Read file data, triggering download if needed and waiting up to timeout
    /// - Parameters:
    ///   - url: The file URL
    ///   - timeout: Maximum time to wait for download (default 10 seconds)
    /// - Returns: File data, or nil if not available within timeout
    static func readFileWithDownload(_ url: URL, timeout: TimeInterval = 10) async -> Data? {
        // If already available, read immediately
        if isAvailableLocally(url) {
            return try? Data(contentsOf: url)
        }

        // Start download
        startDownloadIfNeeded(url)

        // Poll for completion
        let startTime = Date()
        while Date().timeIntervalSince(startTime) < timeout {
            if isAvailableLocally(url) {
                return try? Data(contentsOf: url)
            }
            try? await Task.sleep(nanoseconds: 100_000_000) // 100ms
        }

        print("[iCloudFileHelper] Timeout waiting for download: \(url.lastPathComponent)")
        return nil
    }

    /// Get count of files pending download in a directory
    /// - Parameter directoryURL: The directory to check
    /// - Returns: Number of files not yet downloaded
    static func pendingDownloadCount(in directoryURL: URL) -> Int {
        guard FileManager.default.fileExists(atPath: directoryURL.path) else {
            return 0
        }

        var count = 0

        do {
            let contents = try FileManager.default.contentsOfDirectory(
                at: directoryURL,
                includingPropertiesForKeys: [.ubiquitousItemDownloadingStatusKey]
            )

            for url in contents {
                let status = downloadStatus(for: url)
                if status == .notDownloaded || status == .downloading {
                    count += 1
                }
            }
        } catch {
            // Ignore
        }

        return count
    }
}
