import type { Database } from '@notecove/shared';
import * as fs from 'fs';
import * as path from 'path';
import * as tar from 'tar';
import * as crypto from 'crypto';

export interface BackupMetadata {
  backupId: string;
  sdUuid: string;
  sdName: string;
  timestamp: number;
  noteCount: number;
  folderCount: number;
  sizeBytes: number;
  type: 'manual' | 'pre-operation';
  isPacked: boolean;
  description?: string;
}

export interface BackupInfo extends BackupMetadata {
  backupPath: string;
}

export class BackupManager {
  private backupDir: string;

  constructor(
    private readonly database: Database,
    private readonly userDataPath: string,
    customBackupPath?: string,
  ) {
    this.backupDir = customBackupPath || path.join(userDataPath, '.backups');
    this.ensureBackupDirectory();
  }

  /**
   * Ensure backup directory exists
   */
  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log(`[BackupManager] Created backup directory: ${this.backupDir}`);
    }
  }

  /**
   * Create a pre-operation snapshot (fast, as-is backup of affected notes only)
   */
  async createPreOperationSnapshot(
    sdId: number,
    noteIds: string[],
    description: string,
  ): Promise<BackupInfo> {
    const sd = await this.database.getStorageDir(sdId);
    if (!sd) {
      throw new Error(`Storage directory ${sdId} not found`);
    }

    const backupId = this.generateBackupId();
    const timestamp = Date.now();
    const backupPath = path.join(this.backupDir, backupId);

    // Create backup directory
    fs.mkdirSync(backupPath, { recursive: true });

    // Copy database file
    const dbBackupPath = path.join(backupPath, 'database.db');
    fs.copyFileSync(path.join(sd.path, 'notecove.db'), dbBackupPath);

    // Copy CRDT files for affected notes only
    const notesBackupDir = path.join(backupPath, 'notes');
    fs.mkdirSync(notesBackupDir, { recursive: true });

    let totalSize = fs.statSync(dbBackupPath).size;

    for (const noteId of noteIds) {
      const sourcePath = path.join(sd.path, 'notes', noteId);
      const targetPath = path.join(notesBackupDir, noteId);

      if (fs.existsSync(sourcePath)) {
        // Copy entire note directory (snapshot + updates)
        this.copyDirectory(sourcePath, targetPath);
        totalSize += this.getDirectorySize(targetPath);
      }
    }

    // Save metadata
    const metadata: BackupMetadata = {
      backupId,
      sdUuid: sd.uuid,
      sdName: sd.name,
      timestamp,
      noteCount: noteIds.length,
      folderCount: 0, // Pre-operation snapshots don't include folder tree
      sizeBytes: totalSize,
      type: 'pre-operation',
      isPacked: false,
      description,
    };

    fs.writeFileSync(
      path.join(backupPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
    );

    console.log(
      `[BackupManager] Created pre-operation snapshot: ${backupId} (${noteIds.length} notes, ${this.formatBytes(totalSize)})`,
    );

    return {
      ...metadata,
      backupPath,
    };
  }

  /**
   * Create a manual backup (full SD backup, optionally packed)
   */
  async createManualBackup(
    sdId: number,
    packAndSnapshot: boolean = false,
    description?: string,
  ): Promise<BackupInfo> {
    const sd = await this.database.getStorageDir(sdId);
    if (!sd) {
      throw new Error(`Storage directory ${sdId} not found`);
    }

    const backupId = this.generateBackupId();
    const timestamp = Date.now();
    const backupPath = path.join(this.backupDir, backupId);

    // Create backup directory
    fs.mkdirSync(backupPath, { recursive: true });

    // Get note and folder counts
    const noteCount = await this.countNotes(sdId);
    const folderCount = await this.countFolders(sdId);

    let totalSize = 0;

    if (packAndSnapshot) {
      // TODO: Implement pack and snapshot logic
      // For now, just copy as-is
      console.log('[BackupManager] Pack and snapshot not yet implemented, copying as-is');
    }

    // Copy database file
    const dbBackupPath = path.join(backupPath, 'database.db');
    fs.copyFileSync(path.join(sd.path, 'notecove.db'), dbBackupPath);
    totalSize += fs.statSync(dbBackupPath).size;

    // Copy all CRDT files
    const notesSourceDir = path.join(sd.path, 'notes');
    const notesBackupDir = path.join(backupPath, 'notes');
    if (fs.existsSync(notesSourceDir)) {
      this.copyDirectory(notesSourceDir, notesBackupDir);
      totalSize += this.getDirectorySize(notesBackupDir);
    }

    // Copy folder tree
    const folderTreeSource = path.join(sd.path, 'folder-tree');
    const folderTreeBackup = path.join(backupPath, 'folder-tree');
    if (fs.existsSync(folderTreeSource)) {
      this.copyDirectory(folderTreeSource, folderTreeBackup);
      totalSize += this.getDirectorySize(folderTreeBackup);
    }

    // Save metadata
    const metadata: BackupMetadata = {
      backupId,
      sdUuid: sd.uuid,
      sdName: sd.name,
      timestamp,
      noteCount,
      folderCount,
      sizeBytes: totalSize,
      type: 'manual',
      isPacked: packAndSnapshot,
      description,
    };

    fs.writeFileSync(
      path.join(backupPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
    );

    console.log(
      `[BackupManager] Created manual backup: ${backupId} (${noteCount} notes, ${folderCount} folders, ${this.formatBytes(totalSize)})`,
    );

    return {
      ...metadata,
      backupPath,
    };
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    const backups: BackupInfo[] = [];

    if (!fs.existsSync(this.backupDir)) {
      return backups;
    }

    const entries = fs.readdirSync(this.backupDir);

    for (const entry of entries) {
      const backupPath = path.join(this.backupDir, entry);
      const metadataPath = path.join(backupPath, 'metadata.json');

      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(
            fs.readFileSync(metadataPath, 'utf-8'),
          ) as BackupMetadata;

          backups.push({
            ...metadata,
            backupPath,
          });
        } catch (error) {
          console.error(
            `[BackupManager] Failed to read metadata for backup ${entry}:`,
            error,
          );
        }
      }
    }

    // Sort by timestamp (newest first)
    return backups.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Restore SD from backup
   */
  async restoreFromBackup(
    backupId: string,
    targetPath: string,
    registerAsNew: boolean = false,
  ): Promise<{ sdId: number; sdPath: string }> {
    const backups = await this.listBackups();
    const backup = backups.find((b) => b.backupId === backupId);

    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    // Ensure target path exists
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    // Check if target path is empty
    const targetContents = fs.readdirSync(targetPath);
    if (targetContents.length > 0) {
      throw new Error(
        `Target path ${targetPath} is not empty. Please choose an empty directory.`,
      );
    }

    // Copy database
    const dbSourcePath = path.join(backup.backupPath, 'database.db');
    const dbTargetPath = path.join(targetPath, 'notecove.db');
    fs.copyFileSync(dbSourcePath, dbTargetPath);

    // Copy notes
    const notesSourceDir = path.join(backup.backupPath, 'notes');
    const notesTargetDir = path.join(targetPath, 'notes');
    if (fs.existsSync(notesSourceDir)) {
      this.copyDirectory(notesSourceDir, notesTargetDir);
    }

    // Copy folder tree
    const folderTreeSource = path.join(backup.backupPath, 'folder-tree');
    const folderTreeTarget = path.join(targetPath, 'folder-tree');
    if (fs.existsSync(folderTreeSource)) {
      this.copyDirectory(folderTreeSource, folderTreeTarget);
    }

    // Create SD_ID file (restore original UUID or generate new one)
    const sdIdPath = path.join(targetPath, 'SD_ID');
    const sdUuid = registerAsNew ? crypto.randomUUID() : backup.sdUuid;
    fs.writeFileSync(sdIdPath, sdUuid);

    // Register SD in database
    const sdId = await this.database.createStorageDir(
      backup.sdName,
      targetPath,
      sdUuid,
    );

    console.log(
      `[BackupManager] Restored backup ${backupId} to ${targetPath} (SD ID: ${sdId})`,
    );

    return { sdId, sdPath: targetPath };
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const backupPath = path.join(this.backupDir, backupId);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup ${backupId} not found`);
    }

    fs.rmSync(backupPath, { recursive: true, force: true });
    console.log(`[BackupManager] Deleted backup: ${backupId}`);
  }

  /**
   * Clean up old pre-operation snapshots (older than 7 days)
   */
  async cleanupOldSnapshots(): Promise<number> {
    const backups = await this.listBackups();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    let deletedCount = 0;

    for (const backup of backups) {
      if (backup.type === 'pre-operation' && backup.timestamp < sevenDaysAgo) {
        await this.deleteBackup(backup.backupId);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(
        `[BackupManager] Cleaned up ${deletedCount} old pre-operation snapshots`,
      );
    }

    return deletedCount;
  }

  /**
   * Helper: Generate unique backup ID
   */
  private generateBackupId(): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `backup-${timestamp}-${random}`;
  }

  /**
   * Helper: Copy directory recursively
   */
  private copyDirectory(source: string, target: string): void {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectory(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }

  /**
   * Helper: Get directory size recursively
   */
  private getDirectorySize(dirPath: string): number {
    let totalSize = 0;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        totalSize += this.getDirectorySize(entryPath);
      } else {
        totalSize += fs.statSync(entryPath).size;
      }
    }

    return totalSize;
  }

  /**
   * Helper: Count notes in SD
   */
  private async countNotes(sdId: number): Promise<number> {
    const result = await this.database
      .getAdapter()
      .get<{ count: number }>(
        'SELECT COUNT(*) as count FROM notes WHERE sd_id = ? AND deleted = 0',
        [sdId],
      );

    return result?.count || 0;
  }

  /**
   * Helper: Count folders in SD
   */
  private async countFolders(sdId: number): Promise<number> {
    // TODO: Implement folder counting
    // For now, return 0
    return 0;
  }

  /**
   * Helper: Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Set custom backup directory
   */
  setBackupDirectory(customPath: string): void {
    this.backupDir = customPath;
    this.ensureBackupDirectory();
    console.log(`[BackupManager] Backup directory changed to: ${customPath}`);
  }

  /**
   * Get current backup directory
   */
  getBackupDirectory(): string {
    return this.backupDir;
  }
}
