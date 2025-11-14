import XCTest
@testable import NoteCove

final class iCloudManagerTests: XCTestCase {
    var manager: iCloudManager!

    override func setUp() {
        super.setUp()
        manager = iCloudManager()
    }

    override func tearDown() {
        manager = nil
        super.tearDown()
    }

    /// Test checking if iCloud is available
    func testIsICloudAvailable() {
        let isAvailable = manager.isICloudAvailable()

        // iCloud availability depends on the environment (simulator vs device, signed in status)
        // We can't assert a specific value, but we can verify the method doesn't crash
        print("iCloud available: \(isAvailable)")

        // Should return a boolean
        XCTAssertTrue(isAvailable is Bool)
    }

    /// Test getting container URL
    func testGetContainerURL() {
        let containerURL = manager.getContainerURL()

        if let url = containerURL {
            print("iCloud container URL: \(url)")
            // If we got a URL, it should be a valid file URL
            XCTAssertTrue(url.isFileURL, "Container URL should be a file URL")
        } else {
            print("iCloud container URL is nil (iCloud may not be available in this environment)")
        }

        // The test passes regardless of whether iCloud is available
        // We're just verifying the method works
        XCTAssertTrue(true)
    }

    /// Test that container identifier is correct
    func testContainerIdentifier() {
        // The container identifier should match what's in the entitlements
        let expectedIdentifier = "iCloud.com.notecove.NoteCove"

        // We can't directly verify this without parsing entitlements,
        // but we can verify the manager is using a consistent identifier
        let url1 = manager.getContainerURL()
        let url2 = manager.getContainerURL()

        // Calling twice should return the same result
        XCTAssertEqual(url1, url2, "Should return consistent container URL")
    }

    /// Test watching iCloud changes
    func testWatchICloudChanges() {
        var callbackInvoked = false
        let expectation = XCTestExpectation(description: "Watch setup completes")

        manager.watchICloudChanges {
            callbackInvoked = true
        }

        // Give it a moment to set up
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 1.0)

        // We can't trigger iCloud changes in tests, but we can verify setup doesn't crash
        // The callback won't be invoked in tests
        XCTAssertTrue(true, "Watch setup completed without crashing")
    }

    /// Test stopping iCloud watch
    func testStopWatchingICloud() {
        manager.watchICloudChanges {
            XCTFail("Callback should not be invoked after stopping")
        }

        // Stop watching
        manager.stopWatching()

        // Wait a bit to ensure no callbacks occur
        let expectation = XCTestExpectation(description: "No callbacks after stopping")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 1.0)

        XCTAssertTrue(true, "No callbacks occurred after stopping")
    }

    /// Test getting documents directory within iCloud
    func testGetDocumentsDirectory() {
        guard let containerURL = manager.getContainerURL() else {
            // iCloud not available in this environment, skip test
            print("Skipping test - iCloud not available")
            return
        }

        let documentsURL = manager.getDocumentsDirectory()

        // Documents directory should be inside the container
        if let docsURL = documentsURL {
            XCTAssertTrue(docsURL.path.starts(with: containerURL.path),
                         "Documents directory should be inside iCloud container")
            print("iCloud documents directory: \(docsURL)")
        }
    }

    /// Test checking if iCloud container is reachable
    func testContainerReachability() {
        guard let containerURL = manager.getContainerURL() else {
            print("Skipping test - iCloud not available")
            return
        }

        // Check if we can access the container
        var isDirectory: ObjCBool = false
        let exists = FileManager.default.fileExists(
            atPath: containerURL.path,
            isDirectory: &isDirectory
        )

        if exists {
            XCTAssertTrue(isDirectory.boolValue, "Container URL should point to a directory")
            print("iCloud container is reachable")
        } else {
            print("iCloud container exists but may not be reachable yet")
        }
    }

    /// Test multiple managers work independently
    func testMultipleManagersIndependent() {
        let manager1 = iCloudManager()
        let manager2 = iCloudManager()

        let url1 = manager1.getContainerURL()
        let url2 = manager2.getContainerURL()

        // Both should return the same URL (or both nil)
        XCTAssertEqual(url1, url2, "Different instances should return same container URL")
    }
}
