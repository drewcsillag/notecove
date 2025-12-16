/**
 * Image Picker Handlers
 *
 * IPC handlers for advanced image operations that use Electron APIs:
 * pickAndSave, downloadAndSave, copyToClipboard, saveAs, openExternal, copyToSD
 */

/* eslint-disable @typescript-eslint/require-await */

import {
  ipcMain,
  dialog,
  net,
  shell,
  clipboard,
  nativeImage,
  type IpcMainInvokeEvent,
} from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { HandlerContext } from './types';
import {
  ImageStorage,
  getMimeTypeFromExtension,
  getExtensionFromMimeType,
  isSupportedMimeType,
  SyncDirectoryStructure,
} from '@notecove/shared';
import { NodeFileSystemAdapter } from '../../storage/node-fs-adapter';

/**
 * Register all image picker IPC handlers
 */
export function registerImagePickerHandlers(ctx: HandlerContext): void {
  ipcMain.handle('image:pickAndSave', handleImagePickAndSave(ctx));
  ipcMain.handle('image:downloadAndSave', handleImageDownloadAndSave(ctx));
  ipcMain.handle('image:copyToClipboard', handleImageCopyToClipboard(ctx));
  ipcMain.handle('image:saveAs', handleImageSaveAs(ctx));
  ipcMain.handle('image:openExternal', handleImageOpenExternal(ctx));
  ipcMain.handle('image:copyToSD', handleImageCopyToSD(ctx));
}

/**
 * Unregister all image picker IPC handlers
 */
export function unregisterImagePickerHandlers(): void {
  ipcMain.removeHandler('image:pickAndSave');
  ipcMain.removeHandler('image:downloadAndSave');
  ipcMain.removeHandler('image:copyToClipboard');
  ipcMain.removeHandler('image:saveAs');
  ipcMain.removeHandler('image:openExternal');
  ipcMain.removeHandler('image:copyToSD');
}

// =============================================================================
// Handler Factories
// =============================================================================

function handleImagePickAndSave(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, sdId: string): Promise<string[]> => {
    const { database } = ctx;

    // Get SD from database
    const sd = await database.getStorageDir(sdId);
    if (!sd) {
      throw new Error(`Storage directory not found: ${sdId}`);
    }

    // Show file picker dialog
    const result = await dialog.showOpenDialog({
      title: 'Select Images',
      buttonLabel: 'Insert',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic', 'heif'],
        },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }

    // Create ImageStorage instance
    const fsAdapter = new NodeFileSystemAdapter();
    const sdStructure = new SyncDirectoryStructure(fsAdapter, {
      id: sdId,
      path: sd.path,
      label: sd.name,
    });
    const imageStorage = new ImageStorage(fsAdapter, sdStructure);

    const imageIds: string[] = [];

    // Process each selected file
    for (const filePath of result.filePaths) {
      try {
        // Read file data
        const data = await fs.readFile(filePath);

        // Determine MIME type from extension
        const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
        const mimeType = getMimeTypeFromExtension(ext);

        if (!mimeType || !isSupportedMimeType(mimeType)) {
          console.warn(`[IPCHandlers] Skipping unsupported file type: ${filePath}`);
          continue;
        }

        // Save the image (uses content hash for dedup at file level)
        const saveResult = await imageStorage.saveImage(new Uint8Array(data), mimeType);

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
          console.log('[Image] Dedup: picked image already exists in database:', {
            imageId: saveResult.imageId,
            sdId: existingImage.sdId,
          });
        }

        imageIds.push(saveResult.imageId);
      } catch (err) {
        console.error(`[IPCHandlers] Failed to save image from ${filePath}:`, err);
      }
    }

    return imageIds;
  };
}

