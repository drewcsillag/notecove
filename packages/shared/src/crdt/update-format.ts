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
}

/**
 * Parse update filename to extract metadata
 * @param filename - e.g., "inst-123_note-456_1234567890.yjson"
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
  const timestamp = parseInt(parts[parts.length - 1], 10);

  if (isNaN(timestamp)) {
    return null;
  }

  // Determine type and document ID
  if (parts[1] === 'folder-tree') {
    // Format: <instance-id>_folder-tree_<sd-id>_<timestamp>
    const sdId = parts.slice(2, -1).join('_');
    return {
      type: UpdateType.FolderTree,
      instanceId,
      documentId: sdId,
      timestamp,
      version: UPDATE_FORMAT_VERSION,
    };
  } else {
    // Format: <instance-id>_<note-id>_<timestamp>
    const noteId = parts.slice(1, -1).join('_');
    return {
      type: UpdateType.Note,
      instanceId,
      documentId: noteId,
      timestamp,
      version: UPDATE_FORMAT_VERSION,
    };
  }
}

/**
 * Generate update filename
 */
export function generateUpdateFilename(
  type: UpdateType,
  instanceId: string,
  documentId: string,
  timestamp: number = Date.now()
): string {
  if (type === UpdateType.FolderTree) {
    return `${instanceId}_folder-tree_${documentId}_${timestamp}.yjson`;
  } else {
    return `${instanceId}_${documentId}_${timestamp}.yjson`;
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
