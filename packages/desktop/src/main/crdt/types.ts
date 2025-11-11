/**
 * CRDT Manager Types
 */

import type * as Y from 'yjs';

/**
 * Document state in memory
 */
export interface DocumentState {
  doc: Y.Doc;
  noteDoc: import('@notecove/shared').NoteDoc; // NoteDoc wrapper with metadata methods
  noteId: string;
  sdId: string; // Storage Directory ID for this note
  refCount: number; // Number of renderer windows using this document
  lastModified: number;
  // Edit rate tracking for adaptive snapshot frequency
  editCount: number; // Number of edits since last snapshot check
  lastSnapshotCheck: number; // Timestamp of last snapshot check
  lastSnapshotCreated: number; // Timestamp of last snapshot created
}

/**
 * CRDT Manager interface
 */
export interface CRDTManager {
  /**
   * Load a note's CRDT document into memory
   * @param noteId Note ID
   * @param sdId Storage Directory ID (optional, will be extracted from metadata if not provided)
   * @returns The Yjs document
   */
  loadNote(noteId: string, sdId?: string): Promise<Y.Doc>;

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

  /**
   * Get a note's NoteDoc wrapper (if loaded)
   * @param noteId Note ID
   * @returns The NoteDoc instance or undefined
   */
  getNoteDoc(noteId: string): import('@notecove/shared').NoteDoc | undefined;

  /**
   * Load a folder tree document for an SD
   * @param sdId Sync Directory ID
   * @returns Promise resolving to the FolderTreeDoc instance
   */
  loadFolderTree(sdId: string): Promise<import('@notecove/shared').FolderTreeDoc>;

  /**
   * Get the loaded folder tree for an SD
   * @param sdId Sync Directory ID
   * @returns The FolderTreeDoc instance or undefined
   */
  getFolderTree(sdId: string): import('@notecove/shared').FolderTreeDoc | undefined;

  /**
   * Set the activity logger for a specific SD
   * @param sdId Storage Directory ID
   * @param logger Activity logger instance
   */
  setActivityLogger(sdId: string, logger: import('@shared/storage').ActivityLogger): void;

  /**
   * Reload a note from disk (re-apply all updates)
   * @param noteId Note ID
   */
  reloadNote(noteId: string): Promise<void>;

  /**
   * Get all loaded note IDs
   * @returns Array of note IDs
   */
  getLoadedNotes(): string[];

  /**
   * Flush all pending updates to disk
   * Should be called before shutdown to ensure all writes complete
   * @returns Promise that resolves when all pending updates are written
   */
  flush(): Promise<void>;

  /**
   * Clean up all documents and resources
   * Should be called after flush() during graceful shutdown
   */
  destroy(): void;
}
