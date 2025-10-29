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
import type { Database } from '@notecove/shared';

export class CRDTManagerImpl implements CRDTManager {
  private documents = new Map<string, DocumentState>();
  private folderTrees = new Map<string, FolderTreeDoc>();
  private activityLoggers = new Map<string, import('@shared/storage').ActivityLogger>();

  constructor(
    private updateManager: UpdateManager,
    private database?: Database
  ) {}

  async loadNote(noteId: string, sdId?: string): Promise<Y.Doc> {
    const existing = this.documents.get(noteId);

    if (existing) {
      // Document already loaded, increment ref count
      existing.refCount++;
      return existing.doc;
    }

    // If sdId not provided, try to determine it from existing updates
    let noteSdId = sdId;
    if (!noteSdId) {
      noteSdId = await this.getNoteSdId(noteId);
    }

    // Create new Yjs document
    const noteDoc = new NoteDoc(noteId);
    const doc = noteDoc.doc;

    // Load all updates from disk
    try {
      const updates = await this.updateManager.readNoteUpdates(noteSdId, noteId);
      console.log(
        `[CRDT Manager] Loading note ${noteId} from SD ${noteSdId}, found ${updates.length} updates from disk`
      );

      for (const update of updates) {
        console.log(`[CRDT Manager] Applying update of size ${update.length} bytes`);
        Y.applyUpdate(doc, update);
      }
    } catch (error) {
      console.error(`Failed to load updates for note ${noteId}:`, error);
      // Continue with empty document
    }

    // Store document state
    this.documents.set(noteId, {
      doc,
      noteDoc,
      noteId,
      sdId: noteSdId,
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

  async applyUpdate(noteId: string, update: Uint8Array): Promise<void> {
    const state = this.documents.get(noteId);

    if (!state) {
      throw new Error(`Note ${noteId} not loaded`);
    }

    console.log(`[CRDT Manager] Applying update to note ${noteId}, size: ${update.length} bytes`);

    // Apply update to in-memory document
    Y.applyUpdate(state.doc, update);
    state.lastModified = Date.now();

    // Write update to disk (Y.applyUpdate doesn't trigger the 'update' event)
    await this.handleUpdate(noteId, update);
    console.log(`[CRDT Manager] Update written to disk for note ${noteId}`);
  }

  getDocument(noteId: string): Y.Doc | undefined {
    return this.documents.get(noteId)?.doc;
  }

  getNoteDoc(noteId: string): NoteDoc | undefined {
    return this.documents.get(noteId)?.noteDoc;
  }

  /**
   * Handle document update by writing to disk
   */
  private async handleUpdate(noteId: string, update: Uint8Array): Promise<void> {
    const state = this.documents.get(noteId);

    if (!state) {
      return;
    }

    // Write update to disk using the note's SD ID
    await this.updateManager.writeNoteUpdate(state.sdId, noteId, update);

    state.lastModified = Date.now();

    // Record activity for cross-instance sync using the correct SD's activity logger
    const activityLogger = this.activityLoggers.get(state.sdId);
    if (activityLogger) {
      try {
        console.log(`[CRDT Manager] Recording activity for note ${noteId} in SD ${state.sdId}`);
        await activityLogger.recordNoteActivity(noteId, state.refCount);
      } catch (error) {
        // Don't let activity logging errors break the update
        console.error(`[CRDT Manager] Failed to record activity for note ${noteId}:`, error);
      }
    } else {
      console.warn(
        `[CRDT Manager] No activity logger found for SD ${state.sdId} when updating note ${noteId}`
      );
      console.warn(`[CRDT Manager] Available loggers:`, Array.from(this.activityLoggers.keys()));
    }
  }

  /**
   * Get all loaded document IDs
   */
  getLoadedNotes(): string[] {
    return Array.from(this.documents.keys());
  }

  /**
   * Reload a note from disk
   *
   * Re-reads all updates from disk and applies them to the in-memory document.
   * This is used for cross-instance synchronization.
   */
  async reloadNote(noteId: string): Promise<void> {
    const state = this.documents.get(noteId);
    if (!state) {
      // Note not loaded, nothing to do
      return;
    }

    try {
      // Re-read all updates from disk using the note's SD ID
      const updates = await this.updateManager.readNoteUpdates(state.sdId, noteId);

      // Apply all updates (Yjs will automatically merge and deduplicate)
      for (const update of updates) {
        Y.applyUpdate(state.doc, update, 'reload');
      }

      state.lastModified = Date.now();
    } catch (error) {
      console.error(`Failed to reload note ${noteId}:`, error);
    }
  }

  /**
   * Set the activity logger for a specific SD
   *
   * This is called by the main process after initialization of each SD.
   */
  setActivityLogger(sdId: string, logger: import('@shared/storage').ActivityLogger): void {
    console.log(`[CRDT Manager] Registering activity logger for SD: ${sdId}`);
    this.activityLoggers.set(sdId, logger);
    console.log(`[CRDT Manager] Total activity loggers registered:`, this.activityLoggers.size);
  }

  /**
   * Load folder tree for an SD (synchronous, but loads from disk asynchronously in background)
   */
  loadFolderTree(sdId: string): FolderTreeDoc {
    const existing = this.folderTrees.get(sdId);
    if (existing) {
      return existing;
    }

    // Create new FolderTreeDoc
    const folderTree = new FolderTreeDoc(sdId);

    // Set up update listener to write changes to disk
    folderTree.doc.on('update', (update: Uint8Array, origin: unknown) => {
      this.handleFolderUpdate(sdId, update, origin).catch((error: Error) => {
        console.error(`Failed to handle folder update for ${sdId}:`, error);
      });
    });

    this.folderTrees.set(sdId, folderTree);

    // Load updates from disk (this will trigger the update listener, but we need
    // to temporarily disable it to avoid saving the loaded updates back to disk)
    this.loadFolderTreeUpdatesSync(sdId, folderTree);

    return folderTree;
  }

  /**
   * Synchronously load folder tree updates from disk
   */
  private loadFolderTreeUpdatesSync(sdId: string, folderTree: FolderTreeDoc): void {
    // Use setImmediate to load updates asynchronously but immediately
    setImmediate(() => {
      this.loadFolderTreeUpdates(sdId, folderTree).catch((err) => {
        console.error(`Failed to load folder tree updates for ${sdId}:`, err);
      });
    });
  }

  /**
   * Load folder tree updates from disk
   */
  private async loadFolderTreeUpdates(sdId: string, folderTree: FolderTreeDoc): Promise<void> {
    try {
      // Read updates for this specific SD only
      const updates = await this.updateManager.readFolderUpdates(sdId);

      // Apply all updates with 'load' origin to prevent triggering persistence
      for (const update of updates) {
        Y.applyUpdate(folderTree.doc, update, 'load');
      }

      // If no updates were found (new installation), create demo folders
      if (updates.length === 0 && sdId === 'default') {
        this.createDemoFolders(folderTree);
      }
    } catch (error) {
      console.error(`Failed to load folder tree updates for ${sdId}:`, error);
      // On error, create demo folders for default SD
      if (sdId === 'default') {
        this.createDemoFolders(folderTree);
      }
    }
  }

  /**
   * Handle folder tree update by writing to disk
   */
  private async handleFolderUpdate(
    sdId: string,
    update: Uint8Array,
    origin: unknown
  ): Promise<void> {
    // Don't persist updates that originated from loading (would create duplicate files)
    if (origin === 'load') {
      return;
    }

    // Write update to disk
    await this.updateManager.writeFolderUpdate(sdId, update);
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
   * Get the SD ID for a note by querying the database
   * @param noteId Note ID
   * @returns SD ID or 'default' as fallback
   */
  private async getNoteSdId(noteId: string): Promise<string> {
    // Try to get from loaded document first (optimization)
    const state = this.documents.get(noteId);
    if (state?.sdId) {
      return state.sdId;
    }

    // Query database for the note's SD ID
    if (this.database) {
      try {
        const note = await this.database.getNote(noteId);
        if (note?.sdId) {
          return note.sdId;
        }
      } catch (error) {
        console.error(`[CRDT Manager] Failed to query database for note ${noteId}:`, error);
      }
    }

    // Fallback to default SD
    console.log(`[CRDT Manager] No sdId found for note ${noteId}, using 'default'`);
    return 'default';
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
