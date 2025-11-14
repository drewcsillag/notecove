import Foundation

/// A utility class that debounces rapid function calls, ensuring only the last call executes after a delay period.
///
/// Debouncing is useful for handling rapid events like file system changes, where you want to wait for a
/// "quiet period" before taking action.
///
/// Example usage:
/// ```swift
/// let debouncer = Debouncer(delay: 0.5)
///
/// // Called many times rapidly
/// for i in 1...100 {
///     debouncer.debounce {
///         print("Processing batch \(i)")  // Only prints once for i=100
///     }
/// }
/// ```
public class Debouncer {
    private var workItem: DispatchWorkItem?
    private let delay: TimeInterval
    private let queue: DispatchQueue

    /// Creates a new debouncer with the specified delay
    /// - Parameters:
    ///   - delay: The time interval to wait before executing the debounced action
    ///   - queue: The dispatch queue on which to execute the action (defaults to main queue)
    public init(delay: TimeInterval, queue: DispatchQueue = .main) {
        self.delay = delay
        self.queue = queue
    }

    /// Schedules an action to execute after the delay period. If called again before the delay expires,
    /// the previous action is cancelled and a new delay period begins.
    ///
    /// - Parameter action: The closure to execute after the delay
    public func debounce(_ action: @escaping () -> Void) {
        // Cancel any existing work item
        workItem?.cancel()

        // Create a new work item
        let newWorkItem = DispatchWorkItem(block: action)
        workItem = newWorkItem

        // Schedule it to run after the delay
        queue.asyncAfter(deadline: .now() + delay, execute: newWorkItem)
    }

    /// Cancels any pending debounced action
    public func cancel() {
        workItem?.cancel()
        workItem = nil
    }

    deinit {
        cancel()
    }
}
