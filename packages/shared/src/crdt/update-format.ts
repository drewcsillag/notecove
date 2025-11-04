/**
 * Update file format and versioning
 *
 * Update files are stored in the sync directory as:
 * - Notes: <instance-id>_<note-id>_<timestamp>.yjson
 * - Folders: <instance-id>_folder-tree_<sd-id>_<timestamp>.yjson
 *
 * Format version 1: Raw Yjs update as binary data
 */

export const UPDATE_FORMAT_VERSION = 1;

/**
 * Types of updates
 */
export enum UpdateType {
  Note = 'note',
  FolderTree = 'folder-tree',
}

/**
 * Metadata about an update file
 */
export interface UpdateFileMetadata {
  type: UpdateType;
  instanceId: string;
  documentId: string; // note-id or sd-id
  timestamp: number;
  version: number;
  sequence?: number; // Optional: sequence number (new format), undefined for old format
}

/**
 * Parse update filename to extract metadata
 * @param filename - e.g., "inst-123_note-456_1234567890-1234.yjson" or "inst-123_note-456_1234567890.yjson" (legacy)
 */
export function parseUpdateFilename(filename: string): UpdateFileMetadata | null {
  // Remove .yjson extension
  if (!filename.endsWith('.yjson')) {
    return null;
  }
  const baseName = filename.slice(0, -6);

  // Split by underscore
  const parts = baseName.split('_');
  if (parts.length < 3) {
    return null;
  }

  const instanceId = parts[0];
  const lastPart = parts[parts.length - 1];

  if (!instanceId || !lastPart) {
    return null;
  }

  // Extract timestamp and sequence number
  // Formats:
  //   - Legacy: "timestamp" (no suffix)
  //   - Old: "timestamp-random" (4-digit random suffix)
  //   - New: "timestamp-seq" (sequence number suffix)
  let timestamp: number;
  let sequence: number | undefined;

  if (lastPart.includes('-')) {
    const parts = lastPart.split('-');
    const timestampStr = parts[0];
    const sequenceStr = parts[1];

    timestamp = parseInt(timestampStr ?? '', 10);
    if (isNaN(timestamp)) {
      return null;
    }

    // Parse sequence number (could be old random suffix or new sequence)
    if (sequenceStr) {
      const seq = parseInt(sequenceStr, 10);
      if (!isNaN(seq)) {
        sequence = seq;
      }
    }
  } else {
    // Legacy format without suffix
    timestamp = parseInt(lastPart, 10);
    if (isNaN(timestamp)) {
      return null;
    }
  }

  // Determine type and document ID
  if (parts[1] === 'folder-tree') {
    // Format: <instance-id>_folder-tree_<sd-id>_<timestamp>[-seq]
    const sdId = parts.slice(2, -1).join('_');
    const metadata: UpdateFileMetadata = {
      type: UpdateType.FolderTree,
      instanceId,
      documentId: sdId,
      timestamp,
      version: UPDATE_FORMAT_VERSION,
    };
    if (sequence !== undefined) {
      metadata.sequence = sequence;
    }
    return metadata;
  } else {
    // Format: <instance-id>_<note-id>_<timestamp>[-seq]
    const noteId = parts.slice(1, -1).join('_');
    const metadata: UpdateFileMetadata = {
      type: UpdateType.Note,
      instanceId,
      documentId: noteId,
      timestamp,
      version: UPDATE_FORMAT_VERSION,
    };
    if (sequence !== undefined) {
      metadata.sequence = sequence;
    }
    return metadata;
  }
}

/**
 * Generate update filename
 * Includes suffix to prevent collisions and track sequence
 * @param sequence - Optional sequence number (new format). If not provided, uses random 4-digit suffix (old format)
 */
export function generateUpdateFilename(
  type: UpdateType,
  instanceId: string,
  documentId: string,
  timestamp: number = Date.now(),
  sequence?: number
): string {
  // If sequence provided, use it (new format)
  // Otherwise, use random 4-digit suffix (old format, backward compatible)
  const suffix =
    sequence !== undefined
      ? sequence.toString()
      : Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, '0');

  const uniqueTimestamp = `${timestamp}-${suffix}`;

  if (type === UpdateType.FolderTree) {
    return `${instanceId}_folder-tree_${documentId}_${uniqueTimestamp}.yjson`;
  } else {
    return `${instanceId}_${documentId}_${uniqueTimestamp}.yjson`;
  }
}

/**
 * Encode update data (currently just returns the raw update)
 * In future versions, this could add compression or additional metadata
 */
export function encodeUpdateFile(update: Uint8Array): Uint8Array {
  return update;
}

/**
 * Decode update data (currently just returns the raw update)
 * In future versions, this would handle decompression or version migration
 */
export function decodeUpdateFile(data: Uint8Array): Uint8Array {
  return data;
}
