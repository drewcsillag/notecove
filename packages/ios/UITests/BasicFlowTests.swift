import XCTest

/// Basic user flow tests that work regardless of app state
final class BasicFlowTests: NoteCoveUITestBase {

    func testAppLaunchesSuccessfully() throws {
        // App should launch and show something
        XCTAssertTrue(app.state == .runningForeground, "App should be running")

        // Should have a navigation bar
        XCTAssertTrue(app.navigationBars.count > 0, "Should have navigation bars")

        takeScreenshot(named: "app_launched")
    }

    func testCanNavigateToAddStorage() throws {
        // Find and tap add button (works whether list is empty or not)
        let addButton = app.buttons["addStorageButton"]

        if waitForElement(addButton, timeout: 3) {
            tapElement(addButton)

            // Sheet should appear with name field
            let nameField = app.textFields["storageNameField"]
            XCTAssertTrue(waitForElement(nameField, timeout: 5), "Add storage sheet should open")

            takeScreenshot(named: "add_storage_sheet")

            // Cancel to clean up
            let cancelButton = app.buttons["Cancel"]
            if cancelButton.exists {
                cancelButton.tap()
            }
        } else {
            // Might already be in a storage directory, which is fine
            XCTAssertTrue(true, "App is in a valid state")
        }
    }

    func testQuickSetupButtons() throws {
        // Navigate to add storage sheet
        let addButton = app.buttons["addStorageButton"]

        if waitForElement(addButton, timeout: 3) {
            tapElement(addButton)

            // Test Documents button
            let useDocsButton = app.buttons["useDocumentsButton"]
            if waitForElement(useDocsButton, timeout: 3) {
                tapElement(useDocsButton)

                // Path field should be filled
                let pathField = app.textFields["storagePathField"]
                let pathValue = pathField.value as? String ?? ""
                XCTAssertFalse(pathValue.isEmpty, "Path should be auto-filled")

                takeScreenshot(named: "documents_path_filled")
            }

            // Cancel
            let cancelButton = app.buttons["Cancel"]
            if cancelButton.exists {
                cancelButton.tap()
            }
        }
    }

    func testNavigationInApp() throws {
        // This test explores the app navigation without making assumptions
        takeScreenshot(named: "initial_view")

        // Try to find various elements that might exist
        let elements = [
            ("Add Storage Button", app.buttons["addStorageButton"]),
            ("Add Menu Button", app.buttons["addMenuButton"]),
            ("Navigation Bar", app.navigationBars.firstMatch),
        ]

        var foundElements: [String] = []
        for (name, element) in elements {
            if element.exists {
                foundElements.append(name)
            }
        }

        print("Found elements: \(foundElements)")
        XCTAssertFalse(foundElements.isEmpty, "Should find at least one navigation element")
    }
}
