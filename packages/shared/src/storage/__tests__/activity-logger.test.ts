/**
 * Activity Logger Tests
 */

import { ActivityLogger } from '../activity-logger';
import { FileSystemAdapter } from '../types';

describe('ActivityLogger', () => {
  let mockFs: jest.Mocked<FileSystemAdapter>;
  let logger: ActivityLogger;
  const activityDir = '/test/activity';

  beforeEach(() => {
    mockFs = {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      listFiles: jest.fn(),
      mkdir: jest.fn(),
      exists: jest.fn(),
      joinPath: jest.fn((...parts) => parts.join('/')),
    } as jest.Mocked<FileSystemAdapter>;

    logger = new ActivityLogger(mockFs, activityDir);
    logger.setInstanceId('test-instance');
  });

  describe('initialize', () => {
    it('should create activity directory', async () => {
      await logger.initialize();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFs.mkdir).toHaveBeenCalledWith(activityDir);
    });
  });

  describe('recordNoteActivity', () => {
    beforeEach(async () => {
      mockFs.exists.mockResolvedValue(false);
      await logger.initialize();
      jest.clearAllMocks();
    });

    it('should append new line for different note', async () => {
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode('note-1|test-instance_100\n'));

      await logger.recordNoteActivity('note-2', 101);

      const written = mockFs.writeFile.mock.calls[0]?.[1] ?? new Uint8Array();
      const text = new TextDecoder().decode(written);
      const lines = text.split('\n').filter((l) => l.length > 0);

      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('note-1|test-instance_100');
      expect(lines[1]).toBe('note-2|test-instance_101');
    });

    it('should replace last line for same note edited consecutively', async () => {
      // First edit to note-1
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode(''));
      await logger.recordNoteActivity('note-1', 100);

      // Get what was written
      const firstWrite = mockFs.writeFile.mock.calls[0]?.[1] ?? new Uint8Array();
      const firstText = new TextDecoder().decode(firstWrite);
      expect(firstText).toBe('note-1|test-instance_100\n');

      // Second edit to note-1 (consecutive) - should replace last line
      mockFs.readFile.mockResolvedValue(firstWrite);
      jest.clearAllMocks();
      await logger.recordNoteActivity('note-1', 105);

      const written = mockFs.writeFile.mock.calls[0]?.[1] ?? new Uint8Array();
      const text = new TextDecoder().decode(written);
      const lines = text.split('\n').filter((l) => l.length > 0);

      // Should have only 1 line (replaced the previous one)
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('note-1|test-instance_105');
    });

    it('should use monotonically increasing sequence numbers', async () => {
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode(''));

      // Record two entries with increasing sequences
      await logger.recordNoteActivity('note-1', 100);
      const firstWrite = mockFs.writeFile.mock.calls[0]?.[1];
      const firstText = new TextDecoder().decode(firstWrite);
      expect(firstText).toBe('note-1|test-instance_100\n');

      mockFs.readFile.mockResolvedValue(firstWrite);
      await logger.recordNoteActivity('note-2', 101);
      const secondWrite = mockFs.writeFile.mock.calls[1]?.[1];
      const secondText = new TextDecoder().decode(secondWrite);
      const lines = secondText.split('\n').filter((l) => l.length > 0);

      expect(lines[0]).toBe('note-1|test-instance_100');
      expect(lines[1]).toBe('note-2|test-instance_101');
    });
  });

  describe('compact', () => {
    beforeEach(async () => {
      mockFs.exists.mockResolvedValue(false);
      await logger.initialize();
      jest.clearAllMocks();
    });

    it('should not write if under retention limit', async () => {
      const lines =
        Array.from({ length: 500 }, (_, i) => `note-${i}|test-instance_${1000 + i}`).join('\n') +
        '\n';
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode(lines));

      await logger.compact();

      // Should not write because file is under limit
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should trim to retention limit if over', async () => {
      const lines =
        Array.from({ length: 1500 }, (_, i) => `note-${i}|test-instance_${1000 + i}`).join('\n') +
        '\n';
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode(lines));

      await logger.compact();

      const written = mockFs.writeFile.mock.calls[0]?.[1] ?? new Uint8Array();
      const text = new TextDecoder().decode(written);
      const writtenLines = text.split('\n').filter((l) => l.length > 0);

      expect(writtenLines).toHaveLength(1000);
      // Should keep the most recent 1000 lines
      expect(writtenLines[0]).toBe('note-500|test-instance_1500');
      expect(writtenLines[writtenLines.length - 1]).toBe('note-1499|test-instance_2499');
    });
  });
});
