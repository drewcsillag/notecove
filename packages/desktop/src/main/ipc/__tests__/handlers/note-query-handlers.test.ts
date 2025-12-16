/**
 * Note Query Handlers Tests
 *
 * Tests for note query operations (getMetadata, list, search, counts, getInfo, etc.)
 *
 * NOTE: Simplified test file. More comprehensive tests in original handlers.test.ts
 */

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn(), removeHandler: jest.fn() },
  BrowserWindow: { getAllWindows: jest.fn(() => []) },
  app: { getPath: jest.fn((name: string) => name === 'userData' ? '/mock/user/data' : `/mock/${name}`) },
}));

jest.mock('crypto', () => ({ ...jest.requireActual('crypto'), randomUUID: jest.fn((): string => { const { nextUuid } = require('./test-utils'); return nextUuid(); }) }));
jest.mock('uuid', () => ({ v4: jest.fn((): string => { const { nextUuid } = require('./test-utils'); return nextUuid(); }) }));
jest.mock('fs/promises', () => ({ ...jest.requireActual('fs/promises'), readdir: jest.fn().mockResolvedValue([]), readFile: jest.fn().mockRejectedValue({ code: 'ENOENT' }), writeFile: jest.fn().mockResolvedValue(undefined), unlink: jest.fn().mockResolvedValue(undefined), mkdir: jest.fn().mockResolvedValue(undefined), access: jest.fn().mockRejectedValue({ code: 'ENOENT' }) }));
jest.mock('../../../storage/node-fs-adapter', () => { const path = jest.requireActual('path'); const fileStore = new Map(); return { NodeFileSystemAdapter: jest.fn().mockImplementation(() => ({ exists: jest.fn().mockImplementation(async (p: string) => fileStore.has(p)), mkdir: jest.fn().mockResolvedValue(undefined), readFile: jest.fn(), writeFile: jest.fn(), appendFile: jest.fn().mockResolvedValue(undefined), deleteFile: jest.fn(), listFiles: jest.fn().mockResolvedValue([]), joinPath: (...s: string[]) => path.join(...s), dirname: (p: string) => path.dirname(p), basename: (p: string) => path.basename(p) })), __clearFileStore: () => fileStore.clear() }; });

import { IPCHandlers } from '../../handlers';
import { createAllMocks, castMocksToReal, resetUuidCounter, createMockNoteDoc, type AllMocks } from './test-utils';

describe('Note Query Handlers', () => {
  let handlers: IPCHandlers;
  let mocks: AllMocks;

  beforeEach(async () => {
    resetUuidCounter();
    mocks = createAllMocks();
    const realMocks = castMocksToReal(mocks);
    handlers = new IPCHandlers(realMocks.crdtManager, realMocks.database, realMocks.configManager, realMocks.appendLogManager, realMocks.noteMoveManager, realMocks.diagnosticsManager, realMocks.backupManager, 'test-profile-id');
  });

  afterEach(() => { handlers.destroy(); });

  describe('note:list', () => {
    it('should list notes in a folder', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'folder-123';
      const notes = [{ id: 'note-1', title: 'Note 1' }];
      mocks.database.getNotesByFolder.mockResolvedValue(notes);
      const result = await (handlers as any).handleListNotes(mockEvent, sdId, folderId);
      expect(result).toEqual(notes);
    });
  });

  describe('note:search', () => {
    it('should search notes', async () => {
      const mockEvent = {} as any;
      const query = 'test';
      const results = [{ noteId: 'note-1', title: 'Test Note', snippet: 'test content', rank: 0.5 }];
      mocks.database.searchNotes.mockResolvedValue(results);
      const result = await (handlers as any).handleSearchNotes(mockEvent, query);
      expect(result).toEqual(results);
    });
  });

  describe('note:getMetadata', () => {
    it('should return note metadata', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const metadata = { id: noteId, sdId: 'test-sd', folderId: null, deleted: false };
      const mockNoteDoc = createMockNoteDoc({ getMetadata: jest.fn().mockReturnValue(metadata) });
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);
      const result = await (handlers as any).handleGetNoteMetadata(mockEvent, noteId);
      expect(result).toEqual(metadata);
    });
  });

  describe('note:getCountForFolder', () => {
    it('should return note count for folder', async () => {
      const mockEvent = {} as any;
      const folderId = 'folder-123';
      mocks.database.getNoteCountForFolder.mockResolvedValue(5);
      const result = await (handlers as any).handleGetNoteCountForFolder(mockEvent, folderId);
      expect(result).toBe(5);
    });
  });
});
