import Foundation

/// Manages the instance ID for this iOS client
/// The instance ID uniquely identifies this installation across all devices
/// and is used in CRDT update filenames to track which client wrote each update
final class InstanceIDManager: @unchecked Sendable {
    private let userDefaults: UserDefaults
    private let instanceIdKey = "com.notecove.instanceId"

    /// Shared instance
    static let shared = InstanceIDManager()

    /// Initialize with UserDefaults (mainly for testing)
    init(userDefaults: UserDefaults = .standard) {
        self.userDefaults = userDefaults
    }

    /// Get or create the instance ID for this device
    /// - Returns: UUID string identifying this iOS installation
    func getInstanceId() -> String {
        // Check if we already have an instance ID
        if let existingId = userDefaults.string(forKey: instanceIdKey) {
            return existingId
        }

        // Generate a new instance ID
        let newId = UUID().uuidString
        userDefaults.set(newId, forKey: instanceIdKey)

        print("[InstanceIDManager] Generated new instance ID: \(newId)")
        return newId
    }

    /// Reset the instance ID (mainly for testing)
    func resetInstanceId() {
        userDefaults.removeObject(forKey: instanceIdKey)
    }
}
