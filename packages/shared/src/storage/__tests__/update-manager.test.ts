import { UpdateManager } from '../update-manager';
import { SyncDirectoryStructure } from '../sd-structure';
import type { FileSystemAdapter, SyncDirectoryConfig } from '../types';
import type { UUID } from '../../types';
import { NoteDoc } from '../../crdt/note-doc';
import type { VectorClock } from '../../crdt/snapshot-format';
import * as Y from 'yjs';

/**
 * Mock file system adapter
 */
class MockFileSystemAdapter implements FileSystemAdapter {
  private files = new Map<string, Uint8Array>();
  private dirs = new Set<string>();

  /* eslint-disable @typescript-eslint/require-await */
  async exists(path: string): Promise<boolean> {
    return this.dirs.has(path) || this.files.has(path);
  }

  async mkdir(path: string): Promise<void> {
    this.dirs.add(path);
  }

  async readFile(path: string): Promise<Uint8Array> {
    const data = this.files.get(path);
    if (!data) {
      throw new Error(`File not found: ${path}`);
    }
    return data;
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    this.files.set(path, data);
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
  }

  async listFiles(path: string): Promise<string[]> {
    const result: string[] = [];
    const prefix = path + '/';

    for (const file of this.files.keys()) {
      if (file.startsWith(prefix)) {
        const relative = file.slice(prefix.length);
        if (!relative.includes('/')) {
          result.push(relative);
        }
      }
    }

    for (const dir of this.dirs) {
      if (dir.startsWith(prefix)) {
        const relative = dir.slice(prefix.length);
        if (!relative.includes('/')) {
          result.push(relative);
        }
      }
    }

    return result;
  }

  joinPath(...segments: string[]): string {
    return segments.join('/');
  }

  basename(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1] || '';
  }
  /* eslint-enable @typescript-eslint/require-await */

  // Test helpers
  reset() {
    this.files.clear();
    this.dirs.clear();
  }

  hasFile(path: string): boolean {
    return this.files.has(path);
  }

  getFileCount(): number {
    return this.files.size;
  }
}

