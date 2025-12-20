/**
 * Note Core Handlers Tests
 *
 * Tests for core note operations (create, delete, restore, permanentDelete, load, unload, getState, applyUpdate).
 */

// Mock electron
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn(),
  },
  BrowserWindow: {
    getAllWindows: jest.fn(() => []),
  },
  app: {
    getPath: jest.fn((name: string) => {
      if (name === 'userData') {
        return '/mock/user/data';
      }
      return `/mock/${name}`;
    }),
  },
}));

// Mock crypto and uuid
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn((): string => {
    const { nextUuid } = require('./test-utils');
    return nextUuid();
  }),
}));

jest.mock('uuid', () => ({
  v4: jest.fn((): string => {
    const { nextUuid } = require('./test-utils');
    return nextUuid();
  }),
}));
/* eslint-enable @typescript-eslint/no-require-imports */

// Mock fs/promises
jest.mock('fs/promises', () => ({
  ...jest.requireActual('fs/promises'),
  readdir: jest.fn().mockResolvedValue([]),
  readFile: jest.fn().mockRejectedValue({ code: 'ENOENT' }),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockRejectedValue({ code: 'ENOENT' }),
}));

// Mock node-fs-adapter
jest.mock('../../../storage/node-fs-adapter', () => {
  const path = jest.requireActual('path');
  const fileStore = new Map<string, Uint8Array>();

  return {
    NodeFileSystemAdapter: jest.fn().mockImplementation(() => ({
      exists: jest.fn().mockImplementation(async (filePath: string) => {
        return fileStore.has(filePath);
      }),
      mkdir: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn().mockImplementation(async (filePath: string) => {
        if (fileStore.has(filePath)) {
          return fileStore.get(filePath);
        }
        const error = new Error(
          `ENOENT: no such file or directory, open '${filePath}'`
        ) as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      }),
      writeFile: jest.fn().mockImplementation(async (filePath: string, data: Uint8Array) => {
        fileStore.set(filePath, data);
      }),
      appendFile: jest.fn().mockResolvedValue(undefined),
      deleteFile: jest.fn().mockImplementation(async (filePath: string) => {
        fileStore.delete(filePath);
      }),
      listFiles: jest.fn().mockResolvedValue([]),
      joinPath: (...segments: string[]) => path.join(...segments),
      dirname: (filePath: string) => path.dirname(filePath),
      basename: (filePath: string) => path.basename(filePath),
    })),
    __clearFileStore: () => {
      fileStore.clear();
    },
  };
});

import { IPCHandlers } from '../../handlers';
import * as Y from 'yjs';
import {
  createAllMocks,
  castMocksToReal,
  resetUuidCounter,
  createMockNoteDoc,
  type AllMocks,
} from './test-utils';

