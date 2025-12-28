/**
 * Migration Tests
 *
 * Tests for migrating from old update file format to new append-only log format.
 */

import * as Y from 'yjs';
import { StorageMigration } from '../migration';
import { encodeUpdateFile } from '../../crdt/update-format';
import { LogReader } from '../log-reader';
import type { FileSystemAdapter, FileStats } from '../types';

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

describe('StorageMigration', () => {
  const profileId = 'profile-migration';
  const instanceId = 'inst-migration';

  describe('migrateNote', () => {
    it('should migrate note from old format to new format', async () => {
      const fs = createMockFs();

      // Create old format update files
      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'Hello');
      const update1 = Y.encodeStateAsUpdate(doc);
      const encoded1 = encodeUpdateFile(update1);

      doc.getText('content').insert(5, ' World');
      const update2 = Y.encodeStateAsUpdate(doc, Y.encodeStateVector(doc));
      const encoded2 = encodeUpdateFile(update2);

      // Create old format directory structure
      fs.directories.add('/storage/sd-123/notes/note-abc/updates');
      fs.directories.add('/storage/sd-123/notes/note-abc/logs');
      fs.files.set(
        '/storage/sd-123/notes/note-abc/updates/inst-old_note-abc_1000-1.yjson',
        encoded1
      );
      fs.files.set(
        '/storage/sd-123/notes/note-abc/updates/inst-old_note-abc_2000-2.yjson',
        encoded2
      );

      const migration = new StorageMigration(fs, profileId, instanceId);
      const result = await migration.migrateNote(
        '/storage/sd-123/notes/note-abc/updates',
        '/storage/sd-123/notes/note-abc/logs',
        'note-abc'
      );

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(2);

      // Verify new log file was created
      const logFiles = await fs.listFiles('/storage/sd-123/notes/note-abc/logs');
      expect(logFiles.length).toBe(1);
      expect(logFiles[0]).toMatch(/\.crdtlog$/);

      // Verify content can be read from new format
      const logPath = `/storage/sd-123/notes/note-abc/logs/${logFiles[0]}`;
      const records = await LogReader.readAllRecords(logPath, fs);
      expect(records.length).toBe(2);
    });

    it('should handle empty updates directory', async () => {
      const fs = createMockFs();

      fs.directories.add('/storage/sd-123/notes/note-empty/updates');
      fs.directories.add('/storage/sd-123/notes/note-empty/logs');

      const migration = new StorageMigration(fs, profileId, instanceId);
      const result = await migration.migrateNote(
        '/storage/sd-123/notes/note-empty/updates',
        '/storage/sd-123/notes/note-empty/logs',
        'note-empty'
      );

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(0);
    });

    it('should skip non-yjson files', async () => {
      const fs = createMockFs();

      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'Test');
      const encoded = encodeUpdateFile(Y.encodeStateAsUpdate(doc));

      fs.directories.add('/storage/sd-123/notes/note-abc/updates');
      fs.directories.add('/storage/sd-123/notes/note-abc/logs');
      // Use proper filename format: inst_note_timestamp-sequence.yjson
      fs.files.set(
        '/storage/sd-123/notes/note-abc/updates/inst-old_note-abc_1000-1.yjson',
        encoded
      );
      fs.files.set('/storage/sd-123/notes/note-abc/updates/readme.txt', new Uint8Array([0x00]));
      fs.files.set('/storage/sd-123/notes/note-abc/updates/.hidden', new Uint8Array([0x00]));

      const migration = new StorageMigration(fs, profileId, instanceId);
      const result = await migration.migrateNote(
        '/storage/sd-123/notes/note-abc/updates',
        '/storage/sd-123/notes/note-abc/logs',
        'note-abc'
      );

      expect(result.filesProcessed).toBe(1);
    });
  });

  describe('migrateFolders', () => {
    it('should migrate folder updates to new format', async () => {
      const fs = createMockFs();

      // Create old format folder update
      const doc = new Y.Doc();
      const folders = doc.getMap('folders');
      const folder = new Y.Map();
      folder.set('id', 'folder-1');
      folder.set('name', 'Work');
      folders.set('folder-1', folder);
      const encoded = encodeUpdateFile(Y.encodeStateAsUpdate(doc));

      fs.directories.add('/storage/sd-123/folders/updates');
      fs.directories.add('/storage/sd-123/folders/logs');
      fs.files.set(
        '/storage/sd-123/folders/updates/inst-old_folder-tree_sd-123_1000-1.yjson',
        encoded
      );

      const migration = new StorageMigration(fs, profileId, instanceId);
      const result = await migration.migrateFolders(
        '/storage/sd-123/folders/updates',
        '/storage/sd-123/folders/logs'
      );

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(1);

      // Verify log file was created
      const logFiles = await fs.listFiles('/storage/sd-123/folders/logs');
      expect(logFiles.length).toBe(1);
    });
  });

  describe('checkMigrationNeeded', () => {
    it('should return true if old format files exist', async () => {
      const fs = createMockFs();

      fs.directories.add('/storage/sd-123/notes/note-abc/updates');
      fs.files.set(
        '/storage/sd-123/notes/note-abc/updates/test_1000.yjson',
        new Uint8Array([0x01])
      );

      const migration = new StorageMigration(fs, profileId, instanceId);
      const needed = await migration.checkMigrationNeeded('/storage/sd-123/notes/note-abc/updates');

      expect(needed).toBe(true);
    });

    it('should return false if no old format files exist', async () => {
      const fs = createMockFs();

      fs.directories.add('/storage/sd-123/notes/note-abc/updates');

      const migration = new StorageMigration(fs, profileId, instanceId);
      const needed = await migration.checkMigrationNeeded('/storage/sd-123/notes/note-abc/updates');

      expect(needed).toBe(false);
    });

    it('should return false if directory does not exist', async () => {
      const fs = createMockFs();

      const migration = new StorageMigration(fs, profileId, instanceId);
      const needed = await migration.checkMigrationNeeded('/storage/sd-123/notes/note-abc/updates');

      expect(needed).toBe(false);
    });
  });

  describe('cleanupOldFiles', () => {
    it('should delete old format files after migration', async () => {
      const fs = createMockFs();

      fs.directories.add('/storage/sd-123/notes/note-abc/updates');
      fs.files.set('/storage/sd-123/notes/note-abc/updates/old_1000.yjson', new Uint8Array([0x01]));
      fs.files.set('/storage/sd-123/notes/note-abc/updates/old_2000.yjson', new Uint8Array([0x02]));

      const migration = new StorageMigration(fs, profileId, instanceId);
      const deleted = await migration.cleanupOldFiles('/storage/sd-123/notes/note-abc/updates');

      expect(deleted).toBe(2);
      expect(fs.files.has('/storage/sd-123/notes/note-abc/updates/old_1000.yjson')).toBe(false);
      expect(fs.files.has('/storage/sd-123/notes/note-abc/updates/old_2000.yjson')).toBe(false);
    });
  });
});
