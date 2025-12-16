/**
 * Misc Handlers Tests
 *
 * Tests for miscellaneous handlers (app state, config, tags, links, telemetry).
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
  type AllMocks,
} from './test-utils';

describe('Misc Handlers', () => {
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

  describe('appState:get', () => {
    it('should get state value', async () => {
      const mockEvent = {} as any;
      const key = 'testKey';
      const value = 'testValue';
      mocks.database.getState.mockResolvedValue(value);

      const result = await (handlers as any).handleGetAppState(mockEvent, key);

      expect(result).toBe(value);
      expect(mocks.database.getState).toHaveBeenCalledWith(key);
    });

    it('should return null for non-existent key', async () => {
      const mockEvent = {} as any;
      mocks.database.getState.mockResolvedValue(null);

      const result = await (handlers as any).handleGetAppState(mockEvent, 'nonExistent');

      expect(result).toBeNull();
    });
  });

  describe('appState:set', () => {
    it('should set state value', async () => {
      const mockEvent = {} as any;
      const key = 'testKey';
      const value = 'testValue';

      await (handlers as any).handleSetAppState(mockEvent, key, value);

      expect(mocks.database.setState).toHaveBeenCalledWith(key, value);
    });
  });

  describe('config:getDatabasePath', () => {
    it('should return database path', async () => {
      const mockEvent = {} as any;
      mocks.configManager.getDatabasePath.mockResolvedValue('/test/path/notecove.db');

      const result = await (handlers as any).handleGetDatabasePath(mockEvent);

      expect(result).toBe('/test/path/notecove.db');
    });
  });

  describe('config:setDatabasePath', () => {
    it('should set database path', async () => {
      const mockEvent = {} as any;
      const newPath = '/new/path/notecove.db';

      await (handlers as any).handleSetDatabasePath(mockEvent, newPath);

      expect(mocks.configManager.setDatabasePath).toHaveBeenCalledWith(newPath);
    });
  });

  describe('tag:getAll', () => {
    it('should return all tags', async () => {
      const mockEvent = {} as any;
      const tags = [
        { name: 'work', count: 5 },
        { name: 'personal', count: 3 },
      ];

      mocks.database.getAllTags.mockResolvedValue(tags);

      const result = await (handlers as any).handleGetAllTags(mockEvent);

      expect(result).toEqual(tags);
    });
  });

  describe('link:getBacklinks', () => {
    it('should return backlinks for a note', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const backlinks = [
        { sourceNoteId: 'note-456', title: 'Note 456' },
        { sourceNoteId: 'note-789', title: 'Note 789' },
      ];

      mocks.database.getBacklinks.mockResolvedValue(backlinks);

      const result = await (handlers as any).handleGetBacklinks(mockEvent, noteId);

      expect(result).toEqual(backlinks);
      expect(mocks.database.getBacklinks).toHaveBeenCalledWith(noteId);
    });
  });
});
