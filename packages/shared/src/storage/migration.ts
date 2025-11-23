/**
 * StorageMigration - Migrate from old update file format to new append-only log format
 *
 * Handles converting .yjson update files to .crdtlog files.
 */

import { LogWriter } from './log-writer';
import { decodeUpdateFile, parseUpdateFilename } from '../crdt/update-format';
import type { FileSystemAdapter } from './types';

/** Result of a migration operation */
export interface StorageMigrationResult {
  success: boolean;
  filesProcessed: number;
  errors: string[];
}

/** Update file info for sorting */
interface UpdateFileInfo {
  filename: string;
  timestamp: number;
  sequence: number;
  data: Uint8Array;
}

export class StorageMigration {
  private readonly fs: FileSystemAdapter;
  private readonly instanceId: string;

  constructor(fs: FileSystemAdapter, instanceId: string) {
    this.fs = fs;
    this.instanceId = instanceId;
  }

  /**
   * Check if migration is needed for a directory.
   * Returns true if any .yjson files exist.
   */
  async checkMigrationNeeded(updatesDir: string): Promise<boolean> {
    try {
      const files = await this.fs.listFiles(updatesDir);
      return files.some((f) => f.endsWith('.yjson'));
    } catch {
      return false;
    }
  }

  /**
   * Migrate a note from old format to new format.
   *
   * @param updatesDir Directory containing old .yjson files
   * @param logsDir Directory for new .crdtlog files
   * @param noteId Note ID for logging
   */
  async migrateNote(
    updatesDir: string,
    logsDir: string,
    noteId: string
  ): Promise<StorageMigrationResult> {
    return this.migrateUpdates(updatesDir, logsDir, noteId);
  }

  /**
   * Migrate folder updates from old format to new format.
   */
  async migrateFolders(updatesDir: string, logsDir: string): Promise<StorageMigrationResult> {
    return this.migrateUpdates(updatesDir, logsDir, 'folders');
  }

  /**
   * Internal migration logic.
   */
  private async migrateUpdates(
    updatesDir: string,
    logsDir: string,
    _documentId: string
  ): Promise<StorageMigrationResult> {
    const result: StorageMigrationResult = {
      success: true,
      filesProcessed: 0,
      errors: [],
    };

    try {
      // List all old format files
      let files: string[];
      try {
        files = await this.fs.listFiles(updatesDir);
      } catch {
        // Directory doesn't exist or is empty
        return result;
      }

      // Filter to only .yjson files
      const yjsonFiles = files.filter((f) => f.endsWith('.yjson'));
      if (yjsonFiles.length === 0) {
        return result;
      }

      // Parse and sort files by timestamp
      const updateInfos: UpdateFileInfo[] = [];

      for (const filename of yjsonFiles) {
        try {
          const metadata = parseUpdateFilename(filename);
          if (!metadata) {
            result.errors.push(`Invalid filename: ${filename}`);
            continue;
          }

          const filePath = this.fs.joinPath(updatesDir, filename);
          const rawData = await this.fs.readFile(filePath);
          const updateData = decodeUpdateFile(rawData);

          updateInfos.push({
            filename,
            timestamp: metadata.timestamp,
            sequence: metadata.sequence ?? 0,
            data: updateData,
          });
        } catch (error) {
          result.errors.push(`Failed to read ${filename}: ${String(error)}`);
        }
      }

      // Sort by timestamp, then sequence
      updateInfos.sort((a, b) => {
        if (a.timestamp !== b.timestamp) {
          return a.timestamp - b.timestamp;
        }
        return a.sequence - b.sequence;
      });

      // Write to new format
      if (updateInfos.length > 0) {
        const writer = new LogWriter(logsDir, this.instanceId, this.fs);

        let sequence = 1;
        for (const info of updateInfos) {
          await writer.appendRecord(info.timestamp, sequence++, info.data);
          result.filesProcessed++;
        }

        await writer.finalize();
      }

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(`Migration failed: ${String(error)}`);
      return result;
    }
  }

  /**
   * Clean up old format files after successful migration.
   * Returns the number of files deleted.
   */
  async cleanupOldFiles(updatesDir: string): Promise<number> {
    let deleted = 0;

    try {
      const files = await this.fs.listFiles(updatesDir);
      const yjsonFiles = files.filter((f) => f.endsWith('.yjson'));

      for (const filename of yjsonFiles) {
        try {
          const filePath = this.fs.joinPath(updatesDir, filename);
          await this.fs.deleteFile(filePath);
          deleted++;
        } catch {
          // Ignore deletion errors
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return deleted;
  }

  /**
   * Full migration of a storage directory.
   * Migrates all notes and folders.
   */
  async migrateStorageDirectory(sdPath: string): Promise<{
    notes: Map<string, StorageMigrationResult>;
    folders: StorageMigrationResult;
    totalFiles: number;
    errors: string[];
  }> {
    const results = {
      notes: new Map<string, StorageMigrationResult>(),
      folders: { success: true, filesProcessed: 0, errors: [] } as StorageMigrationResult,
      totalFiles: 0,
      errors: [] as string[],
    };

    // Migrate notes
    const notesDir = this.fs.joinPath(sdPath, 'notes');
    try {
      const noteIds = await this.fs.listFiles(notesDir);
      for (const noteId of noteIds) {
        // Skip hidden files
        if (noteId.startsWith('.')) continue;

        const updatesDir = this.fs.joinPath(notesDir, noteId, 'updates');
        const logsDir = this.fs.joinPath(notesDir, noteId, 'logs');

        // Create logs directory if needed
        try {
          await this.fs.mkdir(logsDir);
        } catch {
          // May already exist
        }

        const noteResult = await this.migrateNote(updatesDir, logsDir, noteId);
        results.notes.set(noteId, noteResult);
        results.totalFiles += noteResult.filesProcessed;

        if (!noteResult.success) {
          results.errors.push(...noteResult.errors);
        }
      }
    } catch {
      // Notes directory doesn't exist
    }

    // Migrate folders
    const foldersUpdatesDir = this.fs.joinPath(sdPath, 'folders', 'updates');
    const foldersLogsDir = this.fs.joinPath(sdPath, 'folders', 'logs');

    try {
      await this.fs.mkdir(foldersLogsDir);
    } catch {
      // May already exist
    }

    results.folders = await this.migrateFolders(foldersUpdatesDir, foldersLogsDir);
    results.totalFiles += results.folders.filesProcessed;

    if (!results.folders.success) {
      results.errors.push(...results.folders.errors);
    }

    return results;
  }
}
