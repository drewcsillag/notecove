/**
 * iOS Bridge Entry Point
 *
 * This file serves as the entry point for the bundled JavaScript that runs
 * in JavaScriptCore on iOS. It exposes a global NoteCoveBridge object that
 * Swift can call into.
 *
 * All I/O operations (file reads/writes) are delegated back to Swift via
 * callbacks. This keeps the JavaScript pure and testable.
 */

import * as Y from 'yjs';
import {
  NoteDoc,
  FolderTreeDoc,
  extractTitleFromFragment,
  parseUpdateFilename,
  generateUpdateFilename,
  parseSnapshotFilename,
  parsePackFilename,
  UpdateType,
  type UpdateFileMetadata,
  type SnapshotFileMetadata,
  type PackFileMetadata,
} from './crdt';
import { parseLogFile } from './storage/binary-format';

// Types for folder data exposed to Swift
interface FolderInfo {
  id: string;
  name: string;
  parentId: string | null;
  sdId: string;
  order: number;
  deleted: boolean;
}

// Types for the bridge interface
interface NoteCoveBridge {
  // Note operations
  createNote(noteId: string): void;
  applyUpdate(noteId: string, updateBase64: string): void;
  applyLogFile(noteId: string, logFileBase64: string): number; // Returns number of updates applied
  getDocumentState(noteId: string): string;
  extractTitle(stateBase64: string): string;
  extractContent(stateBase64: string): string;
  closeNote(noteId: string): void;

  // Folder tree operations
  createFolderTree(sdId: string): void;
  loadFolderTree(sdId: string, stateBase64: string): void;
  applyFolderTreeUpdate(sdId: string, updateBase64: string): void;
  applyFolderTreeLogFile(sdId: string, logFileBase64: string): number; // Returns number of updates applied
  getFolderTreeState(sdId: string): string;
  extractFolders(sdId: string): FolderInfo[];
  closeFolderTree(sdId: string): void;

  // File name parsing utilities
  parseUpdateFilename(filename: string): UpdateFileMetadata | null;
  generateUpdateFilename(
    type: UpdateType,
    instanceId: string,
    documentId: string,
    timestamp?: number,
    sequence?: number
  ): string;
  parseSnapshotFilename(filename: string): SnapshotFileMetadata | null;
  parsePackFilename(filename: string): PackFileMetadata | null;

  // Memory management
  clearDocumentCache(): void;
  getOpenDocumentCount(): number;

  // Internal state
  _openNotes: Map<string, Y.Doc>;
  _openFolderTrees: Map<string, Y.Doc>;
}

// Initialize the global bridge object
declare global {
  var NoteCoveBridge: NoteCoveBridge | undefined;
  interface Window {
    NoteCoveBridge: NoteCoveBridge;
  }

  // File I/O functions exposed from Swift
  function _swiftReadFile(path: string): string | null;
  function _swiftWriteFile(path: string, base64Data: string): boolean;
  function _swiftDeleteFile(path: string): boolean;
  function _swiftListFiles(directory: string, pattern: string | null): string[];
  function _swiftFileExists(path: string): boolean;
  function _swiftCreateDirectory(path: string): boolean;
}

// Storage for open documents
const openNotes = new Map<string, Y.Doc>();
const openFolderTrees = new Map<string, Y.Doc>();

// Utility: Base64 encoding/decoding
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binaryString = '';
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  return btoa(binaryString);
}

// ==================== File I/O Wrappers ====================

/**
 * Read a file from the file system
 * @param path Absolute path to the file
 * @returns File contents as Uint8Array, or null if file doesn't exist
 */
export function readFile(path: string): Uint8Array | null {
  const base64 = _swiftReadFile(path);
  if (!base64) {
    return null;
  }
  return base64ToUint8Array(base64);
}

/**
 * Write a file to the file system (atomic write)
 * @param path Absolute path to the file
 * @param data File contents
 * @returns true on success, false on failure
 */
export function writeFile(path: string, data: Uint8Array): boolean {
  const base64 = uint8ArrayToBase64(data);
  return _swiftWriteFile(path, base64);
}

/**
 * Delete a file from the file system
 * @param path Absolute path to the file
 * @returns true on success, false on failure
 */
export function deleteFile(path: string): boolean {
  return _swiftDeleteFile(path);
}

