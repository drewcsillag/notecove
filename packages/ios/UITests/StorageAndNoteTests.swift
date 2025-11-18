import XCTest

/// Comprehensive tests for storage directory and note management
final class StorageAndNoteTests: NoteCoveUITestBase {

    func testCompleteNoteCreationFlow() throws {
        // This test works from any starting state and tests the full flow
        takeScreenshot(named: "flow_start")

        // Navigate to a folder list view where we can create notes
        ensureInFolderListView()

        // Verify we can open the add menu
        let menuButton = app.buttons["addMenuButton"]
        XCTAssertTrue(menuButton.exists, "Should have add menu in folder list")

        // Create a note
        tapElement(menuButton)
        let newNoteButton = app.buttons["newNoteButton"]
        XCTAssertTrue(waitForElement(newNoteButton, timeout: 2), "New note button should appear")
        tapElement(newNoteButton)

        // Wait for editor to load
        sleep(2)
        takeScreenshot(named: "note_editor_opened")

        // Verify we're in editor by checking for navigation bar
        let navBar = app.navigationBars.element
        XCTAssertTrue(navBar.exists, "Should be in editor view")

        // Go back to note list
        let backButton = app.navigationBars.buttons.element(boundBy: 0)
        if backButton.exists {
            tapElement(backButton)
            sleep(1)
        }

        // Verify note appears in list (should show "Untitled")
        let untitledNote = app.staticTexts["Untitled"]
        XCTAssertTrue(
            waitForElement(untitledNote, timeout: 3),
            "Note should appear in list with Untitled"
        )

        takeScreenshot(named: "note_in_list")
    }

    func testCreateFolderFlow() throws {
        // Navigate to folder list
        ensureInFolderListView()

        // Open add menu
        let menuButton = app.buttons["addMenuButton"]
        tapElement(menuButton)

        // Tap new folder
        let newFolderButton = app.buttons["newFolderButton"]
        XCTAssertTrue(waitForElement(newFolderButton, timeout: 2), "New folder button should appear")
        tapElement(newFolderButton)

        // Wait for folder sheet
        sleep(1)
        takeScreenshot(named: "folder_sheet")

        // Enter unique folder name with timestamp
        let timestamp = Int(Date().timeIntervalSince1970)
        let folderName = "TestFolder\(timestamp)"

        let folderNameField = app.textFields.element(boundBy: 0)
        tapElement(folderNameField)
        folderNameField.typeText(folderName)

        // Create folder
        let createButton = app.buttons["Create"]
        XCTAssertTrue(createButton.exists, "Create button should exist")
        tapElement(createButton)

        // Folder should appear in list
        sleep(1)
        let folderCell = app.staticTexts[folderName]
        XCTAssertTrue(
            waitForElement(folderCell, timeout: 3),
            "Folder '\(folderName)' should appear in list"
        )

        takeScreenshot(named: "folder_created")
    }

    func testStorageDirectoryCreation() throws {
        // Find or create path to storage list
        navigateToStorageList()

        // Open add storage sheet
        let addButton = app.buttons["addStorageButton"]
        XCTAssertTrue(addButton.exists, "Add storage button should exist on storage list")
        tapElement(addButton)

        // Wait for sheet
        let nameField = app.textFields["storageNameField"]
        XCTAssertTrue(waitForElement(nameField, timeout: 3), "Add storage sheet should open")

        takeScreenshot(named: "add_storage_sheet")

        // Use Documents button
        let useDocsButton = app.buttons["useDocumentsButton"]
        XCTAssertTrue(useDocsButton.exists, "Use documents button should exist")
        tapElement(useDocsButton)

        // Verify path was filled
        sleep(1)
        let pathField = app.textFields["storagePathField"]
        let pathValue = pathField.value as? String ?? ""
        XCTAssertFalse(pathValue.isEmpty, "Path should be auto-filled")

        takeScreenshot(named: "storage_path_filled")

        // Cancel to avoid creating more storage directories
        let cancelButton = app.buttons["Cancel"]
        if cancelButton.exists {
            tapElement(cancelButton)
        }
    }

    // MARK: - Helper Methods

    /// Ensures we're in a folder list view where we can create notes/folders
    private func ensureInFolderListView() {
        let menuButton = app.buttons["addMenuButton"]

        if menuButton.exists {
            // Already in folder list
            return
        }

        // Need to navigate to folder list
        let addStorageButton = app.buttons["addStorageButton"]

        if addStorageButton.exists {
            // We're on storage list, need to either create storage or open existing
            let cells = app.cells

            if cells.count > 0 {
                // Tap first storage directory
                cells.element(boundBy: 0).tap()
                sleep(2)
            } else {
                // Need to create storage first
                createTestStorage()
                sleep(2)

                // Now tap it to open
                if cells.count > 0 {
                    cells.element(boundBy: 0).tap()
                    sleep(2)
                }
            }
        }

        // Verify we made it to folder list
        XCTAssertTrue(
            waitForElement(menuButton, timeout: 3),
            "Should be in folder list view with add menu"
        )
    }

    /// Navigates to the storage directory list
    private func navigateToStorageList() {
        let addStorageButton = app.buttons["addStorageButton"]

        if addStorageButton.exists {
            // Already on storage list
            return
        }

        // Try to go back to storage list
        var attempts = 0
        while !addStorageButton.exists && attempts < 5 {
            let backButton = app.navigationBars.buttons.element(boundBy: 0)
            if backButton.exists {
                backButton.tap()
                sleep(1)
                attempts += 1
            } else {
                break
            }
        }

        XCTAssertTrue(
            addStorageButton.exists,
            "Should be able to navigate to storage list"
        )
    }

    /// Creates a test storage directory
    private func createTestStorage() {
        let addButton = app.buttons["addStorageButton"]
        tapElement(addButton)

        let useDocsButton = app.buttons["useDocumentsButton"]
        XCTAssertTrue(waitForElement(useDocsButton, timeout: 5), "Add storage sheet should open")
        tapElement(useDocsButton)
        sleep(1)

        let confirmButton = app.buttons["addStorageConfirmButton"]
        tapElement(confirmButton)
        sleep(2)
    }
}
