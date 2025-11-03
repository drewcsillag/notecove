import { UpdateManager } from '../update-manager';
import { SyncDirectoryStructure } from '../sd-structure';
import type { FileSystemAdapter, SyncDirectoryConfig } from '../types';
import type { UUID } from '../../types';
import { NoteDoc } from '../../crdt/note-doc';

/**
 * Mock file system adapter
 */
class MockFileSystemAdapter implements FileSystemAdapter {
  private files = new Map<string, Uint8Array>();
  private dirs = new Set<string>();

  /* eslint-disable @typescript-eslint/require-await */
  async exists(path: string): Promise<boolean> {
    return this.dirs.has(path) || this.files.has(path);
  }

  async mkdir(path: string): Promise<void> {
    this.dirs.add(path);
  }

  async readFile(path: string): Promise<Uint8Array> {
    const data = this.files.get(path);
    if (!data) {
      throw new Error(`File not found: ${path}`);
    }
    return data;
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    this.files.set(path, data);
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
  }

  async listFiles(path: string): Promise<string[]> {
    const result: string[] = [];
    const prefix = path + '/';

    for (const file of this.files.keys()) {
      if (file.startsWith(prefix)) {
        const relative = file.slice(prefix.length);
        if (!relative.includes('/')) {
          result.push(relative);
        }
      }
    }

    for (const dir of this.dirs) {
      if (dir.startsWith(prefix)) {
        const relative = dir.slice(prefix.length);
        if (!relative.includes('/')) {
          result.push(relative);
        }
      }
    }

    return result;
  }

  joinPath(...segments: string[]): string {
    return segments.join('/');
  }

  basename(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1] || '';
  }
  /* eslint-enable @typescript-eslint/require-await */

  // Test helpers
  reset() {
    this.files.clear();
    this.dirs.clear();
  }

  hasFile(path: string): boolean {
    return this.files.has(path);
  }

  getFileCount(): number {
    return this.files.size;
  }
}

