/**
 * NoteStorageManager Tests
 *
 * Tests for loading and saving notes using the new append-only log format.
 */

/* eslint-disable @typescript-eslint/no-base-to-string */
// Y.Text has a proper toString() method, ESLint just doesn't know about it

import * as Y from 'yjs';
import { NoteStorageManager } from '../note-storage-manager';
import { createLogFile, createSnapshotFile, type VectorClockEntry } from '../binary-format';
import type { FileSystemAdapter, FileStats, NotePaths } from '../types';
import type { NoteSyncState } from '../../database/schema';

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

// Mock database operations for sync state
interface MockDbOperations {
  noteSyncStates: Map<string, NoteSyncState>;
  getNoteSyncState(noteId: string, sdId: string): Promise<NoteSyncState | null>;
  upsertNoteSyncState(state: NoteSyncState): Promise<void>;
}

function createMockDb(): MockDbOperations {
  const noteSyncStates = new Map<string, NoteSyncState>();

  return {
    noteSyncStates,

    async getNoteSyncState(noteId: string, sdId: string): Promise<NoteSyncState | null> {
      const key = `${sdId}:${noteId}`;
      return noteSyncStates.get(key) || null;
    },

    async upsertNoteSyncState(state: NoteSyncState): Promise<void> {
      const key = `${state.sdId}:${state.noteId}`;
      noteSyncStates.set(key, state);
    },
  };
}

// Helper to create a Yjs update
function createYjsUpdate(noteId: string, content: string): { doc: Y.Doc; update: Uint8Array } {
  const doc = new Y.Doc();
  doc.clientID = Math.floor(Math.random() * 1000000);
  const text = doc.getText('content');
  text.insert(0, content);
  const update = Y.encodeStateAsUpdate(doc);
  return { doc, update };
}

// Helper to create note paths
function createNotePaths(sdPath: string, noteId: string): NotePaths {
  return {
    crdt: `${sdPath}/notes/${noteId}/crdt`,
    logs: `${sdPath}/notes/${noteId}/logs`,
    assets: `${sdPath}/notes/${noteId}/assets`,
    snapshots: `${sdPath}/notes/${noteId}/snapshots`,
  };
}

