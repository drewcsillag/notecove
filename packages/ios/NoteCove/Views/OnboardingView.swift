import SwiftUI
import UniformTypeIdentifiers

/// Onboarding wizard for first-time setup
struct OnboardingView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var storageManager: StorageDirectoryManager
    @State private var showingFolderPicker = false
    @State private var errorMessage: String?
    @State private var isProcessing = false

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
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            // Stale bookmark message
            if case .bookmarkStale = storageManager.accessError {
                VStack(spacing: 8) {
                    Text("Your previous folder access has expired.")
                        .foregroundStyle(.orange)
                        .font(.callout)
                    Text("Please select your NoteCove folder again.")
                        .foregroundStyle(.secondary)
                        .font(.caption)
                }
                .padding(.horizontal)
            }

            // Select folder button
            Button(action: { showingFolderPicker = true }) {
                if isProcessing {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .frame(maxWidth: .infinity)
                        .padding()
                } else {
                    Label("Select Folder", systemImage: "folder.badge.plus")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isProcessing)
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
        isProcessing = true
        errorMessage = nil

        switch result {
        case .success(let urls):
            guard let url = urls.first else {
                errorMessage = "No folder selected"
                isProcessing = false
                return
            }

            do {
                try storageManager.setActiveDirectory(from: url)
                appState.completeOnboarding()
            } catch let error as StorageDirectoryError {
                errorMessage = error.errorDescription
            } catch {
                errorMessage = "Failed to access folder: \(error.localizedDescription)"
            }
            isProcessing = false

        case .failure(let error):
            errorMessage = "Failed to select folder: \(error.localizedDescription)"
            isProcessing = false
        }
    }
}

#Preview {
    OnboardingView()
        .environmentObject(AppState())
        .environmentObject(StorageDirectoryManager.shared)
}
