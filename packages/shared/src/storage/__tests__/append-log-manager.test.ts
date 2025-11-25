/**
 * AppendLogManager Tests
 *
 * Tests for the high-level append-only log storage manager.
 */

/* eslint-disable @typescript-eslint/no-base-to-string */
// Y.Text has a proper toString() method, ESLint just doesn't know about it

import * as Y from 'yjs';
import { AppendLogManager } from '../append-log-manager';
import type { FileSystemAdapter, FileStats } from '../types';
import type { NoteSyncState, FolderSyncState } from '../../database/schema';

// Mock FileSystemAdapter
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

// Mock database
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

describe('AppendLogManager', () => {
  const instanceId = 'inst-local';

  describe('registerSD', () => {
    it('should register a storage directory', () => {
      const fs = createMockFs();
      const db = createMockDb();

      const manager = new AppendLogManager(fs, db, instanceId);
      manager.registerSD('sd-123', '/storage/sd-123');

      expect(manager.hasSD('sd-123')).toBe(true);
    });

    it('should unregister a storage directory', () => {
      const fs = createMockFs();
      const db = createMockDb();

      const manager = new AppendLogManager(fs, db, instanceId);
      manager.registerSD('sd-123', '/storage/sd-123');
      manager.unregisterSD('sd-123');

      expect(manager.hasSD('sd-123')).toBe(false);
    });
  });

  describe('writeNoteUpdate', () => {
    it('should write update to log file', async () => {
      const fs = createMockFs();
      const db = createMockDb();

      // Create required directories
      fs.directories.add('/storage/sd-123/notes/note-abc/logs');

      const manager = new AppendLogManager(fs, db, instanceId);
      manager.registerSD('sd-123', '/storage/sd-123');

      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'Hello');
      const update = Y.encodeStateAsUpdate(doc);

      const result = await manager.writeNoteUpdate('sd-123', 'note-abc', update);

      expect(result.sequence).toBe(1);

      // Verify log file was created
      const logFiles = await fs.listFiles('/storage/sd-123/notes/note-abc/logs');
      expect(logFiles.length).toBe(1);
    });

    it('should increment sequence for each update', async () => {
      const fs = createMockFs();
      const db = createMockDb();

      fs.directories.add('/storage/sd-123/notes/note-abc/logs');

      const manager = new AppendLogManager(fs, db, instanceId);
      manager.registerSD('sd-123', '/storage/sd-123');

      const update = new Uint8Array([0x01, 0x02]);

      const result1 = await manager.writeNoteUpdate('sd-123', 'note-abc', update);
      const result2 = await manager.writeNoteUpdate('sd-123', 'note-abc', update);
      const result3 = await manager.writeNoteUpdate('sd-123', 'note-abc', update);

      expect(result1.sequence).toBe(1);
      expect(result2.sequence).toBe(2);
      expect(result3.sequence).toBe(3);
    });
  });

  describe('loadNote', () => {
    it('should load note from log files', async () => {
      const fs = createMockFs();
      const db = createMockDb();

      fs.directories.add('/storage/sd-123/notes/note-abc/logs');
      fs.directories.add('/storage/sd-123/notes/note-abc/snapshots');

      const manager = new AppendLogManager(fs, db, instanceId);
      manager.registerSD('sd-123', '/storage/sd-123');

      // Write an update
      const writeDoc = new Y.Doc();
      writeDoc.getText('content').insert(0, 'Test Content');
      const update = Y.encodeStateAsUpdate(writeDoc);
      await manager.writeNoteUpdate('sd-123', 'note-abc', update);

      // Load the note
      const result = await manager.loadNote('sd-123', 'note-abc');

      expect(result.doc).toBeInstanceOf(Y.Doc);
      expect(String(result.doc.getText('content'))).toBe('Test Content');
    });

    it('should return empty doc for new note', async () => {
      const fs = createMockFs();
      const db = createMockDb();

      fs.directories.add('/storage/sd-123/notes/note-new/logs');
      fs.directories.add('/storage/sd-123/notes/note-new/snapshots');

      const manager = new AppendLogManager(fs, db, instanceId);
      manager.registerSD('sd-123', '/storage/sd-123');

      const result = await manager.loadNote('sd-123', 'note-new');

      expect(result.doc).toBeInstanceOf(Y.Doc);
      expect(String(result.doc.getText('content'))).toBe('');
    });
  });

  describe('writeFolderUpdate', () => {
    it('should write folder update to log file', async () => {
      const fs = createMockFs();
      const db = createMockDb();

      fs.directories.add('/storage/sd-123/folders/logs');

      const manager = new AppendLogManager(fs, db, instanceId);
      manager.registerSD('sd-123', '/storage/sd-123');

      const doc = new Y.Doc();
      const folders = doc.getMap('folders');
      const folder = new Y.Map();
      folder.set('id', 'folder-1');
      folder.set('name', 'Work');
      folders.set('folder-1', folder);
      const update = Y.encodeStateAsUpdate(doc);

      const sequence = await manager.writeFolderUpdate('sd-123', update);

      expect(sequence).toBe(1);
    });
  });

  describe('loadFolderTree', () => {
    it('should load folder tree from log files', async () => {
      const fs = createMockFs();
      const db = createMockDb();

      fs.directories.add('/storage/sd-123/folders/logs');
      fs.directories.add('/storage/sd-123/folders/snapshots');

      const manager = new AppendLogManager(fs, db, instanceId);
      manager.registerSD('sd-123', '/storage/sd-123');

      // Write a folder update
      const writeDoc = new Y.Doc();
      const folders = writeDoc.getMap('folders');
      const folder = new Y.Map();
      folder.set('id', 'folder-1');
      folder.set('name', 'Work');
      folders.set('folder-1', folder);
      const update = Y.encodeStateAsUpdate(writeDoc);
      await manager.writeFolderUpdate('sd-123', update);

      // Load folder tree
      const result = await manager.loadFolderTree('sd-123');

      const loadedFolders = result.doc.getMap('folders');
      expect(loadedFolders.size).toBe(1);
    });
  });

  describe('saveSnapshot', () => {
    it('should save note snapshot to database', async () => {
      const fs = createMockFs();
      const db = createMockDb();

      fs.directories.add('/storage/sd-123/notes/note-abc/logs');
      fs.directories.add('/storage/sd-123/notes/note-abc/snapshots');

      const manager = new AppendLogManager(fs, db, instanceId);
      manager.registerSD('sd-123', '/storage/sd-123');

      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'Snapshot Content');
      const encodedState = Y.encodeStateAsUpdate(doc);

      await manager.saveNoteSnapshot('sd-123', 'note-abc', encodedState);

      // Verify snapshot was saved to DB
      const saved = await db.getNoteSyncState('note-abc', 'sd-123');
      expect(saved).not.toBeNull();
    });
  });

  describe('shutdown', () => {
    it('should finalize all log writers', async () => {
      const fs = createMockFs();
      const db = createMockDb();

      fs.directories.add('/storage/sd-123/notes/note-abc/logs');

      const manager = new AppendLogManager(fs, db, instanceId);
      manager.registerSD('sd-123', '/storage/sd-123');

      // Write some updates
      await manager.writeNoteUpdate('sd-123', 'note-abc', new Uint8Array([0x01]));

      // Shutdown should not throw
      await manager.shutdown();
    });
  });
});
