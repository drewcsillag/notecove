import XCTest

final class NoteCoveUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    override func tearDownWithError() throws {
    }

    func testLaunchPerformance() throws {
        measure(metrics: [XCTApplicationLaunchMetric()]) {
            XCUIApplication().launch()
        }
    }

    func testOnboardingAppears() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--reset-state"]
        app.launch()

        // Verify onboarding screen appears
        XCTAssertTrue(app.staticTexts["Welcome to NoteCove"].exists)
        XCTAssertTrue(app.buttons["Select Folder"].exists)
    }
}
