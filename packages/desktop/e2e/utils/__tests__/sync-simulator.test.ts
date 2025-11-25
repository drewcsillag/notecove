/**
 * Tests for sync simulator debug utilities
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  inspectSDContents,
  formatSDContents,
  parseCRDTLogSequences,
  validateSequenceOrder,
  validateAllSequences,
  SimulatorLogger,
  defaultLogConfig,
} from '../sync-simulator';

describe('sync-simulator utilities', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'sync-simulator-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('SimulatorLogger', () => {
    it('should log messages when enabled', () => {
      const logger = new SimulatorLogger({ ...defaultLogConfig, enabled: true });
      // Just verify it doesn't throw
      expect(() => logger.log('test message')).not.toThrow();
    });

    it('should not log when disabled', () => {
      const logger = new SimulatorLogger({ ...defaultLogConfig, enabled: false });
      // Should not throw and should not output
      expect(() => logger.log('test message')).not.toThrow();
    });

    it('should log verbose messages only when verbose is enabled', () => {
      const logger = new SimulatorLogger({ ...defaultLogConfig, enabled: true, verbose: true });
      expect(() => logger.verbose('verbose message')).not.toThrow();
    });
  });

  describe('inspectSDContents', () => {
    it('should return empty contents for non-existent SD', async () => {
      const nonExistentPath = join(testDir, 'nonexistent');
      const contents = await inspectSDContents(nonExistentPath);

      expect(contents.path).toBe(nonExistentPath);
      expect(contents.notes).toEqual([]);
      expect(contents.activityLogs).toEqual([]);
      expect(contents.totalFiles).toBe(0);
    });

    it('should detect note directories with log files', async () => {
      const sdPath = join(testDir, 'sd');
      const notePath = join(sdPath, 'notes', 'test-note');
      const logsPath = join(notePath, 'logs');

      await mkdir(logsPath, { recursive: true });
      await writeFile(join(logsPath, 'instance-1_123.crdtlog'), 'fake log content');

      const contents = await inspectSDContents(sdPath);

      expect(contents.notes).toHaveLength(1);
      expect(contents.notes[0]?.id).toBe('test-note');
      expect(contents.notes[0]?.logFiles).toContain('instance-1_123.crdtlog');
      expect(contents.totalFiles).toBeGreaterThan(0);
    });

    it('should detect activity logs', async () => {
      const sdPath = join(testDir, 'sd');
      const activityPath = join(sdPath, 'activity');

      await mkdir(activityPath, { recursive: true });
      await writeFile(join(activityPath, 'instance-1.log'), 'activity log');

      const contents = await inspectSDContents(sdPath);

      expect(contents.activityLogs).toContain('instance-1.log');
    });

    it('should calculate total log size', async () => {
      const sdPath = join(testDir, 'sd');
      const notePath = join(sdPath, 'notes', 'test-note');
      const logsPath = join(notePath, 'logs');

      await mkdir(logsPath, { recursive: true });
      const logContent = 'test content with some length';
      await writeFile(join(logsPath, 'instance-1_123.crdtlog'), logContent);

      const contents = await inspectSDContents(sdPath);

      expect(contents.notes[0]?.totalLogSize).toBe(logContent.length);
    });
  });

  describe('formatSDContents', () => {
    it('should format empty contents', () => {
      const contents = {
        path: '/test/path',
        notes: [],
        activityLogs: [],
        folderLogs: [],
        totalFiles: 0,
      };

      const formatted = formatSDContents(contents);

      expect(formatted).toContain('/test/path');
      expect(formatted).toContain('Total files: 0');
    });

    it('should format contents with notes', () => {
      const contents = {
        path: '/test/path',
        notes: [
          {
            id: 'note-1',
            logFiles: ['log1.crdtlog', 'log2.crdtlog'],
            snapshotFiles: ['snap1.snapshot'],
            totalLogSize: 1024,
          },
        ],
        activityLogs: ['instance-1.log'],
        folderLogs: ['folder-log.crdtlog'],
        totalFiles: 4,
      };

      const formatted = formatSDContents(contents);

      expect(formatted).toContain('note-1');
      expect(formatted).toContain('Log files: 2');
      expect(formatted).toContain('1024 bytes');
      expect(formatted).toContain('Snapshots: 1');
      expect(formatted).toContain('instance-1.log');
    });
  });

  describe('parseCRDTLogSequences', () => {
    it('should parse a valid CRDT log file', async () => {
      const logPath = join(testDir, 'test.crdtlog');

      // Create a minimal valid CRDT log
      // Header: NCLG (4 bytes) + version 0x01 (1 byte)
      // Record 1: length (varint) + timestamp (8 bytes) + sequence (varint) + data
      const header = Buffer.from('NCLG');
      const version = Buffer.from([0x01]);

      // Record 1: length=10, timestamp=1000, sequence=1, data="xx"
      const length1 = Buffer.from([0x0a]); // 10 in varint
      const timestamp1 = Buffer.alloc(8);
      timestamp1.writeBigUInt64BE(BigInt(1000));
      const sequence1 = Buffer.from([0x01]); // 1 in varint
      const data1 = Buffer.from('xx');

      const logBuffer = Buffer.concat([header, version, length1, timestamp1, sequence1, data1]);
      await writeFile(logPath, logBuffer);

      const records = await parseCRDTLogSequences(logPath);

      expect(records).toHaveLength(1);
      expect(records[0]?.sequence).toBe(1);
      expect(records[0]?.timestamp).toBe(1000);
    });

    it('should handle invalid magic number', async () => {
      const logPath = join(testDir, 'invalid.crdtlog');
      await writeFile(logPath, 'INVALID');

      const records = await parseCRDTLogSequences(logPath);

      // Should return empty array on error
      expect(records).toEqual([]);
    });

    it('should handle empty file', async () => {
      const logPath = join(testDir, 'empty.crdtlog');
      await writeFile(logPath, '');

      const records = await parseCRDTLogSequences(logPath);

      expect(records).toEqual([]);
    });
  });

  describe('validateSequenceOrder', () => {
    it('should validate correct sequence order', async () => {
      const logPath = join(testDir, 'valid.crdtlog');

      // Create log with sequences 1, 2, 3
      const header = Buffer.from('NCLG');
      const version = Buffer.from([0x01]);

      const records: Buffer[] = [];
      for (let seq = 1; seq <= 3; seq++) {
        const length = Buffer.from([0x0a]); // 10 bytes
        const timestamp = Buffer.alloc(8);
        timestamp.writeBigUInt64BE(BigInt(1000 + seq));
        const sequence = Buffer.from([seq]);
        const data = Buffer.from('xx');
        records.push(Buffer.concat([length, timestamp, sequence, data]));
      }

      const logBuffer = Buffer.concat([header, version, ...records]);
      await writeFile(logPath, logBuffer);

      const validation = await validateSequenceOrder(logPath);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.records).toHaveLength(3);
    });

    it('should detect sequence gaps', async () => {
      const logPath = join(testDir, 'gap.crdtlog');

      // Create log with sequences 1, 3 (missing 2)
      const header = Buffer.from('NCLG');
      const version = Buffer.from([0x01]);

      const record1 = createRecord(1, 1000);
      const record2 = createRecord(3, 1002); // Gap!

      const logBuffer = Buffer.concat([header, version, record1, record2]);
      await writeFile(logPath, logBuffer);

      const validation = await validateSequenceOrder(logPath);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('Sequence gap');
    });
  });

  describe('validateAllSequences', () => {
    it('should validate all notes in an SD', async () => {
      const sdPath = join(testDir, 'sd');

      // Create two notes with valid sequences
      for (let noteNum = 1; noteNum <= 2; noteNum++) {
        const logsPath = join(sdPath, 'notes', `note-${noteNum}`, 'logs');
        await mkdir(logsPath, { recursive: true });

        const logPath = join(logsPath, `instance-1_123.crdtlog`);
        const header = Buffer.from('NCLG');
        const version = Buffer.from([0x01]);
        const record1 = createRecord(1, 1000);
        const record2 = createRecord(2, 1001);
        const logBuffer = Buffer.concat([header, version, record1, record2]);
        await writeFile(logPath, logBuffer);
      }

      const validation = await validateAllSequences(sdPath);

      expect(validation.valid).toBe(true);
      expect(validation.noteResults.size).toBe(2);
    });

    it('should detect invalid sequences across multiple notes', async () => {
      const sdPath = join(testDir, 'sd');

      // Note 1: valid
      const logsPath1 = join(sdPath, 'notes', 'note-1', 'logs');
      await mkdir(logsPath1, { recursive: true });
      const logPath1 = join(logsPath1, 'instance-1_123.crdtlog');
      const validLog = Buffer.concat([
        Buffer.from('NCLG'),
        Buffer.from([0x01]),
        createRecord(1, 1000),
        createRecord(2, 1001),
      ]);
      await writeFile(logPath1, validLog);

      // Note 2: invalid (has gap)
      const logsPath2 = join(sdPath, 'notes', 'note-2', 'logs');
      await mkdir(logsPath2, { recursive: true });
      const logPath2 = join(logsPath2, 'instance-1_124.crdtlog');
      const invalidLog = Buffer.concat([
        Buffer.from('NCLG'),
        Buffer.from([0x01]),
        createRecord(1, 1000),
        createRecord(3, 1002), // Gap!
      ]);
      await writeFile(logPath2, invalidLog);

      const validation = await validateAllSequences(sdPath);

      expect(validation.valid).toBe(false);
      expect(validation.noteResults.size).toBe(2);

      // Check that note-2 has errors
      const note2Result = Array.from(validation.noteResults.entries()).find(([key]) =>
        key.includes('note-2')
      );
      expect(note2Result).toBeDefined();
      expect(note2Result![1].valid).toBe(false);
    });
  });
});

/**
 * Helper to create a CRDT log record
 */
function createRecord(sequence: number, timestamp: number): Buffer {
  const length = Buffer.from([0x0a]); // 10 bytes
  const timestampBuf = Buffer.alloc(8);
  timestampBuf.writeBigUInt64BE(BigInt(timestamp));
  const sequenceBuf = Buffer.from([sequence]);
  const data = Buffer.from('xx');
  return Buffer.concat([length, timestampBuf, sequenceBuf, data]);
}
