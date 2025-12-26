/**
 * Note Edit Handlers Tests
 *
 * Tests for note editing operations (duplicate, togglePin, move, moveToSD, updateTitle).
 */

import {
  createAllMocks,
  castMocksToReal,
  resetUuidCounter,
  clearHandlerRegistry,
  invokeHandler,
  createMockNoteDoc,
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

describe('Note Edit Handlers', () => {
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

  describe('note:togglePin', () => {
    it('should toggle pin from false to true', async () => {
      const mockEvent = {} as any;
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
      const mockNoteDoc = createMockNoteDoc({
        getMetadata: jest.fn().mockReturnValue({ pinned: false }),
      });
      mockNoteDoc.updateMetadata = jest.fn();

      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      await invokeHandler('note:togglePin', mockEvent, noteId);

      expect(mockNoteDoc.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          pinned: true,
        })
      );
      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          pinned: true,
        })
      );
    });

    it('should toggle pin from true to false', async () => {
      const mockEvent = {} as any;
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
      const mockNoteDoc = createMockNoteDoc({
        getMetadata: jest.fn().mockReturnValue({ pinned: true }),
      });
      mockNoteDoc.updateMetadata = jest.fn();

      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      await invokeHandler('note:togglePin', mockEvent, noteId);

      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          pinned: false,
        })
      );
    });
  });

  describe('note:move', () => {
    it('should move note to new folder', async () => {
      const mockEvent = {} as any;
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
      const mockNoteDoc = createMockNoteDoc();
      mockNoteDoc.updateMetadata = jest.fn();

      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      await invokeHandler('note:move', mockEvent, noteId, newFolderId);

      expect(mockNoteDoc.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          folderId: newFolderId,
        })
      );
      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          folderId: newFolderId,
        })
      );
    });

    it('should move note to root folder (null)', async () => {
      const mockEvent = {} as any;
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
      const mockNoteDoc = createMockNoteDoc();
      mockNoteDoc.updateMetadata = jest.fn();

      mocks.database.getNote.mockResolvedValue(mockNote);
      mocks.crdtManager.getNoteDoc.mockReturnValue(mockNoteDoc);

      await invokeHandler('note:move', mockEvent, noteId, null);

      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          folderId: null,
        })
      );
    });
  });

  describe('note:updateTitle', () => {
    it('should update note title', async () => {
      const mockEvent = {} as any;
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

      mocks.database.getNote.mockResolvedValue(mockNote);

      await invokeHandler('note:updateTitle', mockEvent, noteId, newTitle);

      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          title: newTitle,
        })
      );
    });

    it('should update title and contentText if provided', async () => {
      const mockEvent = {} as any;
      const noteId = 'note-123';
      const newTitle = 'Updated Title';
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

      mocks.database.getNote.mockResolvedValue(mockNote);

      await invokeHandler('note:updateTitle', mockEvent, noteId, newTitle, contentText);

      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          title: newTitle,
          contentText,
          contentPreview: 'This is the body content',
        })
      );
    });
  });

  describe('note:duplicate', () => {
    it('should duplicate a note', async () => {
      const mockEvent = {} as any;
      const originalNoteId = 'note-123';
      const mockNote = {
        id: originalNoteId,
        title: 'Original Note',
        sdId: 'test-sd',
        folderId: 'folder-123',
        deleted: false,
        pinned: false,
        contentPreview: 'Preview',
        contentText: 'Content',
        created: Date.now(),
        modified: Date.now(),
      };

      // Create a real Y.Doc for the source note (needed for Y.encodeStateAsUpdate)
      const sourceDoc = new (await import('yjs')).Doc();

      // Create a real Y.Doc for the new note
      const newDoc = new (await import('yjs')).Doc();
      const newNoteDoc = createMockNoteDoc({
        initializeNote: jest.fn(),
      });

      mocks.database.getNote.mockResolvedValue(mockNote);
      // Return source doc, then new doc when called
      mocks.crdtManager.getDocument.mockReturnValueOnce(sourceDoc).mockReturnValueOnce(newDoc);
      mocks.crdtManager.getNoteDoc.mockReturnValueOnce(newNoteDoc);

      const duplicateId = await invokeHandler('note:duplicate', mockEvent, originalNoteId);

      expect(duplicateId).toBe('00000001-0000-4000-8000-000000000000');
      expect(mocks.crdtManager.loadNote).toHaveBeenCalledWith(duplicateId, 'test-sd');
      expect(mocks.database.upsertNote).toHaveBeenCalledWith(
        expect.objectContaining({
          id: duplicateId,
          title: 'Copy of Original Note',
          sdId: 'test-sd',
          folderId: 'folder-123',
          pinned: false,
        })
      );
    });
  });

  describe('note:moveToSD - image handling', () => {
    const sourceSdId = 'source-sd';
    const targetSdId = 'target-sd';
    const noteId = 'note-with-images';
    const imageId1 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const imageId2 = 'b2c3d4e5-f678-9012-cdef-123456789012';

    beforeEach(() => {
      // Setup source and target SDs
      mocks.database.getStorageDir.mockImplementation((sdId: string) => {
        if (sdId === sourceSdId) {
          return Promise.resolve({
            id: sourceSdId,
            uuid: 'source-uuid',
            name: 'Source SD',
            path: '/test/source-sd',
            created: Date.now(),
            isActive: true,
          });
        }
        if (sdId === targetSdId) {
          return Promise.resolve({
            id: targetSdId,
            uuid: 'target-uuid',
            name: 'Target SD',
            path: '/test/target-sd',
            created: Date.now(),
            isActive: false,
          });
        }
        return Promise.resolve(null);
      });

      // Setup note in source SD
      mocks.database.getNote.mockResolvedValue({
        id: noteId,
        title: 'Note with Images',
        sdId: sourceSdId,
        folderId: null,
        deleted: false,
        pinned: false,
        contentPreview: 'Preview',
        contentText: 'Content',
        created: Date.now(),
        modified: Date.now(),
      });

      // No conflict in target SD
      mocks.database.getNotesBySd.mockResolvedValue([]);

      // Setup move manager
      mocks.noteMoveManager.initiateMove.mockResolvedValue('move-id-123');
      mocks.noteMoveManager.executeMove.mockResolvedValue({ success: true, moveId: 'move-id-123' });
    });

    it('should copy images when moving note to different SD', async () => {
      const mockEvent = {} as any;
      const fsPromises = await import('fs/promises');

      // Create a mock Y.Doc with image references (use transaction for proper Yjs behavior)
      const Y = await import('yjs');
      const mockDoc = new Y.Doc();
      mockDoc.transact(() => {
        const content = mockDoc.getXmlFragment('content');
        // Add paragraph first
        const paragraph = new Y.XmlElement('paragraph');
        content.insert(0, [paragraph]);
        // Add image nodes - insert them one at a time
        const imageNode1 = new Y.XmlElement('notecoveImage');
        imageNode1.setAttribute('imageId', imageId1);
        content.insert(1, [imageNode1]);
        const imageNode2 = new Y.XmlElement('notecoveImage');
        imageNode2.setAttribute('imageId', imageId2);
        content.insert(2, [imageNode2]);
      });

      // Mock CRDT manager to return our doc with images
      mocks.crdtManager.getDocument.mockReturnValue(mockDoc);
      mocks.crdtManager.loadNote.mockResolvedValue(mockDoc);
      mocks.crdtManager.getNoteDoc.mockReturnValue({
        content: mockDoc.getXmlFragment('content'),
        getMetadata: jest.fn().mockReturnValue(null),
      });

      // Mock image existence in source SD
      mocks.database.getImage!.mockImplementation((imgId: string) => {
        if (imgId === imageId1 || imgId === imageId2) {
          return Promise.resolve({
            id: imgId,
            sdId: sourceSdId,
            filename: `${imgId}.png`,
            mimeType: 'image/png',
            size: 1000,
            created: Date.now(),
          });
        }
        return Promise.resolve(null);
      });

      // Mock filesystem to return image files in source media directory
      (fsPromises.readdir as jest.Mock).mockResolvedValue([`${imageId1}.png`, `${imageId2}.png`]);
      (fsPromises.readFile as jest.Mock).mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      (fsPromises.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fsPromises.mkdir as jest.Mock).mockResolvedValue(undefined);

      // Call the move handler
      await invokeHandler(
        'note:moveToSD',
        mockEvent,
        noteId,
        sourceSdId,
        targetSdId,
        null, // targetFolderId
        null // conflictResolution
      );

      // Verify that image copy was attempted for both images
      expect(mocks.database.upsertImage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: imageId1,
          sdId: targetSdId,
        })
      );
      expect(mocks.database.upsertImage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: imageId2,
          sdId: targetSdId,
        })
      );
    });

    it('should fail the move if image copy fails', async () => {
      const mockEvent = {} as any;

      // Create a mock Y.Doc with image references (use transaction for proper Yjs behavior)
      const Y = await import('yjs');
      const mockDoc = new Y.Doc();
      mockDoc.transact(() => {
        const content = mockDoc.getXmlFragment('content');
        const imageNode = new Y.XmlElement('notecoveImage');
        imageNode.setAttribute('imageId', imageId1);
        content.insert(0, [imageNode]);
      });

      mocks.crdtManager.getDocument.mockReturnValue(mockDoc);
      mocks.crdtManager.loadNote.mockResolvedValue(mockDoc);
      mocks.crdtManager.getNoteDoc.mockReturnValue({
        content: mockDoc.getXmlFragment('content'),
        getMetadata: jest.fn().mockReturnValue(null),
      });

      // Mock image exists in source but copy will fail
      mocks.database.getImage!.mockResolvedValue({
        id: imageId1,
        sdId: sourceSdId,
        filename: `${imageId1}.png`,
        mimeType: 'image/png',
        size: 1000,
        created: Date.now(),
      });

      // Simulate image copy failure (file read error)
      const fsPromises = await import('fs/promises');
      (fsPromises.readdir as jest.Mock).mockResolvedValue([`${imageId1}.png`]);
      (fsPromises.readFile as jest.Mock).mockRejectedValue(new Error('ENOENT: file not found'));

      // Move should throw error due to image copy failure
      await expect(
        invokeHandler('note:moveToSD', mockEvent, noteId, sourceSdId, targetSdId, null, null)
      ).rejects.toThrow(/Failed to copy image/);

      // Note move should NOT have been initiated
      expect(mocks.noteMoveManager.initiateMove).not.toHaveBeenCalled();
    });

    it('should skip image copy if image already exists in target SD', async () => {
      const mockEvent = {} as any;

      // Create a mock Y.Doc with image references (use transaction for proper Yjs behavior)
      const Y = await import('yjs');
      const mockDoc = new Y.Doc();
      mockDoc.transact(() => {
        const content = mockDoc.getXmlFragment('content');
        const imageNode = new Y.XmlElement('notecoveImage');
        imageNode.setAttribute('imageId', imageId1);
        content.insert(0, [imageNode]);
      });

      mocks.crdtManager.getDocument.mockReturnValue(mockDoc);
      mocks.crdtManager.loadNote.mockResolvedValue(mockDoc);
      mocks.crdtManager.getNoteDoc.mockReturnValue({
        content: mockDoc.getXmlFragment('content'),
        getMetadata: jest.fn().mockReturnValue(null),
      });

      // Mock image already exists in TARGET SD
      mocks.database.getImage!.mockResolvedValue({
        id: imageId1,
        sdId: targetSdId, // Already in target!
        filename: `${imageId1}.png`,
        mimeType: 'image/png',
        size: 1000,
        created: Date.now(),
      });

      // Call the move handler
      await invokeHandler('note:moveToSD', mockEvent, noteId, sourceSdId, targetSdId, null, null);

      // Move should succeed
      expect(mocks.noteMoveManager.initiateMove).toHaveBeenCalled();
      expect(mocks.noteMoveManager.executeMove).toHaveBeenCalled();

      // Image should NOT be copied (already exists in target)
      // upsertImage should not be called for the image copy
      expect(mocks.database.upsertImage).not.toHaveBeenCalledWith(
        expect.objectContaining({
          id: imageId1,
          sdId: targetSdId,
        })
      );
    });

    it('should move note without images successfully', async () => {
      const mockEvent = {} as any;

      // Create a mock Y.Doc with NO image references (use transaction for proper Yjs behavior)
      const Y = await import('yjs');
      const mockDoc = new Y.Doc();
      mockDoc.transact(() => {
        const content = mockDoc.getXmlFragment('content');
        const paragraph = new Y.XmlElement('paragraph');
        content.insert(0, [paragraph]);
        const text = new Y.XmlText('Just text, no images');
        paragraph.insert(0, [text]);
      });

      mocks.crdtManager.getDocument.mockReturnValue(mockDoc);
      mocks.crdtManager.loadNote.mockResolvedValue(mockDoc);
      mocks.crdtManager.getNoteDoc.mockReturnValue({
        content: mockDoc.getXmlFragment('content'),
        getMetadata: jest.fn().mockReturnValue(null),
      });

      // Call the move handler
      await invokeHandler('note:moveToSD', mockEvent, noteId, sourceSdId, targetSdId, null, null);

      // Move should proceed normally
      expect(mocks.noteMoveManager.initiateMove).toHaveBeenCalled();
      expect(mocks.noteMoveManager.executeMove).toHaveBeenCalled();
    });
  });
});
