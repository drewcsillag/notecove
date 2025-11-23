/**
 * LogSync Tests
 *
 * Tests for synchronizing from other instances' log files.
 */

import * as Y from 'yjs';
import { LogSync, type LogSyncCallbacks } from '../log-sync';
import { createLogFile } from '../binary-format';
import type { FileSystemAdapter, FileStats } from '../types';

// Mock FileSystemAdapter
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

// Mock callbacks
function createMockCallbacks(): LogSyncCallbacks & {
  appliedUpdates: Array<{ noteId: string; update: Uint8Array }>;
  reloadedNotes: string[];
} {
  return {
    appliedUpdates: [],
    reloadedNotes: [],

    async applyUpdate(noteId: string, update: Uint8Array): Promise<void> {
      this.appliedUpdates.push({ noteId, update });
    },

    async reloadNote(noteId: string): Promise<void> {
      this.reloadedNotes.push(noteId);
    },

    getLoadedNotes(): string[] {
      return ['note-1', 'note-2'];
    },
  };
}

describe('LogSync', () => {
  const instanceId = 'inst-local';
  const logsDir = '/storage/sd-123/notes/note-abc/logs';

  describe('syncFromLogs', () => {
    it('should detect new log files from other instances', async () => {
      const fs = createMockFs();
      const callbacks = createMockCallbacks();

      // Create a log file from another instance
      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'Hello');
      const update = Y.encodeStateAsUpdate(doc);
      const logData = createLogFile([{ timestamp: 1000, sequence: 1, data: update }]);

      fs.directories.add(logsDir);
      fs.files.set(`${logsDir}/inst-other_1000.crdtlog`, logData);

      const sync = new LogSync(fs, instanceId, callbacks);
      const result = await sync.syncFromLogs(logsDir);

      expect(result.newFiles.length).toBe(1);
      expect(result.newFiles[0]).toBe('inst-other_1000.crdtlog');
    });

    it('should skip log files from local instance', async () => {
      const fs = createMockFs();
      const callbacks = createMockCallbacks();

      // Create log files - one from local, one from other
      const logData = createLogFile([
        { timestamp: 1000, sequence: 1, data: new Uint8Array([0x01]) },
      ]);

      fs.directories.add(logsDir);
      fs.files.set(`${logsDir}/${instanceId}_1000.crdtlog`, logData);
      fs.files.set(`${logsDir}/inst-other_1000.crdtlog`, logData);

      const sync = new LogSync(fs, instanceId, callbacks);
      const result = await sync.syncFromLogs(logsDir);

      // Should only detect the other instance's file
      expect(result.newFiles.length).toBe(1);
      expect(result.newFiles[0]).toBe('inst-other_1000.crdtlog');
    });

    it('should track last seen position per instance', async () => {
      const fs = createMockFs();
      const callbacks = createMockCallbacks();

      // Create initial log file
      const doc1 = new Y.Doc();
      doc1.getText('content').insert(0, 'First');
      const update1 = Y.encodeStateAsUpdate(doc1);
      const logData1 = createLogFile([{ timestamp: 1000, sequence: 1, data: update1 }]);

      fs.directories.add(logsDir);
      fs.files.set(`${logsDir}/inst-other_1000.crdtlog`, logData1);

      const sync = new LogSync(fs, instanceId, callbacks);

      // First sync
      const result1 = await sync.syncFromLogs(logsDir);
      expect(result1.newFiles.length).toBe(1);

      // Second sync without changes - should find no new files
      const result2 = await sync.syncFromLogs(logsDir);
      expect(result2.newFiles.length).toBe(0);
    });

    it('should detect new records in existing log file', async () => {
      const fs = createMockFs();
      const callbacks = createMockCallbacks();

      // Create initial log file with one record
      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'First');
      const update1 = Y.encodeStateAsUpdate(doc);
      const logData1 = createLogFile([{ timestamp: 1000, sequence: 1, data: update1 }]);

      fs.directories.add(logsDir);
      fs.files.set(`${logsDir}/inst-other_1000.crdtlog`, logData1);

      const sync = new LogSync(fs, instanceId, callbacks);

      // First sync
      await sync.syncFromLogs(logsDir);

      // Add more records to the same file
      doc.getText('content').insert(5, ' Second');
      const update2 = Y.encodeStateAsUpdate(doc, Y.encodeStateVector(doc));
      const logData2 = createLogFile([
        { timestamp: 1000, sequence: 1, data: update1 },
        { timestamp: 2000, sequence: 2, data: update2 },
      ]);
      fs.files.set(`${logsDir}/inst-other_1000.crdtlog`, logData2);

      // Second sync should detect new records
      const result = await sync.syncFromLogs(logsDir);
      expect(result.newRecordCount).toBeGreaterThan(0);
    });
  });

  describe('readNewRecords', () => {
    it('should read records from a specific offset', async () => {
      const fs = createMockFs();
      const callbacks = createMockCallbacks();

      // Create log file with multiple records
      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'First');
      const update1 = Y.encodeStateAsUpdate(doc);
      doc.getText('content').insert(5, ' Second');
      const update2 = Y.encodeStateAsUpdate(doc, Y.encodeStateVector(doc));

      const logData = createLogFile([
        { timestamp: 1000, sequence: 1, data: update1 },
        { timestamp: 2000, sequence: 2, data: update2 },
      ]);

      fs.directories.add(logsDir);
      fs.files.set(`${logsDir}/test.crdtlog`, logData);

      const sync = new LogSync(fs, instanceId, callbacks);

      // Read from beginning
      const records = await sync.readNewRecords(`${logsDir}/test.crdtlog`, 0);
      expect(records.length).toBe(2);
      expect(records[0].sequence).toBe(1);
      expect(records[1].sequence).toBe(2);
    });

    it('should skip records before start sequence', async () => {
      const fs = createMockFs();
      const callbacks = createMockCallbacks();

      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'First');
      const update1 = Y.encodeStateAsUpdate(doc);
      doc.getText('content').insert(5, ' Second');
      const update2 = Y.encodeStateAsUpdate(doc, Y.encodeStateVector(doc));

      const logData = createLogFile([
        { timestamp: 1000, sequence: 1, data: update1 },
        { timestamp: 2000, sequence: 2, data: update2 },
      ]);

      fs.directories.add(logsDir);
      fs.files.set(`${logsDir}/test.crdtlog`, logData);

      const sync = new LogSync(fs, instanceId, callbacks);

      // Read starting from sequence 1 (should only get sequence 2)
      const records = await sync.readNewRecords(`${logsDir}/test.crdtlog`, 1);
      expect(records.length).toBe(1);
      expect(records[0].sequence).toBe(2);
    });
  });

  describe('getLastSeenState', () => {
    it('should return empty state initially', () => {
      const fs = createMockFs();
      const callbacks = createMockCallbacks();

      const sync = new LogSync(fs, instanceId, callbacks);
      const state = sync.getLastSeenState();

      expect(state.size).toBe(0);
    });

    it('should return tracked state after sync', async () => {
      const fs = createMockFs();
      const callbacks = createMockCallbacks();

      const logData = createLogFile([
        { timestamp: 1000, sequence: 5, data: new Uint8Array([0x01]) },
      ]);

      fs.directories.add(logsDir);
      fs.files.set(`${logsDir}/inst-other_1000.crdtlog`, logData);

      const sync = new LogSync(fs, instanceId, callbacks);
      await sync.syncFromLogs(logsDir);

      const state = sync.getLastSeenState();
      expect(state.has('inst-other')).toBe(true);
      expect(state.get('inst-other')?.sequence).toBe(5);
    });
  });

  describe('reset', () => {
    it('should clear all tracking state', async () => {
      const fs = createMockFs();
      const callbacks = createMockCallbacks();

      const logData = createLogFile([
        { timestamp: 1000, sequence: 1, data: new Uint8Array([0x01]) },
      ]);

      fs.directories.add(logsDir);
      fs.files.set(`${logsDir}/inst-other_1000.crdtlog`, logData);

      const sync = new LogSync(fs, instanceId, callbacks);
      await sync.syncFromLogs(logsDir);

      // Should have state
      expect(sync.getLastSeenState().size).toBeGreaterThan(0);

      // Reset
      sync.reset();

      // Should be empty
      expect(sync.getLastSeenState().size).toBe(0);

      // Next sync should find the file again
      const result = await sync.syncFromLogs(logsDir);
      expect(result.newFiles.length).toBe(1);
    });
  });
});
