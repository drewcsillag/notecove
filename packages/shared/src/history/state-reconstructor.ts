/**
 * State Reconstructor - Rebuilds document state at any point in history
 *
 * Provides simple utilities for reconstructing document state from updates.
 * The actual reconstruction is done in the IPC handlers using TimelineBuilder.
 */

import * as Y from 'yjs';
import type { HistoryUpdate } from './timeline-builder';

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
 * Reconstruct document state from updates up to a target timestamp
 *
 * @param updates - All updates in chronological order
 * @param point - Target point in time to reconstruct to
 * @returns Y.Doc with state at the specified point
 */
export function reconstructAt(updates: HistoryUpdate[], point: ReconstructionPoint): Y.Doc {
  const doc = new Y.Doc();

  for (const update of updates) {
    // Stop if we've passed the target time
    if (update.timestamp > point.timestamp) {
      break;
    }

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
 * Extract plain text content from Y.Doc for preview
 */
export function extractTextContent(doc: Y.Doc): string {
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
