/**
 * ThumbnailGenerator - Generates thumbnails for images using sharp
 *
 * @see plans/add-images/PLAN-PHASE-5.md
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';

/**
 * Thumbnail generation specifications
 */
export const ThumbnailSpec = {
  /** Maximum size on longest edge in pixels */
  MAX_SIZE: 800,
  /** JPEG quality (0-100) */
  JPEG_QUALITY: 85,
  /** Default format for thumbnails */
  DEFAULT_FORMAT: 'jpeg' as const,
};

/**
 * Result of thumbnail generation
 */
export interface ThumbnailResult {
  /** Full path to the generated thumbnail */
  path: string;
  /** Output format (jpeg, png, gif) */
  format: 'jpeg' | 'png' | 'gif';
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Size in bytes */
  size: number;
}

/**
 * ThumbnailGenerator class
 * Handles thumbnail generation and caching for images
 */
export class ThumbnailGenerator {
  constructor(private readonly cacheDir: string) {}

  /**
   * Get the thumbnail path for an image
   * @param sdId Storage directory ID
   * @param imageId Image ID
   * @returns Full path to the thumbnail (may not exist yet)
   */
  getThumbnailPath(sdId: string, imageId: string, format: 'jpeg' | 'png' | 'gif' = 'jpeg'): string {
    const ext = format === 'jpeg' ? 'jpg' : format;
    return path.join(this.cacheDir, sdId, `${imageId}.thumb.${ext}`);
  }

  /**
   * Check if a thumbnail exists
   * @param sdId Storage directory ID
   * @param imageId Image ID
   */
  async thumbnailExists(sdId: string, imageId: string): Promise<boolean> {
    // Check for any format
    const formats: Array<'jpeg' | 'png' | 'gif'> = ['jpeg', 'png', 'gif'];
    for (const format of formats) {
      const thumbPath = this.getThumbnailPath(sdId, imageId, format);
      try {
        await fs.access(thumbPath);
        return true;
      } catch {
        // Continue checking other formats
      }
    }
    return false;
  }

  /**
   * Get the actual thumbnail path (checking all formats)
   */
  private async getExistingThumbnailPath(sdId: string, imageId: string): Promise<string | null> {
    const formats: Array<'jpeg' | 'png' | 'gif'> = ['jpeg', 'png', 'gif'];
    for (const format of formats) {
      const thumbPath = this.getThumbnailPath(sdId, imageId, format);
      try {
        await fs.access(thumbPath);
        return thumbPath;
      } catch {
        // Continue checking
      }
    }
    return null;
  }

