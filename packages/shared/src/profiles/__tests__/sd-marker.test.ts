/**
 * SD Marker Tests
 *
 * Tests for SD-TYPE marker file handling that distinguishes
 * dev vs prod storage directories.
 */

import { SDMarker } from '../sd-marker';
import type { FileSystemAdapter } from '../../storage/types';

/**
 * Create a mock filesystem adapter for testing
 */
function createMockFs(files: Map<string, Uint8Array> = new Map()): FileSystemAdapter {
  return {
    exists: jest.fn(async (path: string) => files.has(path)),
    mkdir: jest.fn(async () => {}),
    readFile: jest.fn(async (path: string) => {
      const data = files.get(path);
      if (!data) throw new Error(`ENOENT: ${path}`);
      return data;
    }),
    writeFile: jest.fn(async (path: string, data: Uint8Array) => {
      files.set(path, data);
    }),
    appendFile: jest.fn(async () => {}),
    deleteFile: jest.fn(async (path: string) => {
      files.delete(path);
    }),
    listFiles: jest.fn(async () => []),
    joinPath: jest.fn((...segments: string[]) => segments.join('/')),
    basename: jest.fn((path: string) => path.split('/').pop() || ''),
    stat: jest.fn(async () => ({ size: 0, mtimeMs: 0, ctimeMs: 0 })),
  };
}

describe('SDMarker', () => {
  const SD_PATH = '/Users/test/NoteCove/storage';
  const MARKER_FILE = `${SD_PATH}/SD-TYPE`;

  describe('writeSDMarker', () => {
    it('should write dev marker file', async () => {
      const mockFs = createMockFs();
      const marker = new SDMarker(mockFs);

      await marker.writeSDMarker(SD_PATH, 'dev');

      expect(mockFs.writeFile).toHaveBeenCalled();
      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls[0] as [string, Uint8Array];
      expect(writeCall[0]).toBe(MARKER_FILE);
      expect(new TextDecoder().decode(writeCall[1])).toBe('dev');
    });

    it('should write prod marker file', async () => {
      const mockFs = createMockFs();
      const marker = new SDMarker(mockFs);

      await marker.writeSDMarker(SD_PATH, 'prod');

      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls[0] as [string, Uint8Array];
      expect(new TextDecoder().decode(writeCall[1])).toBe('prod');
    });
  });

  describe('readSDMarker', () => {
    it('should return dev when marker file contains dev', async () => {
      const files = new Map<string, Uint8Array>();
      files.set(MARKER_FILE, new TextEncoder().encode('dev'));
      const mockFs = createMockFs(files);
      const marker = new SDMarker(mockFs);

      const result = await marker.readSDMarker(SD_PATH);

      expect(result).toBe('dev');
    });

    it('should return prod when marker file contains prod', async () => {
      const files = new Map<string, Uint8Array>();
      files.set(MARKER_FILE, new TextEncoder().encode('prod'));
      const mockFs = createMockFs(files);
      const marker = new SDMarker(mockFs);

      const result = await marker.readSDMarker(SD_PATH);

      expect(result).toBe('prod');
    });

    it('should return null when marker file does not exist', async () => {
      const mockFs = createMockFs();
      const marker = new SDMarker(mockFs);

      const result = await marker.readSDMarker(SD_PATH);

      expect(result).toBeNull();
    });

    it('should handle whitespace in marker file', async () => {
      const files = new Map<string, Uint8Array>();
      files.set(MARKER_FILE, new TextEncoder().encode('  dev  \n'));
      const mockFs = createMockFs(files);
      const marker = new SDMarker(mockFs);

      const result = await marker.readSDMarker(SD_PATH);

      expect(result).toBe('dev');
    });

    it('should return null for invalid marker content', async () => {
      const files = new Map<string, Uint8Array>();
      files.set(MARKER_FILE, new TextEncoder().encode('invalid'));
      const mockFs = createMockFs(files);
      const marker = new SDMarker(mockFs);

      const result = await marker.readSDMarker(SD_PATH);

      expect(result).toBeNull();
    });
  });

  describe('isDevSD', () => {
    it('should return true when marker is dev', async () => {
      const files = new Map<string, Uint8Array>();
      files.set(MARKER_FILE, new TextEncoder().encode('dev'));
      const mockFs = createMockFs(files);
      const marker = new SDMarker(mockFs);

      const result = await marker.isDevSD(SD_PATH);

      expect(result).toBe(true);
    });

    it('should return false when marker is prod', async () => {
      const files = new Map<string, Uint8Array>();
      files.set(MARKER_FILE, new TextEncoder().encode('prod'));
      const mockFs = createMockFs(files);
      const marker = new SDMarker(mockFs);

      const result = await marker.isDevSD(SD_PATH);

      expect(result).toBe(false);
    });

    it('should return false when no marker exists', async () => {
      const mockFs = createMockFs();
      const marker = new SDMarker(mockFs);

      const result = await marker.isDevSD(SD_PATH);

      expect(result).toBe(false);
    });
  });

  describe('isProdSD', () => {
    it('should return true when marker is prod', async () => {
      const files = new Map<string, Uint8Array>();
      files.set(MARKER_FILE, new TextEncoder().encode('prod'));
      const mockFs = createMockFs(files);
      const marker = new SDMarker(mockFs);

      const result = await marker.isProdSD(SD_PATH);

      expect(result).toBe(true);
    });

    it('should return false when marker is dev', async () => {
      const files = new Map<string, Uint8Array>();
      files.set(MARKER_FILE, new TextEncoder().encode('dev'));
      const mockFs = createMockFs(files);
      const marker = new SDMarker(mockFs);

      const result = await marker.isProdSD(SD_PATH);

      expect(result).toBe(false);
    });

    it('should return false when no marker exists', async () => {
      const mockFs = createMockFs();
      const marker = new SDMarker(mockFs);

      const result = await marker.isProdSD(SD_PATH);

      expect(result).toBe(false);
    });
  });

  describe('ensureMarker', () => {
    it('should write marker if none exists', async () => {
      const mockFs = createMockFs();
      const marker = new SDMarker(mockFs);

      await marker.ensureMarker(SD_PATH, 'dev');

      expect(mockFs.writeFile).toHaveBeenCalled();
      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls[0] as [string, Uint8Array];
      expect(new TextDecoder().decode(writeCall[1])).toBe('dev');
    });

    it('should NOT overwrite existing marker', async () => {
      const files = new Map<string, Uint8Array>();
      files.set(MARKER_FILE, new TextEncoder().encode('prod'));
      const mockFs = createMockFs(files);
      const marker = new SDMarker(mockFs);

      await marker.ensureMarker(SD_PATH, 'dev');

      // writeFile should not be called because marker already exists
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });
  });
});
