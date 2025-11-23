/**
 * LogReader Tests
 *
 * Tests for reading CRDT log files.
 */

import { LogReader } from '../log-reader';
import { createLogFile, LOG_HEADER_SIZE } from '../binary-format';
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

describe('LogReader', () => {
  describe('listLogFiles', () => {
    it('should return empty array for empty directory', async () => {
      const fs = createMockFs();
      fs.directories.add('/logs');

      const files = await LogReader.listLogFiles('/logs', fs);

      expect(files).toEqual([]);
    });

    it('should list .crdtlog files', async () => {
      const fs = createMockFs();
      const logData = createLogFile([
        { timestamp: 1000, sequence: 1, data: new Uint8Array([0x01]) },
      ]);

      fs.files.set('/logs/inst-abc_1699028345000.crdtlog', logData);
      fs.files.set('/logs/inst-xyz_1699028346000.crdtlog', logData);
      fs.files.set('/logs/other.txt', new Uint8Array([0x00])); // Should be ignored

      const files = await LogReader.listLogFiles('/logs', fs);

      expect(files.length).toBe(2);
      expect(files.map((f) => f.filename)).toContain('inst-abc_1699028345000.crdtlog');
      expect(files.map((f) => f.filename)).toContain('inst-xyz_1699028346000.crdtlog');
    });

    it('should extract instanceId and timestamp from filename', async () => {
      const fs = createMockFs();
      const logData = createLogFile([]);

      fs.files.set('/logs/inst-abc_1699028345000.crdtlog', logData);

      const files = await LogReader.listLogFiles('/logs', fs);

      expect(files[0].instanceId).toBe('inst-abc');
      expect(files[0].timestamp).toBe(1699028345000);
    });

    it('should sort files by timestamp ascending', async () => {
      const fs = createMockFs();
      const logData = createLogFile([]);

      fs.files.set('/logs/inst-abc_3000.crdtlog', logData);
      fs.files.set('/logs/inst-abc_1000.crdtlog', logData);
      fs.files.set('/logs/inst-abc_2000.crdtlog', logData);

      const files = await LogReader.listLogFiles('/logs', fs);

      expect(files[0].timestamp).toBe(1000);
      expect(files[1].timestamp).toBe(2000);
      expect(files[2].timestamp).toBe(3000);
    });

    it('should handle UUID-style instance IDs', async () => {
      const fs = createMockFs();
      const logData = createLogFile([]);

      fs.files.set('/logs/550e8400-e29b-41d4-a716-446655440000_1699028345000.crdtlog', logData);

      const files = await LogReader.listLogFiles('/logs', fs);

      expect(files[0].instanceId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(files[0].timestamp).toBe(1699028345000);
    });
  });

  describe('readRecords', () => {
    it('should read all records from valid log', async () => {
      const fs = createMockFs();
      const logData = createLogFile([
        { timestamp: 1000, sequence: 1, data: new Uint8Array([0xaa]) },
        { timestamp: 2000, sequence: 2, data: new Uint8Array([0xbb]) },
        { timestamp: 3000, sequence: 3, data: new Uint8Array([0xcc]) },
      ]);
      fs.files.set('/logs/test.crdtlog', logData);

      const records: Array<{
        timestamp: number;
        sequence: number;
        data: Uint8Array;
      }> = [];
      for await (const record of LogReader.readRecords('/logs/test.crdtlog', fs)) {
        records.push(record);
      }

      expect(records.length).toBe(3);
      expect(records[0].sequence).toBe(1);
      expect(records[1].sequence).toBe(2);
      expect(records[2].sequence).toBe(3);
    });

    it('should read from specific offset', async () => {
      const fs = createMockFs();
      const logData = createLogFile([
        { timestamp: 1000, sequence: 1, data: new Uint8Array([0xaa]) },
        { timestamp: 2000, sequence: 2, data: new Uint8Array([0xbb]) },
      ]);
      fs.files.set('/logs/test.crdtlog', logData);

      // Read without offset to find the second record's offset
      const allRecords: Array<{ offset: number }> = [];
      for await (const record of LogReader.readRecords('/logs/test.crdtlog', fs)) {
        allRecords.push({ offset: record.offset });
      }

      // Read from second record's offset
      const records: Array<{ sequence: number }> = [];
      for await (const record of LogReader.readRecords(
        '/logs/test.crdtlog',
        fs,
        allRecords[1].offset
      )) {
        records.push({ sequence: record.sequence });
      }

      expect(records.length).toBe(1);
      expect(records[0].sequence).toBe(2);
    });

    it('should stop at termination sentinel', async () => {
      const fs = createMockFs();
      const logData = createLogFile(
        [
          { timestamp: 1000, sequence: 1, data: new Uint8Array([0xaa]) },
          { timestamp: 2000, sequence: 2, data: new Uint8Array([0xbb]) },
        ],
        true // terminated
      );
      fs.files.set('/logs/test.crdtlog', logData);

      const records: Array<{ sequence: number }> = [];
      for await (const record of LogReader.readRecords('/logs/test.crdtlog', fs)) {
        records.push({ sequence: record.sequence });
      }

      expect(records.length).toBe(2);
    });

    it('should handle empty log (header only)', async () => {
      const fs = createMockFs();
      const logData = createLogFile([]);
      fs.files.set('/logs/test.crdtlog', logData);

      const records: unknown[] = [];
      for await (const record of LogReader.readRecords('/logs/test.crdtlog', fs)) {
        records.push(record);
      }

      expect(records.length).toBe(0);
    });

    it('should throw for invalid magic number', async () => {
      const fs = createMockFs();
      fs.files.set('/logs/bad.crdtlog', new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01]));

      await expect(async () => {
        for await (const record of LogReader.readRecords('/logs/bad.crdtlog', fs)) {
          void record; // consume
        }
      }).rejects.toThrow(/magic/i);
    });

    it('should include offset in each record', async () => {
      const fs = createMockFs();
      const logData = createLogFile([
        { timestamp: 1000, sequence: 1, data: new Uint8Array([0xaa]) },
        { timestamp: 2000, sequence: 2, data: new Uint8Array([0xbb]) },
      ]);
      fs.files.set('/logs/test.crdtlog', logData);

      const records: Array<{ offset: number }> = [];
      for await (const record of LogReader.readRecords('/logs/test.crdtlog', fs)) {
        records.push({ offset: record.offset });
      }

      expect(records[0].offset).toBe(LOG_HEADER_SIZE);
      expect(records[1].offset).toBeGreaterThan(records[0].offset);
    });
  });

  describe('readAllRecords', () => {
    it('should read all records as array', async () => {
      const fs = createMockFs();
      const logData = createLogFile([
        { timestamp: 1000, sequence: 1, data: new Uint8Array([0xaa]) },
        { timestamp: 2000, sequence: 2, data: new Uint8Array([0xbb]) },
      ]);
      fs.files.set('/logs/test.crdtlog', logData);

      const records = await LogReader.readAllRecords('/logs/test.crdtlog', fs);

      expect(records.length).toBe(2);
      expect(records[0].sequence).toBe(1);
      expect(records[1].sequence).toBe(2);
    });
  });

  describe('validateHeader', () => {
    it('should return true for valid header', async () => {
      const fs = createMockFs();
      const logData = createLogFile([]);
      fs.files.set('/logs/test.crdtlog', logData);

      const result = await LogReader.validateHeader('/logs/test.crdtlog', fs);

      expect(result.valid).toBe(true);
      expect(result.version).toBe(1);
    });

    it('should return false for invalid header', async () => {
      const fs = createMockFs();
      fs.files.set('/logs/bad.crdtlog', new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01]));

      const result = await LogReader.validateHeader('/logs/bad.crdtlog', fs);

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/magic/i);
    });
  });
});
