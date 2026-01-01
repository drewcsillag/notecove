import Foundation
import UIKit
import CryptoKit

/// Handles image storage in the sync directory's media folder
@MainActor
final class ImageStorage: Sendable {
    /// Shared instance
    static let shared = ImageStorage()

    private let fileManager = FileManager.default

    private init() {}

    // MARK: - Image Storage

    /// Save an image to the media folder and return its imageId
    ///
    /// Images are stored as content-addressed files using SHA-256 hash of the image data.
    /// This ensures deduplication of identical images.
    ///
    /// - Parameters:
    ///   - image: The UIImage to save
    ///   - mimeType: The MIME type (defaults to JPEG)
    /// - Returns: Tuple of (imageId, sdId) on success
    /// - Throws: ImageStorageError if storage fails
    func saveImage(_ image: UIImage, mimeType: String = "image/jpeg") throws -> (imageId: String, sdId: String) {
        guard let activeDir = StorageDirectoryManager.shared.activeDirectory,
              let sdURL = activeDir.url else {
            throw ImageStorageError.noStorageDirectory
        }
        let sdId = activeDir.id

        // Convert image to data
        let imageData: Data
        let fileExtension: String

        switch mimeType {
        case "image/png":
            guard let data = image.pngData() else {
                throw ImageStorageError.encodingFailed
            }
            imageData = data
            fileExtension = "png"
        case "image/jpeg", "image/jpg":
            guard let data = image.jpegData(compressionQuality: 0.85) else {
                throw ImageStorageError.encodingFailed
            }
            imageData = data
            fileExtension = "jpg"
        case "image/heic":
            // For HEIC, convert to JPEG for compatibility
            guard let data = image.jpegData(compressionQuality: 0.85) else {
                throw ImageStorageError.encodingFailed
            }
            imageData = data
            fileExtension = "jpg"
        default:
            // Default to JPEG for unknown types
            guard let data = image.jpegData(compressionQuality: 0.85) else {
                throw ImageStorageError.encodingFailed
            }
            imageData = data
            fileExtension = "jpg"
        }

        // Generate content-addressed imageId using SHA-256
        let hash = SHA256.hash(data: imageData)
        let imageId = hash.prefix(16).compactMap { String(format: "%02x", $0) }.joined()

        // Ensure media directory exists
        let mediaDir = sdURL.appendingPathComponent("media")
        try fileManager.createDirectory(at: mediaDir, withIntermediateDirectories: true)

        // Save the image file
        let imageFile = mediaDir.appendingPathComponent("\(imageId).\(fileExtension)")

        // Check if file already exists (deduplication)
        if !fileManager.fileExists(atPath: imageFile.path) {
            try imageData.write(to: imageFile)
            print("[ImageStorage] Saved image: \(imageId).\(fileExtension), size: \(imageData.count) bytes")
        } else {
            print("[ImageStorage] Image already exists: \(imageId).\(fileExtension)")
        }

        return (imageId: imageId, sdId: sdId)
    }

    /// Save image data directly to the media folder
    ///
    /// - Parameters:
    ///   - data: The raw image data
    ///   - mimeType: The MIME type of the image
    /// - Returns: Tuple of (imageId, sdId) on success
    /// - Throws: ImageStorageError if storage fails
    func saveImageData(_ data: Data, mimeType: String) throws -> (imageId: String, sdId: String) {
        guard let activeDir = StorageDirectoryManager.shared.activeDirectory,
              let sdURL = activeDir.url else {
            throw ImageStorageError.noStorageDirectory
        }
        let sdId = activeDir.id

        // Determine file extension from MIME type
        let fileExtension: String
        switch mimeType {
        case "image/png":
            fileExtension = "png"
        case "image/jpeg", "image/jpg":
            fileExtension = "jpg"
        case "image/gif":
            fileExtension = "gif"
        case "image/webp":
            fileExtension = "webp"
        case "image/heic", "image/heif":
            fileExtension = "heic"
        default:
            fileExtension = "jpg"
        }

        // Generate content-addressed imageId using SHA-256
        let hash = SHA256.hash(data: data)
        let imageId = hash.prefix(16).compactMap { String(format: "%02x", $0) }.joined()

        // Ensure media directory exists
        let mediaDir = sdURL.appendingPathComponent("media")
        try fileManager.createDirectory(at: mediaDir, withIntermediateDirectories: true)

        // Save the image file
        let imageFile = mediaDir.appendingPathComponent("\(imageId).\(fileExtension)")

        // Check if file already exists (deduplication)
        if !fileManager.fileExists(atPath: imageFile.path) {
            try data.write(to: imageFile)
            print("[ImageStorage] Saved image data: \(imageId).\(fileExtension), size: \(data.count) bytes")
        } else {
            print("[ImageStorage] Image already exists: \(imageId).\(fileExtension)")
        }

        return (imageId: imageId, sdId: sdId)
    }

    /// Get the URL for an image in the media folder
    func getImageURL(imageId: String, sdId: String) -> URL? {
        guard let activeDir = StorageDirectoryManager.shared.activeDirectory,
              let sdURL = activeDir.url else {
            return nil
        }

        let mediaDir = sdURL.appendingPathComponent("media")

        // Check for common extensions
        for ext in ["jpg", "jpeg", "png", "gif", "webp", "heic"] {
            let imageURL = mediaDir.appendingPathComponent("\(imageId).\(ext)")
            if fileManager.fileExists(atPath: imageURL.path) {
                return imageURL
            }
        }

        return nil
    }

    /// Check if an image exists in the media folder
    func imageExists(imageId: String) -> Bool {
        guard let activeDir = StorageDirectoryManager.shared.activeDirectory,
              let sdURL = activeDir.url else {
            return false
        }

        let mediaDir = sdURL.appendingPathComponent("media")

        // Check for common extensions
        for ext in ["jpg", "jpeg", "png", "gif", "webp", "heic"] {
            let imageURL = mediaDir.appendingPathComponent("\(imageId).\(ext)")
            if fileManager.fileExists(atPath: imageURL.path) {
                return true
            }
        }

        return false
    }
}

/// Errors that can occur during image storage
enum ImageStorageError: Error, LocalizedError {
    case noStorageDirectory
    case encodingFailed
    case saveFailed(String)

    var errorDescription: String? {
        switch self {
        case .noStorageDirectory:
            return "No storage directory available"
        case .encodingFailed:
            return "Failed to encode image"
        case .saveFailed(let message):
            return "Failed to save image: \(message)"
        }
    }
}