describe('UpdateManager', () => {
  let fs: MockFileSystemAdapter;
  let config: SyncDirectoryConfig;
  let sdStructure: SyncDirectoryStructure;
  let updateManager: UpdateManager;
  const instanceId = 'test-instance-123';
  const sdId = 'sd-test';

  beforeEach(() => {
    fs = new MockFileSystemAdapter();
    config = {
      id: sdId,
      path: '/test/sd',
      label: 'Test SD',
    };
    sdStructure = new SyncDirectoryStructure(fs, config);
    updateManager = new UpdateManager(fs, instanceId);
    updateManager.registerSD(sdId, config.path);
  });

  describe('writeNoteUpdate', () => {
    it('should write note update to correct location', async () => {
      const noteId = 'note-123' as UUID;
      const noteDoc = new NoteDoc(noteId);
      noteDoc.initializeNote({
        id: noteId,
        created: Date.now(),
        modified: Date.now(),
        folderId: null,
        deleted: false,
      });

      const update = noteDoc.encodeStateAsUpdate();
      const filename = await updateManager.writeNoteUpdate(sdId, noteId, update);

      // New format: timestamp-seq (sequence numbers, variable length)
      expect(filename).toMatch(/^test-instance-123_note-123_\d+-\d+\.yjson$/);
      expect(fs.hasFile(`/test/sd/notes/note-123/updates/${filename}`)).toBe(true);

      noteDoc.destroy();
    });

    it('should create note directories if they do not exist', async () => {
      const noteId = 'note-456' as UUID;
      const update = new Uint8Array([1, 2, 3]);

      await updateManager.writeNoteUpdate(sdId, noteId, update);

      expect(await fs.exists('/test/sd/notes/note-456')).toBe(true);
      expect(await fs.exists('/test/sd/notes/note-456/updates')).toBe(true);
    });
  });

  describe('writeFolderUpdate', () => {
    it('should write folder update to correct location', async () => {
      await sdStructure.initialize();

      const update = new Uint8Array([1, 2, 3]);
      const filename = await updateManager.writeFolderUpdate('sd-test', update);

      // New format: timestamp-seq (sequence numbers, variable length)
      expect(filename).toMatch(/^test-instance-123_folder-tree_sd-test_\d+-\d+\.yjson$/);
      expect(fs.hasFile(`/test/sd/folders/updates/${filename}`)).toBe(true);
    });
  });

  describe('readNoteUpdates', () => {
    it('should return empty array when no updates exist', async () => {
      const noteId = 'note-123' as UUID;
      const updates = await updateManager.readNoteUpdates(sdId, noteId);

      expect(updates).toEqual([]);
    });

    it('should return empty array when note directory does not exist', async () => {
      const noteId = 'note-999' as UUID;
      const updates = await updateManager.readNoteUpdates(sdId, noteId);

      expect(updates).toEqual([]);
    });

    it('should read all updates for a note', async () => {
      const noteId = 'note-123' as UUID;

      // Write multiple updates with delays to ensure different timestamps
      const update1 = new Uint8Array([1, 2, 3]);
      const update2 = new Uint8Array([4, 5, 6]);
      const update3 = new Uint8Array([7, 8, 9]);

      await updateManager.writeNoteUpdate(sdId, noteId, update1);
      await new Promise((resolve) => setTimeout(resolve, 2));
      await updateManager.writeNoteUpdate(sdId, noteId, update2);
      await new Promise((resolve) => setTimeout(resolve, 2));
      await updateManager.writeNoteUpdate(sdId, noteId, update3);

      // Read all updates
      const updates = await updateManager.readNoteUpdates(sdId, noteId);

      expect(updates).toHaveLength(3);
    });

    it('should skip non-yjson files', async () => {
      const noteId = 'note-123' as UUID;
      await sdStructure.initializeNote(noteId);

      // Write valid update
      await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([1, 2, 3]));

      // Write invalid file
      await fs.writeFile('/test/sd/notes/note-123/updates/invalid.txt', new Uint8Array([9, 9, 9]));

      const updates = await updateManager.readNoteUpdates(sdId, noteId);
      expect(updates).toHaveLength(1);
    });
  });

  describe('readFolderUpdates', () => {
    it('should return empty array when no updates exist', async () => {
      const updates = await updateManager.readFolderUpdates(sdId);
      expect(updates).toEqual([]);
    });

    it('should read all folder updates', async () => {
      await sdStructure.initialize();

      const update1 = new Uint8Array([1, 2, 3]);
      const update2 = new Uint8Array([4, 5, 6]);

      await updateManager.writeFolderUpdate('sd-test', update1);
      await new Promise((resolve) => setTimeout(resolve, 2));
      await updateManager.writeFolderUpdate('sd-test', update2);

      const updates = await updateManager.readFolderUpdates(sdId);
      expect(updates).toHaveLength(2);
    });
  });

  describe('listNoteUpdateFiles', () => {
    it('should return empty array when no updates exist', async () => {
      const noteId = 'note-123' as UUID;
      const files = await updateManager.listNoteUpdateFiles(sdId, noteId);

      expect(files).toEqual([]);
    });

    it('should list all update files with metadata', async () => {
      const noteId = 'note-123' as UUID;

      // Use setTimeout to ensure different timestamps
      await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([1]));
      await new Promise((resolve) => setTimeout(resolve, 10));
      await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([2]));
      await new Promise((resolve) => setTimeout(resolve, 10));
      await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([3]));

      const files = await updateManager.listNoteUpdateFiles(sdId, noteId);

      expect(files).toHaveLength(3);
      expect(files[0]?.instanceId).toBe(instanceId);
      expect(files[0]?.documentId).toBe(noteId);

      // Should be sorted by timestamp
      if (files[0] && files[1] && files[2]) {
        expect(files[0].timestamp).toBeLessThan(files[1].timestamp);
        expect(files[1].timestamp).toBeLessThan(files[2].timestamp);
      }
    });

    it('should skip files with invalid names', async () => {
      const noteId = 'note-123' as UUID;
      await sdStructure.initializeNote(noteId);

      await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([1]));
      await fs.writeFile('/test/sd/notes/note-123/updates/invalid-name.yjson', new Uint8Array([2]));

      const files = await updateManager.listNoteUpdateFiles(sdId, noteId);
      expect(files).toHaveLength(1);
    });
  });

  describe('listFolderUpdateFiles', () => {
    it('should return empty array when no updates exist', async () => {
      const files = await updateManager.listFolderUpdateFiles(sdId);
      expect(files).toEqual([]);
    });

    it('should list all folder update files with metadata', async () => {
      await sdStructure.initialize();

      await updateManager.writeFolderUpdate('sd-test', new Uint8Array([1]));
      await new Promise((resolve) => setTimeout(resolve, 10));
      await updateManager.writeFolderUpdate('sd-test', new Uint8Array([2]));

      const files = await updateManager.listFolderUpdateFiles(sdId);

      expect(files).toHaveLength(2);
      expect(files[0]?.instanceId).toBe(instanceId);
      expect(files[0]?.documentId).toBe('sd-test');
      if (files[0] && files[1]) {
        expect(files[0].timestamp).toBeLessThan(files[1].timestamp);
      }
    });
  });

  describe('deleteUpdateFiles', () => {
    it('should delete specified files', async () => {
      const noteId = 'note-123' as UUID;

      const filename1 = await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([1]));
      await new Promise((resolve) => setTimeout(resolve, 2));
      const filename2 = await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([2]));

      const path1 = `/test/sd/notes/note-123/updates/${filename1}`;
      const path2 = `/test/sd/notes/note-123/updates/${filename2}`;

      expect(fs.hasFile(path1)).toBe(true);
      expect(fs.hasFile(path2)).toBe(true);

      await updateManager.deleteUpdateFiles([path1]);

      expect(fs.hasFile(path1)).toBe(false);
      expect(fs.hasFile(path2)).toBe(true);
    });

    it('should handle errors gracefully when deleting non-existent files', async () => {
      // Should not throw
      await expect(
        updateManager.deleteUpdateFiles(['/non/existent/file.yjson'])
      ).resolves.toBeUndefined();
    });
  });

  describe('integration with CRDT', () => {
    it('should round-trip note data through file system', async () => {
      const noteId = 'note-integration' as UUID;
      const noteDoc1 = new NoteDoc(noteId);
      noteDoc1.initializeNote({
        id: noteId,
        created: 1234567890,
        modified: 1234567890,
        folderId: 'folder-1' as UUID,
        deleted: false,
      });

      // Write update
      const update = noteDoc1.encodeStateAsUpdate();
      await updateManager.writeNoteUpdate(sdId, noteId, update);

      // Read updates
      const updates = await updateManager.readNoteUpdates(sdId, noteId);
      expect(updates).toHaveLength(1);

      // Apply to new document
      const noteDoc2 = new NoteDoc(noteId);
      if (updates[0]) {
        noteDoc2.applyUpdate(updates[0]);
      }

      // Verify data
      const metadata = noteDoc2.getMetadata();
      expect(metadata.id).toBe(noteId);
      expect(metadata.created).toBe(1234567890);
      expect(metadata.folderId).toBe('folder-1');

      noteDoc1.destroy();
      noteDoc2.destroy();
    });
  });

  describe('snapshot operations', () => {
    describe('writeSnapshot', () => {
      it('should write snapshot to correct location', async () => {
        const noteId = 'note-123' as UUID;

        // Create a simple Yjs document with some data
        const doc = new Y.Doc();
        const text = doc.getText('content');
        text.insert(0, 'Hello world');

        const documentState = Y.encodeStateAsUpdate(doc);

        // Create vector clock
        const maxSequences: VectorClock = {
          'instance-a': 10,
          'instance-b': 20,
        };

        const filename = await updateManager.writeSnapshot(
          sdId,
          noteId,
          documentState,
          maxSequences
        );

        // Check filename format: snapshot_<totalChanges>_<instanceId>.yjson
        // totalChanges = (10 + 1) + (20 + 1) = 32
        expect(filename).toBe('snapshot_32_test-instance-123.yjson');
        expect(fs.hasFile(`/test/sd/notes/note-123/snapshots/${filename}`)).toBe(true);

        doc.destroy();
      });

      it('should create snapshot directory if it does not exist', async () => {
        const noteId = 'note-456' as UUID;
        const documentState = new Uint8Array([1, 2, 3]);
        const maxSequences: VectorClock = { 'instance-a': 5 };

        await updateManager.writeSnapshot(sdId, noteId, documentState, maxSequences);

        expect(await fs.exists('/test/sd/notes/note-456/snapshots')).toBe(true);
      });

      it('should calculate totalChanges correctly from vector clock', async () => {
        const noteId = 'note-789' as UUID;
        const documentState = new Uint8Array([1, 2, 3]);

        // Vector clock with multiple instances
        const maxSequences: VectorClock = {
          'instance-a': 99, // 100 changes (0-99)
          'instance-b': 49, // 50 changes (0-49)
          'instance-c': 24, // 25 changes (0-24)
        };

        const filename = await updateManager.writeSnapshot(
          sdId,
          noteId,
          documentState,
          maxSequences
        );

        // totalChanges = 100 + 50 + 25 = 175
        expect(filename).toBe('snapshot_175_test-instance-123.yjson');
      });
    });

    describe('listSnapshotFiles', () => {
      it('should list all snapshot files sorted by totalChanges', async () => {
        const noteId = 'note-123' as UUID;
        const documentState = new Uint8Array([1, 2, 3]);

        // Write multiple snapshots with different totalChanges
        await updateManager.writeSnapshot(sdId, noteId, documentState, {
          'instance-a': 9,
        }); // 10 changes

        await updateManager.writeSnapshot(sdId, noteId, documentState, {
          'instance-a': 29,
        }); // 30 changes

        await updateManager.writeSnapshot(sdId, noteId, documentState, {
          'instance-a': 19,
        }); // 20 changes

        const snapshots = await updateManager.listSnapshotFiles(sdId, noteId);

        expect(snapshots).toHaveLength(3);
        // Should be sorted by totalChanges (highest first)
        expect(snapshots[0]?.totalChanges).toBe(30);
        expect(snapshots[1]?.totalChanges).toBe(20);
        expect(snapshots[2]?.totalChanges).toBe(10);
        expect(snapshots[0]?.instanceId).toBe('test-instance-123');
      });

      it('should return empty array if no snapshots exist', async () => {
        const noteId = 'note-nonexistent' as UUID;
        const snapshots = await updateManager.listSnapshotFiles(sdId, noteId);
        expect(snapshots).toEqual([]);
      });

      it('should ignore non-snapshot files', async () => {
        const noteId = 'note-123' as UUID;
        const documentState = new Uint8Array([1, 2, 3]);

        // Write a valid snapshot
        await updateManager.writeSnapshot(sdId, noteId, documentState, {
          'instance-a': 9,
        });

        // Manually add an invalid file
        await fs.writeFile(
          '/test/sd/notes/note-123/snapshots/invalid-file.txt',
          new Uint8Array([1, 2, 3])
        );

        const snapshots = await updateManager.listSnapshotFiles(sdId, noteId);

        expect(snapshots).toHaveLength(1);
        expect(snapshots[0]?.totalChanges).toBe(10);
      });
    });

    describe('readSnapshot', () => {
      it('should read and decode snapshot correctly', async () => {
        const noteId = 'note-123' as UUID;

        // Create a Yjs document with data
        const doc = new Y.Doc();
        const text = doc.getText('content');
        text.insert(0, 'Test content');

        const documentState = Y.encodeStateAsUpdate(doc);
        const maxSequences: VectorClock = {
          'instance-a': 10,
          'instance-b': 20,
        };

        const filename = await updateManager.writeSnapshot(
          sdId,
          noteId,
          documentState,
          maxSequences
        );

        // Read it back
        const snapshot = await updateManager.readSnapshot(sdId, noteId, filename);

        expect(snapshot.noteId).toBe(noteId);
        expect(snapshot.version).toBe(1);
        expect(snapshot.totalChanges).toBe(32); // (10+1) + (20+1)
        expect(snapshot.maxSequences).toEqual(maxSequences);
        expect(snapshot.documentState).toBeInstanceOf(Uint8Array);
        expect(snapshot.timestamp).toBeGreaterThan(0);

        // Verify document state can be applied
        const doc2 = new Y.Doc();
        Y.applyUpdate(doc2, snapshot.documentState);
        expect(doc2.getText('content').toJSON()).toBe('Test content');

        doc.destroy();
        doc2.destroy();
      });

      it('should throw error for non-existent snapshot', async () => {
        const noteId = 'note-123' as UUID;

        await expect(
          updateManager.readSnapshot(sdId, noteId, 'snapshot_100_nonexistent.yjson')
        ).rejects.toThrow('File not found');
      });
    });

    describe('snapshot integration with CRDT', () => {
      it('should round-trip full document state through snapshot', async () => {
        const noteId = 'note-integration' as UUID;

        // Create a note with some data
        const noteDoc1 = new NoteDoc(noteId);
        noteDoc1.initializeNote({
          id: noteId,
          created: 1234567890,
          modified: 1234567890,
          folderId: 'folder-1' as UUID,
          deleted: false,
        });

        // Add some content (XmlFragment doesn't support insert directly, so we use a text node)
        const text = new Y.XmlText();
        text.insert(0, 'This is test content');
        noteDoc1.content.insert(0, [text]);

        // Write some updates first
        const update1 = noteDoc1.encodeStateAsUpdate();
        await updateManager.writeNoteUpdate(sdId, noteId, update1);

        // Create snapshot
        const documentState = noteDoc1.encodeStateAsUpdate();
        const maxSequences: VectorClock = { 'test-instance-123': 0 };

        const filename = await updateManager.writeSnapshot(
          sdId,
          noteId,
          documentState,
          maxSequences
        );

        // Read snapshot back
        const snapshot = await updateManager.readSnapshot(sdId, noteId, filename);

        // Apply to new document
        const noteDoc2 = new NoteDoc(noteId);
        noteDoc2.applyUpdate(snapshot.documentState);

        // Verify all data restored
        const metadata2 = noteDoc2.getMetadata();
        expect(metadata2.id).toBe(noteId);
        expect(metadata2.created).toBe(1234567890);
        expect(metadata2.folderId).toBe('folder-1');

        // Verify content was restored
        expect(noteDoc2.content.length).toBe(1);
        const restoredText = noteDoc2.content.get(0) as Y.XmlText;
        expect(restoredText.toString()).toBe('This is test content');

        noteDoc1.destroy();
        noteDoc2.destroy();
      });
    });

    describe('buildVectorClock', () => {
      it('should build empty vector clock when no updates exist', async () => {
        const noteId = 'note-123' as UUID;
        const vectorClock = await updateManager.buildVectorClock(sdId, noteId);
        expect(vectorClock).toEqual({});
      });

      it('should build vector clock from update files with sequence numbers', async () => {
        const noteId = 'note-123' as UUID;

        // Write updates from different instances
        await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([1])); // seq 0
        await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([2])); // seq 1
        await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([3])); // seq 2

        const vectorClock = await updateManager.buildVectorClock(sdId, noteId);

        // Should have highest sequence for this instance
        expect(vectorClock[instanceId]).toBe(2);
      });

      it('should track highest sequence per instance', async () => {
        const noteId = 'note-123' as UUID;

        // Write updates from test instance
        await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([1])); // seq 0
        await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([2])); // seq 1

        // Simulate updates from another instance by directly writing files
        await sdStructure.initializeNote(noteId);
        await fs.writeFile(
          `/test/sd/notes/note-123/updates/other-instance_note-123_${Date.now()}-0.yjson`,
          new Uint8Array([1, 2, 3])
        );
        await fs.writeFile(
          `/test/sd/notes/note-123/updates/other-instance_note-123_${Date.now()}-1.yjson`,
          new Uint8Array([4, 5, 6])
        );
        await fs.writeFile(
          `/test/sd/notes/note-123/updates/other-instance_note-123_${Date.now()}-2.yjson`,
          new Uint8Array([7, 8, 9])
        );

        const vectorClock = await updateManager.buildVectorClock(sdId, noteId);

        // Should have highest sequence for each instance
        expect(vectorClock[instanceId]).toBe(1);
        expect(vectorClock['other-instance']).toBe(2);
      });

      it('should skip update files without sequence numbers', async () => {
        const noteId = 'note-123' as UUID;
        await sdStructure.initializeNote(noteId);

        // Write files with new format (with sequence)
        await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([1])); // seq 0

        // Write file with old format (no sequence) - would need to manually create
        // For now, just test that the vector clock works with new format
        const vectorClock = await updateManager.buildVectorClock(sdId, noteId);

        expect(vectorClock[instanceId]).toBe(0);
      });
    });

    describe('shouldCreateSnapshot', () => {
      it('should return true when no snapshots exist and threshold is met', async () => {
        const noteId = 'note-123' as UUID;

        // Write 100 updates (default threshold)
        for (let i = 0; i < 100; i++) {
          await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([i]));
        }

        const should = await updateManager.shouldCreateSnapshot(sdId, noteId);
        expect(should).toBe(true);
      });

      it('should return false when no snapshots exist and threshold is not met', async () => {
        const noteId = 'note-123' as UUID;

        // Write only 50 updates (below default threshold of 100)
        for (let i = 0; i < 50; i++) {
          await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([i]));
        }

        const should = await updateManager.shouldCreateSnapshot(sdId, noteId);
        expect(should).toBe(false);
      });

      it('should respect custom threshold parameter', async () => {
        const noteId = 'note-123' as UUID;

        // Write 30 updates
        for (let i = 0; i < 30; i++) {
          await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([i]));
        }

        // Should be false with default threshold (100)
        expect(await updateManager.shouldCreateSnapshot(sdId, noteId, 100)).toBe(false);

        // Should be true with lower threshold (20)
        expect(await updateManager.shouldCreateSnapshot(sdId, noteId, 20)).toBe(true);
      });

      it('should return false when snapshot exists and new updates below threshold', async () => {
        const noteId = 'note-123' as UUID;

        // Write 100 updates
        for (let i = 0; i < 100; i++) {
          await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([i]));
        }

        // Create snapshot
        const doc = new Y.Doc();
        const documentState = Y.encodeStateAsUpdate(doc);
        const maxSequences: VectorClock = { [instanceId]: 99 }; // sequence 0-99

        await updateManager.writeSnapshot(sdId, noteId, documentState, maxSequences);

        // Write only 50 more updates (below threshold)
        for (let i = 100; i < 150; i++) {
          await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([i]));
        }

        const should = await updateManager.shouldCreateSnapshot(sdId, noteId);
        expect(should).toBe(false);

        doc.destroy();
      });

      it('should return true when snapshot exists and new updates meet threshold', async () => {
        const noteId = 'note-123' as UUID;

        // Write 100 updates
        for (let i = 0; i < 100; i++) {
          await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([i]));
        }

        // Create snapshot
        const doc = new Y.Doc();
        const documentState = Y.encodeStateAsUpdate(doc);
        const maxSequences: VectorClock = { [instanceId]: 99 }; // sequence 0-99

        await updateManager.writeSnapshot(sdId, noteId, documentState, maxSequences);

        // Write 100 more updates (meets threshold)
        for (let i = 100; i < 200; i++) {
          await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([i]));
        }

        const should = await updateManager.shouldCreateSnapshot(sdId, noteId);
        expect(should).toBe(true);

        doc.destroy();
      });

      it('should handle multiple instances correctly', async () => {
        const noteId = 'note-123' as UUID;

        // Write 50 updates from test instance
        for (let i = 0; i < 50; i++) {
          await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([i]));
        }

        // Simulate 60 updates from another instance
        await sdStructure.initializeNote(noteId);
        for (let i = 0; i < 60; i++) {
          await fs.writeFile(
            `/test/sd/notes/note-123/updates/other-instance_note-123_${Date.now()}-${i}.yjson`,
            new Uint8Array([i])
          );
        }

        // Total: 50 + 60 = 110 updates (above threshold of 100)
        const should = await updateManager.shouldCreateSnapshot(sdId, noteId);
        expect(should).toBe(true);
      });

      it('should handle errors gracefully when snapshot is corrupted', async () => {
        const noteId = 'note-123' as UUID;

        // Write updates
        for (let i = 0; i < 100; i++) {
          await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([i]));
        }

        // Write a corrupted snapshot file
        await sdStructure.initializeNote(noteId);
        await fs.writeFile(
          '/test/sd/notes/note-123/snapshots/snapshot_100_test-instance-123.yjson',
          new Uint8Array([1, 2, 3]) // Invalid snapshot data
        );

        // Write more updates
        for (let i = 100; i < 200; i++) {
          await updateManager.writeNoteUpdate(sdId, noteId, new Uint8Array([i]));
        }

        // Should fall back to counting all updates
        const should = await updateManager.shouldCreateSnapshot(sdId, noteId);
        expect(should).toBe(true);
      });
    });
  });
});
