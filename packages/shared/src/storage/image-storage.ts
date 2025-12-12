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
}
