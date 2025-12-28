/**
 * SD (Storage Directory) Handlers Tests
 *
 * Tests for storage directory management via IPC handlers.
 */

import {
  createAllMocks,
  castMocksToReal,
  resetUuidCounter,
  clearHandlerRegistry,
  invokeHandler,
  type AllMocks,
} from './test-utils';

// Mock electron with handler registry
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('electron', () => ({
  ipcMain: require('./test-utils').createMockIpcMain(),
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

describe('SD Handlers', () => {
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
    clearHandlerRegistry();
  });

  describe('sd:list', () => {
    it('should return all storage directories', async () => {
      const mockEvent = {} as any;
      const sds = [
        { id: 'sd1', name: 'Work', path: '/path/work', created: 1000, isActive: true },
        { id: 'sd2', name: 'Personal', path: '/path/personal', created: 2000, isActive: false },
      ];

      mocks.database.getAllStorageDirs.mockResolvedValue(sds);

      const result = await invokeHandler('sd:list', mockEvent);

      expect(mocks.database.getAllStorageDirs).toHaveBeenCalled();
      expect(result).toEqual(sds);
    });

    it('should return empty array when no SDs exist', async () => {
      const mockEvent = {} as any;
      mocks.database.getAllStorageDirs.mockResolvedValue([]);

      const result = await invokeHandler('sd:list', mockEvent);

      expect(result).toEqual([]);
    });
  });

  describe('sd:create', () => {
    it('should create a new storage directory', async () => {
      const mockEvent = {} as any;
      const name = 'Work';
      const path = '/path/to/work';

      // Capture the ID that was generated
      let capturedId = '';
      mocks.database.createStorageDir.mockImplementation(async (id: string) => {
        capturedId = id;
        return {
          id,
          name,
          path,
          created: Date.now(),
          isActive: false,
          uuid: 'target-uuid-5678',
        };
      });

      const result = await invokeHandler('sd:create', mockEvent, name, path);

      // Verify createStorageDir was called with a compact UUID (22 chars)
      expect(mocks.database.createStorageDir).toHaveBeenCalledWith(
        expect.stringMatching(/^[A-Za-z0-9_-]{22}$/),
        name,
        path
      );
      // Result should match the generated ID
      expect(result).toBe(capturedId);
      expect(result).toMatch(/^[A-Za-z0-9_-]{22}$/);
    });

    it('should create first SD as active', async () => {
      const mockEvent = {} as any;
      const name = 'Work';
      const path = '/path/to/work';

      mocks.database.createStorageDir.mockImplementation(async (id: string) => ({
        id,
        name,
        path,
        created: Date.now(),
        isActive: true,
        uuid: 'source-uuid-1234',
      }));

      await invokeHandler('sd:create', mockEvent, name, path);

      expect(mocks.database.createStorageDir).toHaveBeenCalled();
    });
  });

  describe('sd:setActive', () => {
    it('should set the active storage directory', async () => {
      const mockEvent = {} as any;
      const sdId = 'sd2';

      await invokeHandler('sd:setActive', mockEvent, sdId);

      expect(mocks.database.setActiveStorageDir).toHaveBeenCalledWith(sdId);
    });
  });

  describe('sd:getActive', () => {
    it('should return the active storage directory ID', async () => {
      const mockEvent = {} as any;
      const activeSd = {
        id: 'sd1',
        name: 'Work',
        path: '/path/work',
        created: 1000,
        isActive: true,
        uuid: 'source-uuid-1234',
      };

      mocks.database.getActiveStorageDir.mockResolvedValue(activeSd);

      const result = await invokeHandler('sd:getActive', mockEvent);

      expect(mocks.database.getActiveStorageDir).toHaveBeenCalled();
      expect(result).toEqual('sd1');
    });

    it('should return null when no active SD exists', async () => {
      const mockEvent = {} as any;
      mocks.database.getActiveStorageDir.mockResolvedValue(null);

      const result = await invokeHandler('sd:getActive', mockEvent);

      expect(result).toBeNull();
    });
  });

  describe('sd:delete', () => {
    it('should delete storage directory', async () => {
      const mockEvent = {} as any;

      mocks.database.deleteStorageDir.mockResolvedValue(undefined);

      await invokeHandler('sd:delete', mockEvent, 'test-sd');

      expect(mocks.database.deleteStorageDir).toHaveBeenCalledWith('test-sd');
    });

    it('should call onStorageDirDeleted callback before deleting from database', async () => {
      const mockEvent = {} as any;
      const onStorageDirDeleted = jest.fn().mockResolvedValue(undefined);
      const callOrder: string[] = [];

      // Clean up default handlers first
      handlers.destroy();
      clearHandlerRegistry();

      // Track call order
      onStorageDirDeleted.mockImplementation(async () => {
        callOrder.push('onStorageDirDeleted');
      });
      mocks.database.deleteStorageDir.mockImplementation(async () => {
        callOrder.push('deleteStorageDir');
      });

      // Create handlers with the callback
      const realMocks = castMocksToReal(mocks);
      const handlersWithCallback = new IPCHandlers(
        realMocks.crdtManager,
        realMocks.database,
        realMocks.configManager,
        realMocks.appendLogManager,
        realMocks.noteMoveManager,
        realMocks.diagnosticsManager,
        realMocks.backupManager,
        'test-profile-id',
        undefined, // createWindowFn
        undefined, // onStorageDirCreated
        onStorageDirDeleted // onStorageDirDeleted
      );

      await invokeHandler('sd:delete', mockEvent, 'test-sd');

      expect(onStorageDirDeleted).toHaveBeenCalledWith('test-sd');
      expect(mocks.database.deleteStorageDir).toHaveBeenCalledWith('test-sd');
      // Verify callback is called BEFORE database delete
      expect(callOrder).toEqual(['onStorageDirDeleted', 'deleteStorageDir']);

      handlersWithCallback.destroy();
      clearHandlerRegistry();
    });
  });

  describe('sd:getCloudStoragePaths', () => {
    it('should return cloud storage paths object', async () => {
      const mockEvent = {} as any;
      const result = await invokeHandler('sd:getCloudStoragePaths', mockEvent);

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(Array.isArray(result)).toBe(false);
    });
  });
});
