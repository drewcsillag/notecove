import SwiftUI

@main
struct NoteCoveApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
        }
    }
}

/// Global application state
class AppState: ObservableObject {
    /// Whether onboarding has been completed
    @Published var hasCompletedOnboarding: Bool = false

    /// The current storage directory path (from security-scoped bookmark)
    @Published var storageDirectoryURL: URL?

    /// Instance ID for this device (for CRDT vector clocks)
    @Published var instanceId: String

    init() {
        // Load or generate instance ID
        if let savedId = UserDefaults.standard.string(forKey: "instanceId") {
            self.instanceId = savedId
        } else {
            let newId = UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(12).lowercased()
            self.instanceId = String(newId)
            UserDefaults.standard.set(self.instanceId, forKey: "instanceId")
        }

        // Check if onboarding completed
        self.hasCompletedOnboarding = UserDefaults.standard.bool(forKey: "hasCompletedOnboarding")

        // Try to restore storage directory from bookmark
        if let bookmarkData = UserDefaults.standard.data(forKey: "storageDirectoryBookmark") {
            do {
                var isStale = false
                let url = try URL(resolvingBookmarkData: bookmarkData,
                                  options: .withoutUI,
                                  relativeTo: nil,
                                  bookmarkDataIsStale: &isStale)
                if !isStale {
                    self.storageDirectoryURL = url
                }
            } catch {
                print("Failed to restore storage directory bookmark: \(error)")
            }
        }
    }

    /// Save the storage directory URL as a security-scoped bookmark
    func setStorageDirectory(_ url: URL) {
        do {
            let bookmarkData = try url.bookmarkData(options: .minimalBookmark,
                                                     includingResourceValuesForKeys: nil,
                                                     relativeTo: nil)
            UserDefaults.standard.set(bookmarkData, forKey: "storageDirectoryBookmark")
            self.storageDirectoryURL = url
        } catch {
            print("Failed to create bookmark for storage directory: \(error)")
        }
    }

    /// Mark onboarding as complete
    func completeOnboarding() {
        hasCompletedOnboarding = true
        UserDefaults.standard.set(true, forKey: "hasCompletedOnboarding")
    }
}
