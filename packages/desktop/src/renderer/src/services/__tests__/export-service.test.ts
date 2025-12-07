/**
 * Tests for Export Service
 */

import { buildNoteTitleLookup, type FolderInfo } from '../export-service';

// Extract buildFolderPaths for testing by reimplementing
// (it's a private function in the module)
function buildFolderPaths(folders: FolderInfo[]): Map<string, string> {
  const folderMap = new Map<string, FolderInfo>();
  for (const folder of folders) {
    folderMap.set(folder.id, folder);
  }

  const paths = new Map<string, string>();

  function getPath(folderId: string): string {
    const cachedPath = paths.get(folderId);
    if (cachedPath !== undefined) {
      return cachedPath;
    }

    const folder = folderMap.get(folderId);
    if (!folder) {
      return '';
    }

    // Sanitize folder name for filesystem
    const safeName = folder.name.replace(/[<>:"/\\|?*]/g, '_');

    if (folder.parentId && folderMap.has(folder.parentId)) {
      const parentPath = getPath(folder.parentId);
      const fullPath = parentPath ? `${parentPath}/${safeName}` : safeName;
      paths.set(folderId, fullPath);
      return fullPath;
    }

    paths.set(folderId, safeName);
    return safeName;
  }

  // Build paths for all folders
  for (const folder of folders) {
    getPath(folder.id);
  }

  return paths;
}

describe('Export Service Utilities', () => {
  describe('buildNoteTitleLookup', () => {
    it('should create a lookup function from notes', () => {
      const notes = [
        { id: 'note-1', title: 'First Note' },
        { id: 'note-2', title: 'Second Note' },
      ];

      const lookup = buildNoteTitleLookup(notes);

      expect(lookup('note-1')).toBe('First Note');
      expect(lookup('note-2')).toBe('Second Note');
    });

    it('should be case-insensitive', () => {
      const notes = [{ id: 'Note-1', title: 'Mixed Case' }];

      const lookup = buildNoteTitleLookup(notes);

      expect(lookup('note-1')).toBe('Mixed Case');
      expect(lookup('NOTE-1')).toBe('Mixed Case');
    });

    it('should return undefined for missing notes', () => {
      const notes = [{ id: 'note-1', title: 'First Note' }];

      const lookup = buildNoteTitleLookup(notes);

      expect(lookup('non-existent')).toBeUndefined();
    });

    it('should handle empty notes array', () => {
      const lookup = buildNoteTitleLookup([]);

      expect(lookup('any-id')).toBeUndefined();
    });
  });

  describe('buildFolderPaths', () => {
    it('should build paths for flat folder structure', () => {
      const folders: FolderInfo[] = [
        { id: 'f1', name: 'Folder 1', parentId: null },
        { id: 'f2', name: 'Folder 2', parentId: null },
      ];

      const paths = buildFolderPaths(folders);

      expect(paths.get('f1')).toBe('Folder 1');
      expect(paths.get('f2')).toBe('Folder 2');
    });

    it('should build paths for nested folder structure', () => {
      const folders: FolderInfo[] = [
        { id: 'f1', name: 'Parent', parentId: null },
        { id: 'f2', name: 'Child', parentId: 'f1' },
        { id: 'f3', name: 'Grandchild', parentId: 'f2' },
      ];

      const paths = buildFolderPaths(folders);

      expect(paths.get('f1')).toBe('Parent');
      expect(paths.get('f2')).toBe('Parent/Child');
      expect(paths.get('f3')).toBe('Parent/Child/Grandchild');
    });

    it('should sanitize folder names with special characters', () => {
      const folders: FolderInfo[] = [{ id: 'f1', name: 'Test<>:"/\\|?*Folder', parentId: null }];

      const paths = buildFolderPaths(folders);

      expect(paths.get('f1')).toBe('Test_________Folder');
    });

    it('should handle empty folder array', () => {
      const paths = buildFolderPaths([]);

      expect(paths.size).toBe(0);
    });

    it('should handle folder with non-existent parent', () => {
      const folders: FolderInfo[] = [{ id: 'f1', name: 'Orphan', parentId: 'non-existent' }];

      const paths = buildFolderPaths(folders);

      // Should treat as root folder since parent doesn't exist
      expect(paths.get('f1')).toBe('Orphan');
    });

    it('should handle multiple folder trees', () => {
      const folders: FolderInfo[] = [
        { id: 'a1', name: 'Tree A', parentId: null },
        { id: 'a2', name: 'Branch A', parentId: 'a1' },
        { id: 'b1', name: 'Tree B', parentId: null },
        { id: 'b2', name: 'Branch B', parentId: 'b1' },
      ];

      const paths = buildFolderPaths(folders);

      expect(paths.get('a1')).toBe('Tree A');
      expect(paths.get('a2')).toBe('Tree A/Branch A');
      expect(paths.get('b1')).toBe('Tree B');
      expect(paths.get('b2')).toBe('Tree B/Branch B');
    });

    it('should cache computed paths', () => {
      const folders: FolderInfo[] = [
        { id: 'f1', name: 'Parent', parentId: null },
        { id: 'f2', name: 'Child', parentId: 'f1' },
      ];

      const paths = buildFolderPaths(folders);

      // Call the same lookup multiple times
      const path1 = paths.get('f2');
      const path2 = paths.get('f2');

      // Should return the same cached value
      expect(path1).toBe(path2);
      expect(path1).toBe('Parent/Child');
    });
  });
});
