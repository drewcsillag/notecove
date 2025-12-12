/**
 * Tests for ImageCleanupManager
 *
 * @see plans/add-images/PLAN-PHASE-7.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { NoteDoc, type Database } from '@notecove/shared';
import * as Y from 'yjs';
import {
  ImageCleanupManager,
  extractImageReferencesFromXmlFragment,
} from '../image-cleanup-manager';

describe('ImageCleanupManager', () => {
  let tempDir: string;
  let mockAdapter: {
    all: jest.Mock;
    get: jest.Mock;
    exec: jest.Mock;
  };
  let mockDb: Database;
  let manager: ImageCleanupManager;

  beforeEach(() => {
    // Create temp directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-cleanup-test-'));

    // Create mock database adapter (cached so mockImplementation persists)
    mockAdapter = {
      all: jest.fn(),
      get: jest.fn(),
      exec: jest.fn(),
    };

    mockDb = {
      getAdapter: () => mockAdapter,
    } as unknown as Database;

    manager = new ImageCleanupManager(mockDb);
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('extractImageReferencesFromXmlFragment', () => {
    it('should extract imageId from notecoveImage node', () => {
      const noteDoc = new NoteDoc('test-note-1');

      // Create an image node manually
      noteDoc.doc.transact(() => {
        const imageNode = new Y.XmlElement('notecoveImage');
        imageNode.setAttribute('imageId', 'img-123');
        imageNode.setAttribute('sdId', '1');
        noteDoc.content.insert(0, [imageNode]);
      });

      const refs = extractImageReferencesFromXmlFragment(noteDoc.content);

      expect(refs).toContain('img-123');
      expect(refs.length).toBe(1);
    });

    it('should extract multiple imageIds from content', () => {
      const noteDoc = new NoteDoc('test-note-2');

      noteDoc.doc.transact(() => {
        // Add paragraph
        const para = new Y.XmlElement('paragraph');
        noteDoc.content.insert(0, [para]);

        // Add first image
        const img1 = new Y.XmlElement('notecoveImage');
        img1.setAttribute('imageId', 'img-aaa');
        img1.setAttribute('sdId', '1');
        noteDoc.content.insert(1, [img1]);

        // Add second image
        const img2 = new Y.XmlElement('notecoveImage');
        img2.setAttribute('imageId', 'img-bbb');
        img2.setAttribute('sdId', '1');
        noteDoc.content.insert(2, [img2]);
      });

      const refs = extractImageReferencesFromXmlFragment(noteDoc.content);

      expect(refs).toContain('img-aaa');
      expect(refs).toContain('img-bbb');
      expect(refs.length).toBe(2);
    });

    it('should return empty array for content with no images', () => {
      const noteDoc = new NoteDoc('test-note-3');

      noteDoc.doc.transact(() => {
        const para = new Y.XmlElement('paragraph');
        const text = new Y.XmlText('Hello world');
        para.insert(0, [text]);
        noteDoc.content.insert(0, [para]);
      });

      const refs = extractImageReferencesFromXmlFragment(noteDoc.content);

      expect(refs).toEqual([]);
    });

    it('should handle nested content with images', () => {
      const noteDoc = new NoteDoc('test-note-4');

      noteDoc.doc.transact(() => {
        // Create a blockquote containing an image
        const blockquote = new Y.XmlElement('blockquote');
        const img = new Y.XmlElement('notecoveImage');
        img.setAttribute('imageId', 'img-nested');
        img.setAttribute('sdId', '1');
        blockquote.insert(0, [img]);
        noteDoc.content.insert(0, [blockquote]);
      });

      const refs = extractImageReferencesFromXmlFragment(noteDoc.content);

      expect(refs).toContain('img-nested');
    });

    it('should skip images without imageId attribute', () => {
      const noteDoc = new NoteDoc('test-note-5');

      noteDoc.doc.transact(() => {
        const img = new Y.XmlElement('notecoveImage');
        // No imageId set
        img.setAttribute('sdId', '1');
        noteDoc.content.insert(0, [img]);
      });

      const refs = extractImageReferencesFromXmlFragment(noteDoc.content);

      expect(refs).toEqual([]);
    });
  });

  describe('detectUnreferencedImages', () => {
    it('should detect images in database not referenced by any note', async () => {
      // Set up SD with notes and media
      const sdPath = path.join(tempDir, 'sd1');
      fs.mkdirSync(path.join(sdPath, 'notes', 'note-1'), { recursive: true });
      fs.mkdirSync(path.join(sdPath, 'media'), { recursive: true });

      // Create a note that references img-used
      const noteDoc = new NoteDoc('note-1');
      noteDoc.doc.transact(() => {
        const img = new Y.XmlElement('notecoveImage');
        img.setAttribute('imageId', 'img-used');
        img.setAttribute('sdId', '1');
        noteDoc.content.insert(0, [img]);
      });

      // Save note CRDT
      const snapshotPath = path.join(sdPath, 'notes', 'note-1', 'snapshot.yjs');
      fs.writeFileSync(snapshotPath, Buffer.from(noteDoc.encodeStateAsUpdate()));

      // Create image files
      fs.writeFileSync(path.join(sdPath, 'media', 'img-used.png'), 'used image');
      fs.writeFileSync(path.join(sdPath, 'media', 'img-orphan.png'), 'orphan image');

      // Mock database
      mockAdapter.all.mockImplementation((sql: string) => {
        if (sql.includes('sqlite_master')) {
          return [{ name: 'images' }];
        }
        if (sql.includes('storage_dirs')) {
          return [{ id: '1', name: 'Test SD', path: sdPath }];
        }
        if (sql.includes('FROM notes')) {
          return [{ id: 'note-1' }];
        }
        if (sql.includes('FROM images')) {
          return [
            {
              id: 'img-used',
              sd_id: '1',
              filename: 'img-used.png',
              created: Date.now(),
            },
            {
              id: 'img-orphan',
              sd_id: '1',
              filename: 'img-orphan.png',
              created: Date.now(),
            },
          ];
        }
        return [];
      });

      const unreferenced = await manager.detectUnreferencedImages('1');

      expect(unreferenced.length).toBe(1);
      expect(unreferenced[0]?.imageId).toBe('img-orphan');
    });

    it('should not mark recently created orphans as safe to delete', async () => {
      const sdPath = path.join(tempDir, 'sd2');
      fs.mkdirSync(path.join(sdPath, 'notes'), { recursive: true });
      fs.mkdirSync(path.join(sdPath, 'media'), { recursive: true });

      // Create orphan image file (recent)
      fs.writeFileSync(path.join(sdPath, 'media', 'img-recent.png'), 'recent orphan');

      // Mock database with recently created image
      // Recent date is handled by Date.now() in the mock
      mockAdapter.all.mockImplementation((sql: string) => {
        if (sql.includes('sqlite_master')) {
          return [{ name: 'images' }];
        }
        if (sql.includes('storage_dirs')) {
          return [{ id: '1', name: 'Test SD', path: sdPath }];
        }
        if (sql.includes('FROM notes')) {
          return [];
        }
        if (sql.includes('FROM images')) {
          return [
            { id: 'img-recent', sd_id: '1', filename: 'img-recent.png', created: Date.now() },
          ];
        }
        return [];
      });

      const unreferenced = await manager.detectUnreferencedImages('1', 14);

      expect(unreferenced.length).toBe(1);
      expect(unreferenced[0]?.safeToDelete).toBe(false);
    });

    it('should mark old orphans as safe to delete', async () => {
      const sdPath = path.join(tempDir, 'sd3');
      fs.mkdirSync(path.join(sdPath, 'notes'), { recursive: true });
      fs.mkdirSync(path.join(sdPath, 'media'), { recursive: true });

      // Create orphan image file
      fs.writeFileSync(path.join(sdPath, 'media', 'img-old.png'), 'old orphan');

      // Mock database with old image (20 days ago)
      const oldDate = Date.now() - 20 * 24 * 60 * 60 * 1000;
      mockAdapter.all.mockImplementation((sql: string) => {
        if (sql.includes('sqlite_master')) {
          return [{ name: 'images' }];
        }
        if (sql.includes('storage_dirs')) {
          return [{ id: '1', name: 'Test SD', path: sdPath }];
        }
        if (sql.includes('FROM notes')) {
          return [];
        }
        if (sql.includes('FROM images')) {
          return [{ id: 'img-old', sd_id: '1', filename: 'img-old.png', created: oldDate }];
        }
        return [];
      });

      const unreferenced = await manager.detectUnreferencedImages('1', 14);

      expect(unreferenced.length).toBe(1);
      expect(unreferenced[0]?.safeToDelete).toBe(true);
    });

    it('should never mark referenced images as unreferenced', async () => {
      const sdPath = path.join(tempDir, 'sd4');
      fs.mkdirSync(path.join(sdPath, 'notes', 'note-1'), { recursive: true });
      fs.mkdirSync(path.join(sdPath, 'media'), { recursive: true });

      // Create a note that references the image
      const noteDoc = new NoteDoc('note-1');
      noteDoc.doc.transact(() => {
        const img = new Y.XmlElement('notecoveImage');
        img.setAttribute('imageId', 'img-ref');
        img.setAttribute('sdId', '1');
        noteDoc.content.insert(0, [img]);
      });

      fs.writeFileSync(
        path.join(sdPath, 'notes', 'note-1', 'snapshot.yjs'),
        Buffer.from(noteDoc.encodeStateAsUpdate())
      );
      fs.writeFileSync(path.join(sdPath, 'media', 'img-ref.png'), 'referenced');

      // Mock database
      const oldDate = Date.now() - 100 * 24 * 60 * 60 * 1000;
      mockAdapter.all.mockImplementation((sql: string) => {
        if (sql.includes('sqlite_master')) {
          return [{ name: 'images' }];
        }
        if (sql.includes('storage_dirs')) {
          return [{ id: '1', name: 'Test SD', path: sdPath }];
        }
        if (sql.includes('FROM notes')) {
          return [{ id: 'note-1' }];
        }
        if (sql.includes('FROM images')) {
          return [{ id: 'img-ref', sd_id: '1', filename: 'img-ref.png', created: oldDate }];
        }
        return [];
      });

      const unreferenced = await manager.detectUnreferencedImages('1');

      expect(unreferenced.length).toBe(0);
    });

    it('should include soft-deleted note references', async () => {
      const sdPath = path.join(tempDir, 'sd5');
      fs.mkdirSync(path.join(sdPath, 'notes', 'deleted-note'), { recursive: true });
      fs.mkdirSync(path.join(sdPath, 'media'), { recursive: true });

      // Create a soft-deleted note that references the image
      const noteDoc = new NoteDoc('deleted-note');
      noteDoc.doc.transact(() => {
        const img = new Y.XmlElement('notecoveImage');
        img.setAttribute('imageId', 'img-in-deleted');
        img.setAttribute('sdId', '1');
        noteDoc.content.insert(0, [img]);
      });

      fs.writeFileSync(
        path.join(sdPath, 'notes', 'deleted-note', 'snapshot.yjs'),
        Buffer.from(noteDoc.encodeStateAsUpdate())
      );
      fs.writeFileSync(path.join(sdPath, 'media', 'img-in-deleted.png'), 'in deleted note');

      // Mock database - include soft-deleted notes
      mockAdapter.all.mockImplementation((sql: string) => {
        if (sql.includes('sqlite_master')) {
          return [{ name: 'images' }];
        }
        if (sql.includes('storage_dirs')) {
          return [{ id: '1', name: 'Test SD', path: sdPath }];
        }
        if (sql.includes('FROM notes')) {
          // Include soft-deleted note
          return [{ id: 'deleted-note' }];
        }
        if (sql.includes('FROM images')) {
          const oldDate = Date.now() - 100 * 24 * 60 * 60 * 1000;
          return [
            {
              id: 'img-in-deleted',
              sd_id: '1',
              filename: 'img-in-deleted.png',
              created: oldDate,
            },
          ];
        }
        return [];
      });

      const unreferenced = await manager.detectUnreferencedImages('1');

      // Image in soft-deleted note should NOT be unreferenced
      expect(unreferenced.length).toBe(0);
    });
  });

  describe('SQL query correctness', () => {
    it('should query notes table using "id" column (not "note_id")', async () => {
      const sdPath = path.join(tempDir, 'sd-sql-test');
      fs.mkdirSync(path.join(sdPath, 'notes'), { recursive: true });
      fs.mkdirSync(path.join(sdPath, 'media'), { recursive: true });

      const capturedQueries: string[] = [];

      mockAdapter.all.mockImplementation((sql: string) => {
        capturedQueries.push(sql);
        if (sql.includes('sqlite_master')) {
          return [{ name: 'images' }];
        }
        if (sql.includes('storage_dirs')) {
          return [{ id: '1', name: 'Test SD', path: sdPath }];
        }
        if (sql.includes('FROM notes')) {
          return [{ id: 'test-note' }];
        }
        if (sql.includes('FROM images')) {
          return [];
        }
        return [];
      });

      await manager.detectUnreferencedImages('1');

      // Find the notes query
      const notesQuery = capturedQueries.find((q) => q.includes('FROM notes'));
      expect(notesQuery).toBeDefined();
      // Should use "SELECT id" not "SELECT note_id"
      expect(notesQuery).toMatch(/SELECT\s+id/i);
      expect(notesQuery).not.toMatch(/SELECT\s+note_id/i);
    });

    it('should query storage_dirs with string id type', async () => {
      const sdPath = path.join(tempDir, 'sd-type-test');
      fs.mkdirSync(path.join(sdPath, 'notes'), { recursive: true });
      fs.mkdirSync(path.join(sdPath, 'media'), { recursive: true });

      let sdIdParam: unknown;

      mockAdapter.all.mockImplementation((sql: string, params?: unknown[]) => {
        if (sql.includes('sqlite_master')) {
          return [{ name: 'images' }];
        }
        if (sql.includes('storage_dirs') && params) {
          sdIdParam = params[0];
          return [{ id: 'test-sd', name: 'Test SD', path: sdPath }];
        }
        if (sql.includes('FROM notes')) {
          return [];
        }
        if (sql.includes('FROM images')) {
          return [];
        }
        return [];
      });

      // Pass string sdId
      await manager.detectUnreferencedImages('test-sd');

      // Verify string was passed, not number
      expect(typeof sdIdParam).toBe('string');
      expect(sdIdParam).toBe('test-sd');
    });
  });

  describe('cleanupOrphanedImages', () => {
    it('should delete unreferenced images that are safe to delete', async () => {
      const sdPath = path.join(tempDir, 'sd-cleanup');
      fs.mkdirSync(path.join(sdPath, 'notes'), { recursive: true });
      fs.mkdirSync(path.join(sdPath, 'media'), { recursive: true });

      // Create orphan image
      const orphanPath = path.join(sdPath, 'media', 'img-orphan.png');
      fs.writeFileSync(orphanPath, 'orphan');

      // Mock database
      const oldDate = Date.now() - 20 * 24 * 60 * 60 * 1000;
      mockAdapter.all.mockImplementation((sql: string) => {
        if (sql.includes('sqlite_master')) {
          return [{ name: 'images' }];
        }
        if (sql.includes('storage_dirs')) {
          return [{ id: '1', name: 'Test SD', path: sdPath }];
        }
        if (sql.includes('FROM notes')) {
          return [];
        }
        if (sql.includes('FROM images')) {
          return [{ id: 'img-orphan', sd_id: '1', filename: 'img-orphan.png', created: oldDate }];
        }
        return [];
      });
      mockAdapter.exec.mockResolvedValue(undefined);

      const stats = await manager.cleanupOrphanedImages('1', {
        gracePeriodDays: 14,
        dryRun: false,
      });

      // File should be deleted
      expect(fs.existsSync(orphanPath)).toBe(false);
      expect(stats.deletedImages).toBe(1);
      expect(stats.bytesReclaimed).toBeGreaterThan(0);
    });

    it('should not delete images in dry run mode', async () => {
      const sdPath = path.join(tempDir, 'sd-dryrun');
      fs.mkdirSync(path.join(sdPath, 'notes'), { recursive: true });
      fs.mkdirSync(path.join(sdPath, 'media'), { recursive: true });

      // Create orphan image
      const orphanPath = path.join(sdPath, 'media', 'img-orphan.png');
      fs.writeFileSync(orphanPath, 'orphan');

      // Mock database
      const oldDate = Date.now() - 20 * 24 * 60 * 60 * 1000;
      mockAdapter.all.mockImplementation((sql: string) => {
        if (sql.includes('sqlite_master')) {
          return [{ name: 'images' }];
        }
        if (sql.includes('storage_dirs')) {
          return [{ id: '1', name: 'Test SD', path: sdPath }];
        }
        if (sql.includes('FROM notes')) {
          return [];
        }
        if (sql.includes('FROM images')) {
          return [{ id: 'img-orphan', sd_id: '1', filename: 'img-orphan.png', created: oldDate }];
        }
        return [];
      });

      const stats = await manager.cleanupOrphanedImages('1', { gracePeriodDays: 14, dryRun: true });

      // File should NOT be deleted in dry run
      expect(fs.existsSync(orphanPath)).toBe(true);
      expect(stats.deletedImages).toBe(0);
      expect(stats.wouldDelete.length).toBe(1);
      expect(stats.wouldDelete[0]).toBe('img-orphan');
    });

    it('should skip images within grace period', async () => {
      const sdPath = path.join(tempDir, 'sd-grace');
      fs.mkdirSync(path.join(sdPath, 'notes'), { recursive: true });
      fs.mkdirSync(path.join(sdPath, 'media'), { recursive: true });

      // Create recent orphan image
      const orphanPath = path.join(sdPath, 'media', 'img-recent.png');
      fs.writeFileSync(orphanPath, 'recent orphan');

      // Mock database with recent image
      // Recent date is handled by Date.now() in the mock
      mockAdapter.all.mockImplementation((sql: string) => {
        if (sql.includes('sqlite_master')) {
          return [{ name: 'images' }];
        }
        if (sql.includes('storage_dirs')) {
          return [{ id: '1', name: 'Test SD', path: sdPath }];
        }
        if (sql.includes('FROM notes')) {
          return [];
        }
        if (sql.includes('FROM images')) {
          return [
            { id: 'img-recent', sd_id: '1', filename: 'img-recent.png', created: Date.now() },
          ];
        }
        return [];
      });

      const stats = await manager.cleanupOrphanedImages('1', {
        gracePeriodDays: 14,
        dryRun: false,
      });

      // File should NOT be deleted (within grace period)
      expect(fs.existsSync(orphanPath)).toBe(true);
      expect(stats.deletedImages).toBe(0);
      expect(stats.skippedImages).toBe(1);
    });

    it('should also delete corresponding thumbnails', async () => {
      const sdPath = path.join(tempDir, 'sd-thumbs');
      const thumbnailDir = path.join(tempDir, 'thumbnails');
      fs.mkdirSync(path.join(sdPath, 'notes'), { recursive: true });
      fs.mkdirSync(path.join(sdPath, 'media'), { recursive: true });
      fs.mkdirSync(thumbnailDir, { recursive: true });

      // Create orphan image and thumbnail
      const orphanPath = path.join(sdPath, 'media', 'img-orphan.png');
      const thumbPath = path.join(thumbnailDir, '1', 'img-orphan.jpg');
      fs.mkdirSync(path.dirname(thumbPath), { recursive: true });
      fs.writeFileSync(orphanPath, 'orphan');
      fs.writeFileSync(thumbPath, 'thumbnail');

      // Create manager with thumbnail path
      const managerWithThumbs = new ImageCleanupManager(mockDb, thumbnailDir);

      // Mock database
      const oldDate = Date.now() - 20 * 24 * 60 * 60 * 1000;
      mockAdapter.all.mockImplementation((sql: string) => {
        if (sql.includes('sqlite_master')) {
          return [{ name: 'images' }];
        }
        if (sql.includes('storage_dirs')) {
          return [{ id: '1', name: 'Test SD', path: sdPath }];
        }
        if (sql.includes('FROM notes')) {
          return [];
        }
        if (sql.includes('FROM images')) {
          return [{ id: 'img-orphan', sd_id: '1', filename: 'img-orphan.png', created: oldDate }];
        }
        return [];
      });
      mockAdapter.exec.mockResolvedValue(undefined);

      const stats = await managerWithThumbs.cleanupOrphanedImages('1', {
        gracePeriodDays: 14,
        dryRun: false,
      });

      // Both image and thumbnail should be deleted
      expect(fs.existsSync(orphanPath)).toBe(false);
      expect(fs.existsSync(thumbPath)).toBe(false);
      expect(stats.thumbnailsDeleted).toBe(1);
    });
  });
});
