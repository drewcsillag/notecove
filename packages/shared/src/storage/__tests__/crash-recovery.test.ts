/**
 * CrashRecovery Tests
 *
 * Tests for recovering from crashes and incomplete operations.
 */

/* eslint-disable @typescript-eslint/no-base-to-string */
// Y.Text has a proper toString() method, ESLint just doesn't know about it

import * as Y from 'yjs';
import { CrashRecovery } from '../crash-recovery';
import { createLogFile, createSnapshotFile, type VectorClockEntry } from '../binary-format';
import type { FileSystemAdapter, FileStats } from '../types';

// Mock FileSystemAdapter for testing
function createMockFs(): FileSystemAdapter & {
  files: Map<string, Uint8Array>;
  directories: Set<string>;
} {
  const files = new Map<string, Uint8Array>();
  const directories = new Set<string>();

  return {
    files,
    directories,

    async exists(path: string): Promise<boolean> {
      return files.has(path) || directories.has(path);
    },

    async mkdir(path: string): Promise<void> {
      directories.add(path);
    },

    async readFile(path: string): Promise<Uint8Array> {
      const data = files.get(path);
      if (!data) throw new Error(`ENOENT: ${path}`);
      return data;
    },

    async writeFile(path: string, data: Uint8Array): Promise<void> {
      files.set(path, data);
    },

    async appendFile(path: string, data: Uint8Array): Promise<void> {
      const existing = files.get(path) || new Uint8Array(0);
      const newData = new Uint8Array(existing.length + data.length);
      newData.set(existing, 0);
      newData.set(data, existing.length);
      files.set(path, newData);
    },

    async deleteFile(path: string): Promise<void> {
      files.delete(path);
    },

    async listFiles(path: string): Promise<string[]> {
      const result: string[] = [];
      for (const filePath of files.keys()) {
        if (filePath.startsWith(path + '/')) {
          const filename = filePath.substring(path.length + 1);
          if (!filename.includes('/')) {
            result.push(filename);
          }
        }
      }
      return result;
    },

    joinPath(...segments: string[]): string {
      return segments.join('/');
    },

    basename(path: string): string {
      return path.split('/').pop() || '';
    },

    async stat(path: string): Promise<FileStats> {
      const data = files.get(path);
      if (!data) throw new Error(`ENOENT: ${path}`);
      return {
        size: data.length,
        mtimeMs: Date.now(),
        ctimeMs: Date.now(),
      };
    },
  };
}

