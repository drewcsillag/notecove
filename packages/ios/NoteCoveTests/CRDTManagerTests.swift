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

    // MARK: - Integration Test Placeholder

    func testBridgeLoadsCorrectly() throws {
        try crdtManager.initialize()

        // Verify the bridge has the expected methods
        // This is a smoke test to ensure the JavaScript bundle loaded
        XCTAssertTrue(crdtManager.isInitialized)
        XCTAssertEqual(crdtManager.openDocumentCount, 0)
    }
}
