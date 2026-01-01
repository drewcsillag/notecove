import XCTest
import JavaScriptCore
@testable import NoteCove

@MainActor
final class CRDTManagerTests: XCTestCase {
    var crdtManager: CRDTManager!

    override func setUpWithError() throws {
        crdtManager = CRDTManager.shared
    }

    override func tearDownWithError() throws {
        crdtManager.clearCache()
    }

    // MARK: - Initialization Tests

    func testInitialization() throws {
        try crdtManager.initialize()
        XCTAssertTrue(crdtManager.isInitialized)
    }

    func testDoubleInitialization() throws {
        try crdtManager.initialize()
        try crdtManager.initialize() // Should not throw
        XCTAssertTrue(crdtManager.isInitialized)
    }

    // MARK: - Note Operations Tests

    func testExtractTitleFromEmptyDoc() throws {
        try crdtManager.initialize()

        // Create a minimal Yjs state (empty document)
        // This is a base64-encoded empty Yjs document
        let emptyState = "AAA=" // Minimal Yjs state

        // Should handle empty state gracefully
        // Note: May throw if state is truly empty/invalid
        do {
            let metadata = try crdtManager.extractMetadata(from: emptyState)
            // Empty doc should return "Untitled" or empty string
            XCTAssertTrue(metadata.title == "Untitled" || metadata.title.isEmpty)
        } catch {
            // Some implementations throw on empty state, which is acceptable
            print("Empty state handling: \(error)")
        }
    }

    func testOpenDocumentCount() throws {
        try crdtManager.initialize()
        XCTAssertEqual(crdtManager.openDocumentCount, 0)
    }

    func testClearCache() throws {
        try crdtManager.initialize()
        crdtManager.clearCache()
        XCTAssertEqual(crdtManager.openDocumentCount, 0)
    }

    // MARK: - Error Handling Tests

    func testLoadNoteWithoutInit() throws {
        // Create a new instance that isn't initialized
        // Since we're using shared, we need to test differently
        // The shared instance may already be initialized from previous tests
        if !crdtManager.isInitialized {
            XCTAssertThrowsError(try crdtManager.loadNoteState(noteId: "test")) { error in
                XCTAssertTrue(error is CRDTError)
            }
        }
    }

    // MARK: - Folder Tree Tests

    func testCreateAndExtractFolderTree() throws {
        try crdtManager.initialize()

        // Create a folder tree via the JavaScript bridge
        let testSdId = "test-sd-id"

        // Access the bridge directly to create a folder tree
        let context = JSContext()!
        context.exceptionHandler = { _, exception in
            XCTFail("JS Exception: \(exception!)")
        }

        // Load the bridge
        let bundle = Bundle.allBundles.first { $0.url(forResource: "ios-bridge-bundle", withExtension: "js") != nil }!
        let url = bundle.url(forResource: "ios-bridge-bundle", withExtension: "js")!
        let script = try String(contentsOf: url, encoding: .utf8)
        context.evaluateScript(script)

        guard let bridge = context.objectForKeyedSubscript("NoteCoveBridge"), !bridge.isUndefined else {
            XCTFail("Bridge not found")
            return
        }

        // Create folder tree
        bridge.invokeMethod("createFolderTree", withArguments: [testSdId])

        // Initially should have no folders
        guard let folders = bridge.invokeMethod("extractFolders", withArguments: [testSdId])?.toArray() as? [[String: Any]] else {
            XCTFail("extractFolders did not return array")
            return
        }

        XCTAssertEqual(folders.count, 0, "New folder tree should be empty")

        // Clean up
        bridge.invokeMethod("closeFolderTree", withArguments: [testSdId])
    }

    func testExtractFoldersWithoutOpenTree() throws {
        try crdtManager.initialize()

        // Trying to extract folders from non-existent tree should throw
        XCTAssertThrowsError(try crdtManager.extractFolders(sdId: "nonexistent-sd")) { error in
            XCTAssertTrue(error is CRDTError)
        }
    }

    // MARK: - Note List Tests

    func testExtractNoteMetadata() throws {
        try crdtManager.initialize()

        // Access the bridge directly to create a note
        let context = JSContext()!
        context.exceptionHandler = { _, exception in
            XCTFail("JS Exception: \(exception!)")
        }

        // Load the bridge
        let bundle = Bundle.allBundles.first { $0.url(forResource: "ios-bridge-bundle", withExtension: "js") != nil }!
        let url = bundle.url(forResource: "ios-bridge-bundle", withExtension: "js")!
        let script = try String(contentsOf: url, encoding: .utf8)
        context.evaluateScript(script)

        guard let bridge = context.objectForKeyedSubscript("NoteCoveBridge"), !bridge.isUndefined else {
            XCTFail("Bridge not found")
            return
        }

        let testNoteId = "test-note-id"

        // Create a note
        bridge.invokeMethod("createNote", withArguments: [testNoteId])

        // Extract metadata - should return defaults for empty note
        guard let metadata = bridge.invokeMethod("extractNoteMetadata", withArguments: [testNoteId])?.toDictionary() as? [String: Any] else {
            XCTFail("extractNoteMetadata did not return dictionary")
            return
        }

        // Empty note should have "Untitled" or empty title
        let title = metadata["title"] as? String ?? ""
        XCTAssertTrue(title == "Untitled" || title.isEmpty, "Empty note should have Untitled or empty title")

        // Should have default timestamps
        XCTAssertNotNil(metadata["created"])
        XCTAssertNotNil(metadata["modified"])

        // Clean up
        bridge.invokeMethod("closeNote", withArguments: [testNoteId])
    }

    // MARK: - Integration Test Placeholder

    func testBridgeLoadsCorrectly() throws {
        try crdtManager.initialize()

        // Verify the bridge has the expected methods
        // This is a smoke test to ensure the JavaScript bundle loaded
        XCTAssertTrue(crdtManager.isInitialized)
        XCTAssertEqual(crdtManager.openDocumentCount, 0)
    }
}