function handleImageDownloadAndSave(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    url: string
  ): Promise<string> => {
    const { database } = ctx;

    // Get SD from database
    const sd = await database.getStorageDir(sdId);
    if (!sd) {
      throw new Error(`Storage directory not found: ${sdId}`);
    }

    let imageData: Uint8Array;
    let mimeType: string | null = null;

    // Handle file:// URLs by reading from local filesystem
    if (url.startsWith('file://')) {
      const filePath = url.replace('file://', '');
      try {
        const data = await fs.readFile(filePath);
        imageData = new Uint8Array(data);

        // Determine MIME type from extension
        const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
        mimeType = getMimeTypeFromExtension(ext);
      } catch (err) {
        throw new Error(`Failed to read local file: ${filePath}`);
      }
    } else {
      // Download from URL using net module
      const response = await new Promise<{ data: Buffer; contentType: string | null }>(
        (resolve, reject) => {
          const request = net.request(url);

          const chunks: Buffer[] = [];
          let contentType: string | null = null;

          request.on('response', (response) => {
            contentType = response.headers['content-type']?.toString() ?? null;

            response.on('data', (chunk) => {
              chunks.push(chunk);
            });

            response.on('end', () => {
              resolve({ data: Buffer.concat(chunks), contentType });
            });

            response.on('error', reject);
          });

          request.on('error', reject);
          request.end();
        }
      );

      imageData = new Uint8Array(response.data);

      // Get MIME type from content-type header
      if (response.contentType) {
        // Extract MIME type without parameters (e.g., "image/png; charset=utf-8" -> "image/png")
        mimeType = response.contentType.split(';')[0]?.trim() ?? null;
      }

      // If not in content-type, try to infer from URL extension
      if (!mimeType) {
        const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase() ?? '';
        mimeType = getMimeTypeFromExtension(ext);
      }
    }

    // Validate MIME type
    if (!mimeType || !isSupportedMimeType(mimeType)) {
      throw new Error(`Unsupported image type: ${mimeType ?? 'unknown'}`);
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
    const saveResult = await imageStorage.saveImage(imageData, mimeType);

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
        size: imageData.length,
        created: Date.now(),
      });
    } else {
      console.log('[Image] Dedup: downloaded image already exists in database:', {
        imageId: saveResult.imageId,
        sdId: existingImage.sdId,
      });
    }

    return saveResult.imageId;
  };
}

function handleImageCopyToClipboard(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    imageId: string
  ): Promise<void> => {
    const { database } = ctx;

    // Get image metadata from database
    const image = await database.getImage(imageId);
    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    // Get SD from database
    const sd = await database.getStorageDir(sdId);
    if (!sd) {
      throw new Error(`Storage directory not found: ${sdId}`);
    }

    // Get image path
    const imagePath = path.join(sd.path, 'media', image.filename);

    // Read image and copy to clipboard
    const img = nativeImage.createFromPath(imagePath);
    if (img.isEmpty()) {
      throw new Error(`Failed to load image: ${imagePath}`);
    }

    clipboard.writeImage(img);
    console.log(`[IPC] Image copied to clipboard: ${imageId}`);
  };
}

function handleImageSaveAs(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    imageId: string
  ): Promise<string | null> => {
    const { database } = ctx;

    // Get image metadata from database
    const image = await database.getImage(imageId);
    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    // Get SD from database
    const sd = await database.getStorageDir(sdId);
    if (!sd) {
      throw new Error(`Storage directory not found: ${sdId}`);
    }

    // Get image path
    const imagePath = path.join(sd.path, 'media', image.filename);

    // Get file extension
    const ext = path.extname(image.filename).slice(1);
    const extFilter = ext ? { name: ext.toUpperCase(), extensions: [ext] } : undefined;

    // Show save dialog
    const dialogOptions: Electron.SaveDialogOptions = {
      title: 'Save Image As',
      defaultPath: image.filename,
    };
    if (extFilter) {
      dialogOptions.filters = [extFilter, { name: 'All Files', extensions: ['*'] }];
    }
    const result = await dialog.showSaveDialog(dialogOptions);

    if (result.canceled || !result.filePath) {
      return null;
    }

    // Copy file to destination
    await fs.copyFile(imagePath, result.filePath);
    console.log(`[IPC] Image saved to: ${result.filePath}`);

    return result.filePath;
  };
}

