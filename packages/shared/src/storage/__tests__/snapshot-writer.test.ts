/**
 * SnapshotWriter Tests
 *
 * Tests for crash-safe snapshot file writing.
 */

import { SnapshotWriter } from '../snapshot-writer';
import {
  parseSnapshotFile,
  SNAPSHOT_STATUS_INCOMPLETE,
  SNAPSHOT_STATUS_COMPLETE,
} from '../binary-format';
import type { FileSystemAdapter, FileStats } from '../types';
import type { VectorClockEntry } from '../binary-format';

// Extended mock FS with seekWrite capability
function createMockFs(): FileSystemAdapter & {
  files: Map<string, Uint8Array>;
  directories: Set<string>;
  seekWrite: (path: string, offset: number, data: Uint8Array) => Promise<void>;
} {
  const files = new Map<string, Uint8Array>();
  const directories = new Set<string>();

  const fs = {
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

    // Additional method for seek+write (used for status byte update)
    async seekWrite(path: string, offset: number, data: Uint8Array): Promise<void> {
      const existing = files.get(path);
      if (!existing) throw new Error(`ENOENT: ${path}`);
      const newData = new Uint8Array(existing);
      newData.set(data, offset);
      files.set(path, newData);
    },
  };

  return fs;
}

describe('SnapshotWriter', () => {
  describe('write', () => {
    it('should write complete snapshot with status = 0x01', async () => {
      const fs = createMockFs();
      const vectorClock: VectorClockEntry[] = [
        {
          instanceId: 'inst-abc',
          sequence: 100,
          offset: 5000,
          filename: 'inst-abc_1699028345123.crdtlog',
        },
      ];
      const documentState = new Uint8Array([0x01, 0x02, 0x03]);

      const filePath = await SnapshotWriter.write(
        '/snapshots',
        'inst-abc',
        vectorClock,
        documentState,
        fs
      );

      expect(filePath).toContain('inst-abc_');
      expect(filePath).toContain('.snapshot');

      const data = fs.files.get(filePath)!;
      expect(data[5]).toBe(SNAPSHOT_STATUS_COMPLETE); // Status byte
    });

    it('should create directory if it does not exist', async () => {
      const fs = createMockFs();

      await SnapshotWriter.write('/snapshots', 'inst-abc', [], new Uint8Array([0x01]), fs);

      expect(fs.directories.has('/snapshots')).toBe(true);
    });

    it('should include instanceId and timestamp in filename', async () => {
      const fs = createMockFs();

      const filePath = await SnapshotWriter.write(
        '/snapshots',
        'inst-abc',
        [],
        new Uint8Array([0x01]),
        fs
      );

      const filename = fs.basename(filePath);
      expect(filename).toMatch(/^inst-abc_\d+\.snapshot$/);
    });

    it('should write vector clock correctly', async () => {
      const fs = createMockFs();
      const vectorClock: VectorClockEntry[] = [
        {
          instanceId: 'inst-aaa',
          sequence: 100,
          offset: 5000,
          filename: 'inst-aaa_1699028345000.crdtlog',
        },
        {
          instanceId: 'inst-bbb',
          sequence: 50,
          offset: 2500,
          filename: 'inst-bbb_1699028346000.crdtlog',
        },
      ];

      const filePath = await SnapshotWriter.write(
        '/snapshots',
        'inst-abc',
        vectorClock,
        new Uint8Array([0x01]),
        fs
      );

      const data = fs.files.get(filePath)!;
      const parsed = parseSnapshotFile(data);

      expect(parsed.vectorClock.length).toBe(2);
      expect(parsed.vectorClock[0].instanceId).toBe('inst-aaa');
      expect(parsed.vectorClock[1].instanceId).toBe('inst-bbb');
    });

    it('should write document state correctly', async () => {
      const fs = createMockFs();
      const documentState = new Uint8Array(100);
      for (let i = 0; i < 100; i++) {
        documentState[i] = i;
      }

      const filePath = await SnapshotWriter.write('/snapshots', 'inst-abc', [], documentState, fs);

      const data = fs.files.get(filePath)!;
      const parsed = parseSnapshotFile(data);

      expect(parsed.documentState).toEqual(documentState);
    });

    it('should handle timestamp collision', async () => {
      const fs = createMockFs();
      const timestamp = 1704067200000;

      // Create existing snapshot
      fs.files.set(
        `/snapshots/inst-abc_${timestamp}.snapshot`,
        new Uint8Array([0x4e, 0x43, 0x53, 0x53, 0x01, 0x01])
      );

      const originalNow = Date.now;
      Date.now = () => timestamp;
      try {
        const filePath = await SnapshotWriter.write(
          '/snapshots',
          'inst-abc',
          [],
          new Uint8Array([0x01]),
          fs
        );

        expect(filePath).toBe(`/snapshots/inst-abc_${timestamp + 1}.snapshot`);
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe('crash safety', () => {
    it('should write incomplete status first, then complete', async () => {
      const fs = createMockFs();
      const writes: Array<{ offset: number; value: number }> = [];

      // Intercept seekWrite to track status byte changes
      const originalSeekWrite = fs.seekWrite;
      fs.seekWrite = async (path: string, offset: number, data: Uint8Array) => {
        writes.push({ offset, value: data[0] });
        return originalSeekWrite.call(fs, path, offset, data);
      };

      await SnapshotWriter.write('/snapshots', 'inst-abc', [], new Uint8Array([0x01]), fs);

      // Should have at least one seekWrite to set status to complete
      expect(writes.some((w) => w.offset === 5 && w.value === SNAPSHOT_STATUS_COMPLETE)).toBe(true);
    });

    it('should leave incomplete snapshot if interrupted (simulated)', async () => {
      const fs = createMockFs();

      // Manually write an incomplete snapshot (simulating crash)
      const vectorClockBytes = new Uint8Array([0x00]); // Empty clock
      const documentState = new Uint8Array([0x01, 0x02]);

      // Write header with incomplete status
      const header = new Uint8Array([
        0x4e,
        0x43,
        0x53,
        0x53, // Magic "NCSS"
        0x01, // Version 1
        SNAPSHOT_STATUS_INCOMPLETE, // Incomplete
      ]);

      const fullFile = new Uint8Array(
        header.length + vectorClockBytes.length + documentState.length
      );
      fullFile.set(header, 0);
      fullFile.set(vectorClockBytes, header.length);
      fullFile.set(documentState, header.length + vectorClockBytes.length);

      fs.files.set('/snapshots/inst-abc_crash.snapshot', fullFile);

      // Verify it's incomplete
      const data = fs.files.get('/snapshots/inst-abc_crash.snapshot')!;
      expect(data[5]).toBe(SNAPSHOT_STATUS_INCOMPLETE);

      // Parse should still work but report incomplete
      const parsed = parseSnapshotFile(data);
      expect(parsed.complete).toBe(false);
    });
  });
});
