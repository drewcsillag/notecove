/**
 * Tests for UpdateStore
 * Critical: These tests verify data integrity for multi-instance sync
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateStore, ImmediateFlushStrategy, CountFlushStrategy } from '../../src/lib/update-store.js';
import * as Y from 'yjs';

// Mock file storage
class MockFileStorage {
  constructor() {
    this.files = new Map();
    this.isElectron = true;
    this.notesPath = '/test/notes';
  }

  async writeFile(path, content) {
    this.files.set(path, content);
    return { success: true };
  }

  async readFile(path) {
    const content = this.files.get(path);
    if (content === undefined) {
      return { success: false, error: 'File not found' };
    }
    return { success: true, content };
  }

  async exists(path) {
    return this.files.has(path);
  }

  async mkdir(path) {
    // Mock - just track that it was called
    return { success: true };
  }

  async readDir(path) {
    const files = Array.from(this.files.keys())
      .filter(f => f.startsWith(path + '/'))
      .map(f => f.substring(path.length + 1));
    return { success: files.length > 0, files };
  }
}

// Setup global mock
function setupMocks(fileStorage) {
  global.window = {
    electronAPI: {
      fileSystem: {
        writeFile: (path, content) => fileStorage.writeFile(path, content),
        readFile: (path) => fileStorage.readFile(path),
        exists: (path) => fileStorage.exists(path),
        mkdir: (path) => fileStorage.mkdir(path),
        readDir: (path) => fileStorage.readDir(path)
      }
    }
  };
}

describe('UpdateStore', () => {
  let fileStorage;
  let store;
  const noteId = 'test-note-123';
  const instanceId = 'instance-A';

  beforeEach(() => {
    fileStorage = new MockFileStorage();
    setupMocks(fileStorage);
    store = new UpdateStore(fileStorage, instanceId);
  });

  describe('Initialization', () => {
    it('should initialize with empty state for new note', async () => {
      await store.initialize(noteId);
      expect(store.getNoteState(noteId).writeCounter).toBe(0);
      expect(store.getNoteState(noteId).seen.size).toBe(0);
    });

    it('should load existing state from meta file', async () => {
      const meta = {
        instanceId: 'instance-A',
        lastWrite: 5,
        seen: { 'instance-A': 5, 'instance-B': 3 },
        lastUpdated: new Date().toISOString()
      };

      await fileStorage.writeFile(
        '/test/notes/test-note-123/meta/instance-A.json',
        JSON.stringify(meta)
      );

      await store.initialize(noteId);
      expect(store.getNoteState(noteId).writeCounter).toBe(5);
      expect(store.getNoteState(noteId).seen.get('instance-A')).toBe(5);
      expect(store.getNoteState(noteId).seen.get('instance-B')).toBe(3);
    });
  });

  describe('Writing Updates', () => {
    beforeEach(async () => {
      await store.initialize(noteId);
    });

    it('should buffer updates and flush on idle', async () => {
      const update1 = new Uint8Array([1, 2, 3]);
      const update2 = new Uint8Array([4, 5, 6]);

      await store.addUpdate(noteId, update1);
      await store.addUpdate(noteId, update2);

      // Should be buffered, not flushed yet
      expect(store.getNoteState(noteId).pendingUpdates.length).toBe(2);

      // Force flush
      await store.flush(noteId);

      // Check file was written
      const updatePath = '/test/notes/test-note-123/updates/instance-A.000001-000002.yjson';
      expect(fileStorage.files.has(updatePath)).toBe(true);

      // Verify content
      const fileContent = JSON.parse(fileStorage.files.get(updatePath));
      expect(fileContent.instance).toBe('instance-A');
      expect(fileContent.sequence).toEqual([1, 2]);
      expect(fileContent.updates.length).toBe(2);

      // Check meta was updated
      const metaPath = '/test/notes/test-note-123/meta/instance-A.json';
      const meta = JSON.parse(fileStorage.files.get(metaPath));
      expect(meta.lastWrite).toBe(2);
      expect(meta.seen['instance-A']).toBe(2);
    });

    it('should flush immediately with ImmediateFlushStrategy', async () => {
      store = new UpdateStore(fileStorage, instanceId, {
        flushStrategy: new ImmediateFlushStrategy()
      });
      await store.initialize(noteId);

      const update = new Uint8Array([1, 2, 3]);
      await store.addUpdate(noteId, update);

      // Should flush immediately
      const updatePath = '/test/notes/test-note-123/updates/instance-A.000001.yjson';
      expect(fileStorage.files.has(updatePath)).toBe(true);
    });

    it('should flush after N updates with CountFlushStrategy', async () => {
      store = new UpdateStore(fileStorage, instanceId, {
        flushStrategy: new CountFlushStrategy(3)
      });
      await store.initialize(noteId);

      await store.addUpdate(noteId, new Uint8Array([1]));
      await store.addUpdate(noteId, new Uint8Array([2]));
      expect(store.getNoteState(noteId).pendingUpdates.length).toBe(2);

      await store.addUpdate(noteId, new Uint8Array([3]));

      // Should auto-flush after 3 updates
      expect(store.getNoteState(noteId).pendingUpdates.length).toBe(0);
      const updatePath = '/test/notes/test-note-123/updates/instance-A.000001-000003.yjson';
      expect(fileStorage.files.has(updatePath)).toBe(true);
    });

    it('should handle multiple flush cycles correctly', async () => {
      store = new UpdateStore(fileStorage, instanceId, {
        flushStrategy: new CountFlushStrategy(2)
      });
      await store.initialize(noteId);

      // First batch
      await store.addUpdate(noteId, new Uint8Array([1]));
      await store.addUpdate(noteId, new Uint8Array([2]));

      const file1 = '/test/notes/test-note-123/updates/instance-A.000001-000002.yjson';
      expect(fileStorage.files.has(file1)).toBe(true);

      // Second batch
      await store.addUpdate(noteId, new Uint8Array([3]));
      await store.addUpdate(noteId, new Uint8Array([4]));

      const file2 = '/test/notes/test-note-123/updates/instance-A.000003-000004.yjson';
      expect(fileStorage.files.has(file2)).toBe(true);

      // Verify sequence numbers are correct
      const content1 = JSON.parse(fileStorage.files.get(file1));
      const content2 = JSON.parse(fileStorage.files.get(file2));
      expect(content1.sequence).toEqual([1, 2]);
      expect(content2.sequence).toEqual([3, 4]);
    });

    it('should encode/decode updates correctly', async () => {
      const originalUpdate = new Uint8Array([1, 2, 3, 255, 0, 128]);

      await store.addUpdate(noteId, originalUpdate);
      await store.flush(noteId);

      const updatePath = '/test/notes/test-note-123/updates/instance-A.000001.yjson';
      const fileContent = JSON.parse(fileStorage.files.get(updatePath));

      const decodedUpdate = store.decodeUpdate(fileContent.updates[0]);
      expect(decodedUpdate).toEqual(originalUpdate);
    });
  });

  describe('Reading Updates', () => {
    beforeEach(async () => {
      await store.initialize(noteId);
    });

    it('should read new updates from other instances', async () => {
      // Simulate instance-B writing updates
      const instanceBStore = new UpdateStore(fileStorage, 'instance-B');
      await instanceBStore.initialize(noteId);

      await instanceBStore.addUpdate(noteId, new Uint8Array([10, 20]));
      await instanceBStore.addUpdate(noteId, new Uint8Array([30, 40]));
      await instanceBStore.flush(noteId);

      // instance-A reads updates
      const newUpdates = await store.readNewUpdates(noteId);

      expect(newUpdates.length).toBe(2);
      expect(newUpdates[0].instanceId).toBe('instance-B');
      expect(newUpdates[0].sequence).toBe(1);
      expect(newUpdates[1].sequence).toBe(2);

      // Verify we marked them as seen
      expect(store.getNoteState(noteId).seen.get('instance-B')).toBe(2);
    });

    it('should only read updates we haven\'t seen', async () => {
      const instanceBStore = new UpdateStore(fileStorage, 'instance-B');
      await instanceBStore.initialize(noteId);

      // Write 4 updates
      await instanceBStore.addUpdate(noteId, new Uint8Array([1]));
      await instanceBStore.addUpdate(noteId, new Uint8Array([2]));
      await instanceBStore.flush(noteId);

      await instanceBStore.addUpdate(noteId, new Uint8Array([3]));
      await instanceBStore.addUpdate(noteId, new Uint8Array([4]));
      await instanceBStore.flush(noteId);

      // Read first batch
      let newUpdates = await store.readNewUpdates(noteId);
      expect(newUpdates.length).toBe(4);
      expect(store.getNoteState(noteId).seen.get('instance-B')).toBe(4);

      // Write more updates
      await instanceBStore.addUpdate(noteId, new Uint8Array([5]));
      await instanceBStore.flush(noteId);

      // Read again - should only get new update
      newUpdates = await store.readNewUpdates(noteId);
      expect(newUpdates.length).toBe(1);
      expect(newUpdates[0].sequence).toBe(5);
      expect(store.getNoteState(noteId).seen.get('instance-B')).toBe(5);
    });

    it('should handle partial reads from packed files', async () => {
      const instanceBStore = new UpdateStore(fileStorage, 'instance-B');
      await instanceBStore.initialize(noteId);

      // Write 5 updates in one file
      for (let i = 1; i <= 5; i++) {
        await instanceBStore.addUpdate(noteId, new Uint8Array([i]));
      }
      await instanceBStore.flush(noteId);

      // Manually mark that we've seen updates 1-3
      store.getNoteState(noteId).seen.set('instance-B', 3);

      // Read - should only get 4 and 5
      const newUpdates = await store.readNewUpdates(noteId);
      expect(newUpdates.length).toBe(2);
      expect(newUpdates[0].sequence).toBe(4);
      expect(newUpdates[1].sequence).toBe(5);
    });

    it('should read from multiple instances correctly', async () => {
      const instanceB = new UpdateStore(fileStorage, 'instance-B');
      const instanceC = new UpdateStore(fileStorage, 'instance-C');

      await instanceB.initialize(noteId);
      await instanceC.initialize(noteId);

      // Instance B writes
      await instanceB.addUpdate(noteId, new Uint8Array([1]));
      await instanceB.flush(noteId);

      // Instance C writes
      await instanceC.addUpdate(noteId, new Uint8Array([2]));
      await instanceC.flush(noteId);

      // Instance A reads all
      const newUpdates = await store.readNewUpdates(noteId);

      expect(newUpdates.length).toBe(2);
      expect(newUpdates.find(u => u.instanceId === 'instance-B')).toBeTruthy();
      expect(newUpdates.find(u => u.instanceId === 'instance-C')).toBeTruthy();
    });
  });

  describe('Multi-instance Scenarios', () => {
    it('should handle concurrent writes without conflicts', async () => {
      const instanceA = new UpdateStore(fileStorage, 'instance-A');
      const instanceB = new UpdateStore(fileStorage, 'instance-B');

      await instanceA.initialize(noteId);
      await instanceB.initialize(noteId);

      // Both write simultaneously
      await instanceA.addUpdate(noteId, new Uint8Array([1, 2, 3]));
      await instanceB.addUpdate(noteId, new Uint8Array([4, 5, 6]));

      await Promise.all([
        instanceA.flush(noteId),
        instanceB.flush(noteId)
      ]);

      // Both should succeed - no conflicts
      expect(fileStorage.files.has('/test/notes/test-note-123/updates/instance-A.000001.yjson')).toBe(true);
      expect(fileStorage.files.has('/test/notes/test-note-123/updates/instance-B.000001.yjson')).toBe(true);
      expect(fileStorage.files.has('/test/notes/test-note-123/meta/instance-A.json')).toBe(true);
      expect(fileStorage.files.has('/test/notes/test-note-123/meta/instance-B.json')).toBe(true);
    });

    it('should maintain correct sequence numbers across restarts', async () => {
      const instanceA = new UpdateStore(fileStorage, 'instance-A');
      await instanceA.initialize(noteId);

      await instanceA.addUpdate(noteId, new Uint8Array([1]));
      await instanceA.addUpdate(noteId, new Uint8Array([2]));
      await instanceA.flush(noteId);

      // Simulate restart
      const instanceA2 = new UpdateStore(fileStorage, 'instance-A');
      await instanceA2.initialize(noteId);

      expect(instanceA2.getNoteState(noteId).writeCounter).toBe(2);

      await instanceA2.addUpdate(noteId, new Uint8Array([3]));
      await instanceA2.flush(noteId);

      const file = '/test/notes/test-note-123/updates/instance-A.000003.yjson';
      expect(fileStorage.files.has(file)).toBe(true);

      const content = JSON.parse(fileStorage.files.get(file));
      expect(content.sequence).toEqual([3, 3]);
    });
  });

  describe('Yjs Integration', () => {
    it('should correctly sync real Yjs documents', async () => {
      // Create two Yjs documents (simulating two instances)
      const docA = new Y.Doc();
      const docB = new Y.Doc();

      const textA = docA.getText('content');
      const textB = docB.getText('content');

      // Instance A: Write "Hello"
      textA.insert(0, 'Hello');
      const updateA1 = Y.encodeStateAsUpdate(docA);

      // Instance B: independently writes "World"
      textB.insert(0, 'World');
      const updateB1 = Y.encodeStateAsUpdate(docB);

      // Store updates
      const storeA = new UpdateStore(fileStorage, 'instance-A');
      const storeB = new UpdateStore(fileStorage, 'instance-B');

      await storeA.initialize(noteId);
      await storeB.initialize(noteId);

      await storeA.addUpdate(noteId, updateA1);
      await storeB.addUpdate(noteId, updateB1);

      await storeA.flush(noteId);
      await storeB.flush(noteId);

      // Instance A reads B's updates
      const newUpdatesForA = await storeA.readNewUpdates(noteId);
      for (const { update } of newUpdatesForA) {
        Y.applyUpdate(docA, update);
      }

      // Instance B reads A's updates
      const newUpdatesForB = await storeB.readNewUpdates(noteId);
      for (const { update } of newUpdatesForB) {
        Y.applyUpdate(docB, update);
      }

      // Both should have merged content
      const contentA = textA.toString();
      const contentB = textB.toString();

      expect(contentA).toBe(contentB);
      // Yjs will merge these deterministically
      expect(contentA.includes('Hello')).toBe(true);
      expect(contentA.includes('World')).toBe(true);
    });

    it('should handle complex Yjs operations correctly', async () => {
      const docA = new Y.Doc();
      const docB = new Y.Doc();
      const docC = new Y.Doc();

      const textA = docA.getText('content');
      const textB = docB.getText('content');
      const textC = docC.getText('content');

      // Setup stores
      const storeA = new UpdateStore(fileStorage, 'instance-A', {
        flushStrategy: new ImmediateFlushStrategy()
      });
      const storeB = new UpdateStore(fileStorage, 'instance-B', {
        flushStrategy: new ImmediateFlushStrategy()
      });
      const storeC = new UpdateStore(fileStorage, 'instance-C', {
        flushStrategy: new ImmediateFlushStrategy()
      });

      await storeA.initialize(noteId);
      await storeB.initialize(noteId);
      await storeC.initialize(noteId);

      // Complex editing sequence
      // A: Insert "Hello"
      textA.insert(0, 'Hello');
      await storeA.addUpdate(noteId, Y.encodeStateAsUpdate(docA));

      // B: Reads A, then adds " World"
      let updates = await storeB.readNewUpdates(noteId);
      for (const { update } of updates) {
        Y.applyUpdate(docB, update);
      }
      textB.insert(textB.length, ' World');
      await storeB.addUpdate(noteId, Y.encodeStateAsUpdate(docB));

      // C: Starts fresh, should get both updates
      updates = await storeC.readNewUpdates(noteId);
      for (const { update } of updates) {
        Y.applyUpdate(docC, update);
      }

      // C should have "Hello World"
      expect(textC.toString()).toBe('Hello World');

      // A reads B's update
      updates = await storeA.readNewUpdates(noteId);
      for (const { update } of updates) {
        Y.applyUpdate(docA, update);
      }

      // All three should be in sync
      expect(textA.toString()).toBe('Hello World');
      expect(textB.toString()).toBe('Hello World');
      expect(textC.toString()).toBe('Hello World');
    });
  });

  describe('Data Integrity', () => {
    it('should not lose data when flush fails', async () => {
      await store.initialize(noteId);

      // Add updates
      await store.addUpdate(noteId, new Uint8Array([1, 2, 3]));
      expect(store.getNoteState(noteId).pendingUpdates.length).toBe(1);

      // Mock a write failure
      const originalWriteFile = fileStorage.writeFile;
      fileStorage.writeFile = async () => ({ success: false, error: 'Disk full' });

      const result = await store.flush(noteId);
      expect(result).toBe(false);

      // Updates should still be in buffer
      expect(store.getNoteState(noteId).pendingUpdates.length).toBe(1);

      // Restore and retry
      fileStorage.writeFile = originalWriteFile;
      const retryResult = await store.flush(noteId);
      expect(retryResult).toBe(true);
      expect(store.getNoteState(noteId).pendingUpdates.length).toBe(0);
    });

    it('should handle corrupted meta file gracefully', async () => {
      // Write corrupted meta file
      await fileStorage.writeFile(
        '/test/notes/test-note-123/meta/instance-A.json',
        'invalid json {'
      );

      // Should not throw, should initialize with defaults
      await expect(store.initialize(noteId)).resolves.not.toThrow();
      expect(store.getNoteState(noteId).writeCounter).toBe(0);
      expect(store.getNoteState(noteId).seen.size).toBe(0);
    });

    it('should handle corrupted update file gracefully', async () => {
      await store.initialize(noteId);

      // Write corrupted update file
      await fileStorage.writeFile(
        '/test/notes/test-note-123/updates/instance-B.000001.yjson',
        'invalid json {'
      );

      // Should not throw, should skip corrupted file
      const updates = await store.readNewUpdates(noteId);
      expect(updates.length).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should flush pending updates on cleanup', async () => {
      await store.initialize(noteId);

      await store.addUpdate(noteId, new Uint8Array([1, 2, 3]));
      expect(store.getNoteState(noteId).pendingUpdates.length).toBe(1);

      await store.cleanup(noteId);

      expect(store.getNoteState(noteId).pendingUpdates.length).toBe(0);
      const updatePath = '/test/notes/test-note-123/updates/instance-A.000001.yjson';
      expect(fileStorage.files.has(updatePath)).toBe(true);
    });
  });
});
