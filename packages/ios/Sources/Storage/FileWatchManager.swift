import Foundation

/// Manages file system watching for a directory, detecting changes and notifying via callbacks.
///
/// Uses DispatchSource to monitor file system events efficiently without polling. Supports debouncing
/// to handle rapid changes gracefully and reduce unnecessary processing.
///
/// Example usage:
/// ```swift
/// let watcher = FileWatchManager()
/// watcher.watchDirectory(path: "/path/to/notes") {
///     print("Files changed, refresh database")
/// }
///
/// // Later, when done:
/// watcher.stopWatching()
/// ```
public class FileWatchManager {
    private var dispatchSource: DispatchSourceFileSystemObject?
    private var fileDescriptor: Int32?
    private let queue = DispatchQueue(label: "com.notecove.filewatcher", qos: .utility)
    private var debouncer: Debouncer?
    private var isWatching = false

    /// Creates a new file watch manager
    public init() {}

    /// Starts watching a directory for file system changes
    ///
    /// - Parameters:
    ///   - path: The absolute path to the directory to watch
    ///   - debounceInterval: Time interval to debounce rapid changes (default: 0.5 seconds)
    ///   - onChange: Callback invoked when changes are detected (after debounce period)
    public func watchDirectory(
        path: String,
        debounceInterval: TimeInterval = 0.5,
        onChange: @escaping () -> Void
    ) {
        // Stop any existing watch first
        stopWatching()

        // Verify directory exists
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory),
              isDirectory.boolValue else {
            print("[FileWatchManager] Directory does not exist or is not a directory: \(path)")
            return
        }

        // Open the directory for monitoring
        let fd = open(path, O_EVTONLY)
        guard fd >= 0 else {
            print("[FileWatchManager] Failed to open directory for watching: \(path)")
            return
        }

        fileDescriptor = fd

        // Create a dispatch source to monitor file system events
        let source = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: fd,
            eventMask: [.write, .extend, .delete, .rename],
            queue: queue
        )

        // Create debouncer for the onChange callback
        debouncer = Debouncer(delay: debounceInterval, queue: .main)

        // Set up the event handler
        source.setEventHandler { [weak self] in
            guard let self = self else { return }

            // Debounce the callback to avoid excessive updates
            self.debouncer?.debounce {
                onChange()
            }
        }

        // Set up the cancellation handler to clean up the file descriptor
        source.setCancelHandler { [weak self] in
            guard let self = self, let fd = self.fileDescriptor else { return }
            close(fd)
            self.fileDescriptor = nil
        }

        // Start monitoring
        source.resume()

        dispatchSource = source
        isWatching = true

        print("[FileWatchManager] Started watching directory: \(path)")
    }

    /// Stops watching the directory and cleans up resources
    public func stopWatching() {
        guard isWatching else { return }

        // Cancel the dispatch source (this will trigger the cancel handler)
        dispatchSource?.cancel()
        dispatchSource = nil

        // Cancel any pending debounced callbacks
        debouncer?.cancel()
        debouncer = nil

        isWatching = false

        print("[FileWatchManager] Stopped watching directory")
    }

    deinit {
        stopWatching()
    }
}
