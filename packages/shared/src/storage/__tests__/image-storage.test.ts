import { ImageStorage, isValidImageId, hashImageContent } from '../image-storage';
import type { FileSystemAdapter, SyncDirectoryConfig, FileStats } from '../types';
import { SyncDirectoryStructure } from '../sd-structure';

/**
 * Mock file system adapter for testing
 */
class MockFileSystemAdapter implements FileSystemAdapter {
  private files = new Map<string, Uint8Array>();
  private dirs = new Set<string>();

  /* eslint-disable @typescript-eslint/require-await */
  async exists(path: string): Promise<boolean> {
    return this.dirs.has(path) || this.files.has(path);
  }

  async mkdir(path: string): Promise<void> {
    this.dirs.add(path);
  }

  async readFile(path: string): Promise<Uint8Array> {
    const storedData = this.files.get(path);
    if (!storedData) {
      throw new Error(`File not found: ${path}`);
    }
    return storedData;
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    this.files.set(path, data);
  }

  async appendFile(path: string, data: Uint8Array): Promise<void> {
    const existing = this.files.get(path) || new Uint8Array(0);
    const newData = new Uint8Array(existing.length + data.length);
    newData.set(existing, 0);
    newData.set(data, existing.length);
    this.files.set(path, newData);
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
  }

  async listFiles(path: string): Promise<string[]> {
    const result: string[] = [];
    const prefix = path + '/';

    // List files only (not directories)
    for (const file of this.files.keys()) {
      if (file.startsWith(prefix) && !file.slice(prefix.length).includes('/')) {
        result.push(file.slice(prefix.length));
      }
    }

    return result;
  }

  joinPath(...segments: string[]): string {
    return segments.join('/');
  }

  basename(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1] || '';
  }

  async stat(path: string): Promise<FileStats> {
    const data = this.files.get(path);
    if (!data) {
      throw new Error(`File not found: ${path}`);
    }
    return {
      size: data.length,
      mtimeMs: Date.now(),
      ctimeMs: Date.now(),
    };
  }
  /* eslint-enable @typescript-eslint/require-await */

  // Test helpers
  reset() {
    this.files.clear();
    this.dirs.clear();
  }

  getDir(path: string): boolean {
    return this.dirs.has(path);
  }

  getFile(path: string): Uint8Array | undefined {
    return this.files.get(path);
  }

  setFile(path: string, data: Uint8Array): void {
    this.files.set(path, data);
  }
}