describe('UpdateManager', () => {
  let fs: MockFileSystemAdapter;
  let config: SyncDirectoryConfig;
  let sdStructure: SyncDirectoryStructure;
  let updateManager: UpdateManager;
  const instanceId = 'test-instance-123';
  const sdId = 'sd-test';

  beforeEach(() => {
    fs = new MockFileSystemAdapter();
    config = {
      id: sdId,
      path: '/test/sd',
      label: 'Test SD',
    };
    sdStructure = new SyncDirectoryStructure(fs, config);
    updateManager = new UpdateManager(fs, instanceId);
    updateManager.registerSD(sdId, config.path);
  });

  describe('writeNoteUpdate', () => {
    it('should write note update to correct location', async () => {
      const noteId = 'note-123' as UUID;
      const noteDoc = new NoteDoc(noteId);
      noteDoc.initializeNote({
        id: noteId,
        created: Date.now(),
        modified: Date.now(),
        folderId: null,
        deleted: false,
      });

      const update = noteDoc.encodeStateAsUpdate();
      const filename = await updateManager.writeNoteUpdate(sdId, noteId, update);

      // New format: timestamp-seq (sequence numbers, variable length)
      expect(filename).toMatch(/^test-instance-123_note-123_\d+-\d+\.yjson$/);
      expect(fs.hasFile(`/test/sd/notes/note-123/updates/${filename}`)).toBe(true);

      noteDoc.destroy();
    });

    it('should create note directories if they do not exist', async () => {
      const noteId = 'note-456' as UUID;
      const update = new Uint8Array([1, 2, 3]);

      await updateManager.writeNoteUpdate(sdId, noteId, update);

      expect(await fs.exists('/test/sd/notes/note-456')).toBe(true);
      expect(await fs.exists('/test/sd/notes/note-456/updates')).toBe(true);
    });
  });

  describe('writeFolderUpdate', () => {
    it('should write folder update to correct location', async () => {
      await sdStructure.initialize();

      const update = new Uint8Array([1, 2, 3]);
      const filename = await updateManager.writeFolderUpdate('sd-test', update);

      // New format: timestamp-seq (sequence numbers, variable length)
      expect(filename).toMatch(/^test-instance-123_folder-tree_sd-test_\d+-\d+\.yjson$/);
      expect(fs.hasFile(`/test/sd/folders/updates/${filename}`)).toBe(true);
    });
  });

  describe('readNoteUpdates', () => {
    it('should return empty array when no updates exist', async () => {
      const noteId = 'note-123' as UUID;
      const updates = await updateManager.readNoteUpdates(sdId, noteId);

      expect(updates).toEqual([]);
    });

    it('should return empty array when note directory does not exist', async () => {
      const noteId = 'note-999' as UUID;
      const updates = await updateManager.readNoteUpdates(sdId, noteId);

      expect(updates).toEqual([]);
    });

    it('should read all updates for a note', async () => {
      const noteId = 'note-123' as UUID;

      // Write multiple updates with delays to ensure different timestamps
      const update1 = new Uint8Array([1, 2, 3]);
      const update2 = new Uint8Array([4, 5, 6]);
      const update3 = new Uint8Array([7, 8, 9]);

      await updateManager.writeNoteUpdate(sdId, noteId, update1);
      await new Promise((resolve) => setTimeout(resolve, 2));
      await updateManager.writeNoteUpdate(sdId, noteId, update2);
      await new Promise((resolve) => setTimeout(resolve, 2));
      await updateManager.writeNoteUpdate(sdId, noteId, update3);

      // Read all updates
      const updates = await updateManager.readNoteUpdates(sdId, noteId);

      expect(updates).toHaveLength(3);
    });

    it('should skip non-yjson files', async () => {
      const noteId = 'note-123' as UUID;
      await sdStructure.initializeNote(noteId);

      // Write valid update
      await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([1, 2, 3]));

      // Write invalid file
      await fs.writeFile('/test/sd/notes/note-123/updates/invalid.txt', new Uint8Array([9, 9, 9]));

      const updates = await updateManager.readNoteUpdates(sdId, noteId);
      expect(updates).toHaveLength(1);
    });
  });

  describe('readFolderUpdates', () => {
    it('should return empty array when no updates exist', async () => {
      const updates = await updateManager.readFolderUpdates(sdId);
      expect(updates).toEqual([]);
    });

    it('should read all folder updates', async () => {
      await sdStructure.initialize();

      const update1 = new Uint8Array([1, 2, 3]);
      const update2 = new Uint8Array([4, 5, 6]);

      await updateManager.writeFolderUpdate('sd-test', update1);
      await new Promise((resolve) => setTimeout(resolve, 2));
      await updateManager.writeFolderUpdate('sd-test', update2);

      const updates = await updateManager.readFolderUpdates(sdId);
      expect(updates).toHaveLength(2);
    });
  });

  describe('listNoteUpdateFiles', () => {
    it('should return empty array when no updates exist', async () => {
      const noteId = 'note-123' as UUID;
      const files = await updateManager.listNoteUpdateFiles(sdId, noteId);

      expect(files).toEqual([]);
    });

    it('should list all update files with metadata', async () => {
      const noteId = 'note-123' as UUID;

      // Use setTimeout to ensure different timestamps
      await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([1]));
      await new Promise((resolve) => setTimeout(resolve, 10));
      await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([2]));
      await new Promise((resolve) => setTimeout(resolve, 10));
      await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([3]));

      const files = await updateManager.listNoteUpdateFiles(sdId, noteId);

      expect(files).toHaveLength(3);
      expect(files[0]?.instanceId).toBe(instanceId);
      expect(files[0]?.documentId).toBe(noteId);

      // Should be sorted by timestamp
      if (files[0] && files[1] && files[2]) {
        expect(files[0].timestamp).toBeLessThan(files[1].timestamp);
        expect(files[1].timestamp).toBeLessThan(files[2].timestamp);
      }
    });

    it('should skip files with invalid names', async () => {
      const noteId = 'note-123' as UUID;
      await sdStructure.initializeNote(noteId);

      await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([1]));
      await fs.writeFile('/test/sd/notes/note-123/updates/invalid-name.yjson', new Uint8Array([2]));

      const files = await updateManager.listNoteUpdateFiles(sdId, noteId);
      expect(files).toHaveLength(1);
    });
  });

  describe('listFolderUpdateFiles', () => {
    it('should return empty array when no updates exist', async () => {
      const files = await updateManager.listFolderUpdateFiles(sdId);
      expect(files).toEqual([]);
    });

    it('should list all folder update files with metadata', async () => {
      await sdStructure.initialize();

      await updateManager.writeFolderUpdate('sd-test', new Uint8Array([1]));
      await new Promise((resolve) => setTimeout(resolve, 10));
      await updateManager.writeFolderUpdate('sd-test', new Uint8Array([2]));

      const files = await updateManager.listFolderUpdateFiles(sdId);

      expect(files).toHaveLength(2);
      expect(files[0]?.instanceId).toBe(instanceId);
      expect(files[0]?.documentId).toBe('sd-test');
      if (files[0] && files[1]) {
        expect(files[0].timestamp).toBeLessThan(files[1].timestamp);
      }
    });
  });

  describe('deleteUpdateFiles', () => {
    it('should delete specified files', async () => {
      const noteId = 'note-123' as UUID;

      const filename1 = await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([1]));
      await new Promise((resolve) => setTimeout(resolve, 2));
      const filename2 = await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([2]));

      const path1 = `/test/sd/notes/note-123/updates/${filename1}`;
      const path2 = `/test/sd/notes/note-123/updates/${filename2}`;

      expect(fs.hasFile(path1)).toBe(true);
      expect(fs.hasFile(path2)).toBe(true);

      await updateManager.deleteUpdateFiles([path1]);

      expect(fs.hasFile(path1)).toBe(false);
      expect(fs.hasFile(path2)).toBe(true);
    });

    it('should handle errors gracefully when deleting non-existent files', async () => {
      // Should not throw
      await expect(
        updateManager.deleteUpdateFiles(['/non/existent/file.yjson'])
      ).resolves.toBeUndefined();
    });
  });

  describe('integration with CRDT', () => {
    it('should round-trip note data through file system', async () => {
      const noteId = 'note-integration' as UUID;
      const noteDoc1 = new NoteDoc(noteId);
      noteDoc1.initializeNote({
        id: noteId,
        created: 1234567890,
        modified: 1234567890,
        folderId: 'folder-1' as UUID,
        deleted: false,
      });

      // Write update
      const update = noteDoc1.encodeStateAsUpdate();
      await updateManager.writeNoteUpdate(sdId, noteId, update);

      // Read updates
      const updates = await updateManager.readNoteUpdates(sdId, noteId);
      expect(updates).toHaveLength(1);

      // Apply to new document
      const noteDoc2 = new NoteDoc(noteId);
      if (updates[0]) {
        noteDoc2.applyUpdate(updates[0]);
      }

      // Verify data
      const metadata = noteDoc2.getMetadata();
      expect(metadata.id).toBe(noteId);
      expect(metadata.created).toBe(1234567890);
      expect(metadata.folderId).toBe('folder-1');

      noteDoc1.destroy();
      noteDoc2.destroy();
    });
  });
});
