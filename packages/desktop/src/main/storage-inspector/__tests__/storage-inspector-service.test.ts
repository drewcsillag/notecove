/**
 * Tests for StorageInspectorService
 *
 * Tests the service that reads and parses storage directory contents
 * for the Storage Inspector feature.
 */

import { StorageInspectorService } from '../storage-inspector-service';
import type { FileSystemAdapter } from '@notecove/shared';

// Mock file system adapter
const createMockFs = (): jest.Mocked<FileSystemAdapter> => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  appendFile: jest.fn(),
  exists: jest.fn(),
  mkdir: jest.fn(),
  listFiles: jest.fn(),
  joinPath: jest.fn((...parts: string[]) => parts.join('/')),
  basename: jest.fn((p: string) => p.split('/').pop() ?? p),
  stat: jest.fn(),
  deleteFile: jest.fn(),
});

describe('StorageInspectorService', () => {
  let service: StorageInspectorService;
  let mockFs: jest.Mocked<FileSystemAdapter>;

  beforeEach(() => {
    mockFs = createMockFs();
    service = new StorageInspectorService(mockFs);
  });

  describe('listSDContents', () => {
    it('should return tree structure for valid SD', async () => {
      // Setup mock SD structure
      mockFs.exists.mockResolvedValue(true);
      mockFs.listFiles.mockImplementation(async (path: string) => {
        if (path === '/test/sd/notes') {
          return ['note-1', 'note-2'];
        }
        if (path === '/test/sd/notes/note-1/logs') {
          return ['instance1_1234.crdtlog'];
        }
        if (path === '/test/sd/notes/note-1/snapshots') {
          return ['instance1_1234.snapshot'];
        }
        if (path === '/test/sd/notes/note-2/logs') {
          return [];
        }
        if (path === '/test/sd/notes/note-2/snapshots') {
          return [];
        }
        if (path === '/test/sd/folders/logs') {
          return ['folder_tree.crdtlog'];
        }
        if (path === '/test/sd/activity') {
          return ['instance1.log'];
        }
        if (path === '/test/sd/profiles') {
          return ['profile1.json'];
        }
        if (path === '/test/sd/media') {
          return ['image1.png'];
        }
        return [];
      });

      mockFs.stat.mockImplementation(async (path: string) => {
        const isDir =
          path.includes('/notes/note-') ||
          path.includes('/logs') ||
          path.includes('/snapshots') ||
          path === '/test/sd/notes' ||
          path === '/test/sd/folders' ||
          path === '/test/sd/activity' ||
          path === '/test/sd/profiles' ||
          path === '/test/sd/media';
        return {
          isDirectory: isDir,
          size: isDir ? 0 : 1024,
          mtimeMs: new Date('2024-01-15T10:00:00Z').getTime(),
          ctimeMs: new Date('2024-01-15T10:00:00Z').getTime(),
        };
      });

      const result = await service.listSDContents('/test/sd');

      expect(result).toBeDefined();
      expect(result.root).toBe('/test/sd');
      expect(result.children).toBeDefined();

      // Should have notes, folders, activity, profiles, media, SD_ID, SD_VERSION
      const childNames = result.children.map((c) => c.name);
      expect(childNames).toContain('notes');
      expect(childNames).toContain('folders');
      expect(childNames).toContain('activity');
      expect(childNames).toContain('profiles');
      expect(childNames).toContain('media');
    });

    it('should handle missing directories gracefully', async () => {
      mockFs.exists.mockResolvedValue(false);

      const result = await service.listSDContents('/nonexistent/sd');

      expect(result.error).toBeDefined();
      expect(result.error).toContain('not exist');
    });

    it('should detect file types correctly', async () => {
      mockFs.exists.mockResolvedValue(true);
      mockFs.listFiles.mockImplementation(async (path: string) => {
        if (path === '/test/sd/notes') {
          return ['note-1'];
        }
        if (path === '/test/sd/notes/note-1') {
          return ['logs', 'snapshots'];
        }
        if (path === '/test/sd/notes/note-1/logs') {
          return ['test.crdtlog'];
        }
        if (path === '/test/sd/notes/note-1/snapshots') {
          return ['test.snapshot'];
        }
        return [];
      });
      mockFs.stat.mockImplementation(async (path: string) => {
        // Directories: notes, notes/note-1, logs, snapshots
        const isDir =
          path === '/test/sd/notes' ||
          path === '/test/sd/notes/note-1' ||
          path === '/test/sd/notes/note-1/logs' ||
          path === '/test/sd/notes/note-1/snapshots';
        return {
          isDirectory: isDir,
          size: isDir ? 0 : 1024,
          mtimeMs: Date.now(),
          ctimeMs: Date.now(),
        };
      });

      const result = await service.listSDContents('/test/sd');

      // Find the notes directory
      const notesDir = result.children.find((c) => c.name === 'notes');
      expect(notesDir).toBeDefined();
      expect(notesDir?.children?.length).toBeGreaterThan(0);

      // Find note-1 inside notes
      const note1Dir = notesDir?.children?.find((c) => c.name === 'note-1');
      expect(note1Dir).toBeDefined();

      // Find logs directory inside note-1
      const logsDir = note1Dir?.children?.find((c) => c.name === 'logs');
      expect(logsDir).toBeDefined();

      // Find the .crdtlog file and verify its type
      const crdtlogFile = logsDir?.children?.find((c) => c.name === 'test.crdtlog');
      expect(crdtlogFile).toBeDefined();
      expect(crdtlogFile?.type).toBe('crdtlog');

      // Find snapshots directory
      const snapshotsDir = note1Dir?.children?.find((c) => c.name === 'snapshots');
      expect(snapshotsDir).toBeDefined();

      // Find the .snapshot file and verify its type
      const snapshotFile = snapshotsDir?.children?.find((c) => c.name === 'test.snapshot');
      expect(snapshotFile).toBeDefined();
      expect(snapshotFile?.type).toBe('snapshot');
    });
  });

  describe('readFileInfo', () => {
    it('should read file and return metadata + raw bytes', async () => {
      const testData = new Uint8Array([0x4e, 0x43, 0x4c, 0x47, 0x01]); // NCLG header
      mockFs.exists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(testData);
      mockFs.stat.mockResolvedValue({
        isDirectory: false,
        size: 5,
        mtimeMs: new Date('2024-01-15T10:00:00Z').getTime(),
        ctimeMs: new Date('2024-01-15T10:00:00Z').getTime(),
      });

      const result = await service.readFileInfo('/test/sd', 'notes/note-1/logs/test.crdtlog');

      expect(result).toBeDefined();
      expect(result.path).toBe('/test/sd/notes/note-1/logs/test.crdtlog');
      expect(result.size).toBe(5);
      expect(result.data).toEqual(testData);
      expect(result.type).toBe('crdtlog');
    });

    it('should detect snapshot files', async () => {
      const testData = new Uint8Array([0x4e, 0x43, 0x53, 0x53, 0x01, 0x01]); // NCSS header
      mockFs.exists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(testData);
      mockFs.stat.mockResolvedValue({
        isDirectory: false,
        size: 6,
        mtimeMs: Date.now(),
        ctimeMs: Date.now(),
      });

      const result = await service.readFileInfo('/test/sd', 'notes/note-1/snapshots/test.snapshot');

      expect(result.type).toBe('snapshot');
    });

    it('should detect activity log files', async () => {
      const testData = new TextEncoder().encode('note-1|instance1_5\n');
      mockFs.exists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(testData);
      mockFs.stat.mockResolvedValue({
        isDirectory: false,
        size: testData.length,
        mtimeMs: Date.now(),
        ctimeMs: Date.now(),
      });

      const result = await service.readFileInfo('/test/sd', 'activity/instance1.log');

      expect(result.type).toBe('activity');
    });

    it('should detect profile JSON files', async () => {
      const testData = new TextEncoder().encode('{"profileId": "test"}');
      mockFs.exists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(testData);
      mockFs.stat.mockResolvedValue({
        isDirectory: false,
        size: testData.length,
        mtimeMs: Date.now(),
        ctimeMs: Date.now(),
      });

      const result = await service.readFileInfo('/test/sd', 'profiles/profile1.json');

      expect(result.type).toBe('profile');
    });

    it('should detect image files', async () => {
      const testData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
      mockFs.exists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(testData);
      mockFs.stat.mockResolvedValue({
        isDirectory: false,
        size: 4,
        mtimeMs: Date.now(),
        ctimeMs: Date.now(),
      });

      const result = await service.readFileInfo('/test/sd', 'media/image.png');

      expect(result.type).toBe('image');
    });

    it('should detect identity files (SD_ID, SD_VERSION)', async () => {
      const testData = new TextEncoder().encode('test-uuid-1234');
      mockFs.exists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(testData);
      mockFs.stat.mockResolvedValue({
        isDirectory: false,
        size: testData.length,
        mtimeMs: Date.now(),
        ctimeMs: Date.now(),
      });

      const result = await service.readFileInfo('/test/sd', 'SD_ID');

      expect(result.type).toBe('identity');
    });

    it('should return error for missing files', async () => {
      mockFs.exists.mockResolvedValue(false);

      const result = await service.readFileInfo('/test/sd', 'nonexistent.file');

      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found');
    });

    it('should handle read errors gracefully', async () => {
      mockFs.exists.mockResolvedValue(true);
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      const result = await service.readFileInfo('/test/sd', 'notes/note-1/logs/test.crdtlog');

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Permission denied');
    });
  });
});
