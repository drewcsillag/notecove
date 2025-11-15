import XCTest

/// Tests for app launch and initial state
final class AppLaunchTests: NoteCoveUITestBase {

    func testAppLaunches() throws {
        // Verify the app launched successfully
        XCTAssertTrue(app.state == .runningForeground)

        // Take a screenshot of the initial state
        takeScreenshot(named: "app_launch")
    }

    func testStorageDirectoryListDisplays() throws {
        // The app should show the storage directory list on launch
        let navBar = app.navigationBars["Storage Directories"]
        XCTAssertTrue(waitForElement(navBar), "Storage Directories navigation bar should be visible")

        // Should have an add button
        let addButton = app.buttons["Add"]
        XCTAssertTrue(addButton.exists, "Add button should exist")
    }
}
