/**
 * ImageCleanupManager - Mark-and-sweep garbage collection for orphaned images
 *
 * Detects images that are no longer referenced by any note content and
 * optionally deletes them after a configurable grace period.
 *
 * @see plans/add-images/PLAN-PHASE-7.md
 */

import type { Database } from '@notecove/shared';
import { NoteDoc } from '@notecove/shared';
import * as fs from 'fs';
import * as path from 'path';
import * as Y from 'yjs';

/**
 * Information about an unreferenced image
 */
export interface UnreferencedImage {
  imageId: string;
  sdId: string;
  sdName: string;
  sdPath: string;
  filename: string;
  filePath: string;
  sizeBytes: number;
  /** Unix timestamp when image was created */
  createdAt: number;
  /** True if image is older than grace period and safe to delete */
  safeToDelete: boolean;
  /** Age in days since image was created */
  ageDays: number;
}

/**
 * Statistics from a cleanup operation
 */
export interface CleanupStats {
  sdId: string;
  sdName: string;
  totalImages: number;
  referencedImages: number;
  orphanedImages: number;
  deletedImages: number;
  /** Images within grace period that were skipped */
  skippedImages: number;
  thumbnailsDeleted: number;
  bytesReclaimed: number;
  /** Images that would be deleted (dry run mode) */
  wouldDelete: string[];
  timestamp: number;
}

/**
 * Options for cleanup operation
 */
export interface CleanupOptions {
  /** Number of days after which orphaned images can be deleted (default: 14) */
  gracePeriodDays: number;
  /** If true, don't actually delete anything, just report what would be deleted */
  dryRun: boolean;
}

/**
 * Extract all image references from a Y.XmlFragment
 *
 * Recursively traverses the XML tree to find all notecoveImage nodes
 * and extracts their imageId attributes.
 *
 * @param content The Y.XmlFragment to scan
 * @returns Array of imageIds found in the content
 */
export function extractImageReferencesFromXmlFragment(content: Y.XmlFragment): string[] {
  const imageIds: string[] = [];

  function traverse(element: Y.XmlElement | Y.XmlFragment): void {
    // Check if this element is an image node
    if (element instanceof Y.XmlElement) {
      const nodeName = element.nodeName;
      if (nodeName === 'notecoveImage') {
        const imageId = element.getAttribute('imageId') as string | null | undefined;
        if (imageId && typeof imageId === 'string') {
          imageIds.push(imageId);
        }
      }
    }

    // Recursively process children
    for (let i = 0; i < element.length; i++) {
      const child = element.get(i);
      if (child instanceof Y.XmlElement) {
        traverse(child);
      }
    }
  }

  traverse(content);
  return imageIds;
}

/**
 * ImageCleanupManager handles mark-and-sweep garbage collection for images
 */
export class ImageCleanupManager {
  private db: Database;
  private thumbnailDir: string | null;

  constructor(db: Database, thumbnailDir?: string) {
    this.db = db;
    this.thumbnailDir = thumbnailDir ?? null;
  }

