/**
 * ThumbnailCacheManager
 *
 * Manages thumbnail cache to prevent unbounded growth.
 * Implements age-based, size-based, and orphan cleanup strategies.
 *
 * @see plans/add-images/PLAN-PHASE-5.md
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Configuration for thumbnail cache management
 */
export interface ThumbnailCacheConfig {
  /** Maximum age in days before thumbnails are cleaned up (default: 90) */
  maxAgeDays?: number;
  /** Maximum total cache size in bytes (default: 1GB) */
  maxSizeBytes?: number;
}

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Number of thumbnails deleted */
  deletedCount: number;
  /** Total bytes freed */
  freedBytes: number;
  /** Paths of deleted files (for logging) */
  deletedPaths: string[];
}

/**
 * Statistics for a single SD's thumbnails
 */
export interface SdCacheStats {
  sdId: string;
  fileCount: number;
  totalSizeBytes: number;
}

/**
 * Overall cache statistics
 */
export interface CacheStats {
  totalFiles: number;
  totalSizeBytes: number;
  sdStats: SdCacheStats[];
}

/**
 * Result of a full cleanup run
 */
export interface FullCleanupResult {
  ageCleanup: CleanupResult;
  sizeCleanup: CleanupResult;
  orphanCleanup: CleanupResult;
  totalDeleted: number;
  totalFreedBytes: number;
}

/**
 * Function type for checking if an image exists
 */
export type ImageExistsCheck = (sdId: string, imageId: string) => Promise<boolean>;

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<ThumbnailCacheConfig> = {
  maxAgeDays: 90,
  maxSizeBytes: 1024 * 1024 * 1024, // 1GB
};

/**
 * Thumbnail file info for sorting
 */
interface ThumbnailFileInfo {
  path: string;
  sdId: string;
  imageId: string;
  mtime: Date;
  size: number;
}

/**
 * ThumbnailCacheManager
 *
 * Manages thumbnail cache cleanup and statistics.
 */
export class ThumbnailCacheManager {
  private cacheDir: string;
  private config: Required<ThumbnailCacheConfig>;

