import XCTest
import WebKit
@testable import NoteCove

/// Tests for ImageSchemeHandler - verifies images load correctly via notecove:// URLs
final class ImageSchemeHandlerTests: XCTestCase {
    var testDirectory: URL!
    var mediaDirectory: URL!

    override func setUpWithError() throws {
        // Create a temporary test directory
        testDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("ImageSchemeHandlerTests-\(UUID().uuidString)")
        mediaDirectory = testDirectory.appendingPathComponent("media")
        try FileManager.default.createDirectory(at: mediaDirectory, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        // Clean up test directory
        if FileManager.default.fileExists(atPath: testDirectory.path) {
            try FileManager.default.removeItem(at: testDirectory)
        }
    }

    /// Test that a known test image can be found in the media folder
    func testFindImageFile() throws {
        // Create a test image file
        let imageId = "testimage123"
        let testImageURL = mediaDirectory.appendingPathComponent("\(imageId).jpg")

        // Create a simple 1x1 red JPEG
        let testImageData = createTestJPEGData()
        try testImageData.write(to: testImageURL)

        // Verify file exists
        XCTAssertTrue(FileManager.default.fileExists(atPath: testImageURL.path), "Test image file should exist")

        // Test finding the image
        let foundURL = try findImageFileInDirectory(mediaDirectory, imageId: imageId)
        XCTAssertEqual(foundURL, testImageURL, "Should find the correct image file")
    }

    /// Test that image loading in WKWebView actually displays the image
    @MainActor
    func testImageDisplaysInWebView() async throws {
        // Create a test image
        let imageId = "displaytest456"
        let testImageURL = mediaDirectory.appendingPathComponent("\(imageId).jpg")
        let testImageData = createTestJPEGData()
        try testImageData.write(to: testImageURL)

        // Set up storage directory manager with our test directory
        // Note: This requires mocking StorageDirectoryManager or using a test configuration

        // Create WKWebView with scheme handler
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(ImageSchemeHandler.shared, forURLScheme: ImageSchemeHandler.scheme)

        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 300, height: 300), configuration: configuration)

        // Create HTML that loads our image
        let html = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                img { width: 100px; height: 100px; background: gray; }
                img.loaded { border: 2px solid green; }
                img.error { border: 2px solid red; }
            </style>
        </head>
        <body>
            <img id="testImage" src="notecove://image/test-sd/\(imageId)">
            <script>
                var img = document.getElementById('testImage');
                img.onload = function() {
                    img.className = 'loaded';
                    window.webkit.messageHandlers.testHandler?.postMessage({status: 'loaded', width: img.naturalWidth, height: img.naturalHeight});
                };
                img.onerror = function() {
                    img.className = 'error';
                    window.webkit.messageHandlers.testHandler?.postMessage({status: 'error'});
                };
            </script>
        </body>
        </html>
        """

        // Load the HTML
        webView.loadHTMLString(html, baseURL: nil)

        // Wait for the page to load
        try await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds

        // Check if image loaded by evaluating JavaScript
        let result = try await webView.evaluateJavaScript("""
            (function() {
                var img = document.getElementById('testImage');
                return {
                    complete: img.complete,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    className: img.className
                };
            })()
        """)

        guard let imageInfo = result as? [String: Any] else {
            XCTFail("Failed to get image info from JavaScript")
            return
        }

        let naturalWidth = imageInfo["naturalWidth"] as? Int ?? 0
        let naturalHeight = imageInfo["naturalHeight"] as? Int ?? 0
        let className = imageInfo["className"] as? String ?? ""

        // A loaded image should have dimensions > 0
        XCTAssertGreaterThan(naturalWidth, 0, "Image should have natural width > 0 if loaded")
        XCTAssertGreaterThan(naturalHeight, 0, "Image should have natural height > 0 if loaded")
        XCTAssertEqual(className, "loaded", "Image should have 'loaded' class, not '\(className)'")
    }

    // MARK: - Helper Methods

    /// Create a simple test JPEG image data (1x1 red pixel)
    private func createTestJPEGData() -> Data {
        let size = CGSize(width: 10, height: 10)
        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { context in
            UIColor.red.setFill()
            context.fill(CGRect(origin: .zero, size: size))
        }
        return image.jpegData(compressionQuality: 0.9)!
    }

    /// Find an image file in a directory (mirrors ImageSchemeHandler logic)
    private func findImageFileInDirectory(_ mediaDir: URL, imageId: String) throws -> URL {
        let extensions = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"]

        for ext in extensions {
            let fileURL = mediaDir.appendingPathComponent("\(imageId).\(ext)")
            if FileManager.default.fileExists(atPath: fileURL.path) {
                return fileURL
            }
        }

        // Also check by scanning directory
        let contents = try FileManager.default.contentsOfDirectory(at: mediaDir, includingPropertiesForKeys: nil)
        for file in contents {
            let filename = file.deletingPathExtension().lastPathComponent
            if filename == imageId {
                return file
            }
        }

        throw NSError(domain: "ImageSchemeHandlerTests", code: 404, userInfo: [NSLocalizedDescriptionKey: "Image not found: \(imageId)"])
    }
}