  /**
   * Check if the images table exists in the database
   * This is needed for backwards compatibility with older databases
   * that don't have the images table yet.
   */
  private async imagesTableExists(): Promise<boolean> {
    try {
      const result = await this.db.getAdapter().all<{
        name: string;
      }>(`SELECT name FROM sqlite_master WHERE type='table' AND name='images'`, []);
      return result.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Scan all notes in a sync directory and extract all referenced imageIds
   *
   * @param sdId Sync directory ID
   * @param sdPath Path to sync directory
   * @returns Set of all imageIds referenced in notes
   */
  private async collectReferencedImageIds(sdId: string, sdPath: string): Promise<Set<string>> {
    const referencedIds = new Set<string>();

    // Get all notes for this SD (including soft-deleted ones)
    const notes = await this.db.getAdapter().all<{
      id: string;
    }>(
      `
      SELECT id
      FROM notes
      WHERE sd_id = ?
    `,
      [sdId]
    );

    for (const note of notes) {
      try {
        const notePath = path.join(sdPath, 'notes', note.id);
        const snapshotPath = path.join(notePath, 'snapshot.yjs');
        const updatesDir = path.join(notePath, 'updates');

        // Load note CRDT
        const noteDoc = new NoteDoc(note.id);

        // Apply snapshot if exists
        if (fs.existsSync(snapshotPath)) {
          const snapshot = fs.readFileSync(snapshotPath);
          Y.applyUpdate(noteDoc.doc, snapshot);
        }

        // Apply updates if exist
        if (fs.existsSync(updatesDir)) {
          const updateFiles = fs.readdirSync(updatesDir).sort((a, b) => a.localeCompare(b));
          for (const file of updateFiles) {
            const update = fs.readFileSync(path.join(updatesDir, file));
            Y.applyUpdate(noteDoc.doc, update);
          }
        }

        // Extract image references
        const imageIds = extractImageReferencesFromXmlFragment(noteDoc.content);
        for (const id of imageIds) {
          referencedIds.add(id);
        }

        noteDoc.destroy();
      } catch (error) {
        console.error(`[ImageCleanupManager] Failed to scan note ${note.id}:`, error);
      }
    }

    return referencedIds;
  }

  /**
   * Detect images that are not referenced by any note
   *
   * @param sdId Sync directory ID to scan
   * @param gracePeriodDays Number of days before an orphan is considered safe to delete (default: 14)
   * @returns Array of unreferenced images
   */
  async detectUnreferencedImages(sdId: string, gracePeriodDays = 14): Promise<UnreferencedImage[]> {
    // Check if images table exists (for backwards compatibility)
    if (!(await this.imagesTableExists())) {
      console.log('[ImageCleanupManager] Images table does not exist, skipping cleanup');
      return [];
    }

    // Get SD info
    const sd = await this.db.getAdapter().all<{
      id: string;
      name: string;
      path: string;
    }>('SELECT id, name, path FROM storage_dirs WHERE id = ?', [sdId]);

    if (sd.length === 0) {
      return [];
    }

    const sdInfo = sd[0];
    if (!sdInfo) {
      return [];
    }
    const unreferenced: UnreferencedImage[] = [];

    // Collect all referenced imageIds from notes
    const referencedIds = await this.collectReferencedImageIds(sdId, sdInfo.path);

    // Get all images in database for this SD
    const images = await this.db.getAdapter().all<{
      id: string;
      sd_id: string;
      filename: string;
      created: number;
    }>(
      `
      SELECT id, sd_id, filename, created
      FROM images
      WHERE sd_id = ?
    `,
      [sdId]
    );

    const gracePeriodMs = gracePeriodDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const image of images) {
      // Skip if referenced
      if (referencedIds.has(image.id)) {
        continue;
      }

      // Calculate age
      const createdAt = image.created;
      const ageMs = now - createdAt;
      const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
      const safeToDelete = ageMs > gracePeriodMs;

      // Get file info
      const filePath = path.join(sdInfo.path, 'media', image.filename);
      let sizeBytes = 0;

      if (fs.existsSync(filePath)) {
        try {
          const stat = fs.statSync(filePath);
          sizeBytes = stat.size;
        } catch (error) {
          console.error(`[ImageCleanupManager] Failed to stat ${filePath}:`, error);
        }
      }

      unreferenced.push({
        imageId: image.id,
        sdId: sdInfo.id,
        sdName: sdInfo.name,
        sdPath: sdInfo.path,
        filename: image.filename,
        filePath,
        sizeBytes,
        createdAt: image.created,
        safeToDelete,
        ageDays,
      });
    }

    return unreferenced;
  }

  /**
   * Clean up orphaned images
   *
   * @param sdId Sync directory ID
   * @param options Cleanup options
   * @returns Statistics about the cleanup operation
   */
  async cleanupOrphanedImages(
    sdId: string,
    options: CleanupOptions = { gracePeriodDays: 14, dryRun: false }
  ): Promise<CleanupStats> {
    const { gracePeriodDays, dryRun } = options;

    // Check if images table exists (for backwards compatibility)
    if (!(await this.imagesTableExists())) {
      console.log('[ImageCleanupManager] Images table does not exist, skipping cleanup');
      // Return empty stats for this SD
      return {
        sdId,
        sdName: 'unknown',
        totalImages: 0,
        referencedImages: 0,
        orphanedImages: 0,
        deletedImages: 0,
        skippedImages: 0,
        thumbnailsDeleted: 0,
        bytesReclaimed: 0,
        wouldDelete: [],
        timestamp: Date.now(),
      };
    }

    // Get SD info
    const sds = await this.db.getAdapter().all<{
      id: string;
      name: string;
      path: string;
    }>('SELECT id, name, path FROM storage_dirs WHERE id = ?', [sdId]);

    if (sds.length === 0) {
      throw new Error(`Storage directory ${sdId} not found`);
    }

    const sd = sds[0];
    if (!sd) {
      throw new Error(`Storage directory ${sdId} not found`);
    }

    // Get all images for this SD
    const allImages = await this.db.getAdapter().all<{
      id: string;
    }>('SELECT id FROM images WHERE sd_id = ?', [sdId]);

    // Detect unreferenced images
    const unreferenced = await this.detectUnreferencedImages(sdId, gracePeriodDays);

    // Collect referenced image IDs for stats
    const referencedIds = await this.collectReferencedImageIds(sdId, sd.path);

    const stats: CleanupStats = {
      sdId: sd.id,
      sdName: sd.name,
      totalImages: allImages.length,
      referencedImages: referencedIds.size,
      orphanedImages: unreferenced.length,
      deletedImages: 0,
      skippedImages: 0,
      thumbnailsDeleted: 0,
      bytesReclaimed: 0,
      wouldDelete: [],
      timestamp: Date.now(),
    };

    for (const image of unreferenced) {
      if (image.safeToDelete) {
        if (dryRun) {
          // Just record what would be deleted
          stats.wouldDelete.push(image.imageId);
        } else {
          // Actually delete the image
          try {
            // Delete image file
            if (fs.existsSync(image.filePath)) {
              fs.unlinkSync(image.filePath);
              stats.bytesReclaimed += image.sizeBytes;
              console.log(
                `[ImageCleanupManager] Deleted orphaned image: sdId=${sdId}, imageId=${image.imageId}, age=${image.ageDays} days`
              );
            }

            // Delete thumbnail if exists
            if (this.thumbnailDir) {
              const thumbPath = path.join(this.thumbnailDir, sdId, `${image.imageId}.jpg`);
              if (fs.existsSync(thumbPath)) {
                fs.unlinkSync(thumbPath);
                stats.thumbnailsDeleted++;
                console.log(`[ImageCleanupManager] Deleted orphaned thumbnail: ${thumbPath}`);
              }
            }

            // Delete from database
            await this.db
              .getAdapter()
              .exec('DELETE FROM images WHERE id = ? AND sd_id = ?', [image.imageId, sdId]);

            stats.deletedImages++;
          } catch (error) {
            console.error(`[ImageCleanupManager] Failed to delete ${image.imageId}:`, error);
          }
        }
      } else {
        // Within grace period, skip
        stats.skippedImages++;
      }
    }

    return stats;
  }

  /**
   * Run cleanup on all sync directories
   *
   * @param options Cleanup options
   * @returns Array of cleanup stats, one per SD
   */
  async cleanupAllSyncDirectories(
    options: CleanupOptions = { gracePeriodDays: 14, dryRun: false }
  ): Promise<CleanupStats[]> {
    const sds = await this.db.getAdapter().all<{ id: string }>('SELECT id FROM storage_dirs');

    const results: CleanupStats[] = [];

    for (const sd of sds) {
      try {
        const stats = await this.cleanupOrphanedImages(sd.id, options);
        results.push(stats);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        console.error(
          `[ImageCleanupManager] Failed to cleanup SD ${sd.id}: ${errorMessage}`,
          errorStack
        );
      }
    }

    return results;
  }
}
