/**
 * CRDT Manager Implementation
 *
 * Manages in-memory Yjs documents for notes.
 * All renderer windows connect to the same in-memory document via IPC.
 */

import * as Y from 'yjs';
import type { CRDTManager, DocumentState } from './types';
import { NoteDoc } from '@shared/crdt';
import type { UpdateManager } from '@shared/storage';

export class CRDTManagerImpl implements CRDTManager {
  private documents = new Map<string, DocumentState>();

  constructor(private updateManager: UpdateManager) {}

  async loadNote(noteId: string): Promise<Y.Doc> {
    const existing = this.documents.get(noteId);

    if (existing) {
      // Document already loaded, increment ref count
      existing.refCount++;
      return existing.doc;
    }

    // Create new Yjs document
    const noteDoc = new NoteDoc(noteId);
    const doc = noteDoc.doc;

    // Load all updates from disk
    try {
      const updates = await this.updateManager.readNoteUpdates(noteId);

      for (const update of updates) {
        Y.applyUpdate(doc, update);
      }
    } catch (error) {
      console.error(`Failed to load updates for note ${noteId}:`, error);
      // Continue with empty document
    }

    // Store document state
    this.documents.set(noteId, {
      doc,
      noteId,
      refCount: 1,
      lastModified: Date.now(),
    });

    // Set up update listener to write changes to disk
    doc.on('update', (update: Uint8Array) => {
      this.handleUpdate(noteId, update).catch((error: Error) => {
        console.error(`Failed to handle update for note ${noteId}:`, error);
      });
    });

    return doc;
  }

  unloadNote(noteId: string): Promise<void> {
    const state = this.documents.get(noteId);

    if (!state) {
      return Promise.resolve();
    }

    state.refCount--;

    // Only actually unload if no more windows are using it
    if (state.refCount <= 0) {
      state.doc.destroy();
      this.documents.delete(noteId);
    }

    return Promise.resolve();
  }

  applyUpdate(noteId: string, update: Uint8Array): Promise<void> {
    const state = this.documents.get(noteId);

    if (!state) {
      throw new Error(`Note ${noteId} not loaded`);
    }

    // Apply update to in-memory document
    Y.applyUpdate(state.doc, update);
    state.lastModified = Date.now();

    return Promise.resolve();
  }

  getDocument(noteId: string): Y.Doc | undefined {
    return this.documents.get(noteId)?.doc;
  }

  /**
   * Handle document update by writing to disk
   */
  private async handleUpdate(noteId: string, update: Uint8Array): Promise<void> {
    const state = this.documents.get(noteId);

    if (!state) {
      return;
    }

    // Write update to disk
    await this.updateManager.writeNoteUpdate(noteId, update);

    state.lastModified = Date.now();
  }

  /**
   * Get all loaded document IDs
   */
  getLoadedNotes(): string[] {
    return Array.from(this.documents.keys());
  }

  /**
   * Clean up all documents
   */
  destroy(): void {
    for (const state of this.documents.values()) {
      state.doc.destroy();
    }
    this.documents.clear();
  }
}
