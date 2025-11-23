/**
 * SnapshotReader Tests
 *
 * Tests for reading and listing snapshot files.
 */

import { SnapshotReader } from '../snapshot-reader';
import { createSnapshotFile } from '../binary-format';
import type { FileSystemAdapter, FileStats } from '../types';
import type { VectorClockEntry } from '../binary-format';

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

describe('SnapshotReader', () => {
  describe('listSnapshotFiles', () => {
    it('should return empty array for empty directory', async () => {
      const fs = createMockFs();
      fs.directories.add('/snapshots');

      const files = await SnapshotReader.listSnapshotFiles('/snapshots', fs);

      expect(files).toEqual([]);
    });

    it('should list .snapshot files', async () => {
      const fs = createMockFs();
      const snapshotData = createSnapshotFile([], new Uint8Array([0x01]), true);

      fs.files.set('/snapshots/inst-abc_1699028345000.snapshot', snapshotData);
      fs.files.set('/snapshots/inst-xyz_1699028346000.snapshot', snapshotData);
      fs.files.set('/snapshots/other.txt', new Uint8Array([0x00]));

      const files = await SnapshotReader.listSnapshotFiles('/snapshots', fs);

      expect(files.length).toBe(2);
    });

    it('should extract instanceId and timestamp from filename', async () => {
      const fs = createMockFs();
      const snapshotData = createSnapshotFile([], new Uint8Array([0x01]), true);

      fs.files.set('/snapshots/inst-abc_1699028345000.snapshot', snapshotData);

      const files = await SnapshotReader.listSnapshotFiles('/snapshots', fs);

      expect(files[0].instanceId).toBe('inst-abc');
      expect(files[0].timestamp).toBe(1699028345000);
    });

    it('should sort by timestamp descending (newest first)', async () => {
      const fs = createMockFs();
      const snapshotData = createSnapshotFile([], new Uint8Array([0x01]), true);

      fs.files.set('/snapshots/inst-abc_1000.snapshot', snapshotData);
      fs.files.set('/snapshots/inst-abc_3000.snapshot', snapshotData);
      fs.files.set('/snapshots/inst-abc_2000.snapshot', snapshotData);

      const files = await SnapshotReader.listSnapshotFiles('/snapshots', fs);

      expect(files[0].timestamp).toBe(3000); // newest first
      expect(files[1].timestamp).toBe(2000);
      expect(files[2].timestamp).toBe(1000);
    });
  });

  describe('findBestSnapshot', () => {
    it('should return null for empty directory', async () => {
      const fs = createMockFs();
      fs.directories.add('/snapshots');

      const best = await SnapshotReader.findBestSnapshot('/snapshots', fs);

      expect(best).toBeNull();
    });

    it('should return most recent complete snapshot', async () => {
      const fs = createMockFs();
      const completeSnapshot = createSnapshotFile([], new Uint8Array([0x01]), true);

      fs.files.set('/snapshots/inst-abc_1000.snapshot', completeSnapshot);
      fs.files.set('/snapshots/inst-abc_2000.snapshot', completeSnapshot);
      fs.files.set('/snapshots/inst-abc_3000.snapshot', completeSnapshot);

      const best = await SnapshotReader.findBestSnapshot('/snapshots', fs);

      expect(best).not.toBeNull();
      expect(best!.timestamp).toBe(3000);
    });

    it('should skip incomplete snapshots', async () => {
      const fs = createMockFs();
      const completeSnapshot = createSnapshotFile([], new Uint8Array([0x01]), true);
      const incompleteSnapshot = createSnapshotFile([], new Uint8Array([0x01]), false);

      fs.files.set('/snapshots/inst-abc_1000.snapshot', completeSnapshot); // older but complete
      fs.files.set('/snapshots/inst-abc_2000.snapshot', incompleteSnapshot); // newer but incomplete

      const best = await SnapshotReader.findBestSnapshot('/snapshots', fs);

      expect(best).not.toBeNull();
      expect(best!.timestamp).toBe(1000); // Should pick older complete one
    });

    it('should return null if all snapshots are incomplete', async () => {
      const fs = createMockFs();
      const incompleteSnapshot = createSnapshotFile([], new Uint8Array([0x01]), false);

      fs.files.set('/snapshots/inst-abc_1000.snapshot', incompleteSnapshot);
      fs.files.set('/snapshots/inst-abc_2000.snapshot', incompleteSnapshot);

      const best = await SnapshotReader.findBestSnapshot('/snapshots', fs);

      expect(best).toBeNull();
    });
  });

  describe('readSnapshot', () => {
    it('should read complete snapshot', async () => {
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
      const snapshotData = createSnapshotFile(vectorClock, documentState, true);

      fs.files.set('/snapshots/test.snapshot', snapshotData);

      const snapshot = await SnapshotReader.readSnapshot('/snapshots/test.snapshot', fs);

      expect(snapshot.complete).toBe(true);
      expect(snapshot.vectorClock.length).toBe(1);
      expect(snapshot.vectorClock[0].instanceId).toBe('inst-abc');
      expect(snapshot.documentState).toEqual(documentState);
    });

    it('should read incomplete snapshot', async () => {
      const fs = createMockFs();
      const snapshotData = createSnapshotFile([], new Uint8Array([0x01]), false);

      fs.files.set('/snapshots/test.snapshot', snapshotData);

      const snapshot = await SnapshotReader.readSnapshot('/snapshots/test.snapshot', fs);

      expect(snapshot.complete).toBe(false);
    });

    it('should throw for invalid snapshot', async () => {
      const fs = createMockFs();
      fs.files.set('/snapshots/bad.snapshot', new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01, 0x01]));

      await expect(SnapshotReader.readSnapshot('/snapshots/bad.snapshot', fs)).rejects.toThrow(
        /invalid/i
      );
    });
  });

  describe('isComplete', () => {
    it('should return true for complete snapshot', async () => {
      const fs = createMockFs();
      const snapshotData = createSnapshotFile([], new Uint8Array([0x01]), true);
      fs.files.set('/snapshots/test.snapshot', snapshotData);

      const isComplete = await SnapshotReader.isComplete('/snapshots/test.snapshot', fs);

      expect(isComplete).toBe(true);
    });

    it('should return false for incomplete snapshot', async () => {
      const fs = createMockFs();
      const snapshotData = createSnapshotFile([], new Uint8Array([0x01]), false);
      fs.files.set('/snapshots/test.snapshot', snapshotData);

      const isComplete = await SnapshotReader.isComplete('/snapshots/test.snapshot', fs);

      expect(isComplete).toBe(false);
    });
  });
});
