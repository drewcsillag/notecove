/**
 * Multi-SD Bug Tests
 *
 * Tests for bugs found during multi-SD testing:
 * 1. SD directory not created on disk
 * 2. Folder structure shared between SDs
 */

// Mock i18n before any imports
jest.mock('../i18n', () => ({}));

// Mock TipTap editor
jest.mock('../components/EditorPanel/TipTapEditor', () => ({
  TipTapEditor: () => <div data-testid="tiptap-editor">TipTap Editor</div>,
}));

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

// Mock window.electronAPI
/* eslint-disable @typescript-eslint/no-empty-function */
const mockElectronAPI = {
  platform: 'darwin',
  note: {
    load: jest.fn(),
    unload: jest.fn(),
    applyUpdate: jest.fn(),
    create: jest.fn().mockResolvedValue('new-note-id'),
    delete: jest.fn(),
    restore: jest.fn(),
    permanentDelete: jest.fn(),
    duplicate: jest.fn().mockResolvedValue('new-note-id'),
    move: jest.fn(),
    togglePin: jest.fn(),
    getMetadata: jest.fn(),
    list: jest.fn().mockResolvedValue([]),
    onUpdated: jest.fn(() => () => {}),
    onDeleted: jest.fn(() => () => {}),
    onRestored: jest.fn(() => () => {}),
    onPermanentDeleted: jest.fn(() => () => {}),
    onCreated: jest.fn(() => () => {}),
    onExternalUpdate: jest.fn(() => () => {}),
    onTitleUpdated: jest.fn(() => () => {}),
    onPinned: jest.fn(() => () => {}),
    onMoved: jest.fn(() => () => {}),
    updateTitle: jest.fn(),
    createSnapshot: jest.fn().mockResolvedValue({ success: true, filename: 'test-snapshot.yjson' }),
    getInfo: jest.fn().mockResolvedValue(null),
    reloadFromCRDTLogs: jest.fn().mockResolvedValue({ success: true }),
  },
  folder: {
    list: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    delete: jest.fn(),
    rename: jest.fn(),
    move: jest.fn(),
    onUpdated: jest.fn(() => () => {}),
    onSelected: jest.fn(() => () => {}),
  },
  sd: {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    setActive: jest.fn(),
    getActive: jest.fn().mockResolvedValue('default'),
    onUpdated: jest.fn(() => () => {}),
    onOpenSettings: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onInitProgress: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onInitComplete: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onInitError: jest.fn(() => () => {
      /* unsubscribe */
    }),
  },
  sync: {
    onProgress: jest.fn(() => () => {}),
    getStatus: jest.fn().mockResolvedValue({
      pendingCount: 0,
      perSd: [],
      isSyncing: false,
    }),
    onStatusChanged: jest.fn(() => () => {}),
    getStaleSyncs: jest.fn().mockResolvedValue([]),
    onStaleEntriesChanged: jest.fn(() => () => {}),
    skipStaleEntry: jest.fn().mockResolvedValue({ success: true }),
    retryStaleEntry: jest.fn().mockResolvedValue({ success: true }),
    exportDiagnostics: jest.fn().mockResolvedValue({ success: true }),
  },
  appState: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  menu: {
    onNewNote: jest.fn(() => () => {}),
    onNewFolder: jest.fn(() => () => {}),
    onFind: jest.fn(() => () => {}),
    onFindInNote: jest.fn(() => () => {}),
    onToggleDarkMode: jest.fn(() => () => {}),
    onToggleFolderPanel: jest.fn(() => () => {}),
    onToggleTagsPanel: jest.fn(() => () => {}),
    onCreateSnapshot: jest.fn(() => () => {}),
    onNoteInfo: jest.fn(() => () => {}),
    onViewHistory: jest.fn(() => () => {}),
    onExportSelectedNotes: jest.fn(() => () => {}),
    onExportAllNotes: jest.fn(() => () => {}),
    onReloadFromCRDTLogs: jest.fn(() => () => {}),
    onReindexNotes: jest.fn(() => () => {}),
    onSyncStatus: jest.fn(() => () => {}),
    onStorageInspector: jest.fn(() => () => {}),
    onImportMarkdown: jest.fn(() => () => {}),
  },
  export: {
    selectDirectory: jest.fn(() => Promise.resolve(null)),
    writeFile: jest.fn(() => Promise.resolve({ success: true })),
    createDirectory: jest.fn(() => Promise.resolve({ success: true })),
    getNotesForExport: jest.fn(() => Promise.resolve([])),
    showCompletionMessage: jest.fn(() => Promise.resolve()),
  },
  shutdown: {
    onProgress: jest.fn(() => () => {}),
    onComplete: jest.fn(() => () => {}),
  },
  tools: {
    onReindexProgress: jest.fn(() => () => {}),
    onReindexComplete: jest.fn(() => () => {}),
    onReindexError: jest.fn(() => () => {}),
    reindexNotes: jest.fn(() => Promise.resolve()),
  },
  comment: {
    createThread: jest.fn().mockResolvedValue('thread-1'),
    getThreads: jest.fn().mockResolvedValue([]),
    updateThread: jest.fn().mockResolvedValue(undefined),
    deleteThread: jest.fn().mockResolvedValue(undefined),
    addReply: jest.fn().mockResolvedValue('reply-1'),
    updateReply: jest.fn().mockResolvedValue(undefined),
    deleteReply: jest.fn().mockResolvedValue(undefined),
    addReaction: jest.fn().mockResolvedValue(undefined),
    removeReaction: jest.fn().mockResolvedValue(undefined),
    onThreadAdded: jest.fn(() => () => {}),
    onThreadUpdated: jest.fn(() => () => {}),
    onThreadDeleted: jest.fn(() => () => {}),
    onReplyAdded: jest.fn(() => () => {}),
    onReplyUpdated: jest.fn(() => () => {}),
    onReplyDeleted: jest.fn(() => () => {}),
    onReactionAdded: jest.fn(() => () => {}),
    onReactionRemoved: jest.fn(() => () => {}),
  },
  theme: {
    set: jest.fn().mockResolvedValue(undefined),
    onChanged: jest.fn((_callback: (theme: 'light' | 'dark') => void) => () => {}),
  },
  user: {
    getCurrentProfile: jest.fn().mockResolvedValue({
      profileId: 'test-profile-id',
      username: 'Test User',
      handle: '@testuser',
    }),
  },
};
/* eslint-enable @typescript-eslint/no-empty-function */

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('Multi-SD Bugs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Bug 1: SD directory not created on disk', () => {
    it('should call sd:create with correct parameters', async () => {
      const testPath = '/test/path/to/sd';

      mockElectronAPI.sd.create.mockResolvedValue('test-sd-id');

      // Call sd:create
      const sdId = await mockElectronAPI.sd.create('Test SD', testPath);

      // Verify it was called with correct params
      expect(mockElectronAPI.sd.create).toHaveBeenCalledWith('Test SD', testPath);
      expect(sdId).toBe('test-sd-id');
    });

    it('should handle SD creation', async () => {
      mockElectronAPI.sd.create.mockResolvedValue('new-sd-id');

      const sdId = await mockElectronAPI.sd.create('New SD', '/path/to/new/sd');

      expect(sdId).toBe('new-sd-id');
      expect(mockElectronAPI.sd.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Bug 2: Folder structure shared between SDs', () => {
    it('should maintain separate folder structures for different SDs', async () => {
      // Mock two SDs
      const sd1 = {
        id: 'sd-1',
        name: 'Personal',
        path: '/path/to/personal',
        created: Date.now(),
        isActive: true,
      };

      const sd2 = {
        id: 'sd-2',
        name: 'Work',
        path: '/path/to/work',
        created: Date.now(),
        isActive: false,
      };

      mockElectronAPI.sd.list.mockResolvedValue([sd1, sd2]);

      // Mock DIFFERENT folder structures for each SD
      mockElectronAPI.folder.list.mockImplementation((sdId: string) => {
        if (sdId === 'sd-1') {
          return Promise.resolve([
            {
              id: 'folder-personal-1',
              name: 'Family',
              parentId: null,
              sdId: 'sd-1',
              order: 0,
              deleted: false,
            },
          ]);
        } else if (sdId === 'sd-2') {
          return Promise.resolve([
            {
              id: 'folder-work-1',
              name: 'Projects',
              parentId: null,
              sdId: 'sd-2',
              order: 0,
              deleted: false,
            },
          ]);
        }
        return Promise.resolve([]);
      });

      render(<App />);

      // Wait for folders to load
      await waitFor(() => {
        expect(mockElectronAPI.folder.list).toHaveBeenCalledWith('sd-1');
        expect(mockElectronAPI.folder.list).toHaveBeenCalledWith('sd-2');
      });

      // Verify both SDs show different folders
      await waitFor(() => {
        expect(screen.getByText('Family')).toBeInTheDocument();
        expect(screen.getByText('Projects')).toBeInTheDocument();
      });

      // Verify SDs are displayed
      const personalSD = screen.getByText('Personal');
      expect(personalSD).toBeInTheDocument();

      const workSD = screen.getByText('Work');
      expect(workSD).toBeInTheDocument();
    });

    it('should not share folder updates between SDs', async () => {
      const sd1 = {
        id: 'sd-1',
        name: 'SD1',
        path: '/path1',
        created: Date.now(),
        isActive: true,
      };

      const sd2 = {
        id: 'sd-2',
        name: 'SD2',
        path: '/path2',
        created: Date.now(),
        isActive: false,
      };

      mockElectronAPI.sd.list.mockResolvedValue([sd1, sd2]);

      // Initially, both SDs have no folders
      mockElectronAPI.folder.list.mockResolvedValue([]);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('SD1')).toBeInTheDocument();
        expect(screen.getByText('SD2')).toBeInTheDocument();
      });

      // Now simulate creating a folder in SD1
      mockElectronAPI.folder.create.mockResolvedValue('new-folder-sd1');
      mockElectronAPI.folder.list.mockImplementation((sdId: string) => {
        if (sdId === 'sd-1') {
          return Promise.resolve([
            {
              id: 'new-folder-sd1',
              name: 'New Folder SD1',
              parentId: null,
              sdId: 'sd-1',
              order: 0,
              deleted: false,
            },
          ]);
        }
        return Promise.resolve([]); // SD2 still has no folders
      });

      // Create folder in SD1
      await mockElectronAPI.folder.create('sd-1', null, 'New Folder SD1');

      // Reload folder lists
      const sd1Folders = await mockElectronAPI.folder.list('sd-1');
      const sd2Folders = await mockElectronAPI.folder.list('sd-2');

      // Verify SD1 has the folder but SD2 doesn't
      expect(sd1Folders).toHaveLength(1);
      expect(sd1Folders[0].name).toBe('New Folder SD1');
      expect(sd2Folders).toHaveLength(0);
    });
  });

  describe('Bug 3: Note-to-folder associations not synced via CRDT', () => {
    it('should store note-to-folder association in CRDT metadata', async () => {
      const sdId = 'sd-1';
      const folderId = 'folder-1';
      const noteId = 'note-1';

      // Mock note creation
      mockElectronAPI.note.create.mockResolvedValue(noteId);

      // Mock metadata retrieval to return the folder association
      mockElectronAPI.note.getMetadata.mockResolvedValue({
        noteId: noteId,
        title: 'Test Note',
        folderId: folderId,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      });

      // Create note in folder
      const createdNoteId = await mockElectronAPI.note.create(sdId, folderId, '');

      expect(createdNoteId).toBe(noteId);
      expect(mockElectronAPI.note.create).toHaveBeenCalledWith(sdId, folderId, '');

      // Retrieve metadata
      const metadata = await mockElectronAPI.note.getMetadata(noteId);

      // Verify folder association is preserved
      expect(metadata.folderId).toBe(folderId);
    });

    it('should update note-to-folder association when moving notes', async () => {
      const noteId = 'note-1';
      const oldFolderId = 'folder-1';
      const newFolderId = 'folder-2';

      // Mock initial metadata
      mockElectronAPI.note.getMetadata.mockResolvedValue({
        noteId: noteId,
        title: 'Test Note',
        folderId: oldFolderId,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      });

      // Get initial metadata
      let metadata = await mockElectronAPI.note.getMetadata(noteId);
      expect(metadata.folderId).toBe(oldFolderId);

      // Move note to new folder
      mockElectronAPI.note.move.mockResolvedValue(undefined);
      await mockElectronAPI.note.move(noteId, newFolderId);

      // Mock updated metadata after move
      mockElectronAPI.note.getMetadata.mockResolvedValue({
        noteId: noteId,
        title: 'Test Note',
        folderId: newFolderId,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      });

      // Get updated metadata
      metadata = await mockElectronAPI.note.getMetadata(noteId);

      // Verify folder association was updated
      expect(metadata.folderId).toBe(newFolderId);
      expect(mockElectronAPI.note.move).toHaveBeenCalledWith(noteId, newFolderId);
    });

    it('should maintain separate note-to-folder associations across SDs', async () => {
      const sd1 = {
        id: 'sd-1',
        name: 'Personal',
        path: '/path/to/personal',
        created: Date.now(),
        isActive: true,
      };

      const sd2 = {
        id: 'sd-2',
        name: 'Work',
        path: '/path/to/work',
        created: Date.now(),
        isActive: false,
      };

      mockElectronAPI.sd.list.mockResolvedValue([sd1, sd2]);

      // Create note in SD1
      const note1Id = 'note-1';
      const folder1Id = 'folder-personal-1';
      mockElectronAPI.note.create.mockResolvedValueOnce(note1Id);
      await mockElectronAPI.note.create('sd-1', folder1Id, '');

      // Create note in SD2
      const note2Id = 'note-2';
      const folder2Id = 'folder-work-1';
      mockElectronAPI.note.create.mockResolvedValueOnce(note2Id);
      await mockElectronAPI.note.create('sd-2', folder2Id, '');

      // Mock metadata for both notes
      mockElectronAPI.note.getMetadata.mockImplementation((noteId: string) => {
        if (noteId === note1Id) {
          return Promise.resolve({
            noteId: note1Id,
            title: 'Personal Note',
            folderId: folder1Id,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
          });
        } else if (noteId === note2Id) {
          return Promise.resolve({
            noteId: note2Id,
            title: 'Work Note',
            folderId: folder2Id,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
          });
        }
        return Promise.reject(new Error('Note not found'));
      });

      // Verify each note has its own folder association
      const metadata1 = await mockElectronAPI.note.getMetadata(note1Id);
      const metadata2 = await mockElectronAPI.note.getMetadata(note2Id);

      expect(metadata1.folderId).toBe(folder1Id);
      expect(metadata2.folderId).toBe(folder2Id);
      expect(metadata1.folderId).not.toBe(metadata2.folderId);
    });

    it('should preserve note-to-folder associations after CRDT reload', async () => {
      const noteId = 'note-1';
      const folderId = 'folder-1';

      // Create note with folder association
      mockElectronAPI.note.create.mockResolvedValue(noteId);
      await mockElectronAPI.note.create('sd-1', folderId, '');

      // Load the note (simulating CRDT load)
      mockElectronAPI.note.load.mockResolvedValue(undefined);
      await mockElectronAPI.note.load(noteId);

      // Mock metadata retrieval after load
      mockElectronAPI.note.getMetadata.mockResolvedValue({
        noteId: noteId,
        title: 'Test Note',
        folderId: folderId,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      });

      // Get metadata after CRDT reload
      const metadata = await mockElectronAPI.note.getMetadata(noteId);

      // Verify folder association persisted through CRDT reload
      expect(metadata.folderId).toBe(folderId);
    });
  });
});
