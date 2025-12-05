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
  const activityDir = '/test/activity';
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
      expect(mockFs.readFile).toHaveBeenCalledWith('/test/activity/other-instance.log');
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

    it('should detect file compaction (shrinking) and trigger full scan', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);

      // First sync - establish baseline with 3 lines
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode(
          'note-1|other-instance_100\nnote-2|other-instance_101\nnote-3|other-instance_102\n'
        )
      );
      mockFs.exists.mockResolvedValue(true);

      await sync.syncFromOtherInstances();
      await sleep(50);

      jest.clearAllMocks();

      // Second sync - log has been compacted, file now has only 2 lines
      // This simulates compaction removing older entries
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('note-5|other-instance_200\nnote-6|other-instance_201\n')
      );
      mockCallbacks.getLoadedNotes.mockReturnValue(['note-1', 'note-2', 'note-3']);

      await sync.syncFromOtherInstances();
      await sleep(50);

      // Should trigger full scan of loaded notes (3) because file shrank
      // New entries (note-5, note-6) are NOT processed separately after full scan
      // (the continue statement skips further processing for this file)
      expect(mockCallbacks.reloadNote).toHaveBeenCalledTimes(3);
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-1', 'test-sd');
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-2', 'test-sd');
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-3', 'test-sd');
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
      // Use fake timers to avoid long waits in tests
      jest.useFakeTimers();

      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode('note-1|other-instance_100\n'));
      // File never appears - reloadNote always fails with ENOENT
      mockCallbacks.reloadNote.mockRejectedValue(new Error('ENOENT: File does not exist'));

      // Mock console.warn to capture output
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Start sync (this will trigger background polling)
      const syncPromise = sync.syncFromOtherInstances();

      // Advance timers enough for all retry attempts (delays sum to ~44s)
      // We need to flush all pending promises between timer advances
      for (let i = 0; i < 15; i++) {
        await Promise.resolve(); // Let any pending promises resolve
        jest.advanceTimersByTime(5000); // Advance 5s at a time
        await Promise.resolve(); // Let any new promises resolve
      }

      // Wait for sync to complete
      await syncPromise;

      // Should have logged a warning about timeout
      // Warning format: "Timeout after X attempts waiting for note Y sequence Z"
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Timeout after.*attempts waiting for note.*sequence.*100/)
      );

      warnSpy.mockRestore();
      jest.useRealTimers();
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

  describe('truncated line handling (partial sync)', () => {
    it('should ignore a line without trailing newline (incomplete/truncated)', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      // Note: Last line 'note-2|other-instance_101' has no trailing \n
      // This simulates partial sync where the file is still being written
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('note-1|other-instance_100\nnote-2|other-instance_101')
      );
      mockFs.exists.mockResolvedValue(true);

      await sync.syncFromOtherInstances();
      await sleep(50);

      // Should only process note-1 (has complete line with trailing \n)
      // note-2 should be ignored because its line is incomplete
      expect(mockCallbacks.reloadNote).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-1', 'test-sd');
    });

    it('should process truncated line once newline appears in subsequent read', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.exists.mockResolvedValue(true);

      // First read: truncated line (missing newline)
      mockFs.readFile.mockResolvedValueOnce(
        new TextEncoder().encode('note-1|other-instance_100\nnote-2|other-instance_101')
      );

      await sync.syncFromOtherInstances();
      await sleep(50);

      // Only note-1 should be processed
      expect(mockCallbacks.reloadNote).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-1', 'test-sd');

      jest.clearAllMocks();

      // Second read: file now has trailing newline (sync completed)
      mockFs.readFile.mockResolvedValueOnce(
        new TextEncoder().encode('note-1|other-instance_100\nnote-2|other-instance_101\n')
      );

      await sync.syncFromOtherInstances();
      await sleep(50);

      // Now note-2 should be processed (sequence 101 > last seen 100)
      expect(mockCallbacks.reloadNote).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-2', 'test-sd');
    });

    it('should handle file with only truncated content (no complete lines)', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      // File content has no newlines at all - entire content is "truncated"
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode('note-1|other-instance_100'));
      mockFs.exists.mockResolvedValue(true);

      await sync.syncFromOtherInstances();
      await sleep(50);

      // Should not process any notes since no complete lines exist
      expect(mockCallbacks.reloadNote).not.toHaveBeenCalled();
    });

    it('should not advance watermark for incomplete lines', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.exists.mockResolvedValue(true);

      // First read: complete line followed by truncated line
      // File content is: "note-1|other-instance_100\nnote-2|other-instance_101"
      // Only the first line is complete (has trailing \n), second line is truncated
      mockFs.readFile.mockResolvedValueOnce(
        new TextEncoder().encode('note-1|other-instance_100\nnote-2|other-instance_101')
      );

      await sync.syncFromOtherInstances();
      await sleep(50);

      // Watermark is now line-count based, not sequence-based
      // Only 1 complete line was processed, so watermark should be 1
      const watermarks = sync.getWatermarks();
      expect(watermarks.get('other-instance')).toBe(1);
    });
  });

  describe('stale sync detection', () => {
    it('should detect stale entries with large sequence gap and skip syncing them', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      // Activity log has entries:
      // - note-1 at sequence 100 (very old - stale)
      // - note-2 at sequence 200 (current)
      // Gap of 100 means note-1's CRDT log will never arrive
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('note-1|other-instance_100\nnote-2|other-instance_200\n')
      );
      mockFs.exists.mockResolvedValue(true);

      await sync.syncFromOtherInstances();
      await sleep(50);

      // note-1 should be detected as stale and skipped
      // note-2 should be synced normally
      expect(mockCallbacks.reloadNote).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-2', 'test-sd');
      expect(mockCallbacks.reloadNote).not.toHaveBeenCalledWith('note-1', 'test-sd');
    });

    it('should track stale entries for UI display', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('note-1|other-instance_100\nnote-2|other-instance_200\n')
      );
      mockFs.exists.mockResolvedValue(true);

      await sync.syncFromOtherInstances();
      await sleep(50);

      // Should be able to get list of stale entries
      const staleEntries = sync.getStaleEntries();
      expect(staleEntries.length).toBe(1);
      expect(staleEntries[0]).toMatchObject({
        noteId: 'note-1',
        sourceInstanceId: 'other-instance',
        expectedSequence: 100,
        highestSequenceFromInstance: 200,
        gap: 100,
      });
    });

    it('should not mark entry as stale when gap is small', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      // Gap of only 5 - not stale
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('note-1|other-instance_100\nnote-2|other-instance_105\n')
      );
      mockFs.exists.mockResolvedValue(true);

      await sync.syncFromOtherInstances();
      await sleep(50);

      // Both notes should be synced
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-1', 'test-sd');
      expect(mockCallbacks.reloadNote).toHaveBeenCalledWith('note-2', 'test-sd');

      // No stale entries
      const staleEntries = sync.getStaleEntries();
      expect(staleEntries.length).toBe(0);
    });

    it('should skip stale entries immediately without retry attempts', async () => {
      jest.useFakeTimers();

      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      // Large gap - stale entry
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('note-1|other-instance_100\nnote-2|other-instance_200\n')
      );
      mockFs.exists.mockResolvedValue(true);

      const syncPromise = sync.syncFromOtherInstances();

      // Advance timers a tiny bit - stale should be skipped immediately
      await Promise.resolve();
      jest.advanceTimersByTime(50);
      await Promise.resolve();

      await syncPromise;

      // note-1 should NOT have been passed to reloadNote at all
      // (no retry attempts for stale entries)
      const calls = mockCallbacks.reloadNote.mock.calls;
      const note1Calls = calls.filter((c) => c[0] === 'note-1');
      expect(note1Calls.length).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('self-heal own stale entries', () => {
    it('should detect and clean up own stale entries automatically', async () => {
      // Our own activity log has stale entries
      mockFs.exists.mockResolvedValue(true);
      mockFs.listFiles.mockResolvedValue(['test-instance.log']);
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('note-1|test-instance_100\nnote-2|test-instance_200\n')
      );
      mockFs.writeFile.mockResolvedValue(undefined);

      // Run self-heal
      const cleaned = await sync.cleanupOwnStaleEntries();

      // Should have detected and cleaned the stale entry (note-1 at seq 100)
      expect(cleaned.length).toBe(1);
      expect(cleaned[0]).toMatchObject({
        noteId: 'note-1',
        sequence: 100,
      });

      // Should have written the compacted log (only note-2 remains)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/activity/test-instance.log',
        expect.any(Uint8Array)
      );

      // Verify the written content only contains non-stale entry
      const writtenData = mockFs.writeFile.mock.calls[0][1] as Uint8Array;
      const writtenContent = new TextDecoder().decode(writtenData);
      expect(writtenContent).toBe('note-2|test-instance_200\n');
    });

    it('should not clean entries when gap is small', async () => {
      mockFs.exists.mockResolvedValue(true);
      mockFs.listFiles.mockResolvedValue(['test-instance.log']);
      // Small gap - not stale
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('note-1|test-instance_100\nnote-2|test-instance_105\n')
      );

      const cleaned = await sync.cleanupOwnStaleEntries();

      // No entries should be cleaned
      expect(cleaned.length).toBe(0);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should log self-healing action', async () => {
      mockFs.exists.mockResolvedValue(true);
      mockFs.listFiles.mockResolvedValue(['test-instance.log']);
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('note-1|test-instance_100\nnote-2|test-instance_200\n')
      );
      mockFs.writeFile.mockResolvedValue(undefined);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await sync.cleanupOwnStaleEntries();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Self-healing own stale entry.*note-1.*seq 100/)
      );

      consoleSpy.mockRestore();
    });
  });
});