  /**
   * Generate a thumbnail from image data
   * @param imageData Raw image data (Buffer)
   * @param mimeType MIME type of the image
   * @param imageId Image ID (for naming)
   * @returns Thumbnail result with path and metadata
   */
  async generateThumbnail(
    imageData: Buffer,
    mimeType: string,
    imageId: string
  ): Promise<ThumbnailResult> {
    // Create a temporary output path
    const tempDir = path.join(this.cacheDir, '_temp');
    await fs.mkdir(tempDir, { recursive: true });

    // Determine output format based on input
    const outputFormat = await this.determineOutputFormat(imageData, mimeType);
    const ext = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
    const outputPath = path.join(tempDir, `${imageId}.thumb.${ext}`);

    // Process the image
    let sharpInstance = sharp(imageData);

    // Get original metadata
    const metadata = await sharpInstance.metadata();
    const originalWidth = metadata.width ?? 0;
    const originalHeight = metadata.height ?? 0;

    // Calculate target dimensions (preserve aspect ratio, max 800px on longest edge)
    const { width: targetWidth, height: targetHeight } = this.calculateDimensions(
      originalWidth,
      originalHeight,
      ThumbnailSpec.MAX_SIZE
    );

    // Only resize if larger than max size
    if (originalWidth > ThumbnailSpec.MAX_SIZE || originalHeight > ThumbnailSpec.MAX_SIZE) {
      sharpInstance = sharpInstance.resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Apply format-specific options
    switch (outputFormat) {
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality: ThumbnailSpec.JPEG_QUALITY });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ compressionLevel: 6 });
        break;
      case 'gif':
        // For GIF, just keep as GIF (first frame for animated)
        sharpInstance = sharpInstance.gif();
        break;
    }

    // Write the thumbnail
    await sharpInstance.toFile(outputPath);

    // Get the output file stats
    const stats = await fs.stat(outputPath);
    const outputMetadata = await sharp(outputPath).metadata();

    return {
      path: outputPath,
      format: outputFormat,
      width: outputMetadata.width ?? targetWidth,
      height: outputMetadata.height ?? targetHeight,
      size: stats.size,
    };
  }

  /**
   * Generate a thumbnail for a specific storage directory
   * @param imageData Raw image data
   * @param mimeType MIME type of the image
   * @param sdId Storage directory ID
   * @param imageId Image ID
   */
  async generateThumbnailForSd(
    imageData: Buffer,
    mimeType: string,
    sdId: string,
    imageId: string
  ): Promise<ThumbnailResult> {
    // Ensure the SD-specific cache directory exists
    const sdCacheDir = path.join(this.cacheDir, sdId);
    await fs.mkdir(sdCacheDir, { recursive: true });

    // Generate thumbnail
    const tempResult = await this.generateThumbnail(imageData, mimeType, imageId);

    // Move to final location
    const finalPath = this.getThumbnailPath(sdId, imageId, tempResult.format);
    await fs.rename(tempResult.path, finalPath);

    return {
      ...tempResult,
      path: finalPath,
    };
  }

  /**
   * Delete a thumbnail
   * @param sdId Storage directory ID
   * @param imageId Image ID
   */
  async deleteThumbnail(sdId: string, imageId: string): Promise<void> {
    const existingPath = await this.getExistingThumbnailPath(sdId, imageId);
    if (existingPath) {
      try {
        await fs.unlink(existingPath);
      } catch {
        // Ignore errors if file doesn't exist
      }
    }
  }

  /**
   * Get thumbnail as a data URL
   * @param sdId Storage directory ID
   * @param imageId Image ID
   * @returns Data URL string or null if not found
   */
  async getThumbnailDataUrl(sdId: string, imageId: string): Promise<string | null> {
    const thumbPath = await this.getExistingThumbnailPath(sdId, imageId);
    if (!thumbPath) {
      return null;
    }

    try {
      const data = await fs.readFile(thumbPath);
      const ext = path.extname(thumbPath).toLowerCase();
      let mimeType: string;

      switch (ext) {
        case '.jpg':
        case '.jpeg':
          mimeType = 'image/jpeg';
          break;
        case '.png':
          mimeType = 'image/png';
          break;
        case '.gif':
          mimeType = 'image/gif';
          break;
        default:
          mimeType = 'image/jpeg';
      }

      return `data:${mimeType};base64,${data.toString('base64')}`;
    } catch {
      return null;
    }
  }

  /**
   * Determine the output format based on input image
   * - PNG with transparency -> PNG
   * - GIF -> GIF (preserve for animation)
   * - SVG -> PNG
   * - Everything else -> JPEG
   */
  private async determineOutputFormat(
    imageData: Buffer,
    mimeType: string
  ): Promise<'jpeg' | 'png' | 'gif'> {
    // Handle SVG (rasterize to PNG)
    if (mimeType === 'image/svg+xml') {
      return 'png';
    }

    // Handle GIF (preserve for animated preview)
    if (mimeType === 'image/gif') {
      return 'gif';
    }

    // Check if PNG has transparency
    if (mimeType === 'image/png') {
      try {
        const metadata = await sharp(imageData).metadata();
        if (metadata.hasAlpha) {
          // Check if alpha channel is actually used (not all 255)
          const stats = await sharp(imageData).stats();
          // If alpha channel has variance, keep PNG
          if (
            stats.channels.length >= 4 &&
            stats.channels[3] &&
            (stats.channels[3].min < 255 || stats.channels[3].stdev > 0)
          ) {
            return 'png';
          }
        }
      } catch {
        // If we can't determine, default to JPEG
      }
    }

    // Default to JPEG for everything else
    return 'jpeg';
  }

  /**
   * Calculate target dimensions while preserving aspect ratio
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxSize: number
  ): { width: number; height: number } {
    if (originalWidth <= maxSize && originalHeight <= maxSize) {
      return { width: originalWidth, height: originalHeight };
    }

    const aspectRatio = originalWidth / originalHeight;

    if (originalWidth > originalHeight) {
      // Landscape
      return {
        width: maxSize,
        height: Math.round(maxSize / aspectRatio),
      };
    } else {
      // Portrait or square
      return {
        width: Math.round(maxSize * aspectRatio),
        height: maxSize,
      };
    }
  }
}
