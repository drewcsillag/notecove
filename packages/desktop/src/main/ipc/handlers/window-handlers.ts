/**
 * Window Handlers
 *
 * IPC handlers for window operations: create window, open note info, open storage inspector.
 */

/* eslint-disable @typescript-eslint/require-await */

import { ipcMain, BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { HandlerContext } from './types';

// Store JSON data for viewer windows (keyed by window id)
const jsonViewerData = new Map<number, { json: unknown; noteTitle: string }>();

/**
 * Get JSON data for a viewer window
 */
export function getJSONViewerData(windowId: number): { json: unknown; noteTitle: string } | undefined {
  return jsonViewerData.get(windowId);
}

/**
 * Clear JSON data for a viewer window
 */
export function clearJSONViewerData(windowId: number): void {
  jsonViewerData.delete(windowId);
}

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
  ipcMain.handle('window:openJSONViewer', handleOpenJSONViewerWindow());
  ipcMain.handle('window:getJSONViewerData', handleGetJSONViewerData());
}

/**
 * Unregister all window-related IPC handlers
 */
export function unregisterWindowHandlers(): void {
  ipcMain.removeHandler('testing:createWindow');
  ipcMain.removeHandler('window:openNoteInfo');
  ipcMain.removeHandler('window:openStorageInspector');
  ipcMain.removeHandler('window:openPrintPreview');
  ipcMain.removeHandler('window:openJSONViewer');
  ipcMain.removeHandler('window:getJSONViewerData');
}

// =============================================================================
// Handler Factories
// =============================================================================

function handleCreateWindow(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    options?: { noteId?: string; headingId?: string; minimal?: boolean }
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

function handleOpenJSONViewerWindow() {
  return async (
    event: IpcMainInvokeEvent,
    json: unknown,
    noteTitle: string
  ): Promise<{ success: boolean; error?: string }> => {
    // Get the window that sent this IPC message for positioning
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    const parentBounds = parentWindow?.getBounds();

    // Create a new window for the JSON viewer
    const windowOptions: Electron.BrowserWindowConstructorOptions = {
      width: 800,
      height: 600,
      title: `Note JSON - ${noteTitle}`,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    };
    // Only set position if parent bounds are available
    if (parentBounds) {
      windowOptions.x = parentBounds.x + 50;
      windowOptions.y = parentBounds.y + 50;
    }
    const jsonWindow = new BrowserWindow(windowOptions);

    // Store the JSON data for this window
    jsonViewerData.set(jsonWindow.id, { json, noteTitle });

    // Clean up when window closes
    jsonWindow.on('closed', () => {
      clearJSONViewerData(jsonWindow.id);
    });

    // Create inline HTML content with the JSON
    const jsonString = JSON.stringify(json, null, 2);
    const escapedJson = jsonString
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Note JSON - ${noteTitle}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 13px;
      background: #1e1e1e;
      color: #d4d4d4;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      background: #333;
      border-bottom: 1px solid #444;
      flex-shrink: 0;
    }
    .title {
      font-weight: 600;
      color: #fff;
    }
    .copy-btn {
      padding: 6px 12px;
      background: #0078d4;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    .copy-btn:hover {
      background: #1084d8;
    }
    .copy-btn.copied {
      background: #107c10;
    }
    .content {
      flex: 1;
      overflow: auto;
      padding: 16px;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="title">${noteTitle}</span>
    <button class="copy-btn" onclick="copyJSON()">Copy JSON</button>
  </div>
  <div class="content">
    <pre>${escapedJson}</pre>
  </div>
  <script>
    const jsonData = ${jsonString};
    function copyJSON() {
      navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2)).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy JSON';
          btn.classList.remove('copied');
        }, 2000);
      });
    }
  </script>
</body>
</html>`;

    void jsonWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    jsonWindow.show();

    return { success: true };
  };
}

function handleGetJSONViewerData() {
  return async (
    event: IpcMainInvokeEvent
  ): Promise<{ json: unknown; noteTitle: string } | null> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    return jsonViewerData.get(win.id) ?? null;
  };
}
