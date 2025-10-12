import { describe, it, expect, beforeEach } from 'vitest';
import { FileStorage } from './file-storage.js';

describe('FileStorage', () => {
  let fileStorage;

  beforeEach(() => {
    fileStorage = new FileStorage();
  });

  describe('file path generation', () => {
    it('should use only note ID for filename', () => {
      const note = {
        id: 'test-123',
        title: 'Test Note',
        content: 'Content',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        tags: []
      };

      fileStorage.notesPath = '/test/path';
      const filePath = fileStorage.getNoteFilePath(note);

      expect(filePath).toBe('/test/path/test-123.json');
      expect(filePath).not.toContain('Test Note');
    });

    it('should generate consistent path regardless of title changes', () => {
      const note = {
        id: 'test-123',
        title: 'T',
        content: '',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        tags: []
      };

      fileStorage.notesPath = '/test/path';

      const path1 = fileStorage.getNoteFilePath(note);

      note.title = 'Te';
      const path2 = fileStorage.getNoteFilePath(note);

      note.title = 'Test';
      const path3 = fileStorage.getNoteFilePath(note);

      note.title = 'Test Note';
      const path4 = fileStorage.getNoteFilePath(note);

      // All paths should be the same
      expect(path1).toBe(path2);
      expect(path2).toBe(path3);
      expect(path3).toBe(path4);
      expect(path1).toBe('/test/path/test-123.json');
    });

    it('should handle Untitled notes', () => {
      const note = {
        id: 'test-456',
        title: '',
        content: '',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        tags: []
      };

      fileStorage.notesPath = '/test/path';
      const filePath = fileStorage.getNoteFilePath(note);

      expect(filePath).toBe('/test/path/test-456.json');
    });

    it('should return null if notesPath not set', () => {
      const note = {
        id: 'test-123',
        title: 'Test',
        content: '',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        tags: []
      };

      fileStorage.notesPath = null;
      const filePath = fileStorage.getNoteFilePath(note);

      expect(filePath).toBeNull();
    });

    it('should return null if note has no ID', () => {
      const note = {
        title: 'Test',
        content: '',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        tags: []
      };

      fileStorage.notesPath = '/test/path';
      const filePath = fileStorage.getNoteFilePath(note);

      expect(filePath).toBeNull();
    });
  });

  describe('initialization', () => {
    it('should not be initialized by default', () => {
      expect(fileStorage.initialized).toBe(false);
    });

    it('should detect electron mode', () => {
      expect(typeof fileStorage.isElectron).toBe('boolean');
    });
  });
});
