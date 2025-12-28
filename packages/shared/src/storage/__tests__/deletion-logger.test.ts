/**
 * Deletion Logger Tests
 */

import { DeletionLogger } from '../deletion-logger';
import { FileSystemAdapter } from '../types';

describe('DeletionLogger', () => {
  let mockFs: jest.Mocked<FileSystemAdapter>;
  let logger: DeletionLogger;
  const deletionDir = '/test/deleted';
  const profileId = 'test-profile';
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

    logger = new DeletionLogger(mockFs, deletionDir);
    logger.setIds(profileId, instanceId);
  });

  describe('initialize', () => {
    it('should create deletion directory', async () => {
      await logger.initialize();

      expect(mockFs.mkdir).toHaveBeenCalledWith(deletionDir);
    });
  });

  describe('recordDeletion', () => {
    it('should append deletion entry to log file', async () => {
      const noteId = 'note-123';

      // File doesn't exist yet
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));

      await logger.recordDeletion(noteId);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        `${deletionDir}/${profileId}_${instanceId}.log`,
        expect.any(Uint8Array)
      );

      // Verify content format: noteId|timestamp\n
      const writtenData = mockFs.writeFile.mock.calls[0]?.[1] as Uint8Array;
      const writtenText = new TextDecoder().decode(writtenData);
      expect(writtenText).toMatch(/^note-123\|\d+\n$/);
    });

    it('should append to existing log file', async () => {
      const existingContent = 'note-100|1700000000000\n';
      mockFs.readFile.mockResolvedValueOnce(new TextEncoder().encode(existingContent));

      await logger.recordDeletion('note-200');

      const writtenData = mockFs.writeFile.mock.calls[0]?.[1] as Uint8Array;
      const writtenText = new TextDecoder().decode(writtenData);

      // Should have both entries
      expect(writtenText).toContain('note-100|1700000000000\n');
      expect(writtenText).toMatch(/note-200\|\d+\n$/);
    });

    it('should include timestamp in deletion entry', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));

      const beforeTimestamp = Date.now();
      await logger.recordDeletion('note-123');
      const afterTimestamp = Date.now();

      const writtenData = mockFs.writeFile.mock.calls[0]?.[1] as Uint8Array;
      const writtenText = new TextDecoder().decode(writtenData);
      const [, timestampStr] = writtenText.trim().split('|');
      const timestamp = parseInt(timestampStr ?? '0', 10);

      expect(timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(timestamp).toBeLessThanOrEqual(afterTimestamp);
    });
  });

  describe('getLogPath', () => {
    it('should return correct log path', () => {
      expect(logger.getLogPath()).toBe(`${deletionDir}/${profileId}_${instanceId}.log`);
    });
  });

  describe('getDeletionDir', () => {
    it('should return deletion directory', () => {
      expect(logger.getDeletionDir()).toBe(deletionDir);
    });
  });
});
