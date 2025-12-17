/**
 * Export/Import Handlers
 *
 * IPC handlers for export and import operations.
 */

/* eslint-disable @typescript-eslint/require-await */

import { ipcMain, dialog, BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import * as Y from 'yjs';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { HandlerContext } from './types';
import { ImportService } from '../../import/import-service';
import { scanPath } from '../../import/file-scanner';
import type { ImportProgress, ImportOptions, ScanResult } from '../../import/types';

// Module-level state for current import
let currentImport: ImportService | undefined;

/**
 * Register all export/import-related IPC handlers
 */
export function registerExportImportHandlers(ctx: HandlerContext): void {
  // Export operations
  ipcMain.handle('export:selectDirectory', handleSelectExportDirectory(ctx));
  ipcMain.handle('export:writeFile', handleWriteExportFile(ctx));
  ipcMain.handle('export:createDirectory', handleCreateExportDirectory(ctx));
  ipcMain.handle('export:getNotesForExport', handleGetNotesForExport(ctx));
  ipcMain.handle('export:showCompletionMessage', handleShowExportCompletion(ctx));
  ipcMain.handle('export:copyImageFile', handleCopyImageForExport(ctx));

  // Import operations
  ipcMain.handle('import:selectSource', handleSelectImportSource(ctx));
  ipcMain.handle('import:scanSource', handleScanImportSource(ctx));
  ipcMain.handle('import:execute', handleExecuteImport(ctx));
  ipcMain.handle('import:cancel', handleCancelImport(ctx));
}

/**
 * Unregister all export/import-related IPC handlers
 */
export function unregisterExportImportHandlers(): void {
  ipcMain.removeHandler('export:selectDirectory');
  ipcMain.removeHandler('export:writeFile');
  ipcMain.removeHandler('export:createDirectory');
  ipcMain.removeHandler('export:getNotesForExport');
  ipcMain.removeHandler('export:showCompletionMessage');
  ipcMain.removeHandler('export:copyImageFile');

  ipcMain.removeHandler('import:selectSource');
  ipcMain.removeHandler('import:scanSource');
  ipcMain.removeHandler('import:execute');
  ipcMain.removeHandler('import:cancel');
}

// =============================================================================
// Export Handler Factories
// =============================================================================

function handleSelectExportDirectory(_ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Export Destination',
      buttonLabel: 'Export Here',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0] ?? null;
  };
}

function handleWriteExportFile(_ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    filePath: string,
    content: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Export] Failed to write file ${filePath}:`, message);
      return { success: false, error: message };
    }
  };
}

function handleCreateExportDirectory(_ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    dirPath: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Export] Failed to create directory ${dirPath}:`, message);
      return { success: false, error: message };
    }
  };
}

function handleGetNotesForExport(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteIds: string[]
  ): Promise<
    {
      id: string;
      title: string;
      folderId: string | null;
      sdId: string;
      content: unknown;
      isEmpty: boolean;
    }[]
  > => {
    const { database, crdtManager } = ctx;
    const results: {
      id: string;
      title: string;
      folderId: string | null;
      sdId: string;
      content: unknown;
      isEmpty: boolean;
    }[] = [];

    for (const noteId of noteIds) {
      try {
        const note = await database.getNote(noteId);
        if (!note) continue;

        // Load the note if not already loaded
        await crdtManager.loadNote(noteId, note.sdId);

        // Get the Y.Doc
        const doc = crdtManager.getDocument(noteId);
        if (!doc) continue;

        // Get the content as XML fragment and convert to JSON
        const content = doc.getXmlFragment('content');

        // Check if content is empty
        const isEmpty = content.length === 0;

        // Convert Y.XmlFragment to JSON structure that matches TipTap's JSONContent
        const jsonContent = xmlFragmentToJson(content);

        results.push({
          id: noteId,
          title: note.title || 'Untitled',
          folderId: note.folderId,
          sdId: note.sdId,
          content: jsonContent,
          isEmpty,
        });
      } catch (error) {
        console.error(`[Export] Failed to get note ${noteId}:`, error);
        // Skip this note but continue with others
      }
    }

    return results;
  };
}

