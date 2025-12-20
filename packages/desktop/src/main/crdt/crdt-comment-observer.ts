/**
 * CRDT Comment Observer
 *
 * Observes comment changes in CRDT documents and broadcasts IPC events
 * for remote changes. This enables live sync of comments without requiring
 * a note switch.
 */

import type { NoteDoc, CommentChangeEvent } from '@shared/crdt';

const DEBUG = process.env['DEBUG_COMMENT_SYNC'] === '1';

function log(...args: unknown[]): void {
  if (DEBUG) {
    console.log('[CRDTCommentObserver]', ...args);
  }
}

/**
 * Broadcast function type for sending IPC events to renderer windows
 */
type BroadcastFn = (channel: string, ...args: unknown[]) => void;

/**
 * Debounced event to prevent multiple broadcasts for rapid changes
 */
interface DebouncedEvent {
  noteId: string;
  event: CommentChangeEvent;
  timer: NodeJS.Timeout;
}

/**
 * CRDTCommentObserver watches CRDT documents for comment changes
 * and broadcasts IPC events when remote changes are detected.
 */
export class CRDTCommentObserver {
  private observers = new Map<string, () => void>(); // noteId -> unsubscribe
  private pendingEvents = new Map<string, DebouncedEvent>(); // eventKey -> debounced event
  private debounceMs: number;

  constructor(
    private broadcastToAll: BroadcastFn,
    options?: { debounceMs?: number }
  ) {
    this.debounceMs = options?.debounceMs ?? 100;
  }

  /**
   * Register observers for a loaded note document
   */
  registerNote(noteId: string, noteDoc: NoteDoc): void {
    // Don't double-register
    if (this.observers.has(noteId)) {
      log(`Note ${noteId} already registered, skipping`);
      return;
    }

    log(`Registering observers for note ${noteId}`);

    const unsubscribe = noteDoc.observeComments((event) => {
      this.handleCommentChange(noteId, event);
    });

    this.observers.set(noteId, unsubscribe);
    log(`Observers registered for note ${noteId}`);
  }

  /**
   * Unregister observers for a note document
   */
  unregisterNote(noteId: string): void {
    const unsubscribe = this.observers.get(noteId);
    if (unsubscribe) {
      log(`Unregistering observers for note ${noteId}`);
      unsubscribe();
      this.observers.delete(noteId);

      // Clear any pending debounced events for this note
      for (const [key, event] of this.pendingEvents) {
        if (event.noteId === noteId) {
          clearTimeout(event.timer);
          this.pendingEvents.delete(key);
        }
      }
    }
  }

  /**
   * Clean up all observers
   */
  destroy(): void {
    log('Destroying all observers');
    for (const [noteId, unsubscribe] of this.observers) {
      log(`Cleaning up observers for note ${noteId}`);
      unsubscribe();
    }
    this.observers.clear();

    // Clear all pending debounced events
    for (const event of this.pendingEvents.values()) {
      clearTimeout(event.timer);
    }
    this.pendingEvents.clear();
  }

  /**
   * Notify about threads that were added during a reload.
   *
   * After reloadNote() replaces the Y.Doc, the observer is registered on the new doc
   * but the state is already applied. This means the observer won't see the existing
   * threads. Call this method to broadcast 'threadAdded' events for all existing threads
   * so the renderer can refresh its UI.
   *
   * @param noteId The note ID
   * @param threadIds Array of thread IDs to notify about
   */
  notifyThreadsReloaded(noteId: string, threadIds: string[]): void {
    log(`Notifying about ${threadIds.length} reloaded threads for note ${noteId}`);
    for (const threadId of threadIds) {
      this.broadcastToAll('comment:threadAdded', noteId, threadId);
    }
  }

  /**
   * Handle a comment change event from a NoteDoc observer
   */
  private handleCommentChange(noteId: string, event: CommentChangeEvent): void {
    log(
      `Comment change: noteId=${noteId}, type=${event.type}, threadId=${event.threadId}, isRemote=${event.isRemote}`
    );

    // Only broadcast remote changes
    if (!event.isRemote) {
      log(`Skipping local change for ${event.type}`);
      return;
    }

    // Create a unique key for debouncing
    // Group by noteId + type + threadId (+ replyId/reactionId if present)
    const eventKey = [noteId, event.type, event.threadId, event.replyId, event.reactionId]
      .filter(Boolean)
      .join(':');

    // Check for existing debounced event
    const existing = this.pendingEvents.get(eventKey);
    if (existing) {
      // Update the event (in case data changed) and reset timer
      clearTimeout(existing.timer);
      existing.event = event;
      existing.timer = setTimeout(() => {
        this.processDebouncedEvent(noteId, event);
        this.pendingEvents.delete(eventKey);
      }, this.debounceMs);
      log(`Debouncing ${event.type} for ${eventKey}`);
      return;
    }

    // Create new debounced event
    const timer = setTimeout(() => {
      this.processDebouncedEvent(noteId, event);
      this.pendingEvents.delete(eventKey);
    }, this.debounceMs);

    this.pendingEvents.set(eventKey, { noteId, event, timer });
    log(`Scheduled ${event.type} broadcast for ${eventKey} in ${this.debounceMs}ms`);
  }

  /**
   * Process a debounced event - broadcast IPC and update database
   */
  private processDebouncedEvent(noteId: string, event: CommentChangeEvent): void {
    log(`Broadcasting ${event.type} for note ${noteId}, thread ${event.threadId}`);

    // Map event type to IPC channel and broadcast
    switch (event.type) {
      case 'thread-add':
        this.broadcastToAll('comment:threadAdded', noteId, event.threadId);
        // Database update will be handled when renderer fetches the thread
        break;

      case 'thread-update':
        this.broadcastToAll('comment:threadUpdated', noteId, event.threadId);
        break;

      case 'thread-delete':
        this.broadcastToAll('comment:threadDeleted', noteId, event.threadId);
        // Database cleanup could be done here, but the renderer will handle it
        break;

      case 'reply-add':
        this.broadcastToAll('comment:replyAdded', noteId, event.threadId, event.replyId);
        break;

      case 'reply-update':
        this.broadcastToAll('comment:replyUpdated', noteId, event.threadId, event.replyId);
        break;

      case 'reply-delete':
        this.broadcastToAll('comment:replyDeleted', noteId, event.threadId, event.replyId);
        break;

      case 'reaction-add':
        this.broadcastToAll('comment:reactionAdded', noteId, event.threadId, event.reactionId);
        break;

      case 'reaction-delete':
        this.broadcastToAll('comment:reactionRemoved', noteId, event.threadId, event.reactionId);
        break;
    }
  }
}
