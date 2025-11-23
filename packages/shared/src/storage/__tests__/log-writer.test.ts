/**
 * LogWriter Tests
 *
 * Tests for append-only CRDT log file writer.
 */

import { LogWriter } from '../log-writer';
import { parseLogFile, LOG_HEADER_SIZE } from '../binary-format';
import type { FileSystemAdapter, FileStats } from '../types';

// Mock FileSystemAdapter for testing
function createMockFs(): FileSystemAdapter & {
  files: Map<string, Uint8Array>;
  directories: Set<string>;
} {
  const files = new Map<string, Uint8Array>();
  const directories = new Set<string>();

  return {
    files,
    directories,

    async exists(path: string): Promise<boolean> {
      return files.has(path) || directories.has(path);
    },

    async mkdir(path: string): Promise<void> {
      directories.add(path);
    },

    async readFile(path: string): Promise<Uint8Array> {
      const data = files.get(path);
      if (!data) throw new Error(`ENOENT: ${path}`);
      return data;
    },

    async writeFile(path: string, data: Uint8Array): Promise<void> {
      files.set(path, data);
    },

    async appendFile(path: string, data: Uint8Array): Promise<void> {
      const existing = files.get(path) || new Uint8Array(0);
      const newData = new Uint8Array(existing.length + data.length);
      newData.set(existing, 0);
      newData.set(data, existing.length);
      files.set(path, newData);
    },

    async deleteFile(path: string): Promise<void> {
      files.delete(path);
    },

    async listFiles(path: string): Promise<string[]> {
      const result: string[] = [];
      for (const filePath of files.keys()) {
        if (filePath.startsWith(path + '/')) {
          const filename = filePath.substring(path.length + 1);
          if (!filename.includes('/')) {
            result.push(filename);
          }
        }
      }
      return result;
    },

    joinPath(...segments: string[]): string {
      return segments.join('/');
    },

    basename(path: string): string {
      return path.split('/').pop() || '';
    },

    async stat(path: string): Promise<FileStats> {
      const data = files.get(path);
      if (!data) throw new Error(`ENOENT: ${path}`);
      return {
        size: data.length,
        mtimeMs: Date.now(),
        ctimeMs: Date.now(),
      };
    },
  };
}

