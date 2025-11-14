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

// Types for the bridge interface
interface NoteCoveBridge {
  // Note operations
  createNote(noteId: string): void;
  applyUpdate(noteId: string, updateBase64: string): void;
  getDocumentState(noteId: string): string;
  extractTitle(stateBase64: string): string;
  closeNote(noteId: string): void;

  // Folder tree operations
  createFolderTree(sdId: string): void;
  loadFolderTree(sdId: string, stateBase64: string): void;
  getFolderTreeState(sdId: string): string;
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
  // eslint-disable-next-line no-var
  var NoteCoveBridge: NoteCoveBridge | undefined;
  interface Window {
    NoteCoveBridge: NoteCoveBridge;
  }
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

  getDocumentState(noteId: string): string {
    const doc = openNotes.get(noteId);
    if (!doc) {
      throw new Error(`Note ${noteId} is not open`);
    }

    const stateBytes = Y.encodeStateAsUpdate(doc);
    return uint8ArrayToBase64(stateBytes);
  },

  extractTitle(stateBase64: string): string {
    const stateBytes = base64ToUint8Array(stateBase64);
    // Create a temporary doc to decode the state
    const tempDoc = new Y.Doc();
    Y.applyUpdate(tempDoc, stateBytes);
    // Extract the fragment and get the title
    const fragment = tempDoc.getXmlFragment('content');
    const title = extractTitleFromFragment(fragment);
    tempDoc.destroy();
    return title;
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
