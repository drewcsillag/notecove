import XCTest
@testable import NoteCove

final class InstanceIDManagerTests: XCTestCase {
    var userDefaults: UserDefaults!
    var manager: InstanceIDManager!

    override func setUp() {
        super.setUp()
        // Use a test suite name to avoid conflicts with app defaults
        userDefaults = UserDefaults(suiteName: "InstanceIDManagerTests-\(UUID().uuidString)")!
        manager = InstanceIDManager(userDefaults: userDefaults)
    }

    override func tearDown() {
        if let suiteName = userDefaults.dictionaryRepresentation().keys.first {
            userDefaults.removePersistentDomain(forName: suiteName)
        }
        userDefaults = nil
        manager = nil
        super.tearDown()
    }

    func testGetInstanceIdGeneratesNewId() {
        // When: Getting instance ID for the first time
        let instanceId = manager.getInstanceId()

        // Then: Should generate a valid UUID
        XCTAssertFalse(instanceId.isEmpty)
        XCTAssertNotNil(UUID(uuidString: instanceId), "Should be a valid UUID")
    }

    func testGetInstanceIdReturnsSameIdOnSubsequentCalls() {
        // Given: First call generates an ID
        let firstId = manager.getInstanceId()

        // When: Getting instance ID again
        let secondId = manager.getInstanceId()

        // Then: Should return the same ID
        XCTAssertEqual(firstId, secondId)
    }

    func testGetInstanceIdPersistsAcrossInstances() {
        // Given: First instance generates an ID
        let firstId = manager.getInstanceId()

        // When: Creating a new manager instance with same UserDefaults
        let newManager = InstanceIDManager(userDefaults: userDefaults)
        let secondId = newManager.getInstanceId()

        // Then: Should return the same ID
        XCTAssertEqual(firstId, secondId)
    }

    func testResetInstanceId() {
        // Given: Instance has an ID
        let firstId = manager.getInstanceId()

        // When: Resetting the instance ID
        manager.resetInstanceId()
        let secondId = manager.getInstanceId()

        // Then: Should generate a new ID
        XCTAssertNotEqual(firstId, secondId)
    }
}
