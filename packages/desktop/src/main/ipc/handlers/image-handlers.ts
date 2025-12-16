/**
 * Image Handlers (Core)
 *
 * IPC handlers for core image operations: save, get, delete, etc.
 * Also includes thumbnail handlers.
 *
 * See also:
 * - image-picker-handlers.ts for pickAndSave, downloadAndSave, copyToClipboard, saveAs, openExternal, copyToSD
 */

/* eslint-disable @typescript-eslint/require-await */

import { ipcMain, app, type IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { HandlerContext } from './types';
import type { ImageCache } from '@notecove/shared';
import {
  ImageStorage,
  isSupportedMimeType,
  SyncDirectoryStructure,
} from '@notecove/shared';
import { ThumbnailGenerator, type ThumbnailResult } from '../../thumbnail';
import { ImageCleanupManager, type CleanupStats } from '../../image-cleanup-manager';
import { NodeFileSystemAdapter } from '../../storage/node-fs-adapter';

// Module-level instances (initialized in registerImageHandlers)
let thumbnailGenerator: ThumbnailGenerator;
let imageCleanupManager: ImageCleanupManager;

/**
 * Initialize image-related services
 */
export function initializeImageServices(database: HandlerContext['database']): void {
  const thumbnailCacheDir = path.join(app.getPath('userData'), 'thumbnails');
  thumbnailGenerator = new ThumbnailGenerator(thumbnailCacheDir);
  imageCleanupManager = new ImageCleanupManager(database, thumbnailCacheDir);
}

/**
 * Register all core image IPC handlers
 */
export function registerImageHandlers(ctx: HandlerContext): void {
  // Image operations
  ipcMain.handle('image:save', handleImageSave(ctx));
  ipcMain.handle('image:getDataUrl', handleImageGetDataUrl(ctx));
  ipcMain.handle('image:getPath', handleImageGetPath(ctx));
  ipcMain.handle('image:delete', handleImageDelete(ctx));
  ipcMain.handle('image:exists', handleImageExists(ctx));
  ipcMain.handle('image:getMetadata', handleImageGetMetadata(ctx));
  ipcMain.handle('image:list', handleImageList(ctx));
  ipcMain.handle('image:getStorageStats', handleImageGetStorageStats(ctx));

  // Thumbnail operations
  ipcMain.handle('thumbnail:get', handleThumbnailGet(ctx));
  ipcMain.handle('thumbnail:getDataUrl', handleThumbnailGetDataUrl(ctx));
  ipcMain.handle('thumbnail:exists', handleThumbnailExists(ctx));
  ipcMain.handle('thumbnail:delete', handleThumbnailDelete(ctx));
  ipcMain.handle('thumbnail:generate', handleThumbnailGenerate(ctx));
}

/**
 * Unregister all core image IPC handlers
 */
export function unregisterImageHandlers(): void {
  ipcMain.removeHandler('image:save');
  ipcMain.removeHandler('image:getDataUrl');
  ipcMain.removeHandler('image:getPath');
  ipcMain.removeHandler('image:delete');
  ipcMain.removeHandler('image:exists');
  ipcMain.removeHandler('image:getMetadata');
  ipcMain.removeHandler('image:list');
  ipcMain.removeHandler('image:getStorageStats');

  ipcMain.removeHandler('thumbnail:get');
  ipcMain.removeHandler('thumbnail:getDataUrl');
  ipcMain.removeHandler('thumbnail:exists');
  ipcMain.removeHandler('thumbnail:delete');
  ipcMain.removeHandler('thumbnail:generate');
}

/**
 * Run image cleanup: Delete orphaned images that are no longer referenced by any note
 * Uses mark-and-sweep algorithm with 14-day grace period
 */
export async function runImageCleanup(gracePeriodDays = 14, dryRun = false): Promise<CleanupStats[]> {
  console.log(
    `[image-cleanup] Starting image cleanup (grace period: ${gracePeriodDays} days, dryRun: ${dryRun})...`
  );

  try {
    const allStats = await imageCleanupManager.cleanupAllSyncDirectories({
      gracePeriodDays,
      dryRun,
    });

    // Log summary
    let totalDeleted = 0;
    let totalOrphaned = 0;
    let totalBytesReclaimed = 0;

    for (const stats of allStats) {
      totalDeleted += stats.deletedImages;
      totalOrphaned += stats.orphanedImages;
      totalBytesReclaimed += stats.bytesReclaimed;

      console.log(
        `[image-cleanup] SD "${stats.sdName}": ${stats.totalImages} images, ` +
          `${stats.referencedImages} referenced, ${stats.orphanedImages} orphaned, ` +
          `${stats.deletedImages} deleted, ${stats.skippedImages} skipped (within grace period)`
      );
    }

    console.log(
      `[image-cleanup] Summary: ${totalDeleted} images deleted, ` +
        `${totalOrphaned} total orphans found, ${(totalBytesReclaimed / 1024 / 1024).toFixed(2)} MB reclaimed`
    );

    return allStats;
  } catch (err) {
    console.error(`[image-cleanup] Image cleanup failed: ${String(err)}`);
    // Don't throw - cleanup failure should not prevent app startup
    return [];
  }
}

// =============================================================================
// Image Handler Factories
// =============================================================================

function handleImageSave(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    data: Uint8Array,
    mimeType: string
  ): Promise<{ imageId: string; filename: string }> => {
    const { database } = ctx;

    // Get SD from database
    const sd = await database.getStorageDir(sdId);
    if (!sd) {
      throw new Error(`Storage directory not found: ${sdId}`);
    }

    // Validate MIME type
    if (!isSupportedMimeType(mimeType)) {
      throw new Error(`Unsupported image type: ${mimeType}`);
    }

    // Create ImageStorage instance
    const fsAdapter = new NodeFileSystemAdapter();
    const sdStructure = new SyncDirectoryStructure(fsAdapter, {
      id: sdId,
      path: sd.path,
      label: sd.name,
    });
    const imageStorage = new ImageStorage(fsAdapter, sdStructure);

    // Save the image (uses content hash for dedup)
    const saveResult = await imageStorage.saveImage(data, mimeType);

    // Check if image already exists in database (dedup at database level)
    const existingImage = await database.getImage(saveResult.imageId);
    if (!existingImage) {
      // Add to database cache (new image)
      await database.upsertImage({
        id: saveResult.imageId,
        sdId,
        filename: saveResult.filename,
        mimeType,
        width: null,
        height: null,
        size: data.length,
        created: Date.now(),
      });
    } else {
      console.log('[Image] Dedup: saved image already exists in database:', {
        imageId: saveResult.imageId,
        sdId: existingImage.sdId,
      });
    }

    return saveResult;
  };
}

