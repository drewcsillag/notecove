/**
 * Image IPC Handlers Tests
 *
 * Tests for image operations via IPC handlers.
 * @see plans/add-images/PLAN-PHASE-1.md
 */

// Mock ipcMain before importing handlers
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn(),
  },
  BrowserWindow: {
    getAllWindows: jest.fn(() => []),
  },
  dialog: {
    showSaveDialog: jest.fn(),
    showOpenDialog: jest.fn(),
    showMessageBox: jest.fn(),
  },
  net: {
    fetch: jest.fn(),
  },
}));

// Mock Node.js fs/promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  rm: jest.fn(),
  access: jest.fn(),
  stat: jest.fn(),
  appendFile: jest.fn(),
}));

// Mock ImageStorage's saveImage to avoid crypto.randomUUID issues in tests
let mockSaveImageResult = { imageId: 'test-image-id', filename: 'test-image-id.png' };

jest.mock('@notecove/shared', () => {
  const actual = jest.requireActual('@notecove/shared');
  return {
    ...actual,
    ImageStorage: class MockImageStorage {
      static isSupportedMimeType = actual.ImageStorage.isSupportedMimeType;
      static getExtensionFromMimeType = actual.ImageStorage.getExtensionFromMimeType;
      static getMimeTypeFromExtension = actual.ImageStorage.getMimeTypeFromExtension;
      static parseImageFilename = actual.ImageStorage.parseImageFilename;

      // Mock constructor - parameters intentionally unused in test mock
      // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-useless-constructor
      constructor(_fs: unknown, _sdStructure: unknown) {}

      getMediaPath(): string {
        return '/test/sd/media';
      }

      getImagePath(imageId: string, mimeType: string): string {
        const ext = actual.ImageStorage.getExtensionFromMimeType(mimeType);
        return `/test/sd/media/${imageId}.${ext}`;
      }

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      async initializeMediaDir(): Promise<void> {}

      async saveImage(
        _data: Uint8Array,
        mimeType: string
      ): Promise<{ imageId: string; filename: string }> {
        const ext = actual.ImageStorage.getExtensionFromMimeType(mimeType);
        return {
          imageId: mockSaveImageResult.imageId,
          filename: `${mockSaveImageResult.imageId}.${ext}`,
        };
      }

      async readImage(): Promise<Uint8Array | null> {
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      async deleteImage(): Promise<void> {}

      async imageExists(): Promise<boolean> {
        return false;
      }
    },
  };
});

beforeEach(() => {
  mockSaveImageResult = { imageId: 'test-image-id', filename: 'test-image-id.png' };
  jest.clearAllMocks();
});

import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import { IPCHandlers } from '../handlers';
import type { Database, ImageCache, UUID } from '@notecove/shared';

// Mock types
interface MockDatabase {
  getStorageDir: jest.Mock;
  upsertImage: jest.Mock;
  getImage: jest.Mock;
  deleteImage: jest.Mock;
  imageExists: jest.Mock;
  getImagesBySd: jest.Mock;
  getImageStorageSize: jest.Mock;
  getImageCount: jest.Mock;
  // Other required database methods (stubbed)
  upsertFolder: jest.Mock;
  upsertNote: jest.Mock;
  getNote: jest.Mock;
  getNotesBySd: jest.Mock;
  getNotesByFolder: jest.Mock;
  getDeletedNotes: jest.Mock;
  getNoteCountForFolder: jest.Mock;
  getAllNotesCount: jest.Mock;
  getDeletedNoteCount: jest.Mock;
  getAllTags: jest.Mock;
  getBacklinks: jest.Mock;
  getState: jest.Mock;
  setState: jest.Mock;
  createStorageDir: jest.Mock;
  getAllStorageDirs: jest.Mock;
  getActiveStorageDir: jest.Mock;
  setActiveStorageDir: jest.Mock;
  searchNotes: jest.Mock;
  deleteNote: jest.Mock;
  deleteStorageDir: jest.Mock;
  adapter: { exec: jest.Mock };
}

interface MockCRDTManager {
  loadNote: jest.Mock;
  unloadNote: jest.Mock;
  applyUpdate: jest.Mock;
  loadFolderTree: jest.Mock;
  setActivityLogger: jest.Mock;
  recordMoveActivity: jest.Mock;
  deleteDocument: jest.Mock;
  loadDocument: jest.Mock;
  createDocument: jest.Mock;
  getNoteDoc: jest.Mock;
  getDocument: jest.Mock;
}

interface MockConfigManager {
  getDatabasePath: jest.Mock;
  setDatabasePath: jest.Mock;
}

interface MockAppendLogManager {
  getNoteVectorClock: jest.Mock;
  writeNoteSnapshot: jest.Mock;
}

interface MockNoteMoveManager {
  initiateMove: jest.Mock;
  executeMove: jest.Mock;
  recoverIncompleteMoves: jest.Mock;
  cleanupOldMoves: jest.Mock;
  getStaleMoves: jest.Mock;
  takeOverMove: jest.Mock;
  cancelMove: jest.Mock;
}

interface MockDiagnosticsManager {
  detectDuplicateNotes: jest.Mock;
  detectOrphanedCRDTFiles: jest.Mock;
  detectMissingCRDTFiles: jest.Mock;
  detectStaleMigrationLocks: jest.Mock;
  detectOrphanedActivityLogs: jest.Mock;
  removeStaleMigrationLock: jest.Mock;
  cleanupOrphanedActivityLog: jest.Mock;
  importOrphanedCRDT: jest.Mock;
  deleteMissingCRDTEntry: jest.Mock;
  deleteDuplicateNote: jest.Mock;
}

interface MockBackupManager {
  createPreOperationSnapshot: jest.Mock;
  createManualBackup: jest.Mock;
  listBackups: jest.Mock;
  restoreFromBackup: jest.Mock;
  deleteBackup: jest.Mock;
  cleanupOldSnapshots: jest.Mock;
  setBackupDirectory: jest.Mock;
  getBackupDirectory: jest.Mock;
}

describe('IPCHandlers - Image Operations', () => {
  let mockDatabase: MockDatabase;
  let mockCRDTManager: MockCRDTManager;
  let mockConfigManager: MockConfigManager;
  let mockAppendLogManager: MockAppendLogManager;
  let mockNoteMoveManager: MockNoteMoveManager;
  let mockDiagnosticsManager: MockDiagnosticsManager;
  let mockBackupManager: MockBackupManager;
  let registeredHandlers: Map<string, (...args: unknown[]) => unknown>;

  beforeEach(() => {
    // Capture registered handlers
    registeredHandlers = new Map();
    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: unknown) => {
      registeredHandlers.set(channel, handler as (...args: unknown[]) => unknown);
    });

    // Create mock database
    mockDatabase = {
      getStorageDir: jest.fn(),
      upsertImage: jest.fn(),
      getImage: jest.fn(),
      deleteImage: jest.fn(),
      imageExists: jest.fn(),
      getImagesBySd: jest.fn(),
      getImageStorageSize: jest.fn(),
      getImageCount: jest.fn(),
      // Stub other methods
      upsertFolder: jest.fn(),
      upsertNote: jest.fn(),
      getNote: jest.fn(),
      getNotesBySd: jest.fn(),
      getNotesByFolder: jest.fn(),
      getDeletedNotes: jest.fn(),
      getNoteCountForFolder: jest.fn(),
      getAllNotesCount: jest.fn(),
      getDeletedNoteCount: jest.fn(),
      getAllTags: jest.fn(),
      getBacklinks: jest.fn(),
      getState: jest.fn(),
      setState: jest.fn(),
      createStorageDir: jest.fn(),
      getAllStorageDirs: jest.fn(),
      getActiveStorageDir: jest.fn(),
      setActiveStorageDir: jest.fn(),
      searchNotes: jest.fn(),
      deleteNote: jest.fn(),
      deleteStorageDir: jest.fn(),
      adapter: { exec: jest.fn() },
    };

    // Create mock CRDT manager
    mockCRDTManager = {
      loadNote: jest.fn(),
      unloadNote: jest.fn(),
      applyUpdate: jest.fn(),
      loadFolderTree: jest.fn(),
      setActivityLogger: jest.fn(),
      recordMoveActivity: jest.fn(),
      deleteDocument: jest.fn(),
      loadDocument: jest.fn(),
      createDocument: jest.fn(),
      getNoteDoc: jest.fn(),
      getDocument: jest.fn(),
    };

    mockConfigManager = {
      getDatabasePath: jest.fn(),
      setDatabasePath: jest.fn(),
    };

    mockAppendLogManager = {
      getNoteVectorClock: jest.fn(),
      writeNoteSnapshot: jest.fn(),
    };

    mockNoteMoveManager = {
      initiateMove: jest.fn(),
      executeMove: jest.fn(),
      recoverIncompleteMoves: jest.fn(),
      cleanupOldMoves: jest.fn(),
      getStaleMoves: jest.fn(),
      takeOverMove: jest.fn(),
      cancelMove: jest.fn(),
    };

    mockDiagnosticsManager = {
      detectDuplicateNotes: jest.fn(),
      detectOrphanedCRDTFiles: jest.fn(),
      detectMissingCRDTFiles: jest.fn(),
      detectStaleMigrationLocks: jest.fn(),
      detectOrphanedActivityLogs: jest.fn(),
      removeStaleMigrationLock: jest.fn(),
      cleanupOrphanedActivityLog: jest.fn(),
      importOrphanedCRDT: jest.fn(),
      deleteMissingCRDTEntry: jest.fn(),
      deleteDuplicateNote: jest.fn(),
    };

    mockBackupManager = {
      createPreOperationSnapshot: jest.fn(),
      createManualBackup: jest.fn(),
      listBackups: jest.fn(),
      restoreFromBackup: jest.fn(),
      deleteBackup: jest.fn(),
      cleanupOldSnapshots: jest.fn(),
      setBackupDirectory: jest.fn(),
      getBackupDirectory: jest.fn(),
    };

    // Set up default SD mock
    mockDatabase.getStorageDir.mockResolvedValue({
      id: 'sd-1',
      name: 'Test SD',
      path: '/test/sd',
      uuid: 'sd-uuid-1',
      created: Date.now(),
      isActive: true,
    });

    // Create handlers instance - instantiation triggers handler registration
    new IPCHandlers(
      mockCRDTManager as never,
      mockDatabase as unknown as Database,
      mockConfigManager as never,
      mockAppendLogManager as never,
      mockNoteMoveManager as never,
      mockDiagnosticsManager as never,
      mockBackupManager as never
    );
  });

  describe('image:save', () => {
    it('should register the handler', () => {
      expect(registeredHandlers.has('image:save')).toBe(true);
    });

    it('should save image and return imageId and filename', async () => {
      const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
      const mimeType = 'image/png';
      const sdId = 'sd-1';

      // Mock fs operations
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const handler = registeredHandlers.get('image:save');
      const result = (await handler!({} as unknown, sdId, imageData, mimeType)) as {
        imageId: string;
        filename: string;
      };

      expect(result.imageId).toBeDefined();
      expect(result.filename).toMatch(/\.png$/);
      expect(mockDatabase.upsertImage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: result.imageId,
          sdId,
          filename: result.filename,
          mimeType,
          size: imageData.length,
        })
      );
    });

    it('should reject unsupported MIME types', async () => {
      const imageData = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const mimeType = 'application/pdf';
      const sdId = 'sd-1';

      const handler = registeredHandlers.get('image:save');

      await expect(handler!({} as unknown, sdId, imageData, mimeType)).rejects.toThrow(
        'Unsupported image MIME type'
      );
    });

    it('should throw if SD not found', async () => {
      mockDatabase.getStorageDir.mockResolvedValue(null);

      const handler = registeredHandlers.get('image:save');

      await expect(
        handler!({} as unknown, 'nonexistent-sd', new Uint8Array([0x89]), 'image/png')
      ).rejects.toThrow('Storage directory not found');
    });
  });

  describe('image:getDataUrl', () => {
    it('should register the handler', () => {
      expect(registeredHandlers.has('image:getDataUrl')).toBe(true);
    });

    it('should return base64 data URL for existing image', async () => {
      const imageId = 'test-image-id';
      const sdId = 'sd-1';
      const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

      mockDatabase.getImage.mockResolvedValue({
        id: imageId,
        sdId,
        filename: `${imageId}.png`,
        mimeType: 'image/png',
        width: 100,
        height: 100,
        size: imageData.length,
        created: Date.now(),
      });

      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(imageData));

      const handler = registeredHandlers.get('image:getDataUrl');
      const result = (await handler!({} as unknown, sdId, imageId)) as string;

      expect(result).toMatch(/^data:image\/png;base64,/);
    });

    it('should return null if image not found in database', async () => {
      mockDatabase.getImage.mockResolvedValue(null);

      const handler = registeredHandlers.get('image:getDataUrl');
      const result = await handler!({} as unknown, 'sd-1', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should return null if file not found on disk', async () => {
      mockDatabase.getImage.mockResolvedValue({
        id: 'test-image',
        sdId: 'sd-1',
        filename: 'test-image.png',
        mimeType: 'image/png',
        width: 100,
        height: 100,
        size: 1000,
        created: Date.now(),
      });

      (fs.readFile as jest.Mock).mockRejectedValue(new Error('ENOENT'));

      const handler = registeredHandlers.get('image:getDataUrl');
      const result = await handler!({} as unknown, 'sd-1', 'test-image');

      expect(result).toBeNull();
    });
  });

  describe('image:getPath', () => {
    it('should register the handler', () => {
      expect(registeredHandlers.has('image:getPath')).toBe(true);
    });

    it('should return file path for existing image', async () => {
      const imageId = 'test-image-id';
      const sdId = 'sd-1';

      mockDatabase.getImage.mockResolvedValue({
        id: imageId,
        sdId,
        filename: `${imageId}.png`,
        mimeType: 'image/png',
        width: 100,
        height: 100,
        size: 1000,
        created: Date.now(),
      });

      const handler = registeredHandlers.get('image:getPath');
      const result = (await handler!({} as unknown, sdId, imageId)) as string;

      expect(result).toBe(`/test/sd/media/${imageId}.png`);
    });

    it('should return null if image not found', async () => {
      mockDatabase.getImage.mockResolvedValue(null);

      const handler = registeredHandlers.get('image:getPath');
      const result = await handler!({} as unknown, 'sd-1', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('image:delete', () => {
    it('should register the handler', () => {
      expect(registeredHandlers.has('image:delete')).toBe(true);
    });

    it('should delete image from disk and database', async () => {
      const imageId = 'test-image-id';
      const sdId = 'sd-1';

      mockDatabase.getImage.mockResolvedValue({
        id: imageId,
        sdId,
        filename: `${imageId}.png`,
        mimeType: 'image/png',
        width: 100,
        height: 100,
        size: 1000,
        created: Date.now(),
      });

      (fs.rm as jest.Mock).mockResolvedValue(undefined);

      const handler = registeredHandlers.get('image:delete');
      await handler!({} as unknown, sdId, imageId);

      expect(fs.rm).toHaveBeenCalledWith(`/test/sd/media/${imageId}.png`, { force: true });
      expect(mockDatabase.deleteImage).toHaveBeenCalledWith(imageId);
    });

    it('should not throw if image not found', async () => {
      mockDatabase.getImage.mockResolvedValue(null);

      const handler = registeredHandlers.get('image:delete');
      await expect(handler!({} as unknown, 'sd-1', 'nonexistent')).resolves.not.toThrow();
    });
  });

  describe('image:exists', () => {
    it('should register the handler', () => {
      expect(registeredHandlers.has('image:exists')).toBe(true);
    });

    it('should return true if image exists in database', async () => {
      mockDatabase.imageExists.mockResolvedValue(true);

      const handler = registeredHandlers.get('image:exists');
      const result = await handler!({} as unknown, 'sd-1', 'test-image');

      expect(result).toBe(true);
    });

    it('should return false if image does not exist', async () => {
      mockDatabase.imageExists.mockResolvedValue(false);

      const handler = registeredHandlers.get('image:exists');
      const result = await handler!({} as unknown, 'sd-1', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('image:getMetadata', () => {
    it('should register the handler', () => {
      expect(registeredHandlers.has('image:getMetadata')).toBe(true);
    });

    it('should return image metadata from database', async () => {
      const imageMetadata: ImageCache = {
        id: 'test-image' as UUID,
        sdId: 'sd-1',
        filename: 'test-image.png',
        mimeType: 'image/png',
        width: 1920,
        height: 1080,
        size: 500000,
        created: Date.now(),
      };

      mockDatabase.getImage.mockResolvedValue(imageMetadata);

      const handler = registeredHandlers.get('image:getMetadata');
      const result = await handler!({} as unknown, 'test-image');

      expect(result).toEqual(imageMetadata);
    });

    it('should return null if image not found', async () => {
      mockDatabase.getImage.mockResolvedValue(null);

      const handler = registeredHandlers.get('image:getMetadata');
      const result = await handler!({} as unknown, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('image:list', () => {
    it('should register the handler', () => {
      expect(registeredHandlers.has('image:list')).toBe(true);
    });

    it('should return all images for an SD', async () => {
      const images: ImageCache[] = [
        {
          id: 'img-1' as UUID,
          sdId: 'sd-1',
          filename: 'img-1.png',
          mimeType: 'image/png',
          width: 100,
          height: 100,
          size: 1000,
          created: Date.now(),
        },
        {
          id: 'img-2' as UUID,
          sdId: 'sd-1',
          filename: 'img-2.jpg',
          mimeType: 'image/jpeg',
          width: 200,
          height: 200,
          size: 2000,
          created: Date.now(),
        },
      ];

      mockDatabase.getImagesBySd.mockResolvedValue(images);

      const handler = registeredHandlers.get('image:list');
      const result = await handler!({} as unknown, 'sd-1');

      expect(result).toEqual(images);
    });
  });

  describe('image:getStorageStats', () => {
    it('should register the handler', () => {
      expect(registeredHandlers.has('image:getStorageStats')).toBe(true);
    });

    it('should return storage stats for an SD', async () => {
      mockDatabase.getImageStorageSize.mockResolvedValue(5000000);
      mockDatabase.getImageCount.mockResolvedValue(10);

      const handler = registeredHandlers.get('image:getStorageStats');
      const result = (await handler!({} as unknown, 'sd-1')) as {
        totalSize: number;
        imageCount: number;
      };

      expect(result.totalSize).toBe(5000000);
      expect(result.imageCount).toBe(10);
    });
  });

  describe('image:pickAndSave', () => {
    it('should register the handler', () => {
      expect(registeredHandlers.has('image:pickAndSave')).toBe(true);
    });

    it('should open file picker, save selected images, and return imageIds', async () => {
      const { dialog } = await import('electron');
      const sdId = 'sd-1';

      // Mock dialog to return file paths
      (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
        canceled: false,
        filePaths: ['/path/to/image1.png', '/path/to/image2.jpg'],
      });

      // Mock fs.readFile to return image data
      (fs.readFile as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.endsWith('.png')) {
          return Promise.resolve(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        } else {
          return Promise.resolve(Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
        }
      });

      // Mock fs operations for save
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      // Set up mock save results in sequence
      let callCount = 0;
      mockSaveImageResult = { imageId: 'img-1', filename: 'img-1.png' };
      const originalGetImagePath = jest.fn();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      jest.spyOn(require('@notecove/shared'), 'ImageStorage').mockImplementation(() => ({
        getMediaPath: () => '/test/sd/media',
        getImagePath: originalGetImagePath,
        initializeMediaDir: jest.fn().mockResolvedValue(undefined),
        saveImage: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({ imageId: 'img-1', filename: 'img-1.png' });
          } else {
            return Promise.resolve({ imageId: 'img-2', filename: 'img-2.jpg' });
          }
        }),
        readImage: jest.fn(),
        deleteImage: jest.fn(),
        imageExists: jest.fn(),
      }));

      const handler = registeredHandlers.get('image:pickAndSave');
      const result = (await handler!({} as unknown, sdId)) as string[];

      // Verify dialog was opened with correct filters
      expect(dialog.showOpenDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.arrayContaining(['openFile', 'multiSelections']),
          filters: expect.arrayContaining([
            expect.objectContaining({
              name: 'Images',
              extensions: expect.arrayContaining(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']),
            }),
          ]),
        })
      );

      // Verify result is array of imageIds
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array if dialog is canceled', async () => {
      const { dialog } = await import('electron');

      (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
        canceled: true,
        filePaths: [],
      });

      const handler = registeredHandlers.get('image:pickAndSave');
      const result = (await handler!({} as unknown, 'sd-1')) as string[];

      expect(result).toEqual([]);
    });

    it('should throw if SD not found', async () => {
      mockDatabase.getStorageDir.mockResolvedValue(null);

      const handler = registeredHandlers.get('image:pickAndSave');

      await expect(handler!({} as unknown, 'nonexistent-sd')).rejects.toThrow(
        'Storage directory not found'
      );
    });

    it('should skip unsupported file types gracefully', async () => {
      const { dialog } = await import('electron');

      (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
        canceled: false,
        filePaths: ['/path/to/document.pdf'], // PDF is not supported
      });

      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from([0x25, 0x50, 0x44, 0x46]));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      const handler = registeredHandlers.get('image:pickAndSave');
      const result = (await handler!({} as unknown, 'sd-1')) as string[];

      // Should return empty array since PDF is not a supported image type
      expect(result).toEqual([]);
    });
  });

  describe('image:downloadAndSave', () => {
    it('should register the handler', () => {
      expect(registeredHandlers.has('image:downloadAndSave')).toBe(true);
    });

    it('should download remote image and save it, returning imageId', async () => {
      const { net } = await import('electron');
      const sdId = 'sd-1';
      const url = 'https://example.com/image.png';
      const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes

      // Mock net.fetch to return a successful response
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn().mockReturnValue('image/png'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(imageData.buffer),
      };
      (net.fetch as jest.Mock).mockResolvedValue(mockResponse);

      // Mock fs operations
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const handler = registeredHandlers.get('image:downloadAndSave');
      const result = (await handler!({} as unknown, sdId, url)) as string;

      // Verify fetch was called with the URL
      expect(net.fetch).toHaveBeenCalledWith(url);

      // Verify result is an imageId
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Verify image was upserted to database
      expect(mockDatabase.upsertImage).toHaveBeenCalledWith(
        expect.objectContaining({
          sdId,
          mimeType: 'image/png',
        })
      );
    });

    it('should infer mime type from URL extension if Content-Type is missing', async () => {
      const { net } = await import('electron');
      const sdId = 'sd-1';
      const url = 'https://example.com/photo.jpg';
      const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic bytes

      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn().mockReturnValue(null), // No Content-Type header
        },
        arrayBuffer: jest.fn().mockResolvedValue(imageData.buffer),
      };
      (net.fetch as jest.Mock).mockResolvedValue(mockResponse);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const handler = registeredHandlers.get('image:downloadAndSave');
      const result = (await handler!({} as unknown, sdId, url)) as string;

      expect(typeof result).toBe('string');
      expect(mockDatabase.upsertImage).toHaveBeenCalledWith(
        expect.objectContaining({
          mimeType: 'image/jpeg',
        })
      );
    });

    it('should read local file:// URLs from filesystem', async () => {
      const sdId = 'sd-1';
      const url = 'file:///Users/test/images/photo.png';
      const imageData = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

      // Mock fs.readFile for local file
      (fs.readFile as jest.Mock).mockResolvedValue(imageData);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const handler = registeredHandlers.get('image:downloadAndSave');
      const result = (await handler!({} as unknown, sdId, url)) as string;

      // Should read from local filesystem, not use net.fetch
      expect(fs.readFile).toHaveBeenCalledWith('/Users/test/images/photo.png');
      expect(typeof result).toBe('string');
    });

    it('should throw if SD not found', async () => {
      mockDatabase.getStorageDir.mockResolvedValue(null);

      const handler = registeredHandlers.get('image:downloadAndSave');

      await expect(
        handler!({} as unknown, 'nonexistent-sd', 'https://example.com/image.png')
      ).rejects.toThrow('Storage directory not found');
    });

    it('should throw on network failure', async () => {
      const { net } = await import('electron');

      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      };
      (net.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const handler = registeredHandlers.get('image:downloadAndSave');

      await expect(
        handler!({} as unknown, 'sd-1', 'https://example.com/missing.png')
      ).rejects.toThrow('Failed to download image');
    });

    it('should throw on unsupported mime type', async () => {
      const { net } = await import('electron');
      const url = 'https://example.com/document.pdf';

      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn().mockReturnValue('application/pdf'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(4)),
      };
      (net.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const handler = registeredHandlers.get('image:downloadAndSave');

      await expect(handler!({} as unknown, 'sd-1', url)).rejects.toThrow('Unsupported image type');
    });
  });
});
