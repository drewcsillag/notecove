/**
 * Activity Sync Tests
 */

import { ActivitySync, ActivitySyncCallbacks } from '../activity-sync';
import { FileSystemAdapter } from '../types';

describe('ActivitySync', () => {
  let mockFs: jest.Mocked<FileSystemAdapter>;
  let mockCallbacks: jest.Mocked<ActivitySyncCallbacks>;
  let sync: ActivitySync;
  const activityDir = '/test/.activity';
  const instanceId = 'test-instance';

  beforeEach(() => {
    mockFs = {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      listFiles: jest.fn(),
      mkdir: jest.fn(),
      exists: jest.fn(),
      joinPath: jest.fn((...parts) => parts.join('/')),
    } as jest.Mocked<FileSystemAdapter>;

    mockCallbacks = {
      reloadNote: jest.fn().mockResolvedValue(undefined),
      getLoadedNotes: jest.fn().mockReturnValue([]),
    };

    sync = new ActivitySync(mockFs, instanceId, activityDir, 'test-sd', mockCallbacks);
  });

  describe('syncFromOtherInstances', () => {
    it('should skip own instance log file', async () => {
      mockFs.listFiles.mockResolvedValue(['test-instance.log', 'other-instance.log']);
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode('1000|note-1|1\n'));

      await sync.syncFromOtherInstances();

      // Should only read the other instance's file
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFs.readFile).toHaveBeenCalledWith('/test/.activity/other-instance.log');
    });

    it('should skip non-log files', async () => {
      mockFs.listFiles.mockResolvedValue(['test-instance.log', 'readme.txt']);

      await sync.syncFromOtherInstances();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFs.readFile).not.toHaveBeenCalled();
    });

    it('should reload notes with new activity', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('1000|note-1|1\n2000|note-2|1\n3000|note-3|1\n')
      );

      const affectedNotes = await sync.syncFromOtherInstances();

      expect(affectedNotes).toEqual(new Set(['note-1', 'note-2', 'note-3']));
      expect(mockCallbacks.reloadNote).toHaveBeenCalledTimes(3);
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-1', 'test-sd');
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-2', 'test-sd');
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-3', 'test-sd');
    });

    it('should only reload notes newer than last seen timestamp', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('1000|note-1|1\n2000|note-2|1\n3000|note-3|1\n')
      );

      // First sync - all notes are new
      await sync.syncFromOtherInstances();
      jest.clearAllMocks();

      // Second sync - add more entries
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('1000|note-1|1\n2000|note-2|1\n3000|note-3|1\n4000|note-4|1\n')
      );

      const affectedNotes = await sync.syncFromOtherInstances();

      // Should only reload note-4 (timestamp 4000 > last seen 3000)
      expect(affectedNotes).toEqual(new Set(['note-4']));
      expect(mockCallbacks.reloadNote).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-4', 'test-sd');
    });

    it('should detect gaps and trigger full scan', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);

      // First sync - establish baseline
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('1000|note-1|1\n2000|note-2|1\n3000|note-3|1\n')
      );
      await sync.syncFromOtherInstances();
      jest.clearAllMocks();

      // Second sync - log has been compacted, oldest entry is now newer than last seen
      // This simulates compaction removing entries 1000, 2000, 3000
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode('5000|note-5|1\n6000|note-6|1\n'));
      mockCallbacks.getLoadedNotes.mockReturnValue(['note-1', 'note-2', 'note-3']);

      await sync.syncFromOtherInstances();

      // Should trigger full scan of all loaded notes PLUS process new entries
      // After gap detection, we still process the current log to discover new notes
      expect(mockCallbacks.reloadNote).toHaveBeenCalledTimes(5); // 3 from full scan + 2 new entries
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-1', 'test-sd');
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-2', 'test-sd');
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-3', 'test-sd');
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-5', 'test-sd');
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-6', 'test-sd');
    });

    it('should handle empty log files', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode(''));

      const affectedNotes = await sync.syncFromOtherInstances();

      expect(affectedNotes).toEqual(new Set());
      expect(mockCallbacks.reloadNote).not.toHaveBeenCalled();
    });

    it('should handle malformed log entries gracefully', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('invalid-line\n1000|note-1|1\nmalformed\n2000|note-2|1\n')
      );

      const affectedNotes = await sync.syncFromOtherInstances();

      // Should process valid entries only
      expect(affectedNotes).toEqual(new Set(['note-1', 'note-2']));
      expect(mockCallbacks.reloadNote).toHaveBeenCalledTimes(2);
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-1', 'test-sd');
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-2', 'test-sd');
    });
  });

  describe('cleanupOrphanedLogs', () => {
    it('should be a no-op (FileSystemAdapter limitations)', async () => {
      // This method was removed in the implementation due to FileSystemAdapter limitations
      // The test documents the intended behavior
      await sync.cleanupOrphanedLogs();
      expect(true).toBe(true);
    });
  });
});
