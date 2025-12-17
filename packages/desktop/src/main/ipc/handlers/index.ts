/**
 * IPC Handlers - Main Entry Point
 *
 * This module provides a central facade for all IPC handlers.
 * It coordinates initialization, registration, and cleanup of all handler modules.
 */

import { BrowserWindow } from 'electron';
import type { HandlerDependencies, HandlerContext, WebBroadcastCallback } from './types';
import {
  isValidImageId,
  ImageStorage,
  SyncDirectoryStructure,
  type DiscoveredImage,
} from '@notecove/shared';
import { NodeFileSystemAdapter } from '../../storage/node-fs-adapter';

// Handler modules
import {
  registerNoteHandlers,
  unregisterNoteHandlers,
  runAutoCleanup,
  permanentlyDeleteNote,
} from './note-handlers';
import { registerNoteEditHandlers, unregisterNoteEditHandlers } from './note-edit-handlers';
import { registerNoteQueryHandlers, unregisterNoteQueryHandlers } from './note-query-handlers';
import { registerFolderHandlers, unregisterFolderHandlers } from './folder-handlers';
import { registerSDHandlers, unregisterSDHandlers } from './sd-handlers';
import { registerSyncHandlers, unregisterSyncHandlers } from './sync-handlers';
import { registerWindowHandlers, unregisterWindowHandlers } from './window-handlers';
import { registerDiagnosticsHandlers, unregisterDiagnosticsHandlers } from './diagnostics-handlers';
import {
  registerImageHandlers,
  unregisterImageHandlers,
  initializeImageServices,
  runImageCleanup,
} from './image-handlers';
import {
  registerImagePickerHandlers,
  unregisterImagePickerHandlers,
} from './image-picker-handlers';
import {
  registerExportImportHandlers,
  unregisterExportImportHandlers,
} from './export-import-handlers';
import {
  registerMiscHandlers,
  unregisterMiscHandlers,
  initializeMiscServices,
} from './misc-handlers';
import { registerHistoryHandlers, unregisterHistoryHandlers } from './history-handlers';
import { registerCommentHandlers, unregisterCommentHandlers } from './comment-handlers';

// Re-export types for external use
export type {
  HandlerDependencies,
  HandlerContext,
  WebBroadcastCallback,
  CreateWindowFn,
  CreateWindowOptions,
  GetDeletionLoggerFn,
  GetSyncStatusFn,
  GetStaleSyncsFn,
  SkipStaleEntryFn,
  RetryStaleEntryFn,
  OnUserSettingsChangedFn,
  OnStorageDirCreatedFn,
  MentionUser,
} from './types';

// Re-export CleanupStats for external use
export type { CleanupStats } from '../../image-cleanup-manager';

/**
 * Main IPC Handlers class
 *
 * This class provides backward compatibility with the original monolithic handlers.ts
 * while delegating to the modular handler implementations.
 */
export class IPCHandlers {
  private webBroadcastCallback: WebBroadcastCallback | undefined;
  private ctx: HandlerContext;

  constructor(deps: HandlerDependencies) {
    // Initialize services that need setup
    initializeImageServices(deps.database);
    initializeMiscServices();

    // Create the handler context with runtime services
    this.ctx = {
      ...deps,
      broadcastToAll: this.broadcastToAll.bind(this),
      discoverImageAcrossSDs: this.discoverImageAcrossSDs.bind(this),
    };

    // Register all handlers
    this.registerHandlers();
  }

  /**
   * Set the callback for broadcasting events to web clients via WebSocket
   * This is called by the WebServer when it starts
   */
  setWebBroadcastCallback(callback: WebBroadcastCallback | undefined): void {
    this.webBroadcastCallback = callback;
  }

  /**
   * Broadcast an event to all renderer windows and web clients
   */
  broadcastToAll(channel: string, ...args: unknown[]): void {
    // Broadcast to Electron windows
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send(channel, ...args);
    }

