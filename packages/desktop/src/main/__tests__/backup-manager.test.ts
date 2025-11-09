/**
 * Unit tests for BackupManager
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */

import { rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs';
import { BackupManager } from '../backup-manager';
import type { Database } from '@notecove/shared';

interface MockAdapter {
  exec: jest.Mock;
  get: jest.Mock;
  all: jest.Mock;
}

describe('BackupManager', () => {
  let mockDatabase: jest.Mocked<Database>;
  let mockAdapter: MockAdapter;
  let backupManager: BackupManager;
  let testDir: string;
  let userDataPath: string;
  let backupDir: string;

  beforeEach(async () => {
    // Create temporary directories
    testDir = join(tmpdir(), `backup-test-${Date.now()}-${Math.random()}`);
    userDataPath = join(testDir, 'user-data');
    backupDir = join(userDataPath, '.backups');

    await mkdir(testDir, { recursive: true });
    await mkdir(userDataPath, { recursive: true });

    // Create a single mock adapter instance
    mockAdapter = {
      exec: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
    };

    // Mock database
    mockDatabase = {
      getAdapter: jest.fn(() => mockAdapter),
      getStorageDir: jest.fn(),
      createStorageDir: jest.fn(),
    } as any;

    backupManager = new BackupManager(mockDatabase, userDataPath);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    it('should create backup directory on initialization', () => {
      expect(fs.existsSync(backupDir)).toBe(true);
    });

    it('should use custom backup path if provided', () => {
      const customPath = join(testDir, 'custom-backups');
      const customBackupManager = new BackupManager(mockDatabase, userDataPath, customPath);

      expect(fs.existsSync(customPath)).toBe(true);
      expect(customBackupManager.getBackupDirectory()).toBe(customPath);
    });
  });

  describe('createPreOperationSnapshot', () => {
    it('should create a pre-operation snapshot for specific notes', async () => {
      const sdPath = join(testDir, 'sd1');
      const notesDir = join(sdPath, 'notes');
      const note1Path = join(notesDir, 'note-1');
      const note2Path = join(notesDir, 'note-2');
      const dbPath = join(sdPath, 'notecove.db');

      // Create mock SD structure
      await mkdir(note1Path, { recursive: true });
      await mkdir(note2Path, { recursive: true });
      await writeFile(dbPath, 'mock-db');
      await writeFile(join(note1Path, 'snapshot.yjs'), 'note1-data');
      await writeFile(join(note2Path, 'snapshot.yjs'), 'note2-data');

      mockDatabase.getStorageDir = jest.fn().mockResolvedValueOnce({
        uuid: 'sd-uuid-123',
        name: 'Test SD',
        path: sdPath,
      });

      mockAdapter.get.mockResolvedValueOnce({ count: 2 });

      const backup = await backupManager.createPreOperationSnapshot(
        '1',
        ['note-1', 'note-2'],
        'Test snapshot before risky operation'
      );

      expect(backup.type).toBe('pre-operation');
      expect(backup.isPacked).toBe(false);
      expect(backup.noteCount).toBe(2);
      expect(backup.description).toBe('Test snapshot before risky operation');
      expect(fs.existsSync(backup.backupPath)).toBe(true);

      // Verify backup contents
      const backupNotesDir = join(backup.backupPath, 'notes');
      expect(fs.existsSync(join(backupNotesDir, 'note-1', 'snapshot.yjs'))).toBe(true);
      expect(fs.existsSync(join(backupNotesDir, 'note-2', 'snapshot.yjs'))).toBe(true);
      expect(fs.existsSync(join(backup.backupPath, 'database.db'))).toBe(true);
    });

    it('should skip missing notes in snapshot', async () => {
      const sdPath = join(testDir, 'sd1');
      const notesDir = join(sdPath, 'notes');
      const note1Path = join(notesDir, 'note-1');
      const dbPath = join(sdPath, 'notecove.db');

      await mkdir(note1Path, { recursive: true });
      await writeFile(dbPath, 'mock-db');
      await writeFile(join(note1Path, 'snapshot.yjs'), 'note1-data');

      mockDatabase.getStorageDir = jest.fn().mockResolvedValueOnce({
        uuid: 'sd-uuid-123',
        name: 'Test SD',
        path: sdPath,
      });

      mockAdapter.get.mockResolvedValueOnce({ count: 2 });

      const backup = await backupManager.createPreOperationSnapshot(
        '1',
        ['note-1', 'note-missing'],
        'Snapshot with missing note'
      );

      const backupNotesDir = join(backup.backupPath, 'notes');
      expect(fs.existsSync(join(backupNotesDir, 'note-1'))).toBe(true);
      expect(fs.existsSync(join(backupNotesDir, 'note-missing'))).toBe(false);
    });
  });

  describe('createManualBackup', () => {
    it('should create a full manual backup of SD', async () => {
      const sdPath = join(testDir, 'sd1');
      const notesDir = join(sdPath, 'notes');
      const folderTreeDir = join(sdPath, 'folder-tree');
      const dbPath = join(sdPath, 'notecove.db');

      // Create mock SD structure
      await mkdir(join(notesDir, 'note-1'), { recursive: true });
      await mkdir(join(notesDir, 'note-2'), { recursive: true });
      await mkdir(folderTreeDir, { recursive: true });
      await writeFile(dbPath, 'mock-db');
      await writeFile(join(notesDir, 'note-1', 'snapshot.yjs'), 'note1-data');
      await writeFile(join(notesDir, 'note-2', 'snapshot.yjs'), 'note2-data');
      await writeFile(join(folderTreeDir, 'tree.yjs'), 'folder-data');

      mockDatabase.getStorageDir = jest.fn().mockResolvedValueOnce({
        uuid: 'sd-uuid-123',
        name: 'Test SD',
        path: sdPath,
      });

      mockAdapter.get.mockResolvedValueOnce({ count: 2 });
      mockAdapter.get.mockResolvedValueOnce({ count: 0 });

      const backup = await backupManager.createManualBackup('1', false, 'Full backup for testing');

      expect(backup.type).toBe('manual');
      expect(backup.isPacked).toBe(false);
      expect(backup.noteCount).toBe(2);
      expect(backup.description).toBe('Full backup for testing');

      // Verify all contents backed up
      expect(fs.existsSync(join(backup.backupPath, 'database.db'))).toBe(true);
      expect(fs.existsSync(join(backup.backupPath, 'notes', 'note-1', 'snapshot.yjs'))).toBe(true);
      expect(fs.existsSync(join(backup.backupPath, 'notes', 'note-2', 'snapshot.yjs'))).toBe(true);
      expect(fs.existsSync(join(backup.backupPath, 'folder-tree', 'tree.yjs'))).toBe(true);
    });

    it('should set isPacked flag when packAndSnapshot is true', async () => {
      const sdPath = join(testDir, 'sd1');
      const dbPath = join(sdPath, 'notecove.db');

      await mkdir(sdPath, { recursive: true });
      await writeFile(dbPath, 'mock-db');

      mockDatabase.getStorageDir = jest.fn().mockResolvedValueOnce({
        uuid: 'sd-uuid-123',
        name: 'Test SD',
        path: sdPath,
      });

      mockAdapter.get.mockResolvedValueOnce({ count: 0 });
      mockAdapter.get.mockResolvedValueOnce({ count: 0 });

      const backup = await backupManager.createManualBackup('1', true, 'Packed backup');

      expect(backup.isPacked).toBe(true);
    });
  });

  describe('listBackups', () => {
    it('should list all available backups sorted by timestamp', async () => {
      // Create two mock backups
      const backup1Dir = join(backupDir, 'backup-1000-aaa');
      const backup2Dir = join(backupDir, 'backup-2000-bbb');

      await mkdir(backup1Dir, { recursive: true });
      await mkdir(backup2Dir, { recursive: true });

      const metadata1 = {
        backupId: 'backup-1000-aaa',
        sdUuid: 'sd-uuid-1',
        sdName: 'SD 1',
        timestamp: 1000,
        noteCount: 5,
        folderCount: 2,
        sizeBytes: 1024,
        type: 'manual' as const,
        isPacked: false,
      };

      const metadata2 = {
        backupId: 'backup-2000-bbb',
        sdUuid: 'sd-uuid-2',
        sdName: 'SD 2',
        timestamp: 2000,
        noteCount: 10,
        folderCount: 3,
        sizeBytes: 2048,
        type: 'pre-operation' as const,
        isPacked: false,
        description: 'Test snapshot',
      };

      await writeFile(join(backup1Dir, 'metadata.json'), JSON.stringify(metadata1, null, 2));
      await writeFile(join(backup2Dir, 'metadata.json'), JSON.stringify(metadata2, null, 2));

      const backups = backupManager.listBackups();

      expect(backups).toHaveLength(2);
      // Should be sorted newest first
      expect(backups[0]?.backupId).toBe('backup-2000-bbb');
      expect(backups[1]?.backupId).toBe('backup-1000-aaa');
      expect(backups[0]?.description).toBe('Test snapshot');
    });

    it('should return empty array when no backups exist', () => {
      const backups = backupManager.listBackups();
      expect(backups).toHaveLength(0);
    });

    it('should skip directories without metadata.json', async () => {
      const invalidBackupDir = join(backupDir, 'invalid-backup');
      await mkdir(invalidBackupDir, { recursive: true });

      const backups = backupManager.listBackups();
      expect(backups).toHaveLength(0);
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore SD from backup to new location', async () => {
      const backupId = 'backup-1000-aaa';
      const backupPath = join(backupDir, backupId);
      const targetPath = join(testDir, 'restored-sd');

      // Create mock backup
      await mkdir(join(backupPath, 'notes', 'note-1'), { recursive: true });
      await mkdir(join(backupPath, 'folder-tree'), { recursive: true });
      await writeFile(join(backupPath, 'database.db'), 'mock-db');
      await writeFile(join(backupPath, 'notes', 'note-1', 'snapshot.yjs'), 'note-data');
      await writeFile(join(backupPath, 'folder-tree', 'tree.yjs'), 'folder-data');

      const metadata = {
        backupId,
        sdUuid: 'original-uuid',
        sdName: 'Original SD',
        timestamp: 1000,
        noteCount: 1,
        folderCount: 1,
        sizeBytes: 1024,
        type: 'manual' as const,
        isPacked: false,
      };

      await writeFile(join(backupPath, 'metadata.json'), JSON.stringify(metadata, null, 2));

      await mkdir(targetPath, { recursive: true });

      mockDatabase.createStorageDir = jest.fn().mockResolvedValue({
        id: '42',
        name: 'Test SD',
        path: targetPath,
        uuid: 'sd-uuid-123',
        created: Date.now(),
        isActive: true,
      });

      const result = await backupManager.restoreFromBackup(backupId, targetPath, false);

      expect(result.sdId).toBe('42');
      expect(result.sdPath).toBe(targetPath);

      // Verify files were restored
      expect(fs.existsSync(join(targetPath, 'notecove.db'))).toBe(true);
      expect(fs.existsSync(join(targetPath, 'notes', 'note-1', 'snapshot.yjs'))).toBe(true);
      expect(fs.existsSync(join(targetPath, 'folder-tree', 'tree.yjs'))).toBe(true);
      expect(fs.existsSync(join(targetPath, 'SD_ID'))).toBe(true);

      // Should restore with original UUID
      const sdId = fs.readFileSync(join(targetPath, 'SD_ID'), 'utf-8');
      expect(sdId).toBe('original-uuid');
    });

    it('should generate new UUID when registerAsNew is true', async () => {
      const backupId = 'backup-1000-aaa';
      const backupPath = join(backupDir, backupId);
      const targetPath = join(testDir, 'restored-sd');

      await mkdir(backupPath, { recursive: true });
      await writeFile(join(backupPath, 'database.db'), 'mock-db');

      const metadata = {
        backupId,
        sdUuid: 'original-uuid',
        sdName: 'Original SD',
        timestamp: 1000,
        noteCount: 0,
        folderCount: 0,
        sizeBytes: 100,
        type: 'manual' as const,
        isPacked: false,
      };

      await writeFile(join(backupPath, 'metadata.json'), JSON.stringify(metadata, null, 2));
      await mkdir(targetPath, { recursive: true });

      mockDatabase.createStorageDir = jest.fn().mockResolvedValue({
        id: '42',
        name: 'Test SD',
        path: targetPath,
        uuid: 'new-uuid',
        created: Date.now(),
        isActive: true,
      });

      await backupManager.restoreFromBackup(backupId, targetPath, true);

      const sdId = fs.readFileSync(join(targetPath, 'SD_ID'), 'utf-8');
      expect(sdId).not.toBe('original-uuid');
      expect(sdId.length).toBeGreaterThan(0);
    });

    it('should throw error if target path is not empty', async () => {
      const backupId = 'backup-1000-aaa';
      const backupPath = join(backupDir, backupId);
      const targetPath = join(testDir, 'restored-sd');

      await mkdir(backupPath, { recursive: true });
      await writeFile(join(backupPath, 'database.db'), 'mock-db');

      const metadata = {
        backupId,
        sdUuid: 'original-uuid',
        sdName: 'Original SD',
        timestamp: 1000,
        noteCount: 0,
        folderCount: 0,
        sizeBytes: 100,
        type: 'manual' as const,
        isPacked: false,
      };

      await writeFile(join(backupPath, 'metadata.json'), JSON.stringify(metadata, null, 2));

      // Create non-empty target
      await mkdir(targetPath, { recursive: true });
      await writeFile(join(targetPath, 'existing-file.txt'), 'data');

      await expect(backupManager.restoreFromBackup(backupId, targetPath, false)).rejects.toThrow(
        'not empty'
      );
    });
  });

  describe('deleteBackup', () => {
    it('should delete a backup directory', async () => {
      const backupId = 'backup-1000-aaa';
      const backupPath = join(backupDir, backupId);

      await mkdir(backupPath, { recursive: true });
      await writeFile(join(backupPath, 'metadata.json'), '{}');

      backupManager.deleteBackup(backupId);

      expect(fs.existsSync(backupPath)).toBe(false);
    });

    it('should throw error if backup does not exist', () => {
      expect(() => {
        backupManager.deleteBackup('non-existent');
      }).toThrow('not found');
    });
  });

  describe('cleanupOldSnapshots', () => {
    it('should delete pre-operation snapshots older than 7 days', async () => {
      const oldBackupId = 'backup-1000-old';
      const recentBackupId = 'backup-2000-recent';
      const manualBackupId = 'backup-1500-manual';

      const oldBackupPath = join(backupDir, oldBackupId);
      const recentBackupPath = join(backupDir, recentBackupId);
      const manualBackupPath = join(backupDir, manualBackupId);

      await mkdir(oldBackupPath, { recursive: true });
      await mkdir(recentBackupPath, { recursive: true });
      await mkdir(manualBackupPath, { recursive: true });

      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      const oneDayAgo = Date.now() - 1 * 24 * 60 * 60 * 1000;

      const oldMetadata = {
        backupId: oldBackupId,
        sdUuid: 'sd-uuid',
        sdName: 'SD',
        timestamp: eightDaysAgo,
        noteCount: 1,
        folderCount: 0,
        sizeBytes: 100,
        type: 'pre-operation' as const,
        isPacked: false,
      };

      const recentMetadata = {
        backupId: recentBackupId,
        sdUuid: 'sd-uuid',
        sdName: 'SD',
        timestamp: oneDayAgo,
        noteCount: 1,
        folderCount: 0,
        sizeBytes: 100,
        type: 'pre-operation' as const,
        isPacked: false,
      };

      const manualMetadata = {
        backupId: manualBackupId,
        sdUuid: 'sd-uuid',
        sdName: 'SD',
        timestamp: eightDaysAgo,
        noteCount: 1,
        folderCount: 0,
        sizeBytes: 100,
        type: 'manual' as const,
        isPacked: false,
      };

      await writeFile(join(oldBackupPath, 'metadata.json'), JSON.stringify(oldMetadata, null, 2));
      await writeFile(
        join(recentBackupPath, 'metadata.json'),
        JSON.stringify(recentMetadata, null, 2)
      );
      await writeFile(
        join(manualBackupPath, 'metadata.json'),
        JSON.stringify(manualMetadata, null, 2)
      );

      const deletedCount = backupManager.cleanupOldSnapshots();

      expect(deletedCount).toBe(1);
      expect(fs.existsSync(oldBackupPath)).toBe(false);
      expect(fs.existsSync(recentBackupPath)).toBe(true);
      expect(fs.existsSync(manualBackupPath)).toBe(true);
    });
  });

  describe('setBackupDirectory and getBackupDirectory', () => {
    it('should allow changing backup directory', () => {
      const customPath = join(testDir, 'custom-backups');

      backupManager.setBackupDirectory(customPath);

      expect(backupManager.getBackupDirectory()).toBe(customPath);
      expect(fs.existsSync(customPath)).toBe(true);
    });
  });
});