function handleImageGetDataUrl(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    imageId: string
  ): Promise<string | null> => {
    const { database, discoverImageAcrossSDs } = ctx;

    // Get image metadata from database or discover on disk
    let image = await database.getImage(imageId);

    if (image) {
      // Image found in database - use stored metadata
      const sd = await database.getStorageDir(image.sdId);
      if (!sd) {
        return null;
      }

      const imagePath = path.join(sd.path, 'media', image.filename);
      try {
        const data = await fs.readFile(imagePath);
        const base64 = Buffer.from(data).toString('base64');
        return `data:${image.mimeType};base64,${base64}`;
      } catch (err) {
        console.error(`[IPC] Failed to read image ${imageId}:`, err);
        return null;
      }
    }

    // Image not in database - try to discover it on disk
    const discovered = await discoverImageAcrossSDs(imageId, sdId);
    if (!discovered) {
      return null;
    }

    // Register the discovered image in the database
    await database.upsertImage({
      id: imageId,
      sdId: discovered.sdId,
      filename: discovered.filename,
      mimeType: discovered.mimeType,
      width: null,
      height: null,
      size: discovered.size,
      created: Date.now(),
    });

    console.log('[Image] Discovered and registered synced image:', {
      imageId,
      sdId: discovered.sdId,
      filename: discovered.filename,
    });

    // Now read and return the image data
    const imagePath = path.join(discovered.sdPath, 'media', discovered.filename);
    try {
      const data = await fs.readFile(imagePath);
      const base64 = Buffer.from(data).toString('base64');
      return `data:${discovered.mimeType};base64,${base64}`;
    } catch (err) {
      console.error(`[IPC] Failed to read discovered image ${imageId}:`, err);
      return null;
    }
  };
}

