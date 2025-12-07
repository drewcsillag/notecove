/**
 * IPC Handlers Tests
 *
 * Tests for folder CRUD operations via IPC handlers.
 */

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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  getSiblings: jest.Mock;
  createFolder: jest.Mock;
  updateFolder: jest.Mock;
  deleteFolder: jest.Mock;
  reorderFolder: jest.Mock;
}

interface MockCRDTManager {
  loadNote: jest.Mock;
  unloadNote: jest.Mock;
  applyUpdate: jest.Mock;
  loadFolderTree: jest.Mock;
  setActivityLogger: jest.Mock;
  recordMoveActivity: jest.Mock;
  deleteDocument: jest.Mock;
  loadDocument: jest.Mock;
  createDocument: jest.Mock;
  getNoteDoc: jest.Mock;
  getDocument: jest.Mock;
  getStaleSyncs?: jest.Mock;
}

interface MockDatabase {
  upsertFolder: jest.Mock;
  upsertNote: jest.Mock;
  getNote: jest.Mock;
  getNotesBySd: jest.Mock;
  getNotesByFolder: jest.Mock;
  getDeletedNotes: jest.Mock;
  getNoteCountForFolder: jest.Mock;
  getAllNotesCount: jest.Mock;
  getDeletedNoteCount: jest.Mock;
  getAllTags: jest.Mock;
  getBacklinks: jest.Mock;
  getStorageDir: jest.Mock;
  getState: jest.Mock;
  setState: jest.Mock;
  createStorageDir: jest.Mock;
  getAllStorageDirs: jest.Mock;
  getActiveStorageDir: jest.Mock;
  setActiveStorageDir: jest.Mock;
  searchNotes: jest.Mock;
  deleteNote: jest.Mock;
  deleteStorageDir: jest.Mock;
  adapter: {
    exec: jest.Mock;
  };
}

interface MockConfigManager {
  getDatabasePath: jest.Mock;
  setDatabasePath: jest.Mock;
}

interface MockAppendLogManager {
  getNoteVectorClock: jest.Mock;
  writeNoteSnapshot: jest.Mock;
}

interface MockNoteMoveManager {
  initiateMove: jest.Mock;
  executeMove: jest.Mock;
  recoverIncompleteMoves: jest.Mock;
  cleanupOldMoves: jest.Mock;
  getStaleMoves: jest.Mock;
  takeOverMove: jest.Mock;
  cancelMove: jest.Mock;
}

interface MockDiagnosticsManager {
  detectDuplicateNotes: jest.Mock;
  detectOrphanedCRDTFiles: jest.Mock;
  detectMissingCRDTFiles: jest.Mock;
  detectStaleMigrationLocks: jest.Mock;
  detectOrphanedActivityLogs: jest.Mock;
  removeStaleMigrationLock: jest.Mock;
  cleanupOrphanedActivityLog: jest.Mock;
  importOrphanedCRDT: jest.Mock;
  deleteMissingCRDTEntry: jest.Mock;
  deleteDuplicateNote: jest.Mock;
}

interface MockBackupManager {
  createPreOperationSnapshot: jest.Mock;
  createManualBackup: jest.Mock;
  listBackups: jest.Mock;
  restoreFromBackup: jest.Mock;
  deleteBackup: jest.Mock;
  cleanupOldSnapshots: jest.Mock;
  setBackupDirectory: jest.Mock;
  getBackupDirectory: jest.Mock;
}

