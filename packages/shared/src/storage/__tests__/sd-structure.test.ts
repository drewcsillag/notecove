import { SyncDirectoryStructure } from '../sd-structure';
import type { FileSystemAdapter, SyncDirectoryConfig } from '../types';
import type { UUID } from '../../types';

/**
 * Mock file system adapter for testing
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
    const storedData = this.files.get(path);
    if (!storedData) {
      throw new Error(`File not found: ${path}`);
    }

    // Check for empty file
    if (storedData.length === 0) {
      throw new Error(`File is empty: ${path}`);
    }

    // Check flag byte (first byte of file)
    const flagByte = storedData[0];

    if (flagByte === 0x00) {
      // File is still being written
      throw new Error(`File is incomplete (still being written): ${path}`);
    }

    if (flagByte !== 0x01) {
      // Invalid flag byte - file may be corrupted or from old version
      throw new Error(`Invalid file format (flag byte: 0x${flagByte.toString(16)}): ${path}`);
    }

    // Return actual data (strip flag byte)
    return storedData.subarray(1);
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    // Prepend 0x01 flag byte (ready) to simulate the flag byte protocol
    const flaggedData = new Uint8Array(1 + data.length);
    flaggedData[0] = 0x01; // Ready flag
    flaggedData.set(data, 1);
    this.files.set(path, flaggedData);
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
  }

  async listFiles(path: string): Promise<string[]> {
    const result: string[] = [];
    const prefix = path + '/';

    // List directories
    for (const dir of this.dirs) {
      if (dir.startsWith(prefix) && !dir.slice(prefix.length).includes('/')) {
        result.push(dir.slice(prefix.length));
      }
    }

    // List files
    for (const file of this.files.keys()) {
      if (file.startsWith(prefix) && !file.slice(prefix.length).includes('/')) {
        result.push(file.slice(prefix.length));
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

  getDir(path: string): boolean {
    return this.dirs.has(path);
  }
}

describe('SyncDirectoryStructure', () => {
  let fs: MockFileSystemAdapter;
  let config: SyncDirectoryConfig;
  let sdStructure: SyncDirectoryStructure;

  beforeEach(() => {
    fs = new MockFileSystemAdapter();
    config = {
      id: 'sd-test',
      path: '/test/sd',
      label: 'Test SD',
    };
    sdStructure = new SyncDirectoryStructure(fs, config);
  });

  describe('getPaths', () => {
    it('should return correct SD paths', () => {
      const paths = sdStructure.getPaths();

      expect(paths.root).toBe('/test/sd');
      expect(paths.notes).toBe('/test/sd/notes');
      expect(paths.folders).toBe('/test/sd/folders');
    });
  });

  describe('getNotePaths', () => {
    it('should return correct note paths', () => {
      const noteId = 'note-123' as UUID;
      const paths = sdStructure.getNotePaths(noteId);

      expect(paths.root).toBe('/test/sd/notes/note-123');
      expect(paths.updates).toBe('/test/sd/notes/note-123/updates');
      expect(paths.meta).toBe('/test/sd/notes/note-123/meta');
    });
  });

  describe('getFolderPaths', () => {
    it('should return correct folder paths', () => {
      const paths = sdStructure.getFolderPaths();

      expect(paths.root).toBe('/test/sd/folders');
      expect(paths.updates).toBe('/test/sd/folders/updates');
      expect(paths.meta).toBe('/test/sd/folders/meta');
    });
  });

  describe('initialize', () => {
    it('should create all necessary directories', async () => {
      await sdStructure.initialize();

      expect(fs.getDir('/test/sd')).toBe(true);
      expect(fs.getDir('/test/sd/notes')).toBe(true);
      expect(fs.getDir('/test/sd/folders')).toBe(true);
      expect(fs.getDir('/test/sd/folders/updates')).toBe(true);
      expect(fs.getDir('/test/sd/folders/meta')).toBe(true);
    });
  });

  describe('initializeNote', () => {
    it('should create note directories', async () => {
      const noteId = 'note-123' as UUID;
      await sdStructure.initializeNote(noteId);

      expect(fs.getDir('/test/sd/notes/note-123')).toBe(true);
      expect(fs.getDir('/test/sd/notes/note-123/updates')).toBe(true);
      expect(fs.getDir('/test/sd/notes/note-123/meta')).toBe(true);
    });
  });

  describe('exists', () => {
    it('should return false when SD structure does not exist', async () => {
      const exists = await sdStructure.exists();
      expect(exists).toBe(false);
    });

    it('should return true when SD structure exists', async () => {
      await sdStructure.initialize();
      const exists = await sdStructure.exists();
      expect(exists).toBe(true);
    });

    it('should return false when partially initialized', async () => {
      await fs.mkdir('/test/sd');
      await fs.mkdir('/test/sd/notes');
      // Missing folders directory

      const exists = await sdStructure.exists();
      expect(exists).toBe(false);
    });
  });

  describe('noteExists', () => {
    it('should return false when note does not exist', async () => {
      const noteId = 'note-123' as UUID;
      const exists = await sdStructure.noteExists(noteId);
      expect(exists).toBe(false);
    });

    it('should return true when note exists', async () => {
      const noteId = 'note-123' as UUID;
      await sdStructure.initializeNote(noteId);
      const exists = await sdStructure.noteExists(noteId);
      expect(exists).toBe(true);
    });
  });

  describe('listNotes', () => {
    it('should return empty array when no notes exist', async () => {
      const notes = await sdStructure.listNotes();
      expect(notes).toEqual([]);
    });

    it('should return empty array when notes directory does not exist', async () => {
      const notes = await sdStructure.listNotes();
      expect(notes).toEqual([]);
    });

    it('should list all note IDs', async () => {
      await sdStructure.initialize();
      await sdStructure.initializeNote('note-1' as UUID);
      await sdStructure.initializeNote('note-2' as UUID);
      await sdStructure.initializeNote('note-3' as UUID);

      const notes = await sdStructure.listNotes();
      expect(notes).toHaveLength(3);
      expect(notes).toContain('note-1');
      expect(notes).toContain('note-2');
      expect(notes).toContain('note-3');
    });
  });

  describe('getNoteUpdateFilePath', () => {
    it('should return correct update file path', () => {
      const noteId = 'note-123' as UUID;
      const filename = 'inst-1_note-123_1234567890.yjson';

      const filePath = sdStructure.getNoteUpdateFilePath(noteId, filename);
      expect(filePath).toBe('/test/sd/notes/note-123/updates/inst-1_note-123_1234567890.yjson');
    });
  });

  describe('getFolderUpdateFilePath', () => {
    it('should return correct folder update file path', () => {
      const filename = 'inst-1_folder-tree_sd-test_1234567890.yjson';

      const filePath = sdStructure.getFolderUpdateFilePath(filename);
      expect(filePath).toBe('/test/sd/folders/updates/inst-1_folder-tree_sd-test_1234567890.yjson');
    });
  });
});
