/**
 * ThumbnailGenerator tests
 *
 * @see plans/add-images/PLAN-PHASE-5.md
 */

import { mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import sharp from 'sharp';
import { ThumbnailGenerator, ThumbnailSpec } from '../thumbnail-generator';

// Store test image buffer
let testPngBuffer: Buffer;

describe('ThumbnailGenerator', () => {
  let testDir: string;
  let thumbnailCacheDir: string;
  let generator: ThumbnailGenerator;

  beforeAll(async () => {
    // Create a test image we can use (1000x1000 red PNG)
    testPngBuffer = await sharp({
      create: {
        width: 1000,
        height: 1000,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();
  });

  beforeEach(async () => {
    // Create temp directories
    testDir = join(tmpdir(), `thumbnail-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    thumbnailCacheDir = join(testDir, 'thumbnails');
    await mkdir(thumbnailCacheDir, { recursive: true });

    generator = new ThumbnailGenerator(thumbnailCacheDir);
  });

  afterEach(async () => {
    // Cleanup
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('generateThumbnail', () => {
    it('should generate thumbnail at correct max size (800px longest edge)', async () => {
      // Generate thumbnail from 1000x1000 image
      const result = await generator.generateThumbnail(testPngBuffer, 'image/png', 'test-image-1');

      expect(result.path).toContain('test-image-1');
      expect(result.path).toMatch(/\.thumb\.(jpg|png)$/);

      // Verify dimensions
      const thumbnailBuffer = await readFile(result.path);
      const metadata = await sharp(thumbnailBuffer as Buffer).metadata();

      expect(metadata.width).toBeLessThanOrEqual(ThumbnailSpec.MAX_SIZE);
      expect(metadata.height).toBeLessThanOrEqual(ThumbnailSpec.MAX_SIZE);
      // Original was 1000x1000, thumbnail should be 800x800
      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(800);
    });

    it('should not upscale images smaller than max size', async () => {
      // Create a small 200x200 image
      const smallImage = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 0, g: 255, b: 0 },
        },
      })
        .png()
        .toBuffer();

      const result = await generator.generateThumbnail(smallImage, 'image/png', 'small-image');

      // Verify dimensions are not upscaled
      const thumbnailBuffer = await readFile(result.path);
      const metadata = await sharp(thumbnailBuffer as Buffer).metadata();

      expect(metadata.width).toBe(200);
      expect(metadata.height).toBe(200);
    });

    it('should preserve aspect ratio for non-square images', async () => {
      // Create a 1600x800 image (2:1 aspect ratio)
      const wideImage = await sharp({
        create: {
          width: 1600,
          height: 800,
          channels: 3,
          background: { r: 0, g: 0, b: 255 },
        },
      })
        .png()
        .toBuffer();

      const result = await generator.generateThumbnail(wideImage, 'image/png', 'wide-image');

      const thumbnailBuffer = await readFile(result.path);
      const metadata = await sharp(thumbnailBuffer as Buffer).metadata();

      // Longest edge (width) should be 800, height should be 400
      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(400);
    });

    it('should handle JPEG input and output JPEG thumbnail', async () => {
      const jpegImage = await sharp({
        create: {
          width: 1000,
          height: 1000,
          channels: 3,
          background: { r: 128, g: 128, b: 128 },
        },
      })
        .jpeg({ quality: 90 })
        .toBuffer();

      const result = await generator.generateThumbnail(jpegImage, 'image/jpeg', 'jpeg-image');

      expect(result.path).toMatch(/\.thumb\.jpg$/);
      expect(result.format).toBe('jpeg');
    });

    it('should convert WebP to JPEG thumbnail', async () => {
      const webpImage = await sharp({
        create: {
          width: 1000,
          height: 1000,
          channels: 3,
          background: { r: 255, g: 255, b: 0 },
        },
      })
        .webp()
        .toBuffer();

      const result = await generator.generateThumbnail(webpImage, 'image/webp', 'webp-image');

      expect(result.path).toMatch(/\.thumb\.jpg$/);
      expect(result.format).toBe('jpeg');
    });

    it('should preserve PNG with transparency', async () => {
      // Create PNG with alpha channel (semi-transparent red)
      const transparentPng = await sharp({
        create: {
          width: 1000,
          height: 1000,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 0.5 },
        },
      })
        .png()
        .toBuffer();

      const result = await generator.generateThumbnail(
        transparentPng,
        'image/png',
        'transparent-png'
      );

      // Should keep PNG format for transparency
      expect(result.path).toMatch(/\.thumb\.png$/);
      expect(result.format).toBe('png');

      // Verify it has alpha channel
      const thumbnailBuffer = await readFile(result.path);
      const metadata = await sharp(thumbnailBuffer as Buffer).metadata();
      expect(metadata.channels).toBe(4);
      expect(metadata.hasAlpha).toBe(true);
    });

    it('should use JPEG for opaque PNG', async () => {
      // Create opaque PNG (no transparency)
      const opaquePng = await sharp({
        create: {
          width: 1000,
          height: 1000,
          channels: 3, // No alpha
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();

      const result = await generator.generateThumbnail(opaquePng, 'image/png', 'opaque-png');

      // Should convert to JPEG since no transparency needed
      expect(result.path).toMatch(/\.thumb\.jpg$/);
      expect(result.format).toBe('jpeg');
    });

    it('should handle GIF (extract first frame)', async () => {
      // Create a simple GIF-like image
      const gifImage = await sharp({
        create: {
          width: 1000,
          height: 1000,
          channels: 3,
          background: { r: 0, g: 255, b: 255 },
        },
      })
        .gif()
        .toBuffer();

      const result = await generator.generateThumbnail(gifImage, 'image/gif', 'gif-image');

      // GIF should be converted to GIF thumbnail (for animated preview)
      expect(result.format).toBe('gif');
    });

    it('should convert SVG to PNG thumbnail', async () => {
      // Simple SVG
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000">
        <rect width="100%" height="100%" fill="purple"/>
      </svg>`;
      const svgBuffer = Buffer.from(svgContent);

      const result = await generator.generateThumbnail(svgBuffer, 'image/svg+xml', 'svg-image');

      // SVG should be rasterized to PNG
      expect(result.path).toMatch(/\.thumb\.png$/);
      expect(result.format).toBe('png');
    });
  });

  describe('getThumbnailPath', () => {
    it('should return correct path for sdId and imageId', () => {
      const thumbPath = generator.getThumbnailPath('sd-123', 'img-456');
      expect(thumbPath).toBe(join(thumbnailCacheDir, 'sd-123', 'img-456.thumb.jpg'));
    });
  });

  describe('thumbnailExists', () => {
    it('should return false for non-existent thumbnail', async () => {
      const exists = await generator.thumbnailExists('sd-123', 'img-456');
      expect(exists).toBe(false);
    });

    it('should return true for existing thumbnail', async () => {
      // Generate a thumbnail
      await generator.generateThumbnailForSd(testPngBuffer, 'image/png', 'sd-123', 'img-456');

      const exists = await generator.thumbnailExists('sd-123', 'img-456');
      expect(exists).toBe(true);
    });
  });

  describe('generateThumbnailForSd', () => {
    it('should create thumbnail in SD-specific subdirectory', async () => {
      const result = await generator.generateThumbnailForSd(
        testPngBuffer,
        'image/png',
        'my-sd',
        'my-image'
      );

      expect(result.path).toContain('my-sd');
      expect(result.path).toContain('my-image');
    });
  });

  describe('deleteThumbnail', () => {
    it('should delete existing thumbnail', async () => {
      // Create thumbnail
      await generator.generateThumbnailForSd(testPngBuffer, 'image/png', 'sd-del', 'img-del');
      expect(await generator.thumbnailExists('sd-del', 'img-del')).toBe(true);

      // Delete it
      await generator.deleteThumbnail('sd-del', 'img-del');
      expect(await generator.thumbnailExists('sd-del', 'img-del')).toBe(false);
    });

    it('should not throw for non-existent thumbnail', async () => {
      await expect(generator.deleteThumbnail('no-sd', 'no-img')).resolves.not.toThrow();
    });
  });

  describe('getThumbnailDataUrl', () => {
    it('should return data URL for thumbnail', async () => {
      // Generate thumbnail
      await generator.generateThumbnailForSd(testPngBuffer, 'image/png', 'sd-url', 'img-url');

      const dataUrl = await generator.getThumbnailDataUrl('sd-url', 'img-url');

      expect(dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    });

    it('should return null for non-existent thumbnail', async () => {
      const dataUrl = await generator.getThumbnailDataUrl('no-sd', 'no-img');
      expect(dataUrl).toBeNull();
    });
  });
});