describe('CrashRecovery', () => {
  describe('cleanupIncompleteSnapshots', () => {
    it('should delete incomplete snapshots', async () => {
      const fs = createMockFs();

      // Create complete and incomplete snapshots
      const completeSnapshot = createSnapshotFile([], new Uint8Array([0x01]), true);
      const incompleteSnapshot = createSnapshotFile([], new Uint8Array([0x01]), false);

      fs.directories.add('/snapshots');
      fs.files.set('/snapshots/inst-a_1000.snapshot', incompleteSnapshot);
      fs.files.set('/snapshots/inst-a_2000.snapshot', completeSnapshot);
      fs.files.set('/snapshots/inst-a_3000.snapshot', incompleteSnapshot);

      const recovery = new CrashRecovery(fs);
      const deleted = await recovery.cleanupIncompleteSnapshots('/snapshots');

      expect(deleted.length).toBe(2);
      expect(deleted).toContain('/snapshots/inst-a_1000.snapshot');
      expect(deleted).toContain('/snapshots/inst-a_3000.snapshot');

      // Verify incomplete ones are deleted
      expect(fs.files.has('/snapshots/inst-a_1000.snapshot')).toBe(false);
      expect(fs.files.has('/snapshots/inst-a_3000.snapshot')).toBe(false);

      // Verify complete one remains
      expect(fs.files.has('/snapshots/inst-a_2000.snapshot')).toBe(true);
    });

    it('should handle empty directory', async () => {
      const fs = createMockFs();
      fs.directories.add('/snapshots');

      const recovery = new CrashRecovery(fs);
      const deleted = await recovery.cleanupIncompleteSnapshots('/snapshots');

      expect(deleted).toEqual([]);
    });

    it('should handle directory with only complete snapshots', async () => {
      const fs = createMockFs();
      const completeSnapshot = createSnapshotFile([], new Uint8Array([0x01]), true);

      fs.directories.add('/snapshots');
      fs.files.set('/snapshots/inst-a_1000.snapshot', completeSnapshot);
      fs.files.set('/snapshots/inst-a_2000.snapshot', completeSnapshot);

      const recovery = new CrashRecovery(fs);
      const deleted = await recovery.cleanupIncompleteSnapshots('/snapshots');

      expect(deleted).toEqual([]);
      expect(fs.files.size).toBe(2);
    });
  });

  describe('cleanupOldSnapshots', () => {
    it('should keep only most recent N snapshots', async () => {
      const fs = createMockFs();
      const completeSnapshot = createSnapshotFile([], new Uint8Array([0x01]), true);

      fs.directories.add('/snapshots');
      fs.files.set('/snapshots/inst-a_1000.snapshot', completeSnapshot);
      fs.files.set('/snapshots/inst-a_2000.snapshot', completeSnapshot);
      fs.files.set('/snapshots/inst-a_3000.snapshot', completeSnapshot);
      fs.files.set('/snapshots/inst-a_4000.snapshot', completeSnapshot);
      fs.files.set('/snapshots/inst-a_5000.snapshot', completeSnapshot);

      const recovery = new CrashRecovery(fs);
      const deleted = await recovery.cleanupOldSnapshots('/snapshots', 2);

      // Should delete 3 oldest, keep 2 newest
      expect(deleted.length).toBe(3);
      expect(deleted).toContain('/snapshots/inst-a_1000.snapshot');
      expect(deleted).toContain('/snapshots/inst-a_2000.snapshot');
      expect(deleted).toContain('/snapshots/inst-a_3000.snapshot');

      // Verify newest are kept
      expect(fs.files.has('/snapshots/inst-a_4000.snapshot')).toBe(true);
      expect(fs.files.has('/snapshots/inst-a_5000.snapshot')).toBe(true);
    });

    it('should not delete if fewer than keepCount snapshots', async () => {
      const fs = createMockFs();
      const completeSnapshot = createSnapshotFile([], new Uint8Array([0x01]), true);

      fs.directories.add('/snapshots');
      fs.files.set('/snapshots/inst-a_1000.snapshot', completeSnapshot);
      fs.files.set('/snapshots/inst-a_2000.snapshot', completeSnapshot);

      const recovery = new CrashRecovery(fs);
      const deleted = await recovery.cleanupOldSnapshots('/snapshots', 5);

      expect(deleted).toEqual([]);
      expect(fs.files.size).toBe(2);
    });
  });

  describe('cleanupOldLogs', () => {
    it('should delete logs older than newest snapshot', async () => {
      const fs = createMockFs();

      // Create snapshot with vector clock referencing a specific file
      const vectorClock: VectorClockEntry[] = [
        { instanceId: 'inst-a', sequence: 10, offset: 500, filename: 'inst-a_3000.crdtlog' },
      ];
      const snapshotData = createSnapshotFile(vectorClock, new Uint8Array([0x01]), true);

      // Create log files - some older than snapshot, some newer
      const logData = createLogFile([
        { timestamp: 1000, sequence: 1, data: new Uint8Array([0x01]) },
      ]);

      fs.directories.add('/snapshots');
      fs.directories.add('/logs');
      fs.files.set('/snapshots/inst-a_4000.snapshot', snapshotData);
      fs.files.set('/logs/inst-a_1000.crdtlog', logData); // Older, should delete
      fs.files.set('/logs/inst-a_2000.crdtlog', logData); // Older, should delete
      fs.files.set('/logs/inst-a_3000.crdtlog', logData); // Referenced, keep
      fs.files.set('/logs/inst-a_4000.crdtlog', logData); // Newer, keep
      fs.files.set('/logs/inst-b_1000.crdtlog', logData); // Different instance, not in VC, keep for safety

      const recovery = new CrashRecovery(fs);
      const deleted = await recovery.cleanupOldLogs('/snapshots', '/logs');

      // Should delete logs older than the referenced file
      expect(deleted).toContain('/logs/inst-a_1000.crdtlog');
      expect(deleted).toContain('/logs/inst-a_2000.crdtlog');

      // Referenced and newer files should remain
      expect(fs.files.has('/logs/inst-a_3000.crdtlog')).toBe(true);
      expect(fs.files.has('/logs/inst-a_4000.crdtlog')).toBe(true);
      expect(fs.files.has('/logs/inst-b_1000.crdtlog')).toBe(true);
    });

    it('should not delete logs if no snapshot exists', async () => {
      const fs = createMockFs();
      const logData = createLogFile([
        { timestamp: 1000, sequence: 1, data: new Uint8Array([0x01]) },
      ]);

      fs.directories.add('/snapshots');
      fs.directories.add('/logs');
      fs.files.set('/logs/inst-a_1000.crdtlog', logData);
      fs.files.set('/logs/inst-a_2000.crdtlog', logData);

      const recovery = new CrashRecovery(fs);
      const deleted = await recovery.cleanupOldLogs('/snapshots', '/logs');

      expect(deleted).toEqual([]);
      expect(fs.files.size).toBe(2);
    });
  });

  describe('validateLogIntegrity', () => {
    it('should return valid for correct log file', async () => {
      const fs = createMockFs();
      const logData = createLogFile([
        { timestamp: 1000, sequence: 1, data: new Uint8Array([0x01, 0x02]) },
        { timestamp: 2000, sequence: 2, data: new Uint8Array([0x03, 0x04]) },
      ]);

      fs.files.set('/logs/test.crdtlog', logData);

      const recovery = new CrashRecovery(fs);
      const result = await recovery.validateLogIntegrity('/logs/test.crdtlog');

      expect(result.valid).toBe(true);
      expect(result.recordCount).toBe(2);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for corrupted log file', async () => {
      const fs = createMockFs();

      // Create a file with invalid magic number
      const badData = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01]);
      fs.files.set('/logs/bad.crdtlog', badData);

      const recovery = new CrashRecovery(fs);
      const result = await recovery.validateLogIntegrity('/logs/bad.crdtlog');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle truncated log file gracefully', async () => {
      const fs = createMockFs();

      // Create valid log with one complete record, then truncated data
      const validLog = createLogFile([
        { timestamp: 1000, sequence: 1, data: new Uint8Array([0x01, 0x02]) },
      ]);

      // Append garbage that looks like start of a record but is truncated
      const truncated = new Uint8Array(validLog.length + 5);
      truncated.set(validLog, 0);
      truncated.set([0x10, 0x00, 0x00, 0x00, 0x00], validLog.length); // Partial record

      fs.files.set('/logs/truncated.crdtlog', truncated);

      const recovery = new CrashRecovery(fs);
      const result = await recovery.validateLogIntegrity('/logs/truncated.crdtlog');

      // Should still report valid records found before truncation
      expect(result.recordCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('recoverDocument', () => {
    it('should recover document from logs when no snapshot exists', async () => {
      const fs = createMockFs();

      // Create log with document updates
      const doc = new Y.Doc();
      const text = doc.getText('content');
      text.insert(0, 'Recovered');
      const update = Y.encodeStateAsUpdate(doc);

      const logData = createLogFile([{ timestamp: 1000, sequence: 1, data: update }]);

      fs.directories.add('/snapshots');
      fs.directories.add('/logs');
      fs.files.set('/logs/inst-a_1000.crdtlog', logData);

      const recovery = new CrashRecovery(fs);
      const result = await recovery.recoverDocument('/snapshots', '/logs');

      expect(result).not.toBeNull();
      const recoveredText = result!.doc.getText('content');
      expect(String(recoveredText)).toBe('Recovered');
    });

    it('should recover document from snapshot + logs', async () => {
      const fs = createMockFs();

      // Create initial doc for snapshot
      const initialDoc = new Y.Doc();
      initialDoc.clientID = 1;
      const initialText = initialDoc.getText('content');
      initialText.insert(0, 'Initial');
      const initialState = Y.encodeStateAsUpdate(initialDoc);

      // Create snapshot
      const vectorClock: VectorClockEntry[] = [
        { instanceId: 'inst-a', sequence: 1, offset: 100, filename: 'inst-a_1000.crdtlog' },
      ];
      const snapshotData = createSnapshotFile(vectorClock, initialState, true);

      // Create log with additional update
      const laterDoc = new Y.Doc();
      laterDoc.clientID = 2;
      Y.applyUpdate(laterDoc, initialState);
      laterDoc.getText('content').insert(7, ' + More');
      const laterUpdate = Y.encodeStateAsUpdate(laterDoc, Y.encodeStateVector(initialDoc));
      const logData = createLogFile([{ timestamp: 2000, sequence: 1, data: laterUpdate }]);

      fs.directories.add('/snapshots');
      fs.directories.add('/logs');
      fs.files.set('/snapshots/inst-a_1500.snapshot', snapshotData);
      fs.files.set('/logs/inst-b_2000.crdtlog', logData);

      const recovery = new CrashRecovery(fs);
      const result = await recovery.recoverDocument('/snapshots', '/logs');

      expect(result).not.toBeNull();
      const recoveredText = result!.doc.getText('content');
      expect(String(recoveredText)).toBe('Initial + More');
    });

    it('should return null when no data exists', async () => {
      const fs = createMockFs();
      fs.directories.add('/snapshots');
      fs.directories.add('/logs');

      const recovery = new CrashRecovery(fs);
      const result = await recovery.recoverDocument('/snapshots', '/logs');

      expect(result).toBeNull();
    });
  });
});
