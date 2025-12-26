/**
 * Note Query Handlers Tests
 *
 * Tests for note query operations (getMetadata, list, search, counts, getInfo, etc.)
 *
 * NOTE: Simplified test file. More comprehensive tests in original handlers.test.ts
 */

import {
  createAllMocks,
  castMocksToReal,
  resetUuidCounter,
  clearHandlerRegistry,
  invokeHandler,
  createMockNoteDoc,
  type AllMocks,
} from './test-utils';

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('electron', () => ({
  ipcMain: require('./test-utils').createMockIpcMain(),
  BrowserWindow: { getAllWindows: jest.fn(() => []) },
  app: {
    getPath: jest.fn((name: string) => (name === 'userData' ? '/mock/user/data' : `/mock/${name}`)),
  },
}));

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
jest.mock('fs/promises', () => ({
  ...jest.requireActual('fs/promises'),
  readdir: jest.fn().mockResolvedValue([]),
  readFile: jest.fn().mockRejectedValue({ code: 'ENOENT' }),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockRejectedValue({ code: 'ENOENT' }),
}));
jest.mock('../../../storage/node-fs-adapter', () => {
  const path = jest.requireActual('path');
  const fileStore = new Map();
  return {
    NodeFileSystemAdapter: jest.fn().mockImplementation(() => ({
      exists: jest.fn().mockImplementation(async (p: string) => fileStore.has(p)),
      mkdir: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      appendFile: jest.fn().mockResolvedValue(undefined),
      deleteFile: jest.fn(),
      listFiles: jest.fn().mockResolvedValue([]),
      joinPath: (...s: string[]) => path.join(...s),
      dirname: (p: string) => path.dirname(p),
      basename: (p: string) => path.basename(p),
    })),
    __clearFileStore: () => {
      fileStore.clear();
    },
  };
});

import { IPCHandlers } from '../../handlers';

describe('Note Query Handlers', () => {
  let handlers: IPCHandlers;
  let mocks: AllMocks;

  beforeEach(async () => {
    resetUuidCounter();
    mocks = createAllMocks();
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
    clearHandlerRegistry();
  });

  describe('note:list', () => {
    it('should list notes in a folder', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'folder-123';
      const notes = [{ id: 'note-1', title: 'Note 1' }];
      mocks.database.getNotesByFolder.mockResolvedValue(notes);
      const result = await invokeHandler('note:list', mockEvent, sdId, folderId);
      expect(result).toEqual(notes);
    });
  });

  describe('note:search', () => {
    it('should search notes', async () => {
      const mockEvent = {} as any;
      const query = 'test';
      const results = [
        { noteId: 'note-1', title: 'Test Note', snippet: 'test content', rank: 0.5 },
      ];
      mocks.database.searchNotes.mockResolvedValue(results);
      const result = await invokeHandler('note:search', mockEvent, query);
      expect(result).toEqual(results);
    });
  });

  describe('note:getMetadata', () => {
    it('should return note metadata', async () => {
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
      const crdtMetadata = {
        id: noteId,
        sdId: 'test-sd',
        folderId: null,
        deleted: false,
        pinned: false,
        created: Date.now(),
        modified: Date.now(),
      };
      const mockNoteDoc = createMockNoteDoc({
        getMetadata: jest.fn().mockReturnValue(crdtMetadata),
      });
      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);
      const result = await invokeHandler<{
        createdAt: number;
        modifiedAt: number;
        noteId: string;
        sdId: string;
        title: string;
        folderId: string;
        deleted: boolean;
      }>('note:getMetadata', mockEvent, noteId);
      expect(result).toMatchObject({
        noteId: noteId,
        sdId: 'test-sd',
        title: 'Test Note',
        folderId: '',
        deleted: false,
      });
      expect(result.createdAt).toBeDefined();
      expect(result.modifiedAt).toBeDefined();
    });

    it('should return sdId from database record', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-456';
      const expectedSdId = 'my-custom-sd';
      const mockNote = {
        id: noteId,
        title: 'Another Note',
        sdId: expectedSdId,
        folderId: 'folder-1',
        deleted: false,
        pinned: false,
        contentPreview: '',
        contentText: '',
        created: Date.now(),
        modified: Date.now(),
      };
      const crdtMetadata = {
        id: noteId,
        sdId: expectedSdId,
        folderId: 'folder-1',
        deleted: false,
        pinned: false,
        created: Date.now(),
        modified: Date.now(),
      };
      const mockNoteDoc = createMockNoteDoc({
        getMetadata: jest.fn().mockReturnValue(crdtMetadata),
      });
      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      const result = await invokeHandler<{ sdId: string }>('note:getMetadata', mockEvent, noteId);

      expect(result.sdId).toBe(expectedSdId);
    });
  });

  describe('note:getCountForFolder', () => {
    it('should return note count for folder', async () => {
      const mockEvent = {} as any;
      const folderId = 'folder-123';
      mocks.database.getNoteCountForFolder.mockResolvedValue(5);
      const result = await invokeHandler('note:getCountForFolder', mockEvent, folderId);
      expect(result).toBe(5);
    });
  });
});
