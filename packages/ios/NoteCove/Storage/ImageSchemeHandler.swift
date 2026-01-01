import Foundation
import WebKit

/// WKURLSchemeHandler that intercepts notecove:// URLs to load images from storage directory
///
/// URL format: notecove://image/{sdId}/{imageId}
/// The handler looks up the image in the SD's media folder and returns it.
final class ImageSchemeHandler: NSObject, WKURLSchemeHandler, @unchecked Sendable {
    /// Shared instance - must be accessed from main actor
    @MainActor static let shared = ImageSchemeHandler()

    /// The URL scheme this handler responds to
    static let scheme = "notecove"

    private override init() {
        super.init()
    }

    // MARK: - WKURLSchemeHandler

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        NSLog("[ImageSchemeHandler] START - webView:start called")

        guard let url = urlSchemeTask.request.url else {
            NSLog("[ImageSchemeHandler] ERROR - No URL in request")
            urlSchemeTask.didFailWithError(ImageSchemeError.invalidURL)
            return
        }

        NSLog("[ImageSchemeHandler] Processing URL: \(url.absoluteString)")
        NSLog("[ImageSchemeHandler] URL host: \(url.host ?? "nil"), path: \(url.path)")

        // Parse the URL: notecove://image/{sdId}/{imageId}
        // Note: "image" is the host, not a path component
        // pathComponents will be ["/", "sdId", "imageId"] or ["sdId", "imageId"] after filtering
        guard url.host == "image" else {
            NSLog("[ImageSchemeHandler] Invalid URL host: \(url.host ?? "nil"), expected 'image'")
            urlSchemeTask.didFailWithError(ImageSchemeError.invalidURL)
            return
        }

        let pathComponents = url.pathComponents.filter { $0 != "/" }
        NSLog("[ImageSchemeHandler] Path components: \(pathComponents)")

        guard pathComponents.count >= 2 else {
            NSLog("[ImageSchemeHandler] Invalid URL format (need sdId and imageId): \(url)")
            urlSchemeTask.didFailWithError(ImageSchemeError.invalidURL)
            return
        }

        let sdId = pathComponents[0]
        let imageId = pathComponents[1]

        NSLog("[ImageSchemeHandler] Loading image: sdId=\(sdId), imageId=\(imageId)")

        // Get the storage directory URL synchronously on main thread
        // This is safe because we're just reading a published property
        var sdURL: URL?
        if Thread.isMainThread {
            sdURL = StorageDirectoryManager.shared.activeDirectory?.url
        } else {
            DispatchQueue.main.sync {
                sdURL = StorageDirectoryManager.shared.activeDirectory?.url
            }
        }

        guard let storageURL = sdURL else {
            print("[ImageSchemeHandler] No active storage directory")
            urlSchemeTask.didFailWithError(ImageSchemeError.noStorageDirectory)
            return
        }

        // Look for the image in the media folder
        let mediaDir = storageURL.appendingPathComponent("media")

        do {
            // Find the image file (could have various extensions)
            let imageURL = try findImageFile(in: mediaDir, imageId: imageId)

            // Read the image data
            let imageData = try Data(contentsOf: imageURL)

            // Determine MIME type from extension
            let mimeType = mimeTypeForExtension(imageURL.pathExtension)

            // Create response
            let response = URLResponse(
                url: url,
                mimeType: mimeType,
                expectedContentLength: imageData.count,
                textEncodingName: nil
            )

            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(imageData)
            urlSchemeTask.didFinish()

            NSLog("[ImageSchemeHandler] Successfully loaded image: \(imageURL.lastPathComponent), size: \(imageData.count) bytes")

        } catch {
            NSLog("[ImageSchemeHandler] Failed to load image: \(error)")
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Nothing to clean up for simple file reads
    }

    // MARK: - Helper Methods

    /// Find the image file in the media directory
    /// Images are stored as {imageId}.{extension}
    private func findImageFile(in mediaDir: URL, imageId: String) throws -> URL {
        // Common image extensions to check
        let extensions = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"]

        // Check for each extension
        for ext in extensions {
            let fileURL = mediaDir.appendingPathComponent("\(imageId).\(ext)")
            if FileManager.default.fileExists(atPath: fileURL.path) {
                return fileURL
            }
        }

        // Also check if file exists with any extension by scanning directory
        let contents = try FileManager.default.contentsOfDirectory(at: mediaDir, includingPropertiesForKeys: nil)
        for file in contents {
            let filename = file.deletingPathExtension().lastPathComponent
            if filename == imageId {
                return file
            }
        }

        throw ImageSchemeError.imageNotFound(imageId)
    }

    /// Get MIME type for file extension
    private func mimeTypeForExtension(_ ext: String) -> String {
        switch ext.lowercased() {
        case "jpg", "jpeg":
            return "image/jpeg"
        case "png":
            return "image/png"
        case "gif":
            return "image/gif"
        case "webp":
            return "image/webp"
        case "heic":
            return "image/heic"
        case "heif":
            return "image/heif"
        case "svg":
            return "image/svg+xml"
        default:
            return "application/octet-stream"
        }
    }
}

/// Errors that can occur when loading images via scheme handler
enum ImageSchemeError: Error, LocalizedError {
    case invalidURL
    case noStorageDirectory
    case imageNotFound(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid image URL format"
        case .noStorageDirectory:
            return "No storage directory available"
        case .imageNotFound(let imageId):
            return "Image not found: \(imageId)"
        }
    }
}
