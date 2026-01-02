import SwiftUI

/// View showing sync progress when first loading notes from a storage directory
struct SyncProgressView: View {
    @ObservedObject var syncService: BackgroundSyncService
    var onContinue: (() -> Void)?

    var body: some View {
        VStack(spacing: 24) {
            Text("Syncing your notes...")
                .font(.title2)
                .fontWeight(.semibold)

            progressContent

            if case .syncing(let progress) = syncService.syncState,
               progress.isDownloadingFromCloud {
                cloudDownloadMessage
            }

            if showContinueButton {
                Button("Continue in background") {
                    onContinue?()
                }
                .buttonStyle(.bordered)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var progressContent: some View {
        switch syncService.syncState {
        case .notStarted:
            ProgressView()

        case .syncing(let progress):
            VStack(spacing: 12) {
                ProgressView(value: progress.fractionComplete)
                    .progressViewStyle(.linear)
                    .frame(width: 250)

                Text("\(progress.syncedNotes)/\(progress.totalNotes)")
                    .font(.headline)
                    .monospacedDigit()
            }

        case .complete:
            VStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.largeTitle)
                    .foregroundStyle(.green)
                Text("Sync complete")
                    .font(.headline)
            }

        case .pendingDownloads(let count):
            VStack(spacing: 8) {
                Image(systemName: "icloud.and.arrow.down")
                    .font(.largeTitle)
                    .foregroundStyle(.blue)
                Text("\(count) note\(count == 1 ? "" : "s") downloading from iCloud")
                    .font(.headline)
                Text("Notes will appear as they sync")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var cloudDownloadMessage: some View {
        HStack(spacing: 8) {
            Image(systemName: "icloud.and.arrow.down")
                .foregroundStyle(.blue)
            Text("Downloading from iCloud - this may take some time")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var showContinueButton: Bool {
        switch syncService.syncState {
        case .syncing(let progress) where progress.fractionComplete > 0.1:
            return true
        case .pendingDownloads:
            return true
        default:
            return false
        }
    }
}

#Preview("Syncing") {
    let service = BackgroundSyncService.shared
    return SyncProgressView(syncService: service)
}
