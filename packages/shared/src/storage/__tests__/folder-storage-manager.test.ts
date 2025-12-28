/**
 * FolderStorageManager Tests
 *
 * Tests for loading and saving folder trees using the new append-only log format.
 */

import * as Y from 'yjs';
import { FolderStorageManager } from '../folder-storage-manager';
import { createLogFile, createSnapshotFile, type VectorClockEntry } from '../binary-format';
import type { FileSystemAdapter, FileStats } from '../types';
import type { FolderSyncState } from '../../database/schema';

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

// Mock database operations for folder sync state
interface MockDbOperations {
  folderSyncStates: Map<string, FolderSyncState>;
  getFolderSyncState(sdId: string): Promise<FolderSyncState | null>;
  upsertFolderSyncState(state: FolderSyncState): Promise<void>;
}

function createMockDb(): MockDbOperations {
  const folderSyncStates = new Map<string, FolderSyncState>();

  return {
    folderSyncStates,

    async getFolderSyncState(sdId: string): Promise<FolderSyncState | null> {
      return folderSyncStates.get(sdId) || null;
    },

    async upsertFolderSyncState(state: FolderSyncState): Promise<void> {
      folderSyncStates.set(state.sdId, state);
    },
  };
}

// Helper to create folder paths
function createFolderPaths(sdPath: string): { logs: string; snapshots: string } {
  return {
    logs: `${sdPath}/folders/logs`,
    snapshots: `${sdPath}/folders/snapshots`,
  };
}

