/**
 * Folder Handlers Tests
 *
 * Tests for folder CRUD operations via IPC handlers.
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
import type { FolderData } from '@notecove/shared';
import { createAllMocks, castMocksToReal, resetUuidCounter, type AllMocks } from './test-utils';

describe('Folder Handlers', () => {
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

  describe('folder:create', () => {
    it('should create a root folder with valid name', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const name = 'New Folder';

      mocks.folderTree.getRootFolders.mockReturnValue([]);
      mocks.folderTree.getFolder.mockImplementation((id: string) => ({
        id,
        name: 'New Folder',
        parentId: null,
        sdId,
        order: 0,
        deleted: false,
      }));
      mocks.folderTree.getSiblings.mockImplementation((id: string) => [
        {
          id,
          name: 'New Folder',
          parentId: null,
          sdId,
          order: 0,
          deleted: false,
        },
      ]);

      const result = await (handlers as any).handleCreateFolder(mockEvent, sdId, null, name);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');

      expect(mocks.crdtManager.loadFolderTree).toHaveBeenCalledWith(sdId);
      expect(mocks.folderTree.getRootFolders).toHaveBeenCalled();

      expect(mocks.folderTree.createFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: result,
          name: 'New Folder',
          parentId: null,
          sdId,
          order: 0,
          deleted: false,
        })
      );

      expect(mocks.database.upsertFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: result,
          name: 'New Folder',
          parentId: null,
          sdId,
          order: 0,
          deleted: false,
        })
      );
    });

    it('should create a subfolder when parentId is provided', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const parentId = 'parent-folder-id';
      const name = 'Sub Folder';

      mocks.folderTree.getChildFolders.mockReturnValue([
        { id: 'existing', name: 'Existing', order: 0 } as FolderData,
      ]);

      await (handlers as any).handleCreateFolder(mockEvent, sdId, parentId, name);

      expect(mocks.folderTree.getChildFolders).toHaveBeenCalledWith(parentId);

      expect(mocks.folderTree.createFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId,
          order: 1,
        })
      );
    });

    it('should reject empty folder name', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';

      await expect((handlers as any).handleCreateFolder(mockEvent, sdId, null, '')).rejects.toThrow(
        'Folder name cannot be empty'
      );

      await expect(
        (handlers as any).handleCreateFolder(mockEvent, sdId, null, '   ')
      ).rejects.toThrow('Folder name cannot be empty');
    });

    it('should reject duplicate folder names (case-insensitive)', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const name = 'Duplicate';

      mocks.folderTree.getRootFolders.mockReturnValue([
        { id: 'existing', name: 'duplicate', order: 0 } as FolderData,
      ]);

      await expect(
        (handlers as any).handleCreateFolder(mockEvent, sdId, null, name)
      ).rejects.toThrow('A folder named "Duplicate" already exists in this location');
    });

    it('should trim folder names', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const name = '  Trimmed Name  ';

      mocks.folderTree.getRootFolders.mockReturnValue([]);

      await (handlers as any).handleCreateFolder(mockEvent, sdId, null, name);

      expect(mocks.folderTree.createFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Trimmed Name',
        })
      );
    });

    it('should calculate correct order for multiple folders', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const name = 'Third Folder';

      mocks.folderTree.getRootFolders.mockReturnValue([
        { id: 'f1', name: 'First', order: 0 } as FolderData,
        { id: 'f2', name: 'Second', order: 1 } as FolderData,
      ]);

      await (handlers as any).handleCreateFolder(mockEvent, sdId, null, name);

      expect(mocks.folderTree.createFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          order: 2,
        })
      );
    });
  });

  describe('folder:rename', () => {
    it('should rename folder with valid name', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'folder-id';
      const newName = 'Renamed Folder';
      const existingFolder: FolderData = {
        id: folderId,
        name: 'Old Name',
        parentId: null,
        sdId,
        order: 0,
        deleted: false,
      };

      mocks.folderTree.getFolder.mockReturnValue(existingFolder);
      mocks.folderTree.getRootFolders.mockReturnValue([existingFolder]);

      await (handlers as any).handleRenameFolder(mockEvent, sdId, folderId, newName);

      expect(mocks.folderTree.getFolder).toHaveBeenCalledWith(folderId);
      expect(mocks.folderTree.getRootFolders).toHaveBeenCalled();

      expect(mocks.folderTree.updateFolder).toHaveBeenCalledWith(folderId, {
        name: 'Renamed Folder',
      });

      expect(mocks.database.upsertFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: folderId,
          name: 'Renamed Folder',
        })
      );
    });

    it('should reject empty folder name', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'folder-id';

      await expect(
        (handlers as any).handleRenameFolder(mockEvent, sdId, folderId, '')
      ).rejects.toThrow('Folder name cannot be empty');
    });

    it('should reject if folder not found', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'nonexistent';
      const newName = 'New Name';

      mocks.folderTree.getFolder.mockReturnValue(null);

      await expect(
        (handlers as any).handleRenameFolder(mockEvent, sdId, folderId, newName)
      ).rejects.toThrow('Folder nonexistent not found');
    });

    it('should reject duplicate names in same location (case-insensitive)', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'folder-1';
      const newName = 'Existing';
      const folder1: FolderData = {
        id: folderId,
        name: 'Folder 1',
        parentId: null,
        sdId,
        order: 0,
        deleted: false,
      };
      const folder2: FolderData = {
        id: 'folder-2',
        name: 'existing',
        parentId: null,
        sdId,
        order: 1,
        deleted: false,
      };

      mocks.folderTree.getFolder.mockReturnValue(folder1);
      mocks.folderTree.getRootFolders.mockReturnValue([folder1, folder2]);

      await expect(
        (handlers as any).handleRenameFolder(mockEvent, sdId, folderId, newName)
      ).rejects.toThrow('A folder named "Existing" already exists in this location');
    });

    it('should allow renaming to same name (case changes)', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'folder-id';
      const newName = 'FOLDER';
      const existingFolder: FolderData = {
        id: folderId,
        name: 'folder',
        parentId: null,
        sdId,
        order: 0,
        deleted: false,
      };

      mocks.folderTree.getFolder.mockReturnValue(existingFolder);
      mocks.folderTree.getRootFolders.mockReturnValue([existingFolder]);

      await (handlers as any).handleRenameFolder(mockEvent, sdId, folderId, newName);

      expect(mocks.folderTree.updateFolder).toHaveBeenCalledWith(folderId, {
        name: 'FOLDER',
      });
    });

    it('should check child folders when renaming subfolder', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const parentId = 'parent-id';
      const folderId = 'child-id';
      const newName = 'Renamed Child';
      const childFolder: FolderData = {
        id: folderId,
        name: 'Old Child',
        parentId,
        sdId,
        order: 0,
        deleted: false,
      };

      mocks.folderTree.getFolder.mockReturnValue(childFolder);
      mocks.folderTree.getChildFolders.mockReturnValue([childFolder]);

      await (handlers as any).handleRenameFolder(mockEvent, sdId, folderId, newName);

      expect(mocks.folderTree.getChildFolders).toHaveBeenCalledWith(parentId);
      expect(mocks.folderTree.getRootFolders).not.toHaveBeenCalled();
    });
  });

  describe('folder:delete', () => {
    it('should soft delete folder', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'folder-id';
      const folder: FolderData = {
        id: folderId,
        name: 'To Delete',
        parentId: null,
        sdId,
        order: 0,
        deleted: false,
      };

      mocks.folderTree.getFolder.mockReturnValue(folder);

      await (handlers as any).handleDeleteFolder(mockEvent, sdId, folderId);

      expect(mocks.folderTree.getFolder).toHaveBeenCalledWith(folderId);
      expect(mocks.folderTree.deleteFolder).toHaveBeenCalledWith(folderId);

      expect(mocks.database.upsertFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: folderId,
          deleted: true,
        })
      );
    });

    it('should reject if folder not found', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'nonexistent';

      mocks.folderTree.getFolder.mockReturnValue(null);

      await expect((handlers as any).handleDeleteFolder(mockEvent, sdId, folderId)).rejects.toThrow(
        'Folder nonexistent not found'
      );
    });
  });

  describe('folder:list', () => {
    it('should list all visible folders for SD', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folders: FolderData[] = [
        {
          id: 'f1',
          name: 'Folder 1',
          parentId: null,
          sdId,
          order: 0,
          deleted: false,
        },
        {
          id: 'f2',
          name: 'Folder 2',
          parentId: 'f1',
          sdId,
          order: 0,
          deleted: false,
        },
      ];

      mocks.folderTree.getVisibleFolders.mockReturnValue(folders);

      const result = await (handlers as any).handleListFolders(mockEvent, sdId);

      expect(mocks.crdtManager.loadFolderTree).toHaveBeenCalledWith(sdId);
      expect(mocks.folderTree.getVisibleFolders).toHaveBeenCalled();
      expect(result).toEqual(folders);
    });
  });

  describe('folder:get', () => {
    it('should get single folder by ID', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'folder-id';
      const folder: FolderData = {
        id: folderId,
        name: 'Test Folder',
        parentId: null,
        sdId,
        order: 0,
        deleted: false,
      };

      mocks.folderTree.getFolder.mockReturnValue(folder);

      const result = await (handlers as any).handleGetFolder(mockEvent, sdId, folderId);

      expect(mocks.crdtManager.loadFolderTree).toHaveBeenCalledWith(sdId);
      expect(mocks.folderTree.getFolder).toHaveBeenCalledWith(folderId);
      expect(result).toEqual(folder);
    });

    it('should return null if folder not found', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'nonexistent';

      mocks.folderTree.getFolder.mockReturnValue(null);

      const result = await (handlers as any).handleGetFolder(mockEvent, sdId, folderId);

      expect(result).toBeNull();
    });
  });

  describe('folder:move', () => {
    it('should move folder to new parent', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'folder-1';
      const newParentId = 'parent-2';
      const folder: FolderData = {
        id: folderId,
        name: 'Folder 1',
        parentId: 'parent-1',
        sdId,
        order: 0,
        deleted: false,
      };

      const newParent: FolderData = {
        id: newParentId,
        name: 'Parent 2',
        parentId: null,
        sdId,
        order: 0,
        deleted: false,
      };

      mocks.folderTree.getFolder.mockImplementation((id: string) => {
        if (id === folderId) return folder;
        if (id === newParentId) return newParent;
        return null;
      });
      mocks.folderTree.getChildFolders.mockReturnValue([]);

      await (handlers as any).handleMoveFolder(mockEvent, sdId, folderId, newParentId);

      expect(mocks.folderTree.getFolder).toHaveBeenCalledWith(folderId);
      expect(mocks.folderTree.getChildFolders).toHaveBeenCalledWith(newParentId);

      expect(mocks.folderTree.updateFolder).toHaveBeenCalledWith(folderId, {
        parentId: newParentId,
        order: 0,
      });

      expect(mocks.database.upsertFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: folderId,
          parentId: newParentId,
          order: 0,
        })
      );
    });

    it('should move folder to root level (null parent)', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'folder-1';
      const folder: FolderData = {
        id: folderId,
        name: 'Folder 1',
        parentId: 'parent-1',
        sdId,
        order: 0,
        deleted: false,
      };

      mocks.folderTree.getFolder.mockReturnValue(folder);
      mocks.folderTree.getRootFolders.mockReturnValue([
        { id: 'root-1', name: 'Root 1', order: 0 } as FolderData,
      ]);

      await (handlers as any).handleMoveFolder(mockEvent, sdId, folderId, null);

      expect(mocks.folderTree.getRootFolders).toHaveBeenCalled();

      expect(mocks.folderTree.updateFolder).toHaveBeenCalledWith(folderId, {
        parentId: null,
        order: 1,
      });
    });

    it('should calculate correct order when moving to folder with children', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'folder-1';
      const newParentId = 'parent-2';
      const folder: FolderData = {
        id: folderId,
        name: 'Folder 1',
        parentId: 'parent-1',
        sdId,
        order: 0,
        deleted: false,
      };

      const newParent: FolderData = {
        id: newParentId,
        name: 'Parent 2',
        parentId: null,
        sdId,
        order: 0,
        deleted: false,
      };

      mocks.folderTree.getFolder.mockImplementation((id: string) => {
        if (id === folderId) return folder;
        if (id === newParentId) return newParent;
        return null;
      });
      mocks.folderTree.getChildFolders.mockReturnValue([
        { id: 'sibling-1', name: 'Sibling 1', order: 0 } as FolderData,
        { id: 'sibling-2', name: 'Sibling 2', order: 1 } as FolderData,
      ]);

      await (handlers as any).handleMoveFolder(mockEvent, sdId, folderId, newParentId);

      expect(mocks.folderTree.updateFolder).toHaveBeenCalledWith(folderId, {
        parentId: newParentId,
        order: 2,
      });
    });

    it('should reject move if folder not found', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'nonexistent';
      const newParentId = 'parent-2';

      mocks.folderTree.getFolder.mockReturnValue(null);

      await expect(
        (handlers as any).handleMoveFolder(mockEvent, sdId, folderId, newParentId)
      ).rejects.toThrow('Folder nonexistent not found');
    });

    it('should reject circular reference (folder to its own child)', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'folder-1';
      const newParentId = 'folder-1-child';

      const folder1: FolderData = {
        id: folderId,
        name: 'Folder 1',
        parentId: null,
        sdId,
        order: 0,
        deleted: false,
      };

      const folder1Child: FolderData = {
        id: 'folder-1-child',
        name: 'Child of Folder 1',
        parentId: folderId,
        sdId,
        order: 0,
        deleted: false,
      };

      mocks.folderTree.getFolder.mockImplementation((id: string) => {
        if (id === folderId) return folder1;
        if (id === 'folder-1-child') return folder1Child;
        return null;
      });

      await expect(
        (handlers as any).handleMoveFolder(mockEvent, sdId, folderId, newParentId)
      ).rejects.toThrow('Cannot move folder to be its own descendant');
    });

    it('should reject circular reference (folder to its own grandchild)', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'folder-1';
      const newParentId = 'folder-1-grandchild';

      const folder1: FolderData = {
        id: folderId,
        name: 'Folder 1',
        parentId: null,
        sdId,
        order: 0,
        deleted: false,
      };

      const folder1Child: FolderData = {
        id: 'folder-1-child',
        name: 'Child',
        parentId: folderId,
        sdId,
        order: 0,
        deleted: false,
      };

      const folder1Grandchild: FolderData = {
        id: 'folder-1-grandchild',
        name: 'Grandchild',
        parentId: 'folder-1-child',
        sdId,
        order: 0,
        deleted: false,
      };

      mocks.folderTree.getFolder.mockImplementation((id: string) => {
        if (id === folderId) return folder1;
        if (id === 'folder-1-child') return folder1Child;
        if (id === 'folder-1-grandchild') return folder1Grandchild;
        return null;
      });

      await expect(
        (handlers as any).handleMoveFolder(mockEvent, sdId, folderId, newParentId)
      ).rejects.toThrow('Cannot move folder to be its own descendant');
    });
  });

  describe('folder:reorder', () => {
    it('should reorder folder within same parent', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'folder-1';
      const newOrder = 2;

      await (handlers as any).handleReorderFolder(mockEvent, sdId, folderId, newOrder);

      expect(mocks.crdtManager.loadFolderTree).toHaveBeenCalledWith(sdId);
      expect(mocks.folderTree.reorderFolder).toHaveBeenCalledWith(folderId, newOrder);
    });
  });

  describe('folder:emitSelected', () => {
    it('should broadcast folder selection', async () => {
      const mockEvent = {} as any;
      const folderId = 'folder-123';

      (handlers as any).handleEmitFolderSelected(mockEvent, folderId);

      // handleEmitFolderSelected uses broadcastToAll, which is tested via window mock
      // We just verify it doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('folder:listAll', () => {
    it('should list all folders from all storage directories', async () => {
      const mockEvent = {} as any;
      const sd1 = { id: 'sd-1', name: 'SD One', path: '/sd1', uuid: 'uuid-1' };
      const sd2 = { id: 'sd-2', name: 'SD Two', path: '/sd2', uuid: 'uuid-2' };
      const folders1: FolderData[] = [
        {
          id: 'f1',
          name: 'Folder 1',
          parentId: null,
          sdId: 'sd-1',
          order: 0,
          deleted: false,
        },
      ];
      const folders2: FolderData[] = [
        {
          id: 'f2',
          name: 'Folder 2',
          parentId: null,
          sdId: 'sd-2',
          order: 0,
          deleted: false,
        },
      ];

      mocks.database.getAllStorageDirs.mockResolvedValue([sd1, sd2]);
      mocks.folderTree.getVisibleFolders
        .mockReturnValueOnce(folders1)
        .mockReturnValueOnce(folders2);

      const result = await (handlers as any).handleListAllFolders(mockEvent);

      expect(mocks.crdtManager.loadFolderTree).toHaveBeenCalledWith('sd-1');
      expect(mocks.crdtManager.loadFolderTree).toHaveBeenCalledWith('sd-2');
      expect(result).toEqual([
        { sdId: 'sd-1', sdName: 'SD One', folders: folders1 },
        { sdId: 'sd-2', sdName: 'SD Two', folders: folders2 },
      ]);
    });
  });
});
