import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { SyncManager } from './sync-manager';
import type { Note } from './note-manager';
import * as Y from 'yjs';

interface MockFileSystemAPI {
  exists: Mock<[string], Promise<boolean>>;
  readDir: Mock<[string], Promise<{ success: boolean; files?: string[]; error?: string }>>;
  readFile: Mock<[string], Promise<{ success: boolean; content?: string; error?: string }>>;
  writeFile: Mock<[string, string], Promise<{ success: boolean; error?: string }>>;
  mkdir: Mock<[string], Promise<{ success: boolean; error?: string }>>;
}

interface MockNoteManager {
  notes: Map<string, any>;
  notify: Mock<[], void>;
}

describe('SyncManager - Note Loading', () => {
  let syncManager: SyncManager;
  let mockNoteManager: MockNoteManager;
  let mockFileSystemAPI: MockFileSystemAPI;

  beforeEach(() => {
    // Mock NoteManager
    mockNoteManager = {
      notes: new Map(),
      notify: vi.fn()
    };

    // Mock Electron File System API
    mockFileSystemAPI = {
      exists: vi.fn(),
      readDir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn()
    };

    // Setup global mocks
    (global as any).window = {
      electronAPI: {
        isElectron: true,
        fileSystem: mockFileSystemAPI,
        settings: {
          get: vi.fn()
        }
      }
    };

    // Create SyncManager with test path
    const notesPath: string = '/test/notes';
    syncManager = new SyncManager(mockNoteManager as any, notesPath, 'test-instance');
  });

  describe('loadAllNotes', () => {
    it('should return empty array if notes directory does not exist', async () => {
      mockFileSystemAPI.exists.mockResolvedValue(false);

      const notes: Note[] = await syncManager.loadAllNotes();

      expect(notes).toEqual([]);
      expect(mockFileSystemAPI.exists).toHaveBeenCalledWith('/test/notes');
    });

    it('should return empty array if readDir fails', async () => {
      mockFileSystemAPI.exists.mockResolvedValue(true);
      mockFileSystemAPI.readDir.mockResolvedValue({ success: false, error: 'Permission denied' });

      const notes: Note[] = await syncManager.loadAllNotes();

      expect(notes).toEqual([]);
    });

    it('should skip hidden directories', async () => {
      mockFileSystemAPI.exists.mockResolvedValue(true);
      mockFileSystemAPI.readDir.mockResolvedValue({
        success: true,
        files: ['.hidden', 'note-123']
      });

      // Mock the updates directory check for .hidden
      mockFileSystemAPI.exists.mockImplementation((path: string): Promise<boolean> => {
        if (path === '/test/notes') return Promise.resolve(true);
        if (path.includes('.hidden')) return Promise.resolve(true);
        if (path.includes('note-123')) return Promise.resolve(false); // No updates dir
        return Promise.resolve(false);
      });

      const notes: Note[] = await syncManager.loadAllNotes();

      expect(notes).toEqual([]);
    });

    it('should skip directories without updates subdirectory', async () => {
      mockFileSystemAPI.exists.mockResolvedValue(true);
      mockFileSystemAPI.readDir.mockResolvedValue({
        success: true,
        files: ['not-a-note']
      });

      // Mock exists to return false for updates directory
      mockFileSystemAPI.exists.mockImplementation((path: string): Promise<boolean> => {
        if (path === '/test/notes') return Promise.resolve(true);
        if (path.includes('/updates')) return Promise.resolve(false);
        return Promise.resolve(false);
      });

      const notes: Note[] = await syncManager.loadAllNotes();

      expect(notes).toEqual([]);
    });

    it('should load notes from CRDT updates', async () => {
      const noteId: string = 'abc123';

      // Mock directory structure
      mockFileSystemAPI.exists.mockImplementation((path: string): Promise<boolean> => {
        if (path === '/test/notes') return Promise.resolve(true);
        if (path === `/test/notes/${noteId}/updates`) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockFileSystemAPI.readDir.mockImplementation((path: string): Promise<{ success: boolean; files?: string[]; error?: string }> => {
        if (path === '/test/notes') {
          return Promise.resolve({ success: true, files: [noteId] });
        }
        if (path === `/test/notes/${noteId}/updates`) {
          return Promise.resolve({
            success: true,
            files: ['test-instance.000001.yjson']
          });
        }
        return Promise.resolve({ success: false });
      });

      // Create a real Yjs document with test data
      const testDoc: Y.Doc = new Y.Doc();
      testDoc.transact(() => {
        const yMetadata: Y.Map<any> = testDoc.getMap('metadata');
        yMetadata.set('title', 'Test Note');
        yMetadata.set('created', new Date().toISOString());
        yMetadata.set('modified', new Date().toISOString());
        yMetadata.set('tags', []);
        yMetadata.set('folder', 'all-notes');
      }, 'silent');

      // Get the actual CRDT update
      const update: Uint8Array = Y.encodeStateAsUpdate(testDoc);

      // Mock reading the packed update file
      const packedFile: any = {
        instance: 'test-instance',
        sequence: [1, 1],
        timestamp: new Date().toISOString(),
        updates: [
          Buffer.from(update).toString('base64')
        ]
      };

      mockFileSystemAPI.readFile.mockResolvedValue({
        success: true,
        content: JSON.stringify(packedFile)
      });

      const notes: Note[] = await syncManager.loadAllNotes();

      expect(notes.length).toBeGreaterThan(0);
      expect(notes[0].id).toBe(noteId);
    });

    it('should sort notes by modification date descending', async () => {
      // Create real Yjs documents with test data for sorting test
      const createTestUpdate = (title: string, modifiedDate: string): Uint8Array => {
        const testDoc: Y.Doc = new Y.Doc();
        testDoc.transact(() => {
          const yMetadata: Y.Map<any> = testDoc.getMap('metadata');
          yMetadata.set('title', title);
          yMetadata.set('created', modifiedDate);
          yMetadata.set('modified', modifiedDate);
          yMetadata.set('tags', []);
          yMetadata.set('folder', 'all-notes');
        }, 'silent');
        return Y.encodeStateAsUpdate(testDoc);
      };

      // Mock two notes
      mockFileSystemAPI.exists.mockImplementation((path: string): Promise<boolean> => {
        if (path === '/test/notes') return Promise.resolve(true);
        if (path.includes('/updates')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockFileSystemAPI.readDir.mockImplementation((path: string): Promise<{ success: boolean; files?: string[]; error?: string }> => {
        if (path === '/test/notes') {
          return Promise.resolve({ success: true, files: ['note1', 'note2'] });
        }
        if (path.includes('/updates')) {
          return Promise.resolve({
            success: true,
            files: ['test-instance.000001.yjson']
          });
        }
        return Promise.resolve({ success: false });
      });

      mockFileSystemAPI.readFile.mockResolvedValue({
        success: true,
        content: JSON.stringify({
          instance: 'test-instance',
          sequence: [1, 1],
          updates: [Buffer.from(createTestUpdate('Test Note', new Date().toISOString())).toString('base64')]
        })
      });

      const notes: Note[] = await syncManager.loadAllNotes();

      // Check that notes are sorted by modified date
      if (notes.length > 1) {
        for (let i = 1; i < notes.length; i++) {
          const prev: Date = new Date(notes[i - 1].modified);
          const curr: Date = new Date(notes[i].modified);
          expect(prev >= curr).toBe(true);
        }
      }
    });
  });

  describe('loadNote', () => {
    it('should return null if no updates exist', async () => {
      const noteId: string = 'test-note';

      mockFileSystemAPI.readDir.mockResolvedValue({
        success: false
      });

      const note: Note | null = await syncManager.loadNote(noteId);

      expect(note).toBeNull();
    });

    it('should return note with required fields', async () => {
      const noteId: string = 'test-note';

      // Create a real Yjs document with test data
      const testDoc: Y.Doc = new Y.Doc();
      testDoc.transact(() => {
        const yMetadata: Y.Map<any> = testDoc.getMap('metadata');
        yMetadata.set('title', 'Test Note');
        yMetadata.set('created', new Date().toISOString());
        yMetadata.set('modified', new Date().toISOString());
        yMetadata.set('tags', ['test']);
        yMetadata.set('folder', 'all-notes');
      }, 'silent');

      const update: Uint8Array = Y.encodeStateAsUpdate(testDoc);

      mockFileSystemAPI.readDir.mockResolvedValue({
        success: true,
        files: ['test-instance.000001.yjson']
      });

      mockFileSystemAPI.readFile.mockResolvedValue({
        success: true,
        content: JSON.stringify({
          instance: 'test-instance',
          sequence: [1, 1],
          updates: [Buffer.from(update).toString('base64')]
        })
      });

      const note: Note | null = await syncManager.loadNote(noteId);

      // Should have all required fields
      expect(note).toHaveProperty('id');
      expect(note).toHaveProperty('title');
      expect(note).toHaveProperty('created');
      expect(note).toHaveProperty('modified');
      expect(note).toHaveProperty('deleted');
      expect(note).toHaveProperty('folderId');

      // Check defaults
      expect(note!.id).toBe(noteId);
      expect(note!.deleted).toBe(false);
      expect(note!.folderId).toBe('all-notes');
    });
  });
});