  constructor(cacheDir: string, config: ThumbnailCacheConfig = {}) {
    this.cacheDir = cacheDir;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get all thumbnail files with their metadata
   */
  private async getAllThumbnails(): Promise<ThumbnailFileInfo[]> {
    const thumbnails: ThumbnailFileInfo[] = [];

    try {
      // List all SD directories
      const sdDirs = await fs.readdir(this.cacheDir, { withFileTypes: true });

      for (const sdDir of sdDirs) {
        if (!sdDir.isDirectory()) continue;

        const sdId = sdDir.name;
        const sdPath = path.join(this.cacheDir, sdId);

        try {
          const files = await fs.readdir(sdPath, { withFileTypes: true });

          for (const file of files) {
            if (!file.isFile()) continue;
            if (!file.name.includes('.thumb.')) continue;

            const filePath = path.join(sdPath, file.name);
            const stats = await fs.stat(filePath);

            // Extract imageId from filename (e.g., "abc123.thumb.jpg" -> "abc123")
            const imageId = file.name.split('.thumb.')[0] ?? file.name;

            thumbnails.push({
              path: filePath,
              sdId,
              imageId,
              mtime: stats.mtime,
              size: stats.size,
            });
          }
        } catch {
          // SD directory might have been removed, continue
        }
      }
    } catch {
      // Cache directory might not exist yet
    }

    return thumbnails;
  }

  /**
   * Delete a thumbnail file and return the freed bytes
   */
  private async deleteThumbnail(thumbPath: string): Promise<number> {
    try {
      const stats = await fs.stat(thumbPath);
      const size = stats.size;
      await fs.unlink(thumbPath);
      return size;
    } catch {
      return 0;
    }
  }

  /**
   * Clean up thumbnails older than maxAgeDays
   */
  async cleanupOldThumbnails(): Promise<CleanupResult> {
    const result: CleanupResult = {
      deletedCount: 0,
      freedBytes: 0,
      deletedPaths: [],
    };

    const thumbnails = await this.getAllThumbnails();
    const cutoffDate = new Date(Date.now() - this.config.maxAgeDays * 24 * 60 * 60 * 1000);

    for (const thumb of thumbnails) {
      if (thumb.mtime < cutoffDate) {
        const freedBytes = await this.deleteThumbnail(thumb.path);
        if (freedBytes > 0) {
          result.deletedCount++;
          result.freedBytes += freedBytes;
          result.deletedPaths.push(thumb.path);
        }
      }
    }

    return result;
  }

  /**
   * Clean up oldest thumbnails when cache exceeds maxSizeBytes
   */
  async cleanupBySize(): Promise<CleanupResult> {
    const result: CleanupResult = {
      deletedCount: 0,
      freedBytes: 0,
      deletedPaths: [],
    };

    const thumbnails = await this.getAllThumbnails();
    const totalSize = thumbnails.reduce((sum, t) => sum + t.size, 0);

    if (totalSize <= this.config.maxSizeBytes) {
      return result;
    }

    // Sort by mtime (oldest first)
    thumbnails.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

    let currentSize = totalSize;
    for (const thumb of thumbnails) {
      if (currentSize <= this.config.maxSizeBytes) {
        break;
      }

      const freedBytes = await this.deleteThumbnail(thumb.path);
      if (freedBytes > 0) {
        result.deletedCount++;
        result.freedBytes += freedBytes;
        result.deletedPaths.push(thumb.path);
        currentSize -= freedBytes;
      }
    }

    return result;
  }

  /**
   * Clean up thumbnails for images that no longer exist
   */
  async cleanupOrphans(imageExistsCheck: ImageExistsCheck): Promise<CleanupResult> {
    const result: CleanupResult = {
      deletedCount: 0,
      freedBytes: 0,
      deletedPaths: [],
    };

    const thumbnails = await this.getAllThumbnails();

    for (const thumb of thumbnails) {
      const exists = await imageExistsCheck(thumb.sdId, thumb.imageId);
      if (!exists) {
        const freedBytes = await this.deleteThumbnail(thumb.path);
        if (freedBytes > 0) {
          result.deletedCount++;
          result.freedBytes += freedBytes;
          result.deletedPaths.push(thumb.path);
        }
      }
    }

    return result;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    const thumbnails = await this.getAllThumbnails();

    // Group by SD
    const sdMap = new Map<string, { count: number; size: number }>();
    for (const thumb of thumbnails) {
      const existing = sdMap.get(thumb.sdId) ?? { count: 0, size: 0 };
      existing.count++;
      existing.size += thumb.size;
      sdMap.set(thumb.sdId, existing);
    }

    const sdStats: SdCacheStats[] = [];
    for (const [sdId, stats] of sdMap) {
      sdStats.push({
        sdId,
        fileCount: stats.count,
        totalSizeBytes: stats.size,
      });
    }

    return {
      totalFiles: thumbnails.length,
      totalSizeBytes: thumbnails.reduce((sum, t) => sum + t.size, 0),
      sdStats,
    };
  }

  /**
   * Run all cleanup strategies
   */
  async runFullCleanup(imageExistsCheck: ImageExistsCheck): Promise<FullCleanupResult> {
    // Run age cleanup first (removes definitely old files)
    const ageCleanup = await this.cleanupOldThumbnails();

    // Run orphan cleanup (removes files for deleted images)
    const orphanCleanup = await this.cleanupOrphans(imageExistsCheck);

    // Run size cleanup last (removes oldest if still over limit)
    const sizeCleanup = await this.cleanupBySize();

    return {
      ageCleanup,
      sizeCleanup,
      orphanCleanup,
      totalDeleted: ageCleanup.deletedCount + sizeCleanup.deletedCount + orphanCleanup.deletedCount,
      totalFreedBytes: ageCleanup.freedBytes + sizeCleanup.freedBytes + orphanCleanup.freedBytes,
    };
  }

  /**
   * Update the access time of a thumbnail (call when thumbnail is used)
   */
  async updateAccessTime(sdId: string, imageId: string): Promise<void> {
    const thumbDir = path.join(this.cacheDir, sdId);

    // Try all possible extensions
    const extensions = ['jpg', 'png', 'gif'];
    for (const ext of extensions) {
      const thumbPath = path.join(thumbDir, `${imageId}.thumb.${ext}`);
      try {
        await fs.access(thumbPath);
        // Update mtime to now
        const now = new Date();
        await fs.utimes(thumbPath, now, now);
        return;
      } catch {
        // Try next extension
      }
    }
  }

  /**
   * Clean up empty SD directories
   */
  async cleanupEmptyDirs(): Promise<number> {
    let removedCount = 0;

    try {
      const sdDirs = await fs.readdir(this.cacheDir, { withFileTypes: true });

      for (const sdDir of sdDirs) {
        if (!sdDir.isDirectory()) continue;

        const sdPath = path.join(this.cacheDir, sdDir.name);
        try {
          const files = await fs.readdir(sdPath);
          if (files.length === 0) {
            await fs.rmdir(sdPath);
            removedCount++;
          }
        } catch {
          // Directory might have been removed, continue
        }
      }
    } catch {
      // Cache directory might not exist
    }

    return removedCount;
  }
}
