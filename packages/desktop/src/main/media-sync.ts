/**
 * Media Sync Module
 *
 * Handles scanning and registration of media files in sync directories.
 * Used for discovering images that synced while the app was closed.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ImageStorage, isValidImageId, type Database } from '@notecove/shared';

/**
 * Scan a media directory and register any unregistered images.
 *
 * This function:
 * 1. Lists all files in the media directory
 * 2. Filters for supported image files
 * 3. Checks each against the database
 * 4. Registers any that aren't already in the database
 *
 * @param sdId The storage directory ID
 * @param sdPath The storage directory path
 * @param database The database instance
 * @returns Count of newly registered images
 */
export async function scanAndRegisterMedia(
  sdId: string,
  sdPath: string,
  database: Database
): Promise<number> {
  const mediaDir = path.join(sdPath, 'media');

  // Check if media directory exists and is a directory
  try {
    const stats = await fs.stat(mediaDir);
    if (!stats.isDirectory()) {
      // Media path exists but is not a directory
      return 0;
    }
  } catch {
    // Media directory doesn't exist yet
    return 0;
  }

  // List all files in media directory
  let files: string[];
  try {
    files = await fs.readdir(mediaDir);
  } catch (error: unknown) {
    console.error(`[MediaSync] Failed to read media directory: ${mediaDir}`, error);
    return 0;
  }

  let registeredCount = 0;

  for (const filename of files) {
    // Parse filename to extract imageId and extension
    const parsed = ImageStorage.parseImageFilename(filename);
    if (!parsed) {
      // Not a supported image file
      continue;
    }

    const { imageId, mimeType } = parsed;

    // Validate imageId format (security: prevent path traversal)
    if (!isValidImageId(imageId)) {
      continue;
    }

    // Check if already registered in database
    const exists = await database.imageExists(imageId);
    if (exists) {
      continue;
    }

    // Get file stats for size
    const filePath = path.join(mediaDir, filename);
    let size: number;
    try {
      const stats = await fs.stat(filePath);
      size = stats.size;
    } catch {
      // File may have been deleted, skip
      continue;
    }

    // Register the image in the database
    await database.upsertImage({
      id: imageId,
      sdId,
      filename,
      mimeType,
      width: null,
      height: null,
      size,
      created: Date.now(),
    });

    registeredCount++;
  }

  return registeredCount;
}