function handleImageGetPath(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    imageId: string
  ): Promise<string | null> => {
    const { database, discoverImageAcrossSDs } = ctx;

    // Get image metadata from database or discover on disk
    let image = await database.getImage(imageId);

    if (image) {
      // Image found in database - use stored metadata
      const sd = await database.getStorageDir(image.sdId);
      if (!sd) {
        return null;
      }

      return path.join(sd.path, 'media', image.filename);
    }

    // Image not in database - try to discover it on disk
    const discovered = await discoverImageAcrossSDs(imageId, sdId);
    if (!discovered) {
      return null;
    }

    // Register the discovered image in the database
    await database.upsertImage({
      id: imageId,
      sdId: discovered.sdId,
      filename: discovered.filename,
      mimeType: discovered.mimeType,
      width: null,
      height: null,
      size: discovered.size,
      created: Date.now(),
    });

    console.log('[Image] Discovered and registered synced image:', {
      imageId,
      sdId: discovered.sdId,
      filename: discovered.filename,
    });

    return path.join(discovered.sdPath, 'media', discovered.filename);
  };
}

function handleImageDelete(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    imageId: string
  ): Promise<void> => {
    const { database } = ctx;

    // Get SD from database
    const sd = await database.getStorageDir(sdId);
    if (!sd) {
      throw new Error(`Storage directory not found: ${sdId}`);
    }

    // Get image metadata from database
    const image = await database.getImage(imageId);
    if (!image) {
      console.warn(`[IPC] Image not found in database, skipping delete: ${imageId}`);
      return;
    }

    // Delete from filesystem
    const imagePath = path.join(sd.path, 'media', image.filename);
    try {
      await fs.unlink(imagePath);
    } catch (err) {
      console.warn(`[IPC] Failed to delete image file ${imagePath}:`, err);
      // Continue to remove from database
    }

    // Delete thumbnail if exists
    await thumbnailGenerator.deleteThumbnail(sdId, imageId);

    // Remove from database
    await database.deleteImage(imageId);
  };
}

function handleImageExists(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    imageId: string
  ): Promise<boolean> => {
    const { database, discoverImageAcrossSDs } = ctx;

    // Check database first
    const image = await database.getImage(imageId);
    if (image) {
      // Verify file exists on disk
      const sd = await database.getStorageDir(image.sdId);
      if (sd) {
        const imagePath = path.join(sd.path, 'media', image.filename);
        try {
          await fs.access(imagePath);
          return true;
        } catch {
          // File doesn't exist, but db record does - might be out of sync
          console.warn(`[IPC] Image ${imageId} in database but file not found at ${imagePath}`);
        }
      }
    }

    // Not in database or file not found - try to discover on disk
    const discovered = await discoverImageAcrossSDs(imageId, sdId);
    if (discovered) {
      // Register the discovered image
      await database.upsertImage({
        id: imageId,
        sdId: discovered.sdId,
        filename: discovered.filename,
        mimeType: discovered.mimeType,
        width: null,
        height: null,
        size: discovered.size,
        created: Date.now(),
      });

      console.log('[Image] Discovered and registered synced image:', {
        imageId,
        sdId: discovered.sdId,
        filename: discovered.filename,
      });

      return true;
    }

    return false;
  };
}

function handleImageGetMetadata(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    imageId: string
  ): Promise<ImageCache | null> => {
    return await ctx.database.getImage(imageId);
  };
}

function handleImageList(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, sdId: string): Promise<ImageCache[]> => {
    return await ctx.database.getImagesBySd(sdId);
  };
}

