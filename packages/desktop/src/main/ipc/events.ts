/**
 * IPC Event Emitter
 *
 * Sends events from main process to renderer processes.
 */

import { BrowserWindow } from 'electron';
import type { SyncProgress } from './types';

/* eslint-disable @typescript-eslint/no-extraneous-class */
export class IPCEvents {
  /**
   * Send note updated event to all renderer windows
   */
  static sendNoteUpdated(noteId: string, update: Uint8Array): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send('note:updated', noteId, update);
    }
  }

  /**
   * Send note deleted event to all renderer windows
   */
  static sendNoteDeleted(noteId: string): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send('note:deleted', noteId);
    }
  }

  /**
   * Send folder updated event to all renderer windows
   */
  static sendFolderUpdated(folderId: string): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send('folder:updated', folderId);
    }
  }

  /**
   * Send sync progress event to all renderer windows
   */
  static sendSyncProgress(sdId: string, progress: SyncProgress): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send('sync:progress', sdId, progress);
    }
  }
}
