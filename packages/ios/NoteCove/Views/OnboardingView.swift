import SwiftUI
import UniformTypeIdentifiers

/// Onboarding wizard for first-time setup
struct OnboardingView: View {
    @EnvironmentObject var appState: AppState
    @State private var showingFolderPicker = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            // App icon and title
            VStack(spacing: 16) {
                Image(systemName: "note.text")
                    .font(.system(size: 80))
                    .foregroundStyle(.blue)

                Text("Welcome to NoteCove")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                Text("Your notes, everywhere.")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // Setup instructions
            VStack(alignment: .leading, spacing: 16) {
                instructionRow(number: 1, text: "Choose a folder in iCloud Drive")
                instructionRow(number: 2, text: "Use the same folder as your desktop app")
                instructionRow(number: 3, text: "Your notes will sync automatically")
            }
            .padding(.horizontal, 40)

            Spacer()

            // Error message
            if let error = errorMessage {
                Text(error)
                    .foregroundStyle(.red)
                    .font(.callout)
                    .padding()
            }

            // Select folder button
            Button(action: { showingFolderPicker = true }) {
                Label("Select Folder", systemImage: "folder.badge.plus")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding()
            }
            .buttonStyle(.borderedProminent)
            .padding(.horizontal, 40)

            Spacer()
        }
        .fileImporter(
            isPresented: $showingFolderPicker,
            allowedContentTypes: [.folder],
            allowsMultipleSelection: false
        ) { result in
            handleFolderSelection(result)
        }
    }

    private func instructionRow(number: Int, text: String) -> some View {
        HStack(spacing: 16) {
            Text("\(number)")
                .font(.headline)
                .foregroundStyle(.white)
                .frame(width: 32, height: 32)
                .background(Circle().fill(.blue))

            Text(text)
                .font(.body)

            Spacer()
        }
    }

    private func handleFolderSelection(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else {
                errorMessage = "No folder selected"
                return
            }

            // Start accessing the security-scoped resource
            guard url.startAccessingSecurityScopedResource() else {
                errorMessage = "Cannot access this folder. Please try again."
                return
            }

            // Validate it looks like a NoteCove storage directory
            let sdIdURL = url.appendingPathComponent("SD_ID")
            if !FileManager.default.fileExists(atPath: sdIdURL.path) {
                url.stopAccessingSecurityScopedResource()
                errorMessage = "This doesn't appear to be a NoteCove storage directory. Please select a folder with SD_ID file."
                return
            }

            // Save the folder
            appState.setStorageDirectory(url)
            appState.completeOnboarding()
            url.stopAccessingSecurityScopedResource()

        case .failure(let error):
            errorMessage = "Failed to select folder: \(error.localizedDescription)"
        }
    }
}

#Preview {
    OnboardingView()
        .environmentObject(AppState())
}
