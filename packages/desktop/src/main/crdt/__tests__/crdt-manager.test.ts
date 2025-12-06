/**
 * Tests for CRDTManagerImpl
 *
 * Tests the CRDT document management functionality including:
 * - Note loading/unloading
 * - Update application
 * - Folder tree management
 * - Activity logging
 * - Snapshot management
 */

import * as Y from 'yjs';
import { CRDTManagerImpl } from '../crdt-manager';
import type { AppendLogManager, ActivityLogger, VectorClock } from '@shared/storage';
import type { Database } from '@notecove/shared';

// Mock the shared dependencies
jest.mock('@shared/storage', () => {
  const actual = jest.requireActual('@shared/storage');
  return {
    ...actual,
    DocumentSnapshot: {
      ...actual.DocumentSnapshot,
      createEmpty: jest.fn(() => ({
        getDoc: jest.fn(() => new (jest.requireActual('yjs').Doc)()),
        destroy: jest.fn(),
        applyUpdate: jest.fn(),
        getSnapshot: jest.fn().mockResolvedValue({ state: new Uint8Array(), vectorClock: {} }),
        replaceWith: jest.fn(),
      })),
      fromStorage: jest.fn((state: Uint8Array, _vectorClock: VectorClock) => ({
        getDoc: jest.fn(() => {
          const doc = new (jest.requireActual('yjs').Doc)() as Y.Doc;
          Y.applyUpdate(doc, state);
          return doc;
        }),
        destroy: jest.fn(),
        applyUpdate: jest.fn(),
        getSnapshot: jest.fn().mockResolvedValue({ state: new Uint8Array(), vectorClock: {} }),
        replaceWith: jest.fn(),
      })),
    },
  };
});

jest.mock('../../telemetry/crdt-metrics', () => ({
  getCRDTMetrics: jest.fn(() => ({
    recordColdLoad: jest.fn(),
    recordSnapshotCreation: jest.fn(),
  })),
}));

