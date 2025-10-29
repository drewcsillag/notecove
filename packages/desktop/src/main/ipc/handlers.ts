/**
 * IPC Command Handlers
 *
 * Handles commands from renderer processes.
 */

/* eslint-disable @typescript-eslint/require-await */

import { ipcMain, type IpcMainInvokeEvent, BrowserWindow } from 'electron';
import * as Y from 'yjs';
import * as crypto from 'crypto';
import type { CRDTManager } from '../crdt';
import type { NoteMetadata } from './types';
import type { Database } from '@notecove/shared';

export class IPCHandlers {
  constructor(
    private crdtManager: CRDTManager,
    private database: Database,
    private createWindowFn?: () => void,
    private onStorageDirCreated?: (sdId: string, sdPath: string) => Promise<void>
  ) {
    this.registerHandlers();
  }

  /**
   * Broadcast an event to all renderer windows
   */
  private broadcastToAll(channel: string, ...args: unknown[]): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send(channel, ...args);
    }
  }

  private registerHandlers(): void {
    // Note operations
    ipcMain.handle('note:load', this.handleLoadNote.bind(this));
    ipcMain.handle('note:unload', this.handleUnloadNote.bind(this));
    ipcMain.handle('note:getState', this.handleGetState.bind(this));
    ipcMain.handle('note:applyUpdate', this.handleApplyUpdate.bind(this));
    ipcMain.handle('note:create', this.handleCreateNote.bind(this));
    ipcMain.handle('note:delete', this.handleDeleteNote.bind(this));
    ipcMain.handle('note:move', this.handleMoveNote.bind(this));
    ipcMain.handle('note:getMetadata', this.handleGetMetadata.bind(this));
    ipcMain.handle('note:updateTitle', this.handleUpdateTitle.bind(this));
    ipcMain.handle('note:list', this.handleListNotes.bind(this));

    // Folder operations
    ipcMain.handle('folder:list', this.handleListFolders.bind(this));
    ipcMain.handle('folder:get', this.handleGetFolder.bind(this));
    ipcMain.handle('folder:create', this.handleCreateFolder.bind(this));
    ipcMain.handle('folder:rename', this.handleRenameFolder.bind(this));
    ipcMain.handle('folder:delete', this.handleDeleteFolder.bind(this));
    ipcMain.handle('folder:move', this.handleMoveFolder.bind(this));

    // Storage Directory operations
    ipcMain.handle('sd:list', this.handleListStorageDirs.bind(this));
    ipcMain.handle('sd:create', this.handleCreateStorageDir.bind(this));
    ipcMain.handle('sd:setActive', this.handleSetActiveStorageDir.bind(this));
    ipcMain.handle('sd:getActive', this.handleGetActiveStorageDir.bind(this));

    // App state operations
    ipcMain.handle('appState:get', this.handleGetAppState.bind(this));
    ipcMain.handle('appState:set', this.handleSetAppState.bind(this));

    // Testing operations (only register if createWindowFn provided)
    if (this.createWindowFn) {
      ipcMain.handle('testing:createWindow', this.handleCreateWindow.bind(this));
    }
  }

  private async handleLoadNote(_event: IpcMainInvokeEvent, noteId: string): Promise<void> {
    // Get note from database to find its sdId
    const note = await this.database.getNote(noteId);
    const sdId = note?.sdId ?? 'default';

    await this.crdtManager.loadNote(noteId, sdId);

    // Sync CRDT metadata to SQLite cache
    const noteDoc = this.crdtManager.getNoteDoc(noteId);
    if (noteDoc) {
      const crdtMetadata = noteDoc.getMetadata();

      // Only update if note exists in cache and CRDT has initialized metadata
      if (note && crdtMetadata.id) {
        await this.database.upsertNote({
          ...note,
          folderId: crdtMetadata.folderId,
          created: crdtMetadata.created,
          modified: crdtMetadata.modified,
          deleted: crdtMetadata.deleted,
        });
      }
    }
  }

  private async handleUnloadNote(_event: IpcMainInvokeEvent, noteId: string): Promise<void> {
    await this.crdtManager.unloadNote(noteId);
  }

  private async handleGetState(_event: IpcMainInvokeEvent, noteId: string): Promise<Uint8Array> {
    const doc = this.crdtManager.getDocument(noteId);
    if (!doc) {
      throw new Error(`Note ${noteId} not loaded`);
    }
    // Encode the entire document state as an update
    return Y.encodeStateAsUpdate(doc);
  }

  private async handleApplyUpdate(
    _event: IpcMainInvokeEvent,
    noteId: string,
    update: Uint8Array
  ): Promise<void> {
    await this.crdtManager.applyUpdate(noteId, update);

    // Broadcast update to all other windows
    this.broadcastToAll('note:updated', noteId, update);
  }

  private async handleCreateNote(
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string | null,
    initialContent?: string
  ): Promise<string> {
    // Generate new note ID
    const noteId = crypto.randomUUID();

    // Load the note (creates empty CRDT document) with explicit sdId
    await this.crdtManager.loadNote(noteId, sdId);

    // Initialize CRDT metadata with SD and folder association
    const noteDoc = this.crdtManager.getNoteDoc(noteId);
    if (noteDoc) {
      const now = Date.now();
      noteDoc.initializeNote({
        id: noteId,
        created: now,
        modified: now,
        sdId: sdId,
        folderId: folderId,
        deleted: false,
      });
    } else {
      console.error(`[Note] Failed to get NoteDoc for ${noteId} after loading`);
    }

    // If initial content provided, apply it to the CRDT
    if (initialContent) {
      // TODO: Convert initialContent to ProseMirror structure and insert
      // For now, just create empty document
      console.log('[Note] Initial content not yet implemented:', initialContent);
    }

    // Create note cache entry in SQLite
    await this.database.upsertNote({
      id: noteId,
      title: 'Untitled',
      sdId,
      folderId,
      created: Date.now(),
      modified: Date.now(),
      deleted: false,
      contentPreview: '',
      contentText: '',
    });

    // Broadcast note creation to all windows
    this.broadcastToAll('note:created', { sdId, noteId, folderId });

    return noteId;
  }

  private async handleDeleteNote(_event: IpcMainInvokeEvent, _noteId: string): Promise<void> {
    // TODO: Implement note deletion
    throw new Error('Not implemented');
  }

  private async handleMoveNote(
    _event: IpcMainInvokeEvent,
    noteId: string,
    newFolderId: string | null
  ): Promise<void> {
    // Get the note from cache to find its current location
    const note = await this.database.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    // Update CRDT metadata with new folder
    const noteDoc = this.crdtManager.getNoteDoc(noteId);
    if (noteDoc) {
      noteDoc.updateMetadata({
        folderId: newFolderId,
        modified: Date.now(),
      });
    } else {
      // Note not loaded in memory, load it first with its sdId
      await this.crdtManager.loadNote(noteId, note.sdId);
      const loadedNoteDoc = this.crdtManager.getNoteDoc(noteId);
      if (loadedNoteDoc) {
        loadedNoteDoc.updateMetadata({
          folderId: newFolderId,
          modified: Date.now(),
        });
      } else {
        console.error(`[Note] Failed to load NoteDoc for ${noteId}`);
      }
    }

    // Update SQLite cache
    await this.database.upsertNote({
      ...note,
      folderId: newFolderId,
      modified: Date.now(),
    });

    // Broadcast move event
    this.broadcastToAll('note:moved', { noteId, oldFolderId: note.folderId, newFolderId });
  }

  private async handleGetMetadata(
    _event: IpcMainInvokeEvent,
    noteId: string
  ): Promise<NoteMetadata> {
    // Get note from SQLite cache for title
    const note = await this.database.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    // Try to get metadata from CRDT if loaded
    const noteDoc = this.crdtManager.getNoteDoc(noteId);
    let crdtMetadata: import('@notecove/shared').NoteMetadata | null = null;

    if (noteDoc) {
      crdtMetadata = noteDoc.getMetadata();
    } else {
      // Load note to get CRDT metadata with its sdId
      await this.crdtManager.loadNote(noteId, note.sdId);
      const loadedNoteDoc = this.crdtManager.getNoteDoc(noteId);
      if (loadedNoteDoc) {
        crdtMetadata = loadedNoteDoc.getMetadata();
      }
    }

    // Return metadata, preferring CRDT metadata for folderId
    return {
      noteId: noteId,
      title: note.title,
      folderId: crdtMetadata?.folderId ?? note.folderId ?? '',
      createdAt: crdtMetadata?.created ?? note.created,
      modifiedAt: crdtMetadata?.modified ?? note.modified,
    };
  }

  private async handleUpdateTitle(
    _event: IpcMainInvokeEvent,
    noteId: string,
    title: string
  ): Promise<void> {
    console.log(`[IPC] handleUpdateTitle called - noteId: ${noteId}, title: "${title}"`);

    // Get existing note from database
    const note = await this.database.getNote(noteId);
    if (!note) {
      console.error(`[IPC] Note ${noteId} not found in database`);
      throw new Error(`Note ${noteId} not found`);
    }

    console.log(`[IPC] Found note in database, current title: "${note.title}"`);

    // Update title and modified timestamp
    await this.database.upsertNote({
      ...note,
      title,
      modified: Date.now(),
    });

    console.log(`[IPC] Title updated successfully in database`);

    // Broadcast title update to all windows so they can refresh their notes list
    this.broadcastToAll('note:titleUpdated', { noteId, title });
  }

  private async handleListNotes(
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId?: string | null
  ): Promise<import('@notecove/shared').NoteCache[]> {
    // If folderId is provided, filter by folder (including null for root folder)
    if (folderId !== undefined) {
      return await this.database.getNotesByFolder(folderId);
    }
    // Otherwise, return all notes for the SD (backward compatibility)
    return await this.database.getNotesBySd(sdId);
  }

  private async handleListFolders(
    _event: IpcMainInvokeEvent,
    sdId: string
  ): Promise<import('@notecove/shared').FolderData[]> {
    const folderTree = this.crdtManager.loadFolderTree(sdId);
    return folderTree.getActiveFolders();
  }

  private async handleGetFolder(
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string
  ): Promise<import('@notecove/shared').FolderData | null> {
    const folderTree = this.crdtManager.loadFolderTree(sdId);
    return folderTree.getFolder(folderId);
  }

  private async handleCreateFolder(
    _event: IpcMainInvokeEvent,
    sdId: string,
    parentId: string | null,
    name: string
  ): Promise<string> {
    // Validate name
    if (!name || name.trim().length === 0) {
      throw new Error('Folder name cannot be empty');
    }

    const trimmedName = name.trim();

    // Check for name conflicts with siblings
    const folderTree = this.crdtManager.loadFolderTree(sdId);
    const siblings =
      parentId === null ? folderTree.getRootFolders() : folderTree.getChildFolders(parentId);

    const nameConflict = siblings.some((f) => f.name.toLowerCase() === trimmedName.toLowerCase());

    if (nameConflict) {
      throw new Error(`A folder named "${trimmedName}" already exists in this location`);
    }

    // Generate new folder ID
    const folderId = crypto.randomUUID();

    // Determine order (last in the list)
    const maxOrder = siblings.reduce((max, f) => Math.max(max, f.order), -1);
    const order = maxOrder + 1;

    // Create folder data
    const folderData: import('@notecove/shared').FolderData = {
      id: folderId,
      name: trimmedName,
      parentId,
      sdId,
      order,
      deleted: false,
    };

    // Update CRDT
    folderTree.createFolder(folderData);

    // Update SQLite cache
    await this.database.upsertFolder({
      id: folderId,
      name: trimmedName,
      parentId,
      sdId,
      order,
      deleted: false,
    });

    // Broadcast folder update to all windows
    this.broadcastToAll('folder:updated', { sdId, operation: 'create', folderId });

    return folderId;
  }

  private async handleRenameFolder(
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string,
    newName: string
  ): Promise<void> {
    // Validate name
    if (!newName || newName.trim().length === 0) {
      throw new Error('Folder name cannot be empty');
    }

    const trimmedName = newName.trim();
    const folderTree = this.crdtManager.loadFolderTree(sdId);
    const folder = folderTree.getFolder(folderId);

    if (!folder) {
      throw new Error(`Folder ${folderId} not found`);
    }

    // Check for name conflicts with siblings
    const siblings =
      folder.parentId === null
        ? folderTree.getRootFolders()
        : folderTree.getChildFolders(folder.parentId);

    const nameConflict = siblings.some(
      (f) => f.id !== folderId && f.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (nameConflict) {
      throw new Error(`A folder named "${trimmedName}" already exists in this location`);
    }

    // Update CRDT
    folderTree.updateFolder(folderId, { name: trimmedName });

    // Update SQLite cache
    await this.database.upsertFolder({
      ...folder,
      name: trimmedName,
    });

    // Broadcast folder update to all windows
    this.broadcastToAll('folder:updated', { sdId, operation: 'rename', folderId });
  }

  private async handleDeleteFolder(
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string
  ): Promise<void> {
    const folderTree = this.crdtManager.loadFolderTree(sdId);
    const folder = folderTree.getFolder(folderId);

    if (!folder) {
      throw new Error(`Folder ${folderId} not found`);
    }

    // Soft delete in CRDT
    folderTree.deleteFolder(folderId);

    // Update SQLite cache
    await this.database.upsertFolder({
      ...folder,
      deleted: true,
    });

    // Broadcast folder update to all windows
    this.broadcastToAll('folder:updated', { sdId, operation: 'delete', folderId });
  }

  private async handleMoveFolder(
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string,
    newParentId: string | null
  ): Promise<void> {
    const folderTree = this.crdtManager.loadFolderTree(sdId);
    const folder = folderTree.getFolder(folderId);

    if (!folder) {
      throw new Error(`Folder ${folderId} not found`);
    }

    // Prevent moving folder to be its own descendant (circular reference)
    if (newParentId !== null) {
      const isDescendant = (ancestorId: string, descendantId: string): boolean => {
        let current = folderTree.getFolder(descendantId);
        while (current) {
          if (current.id === ancestorId) {
            return true;
          }
          if (current.parentId === null) {
            break;
          }
          current = folderTree.getFolder(current.parentId);
        }
        return false;
      };

      if (isDescendant(folderId, newParentId)) {
        throw new Error('Cannot move folder to be its own descendant');
      }
    }

    // Calculate new order (append to end of siblings)
    const siblings =
      newParentId === null ? folderTree.getRootFolders() : folderTree.getChildFolders(newParentId);

    const maxOrder = siblings.reduce((max, f) => Math.max(max, f.order), -1);
    const newOrder = maxOrder + 1;

    // Update CRDT
    folderTree.updateFolder(folderId, { parentId: newParentId, order: newOrder });

    // Update SQLite cache
    await this.database.upsertFolder({
      ...folder,
      parentId: newParentId,
      order: newOrder,
    });

    // Broadcast folder update to all windows
    this.broadcastToAll('folder:updated', { sdId, operation: 'move', folderId });
  }

  private async handleGetAppState(_event: IpcMainInvokeEvent, key: string): Promise<string | null> {
    return await this.database.getState(key);
  }

  private async handleSetAppState(
    _event: IpcMainInvokeEvent,
    key: string,
    value: string
  ): Promise<void> {
    await this.database.setState(key, value);
  }

  // ============================================================================
  // Storage Directory Handlers
  // ============================================================================

  private async handleListStorageDirs(
    _event: IpcMainInvokeEvent
  ): Promise<{ id: string; name: string; path: string; created: number; isActive: boolean }[]> {
    return await this.database.getAllStorageDirs();
  }

  private async handleCreateStorageDir(
    _event: IpcMainInvokeEvent,
    name: string,
    path: string
  ): Promise<string> {
    const id = crypto.randomUUID();
    await this.database.createStorageDir(id, name, path);

    // Initialize the new SD (register with UpdateManager, set up watchers, etc.)
    if (this.onStorageDirCreated) {
      await this.onStorageDirCreated(id, path);
    }

    // Broadcast SD update to all windows
    this.broadcastToAll('sd:updated', { operation: 'create', sdId: id });

    return id;
  }

  private async handleSetActiveStorageDir(_event: IpcMainInvokeEvent, sdId: string): Promise<void> {
    await this.database.setActiveStorageDir(sdId);

    // Broadcast SD update to all windows
    this.broadcastToAll('sd:updated', { operation: 'setActive', sdId });
  }

  private async handleGetActiveStorageDir(_event: IpcMainInvokeEvent): Promise<string | null> {
    const activeSD = await this.database.getActiveStorageDir();
    return activeSD ? activeSD.id : null;
  }

  /**
   * Testing: Create a new window
   */
  private async handleCreateWindow(_event: IpcMainInvokeEvent): Promise<void> {
    if (this.createWindowFn) {
      this.createWindowFn();
    }
  }

  /**
   * Clean up all handlers
   */
  destroy(): void {
    ipcMain.removeHandler('note:load');
    ipcMain.removeHandler('note:unload');
    ipcMain.removeHandler('note:getState');
    ipcMain.removeHandler('note:applyUpdate');
    ipcMain.removeHandler('note:create');
    ipcMain.removeHandler('note:delete');
    ipcMain.removeHandler('note:move');
    ipcMain.removeHandler('note:getMetadata');
    ipcMain.removeHandler('note:updateTitle');
    ipcMain.removeHandler('note:list');
    ipcMain.removeHandler('folder:list');
    ipcMain.removeHandler('folder:get');
    ipcMain.removeHandler('folder:create');
    ipcMain.removeHandler('folder:rename');
    ipcMain.removeHandler('folder:delete');
    ipcMain.removeHandler('folder:move');
    ipcMain.removeHandler('sd:list');
    ipcMain.removeHandler('sd:create');
    ipcMain.removeHandler('sd:setActive');
    ipcMain.removeHandler('sd:getActive');
    ipcMain.removeHandler('appState:get');
    ipcMain.removeHandler('appState:set');

    if (this.createWindowFn) {
      ipcMain.removeHandler('testing:createWindow');
    }
  }
}
