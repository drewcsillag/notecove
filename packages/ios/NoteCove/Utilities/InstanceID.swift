import Foundation

/// Manages the unique instance ID for this device
/// Used to identify CRDT updates from this device
@MainActor
final class InstanceID {
    static let shared = InstanceID()

    private let userDefaultsKey = "NoteCove.InstanceID"

    private init() {}

    /// Get or create the instance ID for this device
    var id: String {
        if let existing = UserDefaults.standard.string(forKey: userDefaultsKey) {
            return existing
        }

        // Generate new instance ID
        // Format: ios-<8 hex chars>-<timestamp>
        let randomPart = String(format: "%08x", arc4random())
        let timestamp = Int(Date().timeIntervalSince1970)
        let newId = "ios-\(randomPart)-\(timestamp)"

        UserDefaults.standard.set(newId, forKey: userDefaultsKey)
        return newId
    }

    /// Reset the instance ID (for testing)
    func reset() {
        UserDefaults.standard.removeObject(forKey: userDefaultsKey)
    }
}
