/**
 * Note Edit Handlers Tests
 *
 * Tests for note editing operations (duplicate, togglePin, move, moveToSD, updateTitle).
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
import {
  createAllMocks,
  castMocksToReal,
  resetUuidCounter,
  createMockNoteDoc,
  type AllMocks,
} from './test-utils';

describe('Note Edit Handlers', () => {
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

  describe('note:togglePin', () => {
    it('should toggle pin from false to true', async () => {
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
      const mockNoteDoc = createMockNoteDoc({
        getMetadata: jest.fn().mockReturnValue({ pinned: false }),
      });
      mockNoteDoc.updateMetadata = jest.fn();

      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      await (handlers as any).handleTogglePinNote(mockEvent, noteId);

      expect(mockNoteDoc.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          pinned: true,
        })
      );
      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          pinned: true,
        })
      );
    });

    it('should toggle pin from true to false', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const mockNote = {
        id: noteId,
        title: 'Test Note',
        sdId: 'test-sd',
        folderId: null,
        deleted: false,
        pinned: true,
        contentPreview: '',
        contentText: '',
        created: Date.now(),
        modified: Date.now(),
      };
      const mockNoteDoc = createMockNoteDoc({
        getMetadata: jest.fn().mockReturnValue({ pinned: true }),
      });
      mockNoteDoc.updateMetadata = jest.fn();

      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      await (handlers as any).handleTogglePinNote(mockEvent, noteId);

      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          pinned: false,
        })
      );
    });
  });

  describe('note:move', () => {
    it('should move note to new folder', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const newFolderId = 'folder-456';
      const mockNote = {
        id: noteId,
        title: 'Test Note',
        sdId: 'test-sd',
        folderId: 'folder-123',
        deleted: false,
        pinned: false,
        contentPreview: '',
        contentText: '',
        created: Date.now(),
        modified: Date.now(),
      };
      const mockNoteDoc = createMockNoteDoc();
      mockNoteDoc.updateMetadata = jest.fn();

      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      await (handlers as any).handleMoveNote(mockEvent, noteId, newFolderId);

      expect(mockNoteDoc.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          folderId: newFolderId,
        })
      );
      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          folderId: newFolderId,
        })
      );
    });

    it('should move note to root folder (null)', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const mockNote = {
        id: noteId,
        title: 'Test Note',
        sdId: 'test-sd',
        folderId: 'folder-123',
        deleted: false,
        pinned: false,
        contentPreview: '',
        contentText: '',
        created: Date.now(),
        modified: Date.now(),
      };
      const mockNoteDoc = createMockNoteDoc();
      mockNoteDoc.updateMetadata = jest.fn();

      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      await (handlers as any).handleMoveNote(mockEvent, noteId, null);

      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          folderId: null,
        })
      );
    });
  });

  describe('note:updateTitle', () => {
    it('should update note title', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const newTitle = 'Updated Title';
      const mockNote = {
        id: noteId,
        title: 'Old Title',
        sdId: 'test-sd',
        folderId: null,
        deleted: false,
        pinned: false,
        contentPreview: '',
        contentText: '',
        created: Date.now(),
        modified: Date.now(),
      };

      mocks.database.getNote.mockResolvedValue(mockNote);

      await (handlers as any).handleUpdateTitle(mockEvent, noteId, newTitle);

      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          title: newTitle,
        })
      );
    });

    it('should update title and contentText if provided', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const newTitle = 'Updated Title';
      const contentText = 'Updated Title\nThis is the body content';
      const mockNote = {
        id: noteId,
        title: 'Old Title',
        sdId: 'test-sd',
        folderId: null,
        deleted: false,
        pinned: false,
        contentPreview: 'Old preview',
        contentText: 'Old content',
        created: Date.now(),
        modified: Date.now(),
      };

      mocks.database.getNote.mockResolvedValue(mockNote);

      await (handlers as any).handleUpdateTitle(mockEvent, noteId, newTitle, contentText);

      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          title: newTitle,
          contentText,
          contentPreview: 'This is the body content',
        })
      );
    });
  });

  describe('note:duplicate', () => {
    it('should duplicate a note', async () => {
      const mockEvent = {} as any;
      const originalNoteId = 'note-123';
      const mockNote = {
        id: originalNoteId,
        title: 'Original Note',
        sdId: 'test-sd',
        folderId: 'folder-123',
        deleted: false,
        pinned: false,
        contentPreview: 'Preview',
        contentText: 'Content',
        created: Date.now(),
        modified: Date.now(),
      };

      const mockNoteDoc = createMockNoteDoc({
        getMetadata: jest.fn().mockReturnValue({
          id: originalNoteId,
          sdId: 'test-sd',
          folderId: 'folder-123',
          deleted: false,
          pinned: false,
        }),
        getText: jest.fn().mockReturnValue({ toJSON: () => 'Content' }),
      });

      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);
      mocks.crdtManager.createDocument.mockResolvedValue('00000001-0000-4000-8000-000000000000');

      const duplicateId = await (handlers as any).handleDuplicateNote(mockEvent, originalNoteId);

      expect(duplicateId).toBe('00000001-0000-4000-8000-000000000000');
      expect(mocks.crdtManager.createDocument).toHaveBeenCalled();
      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          id: duplicateId,
          title: 'Original Note (Copy)',
          sdId: 'test-sd',
          folderId: 'folder-123',
          pinned: false,
        })
      );
    });
  });
});
