import type { Database } from '@notecove/shared';
import * as fs from 'fs';
import * as path from 'path';
import { NoteDoc } from '@notecove/shared';
import * as Y from 'yjs';

export interface DuplicateNote {
  noteId: string;
  noteTitle: string;
  instances: {
    sdId: number;
    sdName: string;
    sdPath: string;
    modifiedAt: string;
    size: number;
    blockCount: number;
    preview: string;
  }[];
}

export interface OrphanedCRDTFile {
  noteId: string;
  sdId: number;
  sdName: string;
  sdPath: string;
  filePath: string;
  title: string;
  preview: string;
  modifiedAt: string;
  size: number;
  blockCount: number;
}

export interface MissingCRDTFile {
  noteId: string;
  noteTitle: string;
  sdId: number;
  sdName: string;
  sdPath: string;
  expectedPath: string;
  lastModified: string;
}

export interface StaleMigrationLock {
  sdId: number;
  sdName: string;
  sdPath: string;
  lockPath: string;
  ageMinutes: number;
  createdAt: string;
}

export interface OrphanedActivityLog {
  instanceId: string;
  sdId: number;
  sdName: string;
  sdPath: string;
  logPath: string;
  lastSeen: string;
  daysSinceLastSeen: number;
  sizeBytes: number;
}

export class DiagnosticsManager {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Detect duplicate notes (same ID in multiple SDs)
   */
  async detectDuplicateNotes(): Promise<DuplicateNote[]> {
    // Find notes with same ID in multiple SDs
    const duplicates = await this.db
      .getAdapter()
      .all<{ note_id: string; count: number; sd_ids: string }>(
        `
      SELECT
        note_id,
        COUNT(*) as count,
        GROUP_CONCAT(sd_id) as sd_ids
      FROM notes
      WHERE deleted = 0
      GROUP BY note_id
      HAVING count > 1
    `
      );

    const results: DuplicateNote[] = [];

    for (const dup of duplicates) {
      const sdIds = dup.sd_ids.split(',').map((id) => parseInt(id, 10));
      const instances: DuplicateNote['instances'] = [];

      for (const sdId of sdIds) {
        // Get SD info
        const sd = await this.db.getAdapter().get<{
          id: number;
          name: string;
          path: string;
        }>('SELECT id, name, path FROM storage_dirs WHERE id = ?', [sdId]);

        if (!sd) continue;

        // Get note metadata
        const note = await this.db.getAdapter().get<{
          title: string;
          modified_at: string;
        }>('SELECT title, modified_at FROM notes WHERE note_id = ? AND sd_id = ?', [dup.note_id, sdId]);

        if (!note) continue;

        // Load CRDT file to get metadata
        const notePath = path.join(sd.path, 'notes', dup.note_id);
        try {
          const { size, blockCount, preview } = this.loadNoteMetadata(notePath);

          instances.push({
            sdId: sd.id,
            sdName: sd.name,
            sdPath: sd.path,
            modifiedAt: note.modified_at,
            size,
            blockCount,
            preview,
          });
        } catch (error) {
          console.error(`[DiagnosticsManager] Failed to load metadata for ${notePath}:`, error);
        }
      }

      if (instances.length > 1) {
        results.push({
          noteId: dup.note_id,
          noteTitle: instances[0]?.preview.substring(0, 50) ?? 'Untitled Note',
          instances,
        });
      }
    }

    return results;
  }

  /**
   * Detect orphaned CRDT files (filesystem files without database entries)
   */
  async detectOrphanedCRDTFiles(): Promise<OrphanedCRDTFile[]> {
    const sds = await this.db
      .getAdapter()
      .all<{ id: number; name: string; path: string }>('SELECT id, name, path FROM storage_dirs');

    const orphaned: OrphanedCRDTFile[] = [];

    for (const sd of sds) {
      const notesDir = path.join(sd.path, 'notes');
      if (!fs.existsSync(notesDir)) continue;

      const noteIds = fs.readdirSync(notesDir);

      for (const noteId of noteIds) {
        // Skip hidden files
        if (noteId.startsWith('.')) continue;

        const notePath = path.join(notesDir, noteId);
        const stat = fs.statSync(notePath);
        if (!stat.isDirectory()) continue;

        // Check if note exists in database
        const exists = await this.db.getAdapter().get<{
          1: number;
        }>('SELECT 1 FROM notes WHERE note_id = ? AND sd_id = ? AND deleted = 0', [noteId, sd.id]);

        if (!exists) {
          try {
            const { size, blockCount, preview, title } = this.loadNoteMetadata(notePath);

            orphaned.push({
              noteId,
              sdId: sd.id,
              sdName: sd.name,
              sdPath: sd.path,
              filePath: notePath,
              title,
              preview,
              modifiedAt: stat.mtime.toISOString(),
              size,
              blockCount,
            });
          } catch (error) {
            console.error(`[DiagnosticsManager] Failed to load orphaned CRDT ${notePath}:`, error);
          }
        }
      }
    }

    return orphaned;
  }