function handleImageGetStorageStats(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string
  ): Promise<{ totalSize: number; imageCount: number }> => {
    const totalSize = await ctx.database.getImageStorageSize(sdId);
    const imageCount = await ctx.database.getImageCount(sdId);
    return { totalSize, imageCount };
  };
}

// =============================================================================
// Thumbnail Handler Factories
// =============================================================================

function handleThumbnailGet(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    imageId: string
  ): Promise<ThumbnailResult | null> => {
    const { database, discoverImageAcrossSDs } = ctx;

    // Check if thumbnail already exists
    if (await thumbnailGenerator.thumbnailExists(sdId, imageId)) {
      const thumbPath = thumbnailGenerator.getThumbnailPath(sdId, imageId);
      try {
        const stats = await fs.stat(thumbPath);
        // We don't have width/height cached, but we know the file exists
        return {
          path: thumbPath,
          format: 'jpeg',
          width: 0, // Unknown without reading
          height: 0,
          size: stats.size,
        };
      } catch {
        // File might have been deleted, regenerate
      }
    }

    // Get image metadata from database or discover on disk
    let image = await database.getImage(imageId);
    let imagePath: string;

    if (image) {
      // Image found in database - use stored metadata
      const sd = await database.getStorageDir(image.sdId);
      if (!sd) {
        return null;
      }
      imagePath = path.join(sd.path, 'media', image.filename);
    } else {
      // Image not in database - try to discover it on disk
      const discovered = await discoverImageAcrossSDs(imageId, sdId);
      if (!discovered) {
        return null;
      }

      // Register the discovered image in the database
      await database.upsertImage({
        id: imageId,
        sdId: discovered.sdId,
        filename: discovered.filename,
        mimeType: discovered.mimeType,
        width: null,
        height: null,
        size: discovered.size,
        created: Date.now(),
      });

      console.log('[Thumbnail] Discovered and registered synced image:', {
        imageId,
        sdId: discovered.sdId,
        filename: discovered.filename,
      });

      imagePath = path.join(discovered.sdPath, 'media', discovered.filename);
      image = {
        id: imageId,
        sdId: discovered.sdId,
        filename: discovered.filename,
        mimeType: discovered.mimeType,
        width: null,
        height: null,
        size: discovered.size,
        created: Date.now(),
      };
    }

    try {
      const imageData = await fs.readFile(imagePath);
      const result = await thumbnailGenerator.generateThumbnailForSd(
        imageData,
        image.mimeType,
        image.sdId,
        imageId
      );
      console.log(`[IPC] Generated thumbnail for ${imageId}: ${result.path}`);
      return result;
    } catch (error) {
      console.error(`[IPC] Failed to generate thumbnail for ${imageId}:`, error);
      return null;
    }
  };
}

function handleThumbnailGetDataUrl(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    imageId: string
  ): Promise<string | null> => {
    // First ensure thumbnail exists
    const exists = await thumbnailGenerator.thumbnailExists(sdId, imageId);
    if (!exists) {
      // Try to generate it first
      const result = await handleThumbnailGet(ctx)(_event, sdId, imageId);
      if (!result) {
        return null;
      }
    }

    return thumbnailGenerator.getThumbnailDataUrl(sdId, imageId);
  };
}

function handleThumbnailExists(_ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    imageId: string
  ): Promise<boolean> => {
    return thumbnailGenerator.thumbnailExists(sdId, imageId);
  };
}

function handleThumbnailDelete(_ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    imageId: string
  ): Promise<void> => {
    await thumbnailGenerator.deleteThumbnail(sdId, imageId);
    console.log(`[IPC] Deleted thumbnail for ${imageId}`);
  };
}

function handleThumbnailGenerate(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    imageId: string
  ): Promise<ThumbnailResult | null> => {
    // Delete existing thumbnail first
    await thumbnailGenerator.deleteThumbnail(sdId, imageId);

    // Generate new thumbnail
    return handleThumbnailGet(ctx)(_event, sdId, imageId);
  };
}
