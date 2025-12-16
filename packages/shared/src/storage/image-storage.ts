/**
 * Image storage layer
 * Handles file operations for images stored in sync directories
 *
 * @see plans/add-images/PLAN-PHASE-1.md
 */

import type { FileSystemAdapter } from './types';
import type { SyncDirectoryStructure } from './sd-structure';

/**
 * Generate a UUID v4
 * Uses native crypto.randomUUID() for Node.js and browsers
 */
function generateUuid(): string {
  // Use native crypto.randomUUID() - available in Node.js 14.17+ and modern browsers
  return crypto.randomUUID();
}

/**
 * Supported image MIME types and their file extensions
 */
const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const EXTENSION_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  heif: 'image/heif',
};

/**
 * Result of saving an image
 */
export interface SaveImageResult {
  imageId: string;
  filename: string;
}

/**
 * Image file information
 */
export interface ImageInfo {
  filename: string;
  size: number;
}

/**
 * Result of discovering an image on disk
 * Used for registering synced images that exist on disk but not in database
 */
export interface DiscoveredImage {
  filename: string;
  mimeType: string;
  size: number;
}

/**
 * Parsed image filename
 */
export interface ParsedImageFilename {
  imageId: string;
  extension: string;
  mimeType: string;
}

/**
 * Get MIME type for a file extension
 * @param extension Extension (without dot, case-insensitive)
 * @returns MIME type or null if unsupported
 */
export function getMimeTypeFromExtension(extension: string): string | null {
  return EXTENSION_TO_MIME[extension.toLowerCase()] || null;
}

/**
 * Check if a MIME type is supported
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return mimeType in MIME_TO_EXTENSION;
}

/**
 * Get file extension for a MIME type
 * @returns Extension (without dot) or null if unsupported
 */
export function getExtensionFromMimeType(mimeType: string): string | null {
  return MIME_TO_EXTENSION[mimeType] || null;
}

/**
 * Validate an image ID format
 * Accepts both UUID format (old images) and hex format (new content-addressed images)
 *
 * @param id The image ID to validate
 * @returns true if valid, false otherwise
 *
 * Valid formats:
 * - UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars with dashes)
 * - Hex: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (32 chars, no dashes)
 */
export function isValidImageId(id: string): boolean {
  // UUID format (old images) - 36 chars with dashes
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Hex format (new images after Phase 4) - 32 chars, no dashes
  const hexRegex = /^[0-9a-f]{32}$/i;
  return uuidRegex.test(id) || hexRegex.test(id);
}

/** Supported image extensions for discovery */
const SUPPORTED_EXTENSIONS = Object.keys(EXTENSION_TO_MIME);

/**
 * ImageStorage class
 * Handles file operations for images in sync directories
 */
export class ImageStorage {
  constructor(
    private readonly fs: FileSystemAdapter,
    private readonly sdStructure: SyncDirectoryStructure
  ) {}

  /**
   * Get the media directory path
   */
  getMediaPath(): string {
    return this.sdStructure.getMediaPath();
  }

  /**
   * Get the full path for an image file
   * @param imageId The image ID (UUID)
   * @param mimeType The MIME type of the image
   * @throws Error if MIME type is not supported
   */
  getImagePath(imageId: string, mimeType: string): string {
    const extension = ImageStorage.getExtensionFromMimeType(mimeType);
    if (!extension) {
      throw new Error(`Unsupported image MIME type: ${mimeType}`);
    }
    return this.fs.joinPath(this.getMediaPath(), `${imageId}.${extension}`);
  }

  /**
   * Get file extension for a MIME type
   * @returns Extension (without dot) or null if unsupported
   */
  static getExtensionFromMimeType(mimeType: string): string | null {
    return MIME_TO_EXTENSION[mimeType] || null;
  }

  /**
   * Get MIME type for a file extension
   * @param extension Extension (without dot, case-insensitive)
   * @returns MIME type or null if unsupported
   */
  static getMimeTypeFromExtension(extension: string): string | null {
    return EXTENSION_TO_MIME[extension.toLowerCase()] || null;
  }

  /**
   * Check if a MIME type is supported
   */
  static isSupportedMimeType(mimeType: string): boolean {
    return mimeType in MIME_TO_EXTENSION;
  }

  /**
   * Parse an image filename to extract ID, extension, and MIME type
   * @param filename Filename (e.g., "abc123.png")
   * @returns Parsed info or null if invalid
   */
  static parseImageFilename(filename: string): ParsedImageFilename | null {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return null;
    }

    const extension = filename.slice(lastDotIndex + 1).toLowerCase();
    const mimeType = ImageStorage.getMimeTypeFromExtension(extension);
    if (!mimeType) {
      return null;
    }

