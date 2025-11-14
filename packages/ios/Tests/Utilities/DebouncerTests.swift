import XCTest
@testable import NoteCove

final class DebouncerTests: XCTestCase {
    var debouncer: Debouncer!

    override func setUp() {
        super.setUp()
    }

    override func tearDown() {
        debouncer?.cancel()
        debouncer = nil
        super.tearDown()
    }

    /// Test that a single debounced action executes after the delay
    func testSingleActionExecutes() {
        let expectation = XCTestExpectation(description: "Action executes after delay")
        debouncer = Debouncer(delay: 0.1)

        debouncer.debounce {
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 0.5)
    }

    /// Test that rapid calls only result in the last action executing
    func testRapidCallsOnlyExecuteLast() {
        let expectation = XCTestExpectation(description: "Only last action executes")
        expectation.expectedFulfillmentCount = 1
        expectation.assertForOverFulfill = true

        debouncer = Debouncer(delay: 0.2)
        var executionCount = 0
        var lastValue = 0

        // Fire multiple actions rapidly
        for i in 1...5 {
            debouncer.debounce {
                executionCount += 1
                lastValue = i
                expectation.fulfill()
            }
            Thread.sleep(forTimeInterval: 0.05) // 50ms between calls
        }

        wait(for: [expectation], timeout: 1.0)

        // Only the last action should have executed
        XCTAssertEqual(executionCount, 1, "Only one action should execute")
        XCTAssertEqual(lastValue, 5, "Last action should be the one that executed")
    }

    /// Test that cancel prevents the action from executing
    func testCancelPreventsExecution() {
        let expectation = XCTestExpectation(description: "Action should not execute")
        expectation.isInverted = true

        debouncer = Debouncer(delay: 0.1)

        debouncer.debounce {
            expectation.fulfill()
        }

        // Cancel immediately
        debouncer.cancel()

        wait(for: [expectation], timeout: 0.3)
    }

    /// Test that actions can be scheduled after cancellation
    func testActionAfterCancellation() {
        let expectation = XCTestExpectation(description: "Action executes after cancellation")

        debouncer = Debouncer(delay: 0.1)

        // Schedule and cancel first action
        debouncer.debounce {
            XCTFail("This action should not execute")
        }
        debouncer.cancel()

        // Schedule second action
        debouncer.debounce {
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 0.5)
    }

    /// Test that the delay actually waits the specified time
    func testDelayTiming() {
        let expectation = XCTestExpectation(description: "Action executes after correct delay")
        let delay: TimeInterval = 0.2

        debouncer = Debouncer(delay: delay)

        let startTime = Date()
        var executionTime: Date?

        debouncer.debounce {
            executionTime = Date()
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 1.0)

        guard let executionTime = executionTime else {
            XCTFail("Action did not execute")
            return
        }

        let actualDelay = executionTime.timeIntervalSince(startTime)

        // Allow some tolerance for system scheduling
        XCTAssertGreaterThanOrEqual(actualDelay, delay, "Should wait at least the specified delay")
        XCTAssertLessThan(actualDelay, delay + 0.1, "Should not wait significantly longer than delay")
    }

    /// Test multiple debouncers work independently
    func testMultipleDebouncersIndependent() {
        let expectation1 = XCTestExpectation(description: "First debouncer executes")
        let expectation2 = XCTestExpectation(description: "Second debouncer executes")

        let debouncer1 = Debouncer(delay: 0.1)
        let debouncer2 = Debouncer(delay: 0.15)

        debouncer1.debounce {
            expectation1.fulfill()
        }

        debouncer2.debounce {
            expectation2.fulfill()
        }

        wait(for: [expectation1, expectation2], timeout: 0.5)

        debouncer1.cancel()
        debouncer2.cancel()
    }

    /// Test zero delay executes immediately
    func testZeroDelayExecutesImmediately() {
        let expectation = XCTestExpectation(description: "Action executes immediately")

        debouncer = Debouncer(delay: 0)

        let startTime = Date()
        var executionTime: Date?

        debouncer.debounce {
            executionTime = Date()
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 0.2)

        guard let executionTime = executionTime else {
            XCTFail("Action did not execute")
            return
        }

        let actualDelay = executionTime.timeIntervalSince(startTime)

        // Should execute very quickly (within 50ms)
        XCTAssertLessThan(actualDelay, 0.05, "Zero delay should execute almost immediately")
    }
}