function handleCopyImageForExport(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    imageId: string,
    destPath: string
  ): Promise<{ success: boolean; error?: string; extension?: string }> => {
    const { database } = ctx;

    try {
      // Get image metadata from database
      const image = await database.getImage(imageId);
      if (!image) {
        return { success: false, error: `Image ${imageId} not found in database` };
      }

      // Get SD from database
      const sd = await database.getStorageDir(sdId);
      if (!sd) {
        return { success: false, error: `Sync directory ${sdId} not found` };
      }

      // Build source path
      const sourcePath = path.join(sd.path, 'media', image.filename);

      // Check if source exists
      try {
        await fs.access(sourcePath);
      } catch {
        return { success: false, error: `Image file not found at ${sourcePath}` };
      }

      // Get the file extension from the original filename
      const extension = path.extname(image.filename);

      // Build full destination path with extension
      const fullDestPath = destPath + extension;

      // Ensure destination directory exists
      const destDir = path.dirname(fullDestPath);
      await fs.mkdir(destDir, { recursive: true });

      // Copy the file
      await fs.copyFile(sourcePath, fullDestPath);

      console.log(`[Export] Copied image ${imageId} to ${fullDestPath}`);
      return { success: true, extension };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Export] Failed to copy image ${imageId}:`, message);
      return { success: false, error: message };
    }
  };
}

function handleShowExportCompletion(_ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    exportedCount: number,
    skippedCount: number,
    destinationPath: string,
    errors: string[]
  ): Promise<void> => {
    let message = `Successfully exported ${exportedCount} note${exportedCount !== 1 ? 's' : ''} to:\n${destinationPath}`;

    if (skippedCount > 0) {
      message += `\n\nSkipped ${skippedCount} empty note${skippedCount !== 1 ? 's' : ''}.`;
    }

    if (errors.length > 0) {
      message += `\n\nErrors:\n${errors.slice(0, 5).join('\n')}`;
      if (errors.length > 5) {
        message += `\n... and ${errors.length - 5} more errors`;
      }
    }

    await dialog.showMessageBox({
      type: errors.length > 0 ? 'warning' : 'info',
      title: 'Export Complete',
      message: errors.length > 0 ? 'Export completed with errors' : 'Export Complete',
      detail: message,
      buttons: ['OK'],
    });
  };
}

// =============================================================================
// Import Handler Factories
// =============================================================================

function handleSelectImportSource(_ctx: HandlerContext) {
  return async (event: IpcMainInvokeEvent, type: 'file' | 'folder'): Promise<string | null> => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const targetWindow = window ?? BrowserWindow.getFocusedWindow();
    if (!targetWindow) {
      throw new Error('No window available for dialog');
    }
    const result =
      type === 'folder'
        ? await dialog.showOpenDialog(targetWindow, {
            properties: ['openDirectory'],
            title: 'Select Folder to Import',
            buttonLabel: 'Select',
          })
        : await dialog.showOpenDialog(targetWindow, {
            properties: ['openFile'],
            filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
            title: 'Select Markdown File to Import',
            buttonLabel: 'Select',
          });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0] ?? null;
  };
}

function handleScanImportSource(_ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sourcePath: string
  ): Promise<{ success: boolean; result?: ScanResult; error?: string }> => {
    try {
      console.log(`[Import] Scanning source: ${sourcePath}`);
      const result = await scanPath(sourcePath);
      console.log(`[Import] Scan complete: ${result.totalFiles} markdown files found`);
      return { success: true, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Import] Scan failed: ${message}`);
      return { success: false, error: message };
    }
  };
}