  /**
   * Detect missing CRDT files (database entries without filesystem files)
   */
  async detectMissingCRDTFiles(): Promise<MissingCRDTFile[]> {
    const notes = await this.db.getAdapter().all<{
      note_id: string;
      title: string;
      modified_at: string;
      sd_id: number;
      sd_name: string;
      sd_path: string;
    }>(
      `
      SELECT n.note_id, n.title, n.modified_at, n.sd_id,
             s.name as sd_name, s.path as sd_path
      FROM notes n
      JOIN storage_dirs s ON n.sd_id = s.id
      WHERE n.deleted = 0
    `
    );

    const missing: MissingCRDTFile[] = [];

    for (const note of notes) {
      const notePath = path.join(note.sd_path, 'notes', note.note_id);

      if (!fs.existsSync(notePath)) {
        missing.push({
          noteId: note.note_id,
          noteTitle: note.title,
          sdId: note.sd_id,
          sdName: note.sd_name,
          sdPath: note.sd_path,
          expectedPath: notePath,
          lastModified: note.modified_at,
        });
      }
    }

    return missing;
  }

  /**
   * Detect stale migration locks (older than 1 hour)
   */
  async detectStaleMigrationLocks(): Promise<StaleMigrationLock[]> {
    const sds = await this.db
      .getAdapter()
      .all<{ id: number; name: string; path: string }>('SELECT id, name, path FROM storage_dirs');

    const stale: StaleMigrationLock[] = [];
    const ONE_HOUR_MS = 60 * 60 * 1000;

    for (const sd of sds) {
      const lockPath = path.join(sd.path, '.migration-lock');

      if (fs.existsSync(lockPath)) {
        const stat = fs.statSync(lockPath);
        const ageMs = Date.now() - stat.mtime.getTime();
        const ageMinutes = Math.floor(ageMs / (60 * 1000));

        if (ageMs > ONE_HOUR_MS) {
          stale.push({
            sdId: sd.id,
            sdName: sd.name,
            sdPath: sd.path,
            lockPath,
            ageMinutes,
            createdAt: stat.mtime.toISOString(),
          });
        }
      }
    }

    return stale;
  }

  /**
   * Detect orphaned activity logs (instances not seen in 30+ days)
   */
  async detectOrphanedActivityLogs(): Promise<OrphanedActivityLog[]> {
    const sds = await this.db
      .getAdapter()
      .all<{ id: number; name: string; path: string }>('SELECT id, name, path FROM storage_dirs');

    const orphaned: OrphanedActivityLog[] = [];
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    for (const sd of sds) {
      const activityDir = path.join(sd.path, 'activity');
      if (!fs.existsSync(activityDir)) continue;

      const logFiles = fs.readdirSync(activityDir).filter((f) => f.endsWith('.log'));

      for (const logFile of logFiles) {
        const instanceId = logFile.replace('.log', '');
        const logPath = path.join(activityDir, logFile);

        try {
          // Read last line to get last activity timestamp
          const content = fs.readFileSync(logPath, 'utf-8');
          const lines = content.trim().split('\n');
          const lastLine = lines[lines.length - 1];

          if (!lastLine) continue;

          // Parse timestamp from last line (format: timestamp|event|data)
          const [timestampStr] = lastLine.split('|');
          const timestamp = parseInt(timestampStr ?? '0', 10);

          if (!timestamp) continue;

          const lastSeen = new Date(timestamp);
          const ageMs = Date.now() - lastSeen.getTime();
          const daysSinceLastSeen = Math.floor(ageMs / (24 * 60 * 60 * 1000));

          if (ageMs > THIRTY_DAYS_MS) {
            const stat = fs.statSync(logPath);

            orphaned.push({
              instanceId,
              sdId: sd.id,
              sdName: sd.name,
              sdPath: sd.path,
              logPath,
              lastSeen: lastSeen.toISOString(),
              daysSinceLastSeen,
              sizeBytes: stat.size,
            });
          }
        } catch (error) {
          console.error(`[DiagnosticsManager] Failed to read activity log ${logPath}:`, error);
        }
      }
    }

    return orphaned;
  }

