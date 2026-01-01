import SwiftUI

@main
struct NoteCoveApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var storageManager = StorageDirectoryManager.shared
    @Environment(\.scenePhase) private var scenePhase

    init() {
        // Initialize sync monitor to set up lifecycle observers
        _ = SyncMonitor.shared
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(storageManager)
                .onChange(of: scenePhase) { _, newPhase in
                    handleScenePhaseChange(newPhase)
                }
                .onAppear {
                    // Restore storage directory access on launch
                    storageManager.restoreAccess()
                }
        }
    }

    private func handleScenePhaseChange(_ phase: ScenePhase) {
        switch phase {
        case .active:
            // Resume access when app becomes active
            storageManager.resumeAccess()
        case .inactive:
            // Keep access during brief inactive periods
            break
        case .background:
            // Release security-scoped resource access in background
            storageManager.releaseAccess()
        @unknown default:
            break
        }
    }
}

/// Global application state
@MainActor
class AppState: ObservableObject {
    /// Whether onboarding has been completed
    @Published var hasCompletedOnboarding: Bool = false

    /// Instance ID for this device (for CRDT vector clocks)
    var instanceId: String {
        InstanceID.shared.id
    }

    /// Reset argument for testing
    private let shouldResetState: Bool

    init() {
        // Check for reset argument (for UI testing)
        shouldResetState = CommandLine.arguments.contains("--reset-state")

        if shouldResetState {
            // Clear all state for testing
            InstanceID.shared.reset()
            UserDefaults.standard.removeObject(forKey: "hasCompletedOnboarding")
            UserDefaults.standard.removeObject(forKey: "activeStorageDirectoryId")
        }

        // Check if onboarding completed
        if !shouldResetState {
            self.hasCompletedOnboarding = UserDefaults.standard.bool(forKey: "hasCompletedOnboarding")
        }
    }

    /// Mark onboarding as complete
    func completeOnboarding() {
        hasCompletedOnboarding = true
        UserDefaults.standard.set(true, forKey: "hasCompletedOnboarding")
    }

    /// Reset onboarding state (for re-selecting folder)
    func resetOnboarding() {
        hasCompletedOnboarding = false
        UserDefaults.standard.set(false, forKey: "hasCompletedOnboarding")
        StorageDirectoryManager.shared.clearActiveDirectory()
    }
}
