/**
 * Tests for SD UUID Manager
 */

import { SdUuidManager } from '../sd-uuid';
import type { FileSystemAdapter } from '../types';

// Compact UUID format: 22 base64url characters
const COMPACT_UUID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

describe('SdUuidManager', () => {
  let mockFs: FileSystemAdapter;
  let uuidManager: SdUuidManager;
  let fileStore: Map<string, Uint8Array>;

  beforeEach(() => {
    fileStore = new Map();

    mockFs = {
      exists: jest.fn(async (path: string) => fileStore.has(path)),
      mkdir: jest.fn(async () => {}),
      readFile: jest.fn(async (path: string) => {
        const data = fileStore.get(path);
        if (!data) {
          throw new Error(`File not found: ${path}`);
        }
        return data;
      }),
      writeFile: jest.fn(async (path: string, data: Uint8Array) => {
        fileStore.set(path, data);
      }),
      deleteFile: jest.fn(async (path: string) => {
        fileStore.delete(path);
      }),
      listFiles: jest.fn(async () => []),
      joinPath: jest.fn((...segments: string[]) => segments.join('/')),
      basename: jest.fn((path: string) => path.split('/').pop() || ''),
      stat: jest.fn(async () => ({ size: 0, mtimeMs: 0, ctimeMs: 0 })),
    };

    uuidManager = new SdUuidManager(mockFs);
  });

  describe('readUuid', () => {
    it('should return null if SD_ID file does not exist', async () => {
      const uuid = await uuidManager.readUuid('/test/sd');
      expect(uuid).toBeNull();
    });

    it('should read UUID from SD_ID file', async () => {
      const testUuid = '550e8400-e29b-41d4-a716-446655440000';
      const encoder = new TextEncoder();
      fileStore.set('/test/sd/SD_ID', encoder.encode(testUuid));

      const uuid = await uuidManager.readUuid('/test/sd');
      expect(uuid).toBe(testUuid);
    });

    it('should trim whitespace from UUID', async () => {
      const testUuid = '550e8400-e29b-41d4-a716-446655440000';
      const encoder = new TextEncoder();
      fileStore.set('/test/sd/SD_ID', encoder.encode(`  ${testUuid}  \n`));

      const uuid = await uuidManager.readUuid('/test/sd');
      expect(uuid).toBe(testUuid);
    });

    it('should return null for invalid UUID format', async () => {
      const encoder = new TextEncoder();
      fileStore.set('/test/sd/SD_ID', encoder.encode('not-a-valid-uuid'));

      const uuid = await uuidManager.readUuid('/test/sd');
      expect(uuid).toBeNull();
    });

    it('should return null on read error', async () => {
      mockFs.readFile = jest.fn(async () => {
        throw new Error('Read error');
      });
      fileStore.set('/test/sd/SD_ID', new Uint8Array());

      const uuid = await uuidManager.readUuid('/test/sd');
      expect(uuid).toBeNull();
    });
  });

  describe('writeUuid', () => {
    it('should write UUID to SD_ID file', async () => {
      const testUuid = '550e8400-e29b-41d4-a716-446655440000';

      await uuidManager.writeUuid('/test/sd', testUuid);

      expect(mockFs.writeFile).toHaveBeenCalled();
      const writtenData = fileStore.get('/test/sd/SD_ID');
      expect(writtenData).toBeDefined();

      const decoder = new TextDecoder();
      const writtenUuid = decoder.decode(writtenData);
      expect(writtenUuid).toBe(testUuid);
    });

    it('should reject invalid UUID format', async () => {
      await expect(uuidManager.writeUuid('/test/sd', 'invalid-uuid')).rejects.toThrow(
        'Invalid UUID format'
      );
    });

    it('should propagate write errors', async () => {
      mockFs.writeFile = jest.fn(async () => {
        throw new Error('Write error');
      });

      await expect(
        uuidManager.writeUuid('/test/sd', '550e8400-e29b-41d4-a716-446655440000')
      ).rejects.toThrow('Write error');
    });
  });

  describe('initializeUuid', () => {
    it('should return existing UUID if SD_ID file exists', async () => {
      const existingUuid = '550e8400-e29b-41d4-a716-446655440000';
      const encoder = new TextEncoder();
      fileStore.set('/test/sd/SD_ID', encoder.encode(existingUuid));

      const result = await uuidManager.initializeUuid('/test/sd');

      expect(result.uuid).toBe(existingUuid);
      expect(result.wasGenerated).toBe(false);
      expect(result.hadRaceCondition).toBe(false);
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should generate and write new UUID if SD_ID does not exist', async () => {
      const result = await uuidManager.initializeUuid('/test/sd');

      expect(result.uuid).toMatch(COMPACT_UUID_PATTERN);
      expect(result.wasGenerated).toBe(true);
      expect(result.hadRaceCondition).toBe(false);
      expect(mockFs.writeFile).toHaveBeenCalled();

      const writtenData = fileStore.get('/test/sd/SD_ID');
      expect(writtenData).toBeDefined();
    });

    it('should detect race condition when read-back differs', async () => {
      let writeCount = 0;
      const racingUuid = '12345678-1234-4234-8234-123456789abc';
      const encoder = new TextEncoder();

      // Simulate race condition: first write, then another process writes
      mockFs.writeFile = jest.fn(async (path: string, data: Uint8Array) => {
        writeCount++;
        if (writeCount === 1) {
          // Simulate another process writing a different UUID
          fileStore.set(path, encoder.encode(racingUuid));
        } else {
          fileStore.set(path, data);
        }
      });

      const result = await uuidManager.initializeUuid('/test/sd');

      expect(result.uuid).toBe(racingUuid); // Should use the racing UUID
      expect(result.wasGenerated).toBe(true);
      expect(result.hadRaceCondition).toBe(true);
    });

    it('should retry on failure and eventually succeed', async () => {
      let attemptCount = 0;

      mockFs.writeFile = jest.fn(async (path: string, data: Uint8Array) => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary write error');
        }
        fileStore.set(path, data);
      });

      const result = await uuidManager.initializeUuid('/test/sd');

      expect(result.uuid).toMatch(COMPACT_UUID_PATTERN);
      expect(result.wasGenerated).toBe(true);
      expect(attemptCount).toBe(2);
    });

    it('should fail after max retries', async () => {
      mockFs.writeFile = jest.fn(async () => {
        throw new Error('Persistent write error');
      });

      await expect(uuidManager.initializeUuid('/test/sd')).rejects.toThrow(
        /Failed to initialize UUID.*after 3 attempts/
      );
    });

    it('should fail if read-back returns null', async () => {
      mockFs.writeFile = jest.fn(async (path: string, data: Uint8Array) => {
        // Write succeeds but file disappears before read-back
        fileStore.set(path, data);
        fileStore.delete(path); // Immediately delete
      });

      await expect(uuidManager.initializeUuid('/test/sd')).rejects.toThrow(
        /Failed to read back SD_ID file/
      );
    });
  });

  describe('ensureUuid', () => {
    it('should return existing UUID', async () => {
      const existingUuid = '550e8400-e29b-41d4-a716-446655440000';
      const encoder = new TextEncoder();
      fileStore.set('/test/sd/SD_ID', encoder.encode(existingUuid));

      const uuid = await uuidManager.ensureUuid('/test/sd');
      expect(uuid).toBe(existingUuid);
    });

    it('should generate and return new UUID', async () => {
      const uuid = await uuidManager.ensureUuid('/test/sd');
      expect(uuid).toMatch(COMPACT_UUID_PATTERN);
    });
  });

  describe('deleteUuid', () => {
    it('should delete SD_ID file if it exists', async () => {
      const encoder = new TextEncoder();
      fileStore.set('/test/sd/SD_ID', encoder.encode('550e8400-e29b-41d4-a716-446655440000'));

      await uuidManager.deleteUuid('/test/sd');

      expect(mockFs.deleteFile).toHaveBeenCalledWith('/test/sd/SD_ID');
      expect(fileStore.has('/test/sd/SD_ID')).toBe(false);
    });

    it('should not fail if SD_ID file does not exist', async () => {
      await expect(uuidManager.deleteUuid('/test/sd')).resolves.not.toThrow();
    });

    it('should propagate delete errors', async () => {
      const encoder = new TextEncoder();
      fileStore.set('/test/sd/SD_ID', encoder.encode('550e8400-e29b-41d4-a716-446655440000'));

      mockFs.deleteFile = jest.fn(async () => {
        throw new Error('Delete error');
      });

      await expect(uuidManager.deleteUuid('/test/sd')).rejects.toThrow('Delete error');
    });
  });
});
