/**
 * IPC Handlers Tests
 *
 * Tests for folder CRUD operations via IPC handlers.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

// Mock ipcMain before importing handlers
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn(),
  },
}));

// Mock crypto.randomUUID for Node <19
let uuidCounter = 0;
// eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-unnecessary-condition
const originalRandomUUID = globalThis.crypto?.randomUUID;

// Install mock before tests
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!globalThis.crypto) {
    (globalThis as any).crypto = {};
  }
  globalThis.crypto.randomUUID = (): `${string}-${string}-${string}-${string}-${string}` => {
    uuidCounter++;
    const uuid = `test-uuid-${uuidCounter.toString().padStart(8, '0')}-0000-0000-0000-000000000000`;
    return uuid as `${string}-${string}-${string}-${string}-${string}`;
  };
});

// Restore original after tests
afterAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (originalRandomUUID) {
    globalThis.crypto.randomUUID = originalRandomUUID;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  } else if (globalThis.crypto) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    delete (globalThis.crypto as any).randomUUID;
  }
});

// Reset counter before each test
beforeEach(() => {
  uuidCounter = 0;
});

import { IPCHandlers } from '../handlers';
import type { CRDTManager } from '../../crdt';
import type { Database } from '@notecove/shared';
import type { FolderData } from '@notecove/shared';

// Mock types
interface MockFolderTreeDoc {
  getActiveFolders: jest.Mock;
  getFolder: jest.Mock;
  getRootFolders: jest.Mock;
  getChildFolders: jest.Mock;
  createFolder: jest.Mock;
  updateFolder: jest.Mock;
  deleteFolder: jest.Mock;
}

interface MockCRDTManager {
  loadNote: jest.Mock;
  unloadNote: jest.Mock;
  applyUpdate: jest.Mock;
  loadFolderTree: jest.Mock;
}

interface MockDatabase {
  upsertFolder: jest.Mock;
  getState: jest.Mock;
  setState: jest.Mock;
}

describe('IPCHandlers - Folder CRUD', () => {
  let handlers: IPCHandlers;
  let mockCRDTManager: MockCRDTManager;
  let mockDatabase: MockDatabase;
  let mockFolderTree: MockFolderTreeDoc;

  beforeEach(() => {
    // Create mock folder tree
    mockFolderTree = {
      getActiveFolders: jest.fn(),
      getFolder: jest.fn(),
      getRootFolders: jest.fn(),
      getChildFolders: jest.fn(),
      createFolder: jest.fn(),
      updateFolder: jest.fn(),
      deleteFolder: jest.fn(),
    };

    // Create mock CRDT manager
    mockCRDTManager = {
      loadNote: jest.fn(),
      unloadNote: jest.fn(),
      applyUpdate: jest.fn(),
      loadFolderTree: jest.fn().mockReturnValue(mockFolderTree),
    };

    // Create mock database
    mockDatabase = {
      upsertFolder: jest.fn().mockResolvedValue(undefined),
      getState: jest.fn(),
      setState: jest.fn().mockResolvedValue(undefined),
    };

    // Create handlers
    handlers = new IPCHandlers(
      mockCRDTManager as unknown as CRDTManager,
      mockDatabase as unknown as Database
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

      mockFolderTree.getRootFolders.mockReturnValue([]);

      // Call the private handler via type assertion
      const result = await (handlers as any).handleCreateFolder(mockEvent, sdId, null, name);

      // Should return a UUID (or mock UUID in tests)
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');

      // Should load folder tree for the SD
      expect(mockCRDTManager.loadFolderTree).toHaveBeenCalledWith(sdId);

      // Should get root folders to check for conflicts
      expect(mockFolderTree.getRootFolders).toHaveBeenCalled();

      // Should create folder in CRDT
      expect(mockFolderTree.createFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: result,
          name: 'New Folder',
          parentId: null,
          sdId,
          order: 0,
          deleted: false,
        })
      );

      // Should upsert to database
      expect(mockDatabase.upsertFolder).toHaveBeenCalledWith(
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

      mockFolderTree.getChildFolders.mockReturnValue([
        { id: 'existing', name: 'Existing', order: 0 } as FolderData,
      ]);

      await (handlers as any).handleCreateFolder(mockEvent, sdId, parentId, name);

      // Should check child folders instead of root
      expect(mockFolderTree.getChildFolders).toHaveBeenCalledWith(parentId);

      // Should create with order = 1 (after existing folder with order 0)
      expect(mockFolderTree.createFolder).toHaveBeenCalledWith(
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

      mockFolderTree.getRootFolders.mockReturnValue([
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

      mockFolderTree.getRootFolders.mockReturnValue([]);

      await (handlers as any).handleCreateFolder(mockEvent, sdId, null, name);

      expect(mockFolderTree.createFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Trimmed Name',
        })
      );
    });

    it('should calculate correct order for multiple folders', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const name = 'Third Folder';

      mockFolderTree.getRootFolders.mockReturnValue([
        { id: 'f1', name: 'First', order: 0 } as FolderData,
        { id: 'f2', name: 'Second', order: 1 } as FolderData,
      ]);

      await (handlers as any).handleCreateFolder(mockEvent, sdId, null, name);

      expect(mockFolderTree.createFolder).toHaveBeenCalledWith(
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

      mockFolderTree.getFolder.mockReturnValue(existingFolder);
      mockFolderTree.getRootFolders.mockReturnValue([existingFolder]);

      await (handlers as any).handleRenameFolder(mockEvent, sdId, folderId, newName);

      // Should get the folder
      expect(mockFolderTree.getFolder).toHaveBeenCalledWith(folderId);

      // Should check siblings for conflicts
      expect(mockFolderTree.getRootFolders).toHaveBeenCalled();

      // Should update in CRDT
      expect(mockFolderTree.updateFolder).toHaveBeenCalledWith(folderId, {
        name: 'Renamed Folder',
      });

      // Should update in database
      expect(mockDatabase.upsertFolder).toHaveBeenCalledWith(
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

      mockFolderTree.getFolder.mockReturnValue(null);

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

      mockFolderTree.getFolder.mockReturnValue(folder1);
      mockFolderTree.getRootFolders.mockReturnValue([folder1, folder2]);

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

      mockFolderTree.getFolder.mockReturnValue(existingFolder);
      mockFolderTree.getRootFolders.mockReturnValue([existingFolder]);

      await (handlers as any).handleRenameFolder(mockEvent, sdId, folderId, newName);

      expect(mockFolderTree.updateFolder).toHaveBeenCalledWith(folderId, {
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

      mockFolderTree.getFolder.mockReturnValue(childFolder);
      mockFolderTree.getChildFolders.mockReturnValue([childFolder]);

      await (handlers as any).handleRenameFolder(mockEvent, sdId, folderId, newName);

      // Should check child folders, not root folders
      expect(mockFolderTree.getChildFolders).toHaveBeenCalledWith(parentId);
      expect(mockFolderTree.getRootFolders).not.toHaveBeenCalled();
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

      mockFolderTree.getFolder.mockReturnValue(folder);

      await (handlers as any).handleDeleteFolder(mockEvent, sdId, folderId);

      // Should get the folder
      expect(mockFolderTree.getFolder).toHaveBeenCalledWith(folderId);

      // Should delete in CRDT
      expect(mockFolderTree.deleteFolder).toHaveBeenCalledWith(folderId);

      // Should update in database with deleted flag
      expect(mockDatabase.upsertFolder).toHaveBeenCalledWith(
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

      mockFolderTree.getFolder.mockReturnValue(null);

      await expect((handlers as any).handleDeleteFolder(mockEvent, sdId, folderId)).rejects.toThrow(
        'Folder nonexistent not found'
      );
    });
  });

  describe('folder:list', () => {
    it('should list all active folders for SD', async () => {
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

      mockFolderTree.getActiveFolders.mockReturnValue(folders);

      const result = await (handlers as any).handleListFolders(mockEvent, sdId);

      expect(mockCRDTManager.loadFolderTree).toHaveBeenCalledWith(sdId);
      expect(mockFolderTree.getActiveFolders).toHaveBeenCalled();
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

      mockFolderTree.getFolder.mockReturnValue(folder);

      const result = await (handlers as any).handleGetFolder(mockEvent, sdId, folderId);

      expect(mockCRDTManager.loadFolderTree).toHaveBeenCalledWith(sdId);
      expect(mockFolderTree.getFolder).toHaveBeenCalledWith(folderId);
      expect(result).toEqual(folder);
    });

    it('should return null if folder not found', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'nonexistent';

      mockFolderTree.getFolder.mockReturnValue(null);

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

      // Mock getFolder to return different folders based on ID
      mockFolderTree.getFolder.mockImplementation((id: string) => {
        if (id === folderId) return folder;
        if (id === newParentId) return newParent;
        return null;
      });
      mockFolderTree.getChildFolders.mockReturnValue([]);

      await (handlers as any).handleMoveFolder(mockEvent, sdId, folderId, newParentId);

      // Should get the folder
      expect(mockFolderTree.getFolder).toHaveBeenCalledWith(folderId);

      // Should get siblings in new location
      expect(mockFolderTree.getChildFolders).toHaveBeenCalledWith(newParentId);

      // Should update CRDT with new parent and order
      expect(mockFolderTree.updateFolder).toHaveBeenCalledWith(folderId, {
        parentId: newParentId,
        order: 0,
      });

      // Should update database
      expect(mockDatabase.upsertFolder).toHaveBeenCalledWith(
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

      mockFolderTree.getFolder.mockReturnValue(folder);
      mockFolderTree.getRootFolders.mockReturnValue([
        { id: 'root-1', name: 'Root 1', order: 0 } as FolderData,
      ]);

      await (handlers as any).handleMoveFolder(mockEvent, sdId, folderId, null);

      // Should get root folders
      expect(mockFolderTree.getRootFolders).toHaveBeenCalled();

      // Should update with null parent and order after existing root
      expect(mockFolderTree.updateFolder).toHaveBeenCalledWith(folderId, {
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

      // Mock getFolder to return different folders based on ID
      mockFolderTree.getFolder.mockImplementation((id: string) => {
        if (id === folderId) return folder;
        if (id === newParentId) return newParent;
        return null;
      });
      mockFolderTree.getChildFolders.mockReturnValue([
        { id: 'sibling-1', name: 'Sibling 1', order: 0 } as FolderData,
        { id: 'sibling-2', name: 'Sibling 2', order: 1 } as FolderData,
      ]);

      await (handlers as any).handleMoveFolder(mockEvent, sdId, folderId, newParentId);

      // Should append to end (order 2)
      expect(mockFolderTree.updateFolder).toHaveBeenCalledWith(folderId, {
        parentId: newParentId,
        order: 2,
      });
    });

    it('should reject move if folder not found', async () => {
      const mockEvent = {} as any;
      const sdId = 'test-sd';
      const folderId = 'nonexistent';
      const newParentId = 'parent-2';

      mockFolderTree.getFolder.mockReturnValue(null);

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

      // Mock getFolder to return different folders based on ID
      mockFolderTree.getFolder.mockImplementation((id: string) => {
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

      mockFolderTree.getFolder.mockImplementation((id: string) => {
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
});
