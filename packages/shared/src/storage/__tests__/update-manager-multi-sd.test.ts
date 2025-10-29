import { UpdateManager } from '../update-manager';
import type { FileSystemAdapter } from '../types';

/**
 * Tests for Multi-SD UpdateManager functionality
 *
 * Verifies that UpdateManager can handle multiple Storage Directories
 * and route note operations to the correct SD paths.
 */
describe('UpdateManager - Multi-SD Support', () => {
  let updateManager: UpdateManager;
  let mockFs: FileSystemAdapter;
  const instanceId = 'test-instance';

  beforeEach(() => {
    // Create mock filesystem with in-memory storage
    const files = new Map<string, Uint8Array>();
    const dirs = new Set<string>();

    mockFs = {
      readFile: async (path: string) => {
        const data = files.get(path);
        if (!data) throw new Error(`File not found: ${path}`);
        return data;
      },
      writeFile: async (path: string, data: Uint8Array) => {
        files.set(path, data);
      },
      deleteFile: async (path: string) => {
        files.delete(path);
      },
      exists: async (path: string) => {
        return files.has(path) || dirs.has(path);
      },
      mkdir: async (path: string) => {
        dirs.add(path);
      },
      listFiles: async (path: string) => {
        const results: string[] = [];
        for (const filePath of files.keys()) {
          if (filePath.startsWith(path + '/')) {
            const relativePath = filePath.substring(path.length + 1);
            const firstSlash = relativePath.indexOf('/');
            if (firstSlash === -1) {
              results.push(relativePath);
            }
          }
        }
        return results;
      },
      joinPath: (...parts: string[]) => parts.join('/'),
    };

    updateManager = new UpdateManager(mockFs, instanceId);
  });

  describe('registerSD', () => {
    it('should register a Storage Directory', () => {
      updateManager.registerSD('sd-1', '/path/to/sd1');

      // Verify by attempting to write a note to this SD
      expect(async () => {
        await updateManager.writeNoteUpdate('sd-1', 'note-1', new Uint8Array([1, 2, 3]));
      }).not.toThrow();
    });

    it('should allow registering multiple Storage Directories', async () => {
      updateManager.registerSD('sd-1', '/path/to/sd1');
      updateManager.registerSD('sd-2', '/path/to/sd2');

      // Should be able to write to both
      await updateManager.writeNoteUpdate('sd-1', 'note-1', new Uint8Array([1, 2, 3]));
      await updateManager.writeNoteUpdate('sd-2', 'note-2', new Uint8Array([4, 5, 6]));

      // Verify files written to different paths
      const updates1 = await updateManager.readNoteUpdates('sd-1', 'note-1');
      const updates2 = await updateManager.readNoteUpdates('sd-2', 'note-2');

      expect(updates1).toHaveLength(1);
      expect(updates2).toHaveLength(1);
    });

    it('should overwrite existing SD registration with same ID', async () => {
      updateManager.registerSD('sd-1', '/old/path');
      updateManager.registerSD('sd-1', '/new/path');

      // Write to the SD
      const update = new Uint8Array([1, 2, 3]);
      await updateManager.writeNoteUpdate('sd-1', 'note-1', update);

      // Should be able to read it back (proves new registration works)
      const updates = await updateManager.readNoteUpdates('sd-1', 'note-1');
      expect(updates).toHaveLength(1);
      expect(updates[0]).toEqual(update);
    });
  });

  describe('unregisterSD', () => {
    it('should unregister a Storage Directory', async () => {
      updateManager.registerSD('sd-1', '/path/to/sd1');
      updateManager.unregisterSD('sd-1');

      // Attempting to write should throw
      await expect(
        updateManager.writeNoteUpdate('sd-1', 'note-1', new Uint8Array([1, 2, 3]))
      ).rejects.toThrow('Storage Directory not registered: sd-1');
    });

    it('should handle unregistering non-existent SD gracefully', () => {
      expect(() => updateManager.unregisterSD('non-existent')).not.toThrow();
    });
  });

  describe('writeNoteUpdate', () => {
    it('should write note update to correct SD', async () => {
      updateManager.registerSD('sd-1', '/path/to/sd1');
      updateManager.registerSD('sd-2', '/path/to/sd2');

      const update1 = new Uint8Array([1, 2, 3]);
      const update2 = new Uint8Array([4, 5, 6]);

      await updateManager.writeNoteUpdate('sd-1', 'note-1', update1);
      await updateManager.writeNoteUpdate('sd-2', 'note-2', update2);

      const read1 = await updateManager.readNoteUpdates('sd-1', 'note-1');
      const read2 = await updateManager.readNoteUpdates('sd-2', 'note-2');

      expect(read1).toHaveLength(1);
      expect(read2).toHaveLength(1);
      expect(read1[0]).toEqual(update1);
      expect(read2[0]).toEqual(update2);
    });

    it('should throw error for unregistered SD', async () => {
      await expect(
        updateManager.writeNoteUpdate('unregistered', 'note-1', new Uint8Array([1, 2, 3]))
      ).rejects.toThrow('Storage Directory not registered: unregistered');
    });

    it('should support multiple updates to same note in same SD', async () => {
      updateManager.registerSD('sd-1', '/path/to/sd1');

      const update1 = new Uint8Array([1, 2, 3]);
      const update2 = new Uint8Array([4, 5, 6]);
      const update3 = new Uint8Array([7, 8, 9]);

      await updateManager.writeNoteUpdate('sd-1', 'note-1', update1);
      await updateManager.writeNoteUpdate('sd-1', 'note-1', update2);
      await updateManager.writeNoteUpdate('sd-1', 'note-1', update3);

      const updates = await updateManager.readNoteUpdates('sd-1', 'note-1');

      expect(updates).toHaveLength(3);
      expect(updates[0]).toEqual(update1);
      expect(updates[1]).toEqual(update2);
      expect(updates[2]).toEqual(update3);
    });
  });

  describe('readNoteUpdates', () => {
    it('should read updates from correct SD', async () => {
      updateManager.registerSD('sd-1', '/path/to/sd1');
      updateManager.registerSD('sd-2', '/path/to/sd2');

      const update1 = new Uint8Array([1, 2, 3]);
      const update2 = new Uint8Array([4, 5, 6]);

      await updateManager.writeNoteUpdate('sd-1', 'note-1', update1);
      await updateManager.writeNoteUpdate('sd-2', 'note-1', update2);

      const read1 = await updateManager.readNoteUpdates('sd-1', 'note-1');
      const read2 = await updateManager.readNoteUpdates('sd-2', 'note-1');

      // Same note ID in different SDs should return different updates
      expect(read1[0]).toEqual(update1);
      expect(read2[0]).toEqual(update2);
      expect(read1[0]).not.toEqual(read2[0]);
    });

    it('should return empty array for non-existent note', async () => {
      updateManager.registerSD('sd-1', '/path/to/sd1');

      const updates = await updateManager.readNoteUpdates('sd-1', 'non-existent');

      expect(updates).toEqual([]);
    });

    it('should throw error for unregistered SD', async () => {
      await expect(
        updateManager.readNoteUpdates('unregistered', 'note-1')
      ).rejects.toThrow('Storage Directory not registered: unregistered');
    });
  });

  describe('listNoteUpdateFiles', () => {
    it('should list update files from correct SD', async () => {
      updateManager.registerSD('sd-1', '/path/to/sd1');
      updateManager.registerSD('sd-2', '/path/to/sd2');

      await updateManager.writeNoteUpdate('sd-1', 'note-1', new Uint8Array([1, 2, 3]));
      await updateManager.writeNoteUpdate('sd-1', 'note-1', new Uint8Array([4, 5, 6]));
      await updateManager.writeNoteUpdate('sd-2', 'note-1', new Uint8Array([7, 8, 9]));

      const files1 = await updateManager.listNoteUpdateFiles('sd-1', 'note-1');
      const files2 = await updateManager.listNoteUpdateFiles('sd-2', 'note-1');

      expect(files1).toHaveLength(2);
      expect(files2).toHaveLength(1);
    });
  });

  describe('SD isolation', () => {
    it('should keep notes in different SDs completely isolated', async () => {
      updateManager.registerSD('sd-personal', '/home/user/personal');
      updateManager.registerSD('sd-work', '/home/user/work');

      // Create notes with same ID in different SDs
      await updateManager.writeNoteUpdate('sd-personal', 'note-123', new Uint8Array([1, 2, 3]));
      await updateManager.writeNoteUpdate('sd-work', 'note-123', new Uint8Array([9, 8, 7]));

      const personalUpdates = await updateManager.readNoteUpdates('sd-personal', 'note-123');
      const workUpdates = await updateManager.readNoteUpdates('sd-work', 'note-123');

      // Should be completely different
      expect(personalUpdates).toHaveLength(1);
      expect(workUpdates).toHaveLength(1);
      expect(personalUpdates[0]).toEqual(new Uint8Array([1, 2, 3]));
      expect(workUpdates[0]).toEqual(new Uint8Array([9, 8, 7]));
    });
  });
});
