import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CRDTManager } from './crdt-manager.js';
import { UpdateStore } from './update-store.js';
import { SyncManager } from './sync-manager.js';
import * as Y from 'yjs';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Integration test for CRDT persistence
 * Tests the full cycle: create note -> save to CRDT -> reload from CRDT
 */
describe('CRDT Persistence Integration', () => {
  let testDir;
  let mockNoteManager;
  let mockFileSystemAPI;

  beforeEach(() => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `notecove-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    // Mock NoteManager
    mockNoteManager = {
      notes: new Map(),
      notify: () => {}
    };

    // Mock Electron File System API with real file operations
    mockFileSystemAPI = {
      exists: (filePath) => {
        return Promise.resolve(fs.existsSync(filePath));
      },
      readDir: (dirPath) => {
        try {
          const files = fs.readdirSync(dirPath);
          return Promise.resolve({ success: true, files });
        } catch (error) {
          return Promise.resolve({ success: false, error: error.message });
        }
      },
      readFile: (filePath) => {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          return Promise.resolve({ success: true, content });
        } catch (error) {
          return Promise.resolve({ success: false, error: error.message });
        }
      },
      writeFile: (filePath, content) => {
        try {
          const dir = path.dirname(filePath);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(filePath, content, 'utf8');
          return Promise.resolve({ success: true });
        } catch (error) {
          return Promise.resolve({ success: false, error: error.message });
        }
      },
      mkdir: (dirPath) => {
        try {
          fs.mkdirSync(dirPath, { recursive: true });
          return Promise.resolve({ success: true });
        } catch (error) {
          return Promise.resolve({ success: false, error: error.message });
        }
      }
    };

    // Setup global mocks
    global.window = {
      electronAPI: {
        isElectron: true,
        fileSystem: mockFileSystemAPI
      }
    };
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should persist note title and metadata through save/load cycle', async () => {
    const instanceId = 'test-instance';
    const noteId = 'test-note-123';

    // Create a note with title and metadata
    const originalNote = {
      id: noteId,
      title: 'My Test Note',
      created: '2025-10-13T20:00:00.000Z',
      modified: '2025-10-13T20:00:00.000Z',
      tags: ['test', 'important'],
      folder: 'work',
      deleted: false
    };

    // === SAVE PHASE ===
    const syncManager1 = new SyncManager(mockNoteManager, testDir, instanceId);

    // Save the note
    const saveResult = await syncManager1.saveNoteWithCRDT(originalNote);
    expect(saveResult).toBe(true);

    // Force flush any pending updates
    await syncManager1.updateStore.flush(noteId);

    // Clean up first sync manager
    await syncManager1.destroy();

    // === LOAD PHASE ===
    // Create a new SyncManager (simulating app restart)
    const syncManager2 = new SyncManager(mockNoteManager, testDir, instanceId);

    // Load the note
    const loadedNote = await syncManager2.loadNote(noteId);

    // Verify the note was loaded
    expect(loadedNote).not.toBeNull();
    expect(loadedNote.id).toBe(noteId);

    // Verify metadata persisted
    console.log('Loaded note:', loadedNote);
    expect(loadedNote.title).toBe('My Test Note');
    expect(loadedNote.created).toBe('2025-10-13T20:00:00.000Z');
    expect(loadedNote.modified).toBe('2025-10-13T20:00:00.000Z');
    expect(loadedNote.tags).toEqual(['test', 'important']);
    expect(loadedNote.folderId).toBe('work'); // Returned as 'folderId' not 'folder'
    expect(loadedNote.deleted).toBe(false);

    // Clean up second sync manager
    await syncManager2.destroy();
  });

  it('should handle multiple save/load cycles', async () => {
    const instanceId = 'test-instance';
    const noteId = 'test-note-456';

    // === First Save ===
    const syncManager1 = new SyncManager(mockNoteManager, testDir, instanceId);
    await syncManager1.saveNoteWithCRDT({
      id: noteId,
      title: 'Version 1',
      created: '2025-10-13T20:00:00.000Z',
      modified: '2025-10-13T20:00:00.000Z',
      tags: [],
      folder: 'all-notes',
      deleted: false
    });
    await syncManager1.updateStore.flush(noteId);
    await syncManager1.destroy();

    // === First Load ===
    const syncManager2 = new SyncManager(mockNoteManager, testDir, instanceId);
    const loaded1 = await syncManager2.loadNote(noteId);
    expect(loaded1.title).toBe('Version 1');

    // === Update and Save ===
    await syncManager2.saveNoteWithCRDT({
      id: noteId,
      title: 'Version 2',
      created: '2025-10-13T20:00:00.000Z',
      modified: '2025-10-13T20:01:00.000Z',
      tags: ['updated'],
      folder: 'all-notes',
      deleted: false
    });
    await syncManager2.updateStore.flush(noteId);
    await syncManager2.destroy();

    // === Second Load ===
    const syncManager3 = new SyncManager(mockNoteManager, testDir, instanceId);
    const loaded2 = await syncManager3.loadNote(noteId);
    expect(loaded2.title).toBe('Version 2');
    expect(loaded2.tags).toEqual(['updated']);
    // Note: modified timestamp is auto-updated by updateMetadata(), so we just check it exists
    expect(loaded2.modified).toBeDefined();
    expect(new Date(loaded2.modified).getTime()).toBeGreaterThan(new Date('2025-10-13T20:00:00.000Z').getTime());

    await syncManager3.destroy();
  });
});
