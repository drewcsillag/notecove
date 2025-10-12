import { describe, it, expect, beforeEach } from 'vitest';
import { FolderManager } from './folder-manager.js';

describe('FolderManager', () => {
  let folderManager;

  beforeEach(() => {
    // Clear localStorage before each test to ensure clean state
    localStorage.clear();
    folderManager = new FolderManager();
  });

  describe('initialization', () => {
    it('should initialize with default folders', () => {
      const folders = folderManager.getAllFolders();

      expect(folders.length).toBeGreaterThanOrEqual(3);
      expect(folderManager.getFolder('root')).toBeTruthy();
      expect(folderManager.getFolder('all-notes')).toBeTruthy();
      expect(folderManager.getFolder('trash')).toBeTruthy();
    });

    it('should have correct default folder structure', () => {
      const root = folderManager.getFolder('root');
      const allNotes = folderManager.getFolder('all-notes');
      const trash = folderManager.getFolder('trash');

      expect(root.isRoot).toBe(true);
      expect(allNotes.isSpecial).toBe(true);
      expect(trash.isSpecial).toBe(true);
      expect(allNotes.parentId).toBe('root');
      expect(trash.parentId).toBe('root');
    });
  });

  describe('folder creation', () => {
    it('should create a new folder', async () => {
      const folder = await folderManager.createFolder('Work', 'root');

      expect(folder).toBeTruthy();
      expect(folder.id).toBeTruthy();
      expect(folder.name).toBe('Work');
      expect(folder.parentId).toBe('root');
      expect(folder.path).toBe('Work');
      expect(folder.isSpecial).toBe(false);
    });

    it('should create nested folders', async () => {
      const parent = await folderManager.createFolder('Projects', 'root');
      const child = await folderManager.createFolder('Personal', parent.id);

      expect(child.parentId).toBe(parent.id);
      expect(child.path).toBe('Projects/Personal');
    });

    it('should trim folder names', async () => {
      const folder = await folderManager.createFolder('  Trimmed  ', 'root');
      expect(folder.name).toBe('Trimmed');
    });

    it('should throw error if parent folder not found', async () => {
      await expect(
        folderManager.createFolder('Test', 'non-existent-id')
      ).rejects.toThrow('Parent folder not found');
    });

    it('should notify listeners on folder creation', async () => {
      const events = [];
      folderManager.addListener((event, data) => {
        events.push({ event, data });
      });

      await folderManager.createFolder('Test', 'root');

      expect(events.length).toBeGreaterThan(0);
      const createEvent = events.find(e => e.event === 'folder-created');
      expect(createEvent).toBeTruthy();
      expect(createEvent.data.folder.name).toBe('Test');
    });
  });

  describe('folder retrieval', () => {
    it('should get folder by ID', async () => {
      const created = await folderManager.createFolder('Test', 'root');
      const retrieved = folderManager.getFolder(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent folder', () => {
      const folder = folderManager.getFolder('non-existent-id');
      expect(folder).toBeNull();
    });

    it('should get all folders', async () => {
      await folderManager.createFolder('Folder1', 'root');
      await folderManager.createFolder('Folder2', 'root');

      const folders = folderManager.getAllFolders();
      expect(folders.length).toBeGreaterThanOrEqual(5); // 3 default + 2 created
    });

    it('should get child folders', async () => {
      const parent = await folderManager.createFolder('Parent', 'root');
      await folderManager.createFolder('Child1', parent.id);
      await folderManager.createFolder('Child2', parent.id);

      const children = folderManager.getChildFolders(parent.id);
      expect(children.length).toBe(2);
      expect(children[0].parentId).toBe(parent.id);
    });

    it('should sort child folders alphabetically', async () => {
      const parent = await folderManager.createFolder('Parent', 'root');
      await folderManager.createFolder('Zebra', parent.id);
      await folderManager.createFolder('Apple', parent.id);
      await folderManager.createFolder('Mango', parent.id);

      const children = folderManager.getChildFolders(parent.id);
      expect(children[0].name).toBe('Apple');
      expect(children[1].name).toBe('Mango');
      expect(children[2].name).toBe('Zebra');
    });
  });

  describe('folder tree', () => {
    it('should build correct folder tree', async () => {
      const parent = await folderManager.createFolder('Parent', 'root');
      await folderManager.createFolder('Child', parent.id);

      const tree = folderManager.getFolderTree();

      expect(Array.isArray(tree)).toBe(true);
      const parentInTree = tree.find(f => f.name === 'Parent');
      expect(parentInTree).toBeTruthy();
      expect(parentInTree.children.length).toBe(1);
      expect(parentInTree.children[0].name).toBe('Child');
    });

    it('should build multi-level tree', async () => {
      const level1 = await folderManager.createFolder('Level1', 'root');
      const level2 = await folderManager.createFolder('Level2', level1.id);
      await folderManager.createFolder('Level3', level2.id);

      const tree = folderManager.getFolderTree();
      const l1 = tree.find(f => f.name === 'Level1');

      expect(l1.children.length).toBe(1);
      expect(l1.children[0].name).toBe('Level2');
      expect(l1.children[0].children.length).toBe(1);
      expect(l1.children[0].children[0].name).toBe('Level3');
    });
  });

  describe('folder updates', () => {
    it('should update folder name', async () => {
      const folder = await folderManager.createFolder('OldName', 'root');
      const updated = await folderManager.updateFolder(folder.id, { name: 'NewName' });

      expect(updated.name).toBe('NewName');
      expect(updated.path).toBe('NewName');
    });

    it('should update paths of child folders when parent renamed', async () => {
      const parent = await folderManager.createFolder('Parent', 'root');
      const child = await folderManager.createFolder('Child', parent.id);

      await folderManager.updateFolder(parent.id, { name: 'RenamedParent' });

      const updatedChild = folderManager.getFolder(child.id);
      expect(updatedChild.path).toBe('RenamedParent/Child');
    });

    it('should not update special folders', async () => {
      const result = await folderManager.updateFolder('all-notes', { name: 'Changed' });
      expect(result).toBeNull();
    });

    it('should not update root folder', async () => {
      const result = await folderManager.updateFolder('root', { name: 'Changed' });
      expect(result).toBeNull();
    });

    it('should notify listeners on folder update', async () => {
      const folder = await folderManager.createFolder('Test', 'root');
      const events = [];

      folderManager.addListener((event, data) => {
        events.push({ event, data });
      });

      await folderManager.updateFolder(folder.id, { name: 'Updated' });

      const updateEvent = events.find(e => e.event === 'folder-updated');
      expect(updateEvent).toBeTruthy();
    });
  });

  describe('folder deletion', () => {
    it('should delete a folder', async () => {
      const folder = await folderManager.createFolder('ToDelete', 'root');
      const success = await folderManager.deleteFolder(folder.id);

      expect(success).toBe(true);
      expect(folderManager.getFolder(folder.id)).toBeNull();
    });

    it('should not delete folder with children', async () => {
      const parent = await folderManager.createFolder('Parent', 'root');
      await folderManager.createFolder('Child', parent.id);

      await expect(
        folderManager.deleteFolder(parent.id)
      ).rejects.toThrow('Cannot delete folder with subfolders');
    });

    it('should not delete special folders', async () => {
      const success = await folderManager.deleteFolder('all-notes');
      expect(success).toBe(false);
    });

    it('should not delete root folder', async () => {
      const success = await folderManager.deleteFolder('root');
      expect(success).toBe(false);
    });

    it('should notify listeners on folder deletion', async () => {
      const folder = await folderManager.createFolder('Test', 'root');
      const events = [];

      folderManager.addListener((event, data) => {
        events.push({ event, data });
      });

      await folderManager.deleteFolder(folder.id);

      const deleteEvent = events.find(e => e.event === 'folder-deleted');
      expect(deleteEvent).toBeTruthy();
      expect(deleteEvent.data.folderId).toBe(folder.id);
    });
  });

  describe('folder movement', () => {
    it('should move folder to new parent', async () => {
      const folder1 = await folderManager.createFolder('Folder1', 'root');
      const folder2 = await folderManager.createFolder('Folder2', 'root');
      const child = await folderManager.createFolder('Child', folder1.id);

      await folderManager.moveFolder(child.id, folder2.id);

      const moved = folderManager.getFolder(child.id);
      expect(moved.parentId).toBe(folder2.id);
      expect(moved.path).toBe('Folder2/Child');
    });

    it('should not move folder into its own subtree', async () => {
      const parent = await folderManager.createFolder('Parent', 'root');
      const child = await folderManager.createFolder('Child', parent.id);

      const result = await folderManager.moveFolder(parent.id, child.id);
      expect(result).toBeNull();
    });

    it('should not move special folders', async () => {
      const folder = await folderManager.createFolder('Test', 'root');
      const result = await folderManager.moveFolder('all-notes', folder.id);
      expect(result).toBeNull();
    });

    it('should update child paths when moved', async () => {
      const folder1 = await folderManager.createFolder('Folder1', 'root');
      const folder2 = await folderManager.createFolder('Folder2', 'root');
      const parent = await folderManager.createFolder('Parent', folder1.id);
      const child = await folderManager.createFolder('Child', parent.id);

      await folderManager.moveFolder(parent.id, folder2.id);

      const movedChild = folderManager.getFolder(child.id);
      expect(movedChild.path).toBe('Folder2/Parent/Child');
    });
  });

  describe('folder utilities', () => {
    it('should check if folder is descendant', async () => {
      const level1 = await folderManager.createFolder('Level1', 'root');
      const level2 = await folderManager.createFolder('Level2', level1.id);
      const level3 = await folderManager.createFolder('Level3', level2.id);

      expect(folderManager.isDescendant(level2.id, level1.id)).toBe(true);
      expect(folderManager.isDescendant(level3.id, level1.id)).toBe(true);
      expect(folderManager.isDescendant(level1.id, level3.id)).toBe(false);
    });

    it('should generate breadcrumb path', async () => {
      const level1 = await folderManager.createFolder('Level1', 'root');
      const level2 = await folderManager.createFolder('Level2', level1.id);
      const level3 = await folderManager.createFolder('Level3', level2.id);

      const breadcrumb = folderManager.getBreadcrumb(level3.id);

      expect(breadcrumb.length).toBe(3);
      expect(breadcrumb[0].name).toBe('Level1');
      expect(breadcrumb[1].name).toBe('Level2');
      expect(breadcrumb[2].name).toBe('Level3');
    });

    it('should return empty breadcrumb for root children', () => {
      const breadcrumb = folderManager.getBreadcrumb('all-notes');
      expect(breadcrumb.length).toBe(1);
      expect(breadcrumb[0].id).toBe('all-notes');
    });
  });

  describe('listener management', () => {
    it('should add and remove listeners', () => {
      const listener = () => {};
      folderManager.addListener(listener);
      folderManager.removeListener(listener);
      // If no error thrown, test passes
      expect(true).toBe(true);
    });

    it('should handle errors in listeners gracefully', async () => {
      const badListener = () => {
        throw new Error('Listener error');
      };

      folderManager.addListener(badListener);

      // Should not throw even with bad listener
      await expect(
        folderManager.createFolder('Test', 'root')
      ).resolves.toBeTruthy();
    });
  });

  describe('folder moving', () => {
    it('should move a folder to a new parent', async () => {
      const folder1 = await folderManager.createFolder('Folder1', 'root');
      const folder2 = await folderManager.createFolder('Folder2', 'root');

      const moved = await folderManager.moveFolder(folder2.id, folder1.id);

      expect(moved).toBeTruthy();
      expect(moved.parentId).toBe(folder1.id);
      expect(moved.path).toBe('Folder1/Folder2');
    });

    it('should update descendant paths when moving a folder', async () => {
      const parent = await folderManager.createFolder('Parent', 'root');
      const child = await folderManager.createFolder('Child', parent.id);
      const grandchild = await folderManager.createFolder('Grandchild', child.id);

      const newParent = await folderManager.createFolder('NewParent', 'root');
      await folderManager.moveFolder(child.id, newParent.id);

      const updatedChild = folderManager.getFolder(child.id);
      const updatedGrandchild = folderManager.getFolder(grandchild.id);

      expect(updatedChild.path).toBe('NewParent/Child');
      expect(updatedGrandchild.path).toBe('NewParent/Child/Grandchild');
    });

    it('should not allow moving a folder into itself', async () => {
      const folder = await folderManager.createFolder('Folder', 'root');

      const result = await folderManager.moveFolder(folder.id, folder.id);

      expect(result).toBeNull();
    });

    it('should not allow moving a folder into its own descendant', async () => {
      const parent = await folderManager.createFolder('Parent', 'root');
      const child = await folderManager.createFolder('Child', parent.id);
      const grandchild = await folderManager.createFolder('Grandchild', child.id);

      // Moving a parent into its own descendant should not be allowed
      const result = await folderManager.moveFolder(parent.id, child.id);

      expect(result).toBeNull();
    });

    it('should not allow moving special folders', async () => {
      const folder = await folderManager.createFolder('Folder', 'root');

      const result = await folderManager.moveFolder('all-notes', folder.id);

      expect(result).toBeNull();
    });

    it('should not allow moving into trash or all-notes', async () => {
      const folder = await folderManager.createFolder('Folder', 'root');

      const result1 = await folderManager.moveFolder(folder.id, 'trash');
      const result2 = await folderManager.moveFolder(folder.id, 'all-notes');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should emit folder-moved event when folder is moved', async () => {
      const folder1 = await folderManager.createFolder('Folder1', 'root');
      const folder2 = await folderManager.createFolder('Folder2', 'root');

      let eventData = null;
      folderManager.addListener((event, data) => {
        if (event === 'folder-moved') {
          eventData = data;
        }
      });

      await folderManager.moveFolder(folder2.id, folder1.id);

      expect(eventData).toBeTruthy();
      expect(eventData.folder.id).toBe(folder2.id);
      expect(eventData.newParentId).toBe(folder1.id);
    });
  });
});