describe('ImageStorage', () => {
  let fs: MockFileSystemAdapter;
  let config: SyncDirectoryConfig;
  let sdStructure: SyncDirectoryStructure;
  let imageStorage: ImageStorage;

  beforeEach(async () => {
    fs = new MockFileSystemAdapter();
    config = {
      id: 'sd-test',
      path: '/test/sd',
      label: 'Test SD',
    };
    sdStructure = new SyncDirectoryStructure(fs, config);
    await sdStructure.initialize();
    imageStorage = new ImageStorage(fs, sdStructure);
  });

  describe('getMediaPath', () => {
    it('should return correct media directory path', () => {
      const mediaPath = imageStorage.getMediaPath();
      expect(mediaPath).toBe('/test/sd/media');
    });
  });

  describe('getImagePath', () => {
    it('should return correct image file path for PNG', () => {
      const path = imageStorage.getImagePath('abc123', 'image/png');
      expect(path).toBe('/test/sd/media/abc123.png');
    });

    it('should return correct image file path for JPEG', () => {
      const path = imageStorage.getImagePath('def456', 'image/jpeg');
      expect(path).toBe('/test/sd/media/def456.jpg');
    });

    it('should return correct image file path for GIF', () => {
      const path = imageStorage.getImagePath('ghi789', 'image/gif');
      expect(path).toBe('/test/sd/media/ghi789.gif');
    });

    it('should return correct image file path for WebP', () => {
      const path = imageStorage.getImagePath('jkl012', 'image/webp');
      expect(path).toBe('/test/sd/media/jkl012.webp');
    });

    it('should return correct image file path for SVG', () => {
      const path = imageStorage.getImagePath('mno345', 'image/svg+xml');
      expect(path).toBe('/test/sd/media/mno345.svg');
    });

    it('should return correct image file path for HEIC', () => {
      const path = imageStorage.getImagePath('pqr678', 'image/heic');
      expect(path).toBe('/test/sd/media/pqr678.heic');
    });

    it('should throw for unsupported MIME type', () => {
      expect(() => imageStorage.getImagePath('xyz', 'application/pdf')).toThrow(
        'Unsupported image MIME type: application/pdf'
      );
    });
  });

  describe('getExtensionFromMimeType', () => {
    it('should return correct extensions for all supported types', () => {
      expect(ImageStorage.getExtensionFromMimeType('image/png')).toBe('png');
      expect(ImageStorage.getExtensionFromMimeType('image/jpeg')).toBe('jpg');
      expect(ImageStorage.getExtensionFromMimeType('image/gif')).toBe('gif');
      expect(ImageStorage.getExtensionFromMimeType('image/webp')).toBe('webp');
      expect(ImageStorage.getExtensionFromMimeType('image/svg+xml')).toBe('svg');
      expect(ImageStorage.getExtensionFromMimeType('image/heic')).toBe('heic');
      expect(ImageStorage.getExtensionFromMimeType('image/heif')).toBe('heif');
    });

    it('should return null for unsupported types', () => {
      expect(ImageStorage.getExtensionFromMimeType('application/pdf')).toBeNull();
      expect(ImageStorage.getExtensionFromMimeType('text/plain')).toBeNull();
      expect(ImageStorage.getExtensionFromMimeType('video/mp4')).toBeNull();
    });
  });

  describe('getMimeTypeFromExtension', () => {
    it('should return correct MIME types for all supported extensions', () => {
      expect(ImageStorage.getMimeTypeFromExtension('png')).toBe('image/png');
      expect(ImageStorage.getMimeTypeFromExtension('jpg')).toBe('image/jpeg');
      expect(ImageStorage.getMimeTypeFromExtension('jpeg')).toBe('image/jpeg');
      expect(ImageStorage.getMimeTypeFromExtension('gif')).toBe('image/gif');
      expect(ImageStorage.getMimeTypeFromExtension('webp')).toBe('image/webp');
      expect(ImageStorage.getMimeTypeFromExtension('svg')).toBe('image/svg+xml');
      expect(ImageStorage.getMimeTypeFromExtension('heic')).toBe('image/heic');
      expect(ImageStorage.getMimeTypeFromExtension('heif')).toBe('image/heif');
    });

    it('should be case-insensitive', () => {
      expect(ImageStorage.getMimeTypeFromExtension('PNG')).toBe('image/png');
      expect(ImageStorage.getMimeTypeFromExtension('JPG')).toBe('image/jpeg');
      expect(ImageStorage.getMimeTypeFromExtension('GIF')).toBe('image/gif');
    });

    it('should return null for unsupported extensions', () => {
      expect(ImageStorage.getMimeTypeFromExtension('pdf')).toBeNull();
      expect(ImageStorage.getMimeTypeFromExtension('txt')).toBeNull();
      expect(ImageStorage.getMimeTypeFromExtension('mp4')).toBeNull();
    });
  });

  describe('initializeMediaDir', () => {
    it('should create media directory', async () => {
      await imageStorage.initializeMediaDir();
      expect(fs.getDir('/test/sd/media')).toBe(true);
    });

    it('should be idempotent', async () => {
      await imageStorage.initializeMediaDir();
      await imageStorage.initializeMediaDir();
      expect(fs.getDir('/test/sd/media')).toBe(true);
    });
  });

  describe('saveImage', () => {
    const testImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes

    beforeEach(async () => {
      await imageStorage.initializeMediaDir();
    });

    it('should save image with generated ID', async () => {
      const result = await imageStorage.saveImage(testImageData, 'image/png');

      expect(result.imageId).toBeDefined();
      expect(result.filename).toMatch(/^[a-f0-9-]+\.png$/);

      // Verify file was written
      const filePath = imageStorage.getImagePath(result.imageId, 'image/png');
      const savedData = fs.getFile(filePath);
      expect(savedData).toEqual(testImageData);
    });

    it('should save image with provided ID', async () => {
      const customId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; // Valid UUID format
      const result = await imageStorage.saveImage(testImageData, 'image/jpeg', customId);

      expect(result.imageId).toBe(customId);
      expect(result.filename).toBe(`${customId}.jpg`);
    });

    it('should create media directory if it does not exist', async () => {
      fs.reset();
      // Re-initialize SD structure without media dir
      await sdStructure.initialize();

      const result = await imageStorage.saveImage(testImageData, 'image/png');
      expect(result.imageId).toBeDefined();
      expect(fs.getDir('/test/sd/media')).toBe(true);
    });

    it('should reject unsupported MIME types', async () => {
      await expect(imageStorage.saveImage(testImageData, 'application/pdf')).rejects.toThrow(
        'Unsupported image MIME type: application/pdf'
      );
    });

    // Phase 4.2: Content-addressable storage tests
    describe('content-addressable storage (Phase 4)', () => {
      it('should return same imageId for same image content', async () => {
        const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

        const result1 = await imageStorage.saveImage(imageData, 'image/png');
        const result2 = await imageStorage.saveImage(imageData, 'image/png');

        expect(result1.imageId).toBe(result2.imageId);
      });

      it('should not write duplicate file when same image saved twice', async () => {
        const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

        const result1 = await imageStorage.saveImage(imageData, 'image/png');

        // Modify the stored file to detect if it gets overwritten
        const filePath = imageStorage.getImagePath(result1.imageId, 'image/png');
        const modifiedData = new Uint8Array([0xff, 0xff, 0xff, 0xff]);
        fs.setFile(filePath, modifiedData);

        // Save same image again - should not overwrite
        await imageStorage.saveImage(imageData, 'image/png');

        // File should still have modified data (was not overwritten)
        const storedData = fs.getFile(filePath);
        expect(storedData).toEqual(modifiedData);
      });

      it('should return different imageIds for different image content', async () => {
        const imageData1 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        const imageData2 = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

        const result1 = await imageStorage.saveImage(imageData1, 'image/png');
        const result2 = await imageStorage.saveImage(imageData2, 'image/jpeg');

        expect(result1.imageId).not.toBe(result2.imageId);
      });

      it('should generate 32-char hex imageId (not UUID)', async () => {
        const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

        const result = await imageStorage.saveImage(imageData, 'image/png');

        // New content-addressed format: 32 chars, no dashes
        expect(result.imageId).toHaveLength(32);
        expect(result.imageId).toMatch(/^[0-9a-f]{32}$/);
      });

      it('should use provided custom ID instead of hash when specified', async () => {
        const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
        const customId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; // Valid UUID format

        const result = await imageStorage.saveImage(imageData, 'image/png', customId);

        expect(result.imageId).toBe(customId);
      });

      it('should reject empty image data', async () => {
        const emptyData = new Uint8Array(0);

        await expect(imageStorage.saveImage(emptyData, 'image/png')).rejects.toThrow(
          'Cannot save empty image data'
        );
      });

      it('should reject invalid custom imageId (path traversal protection)', async () => {
        const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

        await expect(
          imageStorage.saveImage(imageData, 'image/png', '../../../etc/passwd')
        ).rejects.toThrow('Invalid imageId format');
      });

      it('should accept valid UUID custom imageId', async () => {
        const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
        const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

        const result = await imageStorage.saveImage(imageData, 'image/png', validUuid);

        expect(result.imageId).toBe(validUuid);
      });

      it('should accept valid hex custom imageId (32 chars)', async () => {
        const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
        const validHex = 'a1b2c3d4e5f67890abcdef1234567890';

        const result = await imageStorage.saveImage(imageData, 'image/png', validHex);

        expect(result.imageId).toBe(validHex);
      });
    });
  });

  describe('readImage', () => {
    const testImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    beforeEach(async () => {
      await imageStorage.initializeMediaDir();
    });

    it('should read existing image', async () => {
      const { imageId } = await imageStorage.saveImage(testImageData, 'image/png');
      const readData = await imageStorage.readImage(imageId, 'image/png');

      expect(readData).toEqual(testImageData);
    });

    it('should return null for non-existent image', async () => {
      const result = await imageStorage.readImage('nonexistent', 'image/png');
      expect(result).toBeNull();
    });
  });

  describe('deleteImage', () => {
    const testImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    beforeEach(async () => {
      await imageStorage.initializeMediaDir();
    });

    it('should delete existing image', async () => {
      const { imageId } = await imageStorage.saveImage(testImageData, 'image/png');

      await imageStorage.deleteImage(imageId, 'image/png');

      const exists = await imageStorage.imageExists(imageId, 'image/png');
      expect(exists).toBe(false);
    });

    it('should not throw for non-existent image', async () => {
      await expect(imageStorage.deleteImage('nonexistent', 'image/png')).resolves.not.toThrow();
    });
  });

  describe('imageExists', () => {
    const testImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    beforeEach(async () => {
      await imageStorage.initializeMediaDir();
    });

    it('should return true for existing image', async () => {
      const { imageId } = await imageStorage.saveImage(testImageData, 'image/png');
      const exists = await imageStorage.imageExists(imageId, 'image/png');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent image', async () => {
      const exists = await imageStorage.imageExists('nonexistent', 'image/png');
      expect(exists).toBe(false);
    });
  });

  describe('listImages', () => {
    const testImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    beforeEach(async () => {
      await imageStorage.initializeMediaDir();
    });

    it('should return empty array when no images exist', async () => {
      const images = await imageStorage.listImages();
      expect(images).toEqual([]);
    });

    it('should list all images', async () => {
      // Use valid UUID format IDs
      const img1 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const img2 = 'b2c3d4e5-f678-9012-bcde-f12345678901';
      const img3 = 'c3d4e5f6-7890-1234-cdef-123456789012';

      await imageStorage.saveImage(testImageData, 'image/png', img1);
      await imageStorage.saveImage(testImageData, 'image/jpeg', img2);
      await imageStorage.saveImage(testImageData, 'image/gif', img3);

      const images = await imageStorage.listImages();
      expect(images).toHaveLength(3);
      expect(images).toContain(`${img1}.png`);
      expect(images).toContain(`${img2}.jpg`);
      expect(images).toContain(`${img3}.gif`);
    });

    it('should return empty array when media directory does not exist', async () => {
      fs.reset();
      // Re-initialize SD structure without media dir
      await sdStructure.initialize();

      const images = await imageStorage.listImages();
      expect(images).toEqual([]);
    });
  });

  describe('getImageInfo', () => {
    const testImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    beforeEach(async () => {
      await imageStorage.initializeMediaDir();
    });

    it('should return image info for existing image', async () => {
      const { imageId } = await imageStorage.saveImage(testImageData, 'image/png');
      const info = await imageStorage.getImageInfo(imageId, 'image/png');

      expect(info).not.toBeNull();
      expect(info!.size).toBe(testImageData.length);
      expect(info!.filename).toBe(`${imageId}.png`);
    });

    it('should return null for non-existent image', async () => {
      const info = await imageStorage.getImageInfo('nonexistent', 'image/png');
      expect(info).toBeNull();
    });
  });

  describe('parseImageFilename', () => {
    it('should parse valid image filenames', () => {
      expect(ImageStorage.parseImageFilename('abc123.png')).toEqual({
        imageId: 'abc123',
        extension: 'png',
        mimeType: 'image/png',
      });
      expect(ImageStorage.parseImageFilename('def-456.jpg')).toEqual({
        imageId: 'def-456',
        extension: 'jpg',
        mimeType: 'image/jpeg',
      });
      expect(ImageStorage.parseImageFilename('a-b-c-d-e.webp')).toEqual({
        imageId: 'a-b-c-d-e',
        extension: 'webp',
        mimeType: 'image/webp',
      });
    });

    it('should return null for filenames without extension', () => {
      expect(ImageStorage.parseImageFilename('abc123')).toBeNull();
    });

    it('should return null for unsupported extensions', () => {
      expect(ImageStorage.parseImageFilename('doc.pdf')).toBeNull();
      expect(ImageStorage.parseImageFilename('video.mp4')).toBeNull();
    });

    it('should handle filenames with multiple dots', () => {
      expect(ImageStorage.parseImageFilename('image.backup.png')).toEqual({
        imageId: 'image.backup',
        extension: 'png',
        mimeType: 'image/png',
      });
    });
  });

  describe('isSupportedMimeType', () => {
    it('should return true for supported types', () => {
      expect(ImageStorage.isSupportedMimeType('image/png')).toBe(true);
      expect(ImageStorage.isSupportedMimeType('image/jpeg')).toBe(true);
      expect(ImageStorage.isSupportedMimeType('image/gif')).toBe(true);
      expect(ImageStorage.isSupportedMimeType('image/webp')).toBe(true);
      expect(ImageStorage.isSupportedMimeType('image/svg+xml')).toBe(true);
      expect(ImageStorage.isSupportedMimeType('image/heic')).toBe(true);
      expect(ImageStorage.isSupportedMimeType('image/heif')).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(ImageStorage.isSupportedMimeType('application/pdf')).toBe(false);
      expect(ImageStorage.isSupportedMimeType('text/plain')).toBe(false);
      expect(ImageStorage.isSupportedMimeType('video/mp4')).toBe(false);
      expect(ImageStorage.isSupportedMimeType('image/bmp')).toBe(false);
    });
  });

  describe('discoverImageOnDisk', () => {
    const testImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    beforeEach(async () => {
      await imageStorage.initializeMediaDir();
    });

    it('should discover existing image with UUID format ID', async () => {
      // Manually place image file (simulating cloud sync)
      const imageId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      fs.setFile(`/test/sd/media/${imageId}.png`, testImageData);

      const result = await imageStorage.discoverImageOnDisk(imageId);

      expect(result).not.toBeNull();
      expect(result!.filename).toBe(`${imageId}.png`);
      expect(result!.mimeType).toBe('image/png');
      expect(result!.size).toBe(testImageData.length);
    });

    it('should discover existing image with hex format ID (32 chars)', async () => {
      // New content-addressed format (Phase 4)
      const imageId = 'a1b2c3d4e5f67890abcdef1234567890';
      fs.setFile(`/test/sd/media/${imageId}.jpg`, testImageData);

      const result = await imageStorage.discoverImageOnDisk(imageId);

      expect(result).not.toBeNull();
      expect(result!.filename).toBe(`${imageId}.jpg`);
      expect(result!.mimeType).toBe('image/jpeg');
      expect(result!.size).toBe(testImageData.length);
    });

    it('should return null for non-existent image', async () => {
      const result = await imageStorage.discoverImageOnDisk('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(result).toBeNull();
    });

    it('should return null for invalid imageId format (path traversal protection)', async () => {
      // Attempt path traversal
      const result = await imageStorage.discoverImageOnDisk('../../../etc/passwd');
      expect(result).toBeNull();
    });

    it('should return null for empty string', async () => {
      const result = await imageStorage.discoverImageOnDisk('');
      expect(result).toBeNull();
    });

    it('should return null when media directory does not exist', async () => {
      fs.reset();
      // Re-initialize SD structure without media dir
      await sdStructure.initialize();

      const result = await imageStorage.discoverImageOnDisk('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(result).toBeNull();
    });

    it('should try multiple extensions and find the correct one', async () => {
      const imageId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      // Place a GIF file
      fs.setFile(`/test/sd/media/${imageId}.gif`, testImageData);

      const result = await imageStorage.discoverImageOnDisk(imageId);

      expect(result).not.toBeNull();
      expect(result!.filename).toBe(`${imageId}.gif`);
      expect(result!.mimeType).toBe('image/gif');
    });
  });
});

describe('isValidImageId', () => {
  it('should accept valid UUID format', () => {
    expect(isValidImageId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
    expect(isValidImageId('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')).toBe(true); // uppercase
    expect(isValidImageId('00000000-0000-0000-0000-000000000000')).toBe(true);
    expect(isValidImageId('ffffffff-ffff-ffff-ffff-ffffffffffff')).toBe(true);
  });

  it('should accept valid hex format (32 chars)', () => {
    expect(isValidImageId('a1b2c3d4e5f67890abcdef1234567890')).toBe(true);
    expect(isValidImageId('A1B2C3D4E5F67890ABCDEF1234567890')).toBe(true); // uppercase
    expect(isValidImageId('00000000000000000000000000000000')).toBe(true);
    expect(isValidImageId('ffffffffffffffffffffffffffffffff')).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(isValidImageId('')).toBe(false);
    expect(isValidImageId('invalid')).toBe(false);
    expect(isValidImageId('too-short')).toBe(false);
    expect(isValidImageId('../../../etc/passwd')).toBe(false);
    expect(isValidImageId('a1b2c3d4-e5f6-7890-abcd')).toBe(false); // incomplete UUID
    expect(isValidImageId('a1b2c3d4e5f67890abcdef123456789')).toBe(false); // 31 chars
    expect(isValidImageId('a1b2c3d4e5f67890abcdef12345678901')).toBe(false); // 33 chars
    expect(isValidImageId('a1b2c3d4-e5f6-7890-abcd-ef123456789g')).toBe(false); // invalid char 'g'
  });
});

describe('hashImageContent', () => {
  it('should return 32-character lowercase hex string', async () => {
    const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    const hash = await hashImageContent(data);

    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should produce same hash for same input (deterministic)', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const hash1 = await hashImageContent(data);
    const hash2 = await hashImageContent(data);

    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', async () => {
    const data1 = new Uint8Array([1, 2, 3, 4]);
    const data2 = new Uint8Array([5, 6, 7, 8]);

    const hash1 = await hashImageContent(data1);
    const hash2 = await hashImageContent(data2);

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty data', async () => {
    const data = new Uint8Array(0);
    const hash = await hashImageContent(data);

    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should handle large data', async () => {
    // Create 1MB of data
    const data = new Uint8Array(1024 * 1024);
    for (let i = 0; i < data.length; i++) {
      data[i] = i % 256;
    }

    const hash = await hashImageContent(data);
    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should produce valid image ID format', async () => {
    const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const hash = await hashImageContent(data);

    // The hash should be a valid image ID
    expect(isValidImageId(hash)).toBe(true);
  });
});
