/**
 * CRDT Manager Types
 */

import type * as Y from 'yjs';

/**
 * Document state in memory
 */
export interface DocumentState {
  doc: Y.Doc;
  noteId: string;
  refCount: number; // Number of renderer windows using this document
  lastModified: number;
}

/**
 * CRDT Manager interface
 */
export interface CRDTManager {
  /**
   * Load a note's CRDT document into memory
   * @param noteId Note ID
   * @returns The Yjs document
   */
  loadNote(noteId: string): Promise<Y.Doc>;

  /**
   * Unload a note from memory (decrements ref count)
   * @param noteId Note ID
   */
  unloadNote(noteId: string): Promise<void>;

  /**
   * Apply an update to a note's CRDT
   * @param noteId Note ID
   * @param update Yjs update bytes
   */
  applyUpdate(noteId: string, update: Uint8Array): Promise<void>;

  /**
   * Get a note's current CRDT document (if loaded)
   * @param noteId Note ID
   * @returns The Yjs document or undefined
   */
  getDocument(noteId: string): Y.Doc | undefined;
}
