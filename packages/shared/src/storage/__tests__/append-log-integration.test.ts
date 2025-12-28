/**
 * AppendLogManager Integration Tests
 *
 * Tests for end-to-end scenarios with the append-only log storage manager.
 * Phase 6.2 requirement.
 */

/* eslint-disable @typescript-eslint/no-base-to-string */
// Y.Text has a proper toString() method, ESLint just doesn't know about it

import * as Y from 'yjs';
import { AppendLogManager } from '../append-log-manager';
import type { FileSystemAdapter, FileStats } from '../types';
import type { NoteSyncState, FolderSyncState } from '../../database/schema';

// Mock FileSystemAdapter with shared state for multi-instance tests
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
      return new Uint8Array(data); // Return copy to prevent mutation
    },

    async writeFile(path: string, data: Uint8Array): Promise<void> {
      files.set(path, new Uint8Array(data)); // Store copy
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

// Mock database with shared state for multi-instance tests
function createMockDb() {
  const noteSyncStates = new Map<string, NoteSyncState>();
  const folderSyncStates = new Map<string, FolderSyncState>();

  return {
    noteSyncStates,
    folderSyncStates,

    async getNoteSyncState(noteId: string, sdId: string): Promise<NoteSyncState | null> {
      return noteSyncStates.get(`${sdId}:${noteId}`) || null;
    },

    async upsertNoteSyncState(state: NoteSyncState): Promise<void> {
      noteSyncStates.set(`${state.sdId}:${state.noteId}`, state);
    },

    async getFolderSyncState(sdId: string): Promise<FolderSyncState | null> {
      return folderSyncStates.get(sdId) || null;
    },

    async upsertFolderSyncState(state: FolderSyncState): Promise<void> {
      folderSyncStates.set(state.sdId, state);
    },
  };
}

describe('AppendLogManager Integration Tests', () => {
  describe('6.2.1: Create note → edit → close → reopen → verify content', () => {
    it('should persist note content across manager restarts', async () => {
      const fs = createMockFs();
      const db = createMockDb();
      const sdPath = '/storage/my-sd';
      const sdId = 'sd-persist';
      const noteId = 'note-test';

      // Setup directories
      fs.directories.add(`${sdPath}/notes/${noteId}/logs`);
      fs.directories.add(`${sdPath}/notes/${noteId}/snapshots`);

      // Session 1: Create and edit note
      {
        const manager = new AppendLogManager(fs, db, 'profile-1', 'instance-1');
        manager.registerSD(sdId, sdPath);

        // Create initial content
        const doc = new Y.Doc();
        doc.getText('content').insert(0, 'Initial content');
        const update1 = Y.encodeStateAsUpdate(doc);
        await manager.writeNoteUpdate(sdId, noteId, update1);

        // Edit the content
        doc.getText('content').insert(15, ' - edited');
        const update2 = Y.encodeStateAsUpdate(doc);
        await manager.writeNoteUpdate(sdId, noteId, update2);

        // Save snapshot to DB (simulates close)
        const encodedState = Y.encodeStateAsUpdate(doc);
        await manager.saveNoteSnapshot(sdId, noteId, encodedState);

        // Shutdown
        await manager.shutdown();
      }

      // Session 2: Reopen and verify content
      {
        const manager = new AppendLogManager(fs, db, 'profile-1', 'instance-1');
        manager.registerSD(sdId, sdPath);

        const result = await manager.loadNote(sdId, noteId);

        expect(result.doc).toBeInstanceOf(Y.Doc);
        expect(String(result.doc.getText('content'))).toBe('Initial content - edited');

        await manager.shutdown();
      }
    });

    it('should preserve multiple edits across restarts', async () => {
      const fs = createMockFs();
      const db = createMockDb();
      const sdPath = '/storage/multi-edit';
      const sdId = 'sd-multi';
      const noteId = 'note-multi';

      fs.directories.add(`${sdPath}/notes/${noteId}/logs`);
      fs.directories.add(`${sdPath}/notes/${noteId}/snapshots`);

      // Session 1: Multiple edits
      {
        const manager = new AppendLogManager(fs, db, 'profile-1', 'instance-1');
        manager.registerSD(sdId, sdPath);

        const doc = new Y.Doc();
        const content = doc.getText('content');

        // Multiple edits
        content.insert(0, 'Line 1\n');
        await manager.writeNoteUpdate(sdId, noteId, Y.encodeStateAsUpdate(doc));

        content.insert(content.length, 'Line 2\n');
        await manager.writeNoteUpdate(sdId, noteId, Y.encodeStateAsUpdate(doc));

        content.insert(content.length, 'Line 3');
        await manager.writeNoteUpdate(sdId, noteId, Y.encodeStateAsUpdate(doc));

        await manager.shutdown();
      }

      // Session 2: Verify all edits persisted
      {
        const manager = new AppendLogManager(fs, db, 'profile-1', 'instance-1');
        manager.registerSD(sdId, sdPath);

        const result = await manager.loadNote(sdId, noteId);
        expect(String(result.doc.getText('content'))).toBe('Line 1\nLine 2\nLine 3');

        await manager.shutdown();
      }
    });
  });

  describe('6.2.2: Cross-instance sync simulation', () => {
    it('should sync note from instance A to instance B', async () => {
      // Shared filesystem (simulates cloud storage like Google Drive)
      const fs = createMockFs();
      const sdPath = '/shared/cloud-sd';
      const sdId = 'sd-cloud';
      const noteId = 'note-sync';

      // Setup directories
      fs.directories.add(`${sdPath}/notes/${noteId}/logs`);
      fs.directories.add(`${sdPath}/notes/${noteId}/snapshots`);

      // Instance A: Create note content
      {
        const dbA = createMockDb();
        const managerA = new AppendLogManager(fs, dbA, 'profile-A', 'instance-A');
        managerA.registerSD(sdId, sdPath);

        const doc = new Y.Doc();
        doc.getText('content').insert(0, 'Created by Instance A');
        const update = Y.encodeStateAsUpdate(doc);
        await managerA.writeNoteUpdate(sdId, noteId, update);

        await managerA.shutdown();
      }

      // Instance B: Load note (should see Instance A's content)
      {
        const dbB = createMockDb();
        const managerB = new AppendLogManager(fs, dbB, 'profile-B', 'instance-B');
        managerB.registerSD(sdId, sdPath);

        const result = await managerB.loadNote(sdId, noteId);

        expect(String(result.doc.getText('content'))).toBe('Created by Instance A');

        await managerB.shutdown();
      }
    });

    it('should sync folder tree from instance A to instance B', async () => {
      const fs = createMockFs();
      const sdPath = '/shared/folders-sd';
      const sdId = 'sd-folders';

      fs.directories.add(`${sdPath}/folders/logs`);
      fs.directories.add(`${sdPath}/folders/snapshots`);

      // Instance A: Create folders
      {
        const dbA = createMockDb();
        const managerA = new AppendLogManager(fs, dbA, 'profile-A', 'instance-A');
        managerA.registerSD(sdId, sdPath);

        const doc = new Y.Doc();
        const folders = doc.getMap('folders');

        const folder1 = new Y.Map();
        folder1.set('id', 'folder-1');
        folder1.set('name', 'Work');
        folder1.set('parentId', null);
        folders.set('folder-1', folder1);

        const folder2 = new Y.Map();
        folder2.set('id', 'folder-2');
        folder2.set('name', 'Personal');
        folder2.set('parentId', null);
        folders.set('folder-2', folder2);

        await managerA.writeFolderUpdate(sdId, Y.encodeStateAsUpdate(doc));
        await managerA.shutdown();
      }

      // Instance B: Load folders
      {
        const dbB = createMockDb();
        const managerB = new AppendLogManager(fs, dbB, 'profile-B', 'instance-B');
        managerB.registerSD(sdId, sdPath);

        const result = await managerB.loadFolderTree(sdId);
        const folders = result.doc.getMap('folders');

        expect(folders.size).toBe(2);

        const folder1 = folders.get('folder-1') as Y.Map<unknown>;
        expect(folder1.get('name')).toBe('Work');

        const folder2 = folders.get('folder-2') as Y.Map<unknown>;
        expect(folder2.get('name')).toBe('Personal');

        await managerB.shutdown();
      }
    });
  });

  describe('6.2.3: Concurrent edits from two instances → merge correctly', () => {
    it('should merge concurrent note edits from different instances', async () => {
      const fs = createMockFs();
      const sdPath = '/shared/concurrent-sd';
      const sdId = 'sd-concurrent';
      const noteId = 'note-merge';

      fs.directories.add(`${sdPath}/notes/${noteId}/logs`);
      fs.directories.add(`${sdPath}/notes/${noteId}/snapshots`);

      // Instance A: Edit at beginning
      {
        const dbA = createMockDb();
        const managerA = new AppendLogManager(fs, dbA, 'profile-A', 'instance-A');
        managerA.registerSD(sdId, sdPath);

        const doc = new Y.Doc();
        doc.getText('content').insert(0, 'AAA ');
        await managerA.writeNoteUpdate(sdId, noteId, Y.encodeStateAsUpdate(doc));

        await managerA.shutdown();
      }

      // Instance B: Edit at end (independently, simulating concurrent edit)
      {
        const dbB = createMockDb();
        const managerB = new AppendLogManager(fs, dbB, 'profile-B', 'instance-B');
        managerB.registerSD(sdId, sdPath);

        // Load current state first
        const result = await managerB.loadNote(sdId, noteId);
        const doc = result.doc;

        // Add content at the end
        doc.getText('content').insert(doc.getText('content').length, 'BBB');
        await managerB.writeNoteUpdate(sdId, noteId, Y.encodeStateAsUpdate(doc));

        await managerB.shutdown();
      }

      // Instance C: Load and verify merged content
      {
        const dbC = createMockDb();
        const managerC = new AppendLogManager(fs, dbC, 'profile-C', 'instance-C');
        managerC.registerSD(sdId, sdPath);

        const result = await managerC.loadNote(sdId, noteId);
        const content = String(result.doc.getText('content'));

        // Both edits should be present
        expect(content).toContain('AAA');
        expect(content).toContain('BBB');

        await managerC.shutdown();
      }
    });

    it('should merge concurrent folder edits from different instances', async () => {
      const fs = createMockFs();
      const sdPath = '/shared/folder-merge';
      const sdId = 'sd-folder-merge';

      fs.directories.add(`${sdPath}/folders/logs`);
      fs.directories.add(`${sdPath}/folders/snapshots`);

      // Instance A: Create folder-1
      {
        const dbA = createMockDb();
        const managerA = new AppendLogManager(fs, dbA, 'profile-A', 'instance-A');
        managerA.registerSD(sdId, sdPath);

        const doc = new Y.Doc();
        const folders = doc.getMap('folders');
        const folder = new Y.Map();
        folder.set('id', 'folder-A');
        folder.set('name', 'From A');
        folders.set('folder-A', folder);

        await managerA.writeFolderUpdate(sdId, Y.encodeStateAsUpdate(doc));
        await managerA.shutdown();
      }

      // Instance B: Load, then create folder-2
      {
        const dbB = createMockDb();
        const managerB = new AppendLogManager(fs, dbB, 'profile-B', 'instance-B');
        managerB.registerSD(sdId, sdPath);

        const result = await managerB.loadFolderTree(sdId);
        const doc = result.doc;
        const folders = doc.getMap('folders');

        const folder = new Y.Map();
        folder.set('id', 'folder-B');
        folder.set('name', 'From B');
        folders.set('folder-B', folder);

        await managerB.writeFolderUpdate(sdId, Y.encodeStateAsUpdate(doc));
        await managerB.shutdown();
      }

      // Instance C: Load and verify both folders
      {
        const dbC = createMockDb();
        const managerC = new AppendLogManager(fs, dbC, 'profile-C', 'instance-C');
        managerC.registerSD(sdId, sdPath);

        const result = await managerC.loadFolderTree(sdId);
        const folders = result.doc.getMap('folders');

        expect(folders.size).toBe(2);
        expect((folders.get('folder-A') as Y.Map<unknown>).get('name')).toBe('From A');
        expect((folders.get('folder-B') as Y.Map<unknown>).get('name')).toBe('From B');

        await managerC.shutdown();
      }
    });

    it('should handle true concurrent edits to same position', async () => {
      const fs = createMockFs();
      const sdPath = '/shared/same-pos';
      const sdId = 'sd-same-pos';
      const noteId = 'note-same';

      fs.directories.add(`${sdPath}/notes/${noteId}/logs`);
      fs.directories.add(`${sdPath}/notes/${noteId}/snapshots`);

      // Instance A and B start with empty doc
      const docA = new Y.Doc();
      const docB = new Y.Doc();

      // Both insert at position 0 (concurrent)
      docA.getText('content').insert(0, 'From A');
      docB.getText('content').insert(0, 'From B');

      const updateA = Y.encodeStateAsUpdate(docA);
      const updateB = Y.encodeStateAsUpdate(docB);

      // Write both updates
      {
        const dbA = createMockDb();
        const managerA = new AppendLogManager(fs, dbA, 'profile-A', 'instance-A');
        managerA.registerSD(sdId, sdPath);
        await managerA.writeNoteUpdate(sdId, noteId, updateA);
        await managerA.shutdown();
      }

      {
        const dbB = createMockDb();
        const managerB = new AppendLogManager(fs, dbB, 'profile-B', 'instance-B');
        managerB.registerSD(sdId, sdPath);
        await managerB.writeNoteUpdate(sdId, noteId, updateB);
        await managerB.shutdown();
      }

      // Load and verify both contents are present (Yjs will merge them)
      {
        const dbC = createMockDb();
        const managerC = new AppendLogManager(fs, dbC, 'profile-C', 'instance-C');
        managerC.registerSD(sdId, sdPath);

        const result = await managerC.loadNote(sdId, noteId);
        const content = String(result.doc.getText('content'));

        // Both should be present (order may vary due to CRDT merge)
        expect(content).toContain('From A');
        expect(content).toContain('From B');
        expect(content.length).toBe('From AFrom B'.length);

        await managerC.shutdown();
      }
    });
  });
});
