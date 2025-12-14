/**
 * File Scanner Tests
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { scanDirectory, scanSingleFile, scanPath, getUniqueFolderPaths } from '../file-scanner';

describe('File Scanner', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'import-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('scanSingleFile', () => {
    it('scans a single markdown file', async () => {
      const filePath = path.join(tempDir, 'test.md');
      await fs.writeFile(filePath, '# Hello World\n\nThis is a test.');

      const result = await scanSingleFile(filePath);

      expect(result.isDirectory).toBe(false);
      expect(result.totalFiles).toBe(1);
      expect(result.files).toHaveLength(1);
      expect(result.files[0]!.name).toBe('test');
      expect(result.files[0]!.relativePath).toBe('');
      expect(result.files[0]!.parentPath).toBe('');
      expect(result.tree.isFolder).toBe(false);
      expect(result.tree.file).toBeDefined();
    });

    it('scans a .markdown file', async () => {
      const filePath = path.join(tempDir, 'test.markdown');
      await fs.writeFile(filePath, '# Test');

      const result = await scanSingleFile(filePath);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0]!.name).toBe('test');
    });

    it('throws for non-markdown files', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello');

      await expect(scanSingleFile(filePath)).rejects.toThrow('not a markdown file');
    });

    it('throws for directories', async () => {
      const dirPath = path.join(tempDir, 'subdir');
      await fs.mkdir(dirPath);

      await expect(scanSingleFile(dirPath)).rejects.toThrow('not a file');
    });
  });

  describe('scanDirectory', () => {
    it('scans an empty directory', async () => {
      const result = await scanDirectory(tempDir);

      expect(result.isDirectory).toBe(true);
      expect(result.totalFiles).toBe(0);
      expect(result.files).toHaveLength(0);
      expect(result.tree.isFolder).toBe(true);
      expect(result.tree.children).toHaveLength(0);
    });

    it('scans a directory with markdown files', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.md'), '# File 1');
      await fs.writeFile(path.join(tempDir, 'file2.md'), '# File 2');
      await fs.writeFile(path.join(tempDir, 'readme.txt'), 'Ignored');

      const result = await scanDirectory(tempDir);

      expect(result.totalFiles).toBe(2);
      expect(result.files.map((f) => f.name).sort()).toEqual(['file1', 'file2']);
    });

    it('scans nested directories', async () => {
      await fs.mkdir(path.join(tempDir, 'docs'));
      await fs.mkdir(path.join(tempDir, 'docs', 'guides'));
      await fs.writeFile(path.join(tempDir, 'root.md'), '# Root');
      await fs.writeFile(path.join(tempDir, 'docs', 'intro.md'), '# Intro');
      await fs.writeFile(path.join(tempDir, 'docs', 'guides', 'setup.md'), '# Setup');

      const result = await scanDirectory(tempDir);

      expect(result.totalFiles).toBe(3);
      expect(result.files.map((f) => f.relativePath).sort()).toEqual([
        'docs/guides/setup.md',
        'docs/intro.md',
        'root.md',
      ]);
    });

    it('sets correct parent paths', async () => {
      await fs.mkdir(path.join(tempDir, 'docs'));
      await fs.writeFile(path.join(tempDir, 'root.md'), '# Root');
      await fs.writeFile(path.join(tempDir, 'docs', 'nested.md'), '# Nested');

      const result = await scanDirectory(tempDir);

      const rootFile = result.files.find((f) => f.name === 'root');
      const nestedFile = result.files.find((f) => f.name === 'nested');

      expect(rootFile?.parentPath).toBe('');
      expect(nestedFile?.parentPath).toBe('docs');
    });

    it('skips hidden files and directories', async () => {
      await fs.writeFile(path.join(tempDir, '.hidden.md'), '# Hidden');
      await fs.mkdir(path.join(tempDir, '.hidden-dir'));
      await fs.writeFile(path.join(tempDir, '.hidden-dir', 'file.md'), '# File');
      await fs.writeFile(path.join(tempDir, 'visible.md'), '# Visible');

      const result = await scanDirectory(tempDir);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0]!.name).toBe('visible');
    });

    it('skips node_modules directory', async () => {
      await fs.mkdir(path.join(tempDir, 'node_modules'));
      await fs.writeFile(path.join(tempDir, 'node_modules', 'package.md'), '# Package');
      await fs.writeFile(path.join(tempDir, 'main.md'), '# Main');

      const result = await scanDirectory(tempDir);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0]!.name).toBe('main');
    });

    it('skips .git directory', async () => {
      await fs.mkdir(path.join(tempDir, '.git'));
      await fs.writeFile(path.join(tempDir, '.git', 'config.md'), '# Config');
      await fs.writeFile(path.join(tempDir, 'main.md'), '# Main');

      const result = await scanDirectory(tempDir);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0]!.name).toBe('main');
    });

    it('excludes empty folders from tree', async () => {
      await fs.mkdir(path.join(tempDir, 'empty'));
      await fs.mkdir(path.join(tempDir, 'has-files'));
      await fs.writeFile(path.join(tempDir, 'has-files', 'file.md'), '# File');

      const result = await scanDirectory(tempDir);

      // Tree should only include 'has-files' folder, not 'empty'
      const folderNames = result.tree.children?.filter((c) => c.isFolder).map((c) => c.name) ?? [];
      expect(folderNames).toEqual(['has-files']);
    });

    it('calculates total size correctly', async () => {
      const content1 = '# File 1\n\nSome content here.';
      const content2 = '# File 2\n\nMore content.';
      await fs.writeFile(path.join(tempDir, 'file1.md'), content1);
      await fs.writeFile(path.join(tempDir, 'file2.md'), content2);

      const result = await scanDirectory(tempDir);

      expect(result.totalSize).toBe(content1.length + content2.length);
    });

    it('throws for non-directory paths', async () => {
      const filePath = path.join(tempDir, 'file.md');
      await fs.writeFile(filePath, '# Test');

      await expect(scanDirectory(filePath)).rejects.toThrow('not a directory');
    });
  });

  describe('scanPath', () => {
    it('auto-detects and scans a file', async () => {
      const filePath = path.join(tempDir, 'test.md');
      await fs.writeFile(filePath, '# Test');

      const result = await scanPath(filePath);

      expect(result.isDirectory).toBe(false);
      expect(result.totalFiles).toBe(1);
    });

    it('auto-detects and scans a directory', async () => {
      await fs.writeFile(path.join(tempDir, 'test.md'), '# Test');

      const result = await scanPath(tempDir);

      expect(result.isDirectory).toBe(true);
      expect(result.totalFiles).toBe(1);
    });
  });

  describe('getUniqueFolderPaths', () => {
    it('returns empty array for root-level files', () => {
      const files = [
        {
          absolutePath: '/a.md',
          relativePath: 'a.md',
          name: 'a',
          parentPath: '',
          size: 0,
          modifiedAt: 0,
        },
        {
          absolutePath: '/b.md',
          relativePath: 'b.md',
          name: 'b',
          parentPath: '',
          size: 0,
          modifiedAt: 0,
        },
      ];

      const folders = getUniqueFolderPaths(files);

      expect(folders).toEqual([]);
    });

    it('extracts unique folder paths', () => {
      const files = [
        {
          absolutePath: '/docs/a.md',
          relativePath: 'docs/a.md',
          name: 'a',
          parentPath: 'docs',
          size: 0,
          modifiedAt: 0,
        },
        {
          absolutePath: '/docs/b.md',
          relativePath: 'docs/b.md',
          name: 'b',
          parentPath: 'docs',
          size: 0,
          modifiedAt: 0,
        },
      ];

      const folders = getUniqueFolderPaths(files);

      expect(folders).toEqual(['docs']);
    });

    it('includes ancestor paths', () => {
      const files = [
        {
          absolutePath: '/docs/guides/setup.md',
          relativePath: 'docs/guides/setup.md',
          name: 'setup',
          parentPath: 'docs/guides',
          size: 0,
          modifiedAt: 0,
        },
      ];

      const folders = getUniqueFolderPaths(files);

      expect(folders).toEqual(['docs', 'docs/guides']);
    });

    it('sorts by depth then alphabetically', () => {
      const files = [
        {
          absolutePath: '/b/deep/file.md',
          relativePath: 'b/deep/file.md',
          name: 'file',
          parentPath: 'b/deep',
          size: 0,
          modifiedAt: 0,
        },
        {
          absolutePath: '/a/file.md',
          relativePath: 'a/file.md',
          name: 'file',
          parentPath: 'a',
          size: 0,
          modifiedAt: 0,
        },
        {
          absolutePath: '/c/deeper/nest/file.md',
          relativePath: 'c/deeper/nest/file.md',
          name: 'file',
          parentPath: 'c/deeper/nest',
          size: 0,
          modifiedAt: 0,
        },
      ];

      const folders = getUniqueFolderPaths(files);

      // Depth 1 first (a, b, c), then depth 2 (b/deep, c/deeper), then depth 3
      expect(folders).toEqual(['a', 'b', 'c', 'b/deep', 'c/deeper', 'c/deeper/nest']);
    });
  });
});
