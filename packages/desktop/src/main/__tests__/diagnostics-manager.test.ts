/**
 * Unit tests for DiagnosticsManager
 */

import { rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs';
import { DiagnosticsManager } from '../diagnostics-manager';
import type { Database } from '@notecove/shared';
import * as Y from 'yjs';

interface MockAdapter {
  exec: jest.Mock;
  get: jest.Mock;
  all: jest.Mock;
}

describe('DiagnosticsManager', () => {
  let mockDatabase: jest.Mocked<Database>;
  let mockAdapter: MockAdapter;
  let diagnosticsManager: DiagnosticsManager;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary directory for file operations
    testDir = join(tmpdir(), `diagnostics-test-${Date.now()}-${Math.random()}`);
    await mkdir(testDir, { recursive: true });

    // Create a single mock adapter instance
    mockAdapter = {
      exec: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
    };

    // Mock database
    mockDatabase = {
      getAdapter: jest.fn(() => mockAdapter),
      getNote: jest.fn(),
      getStorageDir: jest.fn(),
      getTagsForNote: jest.fn(),
      createTag: jest.fn(),
      addTagToNote: jest.fn(),
      removeTagFromNote: jest.fn(),
      getTagByName: jest.fn(),
    } as any;

    diagnosticsManager = new DiagnosticsManager(mockDatabase);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('detectDuplicateNotes', () => {
    it('should detect notes with same ID in multiple SDs', async () => {
      // Mock query result with duplicate note
      mockAdapter.all.mockResolvedValueOnce([
        {
          note_id: 'note-123',
          count: 2,
          sd_ids: '1,2',
        },
      ]);

      // Mock SD info for first instance
      mockAdapter.get
        .mockResolvedValueOnce({
          id: 1,
          name: 'SD 1',
          path: join(testDir, 'sd1'),
        })
        .mockResolvedValueOnce({
          title: 'Test Note',
          modified_at: new Date().toISOString(),
        });

      // Mock SD info for second instance
      mockAdapter.get
        .mockResolvedValueOnce({
          id: 2,
          name: 'SD 2',
          path: join(testDir, 'sd2'),
        })
        .mockResolvedValueOnce({
          title: 'Test Note',
          modified_at: new Date().toISOString(),
        });

      // Create mock CRDT files for both instances
      const sd1NotePath = join(testDir, 'sd1', 'notes', 'note-123');
      const sd2NotePath = join(testDir, 'sd2', 'notes', 'note-123');

      await mkdir(sd1NotePath, { recursive: true });
      await mkdir(sd2NotePath, { recursive: true });

      // Create simple snapshot files
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      await writeFile(join(sd1NotePath, 'snapshot.yjs'), Y.encodeStateAsUpdate(doc1));
      await writeFile(join(sd2NotePath, 'snapshot.yjs'), Y.encodeStateAsUpdate(doc2));

      const duplicates = await diagnosticsManager.detectDuplicateNotes();

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0]?.noteId).toBe('note-123');
      expect(duplicates[0]?.instances).toHaveLength(2);
      expect(duplicates[0]?.instances[0]?.sdId).toBe(1);
      expect(duplicates[0]?.instances[1]?.sdId).toBe(2);
    });

    it('should return empty array when no duplicates exist', async () => {
      mockAdapter.all.mockResolvedValueOnce([]);

      const duplicates = await diagnosticsManager.detectDuplicateNotes();

      expect(duplicates).toHaveLength(0);
    });
  });

  describe('detectOrphanedCRDTFiles', () => {
    it('should detect CRDT files without database entries', async () => {
      const sdPath = join(testDir, 'sd1');
      const notesDir = join(sdPath, 'notes');
      const orphanedNotePath = join(notesDir, 'orphaned-note');

      await mkdir(orphanedNotePath, { recursive: true });

      // Create a simple CRDT file
      const doc = new Y.Doc();
      await writeFile(join(orphanedNotePath, 'snapshot.yjs'), Y.encodeStateAsUpdate(doc));

      // Mock SD list
      mockAdapter.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'SD 1',
          path: sdPath,
        },
      ]);

      // Mock database check - note doesn't exist
      mockAdapter.get.mockResolvedValueOnce(null);

      const orphaned = await diagnosticsManager.detectOrphanedCRDTFiles();

      expect(orphaned).toHaveLength(1);
      expect(orphaned[0]?.noteId).toBe('orphaned-note');
      expect(orphaned[0]?.sdId).toBe(1);
      expect(orphaned[0]?.filePath).toBe(orphanedNotePath);
    });

    it('should skip notes that exist in database', async () => {
      const sdPath = join(testDir, 'sd1');
      const notesDir = join(sdPath, 'notes');
      const validNotePath = join(notesDir, 'valid-note');

      await mkdir(validNotePath, { recursive: true });

      const doc = new Y.Doc();
      await writeFile(join(validNotePath, 'snapshot.yjs'), Y.encodeStateAsUpdate(doc));

      mockAdapter.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'SD 1',
          path: sdPath,
        },
      ]);

      // Note exists in database
      mockAdapter.get.mockResolvedValueOnce({ 1: 1 });

      const orphaned = await diagnosticsManager.detectOrphanedCRDTFiles();

      expect(orphaned).toHaveLength(0);
    });
  });

  describe('detectMissingCRDTFiles', () => {
    it('should detect database entries without CRDT files', async () => {
      const sdPath = join(testDir, 'sd1');

      // Mock notes query
      mockAdapter.all.mockResolvedValueOnce([
        {
          note_id: 'missing-note',
          title: 'Missing Note',
          modified_at: new Date().toISOString(),
          sd_id: 1,
          sd_name: 'SD 1',
          sd_path: sdPath,
        },
      ]);

      const missing = await diagnosticsManager.detectMissingCRDTFiles();

      expect(missing).toHaveLength(1);
      expect(missing[0]?.noteId).toBe('missing-note');
      expect(missing[0]?.noteTitle).toBe('Missing Note');
      expect(missing[0]?.sdId).toBe(1);
    });

    it('should return empty array when all notes have CRDT files', async () => {
      const sdPath = join(testDir, 'sd1');
      const notePath = join(sdPath, 'notes', 'valid-note');

      await mkdir(notePath, { recursive: true });

      mockAdapter.all.mockResolvedValueOnce([
        {
          note_id: 'valid-note',
          title: 'Valid Note',
          modified_at: new Date().toISOString(),
          sd_id: 1,
          sd_name: 'SD 1',
          sd_path: sdPath,
        },
      ]);

      const missing = await diagnosticsManager.detectMissingCRDTFiles();

      expect(missing).toHaveLength(0);
    });
  });

  describe('detectStaleMigrationLocks', () => {
    it('should detect migration locks older than 1 hour', async () => {
      const sdPath = join(testDir, 'sd1');
      const lockPath = join(sdPath, '.migration-lock');

      await mkdir(sdPath, { recursive: true });
      await writeFile(lockPath, '');

      // Set file time to 2 hours ago
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      fs.utimesSync(lockPath, twoHoursAgo, twoHoursAgo);

      mockAdapter.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'SD 1',
          path: sdPath,
        },
      ]);

      const stale = await diagnosticsManager.detectStaleMigrationLocks();

      expect(stale).toHaveLength(1);
      expect(stale[0]?.sdId).toBe(1);
      expect(stale[0]?.lockPath).toBe(lockPath);
      expect(stale[0]?.ageMinutes).toBeGreaterThan(60);
    });

    it('should not detect recent migration locks', async () => {
      const sdPath = join(testDir, 'sd1');
      const lockPath = join(sdPath, '.migration-lock');

      await mkdir(sdPath, { recursive: true });
      await writeFile(lockPath, '');

      mockAdapter.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'SD 1',
          path: sdPath,
        },
      ]);

      const stale = await diagnosticsManager.detectStaleMigrationLocks();

      expect(stale).toHaveLength(0);
    });
  });

  describe('detectOrphanedActivityLogs', () => {
    it('should detect activity logs for instances not seen in 30+ days', async () => {
      const sdPath = join(testDir, 'sd1');
      const activityDir = join(sdPath, 'activity');
      const logPath = join(activityDir, 'old-instance.log');

      await mkdir(activityDir, { recursive: true });

      // Create log with timestamp from 31 days ago
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
      await writeFile(logPath, `${thirtyOneDaysAgo}|event|data\n`);

      mockAdapter.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'SD 1',
          path: sdPath,
        },
      ]);

      const orphaned = await diagnosticsManager.detectOrphanedActivityLogs();

      expect(orphaned).toHaveLength(1);
      expect(orphaned[0]?.instanceId).toBe('old-instance');
      expect(orphaned[0]?.sdId).toBe(1);
      expect(orphaned[0]?.daysSinceLastSeen).toBeGreaterThan(30);
    });

    it('should not detect recent activity logs', async () => {
      const sdPath = join(testDir, 'sd1');
      const activityDir = join(sdPath, 'activity');
      const logPath = join(activityDir, 'recent-instance.log');

      await mkdir(activityDir, { recursive: true });

      // Create log with recent timestamp
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      await writeFile(logPath, `${yesterday}|event|data\n`);

      mockAdapter.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'SD 1',
          path: sdPath,
        },
      ]);

      const orphaned = await diagnosticsManager.detectOrphanedActivityLogs();

      expect(orphaned).toHaveLength(0);
    });
  });

  describe('Action methods', () => {
    describe('removeStaleMigrationLock', () => {
      it('should remove migration lock file', async () => {
        const sdPath = join(testDir, 'sd1');
        const lockPath = join(sdPath, '.migration-lock');

        await mkdir(sdPath, { recursive: true });
        await writeFile(lockPath, '');

        mockAdapter.get.mockResolvedValueOnce({ path: sdPath });

        await diagnosticsManager.removeStaleMigrationLock(1);

        expect(fs.existsSync(lockPath)).toBe(false);
      });
    });

    describe('cleanupOrphanedActivityLog', () => {
      it('should remove orphaned activity log', async () => {
        const sdPath = join(testDir, 'sd1');
        const activityDir = join(sdPath, 'activity');
        const logPath = join(activityDir, 'old-instance.log');

        await mkdir(activityDir, { recursive: true });
        await writeFile(logPath, 'test');

        mockAdapter.get.mockResolvedValueOnce({ path: sdPath });

        await diagnosticsManager.cleanupOrphanedActivityLog(1, 'old-instance');

        expect(fs.existsSync(logPath)).toBe(false);
      });
    });

    describe('importOrphanedCRDT', () => {
      it('should import orphaned CRDT to database', async () => {
        const sdPath = join(testDir, 'sd1');
        const notePath = join(sdPath, 'notes', 'orphaned-note');

        await mkdir(notePath, { recursive: true });

        const doc = new Y.Doc();
        await writeFile(join(notePath, 'snapshot.yjs'), Y.encodeStateAsUpdate(doc));

        mockAdapter.get.mockResolvedValueOnce({ path: sdPath });

        await diagnosticsManager.importOrphanedCRDT('orphaned-note', 1);

        expect(mockAdapter.exec).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO notes'),
          expect.arrayContaining(['orphaned-note', 1])
        );
      });
    });

    describe('deleteMissingCRDTEntry', () => {
      it('should delete database entry for missing CRDT', async () => {
        await diagnosticsManager.deleteMissingCRDTEntry('missing-note', 1);

        expect(mockAdapter.exec).toHaveBeenCalledWith(
          'DELETE FROM notes WHERE note_id = ? AND sd_id = ?',
          ['missing-note', 1]
        );
      });
    });

    describe('deleteDuplicateNote', () => {
      it('should delete duplicate note from database and filesystem', async () => {
        const sdPath = join(testDir, 'sd1');
        const notePath = join(sdPath, 'notes', 'duplicate-note');

        await mkdir(notePath, { recursive: true });
        await writeFile(join(notePath, 'snapshot.yjs'), 'test');

        mockAdapter.get.mockResolvedValueOnce({ path: sdPath });

        await diagnosticsManager.deleteDuplicateNote('duplicate-note', 1);

        expect(mockAdapter.exec).toHaveBeenCalledWith(
          'DELETE FROM notes WHERE note_id = ? AND sd_id = ?',
          ['duplicate-note', 1]
        );
        expect(fs.existsSync(notePath)).toBe(false);
      });
    });
  });
});
