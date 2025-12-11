/**
 * ThumbnailCacheManager Tests
 *
 * Tests for thumbnail cache cleanup and management.
 * @see plans/add-images/PLAN-PHASE-5.md
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ThumbnailCacheManager, ThumbnailCacheConfig } from '../thumbnail-cache-manager';

describe('ThumbnailCacheManager', () => {
  let testDir: string;
  let cacheManager: ThumbnailCacheManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'thumb-cache-test-'));
  });

  afterEach(async () => {
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper to create a thumbnail file with specific mtime
   */
  async function createThumbnail(
    sdId: string,
    imageId: string,
    options: { ageInDays?: number; sizeBytes?: number } = {}
  ): Promise<string> {
    const sdDir = path.join(testDir, sdId);
    await fs.mkdir(sdDir, { recursive: true });

    const thumbPath = path.join(sdDir, `${imageId}.thumb.jpg`);
    const content = options.sizeBytes
      ? Buffer.alloc(options.sizeBytes, 'x')
      : Buffer.from('fake thumbnail data');

    await fs.writeFile(thumbPath, content);

    // Set mtime to simulate age
    if (options.ageInDays !== undefined) {
      const mtime = new Date(Date.now() - options.ageInDays * 24 * 60 * 60 * 1000);
      await fs.utimes(thumbPath, mtime, mtime);
    }

    return thumbPath;
  }

  describe('constructor', () => {
    it('should create instance with default config', () => {
      cacheManager = new ThumbnailCacheManager(testDir);
      expect(cacheManager).toBeDefined();
    });

    it('should accept custom config', () => {
      const config: ThumbnailCacheConfig = {
        maxAgeDays: 30,
        maxSizeBytes: 500 * 1024 * 1024, // 500MB
      };
      cacheManager = new ThumbnailCacheManager(testDir, config);
      expect(cacheManager).toBeDefined();
    });
  });

  describe('cleanupOldThumbnails', () => {
    it('should remove thumbnails older than maxAgeDays', async () => {
      cacheManager = new ThumbnailCacheManager(testDir, { maxAgeDays: 90 });

      // Create thumbnails with different ages
      const oldThumb = await createThumbnail('sd-1', 'old-image', { ageInDays: 100 });
      const newThumb = await createThumbnail('sd-1', 'new-image', { ageInDays: 10 });

      const result = await cacheManager.cleanupOldThumbnails();

      // Old thumbnail should be removed
      await expect(fs.access(oldThumb)).rejects.toThrow();
      // New thumbnail should remain
      await expect(fs.access(newThumb)).resolves.toBeUndefined();

      expect(result.deletedCount).toBe(1);
      expect(result.freedBytes).toBeGreaterThan(0);
    });

    it('should not remove thumbnails within maxAgeDays', async () => {
      cacheManager = new ThumbnailCacheManager(testDir, { maxAgeDays: 90 });

      const thumb1 = await createThumbnail('sd-1', 'image-1', { ageInDays: 30 });
      const thumb2 = await createThumbnail('sd-1', 'image-2', { ageInDays: 89 });

      const result = await cacheManager.cleanupOldThumbnails();

      // Both should remain
      await expect(fs.access(thumb1)).resolves.toBeUndefined();
      await expect(fs.access(thumb2)).resolves.toBeUndefined();

      expect(result.deletedCount).toBe(0);
    });

    it('should clean up across multiple SD directories', async () => {
      cacheManager = new ThumbnailCacheManager(testDir, { maxAgeDays: 90 });

      const oldThumb1 = await createThumbnail('sd-1', 'old-1', { ageInDays: 100 });
      const oldThumb2 = await createThumbnail('sd-2', 'old-2', { ageInDays: 95 });
      const newThumb = await createThumbnail('sd-3', 'new-1', { ageInDays: 5 });

      const result = await cacheManager.cleanupOldThumbnails();

      await expect(fs.access(oldThumb1)).rejects.toThrow();
      await expect(fs.access(oldThumb2)).rejects.toThrow();
      await expect(fs.access(newThumb)).resolves.toBeUndefined();

      expect(result.deletedCount).toBe(2);
    });
  });

  describe('cleanupBySize', () => {
    it('should remove oldest thumbnails when cache exceeds maxSizeBytes', async () => {
      // Set max size to 1KB for testing
      cacheManager = new ThumbnailCacheManager(testDir, { maxSizeBytes: 1024 });

      // Create thumbnails totaling more than 1KB
      // Oldest (500 bytes) - should be removed first
      const oldest = await createThumbnail('sd-1', 'oldest', {
        ageInDays: 30,
        sizeBytes: 500,
      });
      // Middle (500 bytes)
      const middle = await createThumbnail('sd-1', 'middle', {
        ageInDays: 15,
        sizeBytes: 500,
      });
      // Newest (500 bytes)
      const newest = await createThumbnail('sd-1', 'newest', {
        ageInDays: 1,
        sizeBytes: 500,
      });

      const result = await cacheManager.cleanupBySize();

      // Oldest should be removed to get under 1KB
      await expect(fs.access(oldest)).rejects.toThrow();
      // Middle and newest should remain (1000 bytes total, under 1024)
      await expect(fs.access(middle)).resolves.toBeUndefined();
      await expect(fs.access(newest)).resolves.toBeUndefined();

      expect(result.deletedCount).toBeGreaterThan(0);
    });

    it('should not remove anything when cache is under maxSizeBytes', async () => {
      cacheManager = new ThumbnailCacheManager(testDir, {
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
      });

      const thumb1 = await createThumbnail('sd-1', 'image-1', { sizeBytes: 1000 });
      const thumb2 = await createThumbnail('sd-1', 'image-2', { sizeBytes: 1000 });

      const result = await cacheManager.cleanupBySize();

      await expect(fs.access(thumb1)).resolves.toBeUndefined();
      await expect(fs.access(thumb2)).resolves.toBeUndefined();

      expect(result.deletedCount).toBe(0);
    });
  });

  describe('cleanupOrphans', () => {
    it('should remove thumbnails for images that no longer exist', async () => {
      cacheManager = new ThumbnailCacheManager(testDir);

      const orphanThumb = await createThumbnail('sd-1', 'orphan-image');
      const validThumb = await createThumbnail('sd-1', 'valid-image');

      // Mock function that reports which images exist
      const imageExistsCheck = async (_sdId: string, imageId: string): Promise<boolean> => {
        void _sdId; // Silence unused variable warning
        return imageId === 'valid-image';
      };

      const result = await cacheManager.cleanupOrphans(imageExistsCheck);

      // Orphan should be removed
      await expect(fs.access(orphanThumb)).rejects.toThrow();
      // Valid should remain
      await expect(fs.access(validThumb)).resolves.toBeUndefined();

      expect(result.deletedCount).toBe(1);
    });

    it('should handle multiple SDs correctly', async () => {
      cacheManager = new ThumbnailCacheManager(testDir);

      const thumb1 = await createThumbnail('sd-1', 'image-a');
      const thumb2 = await createThumbnail('sd-2', 'image-a'); // Same imageId, different SD

      // Only image-a in sd-1 exists
      const imageExistsCheck = async (sdId: string, imageId: string): Promise<boolean> => {
        return sdId === 'sd-1' && imageId === 'image-a';
      };

      const result = await cacheManager.cleanupOrphans(imageExistsCheck);

      await expect(fs.access(thumb1)).resolves.toBeUndefined();
      await expect(fs.access(thumb2)).rejects.toThrow();

      expect(result.deletedCount).toBe(1);
    });
  });

  describe('getCacheStats', () => {
    it('should return total size and count of thumbnails', async () => {
      cacheManager = new ThumbnailCacheManager(testDir);

      await createThumbnail('sd-1', 'image-1', { sizeBytes: 1000 });
      await createThumbnail('sd-1', 'image-2', { sizeBytes: 2000 });
      await createThumbnail('sd-2', 'image-3', { sizeBytes: 3000 });

      const stats = await cacheManager.getCacheStats();

      expect(stats.totalFiles).toBe(3);
      expect(stats.totalSizeBytes).toBe(6000);
      expect(stats.sdStats).toHaveLength(2);
    });

    it('should return empty stats for empty cache', async () => {
      cacheManager = new ThumbnailCacheManager(testDir);

      const stats = await cacheManager.getCacheStats();

      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSizeBytes).toBe(0);
      expect(stats.sdStats).toHaveLength(0);
    });
  });

  describe('runFullCleanup', () => {
    it('should run all cleanup strategies', async () => {
      cacheManager = new ThumbnailCacheManager(testDir, {
        maxAgeDays: 90,
        maxSizeBytes: 10 * 1024 * 1024,
      });

      // Create some thumbnails
      await createThumbnail('sd-1', 'old-image', { ageInDays: 100 });
      await createThumbnail('sd-1', 'valid-image', { ageInDays: 10 });

      const imageExistsCheck = async (_sdId: string, imageId: string): Promise<boolean> => {
        void _sdId; // Silence unused variable warning
        return imageId === 'valid-image';
      };

      const result = await cacheManager.runFullCleanup(imageExistsCheck);

      expect(result.ageCleanup.deletedCount).toBe(1); // old-image
      expect(result.totalDeleted).toBeGreaterThanOrEqual(1);
    });
  });

  describe('updateAccessTime', () => {
    it('should update the mtime of a thumbnail', async () => {
      cacheManager = new ThumbnailCacheManager(testDir);

      const thumbPath = await createThumbnail('sd-1', 'image-1', { ageInDays: 50 });

      const statsBefore = await fs.stat(thumbPath);
      const mtimeBefore = statsBefore.mtime.getTime();

      // Wait a small amount to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await cacheManager.updateAccessTime('sd-1', 'image-1');

      const statsAfter = await fs.stat(thumbPath);
      const mtimeAfter = statsAfter.mtime.getTime();

      expect(mtimeAfter).toBeGreaterThan(mtimeBefore);
    });
  });
});