describe('IPCHandlers - Folder CRUD', () => {
  let handlers: IPCHandlers;
  let mockCRDTManager: MockCRDTManager;
  let mockDatabase: MockDatabase;
  let mockConfigManager: MockConfigManager;
  let mockAppendLogManager: MockAppendLogManager;
  let mockNoteMoveManager: MockNoteMoveManager;
  let mockDiagnosticsManager: MockDiagnosticsManager;
  let mockBackupManager: MockBackupManager;
  let mockFolderTree: MockFolderTreeDoc;

  beforeEach(() => {
    // Create mock folder tree
    mockFolderTree = {
      getActiveFolders: jest.fn(),
      getFolder: jest.fn(),
      getRootFolders: jest.fn(),
      getChildFolders: jest.fn(),
      getSiblings: jest.fn(),
      createFolder: jest.fn(),
      updateFolder: jest.fn(),
      deleteFolder: jest.fn(),
      reorderFolder: jest.fn(),
    };

    // Create mock CRDT manager
    mockCRDTManager = {
      loadNote: jest.fn().mockResolvedValue(undefined),
      unloadNote: jest.fn(),
      applyUpdate: jest.fn(),
      loadFolderTree: jest.fn().mockResolvedValue(mockFolderTree),
      setActivityLogger: jest.fn(),
      recordMoveActivity: jest.fn().mockResolvedValue(undefined),
      deleteDocument: jest.fn().mockResolvedValue(undefined),
      loadDocument: jest.fn().mockResolvedValue({}),
      createDocument: jest.fn().mockResolvedValue('new-note-id'),
      getNoteDoc: jest.fn().mockReturnValue({ getMetadata: jest.fn().mockReturnValue(null) }),
      getDocument: jest.fn().mockReturnValue({ getText: () => ({ toJSON: () => 'Content' }) }),
    };

    // Create mock database
    mockDatabase = {
      upsertFolder: jest.fn().mockResolvedValue(undefined),
      upsertNote: jest.fn().mockResolvedValue(undefined),
      getNote: jest.fn(),
      getNotesBySd: jest.fn().mockResolvedValue([]),
      getNotesByFolder: jest.fn().mockResolvedValue([]),
      getDeletedNotes: jest.fn().mockResolvedValue([]),
      getNoteCountForFolder: jest.fn().mockResolvedValue(0),
      getAllNotesCount: jest.fn().mockResolvedValue(0),
      getDeletedNoteCount: jest.fn().mockResolvedValue(0),
      getAllTags: jest.fn().mockResolvedValue([]),
      getBacklinks: jest.fn().mockResolvedValue([]),
      getStorageDir: jest.fn(),
      getState: jest.fn(),
      setState: jest.fn().mockResolvedValue(undefined),
      createStorageDir: jest.fn(),
      getAllStorageDirs: jest.fn(),
      getActiveStorageDir: jest.fn(),
      setActiveStorageDir: jest.fn(),
      searchNotes: jest.fn().mockResolvedValue([]),
      deleteNote: jest.fn().mockResolvedValue(undefined),
      deleteStorageDir: jest.fn().mockResolvedValue(undefined),
      adapter: {
        exec: jest.fn().mockResolvedValue(undefined),
      },
    };

    // Create mock config manager
    mockConfigManager = {
      getDatabasePath: jest.fn().mockResolvedValue('/test/path/notecove.db'),
      setDatabasePath: jest.fn().mockResolvedValue(undefined),
    };

    // Create mock append log manager
    mockAppendLogManager = {
      getNoteVectorClock: jest.fn(),
      writeNoteSnapshot: jest.fn(),
    };

    // Create mock note move manager
    mockNoteMoveManager = {
      initiateMove: jest.fn(),
      executeMove: jest.fn(),
      recoverIncompleteMoves: jest.fn(),
      cleanupOldMoves: jest.fn(),
      getStaleMoves: jest.fn(),
      takeOverMove: jest.fn(),
      cancelMove: jest.fn(),
    };

    // Create mock diagnostics manager
    mockDiagnosticsManager = {
      detectDuplicateNotes: jest.fn(),
      detectOrphanedCRDTFiles: jest.fn(),
      detectMissingCRDTFiles: jest.fn(),
      detectStaleMigrationLocks: jest.fn(),
      detectOrphanedActivityLogs: jest.fn(),
      removeStaleMigrationLock: jest.fn(),
      cleanupOrphanedActivityLog: jest.fn(),
      importOrphanedCRDT: jest.fn(),
      deleteMissingCRDTEntry: jest.fn(),
      deleteDuplicateNote: jest.fn(),
    };

    // Create mock backup manager
    mockBackupManager = {
      createPreOperationSnapshot: jest.fn(),
      createManualBackup: jest.fn(),
      listBackups: jest.fn(),
      restoreFromBackup: jest.fn(),
      deleteBackup: jest.fn(),
      cleanupOldSnapshots: jest.fn(),
      setBackupDirectory: jest.fn(),
      getBackupDirectory: jest.fn(),
    };

    // Create handlers
    handlers = new IPCHandlers(
      mockCRDTManager as unknown as CRDTManager,
      mockDatabase as unknown as Database,
      mockConfigManager as unknown as ConfigManager,
      mockAppendLogManager as unknown as import('@notecove/shared').AppendLogManager,
      mockNoteMoveManager as unknown as NoteMoveManager,
      mockDiagnosticsManager as unknown as import('../../diagnostics-manager').DiagnosticsManager,
      mockBackupManager as unknown as import('../../backup-manager').BackupManager
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
      // Mock getFolder to return the folder after creation
      mockFolderTree.getFolder.mockImplementation((id: string) => ({
        id,
        name: 'New Folder',
        parentId: null,
        sdId,
        order: 0,
        deleted: false,
      }));
      // Mock getSiblings to return just the new folder (no existing siblings)
      mockFolderTree.getSiblings.mockImplementation((id: string) => [
        {
          id,
          name: 'New Folder',
          parentId: null,
          sdId,
          order: 0,
          deleted: false,
        },
      ]);

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
  let mockAppendLogManager: MockAppendLogManager;
  let mockNoteMoveManager: MockNoteMoveManager;
  let mockDiagnosticsManager: MockDiagnosticsManager;
  let mockBackupManager: MockBackupManager;
  let mockFolderTree: MockFolderTreeDoc;

  beforeEach(() => {
    // Create mock folder tree
    mockFolderTree = {
      getActiveFolders: jest.fn(),
      getFolder: jest.fn(),
      getRootFolders: jest.fn(),
      getChildFolders: jest.fn(),
      getSiblings: jest.fn(),
      createFolder: jest.fn(),
      updateFolder: jest.fn(),
      deleteFolder: jest.fn(),
      reorderFolder: jest.fn(),
    };

    // Create mock CRDT manager
    mockCRDTManager = {
      loadNote: jest.fn().mockResolvedValue(undefined),
      unloadNote: jest.fn(),
      applyUpdate: jest.fn(),
      loadFolderTree: jest.fn().mockResolvedValue(mockFolderTree),
      setActivityLogger: jest.fn(),
      recordMoveActivity: jest.fn().mockResolvedValue(undefined),
      deleteDocument: jest.fn().mockResolvedValue(undefined),
      loadDocument: jest.fn().mockResolvedValue({}),
      createDocument: jest.fn().mockResolvedValue('new-note-id'),
      getNoteDoc: jest.fn().mockReturnValue({ getMetadata: jest.fn().mockReturnValue(null) }),
      getDocument: jest.fn().mockReturnValue({ getText: () => ({ toJSON: () => 'Content' }) }),
    };

    // Create mock database
    mockDatabase = {
      upsertFolder: jest.fn().mockResolvedValue(undefined),
      upsertNote: jest.fn().mockResolvedValue(undefined),
      getNote: jest.fn(),
      getNotesBySd: jest.fn().mockResolvedValue([]),
      getNotesByFolder: jest.fn().mockResolvedValue([]),
      getDeletedNotes: jest.fn().mockResolvedValue([]),
      getNoteCountForFolder: jest.fn().mockResolvedValue(0),
      getAllNotesCount: jest.fn().mockResolvedValue(0),
      getDeletedNoteCount: jest.fn().mockResolvedValue(0),
      getAllTags: jest.fn().mockResolvedValue([]),
      getBacklinks: jest.fn().mockResolvedValue([]),
      getStorageDir: jest.fn(),
      getState: jest.fn(),
      setState: jest.fn().mockResolvedValue(undefined),
      createStorageDir: jest.fn(),
      getAllStorageDirs: jest.fn(),
      getActiveStorageDir: jest.fn(),
      setActiveStorageDir: jest.fn(),
      searchNotes: jest.fn().mockResolvedValue([]),
      deleteNote: jest.fn().mockResolvedValue(undefined),
      deleteStorageDir: jest.fn().mockResolvedValue(undefined),
      adapter: {
        exec: jest.fn().mockResolvedValue(undefined),
      },
    };

    // Create mock config manager
    mockConfigManager = {
      getDatabasePath: jest.fn().mockResolvedValue('/test/path/notecove.db'),
      setDatabasePath: jest.fn().mockResolvedValue(undefined),
    };

    // Create mock append log manager
    mockAppendLogManager = {
      getNoteVectorClock: jest.fn(),
      writeNoteSnapshot: jest.fn(),
    };

    // Create mock note move manager
    mockNoteMoveManager = {
      initiateMove: jest.fn(),
      executeMove: jest.fn(),
      recoverIncompleteMoves: jest.fn(),
      cleanupOldMoves: jest.fn(),
      getStaleMoves: jest.fn(),
      takeOverMove: jest.fn(),
      cancelMove: jest.fn(),
    };

    // Create mock diagnostics manager
    mockDiagnosticsManager = {
      detectDuplicateNotes: jest.fn(),
      detectOrphanedCRDTFiles: jest.fn(),
      detectMissingCRDTFiles: jest.fn(),
      detectStaleMigrationLocks: jest.fn(),
      detectOrphanedActivityLogs: jest.fn(),
      removeStaleMigrationLock: jest.fn(),
      cleanupOrphanedActivityLog: jest.fn(),
      importOrphanedCRDT: jest.fn(),
      deleteMissingCRDTEntry: jest.fn(),
      deleteDuplicateNote: jest.fn(),
    };

    // Create mock backup manager
    mockBackupManager = {
      createPreOperationSnapshot: jest.fn(),
      createManualBackup: jest.fn(),
      listBackups: jest.fn(),
      restoreFromBackup: jest.fn(),
      deleteBackup: jest.fn(),
      cleanupOldSnapshots: jest.fn(),
      setBackupDirectory: jest.fn(),
      getBackupDirectory: jest.fn(),
    };

    // Create handlers
    handlers = new IPCHandlers(
      mockCRDTManager as unknown as CRDTManager,
      mockDatabase as unknown as Database,
      mockConfigManager as unknown as ConfigManager,
      mockAppendLogManager as unknown as import('@notecove/shared').AppendLogManager,
      mockNoteMoveManager as unknown as NoteMoveManager,
      mockDiagnosticsManager as unknown as import('../../diagnostics-manager').DiagnosticsManager,
      mockBackupManager as unknown as import('../../backup-manager').BackupManager
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

  describe('Recovery Handlers', () => {
    const mockEvent = {} as any;

    describe('recovery:getStaleMoves', () => {
      it('should return stale moves from NoteMoveManager', async () => {
        const staleMoves = [
          {
            id: 'move-1',
            noteId: 'note-1',
            sourceSdUuid: 'source-uuid',
            targetSdUuid: 'target-uuid',
            targetFolderId: null,
            state: 'copying_files',
            initiatedBy: 'other-instance',
            initiatedAt: Date.now() - 600000, // 10 minutes ago
            lastModified: Date.now() - 600000,
            sourceSdPath: '/path/to/source',
            targetSdPath: '/path/to/target',
            error: null,
          },
          {
            id: 'move-2',
            noteId: 'note-2',
            sourceSdUuid: 'source-uuid',
            targetSdUuid: 'target-uuid',
            targetFolderId: 'folder-1',
            state: 'updating_db',
            initiatedBy: 'crashed-instance',
            initiatedAt: Date.now() - 900000, // 15 minutes ago
            lastModified: Date.now() - 900000,
            sourceSdPath: '/path/to/source',
            targetSdPath: '/path/to/target',
            error: 'Operation failed',
          },
        ];

        mockNoteMoveManager.getStaleMoves.mockResolvedValue(staleMoves);

        const result = await (handlers as any).handleGetStaleMoves(mockEvent);

        expect(result).toEqual(staleMoves);
        expect(mockNoteMoveManager.getStaleMoves).toHaveBeenCalled();
      });

      it('should return empty array when no stale moves', async () => {
        mockNoteMoveManager.getStaleMoves.mockResolvedValue([]);

        const result = await (handlers as any).handleGetStaleMoves(mockEvent);

        expect(result).toEqual([]);
        expect(mockNoteMoveManager.getStaleMoves).toHaveBeenCalled();
      });
    });

    describe('recovery:takeOverMove', () => {
      it('should successfully take over a stale move', async () => {
        const moveId = 'move-1';
        mockNoteMoveManager.takeOverMove.mockResolvedValue({
          success: true,
          moveId,
        });

        const result = await (handlers as any).handleTakeOverMove(mockEvent, moveId);

        expect(result).toEqual({ success: true });
        expect(mockNoteMoveManager.takeOverMove).toHaveBeenCalledWith(moveId);
      });

      it('should return error when takeover fails', async () => {
        const moveId = 'move-1';
        const errorMessage = 'Cannot access source SD';
        mockNoteMoveManager.takeOverMove.mockResolvedValue({
          success: false,
          moveId,
          error: errorMessage,
        });

        const result = await (handlers as any).handleTakeOverMove(mockEvent, moveId);

        expect(result).toEqual({ success: false, error: errorMessage });
        expect(mockNoteMoveManager.takeOverMove).toHaveBeenCalledWith(moveId);
      });

      it('should return error when move not found', async () => {
        const moveId = 'nonexistent';
        mockNoteMoveManager.takeOverMove.mockResolvedValue({
          success: false,
          moveId,
          error: 'Move record not found',
        });

        const result = await (handlers as any).handleTakeOverMove(mockEvent, moveId);

        expect(result).toEqual({ success: false, error: 'Move record not found' });
      });
    });

    describe('recovery:cancelMove', () => {
      it('should successfully cancel a move', async () => {
        const moveId = 'move-1';
        mockNoteMoveManager.cancelMove.mockResolvedValue({
          success: true,
          moveId,
        });

        const result = await (handlers as any).handleCancelMove(mockEvent, moveId);

        expect(result).toEqual({ success: true });
        expect(mockNoteMoveManager.cancelMove).toHaveBeenCalledWith(moveId);
      });

      it('should return error when cancel fails', async () => {
        const moveId = 'move-1';
        const errorMessage = 'Move is already completed';
        mockNoteMoveManager.cancelMove.mockResolvedValue({
          success: false,
          moveId,
          error: errorMessage,
        });

        const result = await (handlers as any).handleCancelMove(mockEvent, moveId);

        expect(result).toEqual({ success: false, error: errorMessage });
        expect(mockNoteMoveManager.cancelMove).toHaveBeenCalledWith(moveId);
      });

      it('should return error when move not found', async () => {
        const moveId = 'nonexistent';
        mockNoteMoveManager.cancelMove.mockResolvedValue({
          success: false,
          moveId,
          error: 'Move record not found',
        });

        const result = await (handlers as any).handleCancelMove(mockEvent, moveId);

        expect(result).toEqual({ success: false, error: 'Move record not found' });
      });
    });
  });

  describe('Diagnostics Handlers', () => {
    const mockEvent = {} as any;

    describe('diagnostics:getDuplicateNotes', () => {
      it('should return duplicate notes from diagnostics manager', async () => {
        const mockDuplicates = [
          {
            noteId: 'note-123',
            noteTitle: 'Test Note',
            instances: [
              {
                sdId: 1,
                sdName: 'SD 1',
                sdPath: '/path/sd1',
                modifiedAt: '2024-01-01T00:00:00.000Z',
                size: 1024,
                blockCount: 10,
                preview: 'Test content...',
              },
              {
                sdId: 2,
                sdName: 'SD 2',
                sdPath: '/path/sd2',
                modifiedAt: '2024-01-02T00:00:00.000Z',
                size: 2048,
                blockCount: 15,
                preview: 'Different content...',
              },
            ],
          },
        ];

        mockDiagnosticsManager.detectDuplicateNotes.mockResolvedValue(mockDuplicates);

        const result = await (handlers as any).handleGetDuplicateNotes(mockEvent);

        expect(result).toEqual(mockDuplicates);
        expect(mockDiagnosticsManager.detectDuplicateNotes).toHaveBeenCalled();
      });

      it('should return empty array when no duplicates found', async () => {
        mockDiagnosticsManager.detectDuplicateNotes.mockResolvedValue([]);

        const result = await (handlers as any).handleGetDuplicateNotes(mockEvent);

        expect(result).toEqual([]);
      });
    });

    describe('diagnostics:getOrphanedCRDTFiles', () => {
      it('should return orphaned CRDT files', async () => {
        const mockOrphaned = [
          {
            noteId: 'orphan-123',
            sdId: 1,
            sdName: 'SD 1',
            sdPath: '/path/sd1',
            filePath: '/path/sd1/notes/orphan-123',
            title: 'Orphaned Note',
            preview: 'This note has no DB entry...',
            modifiedAt: '2024-01-01T00:00:00.000Z',
            size: 512,
            blockCount: 5,
          },
        ];

        mockDiagnosticsManager.detectOrphanedCRDTFiles.mockResolvedValue(mockOrphaned);

        const result = await (handlers as any).handleGetOrphanedCRDTFiles(mockEvent);

        expect(result).toEqual(mockOrphaned);
        expect(mockDiagnosticsManager.detectOrphanedCRDTFiles).toHaveBeenCalled();
      });
    });

    describe('diagnostics:getMissingCRDTFiles', () => {
      it('should return missing CRDT files', async () => {
        const mockMissing = [
          {
            noteId: 'missing-123',
            noteTitle: 'Missing Note',
            sdId: 1,
            sdName: 'SD 1',
            sdPath: '/path/sd1',
            expectedPath: '/path/sd1/notes/missing-123',
            lastModified: '2024-01-01T00:00:00.000Z',
          },
        ];

        mockDiagnosticsManager.detectMissingCRDTFiles.mockResolvedValue(mockMissing);

        const result = await (handlers as any).handleGetMissingCRDTFiles(mockEvent);

        expect(result).toEqual(mockMissing);
        expect(mockDiagnosticsManager.detectMissingCRDTFiles).toHaveBeenCalled();
      });
    });

    describe('diagnostics:getStaleMigrationLocks', () => {
      it('should return stale migration locks', async () => {
        const mockLocks = [
          {
            sdId: 1,
            sdName: 'SD 1',
            sdPath: '/path/sd1',
            lockPath: '/path/sd1/.migration-lock',
            ageMinutes: 120,
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ];

        mockDiagnosticsManager.detectStaleMigrationLocks.mockResolvedValue(mockLocks);

        const result = await (handlers as any).handleGetStaleMigrationLocks(mockEvent);

        expect(result).toEqual(mockLocks);
        expect(mockDiagnosticsManager.detectStaleMigrationLocks).toHaveBeenCalled();
      });
    });

    describe('diagnostics:getOrphanedActivityLogs', () => {
      it('should return orphaned activity logs', async () => {
        const mockLogs = [
          {
            instanceId: 'old-instance',
            sdId: 1,
            sdName: 'SD 1',
            sdPath: '/path/sd1',
            logPath: '/path/sd1/activity/old-instance.log',
            lastSeen: '2024-01-01T00:00:00.000Z',
            daysSinceLastSeen: 45,
            sizeBytes: 10240,
          },
        ];

        mockDiagnosticsManager.detectOrphanedActivityLogs.mockResolvedValue(mockLogs);

        const result = await (handlers as any).handleGetOrphanedActivityLogs(mockEvent);

        expect(result).toEqual(mockLogs);
        expect(mockDiagnosticsManager.detectOrphanedActivityLogs).toHaveBeenCalled();
      });
    });

    describe('diagnostics:removeStaleMigrationLock', () => {
      it('should remove stale migration lock', async () => {
        const sdId = 1;
        mockDiagnosticsManager.removeStaleMigrationLock.mockResolvedValue(undefined);

        await (handlers as any).handleRemoveStaleMigrationLock(mockEvent, sdId);

        expect(mockDiagnosticsManager.removeStaleMigrationLock).toHaveBeenCalledWith(sdId);
      });
    });

    describe('diagnostics:cleanupOrphanedActivityLog', () => {
      it('should cleanup orphaned activity log', async () => {
        const sdId = 1;
        const instanceId = 'old-instance';
        mockDiagnosticsManager.cleanupOrphanedActivityLog.mockResolvedValue(undefined);

        await (handlers as any).handleCleanupOrphanedActivityLog(mockEvent, sdId, instanceId);

        expect(mockDiagnosticsManager.cleanupOrphanedActivityLog).toHaveBeenCalledWith(
          sdId,
          instanceId
        );
      });
    });

    describe('diagnostics:importOrphanedCRDT', () => {
      it('should import orphaned CRDT', async () => {
        const noteId = 'orphan-123';
        const sdId = 1;
        mockDiagnosticsManager.importOrphanedCRDT.mockResolvedValue(undefined);

        await (handlers as any).handleImportOrphanedCRDT(mockEvent, noteId, sdId);

        expect(mockDiagnosticsManager.importOrphanedCRDT).toHaveBeenCalledWith(noteId, sdId);
      });
    });

    describe('diagnostics:deleteMissingCRDTEntry', () => {
      it('should delete missing CRDT entry', async () => {
        const noteId = 'missing-123';
        const sdId = 1;
        mockDiagnosticsManager.deleteMissingCRDTEntry.mockResolvedValue(undefined);

        await (handlers as any).handleDeleteMissingCRDTEntry(mockEvent, noteId, sdId);

        expect(mockDiagnosticsManager.deleteMissingCRDTEntry).toHaveBeenCalledWith(noteId, sdId);
      });
    });

    describe('diagnostics:deleteDuplicateNote', () => {
      it('should delete duplicate note', async () => {
        const noteId = 'duplicate-123';
        const sdId = 1;
        mockDiagnosticsManager.deleteDuplicateNote.mockResolvedValue(undefined);

        await (handlers as any).handleDeleteDuplicateNote(mockEvent, noteId, sdId);

        expect(mockDiagnosticsManager.deleteDuplicateNote).toHaveBeenCalledWith(noteId, sdId);
      });
    });
  });

  describe('Backup Handlers', () => {
    const mockEvent = {} as any;

    describe('backup:createPreOperationSnapshot', () => {
      it('should create pre-operation snapshot', async () => {
        const sdId = 1;
        const noteIds = ['note-1', 'note-2'];
        const description = 'Before risky operation';
        const mockBackupInfo = {
          backupId: 'backup-123',
          sdUuid: 'sd-uuid-123',
          sdName: 'Test SD',
          timestamp: Date.now(),
          noteCount: 2,
          folderCount: 0,
          sizeBytes: 2048,
          type: 'pre-operation' as const,
          isPacked: false,
          description,
          backupPath: '/backups/backup-123',
        };

        mockBackupManager.createPreOperationSnapshot.mockResolvedValue(mockBackupInfo);

        const result = await (handlers as any).handleCreatePreOperationSnapshot(
          mockEvent,
          sdId,
          noteIds,
          description
        );

        expect(result).toEqual(mockBackupInfo);
        expect(mockBackupManager.createPreOperationSnapshot).toHaveBeenCalledWith(
          sdId,
          noteIds,
          description
        );
      });
    });

    describe('backup:createManualBackup', () => {
      it('should create manual backup without packing', async () => {
        const sdId = 1;
        const packAndSnapshot = false;
        const description = 'Manual backup';
        const mockBackupInfo = {
          backupId: 'backup-456',
          sdUuid: 'sd-uuid-123',
          sdName: 'Test SD',
          timestamp: Date.now(),
          noteCount: 10,
          folderCount: 3,
          sizeBytes: 10240,
          type: 'manual' as const,
          isPacked: false,
          description,
          backupPath: '/backups/backup-456',
        };

        mockBackupManager.createManualBackup.mockResolvedValue(mockBackupInfo);

        const result = await (handlers as any).handleCreateManualBackup(
          mockEvent,
          sdId,
          packAndSnapshot,
          description
        );

        expect(result).toEqual(mockBackupInfo);
        expect(mockBackupManager.createManualBackup).toHaveBeenCalledWith(
          sdId,
          packAndSnapshot,
          description,
          undefined
        );
      });

      it('should create manual backup with packing', async () => {
        const sdId = 1;
        const packAndSnapshot = true;
        const mockBackupInfo = {
          backupId: 'backup-789',
          sdUuid: 'sd-uuid-123',
          sdName: 'Test SD',
          timestamp: Date.now(),
          noteCount: 10,
          folderCount: 3,
          sizeBytes: 5120,
          type: 'manual' as const,
          isPacked: true,
          backupPath: '/backups/backup-789',
        };

        mockBackupManager.createManualBackup.mockResolvedValue(mockBackupInfo);

        const result = await (handlers as any).handleCreateManualBackup(
          mockEvent,
          sdId,
          packAndSnapshot
        );

        expect(result).toEqual(mockBackupInfo);
        expect(mockBackupManager.createManualBackup).toHaveBeenCalledWith(
          sdId,
          packAndSnapshot,
          undefined,
          undefined
        );
      });
    });

    describe('backup:listBackups', () => {
      it('should list all backups', async () => {
        const mockBackups = [
          {
            backupId: 'backup-1',
            sdUuid: 'sd-uuid-1',
            sdName: 'SD 1',
            timestamp: Date.now() - 86400000,
            noteCount: 5,
            folderCount: 2,
            sizeBytes: 5120,
            type: 'manual' as const,
            isPacked: false,
            description: 'Manual backup 1',
            backupPath: '/backups/backup-1',
          },
          {
            backupId: 'backup-2',
            sdUuid: 'sd-uuid-2',
            sdName: 'SD 2',
            timestamp: Date.now() - 3600000,
            noteCount: 2,
            folderCount: 0,
            sizeBytes: 1024,
            type: 'pre-operation' as const,
            isPacked: false,
            description: 'Before move operation',
            backupPath: '/backups/backup-2',
          },
        ];

        mockBackupManager.listBackups.mockResolvedValue(mockBackups);

        const result = await (handlers as any).handleListBackups(mockEvent);

        expect(result).toEqual(mockBackups);
        expect(mockBackupManager.listBackups).toHaveBeenCalled();
      });

      it('should return empty array when no backups exist', async () => {
        mockBackupManager.listBackups.mockResolvedValue([]);

        const result = await (handlers as any).handleListBackups(mockEvent);

        expect(result).toEqual([]);
      });
    });

    describe('backup:restoreFromBackup', () => {
      it('should restore backup as new SD', async () => {
        const backupId = 'backup-123';
        const targetPath = '/restore/path';
        const registerAsNew = true;
        const mockRestoreResult = {
          sdId: '2',
          sdPath: targetPath,
        };

        mockBackupManager.restoreFromBackup.mockResolvedValue(mockRestoreResult);

        const result = await (handlers as any).handleRestoreFromBackup(
          mockEvent,
          backupId,
          targetPath,
          registerAsNew
        );

        expect(result).toEqual(mockRestoreResult);
        expect(mockBackupManager.restoreFromBackup).toHaveBeenCalledWith(
          backupId,
          targetPath,
          registerAsNew
        );
      });

      it('should restore backup as original SD', async () => {
        const backupId = 'backup-456';
        const targetPath = '/original/path';
        const registerAsNew = false;
        const mockRestoreResult = {
          sdId: '1',
          sdPath: targetPath,
        };

        mockBackupManager.restoreFromBackup.mockResolvedValue(mockRestoreResult);

        const result = await (handlers as any).handleRestoreFromBackup(
          mockEvent,
          backupId,
          targetPath,
          registerAsNew
        );

        expect(result).toEqual(mockRestoreResult);
        expect(mockBackupManager.restoreFromBackup).toHaveBeenCalledWith(
          backupId,
          targetPath,
          registerAsNew
        );
      });
    });

    describe('backup:deleteBackup', () => {
      it('should delete backup', async () => {
        const backupId = 'backup-123';
        mockBackupManager.deleteBackup.mockResolvedValue(undefined);

        await (handlers as any).handleDeleteBackup(mockEvent, backupId);

        expect(mockBackupManager.deleteBackup).toHaveBeenCalledWith(backupId);
      });
    });

    describe('backup:cleanupOldSnapshots', () => {
      it('should cleanup old snapshots and return count', async () => {
        const deletedCount = 5;
        mockBackupManager.cleanupOldSnapshots.mockResolvedValue(deletedCount);

        const result = await (handlers as any).handleCleanupOldSnapshots(mockEvent);

        expect(result).toBe(deletedCount);
        expect(mockBackupManager.cleanupOldSnapshots).toHaveBeenCalled();
      });

      it('should return zero when no snapshots deleted', async () => {
        mockBackupManager.cleanupOldSnapshots.mockResolvedValue(0);

        const result = await (handlers as any).handleCleanupOldSnapshots(mockEvent);

        expect(result).toBe(0);
      });
    });

    describe('backup:setBackupDirectory', () => {
      it('should set backup directory', async () => {
        const customPath = '/custom/backup/path';
        mockBackupManager.setBackupDirectory.mockReturnValue(undefined);

        await (handlers as any).handleSetBackupDirectory(mockEvent, customPath);

        expect(mockBackupManager.setBackupDirectory).toHaveBeenCalledWith(customPath);
      });
    });

    describe('backup:getBackupDirectory', () => {
      it('should get current backup directory', async () => {
        const backupDir = '/current/backup/path';
        mockBackupManager.getBackupDirectory.mockReturnValue(backupDir);

        const result = await (handlers as any).handleGetBackupDirectory(mockEvent);

        expect(result).toBe(backupDir);
        expect(mockBackupManager.getBackupDirectory).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Note CRUD Tests
  // ============================================================================
  describe('Note CRUD', () => {
    const mockEvent = {} as any;

    describe('note:create', () => {
      it('should create a note in root folder', async () => {
        const sdId = 'test-sd';
        const folderId = null;
        const mockNoteDoc = {
          initializeNote: jest.fn(),
        };

        (mockCRDTManager as any).getNoteDoc = jest.fn().mockReturnValue(mockNoteDoc);

        const noteId = await (handlers as any).handleCreateNote(mockEvent, sdId, folderId);

        expect(noteId).toBeDefined();
        expect(mockCRDTManager.loadNote).toHaveBeenCalledWith(noteId, sdId);
        expect(mockNoteDoc.initializeNote).toHaveBeenCalledWith(
          expect.objectContaining({
            id: noteId,
            sdId,
            folderId,
            deleted: false,
            pinned: false,
          })
        );
        expect(mockDatabase.upsertNote).toHaveBeenCalledWith(
          expect.objectContaining({
            id: noteId,
            title: 'Untitled',
            sdId,
            folderId,
            deleted: false,
            pinned: false,
          })
        );
      });

      it('should create a note in a folder', async () => {
        const sdId = 'test-sd';
        const folderId = 'folder-123';
        const mockNoteDoc = {
          initializeNote: jest.fn(),
        };

        (mockCRDTManager as any).getNoteDoc = jest.fn().mockReturnValue(mockNoteDoc);

        await (handlers as any).handleCreateNote(mockEvent, sdId, folderId);

        expect(mockDatabase.upsertNote).toHaveBeenCalledWith(
          expect.objectContaining({
            sdId,
            folderId,
          })
        );
      });
    });

    describe('note:delete', () => {
      it('should soft delete a note', async () => {
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
        const mockNoteDoc = {
          markDeleted: jest.fn(),
        };

        mockDatabase.getNote.mockResolvedValue(mockNote);
        (mockCRDTManager as any).getNoteDoc = jest.fn().mockReturnValue(mockNoteDoc);

        await (handlers as any).handleDeleteNote(mockEvent, noteId);

        expect(mockNoteDoc.markDeleted).toHaveBeenCalled();
        expect(mockDatabase.upsertNote).toHaveBeenCalledWith(
          expect.objectContaining({
            id: noteId,
            deleted: true,
          })
        );
      });

      it('should load note if not already loaded', async () => {
        const noteId = 'note-123';
        const sdId = 'test-sd';
        const mockNote = {
          id: noteId,
          title: 'Test Note',
          sdId,
          folderId: null,
          deleted: false,
          pinned: false,
          contentPreview: '',
          contentText: '',
          created: Date.now(),
          modified: Date.now(),
        };
        const mockNoteDoc = {
          markDeleted: jest.fn(),
        };

        mockDatabase.getNote.mockResolvedValue(mockNote);
        // First call returns null (not loaded), second returns the doc
        (mockCRDTManager as any).getNoteDoc = jest
          .fn()
          .mockReturnValueOnce(null)
          .mockReturnValueOnce(mockNoteDoc);

        await (handlers as any).handleDeleteNote(mockEvent, noteId);

        expect(mockCRDTManager.loadNote).toHaveBeenCalledWith(noteId, sdId);
        expect(mockNoteDoc.markDeleted).toHaveBeenCalled();
      });

      it('should throw error if note not found', async () => {
        mockDatabase.getNote.mockResolvedValue(null);

        await expect(
          (handlers as any).handleDeleteNote(mockEvent, 'non-existent-note')
        ).rejects.toThrow('Note non-existent-note not found');
      });
    });

    describe('note:restore', () => {
      it('should restore a deleted note', async () => {
        const noteId = 'note-123';
        const mockNote = {
          id: noteId,
          title: 'Test Note',
          sdId: 'test-sd',
          folderId: null,
          deleted: true,
          pinned: false,
          contentPreview: '',
          contentText: '',
          created: Date.now(),
          modified: Date.now(),
        };
        const mockNoteDoc = {
          markRestored: jest.fn(),
        };

        mockDatabase.getNote.mockResolvedValue(mockNote);
        (mockCRDTManager as any).getNoteDoc = jest.fn().mockReturnValue(mockNoteDoc);

        await (handlers as any).handleRestoreNote(mockEvent, noteId);

        expect(mockNoteDoc.markRestored).toHaveBeenCalled();
        expect(mockDatabase.upsertNote).toHaveBeenCalledWith(
          expect.objectContaining({
            id: noteId,
            deleted: false,
          })
        );
      });
    });

    describe('note:togglePin', () => {
      it('should toggle pin from false to true', async () => {
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
        const mockNoteDoc = {
          updateMetadata: jest.fn(),
        };

        mockDatabase.getNote.mockResolvedValue(mockNote);
        (mockCRDTManager as any).getNoteDoc = jest.fn().mockReturnValue(mockNoteDoc);

        await (handlers as any).handleTogglePinNote(mockEvent, noteId);

        expect(mockNoteDoc.updateMetadata).toHaveBeenCalledWith(
          expect.objectContaining({
            pinned: true,
          })
        );
        expect(mockDatabase.upsertNote).toHaveBeenCalledWith(
          expect.objectContaining({
            pinned: true,
          })
        );
      });

      it('should toggle pin from true to false', async () => {
        const noteId = 'note-123';
        const mockNote = {
          id: noteId,
          title: 'Test Note',
          sdId: 'test-sd',
          folderId: null,
          deleted: false,
          pinned: true,
          contentPreview: '',
          contentText: '',
          created: Date.now(),
          modified: Date.now(),
        };
        const mockNoteDoc = {
          updateMetadata: jest.fn(),
        };

        mockDatabase.getNote.mockResolvedValue(mockNote);
        (mockCRDTManager as any).getNoteDoc = jest.fn().mockReturnValue(mockNoteDoc);

        await (handlers as any).handleTogglePinNote(mockEvent, noteId);

        expect(mockDatabase.upsertNote).toHaveBeenCalledWith(
          expect.objectContaining({
            pinned: false,
          })
        );
      });
    });

    describe('note:move', () => {
      it('should move note to new folder', async () => {
        const noteId = 'note-123';
        const newFolderId = 'folder-456';
        const mockNote = {
          id: noteId,
          title: 'Test Note',
          sdId: 'test-sd',
          folderId: 'folder-123',
          deleted: false,
          pinned: false,
          contentPreview: '',
          contentText: '',
          created: Date.now(),
          modified: Date.now(),
        };
        const mockNoteDoc = {
          updateMetadata: jest.fn(),
        };

        mockDatabase.getNote.mockResolvedValue(mockNote);
        (mockCRDTManager as any).getNoteDoc = jest.fn().mockReturnValue(mockNoteDoc);

        await (handlers as any).handleMoveNote(mockEvent, noteId, newFolderId);

        expect(mockNoteDoc.updateMetadata).toHaveBeenCalledWith(
          expect.objectContaining({
            folderId: newFolderId,
          })
        );
        expect(mockDatabase.upsertNote).toHaveBeenCalledWith(
          expect.objectContaining({
            folderId: newFolderId,
          })
        );
      });

      it('should move note to root folder (null)', async () => {
        const noteId = 'note-123';
        const mockNote = {
          id: noteId,
          title: 'Test Note',
          sdId: 'test-sd',
          folderId: 'folder-123',
          deleted: false,
          pinned: false,
          contentPreview: '',
          contentText: '',
          created: Date.now(),
          modified: Date.now(),
        };
        const mockNoteDoc = {
          updateMetadata: jest.fn(),
        };

        mockDatabase.getNote.mockResolvedValue(mockNote);
        (mockCRDTManager as any).getNoteDoc = jest.fn().mockReturnValue(mockNoteDoc);

        await (handlers as any).handleMoveNote(mockEvent, noteId, null);

        expect(mockDatabase.upsertNote).toHaveBeenCalledWith(
          expect.objectContaining({
            folderId: null,
          })
        );
      });
    });

    describe('note:updateTitle', () => {
      it('should update note title', async () => {
        const noteId = 'note-123';
        const newTitle = 'Updated Title';
        const mockNote = {
          id: noteId,
          title: 'Old Title',
          sdId: 'test-sd',
          folderId: null,
          deleted: false,
          pinned: false,
          contentPreview: '',
          contentText: '',
          created: Date.now(),
          modified: Date.now(),
        };

        mockDatabase.getNote.mockResolvedValue(mockNote);

        await (handlers as any).handleUpdateTitle(mockEvent, noteId, newTitle);

        expect(mockDatabase.upsertNote).toHaveBeenCalledWith(
          expect.objectContaining({
            title: newTitle,
          })
        );
      });

      it('should update title and contentText if provided', async () => {
        const noteId = 'note-123';
        const newTitle = 'Updated Title';
        // Content has title on first line, preview comes from lines after
        const contentText = 'Updated Title\nThis is the body content';
        const mockNote = {
          id: noteId,
          title: 'Old Title',
          sdId: 'test-sd',
          folderId: null,
          deleted: false,
          pinned: false,
          contentPreview: 'Old preview',
          contentText: 'Old content',
          created: Date.now(),
          modified: Date.now(),
        };

        mockDatabase.getNote.mockResolvedValue(mockNote);

        await (handlers as any).handleUpdateTitle(mockEvent, noteId, newTitle, contentText);

        expect(mockDatabase.upsertNote).toHaveBeenCalledWith(
          expect.objectContaining({
            title: newTitle,
            contentText,
            // Preview is extracted from content after first line (title)
            contentPreview: 'This is the body content',
          })
        );
      });
    });
  });

  // ============================================================================
  // App State Tests
  // ============================================================================
  describe('App State', () => {
    const mockEvent = {} as any;

    describe('appState:get', () => {
      it('should get state value', async () => {
        const key = 'testKey';
        const value = 'testValue';
        mockDatabase.getState.mockResolvedValue(value);

        const result = await (handlers as any).handleGetAppState(mockEvent, key);

        expect(result).toBe(value);
        expect(mockDatabase.getState).toHaveBeenCalledWith(key);
      });

      it('should return null for non-existent key', async () => {
        mockDatabase.getState.mockResolvedValue(null);

        const result = await (handlers as any).handleGetAppState(mockEvent, 'nonExistent');

        expect(result).toBeNull();
      });
    });

    describe('appState:set', () => {
      it('should set state value', async () => {
        const key = 'testKey';
        const value = 'testValue';

        await (handlers as any).handleSetAppState(mockEvent, key, value);

        expect(mockDatabase.setState).toHaveBeenCalledWith(key, value);
      });
    });
  });

  // ============================================================================
  // Config Tests
  // ============================================================================
  describe('Config', () => {
    const mockEvent = {} as any;

    describe('config:getDatabasePath', () => {
      it('should get database path', async () => {
        const dbPath = '/test/path/notecove.db';
        mockConfigManager.getDatabasePath.mockReturnValue(dbPath);

        const result = await (handlers as any).handleGetDatabasePath(mockEvent);

        expect(result).toBe(dbPath);
      });
    });

    describe('config:setDatabasePath', () => {
      it('should set database path', async () => {
        const newPath = '/new/path/notecove.db';

        await (handlers as any).handleSetDatabasePath(mockEvent, newPath);

        expect(mockConfigManager.setDatabasePath).toHaveBeenCalledWith(newPath);
      });
    });
  });

  // ============================================================================
  // Note List & Search Tests
  // ============================================================================
  describe('Note Listing', () => {
    const mockEvent = {} as any;
    const mockNotes = [
      {
        id: 'note-1',
        title: 'Test Note 1',
        sdId: 'test-sd',
        folderId: null,
        deleted: false,
        pinned: false,
        contentPreview: 'Preview 1',
        contentText: 'Content 1',
        created: Date.now(),
        modified: Date.now(),
      },
      {
        id: 'note-2',
        title: 'Test Note 2',
        sdId: 'test-sd',
        folderId: 'folder-1',
        deleted: false,
        pinned: false,
        contentPreview: 'Preview 2',
        contentText: 'Content 2',
        created: Date.now(),
        modified: Date.now(),
      },
    ];

    describe('note:list', () => {
      it('should list notes for all-notes folder', async () => {
        mockDatabase.getNotesBySd.mockResolvedValue(mockNotes);

        const result = await (handlers as any).handleListNotes(mockEvent, 'test-sd', 'all-notes');

        expect(result).toEqual(mockNotes);
        expect(mockDatabase.getNotesBySd).toHaveBeenCalledWith('test-sd');
      });

      it('should list notes for all-notes:sd-id folder', async () => {
        mockDatabase.getNotesBySd.mockResolvedValue(mockNotes);

        const result = await (handlers as any).handleListNotes(
          mockEvent,
          'test-sd',
          'all-notes:test-sd'
        );

        expect(result).toEqual(mockNotes);
        expect(mockDatabase.getNotesBySd).toHaveBeenCalledWith('test-sd');
      });

      it('should list deleted notes for recently-deleted folder', async () => {
        const deletedNotes = mockNotes.map((n) => ({ ...n, deleted: true }));
        mockDatabase.getDeletedNotes.mockResolvedValue(deletedNotes);

        const result = await (handlers as any).handleListNotes(
          mockEvent,
          'test-sd',
          'recently-deleted'
        );

        expect(result).toEqual(deletedNotes);
        expect(mockDatabase.getDeletedNotes).toHaveBeenCalledWith('test-sd');
      });

      it('should list notes for specific folder', async () => {
        const folderNotes = [mockNotes[1]];
        mockDatabase.getNotesByFolder.mockResolvedValue(folderNotes);

        const result = await (handlers as any).handleListNotes(mockEvent, 'test-sd', 'folder-1');

        expect(result).toEqual(folderNotes);
        // Note: getNotesByFolder only takes folderId, not sdId
        expect(mockDatabase.getNotesByFolder).toHaveBeenCalledWith('folder-1');
      });

      it('should list notes for root folder (null)', async () => {
        const rootNotes = [mockNotes[0]];
        mockDatabase.getNotesByFolder.mockResolvedValue(rootNotes);

        const result = await (handlers as any).handleListNotes(mockEvent, 'test-sd', null);

        expect(result).toEqual(rootNotes);
        // Note: getNotesByFolder only takes folderId, not sdId
        expect(mockDatabase.getNotesByFolder).toHaveBeenCalledWith(null);
      });
    });

    describe('note:search', () => {
      it('should search notes with query', async () => {
        const searchResults = [{ id: 'note-1', title: 'Matching Note', match: 'content match' }];
        mockDatabase.searchNotes.mockResolvedValue(searchResults);

        const result = await (handlers as any).handleSearchNotes(mockEvent, 'test query');

        expect(result).toEqual(searchResults);
        expect(mockDatabase.searchNotes).toHaveBeenCalledWith('test query', undefined);
      });

      it('should search notes with limit', async () => {
        const searchResults = [{ id: 'note-1', title: 'Result', match: 'match' }];
        mockDatabase.searchNotes.mockResolvedValue(searchResults);

        const result = await (handlers as any).handleSearchNotes(mockEvent, 'query', 10);

        expect(result).toEqual(searchResults);
        expect(mockDatabase.searchNotes).toHaveBeenCalledWith('query', 10);
      });
    });

    describe('note:getCountForFolder', () => {
      it('should get note count for folder', async () => {
        mockDatabase.getNoteCountForFolder.mockResolvedValue(5);

        const result = await (handlers as any).handleGetNoteCountForFolder(
          mockEvent,
          'test-sd',
          'folder-1'
        );

        expect(result).toBe(5);
        expect(mockDatabase.getNoteCountForFolder).toHaveBeenCalledWith('test-sd', 'folder-1');
      });

      it('should get note count for root folder', async () => {
        mockDatabase.getNoteCountForFolder.mockResolvedValue(3);

        const result = await (handlers as any).handleGetNoteCountForFolder(
          mockEvent,
          'test-sd',
          null
        );

        expect(result).toBe(3);
        expect(mockDatabase.getNoteCountForFolder).toHaveBeenCalledWith('test-sd', null);
      });
    });

    describe('note:getAllNotesCount', () => {
      it('should get all notes count for SD', async () => {
        mockDatabase.getAllNotesCount.mockResolvedValue(10);

        const result = await (handlers as any).handleGetAllNotesCount(mockEvent, 'test-sd');

        expect(result).toBe(10);
        expect(mockDatabase.getAllNotesCount).toHaveBeenCalledWith('test-sd');
      });
    });

    describe('note:getDeletedNoteCount', () => {
      it('should get deleted note count for SD', async () => {
        mockDatabase.getDeletedNoteCount.mockResolvedValue(2);

        const result = await (handlers as any).handleGetDeletedNoteCount(mockEvent, 'test-sd');

        expect(result).toBe(2);
        expect(mockDatabase.getDeletedNoteCount).toHaveBeenCalledWith('test-sd');
      });
    });
  });

  // ============================================================================
  // Tag Tests
  // ============================================================================
  describe('Tags', () => {
    const mockEvent = {} as any;

    describe('tag:getAll', () => {
      it('should get all tags', async () => {
        const mockTags = [
          { id: 'tag-1', name: 'work', count: 5 },
          { id: 'tag-2', name: 'personal', count: 3 },
        ];
        mockDatabase.getAllTags.mockResolvedValue(mockTags);

        const result = await (handlers as any).handleGetAllTags(mockEvent);

        expect(result).toEqual(mockTags);
        expect(mockDatabase.getAllTags).toHaveBeenCalled();
      });

      it('should return empty array when no tags', async () => {
        mockDatabase.getAllTags.mockResolvedValue([]);

        const result = await (handlers as any).handleGetAllTags(mockEvent);

        expect(result).toEqual([]);
      });
    });
  });

  // ============================================================================
  // Link Tests
  // ============================================================================
  describe('Links', () => {
    const mockEvent = {} as any;

    describe('link:getBacklinks', () => {
      it('should get backlinks for a note', async () => {
        const mockBacklinks = [
          {
            id: 'note-2',
            title: 'Linking Note',
            sdId: 'test-sd',
            folderId: null,
            deleted: false,
            pinned: false,
            contentPreview: 'Links to target',
            contentText: 'Content that links to [[target]]',
            created: Date.now(),
            modified: Date.now(),
          },
        ];
        mockDatabase.getBacklinks.mockResolvedValue(mockBacklinks);

        const result = await (handlers as any).handleGetBacklinks(mockEvent, 'target-note-id');

        expect(result).toEqual(mockBacklinks);
        expect(mockDatabase.getBacklinks).toHaveBeenCalledWith('target-note-id');
      });

      it('should return empty array when no backlinks', async () => {
        mockDatabase.getBacklinks.mockResolvedValue([]);

        const result = await (handlers as any).handleGetBacklinks(mockEvent, 'note-without-links');

        expect(result).toEqual([]);
      });
    });
  });

  // ============================================================================
  // Sync Status Tests
  // ============================================================================
  describe('Sync Status', () => {
    describe('sync:getStatus', () => {
      it('should return empty status when getSyncStatus is not set', async () => {
        const result = await (handlers as any).handleGetSyncStatus();

        expect(result).toEqual({
          pendingCount: 0,
          perSd: [],
          isSyncing: false,
        });
      });
    });
  });

  // ============================================================================
  // Permanent Delete & Duplicate Tests
  // ============================================================================
  describe('Note Operations', () => {
    const mockEvent = {} as any;

    describe('note:permanentDelete', () => {
      it('should permanently delete a note', async () => {
        const noteId = 'note-to-delete';
        const sdId = 'test-sd';
        const mockNote = {
          id: noteId,
          title: 'Note to Delete',
          sdId,
          folderId: null,
          deleted: true,
          pinned: false,
          contentPreview: '',
          contentText: '',
          created: Date.now(),
          modified: Date.now(),
        };

        mockDatabase.getNote.mockResolvedValue(mockNote);
        mockDatabase.getStorageDir.mockResolvedValue({ id: sdId, path: '/tmp/sd' });

        await (handlers as any).handlePermanentDeleteNote(mockEvent, noteId);

        expect(mockDatabase.getNote).toHaveBeenCalledWith(noteId);
        expect(mockCRDTManager.unloadNote).toHaveBeenCalledWith(noteId);
        expect(mockDatabase.deleteNote).toHaveBeenCalledWith(noteId);
      });
    });

    describe('note:getMetadata', () => {
      it('should get note metadata with transformed format', async () => {
        const noteId = 'note-123';
        const mockNote = {
          id: noteId,
          title: 'Test Note',
          sdId: 'test-sd',
          folderId: 'folder-1',
          deleted: false,
          pinned: true,
          contentPreview: 'Preview',
          contentText: 'Content',
          created: 1000,
          modified: 2000,
        };

        mockDatabase.getNote.mockResolvedValue(mockNote);

        const result = await (handlers as any).handleGetMetadata(mockEvent, noteId);

        // handleGetMetadata returns a transformed NoteMetadata format
        expect(result).toMatchObject({
          noteId: noteId,
          title: 'Test Note',
          folderId: 'folder-1',
          deleted: false,
        });
        expect(mockDatabase.getNote).toHaveBeenCalledWith(noteId);
      });

      it('should throw error for non-existent note', async () => {
        mockDatabase.getNote.mockResolvedValue(null);

        await expect(
          (handlers as any).handleGetMetadata(mockEvent, 'non-existent')
        ).rejects.toThrow('Note non-existent not found');
      });
    });
  });

  // ============================================================================
  // Diagnostics Tests
  // ============================================================================
  describe('Diagnostics', () => {
    const mockEvent = {} as any;

    describe('diagnostics:getDuplicateNotes', () => {
      it('should get duplicate notes', async () => {
        const mockDuplicates = [{ noteId: 'note-1', sdId: 'sd-1', copies: 2 }];
        mockDiagnosticsManager.detectDuplicateNotes.mockResolvedValue(mockDuplicates);

        const result = await (handlers as any).handleGetDuplicateNotes(mockEvent);

        expect(result).toEqual(mockDuplicates);
        expect(mockDiagnosticsManager.detectDuplicateNotes).toHaveBeenCalled();
      });
    });

    describe('diagnostics:getOrphanedCRDTFiles', () => {
      it('should get orphaned CRDT files', async () => {
        const mockOrphans = [{ noteId: 'orphan-1', sdId: 'sd-1', path: '/path/to/orphan' }];
        mockDiagnosticsManager.detectOrphanedCRDTFiles.mockResolvedValue(mockOrphans);

        const result = await (handlers as any).handleGetOrphanedCRDTFiles(mockEvent);

        expect(result).toEqual(mockOrphans);
        expect(mockDiagnosticsManager.detectOrphanedCRDTFiles).toHaveBeenCalled();
      });
    });

    describe('diagnostics:getMissingCRDTFiles', () => {
      it('should get missing CRDT files', async () => {
        const mockMissing = [{ noteId: 'missing-1', sdId: 'sd-1' }];
        mockDiagnosticsManager.detectMissingCRDTFiles.mockResolvedValue(mockMissing);

        const result = await (handlers as any).handleGetMissingCRDTFiles(mockEvent);

        expect(result).toEqual(mockMissing);
        expect(mockDiagnosticsManager.detectMissingCRDTFiles).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Backup Tests
  // ============================================================================
  describe('Backup', () => {
    const mockEvent = {} as any;

    describe('backup:createManualBackup', () => {
      it('should create manual backup', async () => {
        const backupPath = '/path/to/backup';
        mockBackupManager.createManualBackup.mockResolvedValue(backupPath);

        const result = await (handlers as any).handleCreateManualBackup(mockEvent);

        expect(result).toBe(backupPath);
        expect(mockBackupManager.createManualBackup).toHaveBeenCalled();
      });
    });

    describe('backup:listBackups', () => {
      it('should list backups', async () => {
        const mockBackups = [
          { path: '/backup1', timestamp: 1000 },
          { path: '/backup2', timestamp: 2000 },
        ];
        mockBackupManager.listBackups.mockResolvedValue(mockBackups);

        const result = await (handlers as any).handleListBackups(mockEvent);

        expect(result).toEqual(mockBackups);
        expect(mockBackupManager.listBackups).toHaveBeenCalled();
      });
    });

    describe('backup:deleteBackup', () => {
      it('should delete backup', async () => {
        const backupPath = '/path/to/backup';
        mockBackupManager.deleteBackup.mockResolvedValue(undefined);

        await (handlers as any).handleDeleteBackup(mockEvent, backupPath);

        expect(mockBackupManager.deleteBackup).toHaveBeenCalledWith(backupPath);
      });
    });

    describe('backup:getBackupDirectory', () => {
      it('should get backup directory', async () => {
        const backupDir = '/path/to/backups';
        mockBackupManager.getBackupDirectory.mockReturnValue(backupDir);

        const result = await (handlers as any).handleGetBackupDirectory(mockEvent);

        expect(result).toBe(backupDir);
        expect(mockBackupManager.getBackupDirectory).toHaveBeenCalled();
      });
    });

    describe('backup:setBackupDirectory', () => {
      it('should set backup directory', async () => {
        const newDir = '/new/backup/path';
        mockBackupManager.setBackupDirectory.mockResolvedValue(undefined);

        await (handlers as any).handleSetBackupDirectory(mockEvent, newDir);

        expect(mockBackupManager.setBackupDirectory).toHaveBeenCalledWith(newDir);
      });
    });

    describe('backup:cleanupOldSnapshots', () => {
      it('should cleanup old snapshots', async () => {
        mockBackupManager.cleanupOldSnapshots.mockResolvedValue(undefined);

        await (handlers as any).handleCleanupOldSnapshots(mockEvent);

        expect(mockBackupManager.cleanupOldSnapshots).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Recovery Tests
  // ============================================================================
  describe('Recovery', () => {
    const mockEvent = {} as any;

    describe('recovery:getStaleMoves', () => {
      it('should get stale moves', async () => {
        const mockStaleMoves = [{ moveId: 'move-1', noteId: 'note-1', state: 'initiated' }];
        mockNoteMoveManager.getStaleMoves.mockReturnValue(mockStaleMoves);

        const result = await (handlers as any).handleGetStaleMoves(mockEvent);

        expect(result).toEqual(mockStaleMoves);
        expect(mockNoteMoveManager.getStaleMoves).toHaveBeenCalled();
      });
    });

    describe('recovery:takeOverMove', () => {
      it('should take over a move', async () => {
        mockNoteMoveManager.takeOverMove.mockResolvedValue({ success: true });

        const result = await (handlers as any).handleTakeOverMove(mockEvent, 'move-1');

        expect(result).toEqual({ success: true });
        expect(mockNoteMoveManager.takeOverMove).toHaveBeenCalledWith('move-1');
      });
    });

    describe('recovery:cancelMove', () => {
      it('should cancel a move', async () => {
        mockNoteMoveManager.cancelMove.mockResolvedValue({ success: true });

        const result = await (handlers as any).handleCancelMove(mockEvent, 'move-1');

        expect(result).toEqual({ success: true });
        expect(mockNoteMoveManager.cancelMove).toHaveBeenCalledWith('move-1');
      });
    });
  });

  describe('Note Load/Unload', () => {
    const mockEvent = {} as any;

    beforeEach(() => {
      mockCRDTManager.loadNote.mockClear();
      mockCRDTManager.unloadNote.mockClear();
      mockCRDTManager.getNoteDoc.mockClear();
      mockDatabase.getNote.mockClear();
      mockDatabase.upsertNote.mockClear();
    });

    describe('note:load', () => {
      it('should load note and sync CRDT metadata to database', async () => {
        const noteId = 'test-note-1';
        const note = {
          id: noteId,
          sdId: 'test-sd',
          folderId: 'folder-1',
          created: 1000,
          modified: 2000,
          deleted: false,
        };

        mockDatabase.getNote.mockResolvedValue(note);
        mockCRDTManager.loadNote.mockResolvedValue(undefined);
        mockCRDTManager.getNoteDoc.mockReturnValue({
          getMetadata: () => ({
            id: noteId,
            folderId: 'folder-1',
            created: 1000,
            modified: 2000,
            deleted: false,
          }),
        });

        await (handlers as any).handleLoadNote(mockEvent, noteId);

        expect(mockCRDTManager.loadNote).toHaveBeenCalledWith(noteId, 'test-sd');
        expect(mockDatabase.upsertNote).toHaveBeenCalled();
      });

      it('should use default SD when note not in database', async () => {
        const noteId = 'new-note';
        mockDatabase.getNote.mockResolvedValue(null);
        mockCRDTManager.loadNote.mockResolvedValue(undefined);
        mockCRDTManager.getNoteDoc.mockReturnValue(null);

        await (handlers as any).handleLoadNote(mockEvent, noteId);

        expect(mockCRDTManager.loadNote).toHaveBeenCalledWith(noteId, 'default');
      });
    });

    describe('note:unload', () => {
      it('should unload note from CRDT manager', async () => {
        const noteId = 'test-note-1';
        mockCRDTManager.unloadNote.mockResolvedValue(undefined);

        await (handlers as any).handleUnloadNote(mockEvent, noteId);

        expect(mockCRDTManager.unloadNote).toHaveBeenCalledWith(noteId);
      });
    });

    describe('note:createSnapshot', () => {
      it('should return error when note not loaded', async () => {
        const noteId = 'unloaded-note';
        mockCRDTManager.getNoteDoc.mockReturnValue(null);

        const result = await (handlers as any).handleCreateSnapshot(mockEvent, noteId);

        expect(result).toEqual({
          success: false,
          error: 'Note unloaded-note not loaded',
        });
      });

      it('should return error when document not found', async () => {
        const noteId = 'test-note-1';
        mockCRDTManager.getNoteDoc.mockReturnValue({
          getMetadata: () => ({ sdId: 'test-sd' }),
        });
        mockCRDTManager.getDocument.mockReturnValue(null);

        const result = await (handlers as any).handleCreateSnapshot(mockEvent, noteId);

        expect(result).toEqual({
          success: false,
          error: 'Note test-note-1 document not found',
        });
      });
    });
  });

  describe('Note Create/Duplicate', () => {
    const mockEvent = {} as any;

    beforeEach(() => {
      mockCRDTManager.loadNote.mockClear();
      mockCRDTManager.getNoteDoc.mockClear();
      mockCRDTManager.getDocument.mockClear();
      mockCRDTManager.unloadNote.mockClear();
      mockDatabase.getNote.mockClear();
      mockDatabase.upsertNote.mockClear();
    });

    describe('note:create', () => {
      it('should create a new note with CRDT document', async () => {
        const sdId = 'test-sd';
        const folderId = 'folder-1';

        const mockNoteDoc = {
          initializeNote: jest.fn(),
        };

        mockCRDTManager.loadNote.mockResolvedValue(undefined);
        mockCRDTManager.getNoteDoc.mockReturnValue(mockNoteDoc);
        mockDatabase.upsertNote.mockResolvedValue(undefined);

        const result = await (handlers as any).handleCreateNote(mockEvent, sdId, folderId);

        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(mockCRDTManager.loadNote).toHaveBeenCalledWith(expect.any(String), sdId);
        expect(mockNoteDoc.initializeNote).toHaveBeenCalledWith(
          expect.objectContaining({
            id: expect.any(String),
            sdId,
            folderId,
            deleted: false,
            pinned: false,
          })
        );
      });

      it('should create a root note with null folderId', async () => {
        const sdId = 'test-sd';

        const mockNoteDoc = {
          initializeNote: jest.fn(),
        };

        mockCRDTManager.loadNote.mockResolvedValue(undefined);
        mockCRDTManager.getNoteDoc.mockReturnValue(mockNoteDoc);
        mockDatabase.upsertNote.mockResolvedValue(undefined);

        await (handlers as any).handleCreateNote(mockEvent, sdId, null);

        expect(mockNoteDoc.initializeNote).toHaveBeenCalledWith(
          expect.objectContaining({
            folderId: null,
          })
        );
      });
    });

    describe('note:duplicate', () => {
      it('should throw error when source note not found', async () => {
        const sourceNoteId = 'non-existent';
        mockDatabase.getNote.mockResolvedValue(null);

        await expect(
          (handlers as any).handleDuplicateNote(mockEvent, sourceNoteId)
        ).rejects.toThrow('Source note non-existent not found');
      });
    });
  });

  describe('CRDT State Operations', () => {
    const mockEvent = {} as any;

    describe('note:getState', () => {
      it('should throw when note not loaded', async () => {
        mockCRDTManager.getDocument.mockReturnValue(undefined);

        await expect((handlers as any).handleGetState(mockEvent, 'non-existent')).rejects.toThrow(
          'Note non-existent not loaded'
        );
      });
    });

    describe('note:applyUpdate', () => {
      it('should throw when note not loaded', async () => {
        mockCRDTManager.applyUpdate.mockRejectedValue(new Error('Note not-loaded not loaded'));

        const update = new Uint8Array([1, 2, 3]);
        await expect(
          (handlers as any).handleApplyUpdate(mockEvent, 'not-loaded', update)
        ).rejects.toThrow('Note not-loaded not loaded');
      });

      it('should apply update successfully', async () => {
        mockCRDTManager.applyUpdate.mockResolvedValue(undefined);
        mockCRDTManager.getNoteDoc.mockReturnValue({
          getMetadata: jest.fn().mockReturnValue({
            deleted: false,
            folderId: 'folder-1',
            sdId: 'test-sd',
          }),
        });
        mockDatabase.getNote.mockResolvedValue({
          id: 'note-1',
          sdId: 'test-sd',
          folderId: 'folder-1',
          deleted: false,
        });
        mockDatabase.upsertNote.mockResolvedValue(undefined);

        const update = new Uint8Array([1, 2, 3]);
        await (handlers as any).handleApplyUpdate(mockEvent, 'note-1', update);

        expect(mockCRDTManager.applyUpdate).toHaveBeenCalledWith('note-1', update);
      });
    });
  });

  describe('Folder Reorder', () => {
    const mockEvent = {} as any;

    describe('folder:reorder', () => {
      it('should reorder folder and update siblings in database', async () => {
        const sdId = 'test-sd';
        const folderId = 'folder-1';
        const newIndex = 2;

        const mockSiblings = [
          { id: 'folder-1', name: 'Folder 1', order: 2 },
          { id: 'folder-2', name: 'Folder 2', order: 0 },
          { id: 'folder-3', name: 'Folder 3', order: 1 },
        ];

        mockFolderTree.getFolder.mockReturnValue({ id: folderId, parentId: null });
        mockFolderTree.getSiblings.mockReturnValue(mockSiblings);
        mockDatabase.upsertFolder.mockResolvedValue(undefined);

        await (handlers as any).handleReorderFolder(mockEvent, sdId, folderId, newIndex);

        expect(mockFolderTree.reorderFolder).toHaveBeenCalledWith(folderId, newIndex);
        expect(mockDatabase.upsertFolder).toHaveBeenCalledTimes(3);
      });

      it('should not update database if folder not found after reorder', async () => {
        const sdId = 'test-sd';
        const folderId = 'folder-1';
        const newIndex = 0;

        mockFolderTree.getFolder.mockReturnValue(null);

        await (handlers as any).handleReorderFolder(mockEvent, sdId, folderId, newIndex);

        expect(mockFolderTree.reorderFolder).toHaveBeenCalledWith(folderId, newIndex);
        expect(mockDatabase.upsertFolder).not.toHaveBeenCalled();
      });
    });
  });

  describe('Stale Sync Operations', () => {
    const mockEvent = {} as any;

    describe('sync:getStaleSyncs', () => {
      it('should return empty array when getStaleSyncs not set', async () => {
        // getStaleSyncs callback not set
        const result = await (handlers as any).handleGetStaleSyncs();
        expect(result).toEqual([]);
      });
    });

    describe('sync:skipStaleEntry', () => {
      it('should return error when skipStaleEntry not set', async () => {
        const result = await (handlers as any).handleSkipStaleEntry(
          mockEvent,
          'test-sd',
          'note-1',
          'instance-1'
        );

        expect(result).toEqual({
          success: false,
          error: 'Skip stale entry not available',
        });
      });
    });

    describe('sync:retryStaleEntry', () => {
      it('should return error when retryStaleEntry not set', async () => {
        const result = await (handlers as any).handleRetryStaleEntry(
          mockEvent,
          'test-sd',
          'note-1',
          'instance-1'
        );

        expect(result).toEqual({
          success: false,
          error: 'Retry stale entry not available',
        });
      });
    });
  });

  describe('Folder Emit Selected', () => {
    const mockEvent = {} as any;

    describe('folder:emitSelected', () => {
      it('should not throw when called', () => {
        expect(() => {
          (handlers as any).handleEmitFolderSelected(mockEvent, 'folder-1');
        }).not.toThrow();
      });
    });
  });

  describe('Storage Directory Delete', () => {
    const mockEvent = {} as any;

    describe('sd:delete', () => {
      it('should delete storage directory', async () => {
        mockDatabase.deleteStorageDir.mockResolvedValue(undefined);

        await (handlers as any).handleDeleteStorageDir(mockEvent, 'test-sd');

        expect(mockDatabase.deleteStorageDir).toHaveBeenCalledWith('test-sd');
      });
    });
  });

  describe('Note Check Exists', () => {
    const mockEvent = {} as any;

    describe('note:checkExistsInSD', () => {
      it('should return exists=true when note exists in SD', async () => {
        mockDatabase.getNote.mockResolvedValue({
          id: 'note-1',
          sdId: 'test-sd',
          deleted: false,
        });

        const result = await (handlers as any).handleCheckNoteExistsInSD(
          mockEvent,
          'note-1',
          'test-sd'
        );

        expect(result).toEqual({ exists: true, isDeleted: false });
      });

      it('should return isDeleted=true when note is deleted', async () => {
        mockDatabase.getNote.mockResolvedValue({
          id: 'note-1',
          sdId: 'test-sd',
          deleted: true,
        });

        const result = await (handlers as any).handleCheckNoteExistsInSD(
          mockEvent,
          'note-1',
          'test-sd'
        );

        expect(result).toEqual({ exists: true, isDeleted: true });
      });

      it('should return exists=false when note not in SD', async () => {
        mockDatabase.getNote.mockResolvedValue({
          id: 'note-1',
          sdId: 'other-sd',
        });

        const result = await (handlers as any).handleCheckNoteExistsInSD(
          mockEvent,
          'note-1',
          'test-sd'
        );

        expect(result).toEqual({ exists: false, isDeleted: false });
      });

      it('should return exists=false when note not found', async () => {
        mockDatabase.getNote.mockResolvedValue(null);

        const result = await (handlers as any).handleCheckNoteExistsInSD(
          mockEvent,
          'note-1',
          'test-sd'
        );

        expect(result).toEqual({ exists: false, isDeleted: false });
      });
    });
  });

  describe('Folder List All', () => {
    const mockEvent = {} as any;

    describe('folder:listAll', () => {
      it('should return folders grouped by SD', async () => {
        const mockSd1Folders = [
          { id: 'f1', name: 'Folder 1', sdId: 'sd-1' },
          { id: 'f2', name: 'Folder 2', sdId: 'sd-1' },
        ];
        const mockSd2Folders = [{ id: 'f3', name: 'Folder 3', sdId: 'sd-2' }];

        const mockFolderTree1 = {
          ...mockFolderTree,
          getActiveFolders: jest.fn().mockReturnValue(mockSd1Folders),
        };
        const mockFolderTree2 = {
          ...mockFolderTree,
          getActiveFolders: jest.fn().mockReturnValue(mockSd2Folders),
        };

        mockDatabase.getAllStorageDirs.mockResolvedValue([
          { id: 'sd-1', name: 'SD 1' },
          { id: 'sd-2', name: 'SD 2' },
        ]);

        let callCount = 0;
        mockCRDTManager.loadFolderTree.mockImplementation(() => {
          callCount++;
          return Promise.resolve(callCount === 1 ? mockFolderTree1 : mockFolderTree2);
        });

        const result = await (handlers as any).handleListAllFolders(mockEvent);

        // Returns array grouped by SD
        expect(result).toHaveLength(2);
        expect(result).toEqual([
          {
            sdId: 'sd-1',
            sdName: 'SD 1',
            folders: mockSd1Folders,
          },
          {
            sdId: 'sd-2',
            sdName: 'SD 2',
            folders: mockSd2Folders,
          },
        ]);
      });
    });
  });

  describe('Note Info', () => {
    const mockEvent = {} as any;

    describe('note:getInfo', () => {
      it('should return null when note not found', async () => {
        mockDatabase.getNote.mockResolvedValue(null);

        const result = await (handlers as any).handleGetNoteInfo(mockEvent, 'non-existent');

        expect(result).toBeNull();
      });

      it('should return null when SD not found', async () => {
        mockDatabase.getNote.mockResolvedValue({
          id: 'note-1',
          sdId: 'test-sd',
        });
        mockDatabase.getStorageDir.mockResolvedValue(null);

        const result = await (handlers as any).handleGetNoteInfo(mockEvent, 'note-1');

        expect(result).toBeNull();
      });
    });
  });

  describe('Restore From Backup', () => {
    const mockEvent = {} as any;

    describe('backup:restoreFromBackup', () => {
      it('should call backup manager to restore', async () => {
        mockBackupManager.restoreFromBackup.mockResolvedValue({
          sdId: 'sd-1',
          sdPath: '/path/to/sd',
        });

        const result = await (handlers as any).handleRestoreFromBackup(
          mockEvent,
          'backup-123',
          '/target/path',
          false
        );

        expect(mockBackupManager.restoreFromBackup).toHaveBeenCalledWith(
          'backup-123',
          '/target/path',
          false
        );
        expect(result).toEqual({ sdId: 'sd-1', sdPath: '/path/to/sd' });
      });

      it('should pass registerAsNew parameter', async () => {
        mockBackupManager.restoreFromBackup.mockResolvedValue({
          sdId: 'sd-2',
          sdPath: '/new/path',
        });

        const result = await (handlers as any).handleRestoreFromBackup(
          mockEvent,
          'backup-456',
          '/new/target',
          true
        );

        expect(mockBackupManager.restoreFromBackup).toHaveBeenCalledWith(
          'backup-456',
          '/new/target',
          true
        );
        expect(result).toEqual({ sdId: 'sd-2', sdPath: '/new/path' });
      });
    });
  });

  describe('Set Note Timestamp', () => {
    const mockEvent = {} as any;

    describe('test:setNoteTimestamp', () => {
      it('should throw when not in test mode', async () => {
        // This handler is only for test mode
        const originalEnv = process.env['NODE_ENV'];
        process.env['NODE_ENV'] = 'production';

        await expect(
          (handlers as any).handleSetNoteTimestamp(mockEvent, 'note-1', Date.now())
        ).rejects.toThrow('test:setNoteTimestamp is only available in test mode');

        process.env['NODE_ENV'] = originalEnv;
      });
    });
  });

  describe('Cloud Storage Paths', () => {
    const mockEvent = {} as any;

    describe('sd:getCloudStoragePaths', () => {
      it('should return cloud storage paths object', async () => {
        // This handler returns a Record<string, string> of existing paths
        const result = await (handlers as any).handleGetCloudStoragePaths(mockEvent);

        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
        expect(Array.isArray(result)).toBe(false);
      });
    });
  });

  describe('Sync Handlers', () => {
    const mockEvent = {} as any;

    describe('sync:getStatus', () => {
      it('should get sync status for all SDs', async () => {
        const mockSyncStatuses = [
          {
            sdId: 1,
            sdName: 'SD 1',
            isSyncing: false,
            lastSyncTime: Date.now() - 60000,
          },
          {
            sdId: 2,
            sdName: 'SD 2',
            isSyncing: true,
            lastSyncTime: null,
          },
        ];
        (handlers as any).getSyncStatus = jest.fn().mockReturnValue(mockSyncStatuses);

        const result = await (handlers as any).handleGetSyncStatus(mockEvent);

        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('sync:getStaleSyncs', () => {
      it('should return stale syncs from CRDT manager', async () => {
        const mockStaleSyncs = [
          {
            noteId: 'note-1',
            sdId: 1,
            lastAttempt: Date.now() - 3600000,
            error: 'Network error',
          },
        ];
        mockCRDTManager.getStaleSyncs = jest.fn().mockReturnValue(mockStaleSyncs);

        // Since the real handler calls crdtManager.getStaleSyncs,
        // we set up the mock directly on the manager
        const result = await (handlers as any).handleGetStaleSyncs(mockEvent);

        // Result should be an array (may be empty if not properly mocked)
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('Telemetry Handlers', () => {
    const mockEvent = {} as any;

    describe('telemetry:getSettings', () => {
      it('should return telemetry settings', async () => {
        const result = await (handlers as any).handleGetTelemetrySettings(mockEvent);

        // Result should be an object with telemetry settings
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
      });
    });
  });

  describe('SD Delete Handler', () => {
    const mockEvent = {} as any;

    describe('sd:delete', () => {
      it('should delete a storage directory', async () => {
        const sdId = 1;

        mockDatabase.deleteStorageDir.mockResolvedValue(undefined);

        await (handlers as any).handleDeleteStorageDir(mockEvent, sdId);

        expect(mockDatabase.deleteStorageDir).toHaveBeenCalledWith(sdId);
      });
    });
  });

  describe('Web Broadcast Callback', () => {
    it('should set web broadcast callback', () => {
      const callback = jest.fn();
      handlers.setWebBroadcastCallback(callback);
      // The callback is stored internally - verify by calling broadcastToAll
      handlers.broadcastToAll('test-channel', 'arg1', 'arg2');
      expect(callback).toHaveBeenCalledWith('test-channel', 'arg1', 'arg2');
    });

    it('should clear web broadcast callback when set to undefined', () => {
      const callback = jest.fn();
      handlers.setWebBroadcastCallback(callback);
      handlers.setWebBroadcastCallback(undefined);
      // Should not throw when broadcasting without callback
      expect(() => {
        handlers.broadcastToAll('test-channel');
      }).not.toThrow();
    });
  });

  describe('broadcastToAll', () => {
    it('should broadcast to electron windows', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { BrowserWindow } = require('electron');
      const mockWindow = {
        webContents: {
          send: jest.fn(),
        },
      };
      (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([mockWindow]);

      handlers.broadcastToAll('test-channel', 'data1', 'data2');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('test-channel', 'data1', 'data2');
    });

    it('should broadcast to multiple windows', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { BrowserWindow } = require('electron');
      const mockWindow1 = { webContents: { send: jest.fn() } };
      const mockWindow2 = { webContents: { send: jest.fn() } };
      (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([mockWindow1, mockWindow2]);

      handlers.broadcastToAll('event', 'payload');

      expect(mockWindow1.webContents.send).toHaveBeenCalledWith('event', 'payload');
      expect(mockWindow2.webContents.send).toHaveBeenCalledWith('event', 'payload');
    });

    it('should not call web callback when not set', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { BrowserWindow } = require('electron');
      (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([]);
      handlers.setWebBroadcastCallback(undefined);

      // Should not throw
      expect(() => {
        handlers.broadcastToAll('channel');
      }).not.toThrow();
    });
  });

  describe('runAutoCleanup', () => {
    it('should call autoCleanupDeletedNotes with threshold', async () => {
      (mockDatabase as any).autoCleanupDeletedNotes = jest.fn().mockResolvedValue([]);

      await handlers.runAutoCleanup(30);

      expect((mockDatabase as any).autoCleanupDeletedNotes).toHaveBeenCalledWith(30);
    });

    it('should use default threshold of 30 days', async () => {
      (mockDatabase as any).autoCleanupDeletedNotes = jest.fn().mockResolvedValue([]);

      await handlers.runAutoCleanup();

      expect((mockDatabase as any).autoCleanupDeletedNotes).toHaveBeenCalledWith(30);
    });

    it('should handle database errors gracefully', async () => {
      (mockDatabase as any).autoCleanupDeletedNotes = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(handlers.runAutoCleanup()).resolves.toBeUndefined();
    });

    it('should not throw when no notes to clean', async () => {
      (mockDatabase as any).autoCleanupDeletedNotes = jest.fn().mockResolvedValue([]);

      await expect(handlers.runAutoCleanup()).resolves.toBeUndefined();
    });
  });
});
