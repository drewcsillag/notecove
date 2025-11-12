/**
 * State Reconstructor - Rebuilds document state at any point in history
 *
 * Uses snapshots + chronological updates to efficiently reconstruct
 * document state at any historical point in time.
 */

import * as Y from 'yjs';
import type { UUID } from '../types';
import type { UpdateManager } from '../storage/update-manager';
import type { ActivitySession, HistoryUpdate } from './timeline-builder';
import type { VectorClock } from '../crdt/snapshot-format';
import { shouldApplyUpdate } from '../crdt/snapshot-format';

/**
 * Point in time to reconstruct document state
 */
export interface ReconstructionPoint {
  timestamp: number; // Wall-clock time
  updateIndex?: number; // Optional: specific index in session's updates array
}

/**
 * Keyframe sample for session scrubbing
 */
export interface Keyframe {
  updateIndex: number; // Index within session
  timestamp: number;
  doc: Y.Doc;
  text: string; // Extracted text content for preview
}

/**
 * State reconstructor - rebuilds document at any point in history
 */
export class StateReconstructor {
  constructor(private readonly updateManager: UpdateManager) {}

  /**
   * Reconstruct document state at specific point in time
   *
   * Algorithm:
   * 1. Find best snapshot before target time
   * 2. Load snapshot into new Y.Doc
   * 3. Apply updates chronologically until target reached
   */
  async reconstructAt(
    sdId: UUID,
    noteId: UUID,
    allUpdates: HistoryUpdate[],
    point: ReconstructionPoint
  ): Promise<Y.Doc> {
    const doc = new Y.Doc();

    // Find best snapshot before target time
    const { snapshot, snapshotClock } = await this.findBestSnapshot(
      sdId,
      noteId,
      point.timestamp,
      allUpdates
    );

    if (snapshot) {
      // Apply snapshot state as base
      Y.applyUpdate(doc, snapshot.documentState);
    }

    // Filter updates that occurred before or at target time
    const updatesUpToTarget = allUpdates.filter((update) => {
      // Check if update is after snapshot
      if (snapshotClock && !shouldApplyUpdate(snapshotClock, update.instanceId, update.sequence)) {
        return false;
      }

      // Check if update is before or at target time
      if (update.timestamp > point.timestamp) {
        return false;
      }

      return true;
    });

    // If updateIndex provided, it's relative to the filtered updates at target time
    // Apply only up to that index
    let updatesToApply = updatesUpToTarget;
    if (point.updateIndex !== undefined) {
      updatesToApply = updatesUpToTarget.slice(0, point.updateIndex + 1);
    }

    // Apply updates in chronological order
    for (const update of updatesToApply) {
      try {
        Y.applyUpdate(doc, update.data);
      } catch (error) {
        console.error(
          `Failed to apply update from ${update.instanceId} at ${update.timestamp}:`,
          error
        );
        // Continue with other updates - best effort reconstruction
      }
    }

    return doc;
  }

  /**
   * Generate keyframe samples for a session (for scrubbing UI)
   *
   * Samples evenly-spaced points throughout the session to enable
   * smooth scrubbing without reconstructing every single update.
   *
   * @param sampleCount - Number of keyframes to generate (default 10)
   */
  async generateKeyframes(
    sdId: UUID,
    noteId: UUID,
    session: ActivitySession,
    allUpdates: HistoryUpdate[],
    sampleCount: number = 10
  ): Promise<Keyframe[]> {
    const keyframes: Keyframe[] = [];
    const totalUpdates = session.updates.length;

    // If session has fewer updates than samples, create keyframe for each update
    const actualSampleCount = Math.min(sampleCount, totalUpdates);

    // Calculate sample interval
    const interval = totalUpdates / actualSampleCount;

    for (let i = 0; i < actualSampleCount; i++) {
      // Calculate index in session's updates array
      const updateIndex = Math.floor(i * interval);
      const update = session.updates[updateIndex];

      // Reconstruct document at this point
      const point: ReconstructionPoint = {
        timestamp: update.timestamp,
        updateIndex: allUpdates.indexOf(update),
      };

      const doc = await this.reconstructAt(sdId, noteId, allUpdates, point);

      // Extract text content for preview
      const text = this.extractTextContent(doc);

      keyframes.push({
        updateIndex,
        timestamp: update.timestamp,
        doc,
        text,
      });
    }

    // Always include the final state of the session
    if (actualSampleCount > 0 && keyframes[keyframes.length - 1].updateIndex < totalUpdates - 1) {
      const lastUpdate = session.updates[totalUpdates - 1];
      const point: ReconstructionPoint = {
        timestamp: lastUpdate.timestamp,
        updateIndex: allUpdates.indexOf(lastUpdate),
      };

      const doc = await this.reconstructAt(sdId, noteId, allUpdates, point);
      const text = this.extractTextContent(doc);

      keyframes.push({
        updateIndex: totalUpdates - 1,
        timestamp: lastUpdate.timestamp,
        doc,
        text,
      });
    }

    return keyframes;
  }

