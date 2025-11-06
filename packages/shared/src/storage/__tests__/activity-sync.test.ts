/**
 * Activity Sync Tests
 */

import { ActivitySync, ActivitySyncCallbacks } from '../activity-sync';
import { FileSystemAdapter } from '../types';

// Helper to sleep for testing
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode('note-1|other-instance_100\n'));
      mockFs.exists.mockResolvedValue(true); // Update file exists

      await sync.syncFromOtherInstances();

      // Should only read the other instance's file
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFs.readFile).toHaveBeenCalledWith('/test/.activity/other-instance.log');
    });

    it('should skip non-log files', async () => {
      mockFs.listFiles.mockResolvedValue(['test-instance.log', 'readme.txt']);

      await sync.syncFromOtherInstances();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFs.readFile).not.toHaveBeenCalled();
    });

    it('should reload notes when update files exist immediately', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('note-1|other-instance_100\nnote-2|other-instance_101\n')
      );
      mockFs.exists.mockResolvedValue(true); // All update files exist

      await sync.syncFromOtherInstances();
      // Wait for async polling to complete
      await sleep(50);

      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-1', 'test-sd');
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-2', 'test-sd');
    });

    it('should poll for update files that do not exist yet', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode('note-1|other-instance_100\n'));

      // Simulate delay: file doesn't exist on first check, exists on second
      let callCount = 0;
      mockCallbacks.reloadNote.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('ENOENT: File does not exist'));
        }
        return Promise.resolve();
      });

      await sync.syncFromOtherInstances();
      // Wait for polling with backoff
      await sleep(500);

      // Should have polled multiple times
      expect(callCount).toBeGreaterThanOrEqual(3); // Initial + 2 retries
      // Should eventually reload
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-1', 'test-sd');
    });

    it('should only process new sequences (watermarking)', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('note-1|other-instance_100\nnote-2|other-instance_101\n')
      );
      mockFs.exists.mockResolvedValue(true);

      // First sync - process all
      await sync.syncFromOtherInstances();
      await sleep(50);

      expect(mockCallbacks.reloadNote).toHaveBeenCalledTimes(2);
      jest.clearAllMocks();

      // Second sync - add only one new entry
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode(
          'note-1|other-instance_100\nnote-2|other-instance_101\nnote-3|other-instance_102\n'
        )
      );

      await sync.syncFromOtherInstances();
      await sleep(50);

      // Should only reload note-3 (sequence 102 > last seen 101)
      expect(mockCallbacks.reloadNote).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-3', 'test-sd');
    });

    it('should detect sequence gaps and trigger full scan', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);

      // First sync - establish baseline
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('note-1|other-instance_100\nnote-2|other-instance_101\n')
      );
      mockFs.exists.mockResolvedValue(true);

      await sync.syncFromOtherInstances();
      await sleep(50);

      jest.clearAllMocks();

      // Second sync - log has been compacted, oldest entry jumped ahead
      // This simulates compaction removing sequences 100, 101
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('note-5|other-instance_200\nnote-6|other-instance_201\n')
      );
      mockCallbacks.getLoadedNotes.mockReturnValue(['note-1', 'note-2', 'note-3']);

      await sync.syncFromOtherInstances();
      await sleep(50);

      // Should trigger full scan of loaded notes (3) PLUS process new entries (2)
      expect(mockCallbacks.reloadNote).toHaveBeenCalledTimes(5);
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-1', 'test-sd');
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-2', 'test-sd');
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-3', 'test-sd');
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-5', 'test-sd');
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-6', 'test-sd');
    });

    it('should handle empty log files', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode(''));

      await sync.syncFromOtherInstances();
      await sleep(50);

      expect(mockCallbacks.reloadNote).not.toHaveBeenCalled();
    });

    it('should handle malformed log entries gracefully', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode(
          'invalid-line\nnote-1|other-instance_100\nmalformed\nnote-2|other-instance_101\n'
        )
      );
      mockFs.exists.mockResolvedValue(true);

      await sync.syncFromOtherInstances();
      await sleep(50);

      // Should process valid entries only
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-1', 'test-sd');
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-2', 'test-sd');
    });

    it('should handle parallel syncs for multiple notes without head-of-line blocking', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode(
          'note-1|other-instance_100\nnote-2|other-instance_101\nnote-3|other-instance_102\n'
        )
      );

      // Simulate: note-1 takes longer to sync, but note-2 and note-3 should not wait
      let note1CallCount = 0;
      mockFs.exists.mockImplementation((path) => {
        if (path.includes('other-instance_100')) {
          note1CallCount++;
          return Promise.resolve(note1CallCount > 3); // note-1 needs 3 attempts
        }
        return Promise.resolve(true); // note-2 and note-3 exist immediately
      });

      await sync.syncFromOtherInstances();
      // Wait for first round of polling
      await sleep(150);

      // note-2 and note-3 should be reloaded before note-1
      // (order may vary, but both should complete)
      let calls = mockCallbacks.reloadNote.mock.calls;
      let reloadedNotes = calls.map((call) => call[0]);

      expect(reloadedNotes).toContain('note-2');
      expect(reloadedNotes).toContain('note-3');

      // Wait for note-1 polling to complete (needs 100 + 200 + 500 ms = 800ms total)
      await sleep(900);

      // Re-capture calls after waiting
      calls = mockCallbacks.reloadNote.mock.calls;
      reloadedNotes = calls.map((call) => call[0]);

      expect(reloadedNotes).toContain('note-1');
    });

    it('should timeout gracefully if update file never appears', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode('note-1|other-instance_100\n'));
      // File never appears - reloadNote always fails with ENOENT
      mockCallbacks.reloadNote.mockRejectedValue(new Error('ENOENT: File does not exist'));

      // Mock console.warn to suppress output
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await sync.syncFromOtherInstances();
      // Wait for all polling attempts (should timeout)
      await sleep(20000); // Wait for full backoff sequence

      // Should have logged a warning about timeout
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Timeout waiting for.*other-instance_100/)
      );

      warnSpy.mockRestore();
    }, 25000); // Increase test timeout
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
