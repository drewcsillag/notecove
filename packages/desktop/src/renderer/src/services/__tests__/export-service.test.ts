/**
 * Tests for Export Service
 */

import {
  buildNoteTitleLookup,
  exportNotes,
  exportAllNotes,
  type FolderInfo,
} from '../export-service';
import type { JSONContent } from '@tiptap/core';

// Mock window.electronAPI
const mockElectronAPI = {
  export: {
    selectDirectory: jest.fn(),
    getNotesForExport: jest.fn(),
    writeFile: jest.fn(),
    copyImageFile: jest.fn(),
    createDirectory: jest.fn(),
    showCompletionMessage: jest.fn(),
  },
};

// Set up global mock
beforeAll(() => {
  (global as any).window = {
    electronAPI: mockElectronAPI,
  };
});

afterEach(() => {
  jest.clearAllMocks();
});

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

describe('exportNotes', () => {
  const mockNoteContent: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Test content' }],
      },
    ],
  };

  it('should export single note successfully', async () => {
    mockElectronAPI.export.selectDirectory.mockResolvedValue('/export/path');
    mockElectronAPI.export.getNotesForExport.mockResolvedValue([
      { id: 'note-1', title: 'Test Note', content: mockNoteContent, folderId: null },
    ]);
    mockElectronAPI.export.writeFile.mockResolvedValue({ success: true });
    mockElectronAPI.export.showCompletionMessage.mockResolvedValue(undefined);

    const noteTitleLookup = buildNoteTitleLookup([{ id: 'note-1', title: 'Test Note' }]);
    const progressCallback = jest.fn();

    await exportNotes(['note-1'], noteTitleLookup, progressCallback);

    expect(mockElectronAPI.export.selectDirectory).toHaveBeenCalled();
    expect(mockElectronAPI.export.getNotesForExport).toHaveBeenCalledWith(['note-1']);
    expect(mockElectronAPI.export.writeFile).toHaveBeenCalledWith(
      '/export/path/Test Note.md',
      expect.stringContaining('Test content')
    );
    expect(progressCallback).toHaveBeenCalledWith({
      current: 1,
      total: 1,
      currentNoteName: 'Test Note',
    });
    expect(mockElectronAPI.export.showCompletionMessage).toHaveBeenCalled();
  });

  it('should handle user cancelling directory selection', async () => {
    mockElectronAPI.export.selectDirectory.mockResolvedValue(null);

    const noteTitleLookup = buildNoteTitleLookup([]);
    const progressCallback = jest.fn();

    await exportNotes(['note-1'], noteTitleLookup, progressCallback);

    expect(mockElectronAPI.export.selectDirectory).toHaveBeenCalled();
    expect(mockElectronAPI.export.getNotesForExport).not.toHaveBeenCalled();
    expect(mockElectronAPI.export.writeFile).not.toHaveBeenCalled();
  });

  it('should handle empty notes array', async () => {
    mockElectronAPI.export.selectDirectory.mockResolvedValue('/export/path');
    mockElectronAPI.export.getNotesForExport.mockResolvedValue([]);
    mockElectronAPI.export.showCompletionMessage.mockResolvedValue(undefined);

    const noteTitleLookup = buildNoteTitleLookup([]);
    const progressCallback = jest.fn();

    await exportNotes([], noteTitleLookup, progressCallback);

    expect(mockElectronAPI.export.writeFile).not.toHaveBeenCalled();
  });

  it('should export multiple notes', async () => {
    mockElectronAPI.export.selectDirectory.mockResolvedValue('/export/path');
    mockElectronAPI.export.getNotesForExport.mockResolvedValue([
      { id: 'note-1', title: 'First Note', content: mockNoteContent, folderId: null },
      { id: 'note-2', title: 'Second Note', content: mockNoteContent, folderId: null },
    ]);
    mockElectronAPI.export.writeFile.mockResolvedValue({ success: true });
    mockElectronAPI.export.showCompletionMessage.mockResolvedValue(undefined);

    const noteTitleLookup = buildNoteTitleLookup([
      { id: 'note-1', title: 'First Note' },
      { id: 'note-2', title: 'Second Note' },
    ]);
    const progressCallback = jest.fn();

    await exportNotes(['note-1', 'note-2'], noteTitleLookup, progressCallback);

    expect(mockElectronAPI.export.writeFile).toHaveBeenCalledTimes(2);
    expect(progressCallback).toHaveBeenCalledTimes(2);
  });

  it('should sanitize note title for filename', async () => {
    mockElectronAPI.export.selectDirectory.mockResolvedValue('/export/path');
    mockElectronAPI.export.getNotesForExport.mockResolvedValue([
      { id: 'note-1', title: 'Note/With:Special*Chars', content: mockNoteContent, folderId: null },
    ]);
    mockElectronAPI.export.writeFile.mockResolvedValue({ success: true });
    mockElectronAPI.export.showCompletionMessage.mockResolvedValue(undefined);

    const noteTitleLookup = buildNoteTitleLookup([
      { id: 'note-1', title: 'Note/With:Special*Chars' },
    ]);

    await exportNotes(['note-1'], noteTitleLookup, jest.fn());

    // Special characters should be replaced with underscores
    expect(mockElectronAPI.export.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/Note_With_Special_Chars\.md$/),
      expect.any(String)
    );
  });
});

