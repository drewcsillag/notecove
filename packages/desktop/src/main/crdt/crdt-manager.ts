/**
 * CRDT Manager Implementation
 *
 * Manages in-memory Yjs documents for notes.
 * All renderer windows connect to the same in-memory document via IPC.
 */

import * as Y from 'yjs';
import type { CRDTManager, DocumentState } from './types';
import { NoteDoc, FolderTreeDoc } from '@shared/crdt';
import type { UpdateManager } from '@shared/storage';
import type { UUID, FolderData } from '@shared/types';

export class CRDTManagerImpl implements CRDTManager {
  private documents = new Map<string, DocumentState>();
  private folderTrees = new Map<string, FolderTreeDoc>();

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
   * Load folder tree for an SD
   */
  loadFolderTree(sdId: string): FolderTreeDoc {
    const existing = this.folderTrees.get(sdId);
    if (existing) {
      return existing;
    }

    // Create new FolderTreeDoc
    const folderTree = new FolderTreeDoc(sdId);

    // TODO: Load updates from disk (Phase 2.4.2)
    // For now, create some demo folders for testing
    if (sdId === 'default') {
      this.createDemoFolders(folderTree);
    }

    this.folderTrees.set(sdId, folderTree);
    return folderTree;
  }

  /**
   * Get loaded folder tree
   */
  getFolderTree(sdId: string): FolderTreeDoc | undefined {
    return this.folderTrees.get(sdId);
  }

  /**
   * Create demo folders for testing (Phase 2.4.1 only)
   * TODO: Remove in Phase 2.4.2 when we have real folder creation
   */
  private createDemoFolders(folderTree: FolderTreeDoc): void {
    const folders: FolderData[] = [
      {
        id: 'folder-1' as UUID,
        name: 'Work',
        parentId: null,
        sdId: 'default',
        order: 0,
        deleted: false,
      },
      {
        id: 'folder-2' as UUID,
        name: 'Projects',
        parentId: 'folder-1' as UUID,
        sdId: 'default',
        order: 0,
        deleted: false,
      },
      {
        id: 'folder-3' as UUID,
        name: 'Personal',
        parentId: null,
        sdId: 'default',
        order: 1,
        deleted: false,
      },
      {
        id: 'folder-4' as UUID,
        name: 'Ideas',
        parentId: 'folder-3' as UUID,
        sdId: 'default',
        order: 0,
        deleted: false,
      },
      {
        id: 'folder-5' as UUID,
        name: 'Recipes',
        parentId: 'folder-3' as UUID,
        sdId: 'default',
        order: 1,
        deleted: false,
      },
    ];

    for (const folder of folders) {
      folderTree.createFolder(folder);
    }
  }

  /**
   * Clean up all documents
   */
  destroy(): void {
    for (const state of this.documents.values()) {
      state.doc.destroy();
    }
    this.documents.clear();

    for (const folderTree of this.folderTrees.values()) {
      folderTree.destroy();
    }
    this.folderTrees.clear();
  }
}