describe('NoteStorageManager', () => {
  const sdId = 'sd-123';
  const sdPath = '/storage/sd-123';
  const noteId = 'note-abc';
  const instanceId = 'inst-xyz';

  describe('loadNote', () => {
    describe('from empty state', () => {
      it('should return empty doc when no files exist', async () => {
        const fs = createMockFs();
        const db = createMockDb();
        const paths = createNotePaths(sdPath, noteId);

        // Create empty directories
        fs.directories.add(paths.logs);
        fs.directories.add(paths.snapshots);

        const manager = new NoteStorageManager(fs, db, instanceId);
        const result = await manager.loadNote(sdId, noteId, paths);

        expect(result.doc).toBeInstanceOf(Y.Doc);
        expect(result.vectorClock).toEqual({});
        expect(Y.encodeStateAsUpdate(result.doc).length).toBeLessThan(10); // Empty doc is small
      });
    });

    describe('from logs only (no snapshot)', () => {
      it('should load note from single log file', async () => {
        const fs = createMockFs();
        const db = createMockDb();
        const paths = createNotePaths(sdPath, noteId);

        // Create a log file with one update
        const { update } = createYjsUpdate(noteId, 'Hello World');
        const timestamp = Date.now();
        const logData = createLogFile([{ timestamp, sequence: 1, data: update }]);

        fs.directories.add(paths.logs);
        fs.directories.add(paths.snapshots);
        fs.files.set(`${paths.logs}/inst-abc_${timestamp}.crdtlog`, logData);

        const manager = new NoteStorageManager(fs, db, instanceId);
        const result = await manager.loadNote(sdId, noteId, paths);

        // Verify the content was loaded
        const text = result.doc.getText('content');
        expect(String(text)).toBe('Hello World');

        // Verify vector clock was built
        expect(result.vectorClock['inst-abc']).toBeDefined();
        expect(result.vectorClock['inst-abc'].sequence).toBe(1);
      });

      it('should load note from multiple log files', async () => {
        const fs = createMockFs();
        const db = createMockDb();
        const paths = createNotePaths(sdPath, noteId);

        // Create first log file
        const doc1 = new Y.Doc();
        doc1.clientID = 1;
        const text1 = doc1.getText('content');
        text1.insert(0, 'Hello');
        const update1 = Y.encodeStateAsUpdate(doc1);
        const timestamp1 = 1000;
        const logData1 = createLogFile([{ timestamp: timestamp1, sequence: 1, data: update1 }]);

        // Create second log file (from different instance)
        const doc2 = new Y.Doc();
        doc2.clientID = 2;
        Y.applyUpdate(doc2, update1); // Apply first update
        const text2 = doc2.getText('content');
        text2.insert(5, ' World');
        const update2 = Y.encodeStateAsUpdate(doc2, Y.encodeStateVector(doc1));
        const timestamp2 = 2000;
        const logData2 = createLogFile([{ timestamp: timestamp2, sequence: 1, data: update2 }]);

        fs.directories.add(paths.logs);
        fs.directories.add(paths.snapshots);
        fs.files.set(`${paths.logs}/inst-a_${timestamp1}.crdtlog`, logData1);
        fs.files.set(`${paths.logs}/inst-b_${timestamp2}.crdtlog`, logData2);

        const manager = new NoteStorageManager(fs, db, instanceId);
        const result = await manager.loadNote(sdId, noteId, paths);

        // Verify merged content
        const text = result.doc.getText('content');
        expect(String(text)).toBe('Hello World');

        // Both instances should be in vector clock
        expect(result.vectorClock['inst-a']).toBeDefined();
        expect(result.vectorClock['inst-b']).toBeDefined();
      });
    });

    describe('from snapshot + logs', () => {
      it('should load from snapshot and apply subsequent logs', async () => {
        const fs = createMockFs();
        const db = createMockDb();
        const paths = createNotePaths(sdPath, noteId);

        // Create initial doc state for snapshot
        const initialDoc = new Y.Doc();
        initialDoc.clientID = 1;
        const initialText = initialDoc.getText('content');
        initialText.insert(0, 'Initial');
        const initialState = Y.encodeStateAsUpdate(initialDoc);

        // Create snapshot (timestamp 1000)
        const snapshotVectorClock: VectorClockEntry[] = [
          { instanceId: 'inst-a', sequence: 1, offset: 100, filename: 'inst-a_1000.crdtlog' },
        ];
        const snapshotData = createSnapshotFile(snapshotVectorClock, initialState, true);

        // Create log file with updates AFTER snapshot (timestamp 2000)
        const laterDoc = new Y.Doc();
        laterDoc.clientID = 2;
        Y.applyUpdate(laterDoc, initialState);
        const laterText = laterDoc.getText('content');
        laterText.insert(7, ' Content');
        const laterUpdate = Y.encodeStateAsUpdate(laterDoc, Y.encodeStateVector(initialDoc));
        const logData = createLogFile([{ timestamp: 2000, sequence: 1, data: laterUpdate }]);

        fs.directories.add(paths.logs);
        fs.directories.add(paths.snapshots);
        fs.files.set(`${paths.snapshots}/inst-a_1000.snapshot`, snapshotData);
        fs.files.set(`${paths.logs}/inst-b_2000.crdtlog`, logData);

        const manager = new NoteStorageManager(fs, db, instanceId);
        const result = await manager.loadNote(sdId, noteId, paths);

        // Verify content includes both snapshot and log updates
        const text = result.doc.getText('content');
        expect(String(text)).toBe('Initial Content');
      });

      it('should skip log records already covered by snapshot vector clock', async () => {
        const fs = createMockFs();
        const db = createMockDb();
        const paths = createNotePaths(sdPath, noteId);

        // Create doc with two updates
        const doc = new Y.Doc();
        doc.clientID = 1;
        const text = doc.getText('content');
        text.insert(0, 'Hello');
        const update1 = Y.encodeStateAsUpdate(doc);
        text.insert(5, ' World');
        const fullState = Y.encodeStateAsUpdate(doc);

        // Snapshot includes both updates (sequence 2)
        const snapshotVectorClock: VectorClockEntry[] = [
          { instanceId: 'inst-a', sequence: 2, offset: 200, filename: 'inst-a_1000.crdtlog' },
        ];
        const snapshotData = createSnapshotFile(snapshotVectorClock, fullState, true);

        // Log file has both records (but snapshot already has them)
        const logData = createLogFile([
          { timestamp: 1000, sequence: 1, data: update1 },
          {
            timestamp: 1001,
            sequence: 2,
            data: Y.encodeStateAsUpdate(doc, Y.encodeStateVector(doc)),
          },
        ]);

        fs.directories.add(paths.logs);
        fs.directories.add(paths.snapshots);
        fs.files.set(`${paths.snapshots}/inst-a_2000.snapshot`, snapshotData);
        fs.files.set(`${paths.logs}/inst-a_1000.crdtlog`, logData);

        const manager = new NoteStorageManager(fs, db, instanceId);
        const result = await manager.loadNote(sdId, noteId, paths);

        // Content should be correct (no double-application issues)
        const resultText = result.doc.getText('content');
        expect(String(resultText)).toBe('Hello World');
      });
    });

    describe('from cached DB state (fast path)', () => {
      it('should load from DB cache when available', async () => {
        const fs = createMockFs();
        const db = createMockDb();
        const paths = createNotePaths(sdPath, noteId);

        // Create cached state in DB
        const doc = new Y.Doc();
        doc.clientID = 1;
        const text = doc.getText('content');
        text.insert(0, 'Cached Content');
        const documentState = Y.encodeStateAsUpdate(doc);

        const vectorClock = {
          'inst-a': { sequence: 5, offset: 500, file: 'inst-a_1000.crdtlog' },
        };

        db.noteSyncStates.set(`${sdId}:${noteId}`, {
          noteId,
          sdId,
          vectorClock: JSON.stringify(vectorClock),
          documentState,
          updatedAt: Date.now(),
        });

        fs.directories.add(paths.logs);
        fs.directories.add(paths.snapshots);

        const manager = new NoteStorageManager(fs, db, instanceId);
        const result = await manager.loadNoteFromCache(sdId, noteId, paths);

        expect(result).not.toBeNull();
        const resultText = result!.doc.getText('content');
        expect(String(resultText)).toBe('Cached Content');
        expect(result!.vectorClock).toEqual(vectorClock);
      });

      it('should return null when no cache exists', async () => {
        const fs = createMockFs();
        const db = createMockDb();
        const paths = createNotePaths(sdPath, noteId);

        fs.directories.add(paths.logs);
        fs.directories.add(paths.snapshots);

        const manager = new NoteStorageManager(fs, db, instanceId);
        const result = await manager.loadNoteFromCache(sdId, noteId, paths);

        expect(result).toBeNull();
      });

      it('should apply new log records on top of cache', async () => {
        const fs = createMockFs();
        const db = createMockDb();
        const paths = createNotePaths(sdPath, noteId);

        // Create cached state (from an OLD log file)
        const cachedDoc = new Y.Doc();
        cachedDoc.clientID = 1;
        const cachedText = cachedDoc.getText('content');
        cachedText.insert(0, 'Cached');
        const cachedState = Y.encodeStateAsUpdate(cachedDoc);

        // Cache references an older file that no longer exists
        // This simulates: cache was created, then a NEW log file was written
        const cachedVectorClock = {
          'inst-a': { sequence: 1, offset: 100, file: 'inst-a_500.crdtlog' },
        };

        db.noteSyncStates.set(`${sdId}:${noteId}`, {
          noteId,
          sdId,
          vectorClock: JSON.stringify(cachedVectorClock),
          documentState: cachedState,
          updatedAt: Date.now(),
        });

        // Create a NEWER log file with additional records
        const newDoc = new Y.Doc();
        newDoc.clientID = 2; // Different client to avoid conflicts
        Y.applyUpdate(newDoc, cachedState);
        const newText = newDoc.getText('content');
        newText.insert(6, ' + New');
        const newUpdate = Y.encodeStateAsUpdate(newDoc, Y.encodeStateVector(cachedDoc));

        // This file is newer than what's in cache (1000 > 500)
        const logData = createLogFile([{ timestamp: 1000, sequence: 1, data: newUpdate }]);

        fs.directories.add(paths.logs);
        fs.directories.add(paths.snapshots);
        fs.files.set(`${paths.logs}/inst-b_1000.crdtlog`, logData);

        const manager = new NoteStorageManager(fs, db, instanceId);
        const result = await manager.loadNoteFromCache(sdId, noteId, paths);

        expect(result).not.toBeNull();
        const resultText = result!.doc.getText('content');
        expect(String(resultText)).toBe('Cached + New');
      });
    });
  });

  describe('saveUpdate', () => {
    it('should append update to log file', async () => {
      const fs = createMockFs();
      const db = createMockDb();
      const paths = createNotePaths(sdPath, noteId);

      fs.directories.add(paths.logs);
      fs.directories.add(paths.snapshots);

      const manager = new NoteStorageManager(fs, db, instanceId);

      // Create an update to save
      const { update } = createYjsUpdate(noteId, 'New content');

      await manager.saveUpdate(sdId, noteId, paths, update);

      // Verify a log file was created
      const logFiles = await fs.listFiles(paths.logs);
      expect(logFiles.length).toBe(1);
      expect(logFiles[0]).toMatch(new RegExp(`^${instanceId}_\\d+\\.crdtlog$`));
    });

    it('should append multiple updates to same log file', async () => {
      const fs = createMockFs();
      const db = createMockDb();
      const paths = createNotePaths(sdPath, noteId);

      fs.directories.add(paths.logs);
      fs.directories.add(paths.snapshots);

      const manager = new NoteStorageManager(fs, db, instanceId);

      // Save multiple updates
      const { update: update1 } = createYjsUpdate(noteId, 'First');
      const { update: update2 } = createYjsUpdate(noteId, 'Second');

      await manager.saveUpdate(sdId, noteId, paths, update1);
      await manager.saveUpdate(sdId, noteId, paths, update2);

      // Should still be one log file (appended)
      const logFiles = await fs.listFiles(paths.logs);
      expect(logFiles.length).toBe(1);
    });

    it('should increment sequence number for each update', async () => {
      const fs = createMockFs();
      const db = createMockDb();
      const paths = createNotePaths(sdPath, noteId);

      fs.directories.add(paths.logs);
      fs.directories.add(paths.snapshots);

      const manager = new NoteStorageManager(fs, db, instanceId);

      // Save updates and track sequence
      const { update: update1 } = createYjsUpdate(noteId, 'First');
      const { update: update2 } = createYjsUpdate(noteId, 'Second');

      const result1 = await manager.saveUpdate(sdId, noteId, paths, update1);
      const result2 = await manager.saveUpdate(sdId, noteId, paths, update2);

      expect(result1.sequence).toBe(1);
      expect(result2.sequence).toBe(2);
    });
  });

  describe('saveDbSnapshot', () => {
    it('should save document state to database', async () => {
      const fs = createMockFs();
      const db = createMockDb();
      const paths = createNotePaths(sdPath, noteId);

      fs.directories.add(paths.logs);
      fs.directories.add(paths.snapshots);

      const manager = new NoteStorageManager(fs, db, instanceId);

      // Create a doc to snapshot
      const doc = new Y.Doc();
      const text = doc.getText('content');
      text.insert(0, 'Snapshot content');

      const vectorClock = {
        'inst-a': { sequence: 5, offset: 500, file: 'inst-a_1000.crdtlog' },
      };

      await manager.saveDbSnapshot(sdId, noteId, doc, vectorClock);

      // Verify it was saved to DB
      const saved = await db.getNoteSyncState(noteId, sdId);
      expect(saved).not.toBeNull();
      expect(JSON.parse(saved!.vectorClock)).toEqual(vectorClock);

      // Verify document state can be loaded
      const loadedDoc = new Y.Doc();
      Y.applyUpdate(loadedDoc, saved!.documentState);
      expect(String(loadedDoc.getText('content'))).toBe('Snapshot content');
    });

    it('should update existing snapshot', async () => {
      const fs = createMockFs();
      const db = createMockDb();
      const paths = createNotePaths(sdPath, noteId);

      fs.directories.add(paths.logs);
      fs.directories.add(paths.snapshots);

      const manager = new NoteStorageManager(fs, db, instanceId);

      // Save initial snapshot
      const doc1 = new Y.Doc();
      doc1.getText('content').insert(0, 'Initial');
      await manager.saveDbSnapshot(sdId, noteId, doc1, {
        'inst-a': { sequence: 1, offset: 100, file: 'f1' },
      });

      // Update snapshot
      const doc2 = new Y.Doc();
      doc2.getText('content').insert(0, 'Updated');
      await manager.saveDbSnapshot(sdId, noteId, doc2, {
        'inst-a': { sequence: 2, offset: 200, file: 'f2' },
      });

      // Verify only latest is stored
      const saved = await db.getNoteSyncState(noteId, sdId);
      const loadedDoc = new Y.Doc();
      Y.applyUpdate(loadedDoc, saved!.documentState);
      expect(String(loadedDoc.getText('content'))).toBe('Updated');
      expect(
        (JSON.parse(saved!.vectorClock) as Record<string, { sequence: number }>)['inst-a'].sequence
      ).toBe(2);
    });
  });

  describe('getLogWriter', () => {
    it('should return same LogWriter for same note', async () => {
      const fs = createMockFs();
      const db = createMockDb();
      const paths = createNotePaths(sdPath, noteId);

      fs.directories.add(paths.logs);

      const manager = new NoteStorageManager(fs, db, instanceId);

      const writer1 = manager.getLogWriter(noteId, paths);
      const writer2 = manager.getLogWriter(noteId, paths);

      expect(writer1).toBe(writer2);
    });

    it('should return different LogWriters for different notes', async () => {
      const fs = createMockFs();
      const db = createMockDb();
      const paths1 = createNotePaths(sdPath, 'note-1');
      const paths2 = createNotePaths(sdPath, 'note-2');

      fs.directories.add(paths1.logs);
      fs.directories.add(paths2.logs);

      const manager = new NoteStorageManager(fs, db, instanceId);

      const writer1 = manager.getLogWriter('note-1', paths1);
      const writer2 = manager.getLogWriter('note-2', paths2);

      expect(writer1).not.toBe(writer2);
    });
  });

  describe('vector clock offset calculation', () => {
    it('should set offset to exact next record position (not approximate)', async () => {
      const fs = createMockFs();
      const db = createMockDb();
      const paths = createNotePaths(sdPath, noteId);

      // Create multiple updates with varying data sizes to ensure
      // the offset calculation is exact, not approximated
      const doc1 = new Y.Doc();
      doc1.clientID = 1;
      doc1.getText('content').insert(0, 'Short');
      const update1 = Y.encodeStateAsUpdate(doc1);

      const doc2 = new Y.Doc();
      doc2.clientID = 1;
      Y.applyUpdate(doc2, update1);
      doc2.getText('content').insert(5, ' with more content added here');
      const update2 = Y.encodeStateAsUpdate(doc2, Y.encodeStateVector(doc1));

      const doc3 = new Y.Doc();
      doc3.clientID = 1;
      Y.applyUpdate(doc3, Y.encodeStateAsUpdate(doc2));
      doc3.getText('content').insert(0, 'Prefix: ');
      const update3 = Y.encodeStateAsUpdate(doc3, Y.encodeStateVector(doc2));

      // Create a log file with 3 records
      const logData = createLogFile([
        { timestamp: 1000, sequence: 1, data: update1 },
        { timestamp: 1001, sequence: 2, data: update2 },
        { timestamp: 1002, sequence: 3, data: update3 },
      ]);

      fs.directories.add(paths.logs);
      fs.directories.add(paths.snapshots);
      fs.files.set(`${paths.logs}/inst-test_1000.crdtlog`, logData);

      const manager = new NoteStorageManager(fs, db, instanceId);
      const result = await manager.loadNote(sdId, noteId, paths);

      // The vector clock offset should be exactly at the end of the file
      // (after the last record), not an approximation
      const clockEntry = result.vectorClock['inst-test'];
      expect(clockEntry).toBeDefined();
      expect(clockEntry.sequence).toBe(3);

      // The offset should equal the file length (no termination sentinel)
      // This verifies the offset calculation is exact, not using approximation like +20
      expect(clockEntry.offset).toBe(logData.length);
    });

    it('should calculate correct offset for incremental reads', async () => {
      const fs = createMockFs();
      const db = createMockDb();
      const paths = createNotePaths(sdPath, noteId);

      // Create a log file with records
      const doc = new Y.Doc();
      doc.clientID = 1;
      const text = doc.getText('content');
      text.insert(0, 'Initial');
      const update1 = Y.encodeStateAsUpdate(doc);
      text.insert(7, ' content');
      const update2 = Y.encodeStateAsUpdate(doc, Y.encodeStateVector(doc));

      const logData1 = createLogFile([{ timestamp: 1000, sequence: 1, data: update1 }]);

      fs.directories.add(paths.logs);
      fs.directories.add(paths.snapshots);
      fs.files.set(`${paths.logs}/inst-test_1000.crdtlog`, logData1);

      const manager = new NoteStorageManager(fs, db, instanceId);

      // First load - reads first record
      const result1 = await manager.loadNote(sdId, noteId, paths);

      // Append a second record to the same file
      const logData2 = createLogFile([
        { timestamp: 1000, sequence: 1, data: update1 },
        { timestamp: 1001, sequence: 2, data: update2 },
      ]);
      fs.files.set(`${paths.logs}/inst-test_1000.crdtlog`, logData2);

      // Save the first load's state to cache, then load incrementally
      await manager.saveDbSnapshot(sdId, noteId, result1.doc, result1.vectorClock);

      // Verify the cached offset is correct by loading from cache
      // If the offset was wrong (like the old +20 approximation), this would fail
      // because it would try to read from the middle of a record
      const result2 = await manager.loadNoteFromCache(sdId, noteId, paths);
      expect(result2).not.toBeNull();
      expect(result2!.vectorClock['inst-test'].sequence).toBe(2);

      // The new offset should be at the end of the expanded file
      expect(result2!.vectorClock['inst-test'].offset).toBe(logData2.length);
    });
  });

  describe('finalize', () => {
    it('should finalize all log writers', async () => {
      const fs = createMockFs();
      const db = createMockDb();
      const paths1 = createNotePaths(sdPath, 'note-1');
      const paths2 = createNotePaths(sdPath, 'note-2');

      fs.directories.add(paths1.logs);
      fs.directories.add(paths2.logs);

      const manager = new NoteStorageManager(fs, db, instanceId);

      // Create writers by saving updates
      const { update: update1 } = createYjsUpdate('note-1', 'Content 1');
      const { update: update2 } = createYjsUpdate('note-2', 'Content 2');

      await manager.saveUpdate(sdId, 'note-1', paths1, update1);
      await manager.saveUpdate(sdId, 'note-2', paths2, update2);

      // Finalize all
      await manager.finalize();

      // After finalization, log files should have termination sentinel
      // (We can verify by checking that new writes would create new files)
      // For now, just verify no errors occurred
    });
  });
});
