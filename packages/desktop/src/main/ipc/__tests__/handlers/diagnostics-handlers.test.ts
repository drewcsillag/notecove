/**
 * Diagnostics Handlers Tests
 *
 * Tests for diagnostics operations.
 *
 * NOTE: This is a simplified test file. More comprehensive tests exist in the original
 * handlers.test.ts file and should be migrated here over time.
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
      exists: jest.fn().mockImplementation(async (filePath: string) => fileStore.has(filePath)),
      mkdir: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn().mockImplementation(async (filePath: string) => {
        if (fileStore.has(filePath)) return fileStore.get(filePath);
        const error = new Error(
          `ENOENT: no such file or directory, open '${filePath}'`
        ) as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      }),
      writeFile: jest
        .fn()
        .mockImplementation(async (filePath: string, data: Uint8Array) =>
          fileStore.set(filePath, data)
        ),
      appendFile: jest.fn().mockResolvedValue(undefined),
      deleteFile: jest
        .fn()
        .mockImplementation(async (filePath: string) => fileStore.delete(filePath)),
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
import { createAllMocks, castMocksToReal, resetUuidCounter, type AllMocks } from './test-utils';

describe('Diagnostics Handlers', () => {
  let handlers: IPCHandlers;
  let mocks: AllMocks;

  beforeEach(async () => {
    resetUuidCounter();
    const nodeFs = await import('../../../storage/node-fs-adapter');
    const nodeFsWithClear = nodeFs as unknown as { __clearFileStore?: () => void };
    if (typeof nodeFsWithClear.__clearFileStore === 'function') {
      nodeFsWithClear.__clearFileStore();
    }

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
  });

  describe('diagnostics:getDuplicateNotes', () => {
    it('should return duplicate notes', async () => {
      const mockEvent = {} as any;
      const duplicates = [{ noteId: 'note-1', count: 2 }];

      mocks.diagnosticsManager.detectDuplicateNotes.mockResolvedValue(duplicates);

      const result = await (handlers as any).handleGetDuplicateNotes(mockEvent);

      expect(result).toEqual(duplicates);
    });
  });

  describe('diagnostics:getOrphanedCRDTFiles', () => {
    it('should return orphaned CRDT files', async () => {
      const mockEvent = {} as any;
      const orphaned = [{ noteId: 'orphan-1', sdId: 'sd-1' }];

      mocks.diagnosticsManager.detectOrphanedCRDTFiles.mockResolvedValue(orphaned);

      const result = await (handlers as any).handleGetOrphanedCRDTFiles(mockEvent);

      expect(result).toEqual(orphaned);
    });
  });
});
