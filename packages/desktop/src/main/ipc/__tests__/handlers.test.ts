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
  BrowserWindow: {
    getAllWindows: jest.fn(() => []),
  },
}));

// Mock Node.js crypto module
let uuidCounter = 0;
// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn((): string => {
    uuidCounter++;
    return `test-uuid-${uuidCounter.toString().padStart(8, '0')}-0000-0000-0000-000000000000`;
  }),
}));

// Mock crypto.randomUUID for Node <19 (for compatibility)
// let uuidCounter = 0;
// Reset counter before each test
beforeEach(() => {
  uuidCounter = 0;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require('crypto');
  (crypto.randomUUID as jest.Mock).mockClear();
});

import { IPCHandlers } from '../handlers';
import type { CRDTManager } from '../../crdt';
import type { Database } from '@notecove/shared';
import type { FolderData } from '@notecove/shared';
import type { ConfigManager } from '../../config/manager';
import type { NoteMoveManager } from '../../note-move-manager';

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
  upsertNote: jest.Mock;
  getNote: jest.Mock;
  getNotesBySd: jest.Mock;
  getStorageDir: jest.Mock;
  getState: jest.Mock;
  setState: jest.Mock;
  createStorageDir: jest.Mock;
  getAllStorageDirs: jest.Mock;
  getActiveStorageDir: jest.Mock;
  setActiveStorageDir: jest.Mock;
  searchNotes: jest.Mock;
  deleteNote: jest.Mock;
  adapter: {
    exec: jest.Mock;
  };
}

interface MockConfigManager {
  getDatabasePath: jest.Mock;
  setDatabasePath: jest.Mock;
}

interface MockUpdateManager {
  buildVectorClock: jest.Mock;
  writeSnapshot: jest.Mock;
}

interface MockNoteMoveManager {
  initiateMove: jest.Mock;
  executeMove: jest.Mock;
  recoverIncompleteMoves: jest.Mock;
  cleanupOldMoves: jest.Mock;
}