    const imageId = filename.slice(0, lastDotIndex);
    return {
      imageId,
      extension,
      mimeType,
    };
  }

  /**
   * Initialize the media directory if it doesn't exist
   */
  async initializeMediaDir(): Promise<void> {
    await this.fs.mkdir(this.getMediaPath());
  }

  /**
   * Save an image to the media directory
   * @param data Image binary data
   * @param mimeType MIME type of the image
   * @param imageId Optional custom image ID (UUID generated if not provided)
   * @returns The imageId and filename
   * @throws Error if MIME type is not supported
   */
  async saveImage(data: Uint8Array, mimeType: string, imageId?: string): Promise<SaveImageResult> {
    if (!ImageStorage.isSupportedMimeType(mimeType)) {
      throw new Error(`Unsupported image MIME type: ${mimeType}`);
    }

    const id = imageId || generateUuid();
    const extension = ImageStorage.getExtensionFromMimeType(mimeType)!;
    const filename = `${id}.${extension}`;

    // Ensure media directory exists
    await this.initializeMediaDir();

    // Write the image file
    const filePath = this.getImagePath(id, mimeType);
    await this.fs.writeFile(filePath, data);

    return {
      imageId: id,
      filename,
    };
  }

  /**
   * Read an image from the media directory
   * @param imageId The image ID
   * @param mimeType The MIME type (needed to determine file extension)
   * @returns Image data or null if not found
   */
  async readImage(imageId: string, mimeType: string): Promise<Uint8Array | null> {
    try {
      const filePath = this.getImagePath(imageId, mimeType);
      return await this.fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  /**
   * Delete an image from the media directory
   * @param imageId The image ID
   * @param mimeType The MIME type (needed to determine file extension)
   */
  async deleteImage(imageId: string, mimeType: string): Promise<void> {
    try {
      const filePath = this.getImagePath(imageId, mimeType);
      await this.fs.deleteFile(filePath);
    } catch {
      // Ignore errors if file doesn't exist
    }
  }

  /**
   * Check if an image exists in the media directory
   * @param imageId The image ID
   * @param mimeType The MIME type (needed to determine file extension)
   */
  async imageExists(imageId: string, mimeType: string): Promise<boolean> {
    const filePath = this.getImagePath(imageId, mimeType);
    return this.fs.exists(filePath);
  }

  /**
   * List all image filenames in the media directory
   * @returns Array of filenames (e.g., ["abc123.png", "def456.jpg"])
   */
  async listImages(): Promise<string[]> {
    const mediaPath = this.getMediaPath();
    const exists = await this.fs.exists(mediaPath);
    if (!exists) {
      return [];
    }

    const files = await this.fs.listFiles(mediaPath);
    // Filter to only include supported image files
    return files.filter((f) => ImageStorage.parseImageFilename(f) !== null);
  }

  /**
   * Get information about an image
   * @param imageId The image ID
   * @param mimeType The MIME type (needed to determine file extension)
   * @returns Image info or null if not found
   */
  async getImageInfo(imageId: string, mimeType: string): Promise<ImageInfo | null> {
    const exists = await this.imageExists(imageId, mimeType);
    if (!exists) {
      return null;
    }

    const filePath = this.getImagePath(imageId, mimeType);
    const stats = await this.fs.stat(filePath);
    const extension = ImageStorage.getExtensionFromMimeType(mimeType)!;

    return {
      filename: `${imageId}.${extension}`,
      size: stats.size,
    };
  }

  /**
   * Discover an image on disk by scanning for files matching the imageId
   *
   * This is used to find synced images that exist on disk but aren't registered
   * in the database. It scans the media directory for any file matching
   * {imageId}.{extension} where extension is a supported image type.
   *
   * @param imageId The image ID to look for (UUID or hex format)
   * @returns Discovered image info or null if not found
   *
   * Security: Validates imageId format to prevent path traversal attacks
   */
  async discoverImageOnDisk(imageId: string): Promise<DiscoveredImage | null> {
    // Security: Validate imageId format to prevent path traversal
    if (!isValidImageId(imageId)) {
      console.warn(`[ImageStorage] Invalid imageId format rejected: ${imageId}`);
      return null;
    }

    const mediaPath = this.getMediaPath();

    // Check if media directory exists
    const mediaExists = await this.fs.exists(mediaPath);
    if (!mediaExists) {
      return null;
    }

    // Try each supported extension
    for (const ext of SUPPORTED_EXTENSIONS) {
      const filename = `${imageId}.${ext}`;
      const filePath = this.fs.joinPath(mediaPath, filename);

      try {
        const exists = await this.fs.exists(filePath);
        if (exists) {
          const stats = await this.fs.stat(filePath);
          const mimeType = ImageStorage.getMimeTypeFromExtension(ext)!;

          return {
            filename,
            mimeType,
            size: stats.size,
          };
        }
      } catch {
        // Continue trying other extensions
        continue;
      }
    }

    return null;
  }
}
