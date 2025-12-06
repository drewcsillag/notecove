/**
 * Tests for NodeFileSystemAdapter
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { NodeFileSystemAdapter } from '../node-fs-adapter';

describe('NodeFileSystemAdapter', () => {
  let adapter: NodeFileSystemAdapter;
  let testDir: string;

  beforeEach(async () => {
    adapter = new NodeFileSystemAdapter();
    // Create a unique temp directory for each test
    testDir = await fs.mkdtemp(join(tmpdir(), 'node-fs-adapter-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const filePath = join(testDir, 'existing.txt');
      await fs.writeFile(filePath, 'content');

      const result = await adapter.exists(filePath);

      expect(result).toBe(true);
    });

    it('should return true for existing directory', async () => {
      const dirPath = join(testDir, 'existing-dir');
      await fs.mkdir(dirPath);

      const result = await adapter.exists(dirPath);

      expect(result).toBe(true);
    });

    it('should return false for non-existent path', async () => {
      const fakePath = join(testDir, 'non-existent.txt');

      const result = await adapter.exists(fakePath);

      expect(result).toBe(false);
    });
  });

  describe('mkdir', () => {
    it('should create a directory', async () => {
      const dirPath = join(testDir, 'new-dir');

      await adapter.mkdir(dirPath);

      const stat = await fs.stat(dirPath);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should create nested directories', async () => {
      const nestedPath = join(testDir, 'a', 'b', 'c');

      await adapter.mkdir(nestedPath);

      const stat = await fs.stat(nestedPath);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should not throw if directory already exists', async () => {
      const dirPath = join(testDir, 'existing');
      await fs.mkdir(dirPath);

      // Should not throw
      await expect(adapter.mkdir(dirPath)).resolves.toBeUndefined();
    });
  });

  describe('readFile and writeFile for non-yjson files', () => {
    it('should write and read plain text file', async () => {
      const filePath = join(testDir, 'test.txt');
      const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

      await adapter.writeFile(filePath, data);
      const result = await adapter.readFile(filePath);

      expect(result).toEqual(data);
    });

    it('should write and read binary file', async () => {
      const filePath = join(testDir, 'test.bin');
      const data = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe]);

      await adapter.writeFile(filePath, data);
      const result = await adapter.readFile(filePath);

      expect(result).toEqual(data);
    });

    it('should create parent directories when writing', async () => {
      const filePath = join(testDir, 'subdir', 'nested', 'test.txt');
      const data = new Uint8Array([1, 2, 3]);

      await adapter.writeFile(filePath, data);

      const exists = await adapter.exists(filePath);
      expect(exists).toBe(true);
    });
  });

  describe('readFile and writeFile for .yjson files (flag byte protocol)', () => {
    it('should write with flag byte and read stripped data', async () => {
      const filePath = join(testDir, 'note.yjson');
      const data = new Uint8Array([10, 20, 30, 40, 50]);

      await adapter.writeFile(filePath, data);
      const result = await adapter.readFile(filePath);

      // Read should return original data (flag byte stripped)
      expect(result).toEqual(data);
    });

    it('should handle .yjson.zst compressed files', async () => {
      const filePath = join(testDir, 'snapshot.yjson.zst');
      const data = new Uint8Array([1, 2, 3, 4, 5]);

      await adapter.writeFile(filePath, data);
      const result = await adapter.readFile(filePath);

      expect(result).toEqual(data);
    });

    it('should throw error for empty yjson file', async () => {
      const filePath = join(testDir, 'empty.yjson');
      // Write an empty file directly without going through adapter
      await fs.writeFile(filePath, Buffer.alloc(0));

      await expect(adapter.readFile(filePath)).rejects.toThrow('File is empty');
    });

    it('should throw error for incomplete file (flag byte 0x00)', async () => {
      const filePath = join(testDir, 'incomplete.yjson');
      // Write file with 0x00 flag byte (still being written)
      await fs.writeFile(filePath, Buffer.from([0x00, 0x01, 0x02]));

      await expect(adapter.readFile(filePath)).rejects.toThrow('File is incomplete');
    });

    it('should throw error for invalid flag byte', async () => {
      const filePath = join(testDir, 'invalid.yjson');
      // Write file with invalid flag byte (not 0x00 or 0x01)
      await fs.writeFile(filePath, Buffer.from([0x42, 0x01, 0x02]));

      await expect(adapter.readFile(filePath)).rejects.toThrow('Invalid file format');
    });

    it('should read file with valid flag byte (0x01)', async () => {
      const filePath = join(testDir, 'valid.yjson');
      // Write file with valid flag byte
      await fs.writeFile(filePath, Buffer.from([0x01, 0x10, 0x20, 0x30]));

      const result = await adapter.readFile(filePath);

      expect(result).toEqual(new Uint8Array([0x10, 0x20, 0x30]));
    });
  });

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      const filePath = join(testDir, 'to-delete.txt');
      await fs.writeFile(filePath, 'content');

      await adapter.deleteFile(filePath);

      const exists = await adapter.exists(filePath);
      expect(exists).toBe(false);
    });

    it('should throw error for non-existent file', async () => {
      const fakePath = join(testDir, 'non-existent.txt');

      await expect(adapter.deleteFile(fakePath)).rejects.toThrow();
    });
  });

  describe('listFiles', () => {
    it('should list files in directory', async () => {
      await fs.writeFile(join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(join(testDir, 'file2.txt'), 'content2');
      await fs.mkdir(join(testDir, 'subdir'));

      const files = await adapter.listFiles(testDir);

      expect(files).toContain('file1.txt');
      expect(files).toContain('file2.txt');
      expect(files).toContain('subdir');
    });

    it('should return empty array for empty directory', async () => {
      const emptyDir = join(testDir, 'empty');
      await fs.mkdir(emptyDir);

      const files = await adapter.listFiles(emptyDir);

      expect(files).toEqual([]);
    });
  });

  describe('joinPath', () => {
    it('should join path segments', () => {
      const result = adapter.joinPath('a', 'b', 'c');

      expect(result).toBe(join('a', 'b', 'c'));
    });

    it('should handle single segment', () => {
      const result = adapter.joinPath('single');

      expect(result).toBe('single');
    });

    it('should handle absolute paths', () => {
      const result = adapter.joinPath('/root', 'dir', 'file.txt');

      expect(result).toBe('/root/dir/file.txt');
    });
  });

  describe('basename', () => {
    it('should return file name from path', () => {
      const result = adapter.basename('/path/to/file.txt');

      expect(result).toBe('file.txt');
    });

    it('should return directory name from path', () => {
      const result = adapter.basename('/path/to/directory');

      expect(result).toBe('directory');
    });

    it('should handle path with no directory', () => {
      const result = adapter.basename('filename.txt');

      expect(result).toBe('filename.txt');
    });
  });

  describe('stat', () => {
    it('should return file stats', async () => {
      const filePath = join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'hello world');

      const stats = await adapter.stat(filePath);

      expect(stats.size).toBe(11); // "hello world" = 11 bytes
      expect(typeof stats.mtimeMs).toBe('number');
      expect(typeof stats.ctimeMs).toBe('number');
    });

    it('should return directory stats', async () => {
      const stats = await adapter.stat(testDir);

      expect(typeof stats.size).toBe('number');
      expect(typeof stats.mtimeMs).toBe('number');
      expect(typeof stats.ctimeMs).toBe('number');
    });

    it('should throw error for non-existent path', async () => {
      const fakePath = join(testDir, 'non-existent.txt');

      await expect(adapter.stat(fakePath)).rejects.toThrow();
    });
  });

  describe('appendFile', () => {
    it('should append data to file', async () => {
      const filePath = join(testDir, 'append.txt');
      await fs.writeFile(filePath, 'initial');

      await adapter.appendFile(filePath, new Uint8Array([65, 66, 67])); // "ABC"

      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('initialABC');
    });

    it('should create file if it does not exist', async () => {
      const filePath = join(testDir, 'new-append.txt');

      await adapter.appendFile(filePath, new Uint8Array([88, 89, 90])); // "XYZ"

      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('XYZ');
    });

    it('should create parent directories when appending', async () => {
      const filePath = join(testDir, 'sub', 'dir', 'append.txt');

      await adapter.appendFile(filePath, new Uint8Array([1, 2, 3]));

      const exists = await adapter.exists(filePath);
      expect(exists).toBe(true);
    });
  });
});
