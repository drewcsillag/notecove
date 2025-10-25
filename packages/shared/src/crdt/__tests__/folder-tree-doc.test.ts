import { FolderTreeDoc } from '../folder-tree-doc';
import type { FolderData, UUID } from '../../types';

describe('FolderTreeDoc', () => {
  const sdId = 'sd-test-123';
  const folder1: FolderData = {
    id: 'folder-1' as UUID,
    name: 'Work',
    parentId: null,
    sdId,
    order: 0,
    deleted: false,
  };
  const folder2: FolderData = {
    id: 'folder-2' as UUID,
    name: 'Personal',
    parentId: null,
    sdId,
    order: 1,
    deleted: false,
  };
  const folder3: FolderData = {
    id: 'folder-3' as UUID,
    name: 'Projects',
    parentId: 'folder-1' as UUID,
    sdId,
    order: 0,
    deleted: false,
  };

  describe('constructor', () => {
    it('should create a new FolderTreeDoc with correct GUID', () => {
      const treeDoc = new FolderTreeDoc(sdId);

      expect(treeDoc.doc.guid).toBe(`folder-tree:${sdId}`);
      expect(treeDoc.folders).toBeDefined();

      treeDoc.destroy();
    });
  });

  describe('createFolder', () => {
    it('should create a root folder', () => {
      const treeDoc = new FolderTreeDoc(sdId);
      treeDoc.createFolder(folder1);

      const retrieved = treeDoc.getFolder(folder1.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Work');
      expect(retrieved?.parentId).toBeNull();
      expect(retrieved?.order).toBe(0);

      treeDoc.destroy();
    });

    it('should create a nested folder', () => {
      const treeDoc = new FolderTreeDoc(sdId);
      treeDoc.createFolder(folder1);
      treeDoc.createFolder(folder3);

      const retrieved = treeDoc.getFolder(folder3.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Projects');
      expect(retrieved?.parentId).toBe('folder-1');

      treeDoc.destroy();
    });
  });

  describe('updateFolder', () => {
    it('should update folder name', () => {
      const treeDoc = new FolderTreeDoc(sdId);
      treeDoc.createFolder(folder1);

      treeDoc.updateFolder(folder1.id, { name: 'Work Updated' });

      const retrieved = treeDoc.getFolder(folder1.id);
      expect(retrieved?.name).toBe('Work Updated');

      treeDoc.destroy();
    });

    it('should move folder to different parent', () => {
      const treeDoc = new FolderTreeDoc(sdId);
      treeDoc.createFolder(folder1);
      treeDoc.createFolder(folder2);
      treeDoc.createFolder(folder3);

      // Move folder3 from folder1 to folder2
      treeDoc.updateFolder(folder3.id, { parentId: folder2.id });

      const retrieved = treeDoc.getFolder(folder3.id);
      expect(retrieved?.parentId).toBe(folder2.id);

      treeDoc.destroy();
    });

    it('should update folder order', () => {
      const treeDoc = new FolderTreeDoc(sdId);
      treeDoc.createFolder(folder1);

      treeDoc.updateFolder(folder1.id, { order: 5 });

      const retrieved = treeDoc.getFolder(folder1.id);
      expect(retrieved?.order).toBe(5);

      treeDoc.destroy();
    });

    it('should throw error when updating non-existent folder', () => {
      const treeDoc = new FolderTreeDoc(sdId);

      expect(() => {
        treeDoc.updateFolder('non-existent' as UUID, { name: 'Test' });
      }).toThrow('Folder non-existent not found');

      treeDoc.destroy();
    });
  });

  describe('getFolder', () => {
    it('should return null for non-existent folder', () => {
      const treeDoc = new FolderTreeDoc(sdId);

      const retrieved = treeDoc.getFolder('non-existent' as UUID);
      expect(retrieved).toBeNull();

      treeDoc.destroy();
    });
  });

  describe('getAllFolders', () => {
    it('should return empty array when no folders exist', () => {
      const treeDoc = new FolderTreeDoc(sdId);

      const folders = treeDoc.getAllFolders();
      expect(folders).toEqual([]);

      treeDoc.destroy();
    });

    it('should return all folders including deleted', () => {
      const treeDoc = new FolderTreeDoc(sdId);
      treeDoc.createFolder(folder1);
      treeDoc.createFolder(folder2);
      treeDoc.deleteFolder(folder2.id);

      const folders = treeDoc.getAllFolders();
      expect(folders).toHaveLength(2);

      treeDoc.destroy();
    });
  });

  describe('getActiveFolders', () => {
    it('should return only non-deleted folders', () => {
      const treeDoc = new FolderTreeDoc(sdId);
      treeDoc.createFolder(folder1);
      treeDoc.createFolder(folder2);
      treeDoc.deleteFolder(folder2.id);

      const folders = treeDoc.getActiveFolders();
      expect(folders).toHaveLength(1);
      expect(folders[0]?.id).toBe(folder1.id);

      treeDoc.destroy();
    });
  });

  describe('getRootFolders', () => {
    it('should return only root-level folders', () => {
      const treeDoc = new FolderTreeDoc(sdId);
      treeDoc.createFolder(folder1);
      treeDoc.createFolder(folder2);
      treeDoc.createFolder(folder3);

      const roots = treeDoc.getRootFolders();
      expect(roots).toHaveLength(2);
      expect(roots.map((f) => f.id)).toContain(folder1.id);
      expect(roots.map((f) => f.id)).toContain(folder2.id);
      expect(roots.map((f) => f.id)).not.toContain(folder3.id);

      treeDoc.destroy();
    });
  });

  describe('getChildFolders', () => {
    it('should return child folders of parent', () => {
      const treeDoc = new FolderTreeDoc(sdId);
      treeDoc.createFolder(folder1);
      treeDoc.createFolder(folder3);

      const children = treeDoc.getChildFolders(folder1.id);
      expect(children).toHaveLength(1);
      expect(children[0]?.id).toBe(folder3.id);

      treeDoc.destroy();
    });

    it('should return empty array when parent has no children', () => {
      const treeDoc = new FolderTreeDoc(sdId);
      treeDoc.createFolder(folder1);

      const children = treeDoc.getChildFolders(folder1.id);
      expect(children).toEqual([]);

      treeDoc.destroy();
    });
  });

  describe('deleteFolder', () => {
    it('should mark folder as deleted', () => {
      const treeDoc = new FolderTreeDoc(sdId);
      treeDoc.createFolder(folder1);

      treeDoc.deleteFolder(folder1.id);

      const retrieved = treeDoc.getFolder(folder1.id);
      expect(retrieved?.deleted).toBe(true);

      treeDoc.destroy();
    });
  });

  describe('CRDT synchronization', () => {
    it('should encode and apply updates', () => {
      const doc1 = new FolderTreeDoc(sdId);
      doc1.createFolder(folder1);
      doc1.createFolder(folder2);

      const update = doc1.encodeStateAsUpdate();
      expect(update).toBeInstanceOf(Uint8Array);

      const doc2 = new FolderTreeDoc(sdId);
      doc2.applyUpdate(update);

      const folders = doc2.getAllFolders();
      expect(folders).toHaveLength(2);

      doc1.destroy();
      doc2.destroy();
    });

    it('should merge concurrent folder creations', () => {
      const doc1 = new FolderTreeDoc(sdId);
      const doc2 = new FolderTreeDoc(sdId);

      // Create different folders on each instance
      doc1.createFolder(folder1);
      doc2.createFolder(folder2);

      // Sync bidirectionally
      const update1 = doc1.encodeStateAsUpdate();
      const update2 = doc2.encodeStateAsUpdate();

      doc1.applyUpdate(update2);
      doc2.applyUpdate(update1);

      // Both should have both folders
      expect(doc1.getAllFolders()).toHaveLength(2);
      expect(doc2.getAllFolders()).toHaveLength(2);

      doc1.destroy();
      doc2.destroy();
    });

    it('should handle concurrent updates to same folder', () => {
      const doc1 = new FolderTreeDoc(sdId);
      const doc2 = new FolderTreeDoc(sdId);

      // Start with same state
      doc1.createFolder(folder1);
      const initialUpdate = doc1.encodeStateAsUpdate();
      doc2.applyUpdate(initialUpdate);

      // Make different concurrent changes
      doc1.updateFolder(folder1.id, { name: 'Updated by Doc1' });
      doc2.updateFolder(folder1.id, { order: 10 });

      // Sync bidirectionally
      const update1 = doc1.encodeStateAsUpdate();
      const update2 = doc2.encodeStateAsUpdate();

      doc1.applyUpdate(update2);
      doc2.applyUpdate(update1);

      // Both should converge (last-write-wins for each field)
      const folder1State = doc1.getFolder(folder1.id);
      const folder2State = doc2.getFolder(folder1.id);

      expect(folder1State?.order).toBe(10);
      expect(folder2State?.order).toBe(10);

      doc1.destroy();
      doc2.destroy();
    });
  });

  describe('fromUpdate', () => {
    it('should create FolderTreeDoc from existing update', () => {
      const doc1 = new FolderTreeDoc(sdId);
      doc1.createFolder(folder1);
      doc1.createFolder(folder2);

      const update = doc1.encodeStateAsUpdate();
      const doc2 = FolderTreeDoc.fromUpdate(sdId, update);

      const folders = doc2.getAllFolders();
      expect(folders).toHaveLength(2);

      doc1.destroy();
      doc2.destroy();
    });
  });
});