describe('LogWriter', () => {
  describe('constructor and initialization', () => {
    it('should create new log file on first append', async () => {
      const fs = createMockFs();
      const writer = new LogWriter('/logs', 'inst-abc', fs);

      await writer.appendRecord(Date.now(), 1, new Uint8Array([0x01]));

      expect(writer.getCurrentFile()).not.toBeNull();
      expect(writer.getCurrentOffset()).toBeGreaterThan(LOG_HEADER_SIZE);
    });

    it('should create directory if it does not exist', async () => {
      const fs = createMockFs();
      const writer = new LogWriter('/logs', 'inst-abc', fs);

      await writer.appendRecord(Date.now(), 1, new Uint8Array([0x01]));

      expect(fs.directories.has('/logs')).toBe(true);
    });
  });

  describe('appendRecord', () => {
    it('should append single record', async () => {
      const fs = createMockFs();
      const writer = new LogWriter('/logs', 'inst-abc', fs);
      const timestamp = 1704067200000;

      await writer.appendRecord(timestamp, 1, new Uint8Array([0x01, 0x02, 0x03]));

      const file = writer.getCurrentFile()!;
      const data = fs.files.get(file)!;
      const parsed = parseLogFile(data);

      expect(parsed.records.length).toBe(1);
      expect(parsed.records[0].timestamp).toBe(timestamp);
      expect(parsed.records[0].sequence).toBe(1);
      expect(parsed.records[0].data).toEqual(new Uint8Array([0x01, 0x02, 0x03]));
    });

    it('should append multiple records', async () => {
      const fs = createMockFs();
      const writer = new LogWriter('/logs', 'inst-abc', fs);

      await writer.appendRecord(1000, 1, new Uint8Array([0xaa]));
      await writer.appendRecord(2000, 2, new Uint8Array([0xbb]));
      await writer.appendRecord(3000, 3, new Uint8Array([0xcc]));

      const file = writer.getCurrentFile()!;
      const data = fs.files.get(file)!;
      const parsed = parseLogFile(data);

      expect(parsed.records.length).toBe(3);
      expect(parsed.records[0].sequence).toBe(1);
      expect(parsed.records[1].sequence).toBe(2);
      expect(parsed.records[2].sequence).toBe(3);
    });

    it('should return file and offset', async () => {
      const fs = createMockFs();
      const writer = new LogWriter('/logs', 'inst-abc', fs);

      const result = await writer.appendRecord(1000, 1, new Uint8Array([0x01]));

      expect(result.file).toContain('inst-abc_');
      expect(result.file).toContain('.crdtlog');
      // First record starts right after the header
      expect(result.offset).toBe(LOG_HEADER_SIZE);
    });

    it('should track offset correctly', async () => {
      const fs = createMockFs();
      const writer = new LogWriter('/logs', 'inst-abc', fs);

      await writer.appendRecord(1000, 1, new Uint8Array([0x01]));
      const offset1 = writer.getCurrentOffset();

      await writer.appendRecord(2000, 2, new Uint8Array([0x02]));
      const offset2 = writer.getCurrentOffset();

      expect(offset2).toBeGreaterThan(offset1);
    });
  });

  describe('filename generation', () => {
    it('should include instanceId and timestamp in filename', async () => {
      const fs = createMockFs();
      const writer = new LogWriter('/logs', 'inst-abc', fs);

      await writer.appendRecord(Date.now(), 1, new Uint8Array([0x01]));

      const file = writer.getCurrentFile()!;
      expect(file).toMatch(/inst-abc_\d+\.crdtlog$/);
    });

    it('should handle timestamp collision by incrementing', async () => {
      const fs = createMockFs();
      // Pre-create a file with a specific timestamp
      const existingTimestamp = 1704067200000;
      const existingFile = `/logs/inst-abc_${existingTimestamp}.crdtlog`;
      fs.files.set(existingFile, new Uint8Array([0x4e, 0x43, 0x4c, 0x47, 0x01]));

      const writer = new LogWriter('/logs', 'inst-abc', fs);

      // Mock Date.now to return the same timestamp
      const originalNow = Date.now;
      Date.now = () => existingTimestamp;
      try {
        await writer.appendRecord(existingTimestamp, 1, new Uint8Array([0x01]));

        const file = writer.getCurrentFile()!;
        // Should have timestamp + 1
        expect(file).toBe(`/logs/inst-abc_${existingTimestamp + 1}.crdtlog`);
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe('rotation', () => {
    it('should rotate when exceeding size limit', async () => {
      const fs = createMockFs();
      let rotateCallCount = 0;

      // Use small rotation size for testing
      const writer = new LogWriter('/logs', 'inst-abc', fs, {
        rotationSizeBytes: 100, // 100 bytes for testing
        onRotate: async () => {
          rotateCallCount++;
        },
      });

      // Write enough data to exceed 100 bytes
      const largeData = new Uint8Array(50).fill(0xaa);
      await writer.appendRecord(1000, 1, largeData);
      await writer.appendRecord(2000, 2, largeData); // Should trigger rotation

      expect(rotateCallCount).toBe(1);
    });

    it('should create new file after rotation', async () => {
      const fs = createMockFs();
      const writer = new LogWriter('/logs', 'inst-abc', fs, {
        rotationSizeBytes: 100,
      });

      const largeData = new Uint8Array(50).fill(0xaa);
      await writer.appendRecord(1000, 1, largeData);
      const file1 = writer.getCurrentFile();

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 2));

      await writer.appendRecord(2000, 2, largeData);
      const file2 = writer.getCurrentFile();

      expect(file1).not.toBe(file2);
    });

    it('should write termination sentinel when rotating', async () => {
      const fs = createMockFs();
      const writer = new LogWriter('/logs', 'inst-abc', fs, {
        rotationSizeBytes: 100,
      });

      const largeData = new Uint8Array(50).fill(0xaa);
      await writer.appendRecord(1000, 1, largeData);
      const file1 = writer.getCurrentFile()!;

      await writer.appendRecord(2000, 2, largeData); // Triggers rotation

      // Check old file is terminated
      const oldFileData = fs.files.get(file1)!;
      const parsed = parseLogFile(oldFileData);
      expect(parsed.terminated).toBe(true);
    });
  });

  describe('finalize', () => {
    it('should write termination sentinel', async () => {
      const fs = createMockFs();
      const writer = new LogWriter('/logs', 'inst-abc', fs);

      await writer.appendRecord(1000, 1, new Uint8Array([0x01]));
      await writer.finalize();

      const file = writer.getCurrentFile()!;
      const data = fs.files.get(file)!;
      const parsed = parseLogFile(data);

      expect(parsed.terminated).toBe(true);
    });

    it('should prevent further writes after finalize', async () => {
      const fs = createMockFs();
      const writer = new LogWriter('/logs', 'inst-abc', fs);

      await writer.appendRecord(1000, 1, new Uint8Array([0x01]));
      await writer.finalize();

      await expect(writer.appendRecord(2000, 2, new Uint8Array([0x02]))).rejects.toThrow(
        /finalized/i
      );
    });

    it('should be idempotent', async () => {
      const fs = createMockFs();
      const writer = new LogWriter('/logs', 'inst-abc', fs);

      await writer.appendRecord(1000, 1, new Uint8Array([0x01]));
      await writer.finalize();
      await writer.finalize(); // Should not throw

      const file = writer.getCurrentFile()!;
      const data = fs.files.get(file)!;
      const parsed = parseLogFile(data);

      // Should only have one sentinel
      expect(parsed.terminated).toBe(true);
      expect(parsed.records.length).toBe(1);
    });
  });

  describe('getCurrentFile and getCurrentOffset', () => {
    it('should return null before any writes', () => {
      const fs = createMockFs();
      const writer = new LogWriter('/logs', 'inst-abc', fs);

      expect(writer.getCurrentFile()).toBeNull();
      expect(writer.getCurrentOffset()).toBe(0);
    });

    it('should return correct values after writes', async () => {
      const fs = createMockFs();
      const writer = new LogWriter('/logs', 'inst-abc', fs);

      await writer.appendRecord(1000, 1, new Uint8Array([0x01]));

      expect(writer.getCurrentFile()).not.toBeNull();
      expect(writer.getCurrentOffset()).toBeGreaterThan(0);
    });
  });
});
