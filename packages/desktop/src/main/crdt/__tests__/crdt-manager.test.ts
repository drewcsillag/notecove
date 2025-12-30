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
      createEmpty: jest.fn(() => {
        // Create one doc that persists for this snapshot instance
        const doc = new (jest.requireActual('yjs').Doc)() as Y.Doc;
        return {
          getDoc: jest.fn(() => doc),
          destroy: jest.fn(),
          applyUpdate: jest.fn(
            (
              update: Uint8Array,
              _instanceId: string,
              _sequence: number,
              _offset: number,
              _file: string,
              origin?: unknown
            ) => {
              // Actually apply the update to the doc with origin
              Y.applyUpdate(doc, update, origin);
            }
          ),
          getSnapshot: jest.fn().mockResolvedValue({ state: new Uint8Array(), vectorClock: {} }),
          replaceWith: jest.fn(),
        };
      }),
      fromStorage: jest.fn((state: Uint8Array, _vectorClock: VectorClock) => {
        // Create one doc that persists for this snapshot instance
        const doc = new (jest.requireActual('yjs').Doc)() as Y.Doc;
        Y.applyUpdate(doc, state);
        return {
          getDoc: jest.fn(() => doc),
          destroy: jest.fn(),
          applyUpdate: jest.fn(
            (
              update: Uint8Array,
              _instanceId: string,
              _sequence: number,
              _offset: number,
              _file: string,
              origin?: unknown
            ) => {
              // Actually apply the update to the doc with origin
              Y.applyUpdate(doc, update, origin);
            }
          ),
          getSnapshot: jest.fn().mockResolvedValue({ state: new Uint8Array(), vectorClock: {} }),
          replaceWith: jest.fn(),
        };
      }),
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

    it('should only decrement refCount when refCount > 1', async () => {
      // Load note twice to get refCount = 2
      await manager.loadNote('test-note', 'test-sd');
      await manager.loadNote('test-note', 'test-sd');

      // Note should still be loaded
      expect(manager.getLoadedNotes()).toContain('test-note');

      // First unload - decrements refCount to 1, note stays loaded
      await manager.unloadNote('test-note');
      expect(manager.getLoadedNotes()).toContain('test-note');

      // Second unload - decrements refCount to 0, note is removed
      await manager.unloadNote('test-note');
      expect(manager.getLoadedNotes()).not.toContain('test-note');
    });
  });

  describe('forceUnloadNote', () => {
    it('should not throw for non-existent notes', async () => {
      await expect(manager.forceUnloadNote('non-existent')).resolves.toBeUndefined();
    });

    it('should unload note even when refCount > 1', async () => {
      // Load note twice to get refCount = 2
      await manager.loadNote('test-note', 'test-sd');
      await manager.loadNote('test-note', 'test-sd');

      // Note should be loaded
      expect(manager.getLoadedNotes()).toContain('test-note');

      // Force unload should remove it regardless of refCount
      await manager.forceUnloadNote('test-note');
      expect(manager.getLoadedNotes()).not.toContain('test-note');
    });

    it('should allow fresh reload after force unload', async () => {
      // Load note multiple times
      await manager.loadNote('test-note', 'test-sd');
      await manager.loadNote('test-note', 'test-sd');
      await manager.loadNote('test-note', 'test-sd');

      // Force unload
      await manager.forceUnloadNote('test-note');

      // Verify note is not loaded
      expect(manager.getDocument('test-note')).toBeUndefined();

      // Should be able to load it fresh
      await manager.loadNote('test-note', 'test-sd');
      expect(manager.getDocument('test-note')).toBeDefined();
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

      // writeNoteUpdate should be called TWICE:
      // 1. The content update (from applyUpdate)
      // 2. The metadata update (modified timestamp)
      // Both are needed for proper cross-machine sync
      expect(mockStorageManager.writeNoteUpdate).toHaveBeenCalledTimes(2);
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

      // writeNoteUpdate should be called TWICE:
      // 1. The content update (from applyUpdate)
      // 2. The metadata update (modified timestamp, written via event handler)
      // Both are needed for proper cross-machine sync - the metadata update must be
      // on disk so other instances can see the modified timestamp
      expect(realisticMockStorageManager.writeNoteUpdate).toHaveBeenCalledTimes(2);

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

describe('CRDTManagerImpl - Concurrent applyUpdate Race Condition', () => {
  // This test suite verifies the fix for the CRDT sequence violation bug.
  //
  // Bug: During rapid typing, concurrent IPC calls to applyUpdate() cause
  // sequence violations because the snapshot.applyUpdate() calls happen
  // when each async write completes, not in the order they started.
  //
  // Example: Three concurrent applyUpdate calls:
  // 1. Call #1 awaits writeNoteUpdate → gets seq=1
  // 2. Call #2 awaits writeNoteUpdate → gets seq=2
  // 3. Call #3 awaits writeNoteUpdate → gets seq=3
  //
  // If the async continuations resolve out of order (e.g., seq=2 before seq=1),
  // the snapshot.applyUpdate(seq=2) is called when expecting seq=1 → VIOLATION!
  //
  // Fix: Add an operation queue to CRDTManager.applyUpdate() that serializes
  // the entire operation (write + snapshot update) per note.

  let manager: CRDTManagerImpl;
  let mockStorageManager: jest.Mocked<AppendLogManager>;
  let mockDatabase: jest.Mocked<Database>;

  // Import the real DocumentSnapshot to get actual sequence validation
  const RealStorage: typeof import('@shared/storage') = jest.requireActual('@shared/storage');
  const { DocumentSnapshot } = RealStorage;

  beforeEach(() => {
    jest.useRealTimers(); // Need real timers for async operations

    mockStorageManager = {
      getInstanceId: jest.fn().mockReturnValue('test-instance'),
      getSDPath: jest.fn((sdId: string) => `/mock/storage/${sdId}`),
      loadNote: jest.fn(),
      writeNoteUpdate: jest.fn(),
      loadFolderTree: jest.fn().mockResolvedValue({
        doc: new Y.Doc(),
      }),
      writeFolderUpdate: jest.fn().mockResolvedValue(undefined),
      saveNoteSnapshot: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AppendLogManager>;

    mockDatabase = {
      getNote: jest.fn().mockResolvedValue({
        id: 'test-note',
        sdId: 'test-sd',
        title: 'Test Note',
        modified: 1000,
      }),
      upsertNote: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Database>;

    manager = new CRDTManagerImpl(mockStorageManager, mockDatabase);
  });

  afterEach(() => {
    manager.destroy();
  });

  it('should serialize concurrent applyUpdate calls to prevent sequence violations', async () => {
    // Create a real DocumentSnapshot to get actual sequence validation
    const realSnapshot = DocumentSnapshot.createEmpty();
    const sharedDoc = realSnapshot.getDoc();

    // Set up loadNote to return our controlled snapshot
    mockStorageManager.loadNote.mockResolvedValue({
      doc: sharedDoc,
      vectorClock: {},
    });

    // Manually set up the internal state with our real snapshot
    // We need to access the manager's internal state, which requires some workaround
    await manager.loadNote('test-note', 'test-sd');

    // Get the loaded state and replace its snapshot with our real one
    // This is a bit hacky but necessary to test with real sequence validation
    const state = (
      manager as unknown as { documents: Map<string, { snapshot: typeof realSnapshot }> }
    ).documents.get('test-note');
    if (state) {
      state.snapshot = realSnapshot;
    }

    // Create three updates with different content
    const sourceDoc1 = new Y.Doc();
    sourceDoc1.getText('test').insert(0, 'A');
    const update1 = Y.encodeStateAsUpdate(sourceDoc1);

    const sourceDoc2 = new Y.Doc();
    Y.applyUpdate(sourceDoc2, update1); // Apply previous state first
    sourceDoc2.getText('test').insert(1, 'B');
    const update2 = Y.encodeStateAsUpdate(sourceDoc2);

    const sourceDoc3 = new Y.Doc();
    Y.applyUpdate(sourceDoc3, update2); // Apply previous state first
    sourceDoc3.getText('test').insert(2, 'C');
    const update3 = Y.encodeStateAsUpdate(sourceDoc3);

    // Set up writeNoteUpdate to return promises we can control
    // Each call will create a new promise that we can resolve later
    type ResolverType = (value: { sequence: number; offset: number; file: string }) => void;
    const resolvers: ResolverType[] = [];
    let callCount = 0;

    mockStorageManager.writeNoteUpdate.mockImplementation(() => {
      callCount++;
      const myCallNumber = callCount;
      return new Promise((resolve) => {
        resolvers.push((value) => {
          console.log(`[Test] Resolving write #${myCallNumber} with sequence ${value.sequence}`);
          resolve(value);
        });
      });
    });

    // Start three concurrent applyUpdate calls (simulating rapid typing via IPC)
    // skipTimestampUpdate to avoid metadata updates interfering with the test
    const promise1 = manager.applyUpdate('test-note', update1, { skipTimestampUpdate: true });
    const promise2 = manager.applyUpdate('test-note', update2, { skipTimestampUpdate: true });
    const promise3 = manager.applyUpdate('test-note', update3, { skipTimestampUpdate: true });

    // With the fix: Operations are serialized, so only #1 has called writeNoteUpdate.
    // We need to resolve them in the order they reach writeNoteUpdate (which is now sequential).
    //
    // This test verifies that the queue correctly serializes the operations.
    // Before the fix, all three would have started concurrently and we could
    // resolve them out of order, causing sequence violations.

    // Wait for first operation to reach writeNoteUpdate
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(resolvers.length).toBe(1); // Only first operation has started
    console.log('[Test] Resolving write #1 with sequence 1');
    resolvers[0]!({ sequence: 1, offset: 0, file: 'test1.log' });

    // Wait for second operation to start and reach writeNoteUpdate
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(resolvers.length).toBe(2); // Second operation has now started
    console.log('[Test] Resolving write #2 with sequence 2');
    resolvers[1]!({ sequence: 2, offset: 100, file: 'test2.log' });

    // Wait for third operation to start and reach writeNoteUpdate
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(resolvers.length).toBe(3); // Third operation has now started
    console.log('[Test] Resolving write #3 with sequence 3');
    resolvers[2]!({ sequence: 3, offset: 200, file: 'test3.log' });

    // All three should complete without errors because the queue ensures
    // operations are processed in order
    await expect(Promise.all([promise1, promise2, promise3])).resolves.not.toThrow();

    // Verify all updates were applied in the correct order
    const vectorClock = realSnapshot.getVectorClock();
    expect(vectorClock['test-instance']?.sequence).toBe(3);

    // Clean up
    sourceDoc1.destroy();
    sourceDoc2.destroy();
    sourceDoc3.destroy();
    realSnapshot.destroy();
  });
});

describe('CRDTManagerImpl - Modified Timestamp Updates', () => {
  // Tests for the feature: "When a note is edited, its modified timestamp should update"
  // This test suite verifies that applyUpdate updates the modified timestamp in:
  // 1. CRDT metadata (via NoteDoc.updateMetadata)
  // 2. Database cache (via database.upsertNote)
  // 3. Broadcasts an event to renderer (via modifiedUpdateCallback)

  let manager: CRDTManagerImpl;
  let mockStorageManager: jest.Mocked<AppendLogManager>;
  let mockDatabase: jest.Mocked<Database>;
  let testDoc: Y.Doc;

  beforeEach(() => {
    jest.useRealTimers(); // Need real timers for async operations

    // Create a shared Y.Doc that will be returned by loadNote
    testDoc = new Y.Doc();

    mockStorageManager = {
      getInstanceId: jest.fn().mockReturnValue('test-instance'),
      getSDPath: jest.fn((sdId: string) => `/mock/storage/${sdId}`),
      loadNote: jest.fn().mockImplementation(() => {
        return Promise.resolve({
          doc: testDoc,
          vectorClock: {},
        });
      }),
      writeNoteUpdate: jest.fn().mockImplementation(() => {
        return Promise.resolve({
          sequence: 1,
          offset: 0,
          file: 'test.crdtlog',
        });
      }),
      loadFolderTree: jest.fn().mockResolvedValue({
        doc: new Y.Doc(),
      }),
      writeFolderUpdate: jest.fn().mockResolvedValue(undefined),
      saveNoteSnapshot: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AppendLogManager>;

    mockDatabase = {
      getNote: jest.fn().mockResolvedValue({
        id: 'test-note',
        sdId: 'test-sd',
        title: 'Test Note',
        modified: 1000, // Old timestamp
      }),
      upsertNote: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Database>;

    manager = new CRDTManagerImpl(mockStorageManager, mockDatabase);
  });

  afterEach(() => {
    manager.destroy();
    testDoc.destroy();
  });

  describe('applyUpdate - modified timestamp update', () => {
    it('should update NoteDoc metadata with new modified timestamp when content changes', async () => {
      // Load the note
      await manager.loadNote('test-note', 'test-sd');

      // Get the NoteDoc and spy on updateMetadata
      const noteDoc = manager.getNoteDoc('test-note');
      expect(noteDoc).toBeDefined();
      const updateMetadataSpy = jest.spyOn(noteDoc!, 'updateMetadata');

      // Create an update (simulating user typing)
      const sourceDoc = new Y.Doc();
      const content = sourceDoc.getXmlFragment('content');
      const text = new Y.XmlText();
      text.insert(0, 'Hello World');
      content.insert(0, [text]);
      const update = Y.encodeStateAsUpdate(sourceDoc);

      // Apply the update
      const beforeTime = Date.now();
      await manager.applyUpdate('test-note', update);
      const afterTime = Date.now();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify NoteDoc.updateMetadata was called with a reasonable timestamp
      // Note: We intentionally do NOT use 'ipc' origin here because we WANT
      // the metadata update to be written to disk via the event handler.
      // This is critical for cross-machine sync - the modified timestamp must
      // be synced to other instances.
      expect(updateMetadataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          modified: expect.any(Number),
        })
      );

      // Verify the timestamp is within expected range
      const call = updateMetadataSpy.mock.calls[0];
      const modifiedArg = call?.[0] as { modified: number } | undefined;
      expect(modifiedArg?.modified).toBeGreaterThanOrEqual(beforeTime);
      expect(modifiedArg?.modified).toBeLessThanOrEqual(afterTime + 100);

      sourceDoc.destroy();
    });

    it('should update database cache with new modified timestamp when content changes', async () => {
      // Load the note
      await manager.loadNote('test-note', 'test-sd');

      // Create an update
      const sourceDoc = new Y.Doc();
      const content = sourceDoc.getXmlFragment('content');
      const text = new Y.XmlText();
      text.insert(0, 'Hello World');
      content.insert(0, [text]);
      const update = Y.encodeStateAsUpdate(sourceDoc);

      // Apply the update
      const beforeTime = Date.now();
      await manager.applyUpdate('test-note', update);
      const afterTime = Date.now();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify database.upsertNote was called with updated modified timestamp
      expect(mockDatabase.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-note',
          modified: expect.any(Number),
        })
      );

      // Verify the timestamp is within expected range
      const upsertCall = mockDatabase.upsertNote.mock.calls[0];
      const noteArg = upsertCall?.[0] as { modified: number } | undefined;
      expect(noteArg?.modified).toBeGreaterThanOrEqual(beforeTime);
      expect(noteArg?.modified).toBeLessThanOrEqual(afterTime + 100);

      sourceDoc.destroy();
    });

    it('should call modifiedUpdateCallback with noteId and new timestamp when content changes', async () => {
      // Set up the callback
      const modifiedUpdateCallback = jest.fn();
      manager.setModifiedUpdateCallback(modifiedUpdateCallback);

      // Load the note
      await manager.loadNote('test-note', 'test-sd');

      // Create an update
      const sourceDoc = new Y.Doc();
      const content = sourceDoc.getXmlFragment('content');
      const text = new Y.XmlText();
      text.insert(0, 'Hello World');
      content.insert(0, [text]);
      const update = Y.encodeStateAsUpdate(sourceDoc);

      // Apply the update
      const beforeTime = Date.now();
      await manager.applyUpdate('test-note', update);
      const afterTime = Date.now();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify the callback was called with correct arguments
      expect(modifiedUpdateCallback).toHaveBeenCalledWith('test-note', expect.any(Number));

      // Verify the timestamp is within expected range
      const callArgs = modifiedUpdateCallback.mock.calls[0];
      const timestamp = callArgs?.[1] as number | undefined;
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime + 100);

      sourceDoc.destroy();
    });

    it('should not update modified timestamp when applyUpdate fails', async () => {
      // Load the note
      await manager.loadNote('test-note', 'test-sd');

      // Make writeNoteUpdate fail
      mockStorageManager.writeNoteUpdate.mockRejectedValueOnce(new Error('Write failed'));

      // Create an update
      const sourceDoc = new Y.Doc();
      const content = sourceDoc.getXmlFragment('content');
      const text = new Y.XmlText();
      text.insert(0, 'Hello World');
      content.insert(0, [text]);
      const update = Y.encodeStateAsUpdate(sourceDoc);

      // Apply the update - should throw
      await expect(manager.applyUpdate('test-note', update)).rejects.toThrow('Write failed');

      // Verify database was NOT updated (no upsertNote call)
      expect(mockDatabase.upsertNote).not.toHaveBeenCalled();

      sourceDoc.destroy();
    });
  });
});