    // Broadcast to WebSocket clients if callback is registered
    if (this.webBroadcastCallback) {
      this.webBroadcastCallback(channel, ...args);
    }
  }

  /**
   * Discover an image across all registered storage directories
   * First checks the primary SD, then iterates through all other SDs as fallback
   */
  private async discoverImageAcrossSDs(
    imageId: string,
    primarySdId: string
  ): Promise<{
    sdId: string;
    sdPath: string;
    filename: string;
    mimeType: string;
    size: number;
  } | null> {
    // Validate imageId format for security
    if (!isValidImageId(imageId)) {
      console.warn(`[Image] Invalid imageId format rejected: ${imageId}`);
      return null;
    }

    const fsAdapter = new NodeFileSystemAdapter();

    // 1. Try primary SD first
    const primarySD = await this.ctx.database.getStorageDir(primarySdId);
    if (primarySD) {
      const sdStructure = new SyncDirectoryStructure(fsAdapter, {
        id: primarySdId,
        path: primarySD.path,
        label: primarySD.name,
      });
      const imageStorage = new ImageStorage(fsAdapter, sdStructure);
      const result: DiscoveredImage | null = await imageStorage.discoverImageOnDisk(imageId);
      if (result) {
        return {
          sdId: primarySdId,
          sdPath: primarySD.path,
          filename: result.filename,
          mimeType: result.mimeType,
          size: result.size,
        };
      }
    }

    // 2. Try all other SDs as fallback
    const allSDs = await this.ctx.database.getAllStorageDirs();
    for (const sd of allSDs) {
      if (sd.id === primarySdId) continue; // Already tried

      const sdStructure = new SyncDirectoryStructure(fsAdapter, {
        id: sd.id,
        path: sd.path,
        label: sd.name,
      });
      const imageStorage = new ImageStorage(fsAdapter, sdStructure);
      const result: DiscoveredImage | null = await imageStorage.discoverImageOnDisk(imageId);
      if (result) {
        console.warn(`[Image] Found image ${imageId} in SD ${sd.id} instead of ${primarySdId}`);
        return {
          sdId: sd.id,
          sdPath: sd.path,
          filename: result.filename,
          mimeType: result.mimeType,
          size: result.size,
        };
      }
    }

    return null;
  }

  /**
   * Auto-cleanup: Permanently delete notes from Recently Deleted that are older than the threshold
   * This method should be called on app startup.
   */
  async runAutoCleanup(thresholdDays = 30): Promise<void> {
    await runAutoCleanup(this.ctx, thresholdDays);
  }

  /**
   * Run image cleanup: Delete orphaned images that are no longer referenced by any note
   */
  async runImageCleanup(
    gracePeriodDays = 14,
    dryRun = false
  ): Promise<import('../../image-cleanup-manager').CleanupStats[]> {
    return runImageCleanup(gracePeriodDays, dryRun);
  }

  /**
   * Register all IPC handlers
   */
  private registerHandlers(): void {
    registerNoteHandlers(this.ctx);
    registerNoteEditHandlers(this.ctx);
    registerNoteQueryHandlers(this.ctx);
    registerFolderHandlers(this.ctx);
    registerSDHandlers(this.ctx);
    registerSyncHandlers(this.ctx);
    registerWindowHandlers(this.ctx);
    registerDiagnosticsHandlers(this.ctx);
    registerImageHandlers(this.ctx);
    registerImagePickerHandlers(this.ctx);
    registerExportImportHandlers(this.ctx);
    registerHistoryHandlers(this.ctx);
    registerCommentHandlers(this.ctx);
    registerMiscHandlers(this.ctx);
  }

  /**
   * Unregister all IPC handlers
   * Call this when cleaning up (e.g., for tests)
   */
  unregisterHandlers(): void {
    unregisterNoteHandlers();
    unregisterNoteEditHandlers();
    unregisterNoteQueryHandlers();
    unregisterFolderHandlers();
    unregisterSDHandlers();
    unregisterSyncHandlers();
    unregisterWindowHandlers();
    unregisterDiagnosticsHandlers();
    unregisterImageHandlers();
    unregisterImagePickerHandlers();
    unregisterExportImportHandlers();
    unregisterHistoryHandlers();
    unregisterCommentHandlers();
    unregisterMiscHandlers();
  }
}

// Re-export the permanentlyDeleteNote function for auto-cleanup usage
export { permanentlyDeleteNote };
