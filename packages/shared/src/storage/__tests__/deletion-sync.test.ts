/**
 * Deletion Sync Tests
 */

import { DeletionSync, DeletionSyncCallbacks } from '../deletion-sync';
import { FileSystemAdapter } from '../types';

describe('DeletionSync', () => {
  let mockFs: jest.Mocked<FileSystemAdapter>;
  let mockCallbacks: jest.Mocked<DeletionSyncCallbacks>;
  let sync: DeletionSync;
  const deletionDir = '/test/deleted';
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
      processRemoteDeletion: jest.fn().mockResolvedValue(true),
      checkNoteExists: jest.fn().mockResolvedValue(true),
    } as jest.Mocked<DeletionSyncCallbacks>;

    sync = new DeletionSync(mockFs, instanceId, deletionDir, mockCallbacks);
  });

  describe('syncFromOtherInstances', () => {
    it('should skip own instance log file', async () => {
      mockFs.listFiles.mockResolvedValue(['test-instance.log', 'other-instance.log']);
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode('note-1|1700000000000\n'));

      await sync.syncFromOtherInstances();

      // Should only read the other instance's file
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
      expect(mockFs.readFile).toHaveBeenCalledWith('/test/deleted/other-instance.log');
    });

    it('should skip non-log files', async () => {
      mockFs.listFiles.mockResolvedValue(['test-instance.log', 'readme.txt']);

      await sync.syncFromOtherInstances();

      expect(mockFs.readFile).not.toHaveBeenCalled();
    });

    it('should process deletions from other instances', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('note-1|1700000000000\nnote-2|1700000001000\n')
      );

      const deleted = await sync.syncFromOtherInstances();

      expect(mockCallbacks.processRemoteDeletion).toHaveBeenCalledWith('note-1');
      expect(mockCallbacks.processRemoteDeletion).toHaveBeenCalledWith('note-2');
      expect(deleted.has('note-1')).toBe(true);
      expect(deleted.has('note-2')).toBe(true);
    });

    it('should not reprocess already-processed deletions', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('note-1|1700000000000\nnote-2|1700000001000\n')
      );

      // First sync
      await sync.syncFromOtherInstances();
      expect(mockCallbacks.processRemoteDeletion).toHaveBeenCalledTimes(2);

      jest.clearAllMocks();

      // Second sync with same content
      await sync.syncFromOtherInstances();
      expect(mockCallbacks.processRemoteDeletion).not.toHaveBeenCalled();
    });

    it('should skip notes that no longer exist locally', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode('note-1|1700000000000\n'));

      // Note already deleted locally
      (mockCallbacks.checkNoteExists as jest.Mock).mockResolvedValue(false);

      await sync.syncFromOtherInstances();

      // Should not call processRemoteDeletion since note is already gone
      expect(mockCallbacks.processRemoteDeletion).not.toHaveBeenCalled();
    });

    it('should handle empty log files', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode(''));

      const deleted = await sync.syncFromOtherInstances();

      expect(mockCallbacks.processRemoteDeletion).not.toHaveBeenCalled();
      expect(deleted.size).toBe(0);
    });

    it('should handle malformed log entries', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode(
          'invalid-line\nnote-1|1700000000000\nmalformed\nnote-2|1700000001000\n'
        )
      );

      await sync.syncFromOtherInstances();

      // Should only process valid entries
      expect(mockCallbacks.processRemoteDeletion).toHaveBeenCalledWith('note-1');
      expect(mockCallbacks.processRemoteDeletion).toHaveBeenCalledWith('note-2');
      expect(mockCallbacks.processRemoteDeletion).toHaveBeenCalledTimes(2);
    });

    it('should handle missing deletion directory', async () => {
      mockFs.listFiles.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      // Should not throw
      const deleted = await sync.syncFromOtherInstances();
      expect(deleted.size).toBe(0);
    });
  });

  describe('truncated line handling (partial sync)', () => {
    it('should ignore a line without trailing newline (incomplete/truncated)', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      // Last line 'note-2|1700000001000' has no trailing \n
      mockFs.readFile.mockResolvedValue(
        new TextEncoder().encode('note-1|1700000000000\nnote-2|1700000001000')
      );

      await sync.syncFromOtherInstances();

      // Should only process note-1 (has complete line with trailing \n)
      expect(mockCallbacks.processRemoteDeletion).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.processRemoteDeletion).toHaveBeenCalledWith('note-1');
    });

    it('should process truncated line once newline appears', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);

      // First read: truncated line
      mockFs.readFile.mockResolvedValueOnce(
        new TextEncoder().encode('note-1|1700000000000\nnote-2|1700000001000')
      );

      await sync.syncFromOtherInstances();
      expect(mockCallbacks.processRemoteDeletion).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.processRemoteDeletion).toHaveBeenCalledWith('note-1');

      jest.clearAllMocks();

      // Second read: file now has trailing newline
      mockFs.readFile.mockResolvedValueOnce(
        new TextEncoder().encode('note-1|1700000000000\nnote-2|1700000001000\n')
      );

      await sync.syncFromOtherInstances();

      // Now note-2 should be processed
      expect(mockCallbacks.processRemoteDeletion).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.processRemoteDeletion).toHaveBeenCalledWith('note-2');
    });

    it('should handle file with only truncated content (no complete lines)', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      // No newlines at all
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode('note-1|1700000000000'));

      await sync.syncFromOtherInstances();

      expect(mockCallbacks.processRemoteDeletion).not.toHaveBeenCalled();
    });
  });

  describe('resetProcessed', () => {
    it('should allow reprocessing after reset', async () => {
      mockFs.listFiles.mockResolvedValue(['other-instance.log']);
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode('note-1|1700000000000\n'));

      // First sync
      await sync.syncFromOtherInstances();
      expect(mockCallbacks.processRemoteDeletion).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      // Reset and sync again
      sync.resetProcessed();
      await sync.syncFromOtherInstances();
      expect(mockCallbacks.processRemoteDeletion).toHaveBeenCalledTimes(1);
    });
  });
});
