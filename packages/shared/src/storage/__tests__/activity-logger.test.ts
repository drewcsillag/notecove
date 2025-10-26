/**
 * Activity Logger Tests
 */

import { ActivityLogger } from '../activity-logger';
import { FileSystemAdapter } from '../types';

describe('ActivityLogger', () => {
  let mockFs: jest.Mocked<FileSystemAdapter>;
  let logger: ActivityLogger;
  const activityDir = '/test/.activity';

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
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode('1000|note-1|1\n'));

      await logger.recordNoteActivity('note-2', 1);

      const written = mockFs.writeFile.mock.calls[0]?.[1] ?? new Uint8Array();
      const text = new TextDecoder().decode(written);
      const lines = text.split('\n').filter((l) => l.length > 0);

      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('1000|note-1|1');
      expect(lines[1]).toMatch(/^\d+\|note-2\|1$/);
    });

    it('should replace last line for same note edited consecutively', async () => {
      // First edit to note-1
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode(''));
      await logger.recordNoteActivity('note-1', 1);

      // Get what was written
      const firstWrite = mockFs.writeFile.mock.calls[0]?.[1] ?? new Uint8Array();

      // Second edit to note-1 (consecutive)
      mockFs.readFile.mockResolvedValue(firstWrite);
      jest.clearAllMocks();
      await logger.recordNoteActivity('note-1', 5);

      const written = mockFs.writeFile.mock.calls[0]?.[1] ?? new Uint8Array();
      const text = new TextDecoder().decode(written);
      const lines = text.split('\n').filter((l) => l.length > 0);

      // Should have only 1 line (replaced the previous one)
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/^\d+\|note-1\|5$/);
    });

    it('should ensure monotonically increasing timestamps', async () => {
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode(''));

      // Record two entries in quick succession
      await logger.recordNoteActivity('note-1', 1);
      const firstWrite = mockFs.writeFile.mock.calls[0]?.[1];
      const firstText = new TextDecoder().decode(firstWrite);
      const firstTimestamp = parseInt(firstText.split('|')[0] ?? '0');

      mockFs.readFile.mockResolvedValue(firstWrite);
      await logger.recordNoteActivity('note-2', 1);
      const secondWrite = mockFs.writeFile.mock.calls[1]?.[1];
      const secondText = new TextDecoder().decode(secondWrite);
      const lines = secondText.split('\n').filter((l) => l.length > 0);
      const secondTimestamp = parseInt(lines[1]?.split('|')[0] ?? '0');

      expect(secondTimestamp).toBeGreaterThan(firstTimestamp);
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
        Array.from({ length: 500 }, (_, i) => `${1000 + i}|note-${i}|1`).join('\n') + '\n';
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode(lines));

      await logger.compact();

      // Should not write because file is under limit
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should trim to retention limit if over', async () => {
      const lines =
        Array.from({ length: 1500 }, (_, i) => `${1000 + i}|note-${i}|1`).join('\n') + '\n';
      mockFs.readFile.mockResolvedValue(new TextEncoder().encode(lines));

      await logger.compact();

      const written = mockFs.writeFile.mock.calls[0]?.[1] ?? new Uint8Array();
      const text = new TextDecoder().decode(written);
      const writtenLines = text.split('\n').filter((l) => l.length > 0);

      expect(writtenLines).toHaveLength(1000);
      // Should keep the most recent 1000 lines
      expect(writtenLines[0]).toBe('1500|note-500|1');
      expect(writtenLines[writtenLines.length - 1]).toBe('2499|note-1499|1');
    });
  });
});
