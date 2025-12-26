/**
 * Sync Handlers Tests
 *
 * NOTE: Simplified test file. More comprehensive tests in original handlers.test.ts
 */

import {
  createAllMocks,
  castMocksToReal,
  resetUuidCounter,
  clearHandlerRegistry,
  invokeHandler,
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

describe('Sync Handlers', () => {
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

  describe('sync:getStatus', () => {
    it('should return sync status', async () => {
      const mockEvent = {} as any;
      const result = await invokeHandler('sync:getStatus', mockEvent);
      expect(result).toEqual({
        pendingCount: 0,
        perSd: [],
        isSyncing: false,
      });
    });
  });
});
