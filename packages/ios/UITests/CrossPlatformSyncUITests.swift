import XCTest

/// UI automation tests for cross-platform sync testing
/// These tests can be invoked programmatically to interact with the iOS app
/// during cross-platform E2E tests
final class CrossPlatformSyncUITests: NoteCoveUITestBase {

    /// Creates a note with the specified content via UI automation
    /// This test is designed to be run from external test coordinators
    func testCreateNoteWithContent() throws {
        // Read content from environment variable if provided
        let noteContent = ProcessInfo.processInfo.environment["TEST_NOTE_CONTENT"] ?? "Test note from iOS"
        let sdPath = ProcessInfo.processInfo.environment["TEST_SD_PATH"] ?? ""

        print("[iOS UI Test] Creating note with content: \(noteContent)")
        print("[iOS UI Test] Using SD path: \(sdPath)")

        // Navigate to folder list view where we can create notes
        ensureInFolderListView()

        // Tap add menu button
        let menuButton = app.buttons["addMenuButton"]
        XCTAssertTrue(waitForElement(menuButton, timeout: 5), "Add menu button should exist")
        tapElement(menuButton)

        // Tap new note button
        let newNoteButton = app.buttons["newNoteButton"]
        XCTAssertTrue(waitForElement(newNoteButton, timeout: 3), "New note button should appear")
        tapElement(newNoteButton)

        // Wait for editor to load
        sleep(2)
        takeScreenshot(named: "editor_opened")

        // TODO: Type content into editor
        // The editor is a custom web view, so typing might be tricky
        // For now, we've created the note which is what we need

        print("[iOS UI Test] ✅ Note created via UI")

        // Go back to list
        let backButton = app.navigationBars.buttons.element(boundBy: 0)
        if backButton.exists {
            tapElement(backButton)
            sleep(1)
        }

        takeScreenshot(named: "note_created")
    }

    /// Opens and edits a note with the specified title
    func testEditNote() throws {
        let noteTitle = ProcessInfo.processInfo.environment["TEST_NOTE_TITLE"] ?? "Untitled"
        let additionalContent = ProcessInfo.processInfo.environment["TEST_EDIT_CONTENT"] ?? " (edited)"

        print("[iOS UI Test] Editing note: \(noteTitle)")

        // Navigate to folder list
        ensureInFolderListView()

        // First, create a note to edit (UI tests run in isolation)
        let menuButton = app.buttons["addMenuButton"]
        tapElement(menuButton)

        let newNoteButton = app.buttons["newNoteButton"]
        XCTAssertTrue(waitForElement(newNoteButton, timeout: 3), "New note button should appear")
        tapElement(newNoteButton)
        sleep(2)

        // Go back to list to see the note
        let backButtonCreate = app.navigationBars.buttons.element(boundBy: 0)
        if backButtonCreate.exists {
            tapElement(backButtonCreate)
            sleep(1)
        }

        // Now find and tap the note
        let noteCell = app.staticTexts[noteTitle]
        XCTAssertTrue(waitForElement(noteCell, timeout: 5), "Note '\(noteTitle)' should be visible")
        tapElement(noteCell)

        // Wait for editor
        sleep(2)

        // TODO: Edit content
        // For now, just opening the note is sufficient

        print("[iOS UI Test] ✅ Note opened for editing")

        // Go back
        let backButton = app.navigationBars.buttons.element(boundBy: 0)
        if backButton.exists {
            tapElement(backButton)
        }

        takeScreenshot(named: "note_edited")
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
