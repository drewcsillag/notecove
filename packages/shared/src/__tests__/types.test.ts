import type { NoteMetadata, FolderData, UserInfo, UUID } from '../types';

describe('Types', () => {
  describe('NoteMetadata', () => {
    it('should accept valid note metadata', () => {
      const note: NoteMetadata = {
        id: 'note-123' as UUID,
        created: Date.now(),
        modified: Date.now(),
        folderId: 'folder-456' as UUID,
        deleted: false,
      };

      expect(note.id).toBe('note-123');
      expect(note.deleted).toBe(false);
    });

    it('should accept null folderId for orphan notes', () => {
      const orphanNote: NoteMetadata = {
        id: 'note-789' as UUID,
        created: Date.now(),
        modified: Date.now(),
        folderId: null,
        deleted: false,
      };

      expect(orphanNote.folderId).toBeNull();
    });
  });

  describe('FolderData', () => {
    it('should accept valid folder data', () => {
      const folder: FolderData = {
        id: 'folder-123' as UUID,
        name: 'My Folder',
        parentId: null,
        sdId: 'sd-456',
        order: 0,
        deleted: false,
      };

      expect(folder.name).toBe('My Folder');
      expect(folder.parentId).toBeNull();
    });

    it('should accept nested folder with parentId', () => {
      const nestedFolder: FolderData = {
        id: 'folder-child' as UUID,
        name: 'Nested',
        parentId: 'folder-parent' as UUID,
        sdId: 'sd-456',
        order: 1,
        deleted: false,
      };

      expect(nestedFolder.parentId).toBe('folder-parent');
    });
  });

  describe('UserInfo', () => {
    it('should accept valid user info', () => {
      const user: UserInfo = {
        userId: 'user-123' as UUID,
        username: 'testuser',
        timestamp: Date.now(),
      };

      expect(user.username).toBe('testuser');
      expect(typeof user.timestamp).toBe('number');
    });
  });
});