function handleExecuteImport(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sourcePath: string,
    options: ImportOptions
  ): Promise<{
    success: boolean;
    notesCreated?: number;
    foldersCreated?: number;
    skipped?: number;
    noteIds?: string[];
    folderIds?: string[];
    error?: string;
  }> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    try {
      // Cancel any existing import
      if (currentImport) {
        currentImport.cancel();
      }

      console.log(`[Import] Starting import from: ${sourcePath}`);
      console.log(`[Import] Options:`, JSON.stringify(options));

      // Create new import service
      currentImport = new ImportService(
        crdtManager,
        database,
        (channel: string, ...args: unknown[]) => {
          broadcastToAll(channel, ...args);
        }
      );

      // Execute import with progress callback
      const result = await currentImport.importFromPath(
        sourcePath,
        options,
        (progress: ImportProgress) => {
          broadcastToAll('import:progress', progress);
        }
      );

      currentImport = undefined;

      if (result.success) {
        console.log(
          `[Import] Import completed: ${result.notesCreated} notes, ${result.foldersCreated} folders`
        );
      } else {
        console.log(`[Import] Import failed or cancelled: ${result.error}`);
      }

      const response: {
        success: boolean;
        notesCreated?: number;
        foldersCreated?: number;
        skipped?: number;
        noteIds?: string[];
        folderIds?: string[];
        error?: string;
      } = {
        success: result.success,
        notesCreated: result.notesCreated,
        foldersCreated: result.foldersCreated,
        skipped: result.skipped,
        noteIds: result.noteIds,
        folderIds: result.folderIds,
      };
      if (result.error) {
        response.error = result.error;
      }
      return response;
    } catch (error) {
      currentImport = undefined;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Import] Import error: ${message}`);
      return { success: false, error: message };
    }
  };
}

function handleCancelImport(_ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<{ success: boolean }> => {
    if (currentImport) {
      console.log('[Import] Cancelling import...');
      currentImport.cancel();
      currentImport = undefined;
      return { success: true };
    }
    return { success: false };
  };
}

// =============================================================================
// Helper Functions for XML to JSON Conversion
// =============================================================================

/**
 * Convert Y.XmlFragment to JSON (used for export)
 */
function xmlFragmentToJson(fragment: Y.XmlFragment): { type: string; content?: unknown[] } {
  const content: unknown[] = [];

  fragment.forEach((item) => {
    if (item instanceof Y.XmlElement) {
      content.push(xmlElementToJson(item));
    } else if (item instanceof Y.XmlText) {
      // Handle text with formatting
      const textContent = xmlTextToJson(item);
      if (textContent.length > 0) {
        // Text nodes need to be wrapped or returned as-is depending on context
        content.push(...textContent);
      }
    }
  });

  return { type: 'doc', content };
}

/**
 * Convert Y.XmlElement to JSON
 */
function xmlElementToJson(element: Y.XmlElement): {
  type: string;
  attrs?: Record<string, unknown>;
  content?: unknown[];
  marks?: unknown[];
} {
  const nodeName = element.nodeName;
  const result: {
    type: string;
    attrs?: Record<string, unknown>;
    content?: unknown[];
    marks?: unknown[];
  } = { type: nodeName };

  // Get attributes
  const attrs = element.getAttributes();
  if (Object.keys(attrs).length > 0) {
    result.attrs = attrs;
  }

  // Get children
  const content: unknown[] = [];
  element.forEach((child) => {
    if (child instanceof Y.XmlElement) {
      content.push(xmlElementToJson(child));
    } else if (child instanceof Y.XmlText) {
      const textContent = xmlTextToJson(child);
      content.push(...textContent);
    }
  });

  if (content.length > 0) {
    result.content = content;
  }

  return result;
}

/**
 * Convert Y.XmlText to JSON (handles formatting/marks)
 */
function xmlTextToJson(
  xmlText: Y.XmlText
): { type: string; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[] }[] {
  const result: {
    type: string;
    text?: string;
    marks?: { type: string; attrs?: Record<string, unknown> }[];
  }[] = [];

  // Y.XmlText can have multiple "deltas" with different formatting
  const deltas = xmlText.toDelta() as {
    insert?: string;
    attributes?: Record<string, unknown>;
  }[];

  for (const delta of deltas) {
    if (typeof delta.insert === 'string') {
      const textNode: {
        type: string;
        text: string;
        marks?: { type: string; attrs?: Record<string, unknown> }[];
      } = {
        type: 'text',
        text: delta.insert,
      };

      // Convert attributes to marks
      if (delta.attributes && Object.keys(delta.attributes).length > 0) {
        textNode.marks = [];
        for (const [key, value] of Object.entries(delta.attributes)) {
          if (value === true) {
            textNode.marks.push({ type: key });
          } else if (typeof value === 'object' && value !== null) {
            textNode.marks.push({ type: key, attrs: value as Record<string, unknown> });
          }
        }
      }

      result.push(textNode);
    }
  }

  return result;
}
