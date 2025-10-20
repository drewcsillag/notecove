import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncDirectoryManager } from './sync-directory-manager';

// Mock window.electronAPI
(global as any).window = {
  electronAPI: {
    isElectron: true,
    fileSystem: {
      getUserDataPath: vi.fn().mockResolvedValue('/mock/user/data/path'),
      pathExists: vi.fn().mockResolvedValue(false),
      ensureDir: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue({ success: false }),
      writeFile: vi.fn().mockResolvedValue(undefined)
    },
    settings: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined)
    }
  }
};

describe('SyncDirectoryManager', () => {
  let syncDirManager: SyncDirectoryManager;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Reset window.electronAPI mocks
    (window.electronAPI!.fileSystem.readFile as any).mockResolvedValue({ success: false });
    (window.electronAPI!.fileSystem.writeFile as any).mockResolvedValue(undefined);
    (window.electronAPI!.fileSystem.getUserDataPath as any).mockResolvedValue('/mock/user/data/path');
    (window.electronAPI!.settings.get as any).mockResolvedValue(null);

    syncDirManager = new SyncDirectoryManager();
  });

  describe('initialization', () => {
    it('should initialize with default sync directory', async () => {
      // Mock that no sync directories exist yet
      (window.electronAPI!.fileSystem.readFile as any).mockResolvedValue({ success: false });

      await syncDirManager.initialize();

      const syncDirs = syncDirManager.getAllSyncDirectories();

      // Should have created default sync directory
      expect(syncDirs.length).toBe(1);
      expect(syncDirs[0].name).toBe('My Notes');
      expect(syncDirs[0].id).toBeTruthy();
    });

    it('should load existing sync directories from storage', async () => {
      const existingConfig = {
        directories: [
          {
            id: 'sync-123',
            name: 'Work Notes',
            path: '/path/to/work',
            created: '2024-01-01T00:00:00.000Z',
            lastAccessed: '2024-01-01T00:00:00.000Z',
            isExpanded: true,
            order: 0
          },
          {
            id: 'sync-456',
            name: 'Personal Notes',
            path: '/path/to/personal',
            created: '2024-01-01T00:00:00.000Z',
            lastAccessed: '2024-01-01T00:00:00.000Z',
            isExpanded: true,
            order: 1
          }
        ]
      };

      const configContent = JSON.stringify(existingConfig);
      const configBuffer = new TextEncoder().encode(configContent);

      (window.electronAPI!.fileSystem.readFile as any).mockResolvedValue({
        success: true,
        content: configBuffer
      });

      await syncDirManager.initialize();

      const syncDirs = syncDirManager.getAllSyncDirectories();

      expect(syncDirs.length).toBe(2);
      expect(syncDirs.find(d => d.id === 'sync-123')).toBeTruthy();
      expect(syncDirs.find(d => d.id === 'sync-456')).toBeTruthy();
    });
  });

  describe('adding sync directories', () => {
    it('should add a new sync directory', async () => {
      await syncDirManager.initialize();

      const newDir = await syncDirManager.addSyncDirectory(
        'Projects',
        '/path/to/projects'
      );

      expect(newDir).toBeTruthy();
      expect(newDir.id).toBeTruthy();
      expect(newDir.name).toBe('Projects');
      expect(newDir.path).toBe('/path/to/projects');

      const allDirs = syncDirManager.getAllSyncDirectories();
      expect(allDirs.length).toBe(2); // default + new one
      expect(allDirs.find(d => d.id === newDir.id)).toBeTruthy();
    });

    it('should generate unique IDs for each sync directory', async () => {
      await syncDirManager.initialize();

      const dir1 = await syncDirManager.addSyncDirectory('Dir1', '/path/1');
      const dir2 = await syncDirManager.addSyncDirectory('Dir2', '/path/2');
      const dir3 = await syncDirManager.addSyncDirectory('Dir3', '/path/3');

      expect(dir1.id).not.toBe(dir2.id);
      expect(dir2.id).not.toBe(dir3.id);
      expect(dir1.id).not.toBe(dir3.id);
    });
  });

  describe('removing sync directories', () => {
    it('should remove a sync directory by ID', async () => {
      await syncDirManager.initialize();

      const newDir = await syncDirManager.addSyncDirectory('Temp', '/path/temp');

      const beforeRemove = syncDirManager.getAllSyncDirectories();
      expect(beforeRemove.find(d => d.id === newDir.id)).toBeTruthy();

      await syncDirManager.removeSyncDirectory(newDir.id);

      const afterRemove = syncDirManager.getAllSyncDirectories();
      expect(afterRemove.find(d => d.id === newDir.id)).toBeFalsy();
    });

    it('should not remove the last sync directory', async () => {
      await syncDirManager.initialize();

      const allDirs = syncDirManager.getAllSyncDirectories();
      expect(allDirs.length).toBe(1);

      // Try to remove the only directory
      await expect(
        syncDirManager.removeSyncDirectory(allDirs[0].id)
      ).rejects.toThrow();

      // Should still have the directory
      const afterAttempt = syncDirManager.getAllSyncDirectories();
      expect(afterAttempt.length).toBe(1);
    });
  });

  describe('sync directory retrieval', () => {
    it('should get sync directory by ID', async () => {
      await syncDirManager.initialize();

      const newDir = await syncDirManager.addSyncDirectory('Test', '/path/test');

      const retrieved = syncDirManager.getSyncDirectory(newDir.id);

      expect(retrieved).toBeTruthy();
      expect(retrieved!.id).toBe(newDir.id);
      expect(retrieved!.name).toBe('Test');
    });

    it('should return null for non-existent ID', async () => {
      await syncDirManager.initialize();

      const retrieved = syncDirManager.getSyncDirectory('non-existent-id');

      expect(retrieved).toBeNull();
    });

    it('should get all sync directories', async () => {
      await syncDirManager.initialize();

      await syncDirManager.addSyncDirectory('Dir1', '/path/1');
      await syncDirManager.addSyncDirectory('Dir2', '/path/2');

      const allDirs = syncDirManager.getAllSyncDirectories();

      expect(allDirs.length).toBe(3); // default + 2 added
      expect(allDirs.every(d => d.id && d.name && d.path)).toBe(true);
    });
  });

  describe('event listeners', () => {
    it('should notify listeners when sync directory is added', async () => {
      await syncDirManager.initialize();

      const listener = vi.fn();
      syncDirManager.addListener(listener);

      await syncDirManager.addSyncDirectory('New Dir', '/path/new');

      expect(listener).toHaveBeenCalledWith(
        'sync-directory-added',
        expect.objectContaining({
          syncDirectory: expect.objectContaining({
            name: 'New Dir',
            path: '/path/new'
          })
        })
      );
    });

    it('should notify listeners when sync directory is removed', async () => {
      await syncDirManager.initialize();

      const newDir = await syncDirManager.addSyncDirectory('Temp', '/path/temp');

      const listener = vi.fn();
      syncDirManager.addListener(listener);

      await syncDirManager.removeSyncDirectory(newDir.id);

      expect(listener).toHaveBeenCalledWith(
        'sync-directory-removed',
        expect.objectContaining({
          syncDirectoryId: newDir.id
        })
      );
    });

    it('should be able to remove listeners', async () => {
      await syncDirManager.initialize();

      const listener = vi.fn();
      syncDirManager.addListener(listener);
      syncDirManager.removeListener(listener);

      await syncDirManager.addSyncDirectory('Test', '/path/test');

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
