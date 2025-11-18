import XCTest

/// Base class for NoteCove UI tests
/// Provides common setup, teardown, and helper methods
class NoteCoveUITestBase: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false

        app = XCUIApplication()

        // Enable UI testing mode - app will reset state on launch
        app.launchArguments = ["-UITesting"]

        app.launch()
    }

    override func tearDownWithError() throws {
        // Terminate app to ensure clean state for next test
        app.terminate()
        app = nil
    }

    // MARK: - Helper Methods

    /// Wait for an element to exist with timeout
    func waitForElement(_ element: XCUIElement, timeout: TimeInterval = 5) -> Bool {
        let predicate = NSPredicate(format: "exists == true")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        let result = XCTWaiter.wait(for: [expectation], timeout: timeout)
        return result == .completed
    }

    /// Wait for an element to disappear
    func waitForElementToDisappear(_ element: XCUIElement, timeout: TimeInterval = 5) -> Bool {
        let predicate = NSPredicate(format: "exists == false")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        let result = XCTWaiter.wait(for: [expectation], timeout: timeout)
        return result == .completed
    }

    /// Tap on an element after waiting for it to exist
    func tapElement(_ element: XCUIElement, timeout: TimeInterval = 5) {
        XCTAssertTrue(waitForElement(element, timeout: timeout), "Element not found: \(element)")
        element.tap()
    }

    /// Type text into an element
    func typeText(_ text: String, into element: XCUIElement, timeout: TimeInterval = 5) {
        XCTAssertTrue(waitForElement(element, timeout: timeout), "Text field not found: \(element)")
        element.tap()
        element.typeText(text)
    }

    /// Clear text from a text field
    func clearText(from element: XCUIElement) {
        guard let stringValue = element.value as? String else {
            return
        }

        element.tap()

        // Delete all characters
        let deleteString = String(repeating: XCUIKeyboardKey.delete.rawValue, count: stringValue.count)
        element.typeText(deleteString)
    }

    /// Take a screenshot with a name
    func takeScreenshot(named name: String) {
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