/**
 * List files in a directory, optionally filtered by pattern
 * @param directory Absolute path to the directory
 * @param pattern Optional glob pattern (e.g., "*.yjson")
 * @returns Array of absolute file paths
 */
export function listFiles(directory: string, pattern?: string): string[] {
  return _swiftListFiles(directory, pattern ?? null);
}

/**
 * Check if a file exists
 * @param path Absolute path to check
 * @returns true if file exists, false otherwise
 */
export function fileExists(path: string): boolean {
  return _swiftFileExists(path);
}

/**
 * Create a directory (with intermediate directories)
 * @param path Absolute path to the directory
 * @returns true on success, false on failure
 */
export function createDirectory(path: string): boolean {
  return _swiftCreateDirectory(path);
}

// Create the bridge object
const bridge: NoteCoveBridge = {
  // ==================== Note Operations ====================

  createNote(noteId: string): void {
    if (openNotes.has(noteId)) {
      throw new Error(`Note ${noteId} is already open`);
    }

    const noteDoc = new NoteDoc(noteId);
    // Note: We don't call initializeNote() here because we don't have metadata yet
    // The note structure will be initialized when first edited

    openNotes.set(noteId, noteDoc.doc);
  },

  applyUpdate(noteId: string, updateBase64: string): void {
    const doc = openNotes.get(noteId);
    if (!doc) {
      throw new Error(`Note ${noteId} is not open`);
    }

    const updateBytes = base64ToUint8Array(updateBase64);
    Y.applyUpdate(doc, updateBytes);
  },

  applyLogFile(noteId: string, logFileBase64: string): number {
    const doc = openNotes.get(noteId);
    if (!doc) {
      throw new Error(`Note ${noteId} is not open`);
    }

    const fileBytes = base64ToUint8Array(logFileBase64);
    const parsed = parseLogFile(fileBytes);

    let applied = 0;
    for (const record of parsed.records) {
      Y.applyUpdate(doc, record.data);
      applied++;
    }

    return applied;
  },

  getDocumentState(noteId: string): string {
    const doc = openNotes.get(noteId);
    if (!doc) {
      throw new Error(`Note ${noteId} is not open`);
    }

    const stateBytes = Y.encodeStateAsUpdate(doc);
    return uint8ArrayToBase64(stateBytes);
  },

  extractTitle(stateBase64: string): string {
    console.log('[Bridge] ========== extractTitle called ==========');
    console.log('[Bridge] State base64 length:', stateBase64.length);

    const stateBytes = base64ToUint8Array(stateBase64);
    console.log('[Bridge] State bytes length:', stateBytes.length);

    // Create a temporary doc to decode the state
    const tempDoc = new Y.Doc();
    console.log('[Bridge] Created temporary Y.Doc');

    Y.applyUpdate(tempDoc, stateBytes);
    console.log('[Bridge] Applied update to temporary doc');

    // Extract the fragment and get the title
    const fragment = tempDoc.getXmlFragment('content');
    console.log('[Bridge] Got fragment "content", length:', fragment.length);

    const title = extractTitleFromFragment(fragment);
    console.log('[Bridge] extractTitleFromFragment returned:', title);

    tempDoc.destroy();
    console.log('[Bridge] Destroyed temporary doc');
    console.log('[Bridge] ========== extractTitle complete ==========');
    return title;
  },

  extractContent(stateBase64: string): string {
    const stateBytes = base64ToUint8Array(stateBase64);
    // Create a temporary doc to decode the state
    const tempDoc = new Y.Doc();
    Y.applyUpdate(tempDoc, stateBytes);
    // Extract all text content from the fragment
    const fragment = tempDoc.getXmlFragment('content');
    let contentText = '';

    // Recursively extract text from elements
    const extractText = (elem: Y.XmlElement): string => {
      let text = '';
      elem.forEach((child) => {
        if (child instanceof Y.XmlText) {
          text += String(child.toString());
        } else if (child instanceof Y.XmlElement) {
          text += extractText(child);
        }
      });
      return text;
    };

    // Iterate through all top-level items
    fragment.forEach((item) => {
      if (item instanceof Y.XmlText) {
        contentText += String(item.toString()) + '\n';
      } else if (item instanceof Y.XmlElement) {
        contentText += extractText(item) + '\n';
      }
    });

    tempDoc.destroy();
    return contentText;
  },

  closeNote(noteId: string): void {
    const doc = openNotes.get(noteId);
    if (!doc) {
      return; // Already closed
    }

    doc.destroy();
    openNotes.delete(noteId);
  },

  // ==================== Folder Tree Operations ====================

  createFolderTree(sdId: string): void {
    if (openFolderTrees.has(sdId)) {
      throw new Error(`Folder tree for SD ${sdId} is already open`);
    }

    const folderTree = new FolderTreeDoc(sdId);
    openFolderTrees.set(sdId, folderTree.doc);
  },

  loadFolderTree(sdId: string, stateBase64: string): void {
    if (openFolderTrees.has(sdId)) {
      throw new Error(`Folder tree for SD ${sdId} is already open`);
    }

    const folderTree = new FolderTreeDoc(sdId);
    const stateBytes = base64ToUint8Array(stateBase64);
    Y.applyUpdate(folderTree.doc, stateBytes);

    openFolderTrees.set(sdId, folderTree.doc);
  },

  applyFolderTreeUpdate(sdId: string, updateBase64: string): void {
    const doc = openFolderTrees.get(sdId);
    if (!doc) {
      throw new Error(`Folder tree for SD ${sdId} is not open`);
    }

    const updateBytes = base64ToUint8Array(updateBase64);
    Y.applyUpdate(doc, updateBytes);
  },

  applyFolderTreeLogFile(sdId: string, logFileBase64: string): number {
    const doc = openFolderTrees.get(sdId);
    if (!doc) {
      throw new Error(`Folder tree for SD ${sdId} is not open`);
    }

    const fileBytes = base64ToUint8Array(logFileBase64);
    const parsed = parseLogFile(fileBytes);

    let applied = 0;
    for (const record of parsed.records) {
      Y.applyUpdate(doc, record.data);
      applied++;
    }

    return applied;
  },

  getFolderTreeState(sdId: string): string {
    const doc = openFolderTrees.get(sdId);
    if (!doc) {
      throw new Error(`Folder tree for SD ${sdId} is not open`);
    }

    const stateBytes = Y.encodeStateAsUpdate(doc);
    return uint8ArrayToBase64(stateBytes);
  },

  closeFolderTree(sdId: string): void {
    const doc = openFolderTrees.get(sdId);
    if (!doc) {
      return; // Already closed
    }

    doc.destroy();
    openFolderTrees.delete(sdId);
  },

  extractFolders(sdId: string): FolderInfo[] {
    const doc = openFolderTrees.get(sdId);
    if (!doc) {
      throw new Error(`Folder tree for SD ${sdId} is not open`);
    }

    const foldersMap = doc.getMap<Y.Map<unknown>>('folders');
    const result: FolderInfo[] = [];

    foldersMap.forEach((folderMap) => {
      result.push({
        id: folderMap.get('id') as string,
        name: folderMap.get('name') as string,
        parentId: (folderMap.get('parentId') as string | null) ?? null,
        sdId: folderMap.get('sdId') as string,
        order: folderMap.get('order') as number,
        deleted: folderMap.get('deleted') as boolean,
      });
    });

    // Sort by order, then by name for stability
    result.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    return result;
  },

  // ==================== File Name Utilities ====================

  parseUpdateFilename(filename: string): UpdateFileMetadata | null {
    return parseUpdateFilename(filename);
  },

  generateUpdateFilename(
    type: UpdateType,
    instanceId: string,
    documentId: string,
    timestamp?: number,
    sequence?: number
  ): string {
    return generateUpdateFilename(type, instanceId, documentId, timestamp, sequence);
  },

  parseSnapshotFilename(filename: string): SnapshotFileMetadata | null {
    return parseSnapshotFilename(filename);
  },

  parsePackFilename(filename: string): PackFileMetadata | null {
    return parsePackFilename(filename);
  },

  // ==================== Memory Management ====================

  clearDocumentCache(): void {
    // Close all open notes
    for (const doc of openNotes.values()) {
      doc.destroy();
    }
    openNotes.clear();

    // Close all open folder trees
    for (const doc of openFolderTrees.values()) {
      doc.destroy();
    }
    openFolderTrees.clear();
  },

  getOpenDocumentCount(): number {
    return openNotes.size + openFolderTrees.size;
  },

  // Internal state (exposed for debugging)
  _openNotes: openNotes,
  _openFolderTrees: openFolderTrees,
};

// Expose to global scope
// For JavaScriptCore and other environments, use globalThis
globalThis.NoteCoveBridge = bridge;

// Export for testing
export default bridge;