describe('exportAllNotes', () => {
  const mockNoteContent: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Test content' }],
      },
    ],
  };

  it('should export all notes in SD', async () => {
    mockElectronAPI.export.selectDirectory.mockResolvedValue('/export/path');
    mockElectronAPI.export.getNotesForExport.mockResolvedValue([
      { id: 'note-1', title: 'Note One', content: mockNoteContent, folderId: null },
      { id: 'note-2', title: 'Note Two', content: mockNoteContent, folderId: 'folder-1' },
    ]);
    mockElectronAPI.export.createDirectory.mockResolvedValue({ success: true });
    mockElectronAPI.export.writeFile.mockResolvedValue({ success: true });
    mockElectronAPI.export.showCompletionMessage.mockResolvedValue(undefined);

    const folders: FolderInfo[] = [{ id: 'folder-1', name: 'My Folder', parentId: null }];
    const notes = [
      { id: 'note-1', title: 'Note One', folderId: null, deleted: false },
      { id: 'note-2', title: 'Note Two', folderId: 'folder-1', deleted: false },
    ];
    const noteTitleLookup = buildNoteTitleLookup(notes);
    const progressCallback = jest.fn();

    await exportAllNotes(
      'sd-1',
      folders,
      notes.map((n) => ({ id: n.id, folderId: n.folderId, deleted: n.deleted })),
      noteTitleLookup,
      progressCallback
    );

    expect(mockElectronAPI.export.selectDirectory).toHaveBeenCalled();
    expect(mockElectronAPI.export.writeFile).toHaveBeenCalledTimes(2);
    expect(progressCallback).toHaveBeenCalledTimes(2);
  });

  it('should filter out deleted notes', async () => {
    mockElectronAPI.export.selectDirectory.mockResolvedValue('/export/path');
    mockElectronAPI.export.getNotesForExport.mockResolvedValue([
      { id: 'note-1', title: 'Active Note', content: mockNoteContent, folderId: null },
    ]);
    mockElectronAPI.export.writeFile.mockResolvedValue({ success: true });
    mockElectronAPI.export.showCompletionMessage.mockResolvedValue(undefined);

    const notes = [
      { id: 'note-1', title: 'Active Note', folderId: null, deleted: false },
      { id: 'note-2', title: 'Deleted Note', folderId: null, deleted: true },
    ];
    const noteTitleLookup = buildNoteTitleLookup(notes);
    const progressCallback = jest.fn();

    await exportAllNotes(
      'sd-1',
      [],
      notes.map((n) => ({ id: n.id, folderId: n.folderId, deleted: n.deleted })),
      noteTitleLookup,
      progressCallback
    );

    // Only the active note should be requested for export
    expect(mockElectronAPI.export.getNotesForExport).toHaveBeenCalledWith(['note-1']);
    expect(mockElectronAPI.export.writeFile).toHaveBeenCalledTimes(1);
  });

  it('should create folder structure for nested folders', async () => {
    mockElectronAPI.export.selectDirectory.mockResolvedValue('/export/path');
    mockElectronAPI.export.getNotesForExport.mockResolvedValue([
      { id: 'note-1', title: 'Nested Note', content: mockNoteContent, folderId: 'child-folder' },
    ]);
    mockElectronAPI.export.createDirectory.mockResolvedValue({ success: true });
    mockElectronAPI.export.writeFile.mockResolvedValue({ success: true });
    mockElectronAPI.export.showCompletionMessage.mockResolvedValue(undefined);

    const folders: FolderInfo[] = [
      { id: 'parent-folder', name: 'Parent', parentId: null },
      { id: 'child-folder', name: 'Child', parentId: 'parent-folder' },
    ];
    const notes = [
      { id: 'note-1', title: 'Nested Note', folderId: 'child-folder', deleted: false },
    ];
    const noteTitleLookup = buildNoteTitleLookup(notes);

    await exportAllNotes(
      'sd-1',
      folders,
      notes.map((n) => ({ id: n.id, folderId: n.folderId, deleted: n.deleted })),
      noteTitleLookup,
      jest.fn()
    );

    // Should create the nested folder structure
    expect(mockElectronAPI.export.createDirectory).toHaveBeenCalledWith(
      expect.stringContaining('Parent/Child')
    );
    // Note should be written to the nested folder
    expect(mockElectronAPI.export.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('Parent/Child/Nested Note.md'),
      expect.any(String)
    );
  });

  it('should handle user cancelling directory selection', async () => {
    mockElectronAPI.export.selectDirectory.mockResolvedValue(null);

    const notes = [{ id: 'note-1', title: 'Note', folderId: null, deleted: false }];
    const noteTitleLookup = buildNoteTitleLookup(notes);

    await exportAllNotes(
      'sd-1',
      [],
      notes.map((n) => ({ id: n.id, folderId: n.folderId, deleted: n.deleted })),
      noteTitleLookup,
      jest.fn()
    );

    expect(mockElectronAPI.export.getNotesForExport).not.toHaveBeenCalled();
    expect(mockElectronAPI.export.writeFile).not.toHaveBeenCalled();
  });

  it('should handle empty notes array', async () => {
    mockElectronAPI.export.selectDirectory.mockResolvedValue('/export/path');
    mockElectronAPI.export.showCompletionMessage.mockResolvedValue(undefined);

    const noteTitleLookup = buildNoteTitleLookup([]);

    await exportAllNotes('sd-1', [], [], noteTitleLookup, jest.fn());

    expect(mockElectronAPI.export.getNotesForExport).not.toHaveBeenCalled();
    expect(mockElectronAPI.export.writeFile).not.toHaveBeenCalled();
    // Should still show completion message
    expect(mockElectronAPI.export.showCompletionMessage).toHaveBeenCalled();
  });
});
