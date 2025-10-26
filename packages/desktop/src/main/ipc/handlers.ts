/**
 * IPC Command Handlers
 *
 * Handles commands from renderer processes.
 */

/* eslint-disable @typescript-eslint/require-await */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { CRDTManager } from '../crdt';
import type { NoteMetadata } from './types';
import type { Database } from '@notecove/shared';

export class IPCHandlers {
  constructor(
    private crdtManager: CRDTManager,
    private database: Database
  ) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Note operations
    ipcMain.handle('note:load', this.handleLoadNote.bind(this));
    ipcMain.handle('note:unload', this.handleUnloadNote.bind(this));
    ipcMain.handle('note:applyUpdate', this.handleApplyUpdate.bind(this));
    ipcMain.handle('note:create', this.handleCreateNote.bind(this));
    ipcMain.handle('note:delete', this.handleDeleteNote.bind(this));
    ipcMain.handle('note:move', this.handleMoveNote.bind(this));
    ipcMain.handle('note:getMetadata', this.handleGetMetadata.bind(this));

    // Folder operations
    ipcMain.handle('folder:list', this.handleListFolders.bind(this));
    ipcMain.handle('folder:get', this.handleGetFolder.bind(this));
    ipcMain.handle('folder:create', this.handleCreateFolder.bind(this));
    ipcMain.handle('folder:delete', this.handleDeleteFolder.bind(this));

    // App state operations
    ipcMain.handle('appState:get', this.handleGetAppState.bind(this));
    ipcMain.handle('appState:set', this.handleSetAppState.bind(this));
  }

  private async handleLoadNote(_event: IpcMainInvokeEvent, noteId: string): Promise<void> {
    await this.crdtManager.loadNote(noteId);
  }

  private async handleUnloadNote(_event: IpcMainInvokeEvent, noteId: string): Promise<void> {
    await this.crdtManager.unloadNote(noteId);
  }

  private async handleApplyUpdate(
    _event: IpcMainInvokeEvent,
    noteId: string,
    update: Uint8Array
  ): Promise<void> {
    await this.crdtManager.applyUpdate(noteId, update);
  }

  private async handleCreateNote(
    _event: IpcMainInvokeEvent,
    _sdId: string,
    _folderId: string,
    _initialContent: string
  ): Promise<string> {
    // TODO: Implement note creation
    throw new Error('Not implemented');
  }

  private async handleDeleteNote(_event: IpcMainInvokeEvent, _noteId: string): Promise<void> {
    // TODO: Implement note deletion
    throw new Error('Not implemented');
  }

  private async handleMoveNote(
    _event: IpcMainInvokeEvent,
    _noteId: string,
    _newFolderId: string
  ): Promise<void> {
    // TODO: Implement note moving
    throw new Error('Not implemented');
  }

  private async handleGetMetadata(
    _event: IpcMainInvokeEvent,
    _noteId: string
  ): Promise<NoteMetadata> {
    // TODO: Implement metadata retrieval from SQLite
    throw new Error('Not implemented');
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
    _sdId: string,
    _parentId: string,
    _name: string
  ): Promise<string> {
    // TODO: Implement folder creation (Phase 2.4.2)
    throw new Error('Not implemented');
  }

  private async handleDeleteFolder(_event: IpcMainInvokeEvent, _folderId: string): Promise<void> {
    // TODO: Implement folder deletion (Phase 2.4.2)
    throw new Error('Not implemented');
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

  /**
   * Clean up all handlers
   */
  destroy(): void {
    ipcMain.removeHandler('note:load');
    ipcMain.removeHandler('note:unload');
    ipcMain.removeHandler('note:applyUpdate');
    ipcMain.removeHandler('note:create');
    ipcMain.removeHandler('note:delete');
    ipcMain.removeHandler('note:move');
    ipcMain.removeHandler('note:getMetadata');
    ipcMain.removeHandler('folder:list');
    ipcMain.removeHandler('folder:get');
    ipcMain.removeHandler('folder:create');
    ipcMain.removeHandler('folder:delete');
    ipcMain.removeHandler('appState:get');
    ipcMain.removeHandler('appState:set');
  }
}