// Create mock storage manager factory
function createMockStorageManager(): jest.Mocked<AppendLogManager> {
  return {
    getInstanceId: jest.fn().mockReturnValue('test-instance'),
    getSDPath: jest.fn((sdId: string) => `/mock/storage/${sdId}`),
    loadNote: jest.fn().mockResolvedValue({
      doc: new Y.Doc(),
      vectorClock: {},
    }),
    writeNoteUpdate: jest.fn().mockResolvedValue({
      sequence: 1,
      offset: 0,
      file: 'test.crdtlog',
    }),
    loadFolderTree: jest.fn().mockResolvedValue({
      doc: new Y.Doc(),
    }),
    writeFolderUpdate: jest.fn().mockResolvedValue(undefined),
    saveNoteSnapshot: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AppendLogManager>;
}

// Create mock database factory
function createMockDatabase(): jest.Mocked<Database> {
  return {
    getNote: jest.fn().mockResolvedValue({ sdId: 'default' }),
  } as unknown as jest.Mocked<Database>;
}

// Create mock activity logger factory
function createMockActivityLogger(): jest.Mocked<ActivityLogger> {
  return {
    recordNoteActivity: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ActivityLogger>;
}

describe('CRDTManagerImpl', () => {
  let manager: CRDTManagerImpl;
  let mockStorageManager: jest.Mocked<AppendLogManager>;
  let mockDatabase: jest.Mocked<Database>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockStorageManager = createMockStorageManager();
    mockDatabase = createMockDatabase();
    manager = new CRDTManagerImpl(mockStorageManager, mockDatabase);
  });

  afterEach(() => {
    manager.destroy();
    jest.useRealTimers();
  });

  describe('setBroadcastCallback', () => {
    it('should store the broadcast callback', () => {
      const callback = jest.fn();
      manager.setBroadcastCallback(callback);
      // The callback is stored internally, we can verify it's called when updates occur
      expect(callback).not.toHaveBeenCalled(); // Just setting doesn't call it
    });
  });

  describe('getDocument', () => {
    it('should return undefined for non-loaded notes', () => {
      const doc = manager.getDocument('non-existent-note');
      expect(doc).toBeUndefined();
    });
  });

  describe('getNoteDoc', () => {
    it('should return undefined for non-loaded notes', () => {
      const noteDoc = manager.getNoteDoc('non-existent-note');
      expect(noteDoc).toBeUndefined();
    });
  });

  describe('getLoadedNotes', () => {
    it('should return empty array when no notes loaded', () => {
      const notes = manager.getLoadedNotes();
      expect(notes).toEqual([]);
    });
  });

  describe('getFolderTree', () => {
    it('should return undefined for non-loaded folder trees', () => {
      const folderTree = manager.getFolderTree('non-existent-sd');
      expect(folderTree).toBeUndefined();
    });
  });

  describe('setActivityLogger', () => {
    it('should register an activity logger for an SD', () => {
      const mockLogger = createMockActivityLogger();
      manager.setActivityLogger('test-sd', mockLogger);
      // Activity logger is stored internally - we verify by using recordMoveActivity
    });
  });

  describe('recordMoveActivity', () => {
    it('should record activity when logger is registered', async () => {
      const mockLogger = createMockActivityLogger();
      manager.setActivityLogger('test-sd', mockLogger);

      await manager.recordMoveActivity('note-123', 'test-sd');

      expect(mockLogger.recordNoteActivity).toHaveBeenCalledWith('note-123', 1);
    });

    it('should not throw when logger is not registered', async () => {
      // No logger registered for 'unknown-sd'
      await expect(manager.recordMoveActivity('note-123', 'unknown-sd')).resolves.toBeUndefined();
    });

    it('should not throw when logger.recordNoteActivity fails', async () => {
      const mockLogger = createMockActivityLogger();
      mockLogger.recordNoteActivity.mockRejectedValueOnce(new Error('Activity logging failed'));
      manager.setActivityLogger('test-sd', mockLogger);

      await expect(manager.recordMoveActivity('note-123', 'test-sd')).resolves.toBeUndefined();
    });
  });

  describe('flush', () => {
    it('should resolve immediately when no pending updates', async () => {
      await expect(manager.flush()).resolves.toBeUndefined();
    });
  });

  describe('getPendingSnapshotCount', () => {
    it('should return 0 when no notes loaded', () => {
      const count = manager.getPendingSnapshotCount();
      expect(count).toBe(0);
    });
  });

  describe('flushSnapshots', () => {
    it('should resolve immediately when no notes need snapshots', async () => {
      const onProgress = jest.fn();
      await manager.flushSnapshots(onProgress);
      expect(onProgress).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      // Just verify it doesn't throw
      manager.destroy();
    });

    it('should be callable multiple times', () => {
      manager.destroy();
      manager.destroy(); // Should not throw
    });
  });

  describe('unloadNote', () => {
    it('should not throw for non-existent notes', async () => {
      await expect(manager.unloadNote('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('applyUpdate', () => {
    it('should throw for non-loaded notes', async () => {
      const update = Y.encodeStateAsUpdate(new Y.Doc());
      await expect(manager.applyUpdate('non-existent', update)).rejects.toThrow(
        'Note non-existent not loaded'
      );
    });
  });

  describe('reloadNote', () => {
    it('should not throw for non-loaded notes', async () => {
      await expect(manager.reloadNote('non-existent')).resolves.toBeUndefined();
    });
  });
});

describe('CRDTManagerImpl - Integration', () => {
  let manager: CRDTManagerImpl;
  let mockStorageManager: jest.Mocked<AppendLogManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Create a more realistic mock that returns a proper Y.Doc
    const mockDoc = new Y.Doc();
    mockStorageManager = {
      getInstanceId: jest.fn().mockReturnValue('test-instance'),
      getSDPath: jest.fn((sdId: string) => `/mock/storage/${sdId}`),
      loadNote: jest.fn().mockImplementation(() =>
        Promise.resolve({
          doc: mockDoc,
          vectorClock: {},
        })
      ),
      writeNoteUpdate: jest.fn().mockResolvedValue({
        sequence: 1,
        offset: 0,
        file: 'test.crdtlog',
      }),
      loadFolderTree: jest.fn().mockResolvedValue({
        doc: new Y.Doc(),
      }),
      writeFolderUpdate: jest.fn().mockResolvedValue(undefined),
      saveNoteSnapshot: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AppendLogManager>;

    manager = new CRDTManagerImpl(mockStorageManager);
  });

  afterEach(() => {
    manager.destroy();
    jest.useRealTimers();
  });

  describe('loadFolderTree', () => {
    it('should load a folder tree for an SD', async () => {
      const folderTree = await manager.loadFolderTree('test-sd');
      expect(folderTree).toBeDefined();
      expect(mockStorageManager.loadFolderTree).toHaveBeenCalledWith('test-sd');
    });

    it('should return cached folder tree on subsequent loads', async () => {
      const folderTree1 = await manager.loadFolderTree('test-sd');
      const folderTree2 = await manager.loadFolderTree('test-sd');

      expect(folderTree1).toBe(folderTree2);
      expect(mockStorageManager.loadFolderTree).toHaveBeenCalledTimes(1);
    });

    it('should create demo folders for default SD when empty', async () => {
      // The loadFolderTree creates demo folders for 'default' SD when empty
      const folderTree = await manager.loadFolderTree('default');
      const folders = folderTree.getAllFolders();

      // Demo folders should be created
      expect(folders.length).toBeGreaterThan(0);
    });
  });

  describe('checkCRDTLogExists', () => {
    it('should return false when log directory does not exist', async () => {
      const result = await manager.checkCRDTLogExists('note-123', 'test-sd', 'instance-1', 5);
      expect(result).toBe(false);
    });
  });
});
