/**
 * Tests for compression utilities
 */

// Mock @mongodb-js/zstd
const mockCompress = jest.fn();
const mockDecompress = jest.fn();

jest.mock('@mongodb-js/zstd', () => ({
  default: {
    compress: mockCompress,
    decompress: mockDecompress,
  },
  __esModule: true,
}));

import { compress, decompress, decompressWithFallback, isCompressed } from '../compression';

describe('compression utilities', () => {
  beforeEach(() => {
    mockCompress.mockReset();
    mockDecompress.mockReset();

    // Default implementation: zstd compresses to magic number + data
    mockCompress.mockImplementation((buffer: Buffer) => {
      // Create a "compressed" buffer with zstd magic header
      const result = Buffer.alloc(4 + buffer.length);
      result[0] = 0x28;
      result[1] = 0xb5;
      result[2] = 0x2f;
      result[3] = 0xfd;
      buffer.copy(result, 4);
      return Promise.resolve(result);
    });

    // Default implementation: just return the data after magic header
    mockDecompress.mockImplementation((buffer: Buffer) => {
      if (buffer.length >= 4) {
        return Promise.resolve(buffer.subarray(4));
      }
      return Promise.resolve(buffer);
    });
  });
  // Suppress console warnings during tests
  const originalWarn = console.warn;
  const originalError = console.error;

  beforeEach(() => {
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.warn = originalWarn;
    console.error = originalError;
  });

  describe('isCompressed', () => {
    it('should return true for zstd magic number', () => {
      // zstd magic number: 0x28, 0xB5, 0x2F, 0xFD
      const data = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd, 0x00, 0x00]);
      expect(isCompressed(data)).toBe(true);
    });

    it('should return false for non-zstd data', () => {
      const data = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      expect(isCompressed(data)).toBe(false);
    });

    it('should return false for short data', () => {
      const data = new Uint8Array([0x28, 0xb5]);
      expect(isCompressed(data)).toBe(false);
    });

    it('should return false for empty data', () => {
      const data = new Uint8Array([]);
      expect(isCompressed(data)).toBe(false);
    });
  });

  describe('compress and decompress', () => {
    it('should compress and decompress data correctly', async () => {
      const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      const compressed = await compress(original);

      // Compressed data should start with zstd magic number
      expect(isCompressed(compressed)).toBe(true);

      const decompressed = await decompress(compressed);

      expect(decompressed).toEqual(original);
    });

    it('should handle larger data', async () => {
      // Create a larger dataset with repeated patterns (compresses well)
      const original = new Uint8Array(1000);
      for (let i = 0; i < 1000; i++) {
        original[i] = i % 256;
      }

      const compressed = await compress(original);
      const decompressed = await decompress(compressed);

      expect(decompressed).toEqual(original);
    });

    it('should handle empty data', async () => {
      const original = new Uint8Array([]);

      const compressed = await compress(original);
      const decompressed = await decompress(compressed);

      expect(decompressed).toEqual(original);
    });
  });

  describe('decompress', () => {
    it('should handle data with status byte 0x01 prefix', async () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const compressed = await compress(original);

      // Add status byte prefix
      const withStatusByte = new Uint8Array(1 + compressed.length);
      withStatusByte[0] = 0x01;
      withStatusByte.set(compressed, 1);

      const decompressed = await decompress(withStatusByte);

      expect(decompressed).toEqual(original);
    });

    it('should handle data with status byte 0x00 prefix', async () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const compressed = await compress(original);

      // Add status byte prefix
      const withStatusByte = new Uint8Array(1 + compressed.length);
      withStatusByte[0] = 0x00;
      withStatusByte.set(compressed, 1);

      const decompressed = await decompress(withStatusByte);

      expect(decompressed).toEqual(original);
    });

    it('should return uncompressed data with status byte stripped', async () => {
      // Uncompressed data with status byte prefix (not starting with zstd magic)
      const original = new Uint8Array([0x01, 0x10, 0x20, 0x30, 0x40]);

      const decompressed = await decompress(original);

      // Should strip the status byte and return rest
      expect(decompressed).toEqual(new Uint8Array([0x10, 0x20, 0x30, 0x40]));
    });

    it('should log error details and rethrow when decompression fails', async () => {
      // Create data that looks compressed (has zstd magic number)
      const compressedLookingData = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd, 0xff, 0xff, 0xff]);

      const decompError = new Error('Decompression failed');
      mockDecompress.mockRejectedValueOnce(decompError);

      await expect(decompress(compressedLookingData)).rejects.toThrow('Decompression failed');

      // Verify error logging was called
      expect(console.error).toHaveBeenCalled();
    });

    it('should log error details when decompression fails with status byte', async () => {
      // Create data with status byte followed by zstd magic number
      const dataWithStatus = new Uint8Array([0x01, 0x28, 0xb5, 0x2f, 0xfd, 0xff, 0xff, 0xff]);

      const decompError = new Error('Decompression failed with status');
      mockDecompress.mockRejectedValueOnce(decompError);

      await expect(decompress(dataWithStatus)).rejects.toThrow('Decompression failed with status');

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('decompressWithFallback', () => {
    it('should decompress valid compressed data', async () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const compressed = await compress(original);

      const result = await decompressWithFallback(compressed);

      expect(result).toEqual(original);
    });

    it('should handle data with status byte prefix', async () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const compressed = await compress(original);

      const withStatusByte = new Uint8Array(1 + compressed.length);
      withStatusByte[0] = 0x01;
      withStatusByte.set(compressed, 1);

      const result = await decompressWithFallback(withStatusByte);

      expect(result).toEqual(original);
    });

    it('should return original data when decompression fails', async () => {
      const invalidData = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc]);

      // Make mock throw an error for invalid data
      mockDecompress.mockRejectedValueOnce(new Error('Invalid zstd data'));

      const result = await decompressWithFallback(invalidData);

      expect(result).toEqual(invalidData);
    });

    it('should strip status byte for uncompressed data', async () => {
      // Data starting with status byte but not compressed
      const data = new Uint8Array([0x01, 0x10, 0x20, 0x30, 0x40]);

      const result = await decompressWithFallback(data);

      expect(result).toEqual(new Uint8Array([0x10, 0x20, 0x30, 0x40]));
    });
  });
});