describe('IPCHandlers - Folder CRUD', () => {
  let handlers: IPCHandlers;
  let mockCRDTManager: MockCRDTManager;
  let mockDatabase: MockDatabase;
  let mockConfigManager: MockConfigManager;
  let mockUpdateManager: MockUpdateManager;
  let mockNoteMoveManager: MockNoteMoveManager;
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
      upsertNote: jest.fn().mockResolvedValue(undefined),
      getNote: jest.fn(),
      getNotesBySd: jest.fn(),
      getStorageDir: jest.fn(),
      getState: jest.fn(),
      setState: jest.fn().mockResolvedValue(undefined),
      createStorageDir: jest.fn(),
      getAllStorageDirs: jest.fn(),
      getActiveStorageDir: jest.fn(),
      setActiveStorageDir: jest.fn(),
      searchNotes: jest.fn().mockResolvedValue([]),
      deleteNote: jest.fn().mockResolvedValue(undefined),
      adapter: {
        exec: jest.fn().mockResolvedValue(undefined),
      },
    };

    // Create mock config manager
    mockConfigManager = {
      getDatabasePath: jest.fn().mockResolvedValue('/test/path/notecove.db'),
      setDatabasePath: jest.fn().mockResolvedValue(undefined),
    };

    // Create mock update manager
    mockUpdateManager = {
      buildVectorClock: jest.fn(),
      writeSnapshot: jest.fn(),
    };

    // Create mock note move manager
    mockNoteMoveManager = {
      initiateMove: jest.fn(),
      executeMove: jest.fn(),
      recoverIncompleteMoves: jest.fn(),
      cleanupOldMoves: jest.fn(),
    };

    // Create handlers
    handlers = new IPCHandlers(
      mockCRDTManager as unknown as CRDTManager,
      mockDatabase as unknown as Database,
      mockConfigManager as unknown as ConfigManager,
      mockUpdateManager as unknown as import('@notecove/shared').UpdateManager,
      mockNoteMoveManager as unknown as NoteMoveManager
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

describe('IPCHandlers - SD Management', () => {
  let handlers: IPCHandlers;
  let mockCRDTManager: MockCRDTManager;
  let mockDatabase: MockDatabase;
  let mockConfigManager: MockConfigManager;
  let mockUpdateManager: MockUpdateManager;
  let mockNoteMoveManager: MockNoteMoveManager;
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
      upsertFolder: jest.fn(),
      upsertNote: jest.fn().mockResolvedValue(undefined),
      getNote: jest.fn(),
      getNotesBySd: jest.fn(),
      getStorageDir: jest.fn(),
      getState: jest.fn(),
      setState: jest.fn(),
      createStorageDir: jest.fn(),
      getAllStorageDirs: jest.fn(),
      getActiveStorageDir: jest.fn(),
      setActiveStorageDir: jest.fn(),
      searchNotes: jest.fn().mockResolvedValue([]),
      deleteNote: jest.fn().mockResolvedValue(undefined),
      adapter: {
        exec: jest.fn().mockResolvedValue(undefined),
      },
    };

    // Create mock config manager
    mockConfigManager = {
      getDatabasePath: jest.fn().mockResolvedValue('/test/path/notecove.db'),
      setDatabasePath: jest.fn().mockResolvedValue(undefined),
    };

    // Create mock update manager
    mockUpdateManager = {
      buildVectorClock: jest.fn(),
      writeSnapshot: jest.fn(),
    };

    // Create mock note move manager
    mockNoteMoveManager = {
      initiateMove: jest.fn(),
      executeMove: jest.fn(),
      recoverIncompleteMoves: jest.fn(),
      cleanupOldMoves: jest.fn(),
    };

    // Create handlers
    handlers = new IPCHandlers(
      mockCRDTManager as unknown as CRDTManager,
      mockDatabase as unknown as Database,
      mockConfigManager as unknown as ConfigManager,
      mockUpdateManager as unknown as import('@notecove/shared').UpdateManager,
      mockNoteMoveManager as unknown as NoteMoveManager
    );
  });

  describe('sd:list', () => {
    it('should return all storage directories', async () => {
      const mockEvent = {} as any;
      const sds = [
        { id: 'sd1', name: 'Work', path: '/path/work', created: 1000, isActive: true },
        { id: 'sd2', name: 'Personal', path: '/path/personal', created: 2000, isActive: false },
      ];

      mockDatabase.getAllStorageDirs.mockResolvedValue(sds);

      const result = await (handlers as any).handleListStorageDirs(mockEvent);

      expect(mockDatabase.getAllStorageDirs).toHaveBeenCalled();
      expect(result).toEqual(sds);
    });

    it('should return empty array when no SDs exist', async () => {
      const mockEvent = {} as any;
      mockDatabase.getAllStorageDirs.mockResolvedValue([]);

      const result = await (handlers as any).handleListStorageDirs(mockEvent);

      expect(result).toEqual([]);
    });
  });

  describe('sd:create', () => {
    it('should create a new storage directory', async () => {
      const mockEvent = {} as any;
      const name = 'Work';
      const path = '/path/to/work';
      const createdSD = {
        id: 'test-uuid-00000001-0000-0000-0000-000000000000',
        name,
        path,
        created: Date.now(),
        isActive: false,
        uuid: 'target-uuid-5678',
      };

      mockDatabase.createStorageDir.mockResolvedValue(createdSD);

      const result = await (handlers as any).handleCreateStorageDir(mockEvent, name, path);

      expect(mockDatabase.createStorageDir).toHaveBeenCalledWith(
        'test-uuid-00000001-0000-0000-0000-000000000000',
        name,
        path
      );
      expect(result).toEqual('test-uuid-00000001-0000-0000-0000-000000000000');
    });

    it('should create first SD as active', async () => {
      const mockEvent = {} as any;
      const name = 'Work';
      const path = '/path/to/work';
      const createdSD = {
        id: 'test-uuid-00000001-0000-0000-0000-000000000000',
        name,
        path,
        created: Date.now(),
        isActive: true,
        uuid: 'source-uuid-1234',
      };

      mockDatabase.createStorageDir.mockResolvedValue(createdSD);

      await (handlers as any).handleCreateStorageDir(mockEvent, name, path);

      expect(mockDatabase.createStorageDir).toHaveBeenCalled();
      // Database layer handles setting isActive for first SD
    });
  });

  describe('sd:setActive', () => {
    it('should set the active storage directory', async () => {
      const mockEvent = {} as any;
      const sdId = 'sd2';

      await (handlers as any).handleSetActiveStorageDir(mockEvent, sdId);

      expect(mockDatabase.setActiveStorageDir).toHaveBeenCalledWith(sdId);
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

      mockDatabase.getActiveStorageDir.mockResolvedValue(activeSd);

      const result = await (handlers as any).handleGetActiveStorageDir(mockEvent);

      expect(mockDatabase.getActiveStorageDir).toHaveBeenCalled();
      expect(result).toEqual('sd1');
    });

    it('should return null when no active SD exists', async () => {
      const mockEvent = {} as any;
      mockDatabase.getActiveStorageDir.mockResolvedValue(null);

      const result = await (handlers as any).handleGetActiveStorageDir(mockEvent);

      expect(result).toBeNull();
    });
  });

  describe('note:search', () => {
    it('should search notes and return results', async () => {
      const mockEvent = {} as any;
      const query = 'test query';
      const searchResults = [
        {
          noteId: 'note-1',
          title: 'Test Note',
          snippet: 'This is a test query result',
          rank: 0.5,
        },
        {
          noteId: 'note-2',
          title: 'Another Test',
          snippet: 'Another test query match',
          rank: 0.3,
        },
      ];

      mockDatabase.searchNotes.mockResolvedValue(searchResults);

      const result = await (handlers as any).handleSearchNotes(mockEvent, query);

      expect(mockDatabase.searchNotes).toHaveBeenCalledWith(query, undefined);
      expect(result).toEqual(searchResults);
    });

    it('should support limiting search results', async () => {
      const mockEvent = {} as any;
      const query = 'test';
      const limit = 10;
      const searchResults = [
        {
          noteId: 'note-1',
          title: 'Test Note',
          snippet: 'Test content',
          rank: 0.5,
        },
      ];

      mockDatabase.searchNotes.mockResolvedValue(searchResults);

      const result = await (handlers as any).handleSearchNotes(mockEvent, query, limit);

      expect(mockDatabase.searchNotes).toHaveBeenCalledWith(query, limit);
      expect(result).toEqual(searchResults);
    });

    it('should return empty array when no results found', async () => {
      const mockEvent = {} as any;
      const query = 'nonexistent';

      mockDatabase.searchNotes.mockResolvedValue([]);

      const result = await (handlers as any).handleSearchNotes(mockEvent, query);

      expect(result).toEqual([]);
    });
  });

  describe('note:moveToSD', () => {
    it('should move note to different SD without conflict', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-1';
      const sourceSdId = 'sd-source';
      const targetSdId = 'sd-target';
      const targetFolderId = null;
      const conflictResolution = null;

      const sourceNote = {
        id: noteId,
        title: 'Test Note',
        sdId: sourceSdId,
        folderId: null,
        created: 1000,
        modified: 2000,
        deleted: false,
        pinned: true,
        contentPreview: 'Preview',
        contentText: 'Content',
      };

      // Mock source note retrieval
      mockDatabase.getNote.mockResolvedValue(sourceNote);
      // No conflict - note doesn't exist in target SD
      mockDatabase.getNotesBySd.mockResolvedValue([]); // No notes in target SD
      // Mock storage directories
      mockDatabase.getStorageDir.mockImplementation((sdId: string) => {
        if (sdId === sourceSdId) {
          return Promise.resolve({
            id: sourceSdId,
            name: 'Source SD',
            path: '/tmp/source',
            created: 1000,
            isActive: true,
            uuid: 'source-uuid-1234',
          });
        }
        if (sdId === targetSdId) {
          return Promise.resolve({
            id: targetSdId,
            name: 'Target SD',
            path: '/tmp/target',
            created: 2000,
            isActive: false,
            uuid: 'target-uuid-5678',
          });
        }
        return Promise.resolve(null);
      });

      // Mock NoteMoveManager to perform the actual database operations
      mockNoteMoveManager.initiateMove.mockResolvedValue('move-id-1');
      mockNoteMoveManager.executeMove.mockImplementation(async () => {
        // Simulate the move by calling database operations
        await mockDatabase.upsertNote({
          ...sourceNote,
          sdId: targetSdId,
          folderId: targetFolderId,
        });
        await mockDatabase.adapter.exec('DELETE FROM notes WHERE id = ? AND sd_id = ?', [
          noteId,
          sourceSdId,
        ]);
        return { success: true };
      });

      await (handlers as any).handleMoveNoteToSD(
        mockEvent,
        noteId,
        sourceSdId,
        targetSdId,
        targetFolderId,
        conflictResolution
      );

      // Should be called once to create in target (no conflict, so UUID is preserved)
      expect(mockDatabase.upsertNote).toHaveBeenCalledTimes(1);

      // Should create note in target SD with SAME UUID (no conflict)
      expect(mockDatabase.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          id: noteId, // UUID preserved when no conflict
          sdId: targetSdId,
          folderId: targetFolderId,
          pinned: true, // Metadata preserved
          deleted: false,
        })
      );

      // Should permanently delete from source SD using adapter.exec (same UUID)
      expect(mockDatabase.adapter.exec).toHaveBeenCalledWith(
        'DELETE FROM notes WHERE id = ? AND sd_id = ?',
        [noteId, sourceSdId]
      );
    });

    it('should throw error when note has conflict and no resolution provided', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-1';
      const sourceSdId = 'sd-source';
      const targetSdId = 'sd-target';
      const targetFolderId = null;
      const conflictResolution = null;

      const sourceNote = {
        id: noteId,
        title: 'Test Note',
        sdId: sourceSdId,
        folderId: null,
        created: 1000,
        modified: 2000,
        deleted: false,
        pinned: false,
        contentPreview: 'Preview',
        contentText: 'Content',
      };

      const conflictingNote = {
        id: noteId,
        title: 'Existing Note',
        sdId: targetSdId,
        folderId: null,
        created: 900,
        modified: 1800,
        deleted: false,
        pinned: false,
        contentPreview: 'Old Preview',
        contentText: 'Old Content',
      };

      mockDatabase.getNote.mockResolvedValue(sourceNote);
      // Conflict - note exists in target SD
      mockDatabase.getNotesBySd.mockResolvedValue([conflictingNote]);

      mockDatabase.getStorageDir.mockImplementation((sdId: string) => {
        if (sdId === sourceSdId) {
          return Promise.resolve({
            id: sourceSdId,
            name: 'Source SD',
            path: '/tmp/source',
            created: 1000,
            isActive: true,
            uuid: 'source-uuid-1234',
          });
        }
        if (sdId === targetSdId) {
          return Promise.resolve({
            id: targetSdId,
            name: 'Target SD',
            path: '/tmp/target',
            created: 2000,
            isActive: false,
            uuid: 'target-uuid-5678',
          });
        }
        return Promise.resolve(null);
      });

      await expect(
        (handlers as any).handleMoveNoteToSD(
          mockEvent,
          noteId,
          sourceSdId,
          targetSdId,
          targetFolderId,
          conflictResolution
        )
      ).rejects.toThrow('Note already exists in target SD');
    });

    it('should replace existing note when conflict resolution is "replace"', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-1';
      const sourceSdId = 'sd-source';
      const targetSdId = 'sd-target';
      const targetFolderId = null;
      const conflictResolution = 'replace';

      const sourceNote = {
        id: noteId,
        title: 'Test Note',
        sdId: sourceSdId,
        folderId: null,
        created: 1000,
        modified: 2000,
        deleted: false,
        pinned: false,
        contentPreview: 'Preview',
        contentText: 'Content',
      };

      const conflictingNote = {
        id: noteId,
        title: 'Old Note',
        sdId: targetSdId,
        folderId: null,
        created: 900,
        modified: 1800,
        deleted: false,
        pinned: false,
        contentPreview: 'Old Preview',
        contentText: 'Old Content',
      };

      mockDatabase.getNote.mockResolvedValue(sourceNote);
      mockDatabase.getNotesBySd.mockResolvedValue([conflictingNote]);

      mockDatabase.getStorageDir.mockImplementation((sdId: string) => {
        if (sdId === sourceSdId) {
          return Promise.resolve({
            id: sourceSdId,
            name: 'Source SD',
            path: '/tmp/source',
            created: 1000,
            isActive: true,
            uuid: 'source-uuid-1234',
          });
        }
        if (sdId === targetSdId) {
          return Promise.resolve({
            id: targetSdId,
            name: 'Target SD',
            path: '/tmp/target',
            created: 2000,
            isActive: false,
            uuid: 'target-uuid-5678',
          });
        }
        return Promise.resolve(null);
      });

      // Mock NoteMoveManager to perform the actual database operations
      mockNoteMoveManager.initiateMove.mockResolvedValue('move-id-1');
      mockNoteMoveManager.executeMove.mockImplementation(async () => {
        // Simulate the move by calling database operations
        await mockDatabase.upsertNote({
          ...sourceNote,
          sdId: targetSdId,
          folderId: targetFolderId,
        });
        await mockDatabase.adapter.exec('DELETE FROM notes WHERE id = ? AND sd_id = ?', [
          noteId,
          sourceSdId,
        ]);
        return { success: true };
      });

      await (handlers as any).handleMoveNoteToSD(
        mockEvent,
        noteId,
        sourceSdId,
        targetSdId,
        targetFolderId,
        conflictResolution
      );

      // Should be called twice: once for replace delete, once for upsert
      expect(mockDatabase.upsertNote).toHaveBeenCalledTimes(1);

      // Should create note in target SD (replacing existing)
      expect(mockDatabase.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          id: noteId,
          sdId: targetSdId,
        })
      );

      // Should permanently delete from source SD using adapter.exec (same UUID)
      expect(mockDatabase.adapter.exec).toHaveBeenCalledWith(
        'DELETE FROM notes WHERE id = ? AND sd_id = ?',
        [noteId, sourceSdId]
      );
    });

    it('should generate new ID when conflict resolution is "keepBoth"', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-1';
      const sourceSdId = 'sd-source';
      const targetSdId = 'sd-target';
      const targetFolderId = null;
      const conflictResolution = 'keepBoth';

      const sourceNote = {
        id: noteId,
        title: 'Test Note',
        sdId: sourceSdId,
        folderId: null,
        created: 1000,
        modified: 2000,
        deleted: false,
        pinned: false,
        contentPreview: 'Preview',
        contentText: 'Content',
      };

      const conflictingNote = {
        id: noteId,
        title: 'Old Note',
        sdId: targetSdId,
        folderId: null,
        created: 900,
        modified: 1800,
        deleted: false,
        pinned: false,
        contentPreview: 'Old Preview',
        contentText: 'Old Content',
      };

      mockDatabase.getNote.mockResolvedValue(sourceNote);
      mockDatabase.getNotesBySd.mockResolvedValue([conflictingNote]);

      mockDatabase.getStorageDir.mockImplementation((sdId: string) => {
        if (sdId === sourceSdId) {
          return Promise.resolve({
            id: sourceSdId,
            name: 'Source SD',
            path: '/tmp/source',
            created: 1000,
            isActive: true,
            uuid: 'source-uuid-1234',
          });
        }
        if (sdId === targetSdId) {
          return Promise.resolve({
            id: targetSdId,
            name: 'Target SD',
            path: '/tmp/target',
            created: 2000,
            isActive: false,
            uuid: 'target-uuid-5678',
          });
        }
        return Promise.resolve(null);
      });

      await (handlers as any).handleMoveNoteToSD(
        mockEvent,
        noteId,
        sourceSdId,
        targetSdId,
        targetFolderId,
        conflictResolution
      );

      // Should be called once to create in target with new UUID
      expect(mockDatabase.upsertNote).toHaveBeenCalledTimes(1);

      // Should create note in target SD with NEW ID
      expect(mockDatabase.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^test-uuid-/), // New UUID generated
          sdId: targetSdId,
          title: 'Test Note',
        })
      );

      // Should permanently delete original from source SD using deleteNote (different UUIDs)
      expect(mockDatabase.deleteNote).toHaveBeenCalledWith(noteId);
    });

    it('should silently replace note if existing note is in Recently Deleted', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-1';
      const sourceSdId = 'sd-source';
      const targetSdId = 'sd-target';
      const targetFolderId = null;
      const conflictResolution = null;

      const sourceNote = {
        id: noteId,
        title: 'Test Note',
        sdId: sourceSdId,
        folderId: null,
        created: 1000,
        modified: 2000,
        deleted: false,
        pinned: false,
        contentPreview: 'Preview',
        contentText: 'Content',
      };

      const deletedNote = {
        id: noteId,
        title: 'Deleted Note',
        sdId: targetSdId,
        folderId: null,
        created: 900,
        modified: 1800,
        deleted: true, // Already deleted
        pinned: false,
        contentPreview: 'Old Preview',
        contentText: 'Old Content',
      };

      mockDatabase.getNote.mockResolvedValue(sourceNote);
      mockDatabase.getNotesBySd.mockResolvedValue([deletedNote]);

      mockDatabase.getStorageDir.mockImplementation((sdId: string) => {
        if (sdId === sourceSdId) {
          return Promise.resolve({
            id: sourceSdId,
            name: 'Source SD',
            path: '/tmp/source',
            created: 1000,
            isActive: true,
            uuid: 'source-uuid-1234',
          });
        }
        if (sdId === targetSdId) {
          return Promise.resolve({
            id: targetSdId,
            name: 'Target SD',
            path: '/tmp/target',
            created: 2000,
            isActive: false,
            uuid: 'target-uuid-5678',
          });
        }
        return Promise.resolve(null);
      });

      // Mock NoteMoveManager to perform the actual database operations
      mockNoteMoveManager.initiateMove.mockResolvedValue('move-id-1');
      mockNoteMoveManager.executeMove.mockImplementation(async () => {
        // Simulate the move by calling database operations
        await mockDatabase.upsertNote({
          ...sourceNote,
          sdId: targetSdId,
          folderId: targetFolderId,
        });
        await mockDatabase.adapter.exec('DELETE FROM notes WHERE id = ? AND sd_id = ?', [
          noteId,
          sourceSdId,
        ]);
        return { success: true };
      });

      // Should NOT throw error even though note exists (it's deleted)
      await (handlers as any).handleMoveNoteToSD(
        mockEvent,
        noteId,
        sourceSdId,
        targetSdId,
        targetFolderId,
        conflictResolution
      );

      // Should be called once to create in target (deleted note doesn't count as conflict)
      expect(mockDatabase.upsertNote).toHaveBeenCalledTimes(1);

      // Should create note in target SD with SAME UUID (deleted note doesn't count as conflict)
      expect(mockDatabase.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          id: noteId, // UUID preserved since deleted note doesn't count as conflict
          sdId: targetSdId,
          deleted: false,
        })
      );

      // Should permanently delete from source SD using adapter.exec (same UUID)
      expect(mockDatabase.adapter.exec).toHaveBeenCalledWith(
        'DELETE FROM notes WHERE id = ? AND sd_id = ?',
        [noteId, sourceSdId]
      );
    });

    it('should throw error when source note not found', async () => {
      const mockEvent = {} as any;
      const noteId = 'nonexistent';
      const sourceSdId = 'sd-source';
      const targetSdId = 'sd-target';
      const targetFolderId = null;
      const conflictResolution = null;

      mockDatabase.getNote.mockResolvedValue(null);

      mockDatabase.getStorageDir.mockImplementation((sdId: string) => {
        if (sdId === sourceSdId) {
          return Promise.resolve({
            id: sourceSdId,
            name: 'Source SD',
            path: '/tmp/source',
            created: 1000,
            isActive: true,
            uuid: 'source-uuid-1234',
          });
        }
        if (sdId === targetSdId) {
          return Promise.resolve({
            id: targetSdId,
            name: 'Target SD',
            path: '/tmp/target',
            created: 2000,
            isActive: false,
            uuid: 'target-uuid-5678',
          });
        }
        return Promise.resolve(null);
      });

      await expect(
        (handlers as any).handleMoveNoteToSD(
          mockEvent,
          noteId,
          sourceSdId,
          targetSdId,
          targetFolderId,
          conflictResolution
        )
      ).rejects.toThrow('Note nonexistent not found in source SD');
    });
  });
});