describe('Note Core Handlers', () => {
  let handlers: IPCHandlers;
  let mocks: AllMocks;

  beforeEach(async () => {
    resetUuidCounter();

    // Clear the mock filesystem
    const nodeFs = await import('../../../storage/node-fs-adapter');
    const nodeFsWithClear = nodeFs as unknown as { __clearFileStore?: () => void };
    if (typeof nodeFsWithClear.__clearFileStore === 'function') {
      nodeFsWithClear.__clearFileStore();
    }

    // Create all mocks
    mocks = createAllMocks();

    // Create handlers
    const realMocks = castMocksToReal(mocks);
    handlers = new IPCHandlers(
      realMocks.crdtManager,
      realMocks.database,
      realMocks.configManager,
      realMocks.appendLogManager,
      realMocks.noteMoveManager,
      realMocks.diagnosticsManager,
      realMocks.backupManager,
      'test-profile-id'
    );
  });

  afterEach(() => {
    handlers.destroy();
  });

  describe('note:create', () => {
    it('should create a note in root folder', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = null;
      const mockNoteDoc = createMockNoteDoc();
      mockNoteDoc.initializeNote = jest.fn();

      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      const noteId = await (handlers as any).handleCreateNote(mockEvent, sdId, folderId);

      expect(noteId).toBeDefined();
      expect(mocks.crdtManager.loadNote).toHaveBeenCalledWith(noteId, sdId);
      expect(mockNoteDoc.initializeNote).toHaveBeenCalledWith(
        expect.objectContaining({
          id: noteId,
          sdId,
          folderId,
          deleted: false,
          pinned: false,
        })
      );
      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          id: noteId,
          title: 'Untitled',
          sdId,
          folderId,
          deleted: false,
          pinned: false,
        })
      );
    });

    it('should create a note in a folder', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'folder-123';
      const mockNoteDoc = createMockNoteDoc();
      mockNoteDoc.initializeNote = jest.fn();

      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      await (handlers as any).handleCreateNote(mockEvent, sdId, folderId);

      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          sdId,
          folderId,
        })
      );
    });
  });

  describe('note:delete', () => {
    it('should soft delete a note', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const mockNote = {
        id: noteId,
        title: 'Test Note',
        sdId: 'test-sd',
        folderId: null,
        deleted: false,
        pinned: false,
        contentPreview: '',
        contentText: '',
        created: Date.now(),
        modified: Date.now(),
      };
      const mockNoteDoc = createMockNoteDoc();
      mockNoteDoc.markDeleted = jest.fn();

      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      await (handlers as any).handleDeleteNote(mockEvent, noteId);

      expect(mockNoteDoc.markDeleted).toHaveBeenCalled();
      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          id: noteId,
          deleted: true,
        })
      );
    });

    it('should load note if not already loaded', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const sdId = 'test-sd';
      const mockNote = {
        id: noteId,
        title: 'Test Note',
        sdId,
        folderId: null,
        deleted: false,
        pinned: false,
        contentPreview: '',
        contentText: '',
        created: Date.now(),
        modified: Date.now(),
      };
      const mockNoteDoc = createMockNoteDoc();
      mockNoteDoc.markDeleted = jest.fn();

      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValueOnce(null).mockReturnValueOnce(mockNoteDoc);

      await (handlers as any).handleDeleteNote(mockEvent, noteId);

      expect(mocks.crdtManager.loadNote).toHaveBeenCalledWith(noteId, sdId);
      expect(mockNoteDoc.markDeleted).toHaveBeenCalled();
    });

    it('should throw error if note not found', async () => {
      const mockEvent = {} as any;
      mocks.database.getNote.mockResolvedValue(null);

      await expect(
        (handlers as any).handleDeleteNote(mockEvent, 'non-existent-note')
      ).rejects.toThrow('Note non-existent-note not found');
    });

    it('should unpin a pinned note when deleting', async () => {
      const mockEvent = {} as any;
      const noteId = 'pinned-note-123';
      const mockNote = {
        id: noteId,
        title: 'Pinned Note',
        sdId: 'test-sd',
        folderId: null,
        deleted: false,
        pinned: true, // Note is pinned
        contentPreview: '',
        contentText: '',
        created: Date.now(),
        modified: Date.now(),
      };
      const mockNoteDoc = createMockNoteDoc();
      mockNoteDoc.markDeleted = jest.fn();
      mockNoteDoc.updateMetadata = jest.fn();

      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      await (handlers as any).handleDeleteNote(mockEvent, noteId);

      // Should update CRDT metadata to unpin
      expect(mockNoteDoc.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          pinned: false,
        })
      );

      // Should save unpinned state to database
      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          id: noteId,
          deleted: true,
          pinned: false,
        })
      );
    });
  });

  describe('note:restore', () => {
    it('should restore a deleted note', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const mockNote = {
        id: noteId,
        title: 'Test Note',
        sdId: 'test-sd',
        folderId: null,
        deleted: true,
        pinned: false,
        contentPreview: '',
        contentText: '',
        created: Date.now(),
        modified: Date.now(),
      };
      const mockNoteDoc = createMockNoteDoc();
      mockNoteDoc.markRestored = jest.fn();

      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      await (handlers as any).handleRestoreNote(mockEvent, noteId);

      expect(mockNoteDoc.markRestored).toHaveBeenCalled();
      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          id: noteId,
          deleted: false,
        })
      );
    });
  });

  describe('note:permanentDelete', () => {
    it('should permanently delete a note', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const sdId = 'test-sd';

      const mockNote = {
        id: noteId,
        title: 'Test Note',
        sdId,
        folderId: null,
        deleted: true,
        pinned: false,
        contentPreview: '',
        contentText: '',
        created: Date.now(),
        modified: Date.now(),
      };

      mocks.database.getNote.mockResolvedValue(mockNote);

      await (handlers as any).handlePermanentDeleteNote(mockEvent, noteId);

      expect(mocks.crdtManager.unloadNote).toHaveBeenCalledWith(noteId);
      expect(mocks.database.deleteNote).toHaveBeenCalledWith(noteId);
    });
  });

  describe('note:emptyTrash', () => {
    it('should permanently delete all notes in trash', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';

      const deletedNotes = [
        {
          id: 'note-1',
          title: 'Deleted Note 1',
          sdId,
          folderId: null,
          deleted: true,
          pinned: false,
          contentPreview: '',
          contentText: '',
          created: Date.now(),
          modified: Date.now(),
        },
        {
          id: 'note-2',
          title: 'Deleted Note 2',
          sdId,
          folderId: null,
          deleted: true,
          pinned: false,
          contentPreview: '',
          contentText: '',
          created: Date.now(),
          modified: Date.now(),
        },
      ];

      mocks.database.getDeletedNotes.mockResolvedValue(deletedNotes);
      mocks.database.getNote
        .mockResolvedValueOnce(deletedNotes[0])
        .mockResolvedValueOnce(deletedNotes[1]);

      const result = await (handlers as any).handleEmptyTrash(mockEvent, sdId);

      expect(result).toBe(2);
      expect(mocks.database.getDeletedNotes).toHaveBeenCalledWith(sdId);
      expect(mocks.crdtManager.unloadNote).toHaveBeenCalledWith('note-1');
      expect(mocks.crdtManager.unloadNote).toHaveBeenCalledWith('note-2');
      expect(mocks.database.deleteNote).toHaveBeenCalledWith('note-1');
      expect(mocks.database.deleteNote).toHaveBeenCalledWith('note-2');
    });

    it('should return 0 when trash is empty', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';

      mocks.database.getDeletedNotes.mockResolvedValue([]);

      const result = await (handlers as any).handleEmptyTrash(mockEvent, sdId);

      expect(result).toBe(0);
      expect(mocks.database.getDeletedNotes).toHaveBeenCalledWith(sdId);
      expect(mocks.crdtManager.unloadNote).not.toHaveBeenCalled();
      expect(mocks.database.deleteNote).not.toHaveBeenCalled();
    });

    it('should continue deleting if one note fails', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';

      const deletedNotes = [
        {
          id: 'note-1',
          title: 'Deleted Note 1',
          sdId,
          folderId: null,
          deleted: true,
          pinned: false,
          contentPreview: '',
          contentText: '',
          created: Date.now(),
          modified: Date.now(),
        },
        {
          id: 'note-2',
          title: 'Deleted Note 2',
          sdId,
          folderId: null,
          deleted: true,
          pinned: false,
          contentPreview: '',
          contentText: '',
          created: Date.now(),
          modified: Date.now(),
        },
      ];

      mocks.database.getDeletedNotes.mockResolvedValue(deletedNotes);
      // First note fails, second succeeds
      mocks.database.getNote
        .mockRejectedValueOnce(new Error('Failed to find note'))
        .mockResolvedValueOnce(deletedNotes[1]);

      const result = await (handlers as any).handleEmptyTrash(mockEvent, sdId);

      // Should still return 1 since one note succeeded
      expect(result).toBe(1);
      expect(mocks.database.deleteNote).toHaveBeenCalledWith('note-2');
    });
  });

  describe('note:load', () => {
    it('should load a note', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const sdId = 'test-sd';
      const mockNote = {
        id: noteId,
        title: 'Test Note',
        sdId: sdId,
        folderId: null,
        deleted: false,
        pinned: false,
        contentPreview: '',
        contentText: '',
        created: Date.now(),
        modified: Date.now(),
      };

      const mockNoteDoc = createMockNoteDoc();
      mockNoteDoc.getMetadata = jest.fn().mockReturnValue({
        id: noteId,
        sdId: sdId,
        folderId: null,
        deleted: false,
        pinned: false,
        created: Date.now(),
        modified: Date.now(),
      });

      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      await (handlers as any).handleLoadNote(mockEvent, noteId);

      expect(mocks.crdtManager.loadNote).toHaveBeenCalledWith(noteId, sdId);
    });
  });

  describe('note:unload', () => {
    it('should unload a note', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';

      await (handlers as any).handleUnloadNote(mockEvent, noteId);

      expect(mocks.crdtManager.unloadNote).toHaveBeenCalledWith(noteId);
    });
  });

  describe('note:getState', () => {
    it('should get note state as Uint8Array', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const mockDoc = new Y.Doc();

      mocks.crdtManager.getDocument.mockReturnValue(mockDoc);

      const result = await (handlers as any).handleGetState(mockEvent, noteId);

      expect(result).toBeInstanceOf(Uint8Array);
    });
  });

  describe('note:applyUpdate', () => {
    it('should apply update to note', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const update = new Uint8Array([1, 2, 3]);

      await (handlers as any).handleApplyUpdate(mockEvent, noteId, update);

      expect(mocks.crdtManager.applyUpdate).toHaveBeenCalledWith(noteId, update);
    });
  });

  describe('note:applyUpdate - cross-profile sdId bug', () => {
    it('should NOT overwrite local sdId with CRDT metadata sdId from another profile', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const update = new Uint8Array([1, 2, 3]);

      // Local profile uses SD ID 'local-sd-id' for this path
      const localSdId = 'local-sd-id';
      // Another profile created the note with a different SD ID for the same path
      const foreignSdId = 'foreign-sd-id-from-other-profile';

      const mockNote = {
        id: noteId,
        title: 'Test Note',
        sdId: localSdId, // Local database has local SD ID
        folderId: null,
        deleted: false,
        pinned: false,
        contentPreview: '',
        contentText: '',
        created: Date.now(),
        modified: Date.now(),
      };

      // CRDT metadata has the foreign SD ID (from when the note was created by another profile)
      const mockNoteDoc = createMockNoteDoc();
      mockNoteDoc.getMetadata = jest.fn().mockReturnValue({
        id: noteId,
        sdId: foreignSdId, // Foreign SD ID from CRDT
        folderId: null,
        deleted: false,
        pinned: false,
        created: Date.now(),
        modified: Date.now(),
      });

      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      await (handlers as any).handleApplyUpdate(mockEvent, noteId, update);

      // The upsertNote should NOT be called because:
      // 1. We removed sdId from metadataChanged check
      // 2. Other metadata (deleted, folderId) hasn't changed
      // Previously this would have been called with the foreign sdId, corrupting the database
      expect(mocks.database.upsertNote).not.toHaveBeenCalled();
    });

    it('should still sync other metadata changes but preserve local sdId', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const update = new Uint8Array([1, 2, 3]);

      const localSdId = 'local-sd-id';
      const foreignSdId = 'foreign-sd-id-from-other-profile';

      const mockNote = {
        id: noteId,
        title: 'Test Note',
        sdId: localSdId,
        folderId: null,
        deleted: false, // Note is not deleted locally
        pinned: false,
        contentPreview: '',
        contentText: '',
        created: Date.now(),
        modified: Date.now(),
      };

      // CRDT says note was deleted (synced from another instance)
      const mockNoteDoc = createMockNoteDoc();
      mockNoteDoc.getMetadata = jest.fn().mockReturnValue({
        id: noteId,
        sdId: foreignSdId,
        folderId: null,
        deleted: true, // Deletion synced from another instance
        pinned: false,
        created: Date.now(),
        modified: Date.now(),
      });

      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      await (handlers as any).handleApplyUpdate(mockEvent, noteId, update);

      // Should update deleted status but preserve local sdId
      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          id: noteId,
          sdId: localSdId, // Local SD ID preserved, not foreign one
          deleted: true, // Deletion status synced
        })
      );
    });
  });
});
