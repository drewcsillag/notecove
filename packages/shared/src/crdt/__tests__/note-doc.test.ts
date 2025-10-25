import { NoteDoc } from '../note-doc';
import type { NoteMetadata, UUID } from '../../types';

describe('NoteDoc', () => {
  const noteId = 'test-note-123' as UUID;
  const mockMetadata: NoteMetadata = {
    id: noteId,
    created: 1234567890,
    modified: 1234567890,
    folderId: 'folder-456' as UUID,
    deleted: false,
  };

  afterEach(() => {
    // Clean up any resources
  });

  describe('constructor', () => {
    it('should create a new NoteDoc with correct GUID', () => {
      const noteDoc = new NoteDoc(noteId);

      expect(noteDoc.doc.guid).toBe(noteId);
      expect(noteDoc.metadata).toBeDefined();
      expect(noteDoc.content).toBeDefined();

      noteDoc.destroy();
    });
  });

  describe('initializeNote', () => {
    it('should initialize note with metadata', () => {
      const noteDoc = new NoteDoc(noteId);
      noteDoc.initializeNote(mockMetadata);

      const meta = noteDoc.getMetadata();
      expect(meta.id).toBe(noteId);
      expect(meta.created).toBe(1234567890);
      expect(meta.modified).toBe(1234567890);
      expect(meta.folderId).toBe('folder-456');
      expect(meta.deleted).toBe(false);

      noteDoc.destroy();
    });

    it('should handle null folderId for orphan notes', () => {
      const noteDoc = new NoteDoc(noteId);
      const orphanMetadata: NoteMetadata = {
        ...mockMetadata,
        folderId: null,
      };
      noteDoc.initializeNote(orphanMetadata);

      const meta = noteDoc.getMetadata();
      expect(meta.folderId).toBeNull();

      noteDoc.destroy();
    });
  });

  describe('updateMetadata', () => {
    it('should update modified timestamp', () => {
      const noteDoc = new NoteDoc(noteId);
      noteDoc.initializeNote(mockMetadata);

      const newModified = Date.now();
      noteDoc.updateMetadata({ modified: newModified });

      const meta = noteDoc.getMetadata();
      expect(meta.modified).toBe(newModified);

      noteDoc.destroy();
    });

    it('should update folderId when moving note', () => {
      const noteDoc = new NoteDoc(noteId);
      noteDoc.initializeNote(mockMetadata);

      const newFolderId = 'folder-789' as UUID;
      noteDoc.updateMetadata({ folderId: newFolderId });

      const meta = noteDoc.getMetadata();
      expect(meta.folderId).toBe(newFolderId);

      noteDoc.destroy();
    });

    it('should update deleted flag', () => {
      const noteDoc = new NoteDoc(noteId);
      noteDoc.initializeNote(mockMetadata);

      noteDoc.updateMetadata({ deleted: true });

      const meta = noteDoc.getMetadata();
      expect(meta.deleted).toBe(true);

      noteDoc.destroy();
    });
  });

  describe('markDeleted', () => {
    it('should mark note as deleted and update modified time', () => {
      const noteDoc = new NoteDoc(noteId);
      noteDoc.initializeNote(mockMetadata);

      const beforeDelete = Date.now();
      noteDoc.markDeleted();
      const afterDelete = Date.now();

      const meta = noteDoc.getMetadata();
      expect(meta.deleted).toBe(true);
      expect(meta.modified).toBeGreaterThanOrEqual(beforeDelete);
      expect(meta.modified).toBeLessThanOrEqual(afterDelete);

      noteDoc.destroy();
    });
  });

  describe('CRDT synchronization', () => {
    it('should encode and apply updates', () => {
      const doc1 = new NoteDoc(noteId);
      doc1.initializeNote(mockMetadata);

      // Encode state from doc1
      const update = doc1.encodeStateAsUpdate();
      expect(update).toBeInstanceOf(Uint8Array);
      expect(update.length).toBeGreaterThan(0);

      // Create doc2 and apply update
      const doc2 = new NoteDoc(noteId);
      doc2.applyUpdate(update);

      // Verify doc2 has same data
      const meta2 = doc2.getMetadata();
      expect(meta2.id).toBe(noteId);
      expect(meta2.created).toBe(mockMetadata.created);
      expect(meta2.folderId).toBe(mockMetadata.folderId);

      doc1.destroy();
      doc2.destroy();
    });

    it('should merge concurrent updates correctly', () => {
      const doc1 = new NoteDoc(noteId);
      const doc2 = new NoteDoc(noteId);

      doc1.initializeNote(mockMetadata);
      const initialUpdate = doc1.encodeStateAsUpdate();
      doc2.applyUpdate(initialUpdate);

      // Make concurrent changes
      doc1.updateMetadata({ folderId: 'folder-111' as UUID });
      doc2.updateMetadata({ deleted: true });

      // Sync bidirectionally
      const update1 = doc1.encodeStateAsUpdate();
      const update2 = doc2.encodeStateAsUpdate();

      doc1.applyUpdate(update2);
      doc2.applyUpdate(update1);

      // Both should converge to same state
      const meta1 = doc1.getMetadata();
      const meta2 = doc2.getMetadata();

      expect(meta1.folderId).toBe('folder-111');
      expect(meta1.deleted).toBe(true);
      expect(meta2.folderId).toBe('folder-111');
      expect(meta2.deleted).toBe(true);

      doc1.destroy();
      doc2.destroy();
    });
  });

  describe('fromUpdate', () => {
    it('should create NoteDoc from existing update', () => {
      const doc1 = new NoteDoc(noteId);
      doc1.initializeNote(mockMetadata);
      const update = doc1.encodeStateAsUpdate();

      const doc2 = NoteDoc.fromUpdate(noteId, update);
      const meta = doc2.getMetadata();

      expect(meta.id).toBe(noteId);
      expect(meta.created).toBe(mockMetadata.created);

      doc1.destroy();
      doc2.destroy();
    });
  });
});