  /**
   * Load note metadata from CRDT file
   */
  private loadNoteMetadata(notePath: string): {
    size: number;
    blockCount: number;
    preview: string;
    title: string;
  } {
    const snapshotPath = path.join(notePath, 'snapshot.yjs');
    const updatesPath = path.join(notePath, 'updates');

    // Calculate total size
    let size = 0;
    if (fs.existsSync(snapshotPath)) {
      size += fs.statSync(snapshotPath).size;
    }
    if (fs.existsSync(updatesPath)) {
      const updateFiles = fs.readdirSync(updatesPath);
      for (const file of updateFiles) {
        size += fs.statSync(path.join(updatesPath, file)).size;
      }
    }

    // Extract note ID from path (last component)
    const noteId = path.basename(notePath);

    // Load CRDT to get content
    const noteDoc = new NoteDoc(noteId);
    const doc = noteDoc.doc;

    // Apply snapshot
    if (fs.existsSync(snapshotPath)) {
      const snapshot = fs.readFileSync(snapshotPath);
      Y.applyUpdate(doc, snapshot);
    }

    // Apply updates
    if (fs.existsSync(updatesPath)) {
      const updateFiles = fs.readdirSync(updatesPath).sort((a, b) => a.localeCompare(b));

      for (const file of updateFiles) {
        const update = fs.readFileSync(path.join(updatesPath, file));
        Y.applyUpdate(doc, update);
      }
    }

    // Extract content
    const contentXml = noteDoc.content;
    const text = contentXml.toJSON();
    const preview = text.substring(0, 200);
    const title = text.split('\n')[0] ?? 'Untitled Note';

    // Count blocks (simplified - count paragraphs)
    const blockCount = contentXml.length;

    return { size, blockCount, preview, title };
  }

  /**
   * Remove a stale migration lock
   */
  async removeStaleMigrationLock(sdId: number): Promise<void> {
    const sd = await this.db
      .getAdapter()
      .get<{ path: string }>('SELECT path FROM storage_dirs WHERE id = ?', [sdId]);

    if (!sd) {
      throw new Error(`Storage directory ${sdId} not found`);
    }

    const lockPath = path.join(sd.path, '.migration-lock');

    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
      console.log(`[DiagnosticsManager] Removed stale migration lock: ${lockPath}`);
    }
  }

  /**
   * Clean up an orphaned activity log
   */
  async cleanupOrphanedActivityLog(sdId: number, instanceId: string): Promise<void> {
    const sd = await this.db
      .getAdapter()
      .get<{ path: string }>('SELECT path FROM storage_dirs WHERE id = ?', [sdId]);

    if (!sd) {
      throw new Error(`Storage directory ${sdId} not found`);
    }

    const logPath = path.join(sd.path, 'activity', `${instanceId}.log`);

    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
      console.log(`[DiagnosticsManager] Removed orphaned activity log: ${logPath}`);
    }
  }

  /**
   * Import an orphaned CRDT file to the database
   */
  async importOrphanedCRDT(noteId: string, sdId: number): Promise<void> {
    const sd = await this.db
      .getAdapter()
      .get<{ path: string }>('SELECT path FROM storage_dirs WHERE id = ?', [sdId]);

    if (!sd) {
      throw new Error(`Storage directory ${sdId} not found`);
    }

    const notePath = path.join(sd.path, 'notes', noteId);

    // Load metadata
    const { title } = this.loadNoteMetadata(notePath);

    // Insert into database
    const now = new Date().toISOString();
    await this.db.getAdapter().exec(
      `
      INSERT INTO notes (note_id, sd_id, folder_id, title, created_at, modified_at, deleted, pinned)
      VALUES (?, ?, NULL, ?, ?, ?, 0, 0)
    `,
      [noteId, sdId, title, now, now]
    );

    console.log(`[DiagnosticsManager] Imported orphaned CRDT: ${noteId} to SD ${sdId}`);
  }

  /**
   * Delete a database entry for a missing CRDT file
   */
  async deleteMissingCRDTEntry(noteId: string, sdId: number): Promise<void> {
    await this.db
      .getAdapter()
      .exec('DELETE FROM notes WHERE note_id = ? AND sd_id = ?', [noteId, sdId]);

    console.log(
      `[DiagnosticsManager] Deleted database entry for missing CRDT: ${noteId} in SD ${sdId}`
    );
  }

  /**
   * Delete one instance of a duplicate note
   */
  async deleteDuplicateNote(noteId: string, sdId: number): Promise<void> {
    const sd = await this.db
      .getAdapter()
      .get<{ path: string }>('SELECT path FROM storage_dirs WHERE id = ?', [sdId]);

    if (!sd) {
      throw new Error(`Storage directory ${sdId} not found`);
    }

    // Delete from database
    await this.db
      .getAdapter()
      .exec('DELETE FROM notes WHERE note_id = ? AND sd_id = ?', [noteId, sdId]);

    // Delete CRDT files
    const notePath = path.join(sd.path, 'notes', noteId);
    if (fs.existsSync(notePath)) {
      fs.rmSync(notePath, { recursive: true, force: true });
    }

    console.log(`[DiagnosticsManager] Deleted duplicate note: ${noteId} from SD ${sdId}`);
  }
}
