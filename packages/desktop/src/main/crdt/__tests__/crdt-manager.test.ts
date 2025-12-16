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

  describe('applyUpdate - double write bug', () => {
    it('should only write to disk once when applyUpdate is called (not twice)', async () => {
      // This test verifies the fix for the double-write bug where:
      // 1. applyUpdate() writes to disk
      // 2. applyUpdate() calls Y.applyUpdate() on the doc
      // 3. doc.on('update') fires and calls handleUpdate()
      // 4. handleUpdate() writes to disk AGAIN (BUG!)
      //
      // After the fix, the doc.on('update') listener should skip handleUpdate()
      // when the origin is 'ipc' (indicating the update came from applyUpdate).

      // Load a note first
      await manager.loadNote('test-note', 'test-sd');

      // Create an update
      const tempDoc = new Y.Doc();
      const content = tempDoc.getXmlFragment('content');
      const text = new Y.XmlText();
      text.insert(0, 'Hello World');
      content.insert(0, [text]);
      const update = Y.encodeStateAsUpdate(tempDoc);

      // Reset the mock to clear any calls from loading
      mockStorageManager.writeNoteUpdate.mockClear();

      // Apply the update via applyUpdate (IPC path)
      await manager.applyUpdate('test-note', update);

      // Give time for any async operations
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(100);

      // CRITICAL: writeNoteUpdate should be called exactly ONCE
      // If it's called twice, the double-write bug is present
      expect(mockStorageManager.writeNoteUpdate).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe('applyUpdate - realistic double write bug', () => {
    // This test uses a more realistic mock that actually triggers Y.Doc update events
    // to properly demonstrate and verify the fix for the double-write bug
    let realisticManager: CRDTManagerImpl;
    let realisticMockStorageManager: jest.Mocked<AppendLogManager>;
    let testDoc: Y.Doc;
    let writeCallCount: number;

    beforeEach(() => {
      jest.useRealTimers(); // Need real timers for this test
      writeCallCount = 0;

      // Create a shared Y.Doc that will be returned by loadNote
      testDoc = new Y.Doc();

      // Track write calls with a counter that increments on each call
      realisticMockStorageManager = {
        getInstanceId: jest.fn().mockReturnValue('test-instance'),
        getSDPath: jest.fn((sdId: string) => `/mock/storage/${sdId}`),
        loadNote: jest.fn().mockImplementation(() => {
          return Promise.resolve({
            doc: testDoc,
            vectorClock: {},
          });
        }),
        writeNoteUpdate: jest.fn().mockImplementation(() => {
          writeCallCount++;
          return Promise.resolve({
            sequence: writeCallCount,
            offset: 0,
            file: `test_${writeCallCount}.crdtlog`,
          });
        }),
        loadFolderTree: jest.fn().mockResolvedValue({
          doc: new Y.Doc(),
        }),
        writeFolderUpdate: jest.fn().mockResolvedValue(undefined),
        saveNoteSnapshot: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<AppendLogManager>;

      realisticManager = new CRDTManagerImpl(realisticMockStorageManager);
    });

    afterEach(() => {
      realisticManager.destroy();
      testDoc.destroy();
    });

    it('should NOT double-write when applyUpdate is called via IPC', async () => {
      // Load a note - this sets up the doc.on('update') listener
      await realisticManager.loadNote('test-note', 'test-sd');

      // Create an update by modifying a different doc
      const sourceDoc = new Y.Doc();
      const content = sourceDoc.getXmlFragment('content');
      const text = new Y.XmlText();
      text.insert(0, 'Hello World');
      content.insert(0, [text]);
      const update = Y.encodeStateAsUpdate(sourceDoc);

      // Reset write count
      writeCallCount = 0;
      realisticMockStorageManager.writeNoteUpdate.mockClear();

      // Apply the update via applyUpdate (IPC path)
      // This should:
      // 1. Call writeNoteUpdate once
      // 2. Call snapshot.applyUpdate() which calls Y.applyUpdate(doc, update, origin)
      // 3. Y.Doc fires 'update' event
      // 4. The listener should check origin and NOT call handleUpdate() for 'ipc' origin
      await realisticManager.applyUpdate('test-note', update);

      // Wait for any async handlers to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // CRITICAL: writeNoteUpdate should be called exactly ONCE
      // If it's called twice, the double-write bug is still present
      expect(realisticMockStorageManager.writeNoteUpdate).toHaveBeenCalledTimes(1);

      sourceDoc.destroy();
    });
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