function handleImageOpenExternal(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    imageId: string
  ): Promise<void> => {
    const { database } = ctx;

    // Get image metadata from database
    const image = await database.getImage(imageId);
    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    // Get SD from database
    const sd = await database.getStorageDir(sdId);
    if (!sd) {
      throw new Error(`Storage directory not found: ${sdId}`);
    }

    // Get image path
    const imagePath = path.join(sd.path, 'media', image.filename);

    // Check if file exists
    try {
      await fs.access(imagePath);
    } catch {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Open in default application
    await shell.openPath(imagePath);
    console.log(`[IPC] Image opened in external app: ${imageId}`);
  };
}

function handleImageCopyToSD(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sourceSdId: string,
    targetSdId: string,
    imageId: string
  ): Promise<{ success: boolean; imageId: string; alreadyExists?: boolean; error?: string }> => {
    const { database } = ctx;

    // Validate source SD exists
    const sourceSd = await database.getStorageDir(sourceSdId);
    if (!sourceSd) {
      throw new Error(`Source storage directory not found: ${sourceSdId}`);
    }

    // Validate target SD exists
    const targetSd = await database.getStorageDir(targetSdId);
    if (!targetSd) {
      throw new Error(`Target storage directory not found: ${targetSdId}`);
    }

    // Check if image already exists in target SD (in database cache)
    const existingImage = await database.getImage(imageId);
    if (existingImage?.sdId === targetSdId) {
      console.log(`[IPC] Image ${imageId} already exists in target SD ${targetSdId}`);
      return { success: true, imageId, alreadyExists: true };
    }

    // Get source image metadata (from any SD that has it)
    const sourceImage = existingImage ?? (await database.getImage(imageId));
    if (!sourceImage) {
      // Try to read directly from filesystem as fallback
      console.log(`[IPC] Image ${imageId} not in database, checking filesystem in source SD`);
    }

    // Construct source path - look for any file with this imageId
    const sourceMediaPath = path.join(sourceSd.path, 'media');
    let sourceFilePath: string | null = null;
    let mimeType = sourceImage?.mimeType;

    try {
      // List files in source media directory to find matching imageId
      const files = await fs.readdir(sourceMediaPath);
      for (const file of files) {
        if (file.startsWith(imageId)) {
          sourceFilePath = path.join(sourceMediaPath, file);
          // Infer mime type from extension if not known
          if (!mimeType) {
            const ext = file.split('.').pop()?.toLowerCase();
            mimeType = getMimeTypeFromExtension(ext ?? '') ?? 'image/png';
          }
          break;
        }
      }
    } catch {
      // Media directory doesn't exist or can't be read
    }

    if (!sourceFilePath) {
      console.log(`[IPC] Source image file not found: ${imageId} in SD ${sourceSdId}`);
      return { success: false, imageId, error: 'Source image not found' };
    }

    // Read source image data
    let imageData: Buffer;
    try {
      imageData = await fs.readFile(sourceFilePath);
    } catch {
      console.log(`[IPC] Failed to read source image: ${sourceFilePath}`);
      return { success: false, imageId, error: 'Failed to read source image' };
    }

    // Create target SD structure and save image
    const fsAdapter = new NodeFileSystemAdapter();
    const targetSdStructure = new SyncDirectoryStructure(fsAdapter, {
      id: targetSdId,
      path: targetSd.path,
      label: targetSd.name,
    });
    const targetImageStorage = new ImageStorage(fsAdapter, targetSdStructure);

    // Save with the same imageId
    const filename = `${imageId}.${getExtensionFromMimeType(mimeType ?? 'image/png')}`;
    const targetPath = path.join(targetSd.path, 'media', filename);

    // Ensure media directory exists
    await targetImageStorage.initializeMediaDir();

    // Write the file
    await fs.writeFile(targetPath, imageData);

    // Add to database cache for target SD
    await database.upsertImage({
      id: imageId,
      sdId: targetSdId,
      filename,
      mimeType: mimeType ?? 'image/png',
      width: sourceImage?.width ?? null,
      height: sourceImage?.height ?? null,
      size: imageData.length,
      created: Date.now(),
    });

    console.log(`[IPC] Image copied from SD ${sourceSdId} to ${targetSdId}: ${imageId}`);

    return { success: true, imageId };
  };
}
