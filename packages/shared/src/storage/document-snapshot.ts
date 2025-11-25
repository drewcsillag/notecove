/**
 * DocumentSnapshot - Encapsulates a Yjs document with its vector clock
 *
 * This class ensures that the Y.Doc and VectorClock are always properly paired.
 * The vector clock represents exactly which updates are contained in the document.
 *
 * Key invariants:
 * - Vector clock is ONLY updated when updates are applied to the document
 * - Vector clock and document state are always in sync
 * - Sequence numbers per instance must be contiguous (no gaps)
 */

import * as Y from 'yjs';

/** Vector clock format stored with snapshots */
export interface VectorClock {
  [instanceId: string]: {
    sequence: number;
    offset: number;
    file: string;
  };
}

/**
 * DocumentSnapshot encapsulates a Y.Doc and its vector clock.
 * Ensures they are always properly paired and in sync.
 */
export class DocumentSnapshot {
  private doc: Y.Doc;
  private vectorClock: VectorClock;
  private operationLock: Promise<void> = Promise.resolve();

  private constructor(doc: Y.Doc, vectorClock: VectorClock) {
    this.doc = doc;
    this.vectorClock = vectorClock;
  }

  /**
   * Create an empty DocumentSnapshot
   */
  static createEmpty(): DocumentSnapshot {
    return new DocumentSnapshot(new Y.Doc(), {});
  }

  /**
   * Create a DocumentSnapshot from encoded state and vector clock
   * Used when loading from storage or DB cache
   */
  static fromStorage(encodedState: Uint8Array, vectorClock: VectorClock): DocumentSnapshot {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, encodedState);
    return new DocumentSnapshot(doc, { ...vectorClock });
  }

  /**
   * Get read-only access to the Y.Doc
   * IMPORTANT: Do not modify the doc directly - use applyUpdate() instead
   */
  getDoc(): Y.Doc {
    return this.doc;
  }

  /**
   * Get a copy of the current vector clock
   */
  getVectorClock(): VectorClock {
    return { ...this.vectorClock };
  }

  /**
   * Get a snapshot for saving to storage
   * Returns encoded document state and vector clock
   *
   * CRITICAL: This method waits for any in-progress operations to complete
   * to ensure the doc and vector clock are captured atomically.
   */
  async getSnapshot(): Promise<{ state: Uint8Array; vectorClock: VectorClock }> {
    // Wait for any in-progress operations to complete
    await this.operationLock;

    // Capture both at the same moment - no operations can interleave
    return {
      state: Y.encodeStateAsUpdate(this.doc),
      vectorClock: { ...this.vectorClock },
    };
  }

  /**
   * Apply a single update to the document with strict sequence validation
   *
   * This is the ONLY way to modify the document and vector clock.
   * Ensures sequence numbers are contiguous per instance.
   *
   * @throws Error if sequence number is not the next expected sequence
   */
  applyUpdate(
    update: Uint8Array,
    instanceId: string,
    sequence: number,
    offset: number,
    file: string
  ): void {
    // Validate sequence is next in order for this instance
    const current = this.vectorClock[instanceId];
    const expectedSequence = current ? current.sequence + 1 : 1;

    if (sequence !== expectedSequence) {
      throw new Error(
        `Sequence violation for instance ${instanceId}: expected ${expectedSequence}, got ${sequence}`
      );
    }

    // Apply update to document
    Y.applyUpdate(this.doc, update);

    // Update vector clock atomically
    this.vectorClock[instanceId] = { sequence, offset, file };
  }

  /**
   * Replace the entire document state and vector clock
   * Used when reloading a note from storage (e.g., after ActivitySync)
   *
   * This is more efficient than creating a new DocumentSnapshot object.
   */
  replaceWith(encodedState: Uint8Array, vectorClock: VectorClock): void {
    // Clear current doc
    this.doc.destroy();
    this.doc = new Y.Doc();

    // Apply new state
    Y.applyUpdate(this.doc, encodedState);

    // Replace vector clock
    this.vectorClock = { ...vectorClock };
  }

  /**
   * Record that an update was applied externally to the document
   * Used when the Y.Doc was modified via its 'update' event (already applied)
   *
   * This method updates the vector clock to reflect an update that was already
   * applied to the doc by Yjs. This is needed for the handleUpdate() flow where
   * the renderer modifies the shared Y.Doc and we receive the update via the
   * 'update' event handler.
   *
   * CRITICAL: This method uses a lock to prevent getSnapshot() from reading
   * while the vector clock is being updated.
   *
   * @param instanceId The instance that generated this update
   * @param sequence The sequence number from storage
   * @param offset The byte offset in the log file
   * @param file The log file name
   * @throws Error if sequence number is not the next expected sequence
   */
  async recordExternalUpdate(
    instanceId: string,
    sequence: number,
    offset: number,
    file: string
  ): Promise<void> {
    // Chain this operation onto the lock and await it
    this.operationLock = this.operationLock.then(() => {
      // Validate sequence is next in order for this instance
      const current = this.vectorClock[instanceId];
      const expectedSequence = current ? current.sequence + 1 : 1;

      if (sequence !== expectedSequence) {
        throw new Error(
          `Sequence violation for instance ${instanceId}: expected ${expectedSequence}, got ${sequence}`
        );
      }

      // Update vector clock (doc was already modified externally)
      this.vectorClock[instanceId] = { sequence, offset, file };
    });

    // Return the lock so caller can await it
    return this.operationLock;
  }

  /**
   * Clean up resources
   * Call this when the document is no longer needed
   */
  destroy(): void {
    this.doc.destroy();
  }
}
