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
      mocks.crdtManager.getNoteDoc
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockNoteDoc);

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

      expect(mocks.crdtManager.deleteDocument).toHaveBeenCalledWith(noteId, sdId);
      expect(mocks.database.deleteNote).toHaveBeenCalledWith(noteId);
    });
  });

  describe('note:load', () => {
    it('should load a note', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const sdId = 'test-sd';

      await (handlers as any).handleLoadNote(mockEvent, noteId, sdId);

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
      const mockNoteDoc = createMockNoteDoc();
      mockNoteDoc.doc = mockDoc;

      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      const result = await (handlers as any).handleGetNoteState(mockEvent, noteId);

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
});