  /**
   * Extract plain text content from Y.Doc for preview
   */
  private extractTextContent(doc: Y.Doc): string {
    const content = doc.getXmlFragment('content');
    let text = '';

    // Recursively extract text from XML fragment
    const extractFromNode = (node: Y.XmlElement | Y.XmlText): void => {
      if (node instanceof Y.XmlText) {
        text += node.toString();
      } else if (node instanceof Y.XmlElement) {
        // Add space between block elements
        if (node.nodeName && ['paragraph', 'heading', 'listItem'].includes(node.nodeName)) {
          if (text.length > 0 && !text.endsWith(' ')) {
            text += ' ';
          }
        }

        // Process children
        node.forEach((child) => {
          if (child instanceof Y.XmlElement || child instanceof Y.XmlText) {
            extractFromNode(child);
          }
        });
      }
    };

    content.forEach((child) => {
      if (child instanceof Y.XmlElement || child instanceof Y.XmlText) {
        extractFromNode(child);
      }
    });

    return text.trim();
  }

  /**
   * Find best snapshot before target time
   *
   * Returns snapshot with highest totalChanges that is <= target time
   * Note: Since snapshot metadata doesn't include timestamp, we need to
   * read snapshots to check their timestamps. For performance, we sort
   * by totalChanges and check in descending order.
   *
   * IMPORTANT: A snapshot can only be used if ALL its updates occurred before targetTime.
   * We check this by comparing the snapshot's vector clock against updates at targetTime.
   */
  private async findBestSnapshot(
    sdId: UUID,
    noteId: UUID,
    targetTime: number,
    allUpdates: HistoryUpdate[]
  ): Promise<{
    snapshot: { documentState: Uint8Array; totalChanges: number } | null;
    snapshotClock: VectorClock | null;
  }> {
    try {
      const snapshots = await this.updateManager.listSnapshotFiles(sdId, noteId);

      if (snapshots.length === 0) {
        return { snapshot: null, snapshotClock: null };
      }

      // Sort by totalChanges (highest first) for efficiency
      const sortedSnapshots = snapshots.sort((a, b) => b.totalChanges - a.totalChanges);

      // Find best snapshot before target time
      // Check snapshots in order of totalChanges until we find one before target
      for (const snapshot of sortedSnapshots) {
        const snapshotData = await this.updateManager.readSnapshot(sdId, noteId, snapshot.filename);

        // CRITICAL: Check if snapshot is for the correct note!
        if (snapshotData.noteId !== noteId) {
          continue;
        }

        // Check if snapshot file was created before target time
        if (snapshotData.timestamp > targetTime) {
          continue;
        }

        // CRITICAL: Verify that all updates in the snapshot occurred before targetTime
        // by checking if any update referenced by the snapshot's vector clock has a
        // timestamp after the target time.
        let snapshotIsValid = true;

        for (const [instanceId, maxSeq] of Object.entries(snapshotData.maxSequences)) {
          // Find all updates from this instance in allUpdates
          const instanceUpdates = allUpdates.filter((u) => u.instanceId === instanceId);

          // Find the highest sequence number we have for this instance
          const maxSeqInAllUpdates = instanceUpdates.reduce(
            (max, u) => Math.max(max, u.sequence),
            -1
          );

          // If snapshot references sequences we don't have, snapshot is invalid
          // This means the snapshot contains updates that aren't in our update list
          if (maxSeq > maxSeqInAllUpdates && instanceUpdates.length > 0) {
            snapshotIsValid = false;
            break;
          }

          // If we have NO updates from this instance but snapshot does, reject it
          if (instanceUpdates.length === 0) {
            snapshotIsValid = false;
            break;
          }

          // Check if any of the updates up to maxSeq have timestamps after target time
          const updatesUpToMaxSeq = instanceUpdates.filter((u) => u.sequence <= maxSeq);
          for (const update of updatesUpToMaxSeq) {
            if (update.timestamp > targetTime) {
              snapshotIsValid = false;
              break;
            }
          }

          if (!snapshotIsValid) break;
        }

        if (!snapshotIsValid) {
          continue;
        }

        // This snapshot is valid - all its updates occurred before target time
        return {
          snapshot: {
            documentState: snapshotData.documentState,
            totalChanges: snapshotData.totalChanges,
          },
          snapshotClock: snapshotData.maxSequences,
        };
      }

      // No snapshot found before target time
      return { snapshot: null, snapshotClock: null };
    } catch (error) {
      console.error(`Failed to find best snapshot:`, error);
      return { snapshot: null, snapshotClock: null };
    }
  }

  /**
   * Extract preview text from first/last state of a session
   * Used for session cards in timeline UI
   */
  async getSessionPreview(
    sdId: UUID,
    noteId: UUID,
    session: ActivitySession,
    allUpdates: HistoryUpdate[]
  ): Promise<{ firstPreview: string; lastPreview: string }> {
    // Reconstruct at session start
    const firstPoint: ReconstructionPoint = {
      timestamp: session.startTime,
      updateIndex: allUpdates.indexOf(session.updates[0]),
    };
    const firstDoc = await this.reconstructAt(sdId, noteId, allUpdates, firstPoint);
    const firstPreview = this.extractTextContent(firstDoc).substring(0, 100);

    // Reconstruct at session end
    const lastPoint: ReconstructionPoint = {
      timestamp: session.endTime,
      updateIndex: allUpdates.indexOf(session.updates[session.updates.length - 1]),
    };
    const lastDoc = await this.reconstructAt(sdId, noteId, allUpdates, lastPoint);
    const lastPreview = this.extractTextContent(lastDoc).substring(0, 100);

    return { firstPreview, lastPreview };
  }
}
