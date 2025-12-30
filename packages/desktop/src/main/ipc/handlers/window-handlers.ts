/**
 * Window Handlers
 *
 * IPC handlers for window operations: create window, open note info, open storage inspector.
 */

/* eslint-disable @typescript-eslint/require-await */

import { ipcMain, BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { HandlerContext } from './types';

/**
 * Register all window-related IPC handlers
 */
export function registerWindowHandlers(ctx: HandlerContext): void {
  // Only register if createWindowFn is provided
  if (ctx.createWindowFn) {
    ipcMain.handle('testing:createWindow', handleCreateWindow(ctx));
    ipcMain.handle('window:openNoteInfo', handleOpenNoteInfoWindow(ctx));
    ipcMain.handle('window:openStorageInspector', handleOpenStorageInspectorWindow(ctx));
    ipcMain.handle('window:openPrintPreview', handleOpenPrintPreviewWindow(ctx));
  }
}

/**
 * Unregister all window-related IPC handlers
 */
export function unregisterWindowHandlers(): void {
  ipcMain.removeHandler('testing:createWindow');
  ipcMain.removeHandler('window:openNoteInfo');
  ipcMain.removeHandler('window:openStorageInspector');
  ipcMain.removeHandler('window:openPrintPreview');
}

// =============================================================================
// Handler Factories
// =============================================================================

function handleCreateWindow(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    options?: { noteId?: string; minimal?: boolean }
  ): Promise<void> => {
    if (ctx.createWindowFn) {
      ctx.createWindowFn(options);
    }
  };
}

function handleOpenNoteInfoWindow(ctx: HandlerContext) {
  return async (
    event: IpcMainInvokeEvent,
    noteId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const { database, createWindowFn } = ctx;

    // Validate note exists
    const note = await database.getNote(noteId);
    if (!note) {
      return { success: false, error: 'Note not found' };
    }

    // Get the window that sent this IPC message
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    if (!parentWindow) {
      return { success: false, error: 'Could not determine parent window' };
    }

    // Create the Note Info window
    if (createWindowFn) {
      createWindowFn({
        noteInfo: true,
        targetNoteId: noteId,
        noteTitle: note.title,
        parentWindow: parentWindow,
      });
    }

    return { success: true };
  };
}

function handleOpenStorageInspectorWindow(ctx: HandlerContext) {
  return async (
    event: IpcMainInvokeEvent,
    sdId: string,
    sdPath: string,
    sdName: string
  ): Promise<{ success: boolean; error?: string }> => {
    const { createWindowFn } = ctx;

    // Get the window that sent this IPC message
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    if (!parentWindow) {
      return { success: false, error: 'Could not determine parent window' };
    }

    // Create the Storage Inspector window
    if (createWindowFn) {
      createWindowFn({
        storageInspector: true,
        sdId,
        sdPath,
        sdName,
      });
    }

    return { success: true };
  };
}

function handleOpenPrintPreviewWindow(ctx: HandlerContext) {
  return async (
    event: IpcMainInvokeEvent,
    noteId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const { database, createWindowFn } = ctx;

    // Validate note exists
    const note = await database.getNote(noteId);
    if (!note) {
      return { success: false, error: 'Note not found' };
    }

    // Get the window that sent this IPC message
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    if (!parentWindow) {
      return { success: false, error: 'Could not determine parent window' };
    }

    // Create the Print Preview window
    if (createWindowFn) {
      createWindowFn({
        printPreview: true,
        noteId: noteId,
        parentWindow: parentWindow,
      });
    }

    return { success: true };
  };
}