describe('FolderStorageManager', () => {
  const sdId = 'sd-123';
  const sdPath = '/storage/sd-123';
  const profileId = 'profile-xyz';
  const instanceId = 'inst-xyz';

  describe('loadFolderTree', () => {
    describe('from empty state', () => {
      it('should return empty doc when no files exist', async () => {
        const fs = createMockFs();
        const db = createMockDb();
        const paths = createFolderPaths(sdPath);

        fs.directories.add(paths.logs);
        fs.directories.add(paths.snapshots);

        const manager = new FolderStorageManager(fs, db, profileId, instanceId);
        const result = await manager.loadFolderTree(sdId, paths);

        expect(result.doc).toBeInstanceOf(Y.Doc);
        expect(result.vectorClock).toEqual({});
      });
    });

    describe('from logs only', () => {
      it('should load folder tree from log file', async () => {
        const fs = createMockFs();
        const db = createMockDb();
        const paths = createFolderPaths(sdPath);

        // Create a folder tree update
        const doc = new Y.Doc();
        const folders = doc.getMap('folders');
        const folder1 = new Y.Map();
        folder1.set('id', 'folder-1');
        folder1.set('name', 'Work');
        folder1.set('parentId', null);
        folder1.set('order', 0);
        folder1.set('deleted', false);
        folders.set('folder-1', folder1);

        const update = Y.encodeStateAsUpdate(doc);
        const timestamp = Date.now();
        const logData = createLogFile([{ timestamp, sequence: 1, data: update }]);

        fs.directories.add(paths.logs);
        fs.directories.add(paths.snapshots);
        fs.files.set(`${paths.logs}/inst-abc_${timestamp}.crdtlog`, logData);

        const manager = new FolderStorageManager(fs, db, profileId, instanceId);
        const result = await manager.loadFolderTree(sdId, paths);

        // Verify folder was loaded
        const resultFolders = result.doc.getMap('folders');
        expect(resultFolders.size).toBe(1);
        const loadedFolder = resultFolders.get('folder-1') as Y.Map<unknown>;
        expect(loadedFolder.get('name')).toBe('Work');
      });
    });

    describe('from snapshot + logs', () => {
      it('should load from snapshot and apply subsequent logs', async () => {
        const fs = createMockFs();
        const db = createMockDb();
        const paths = createFolderPaths(sdPath);

        // Create initial folder tree for snapshot
        const initialDoc = new Y.Doc();
        const initialFolders = initialDoc.getMap('folders');
        const folder1 = new Y.Map();
        folder1.set('id', 'folder-1');
        folder1.set('name', 'Work');
        folder1.set('parentId', null);
        folder1.set('order', 0);
        folder1.set('deleted', false);
        initialFolders.set('folder-1', folder1);
        const initialState = Y.encodeStateAsUpdate(initialDoc);

        // Create snapshot
        const snapshotVectorClock: VectorClockEntry[] = [
          { instanceId: 'inst-a', sequence: 1, offset: 100, filename: 'inst-a_1000.crdtlog' },
        ];
        const snapshotData = createSnapshotFile(snapshotVectorClock, initialState, true);

        // Create log with additional update (add second folder)
        const laterDoc = new Y.Doc();
        Y.applyUpdate(laterDoc, initialState);
        const laterFolders = laterDoc.getMap('folders');
        const folder2 = new Y.Map();
        folder2.set('id', 'folder-2');
        folder2.set('name', 'Personal');
        folder2.set('parentId', null);
        folder2.set('order', 1);
        folder2.set('deleted', false);
        laterFolders.set('folder-2', folder2);
        const laterUpdate = Y.encodeStateAsUpdate(laterDoc, Y.encodeStateVector(initialDoc));
        const logData = createLogFile([{ timestamp: 2000, sequence: 1, data: laterUpdate }]);

        fs.directories.add(paths.logs);
        fs.directories.add(paths.snapshots);
        fs.files.set(`${paths.snapshots}/inst-a_1000.snapshot`, snapshotData);
        fs.files.set(`${paths.logs}/inst-b_2000.crdtlog`, logData);

        const manager = new FolderStorageManager(fs, db, profileId, instanceId);
        const result = await manager.loadFolderTree(sdId, paths);

        // Verify both folders were loaded
        const resultFolders = result.doc.getMap('folders');
        expect(resultFolders.size).toBe(2);
        expect((resultFolders.get('folder-1') as Y.Map<unknown>).get('name')).toBe('Work');
        expect((resultFolders.get('folder-2') as Y.Map<unknown>).get('name')).toBe('Personal');
      });
    });

    describe('from cached DB state', () => {
      it('should load from DB cache when available', async () => {
        const fs = createMockFs();
        const db = createMockDb();
        const paths = createFolderPaths(sdPath);

        // Create cached state
        const doc = new Y.Doc();
        const folders = doc.getMap('folders');
        const folder1 = new Y.Map();
        folder1.set('id', 'folder-1');
        folder1.set('name', 'Cached Folder');
        folder1.set('parentId', null);
        folder1.set('order', 0);
        folder1.set('deleted', false);
        folders.set('folder-1', folder1);
        const documentState = Y.encodeStateAsUpdate(doc);

        const vectorClock = {
          'inst-a': { sequence: 5, offset: 500, file: 'inst-a_1000.crdtlog' },
        };

        db.folderSyncStates.set(sdId, {
          sdId,
          vectorClock: JSON.stringify(vectorClock),
          documentState,
          updatedAt: Date.now(),
        });

        fs.directories.add(paths.logs);
        fs.directories.add(paths.snapshots);

        const manager = new FolderStorageManager(fs, db, profileId, instanceId);
        const result = await manager.loadFolderTreeFromCache(sdId, paths);

        expect(result).not.toBeNull();
        const resultFolders = result!.doc.getMap('folders');
        expect((resultFolders.get('folder-1') as Y.Map<unknown>).get('name')).toBe('Cached Folder');
      });

      it('should return null when no cache exists', async () => {
        const fs = createMockFs();
        const db = createMockDb();
        const paths = createFolderPaths(sdPath);

        fs.directories.add(paths.logs);
        fs.directories.add(paths.snapshots);

        const manager = new FolderStorageManager(fs, db, profileId, instanceId);
        const result = await manager.loadFolderTreeFromCache(sdId, paths);

        expect(result).toBeNull();
      });
    });
  });

  describe('saveUpdate', () => {
    it('should append update to log file', async () => {
      const fs = createMockFs();
      const db = createMockDb();
      const paths = createFolderPaths(sdPath);

      fs.directories.add(paths.logs);
      fs.directories.add(paths.snapshots);

      const manager = new FolderStorageManager(fs, db, profileId, instanceId);

      // Create a folder update
      const doc = new Y.Doc();
      const folders = doc.getMap('folders');
      const folder1 = new Y.Map();
      folder1.set('id', 'folder-1');
      folder1.set('name', 'New Folder');
      folders.set('folder-1', folder1);
      const update = Y.encodeStateAsUpdate(doc);

      await manager.saveUpdate(sdId, paths, update);

      // Verify log file was created
      const logFiles = await fs.listFiles(paths.logs);
      expect(logFiles.length).toBe(1);
      expect(logFiles[0]).toMatch(new RegExp(`^${profileId}_${instanceId}_\\d+\\.crdtlog$`));
    });

    it('should increment sequence number', async () => {
      const fs = createMockFs();
      const db = createMockDb();
      const paths = createFolderPaths(sdPath);

      fs.directories.add(paths.logs);
      fs.directories.add(paths.snapshots);

      const manager = new FolderStorageManager(fs, db, profileId, instanceId);

      const doc = new Y.Doc();
      const update = Y.encodeStateAsUpdate(doc);

      const result1 = await manager.saveUpdate(sdId, paths, update);
      const result2 = await manager.saveUpdate(sdId, paths, update);

      expect(result1.sequence).toBe(1);
      expect(result2.sequence).toBe(2);
    });
  });

  describe('saveDbSnapshot', () => {
    it('should save document state to database', async () => {
      const fs = createMockFs();
      const db = createMockDb();
      const paths = createFolderPaths(sdPath);

      fs.directories.add(paths.logs);
      fs.directories.add(paths.snapshots);

      const manager = new FolderStorageManager(fs, db, profileId, instanceId);

      // Create folder tree to snapshot
      const doc = new Y.Doc();
      const folders = doc.getMap('folders');
      const folder1 = new Y.Map();
      folder1.set('id', 'folder-1');
      folder1.set('name', 'Snapshot Folder');
      folders.set('folder-1', folder1);

      const vectorClock = {
        'inst-a': { sequence: 3, offset: 300, file: 'inst-a_1000.crdtlog' },
      };

      await manager.saveDbSnapshot(sdId, doc, vectorClock);

      // Verify it was saved
      const saved = await db.getFolderSyncState(sdId);
      expect(saved).not.toBeNull();

      // Verify document can be loaded
      const loadedDoc = new Y.Doc();
      Y.applyUpdate(loadedDoc, saved!.documentState);
      const loadedFolders = loadedDoc.getMap('folders');
      expect((loadedFolders.get('folder-1') as Y.Map<unknown>).get('name')).toBe('Snapshot Folder');
    });
  });

  describe('finalize', () => {
    it('should finalize all log writers', async () => {
      const fs = createMockFs();
      const db = createMockDb();
      const paths1 = createFolderPaths('/storage/sd-1');
      const paths2 = createFolderPaths('/storage/sd-2');

      fs.directories.add(paths1.logs);
      fs.directories.add(paths2.logs);

      const manager = new FolderStorageManager(fs, db, profileId, instanceId);

      // Create writers by saving updates
      const doc = new Y.Doc();
      const update = Y.encodeStateAsUpdate(doc);

      await manager.saveUpdate('sd-1', paths1, update);
      await manager.saveUpdate('sd-2', paths2, update);

      // Finalize all
      await manager.finalize();

      // No errors should occur
    });
  });
});
