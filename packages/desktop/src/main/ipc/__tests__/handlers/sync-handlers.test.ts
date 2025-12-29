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

  describe('appState:set', () => {
    it('should save username to database and fetch profile for broadcast', async () => {
      const mockEvent = {} as any;

      // Set up database mock to return current values
      mocks.database.getState.mockImplementation(async (key: string) => {
        if (key === 'username') return 'NewUser';
        if (key === 'userHandle') return 'newhandle';
        return null;
      });

      await invokeHandler('appState:set', mockEvent, 'username', 'NewUser');

      // Verify database was called to set value
      expect(mocks.database.setState).toHaveBeenCalledWith('username', 'NewUser');

      // Verify database was queried for broadcast data
      // (broadcastToAll is called internally, verified by implementation)
      expect(mocks.database.getState).toHaveBeenCalledWith('username');
      expect(mocks.database.getState).toHaveBeenCalledWith('userHandle');
    });

    it('should save userHandle to database and fetch profile for broadcast', async () => {
      const mockEvent = {} as any;

      mocks.database.getState.mockImplementation(async (key: string) => {
        if (key === 'username') return 'TestUser';
        if (key === 'userHandle') return 'newhandle';
        return null;
      });

      await invokeHandler('appState:set', mockEvent, 'userHandle', 'newhandle');

      expect(mocks.database.setState).toHaveBeenCalledWith('userHandle', 'newhandle');
      expect(mocks.database.getState).toHaveBeenCalledWith('username');
      expect(mocks.database.getState).toHaveBeenCalledWith('userHandle');
    });

    it('should not fetch profile for non-user settings', async () => {
      const mockEvent = {} as any;

      await invokeHandler('appState:set', mockEvent, 'someOtherKey', 'value');

      expect(mocks.database.setState).toHaveBeenCalledWith('someOtherKey', 'value');
      // Should not query for username/handle since it's not a user setting
      expect(mocks.database.getState).not.toHaveBeenCalledWith('username');
      expect(mocks.database.getState).not.toHaveBeenCalledWith('userHandle');
    });
  });
});
