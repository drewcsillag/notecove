import type { Database } from '@notecove/shared';
import * as fs from 'fs';
import * as path from 'path';
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
  private userDataPath: string;
  private onNewStorageDir?: (sdId: string, sdPath: string) => Promise<void>;

  constructor(
    private readonly database: Database,
    userDataPath: string,
    customBackupPath?: string,
    onNewStorageDir?: (sdId: string, sdPath: string) => Promise<void>
  ) {
    this.userDataPath = userDataPath;
    this.backupDir = customBackupPath ?? path.join(userDataPath, '.backups');
    if (onNewStorageDir) {
      this.onNewStorageDir = onNewStorageDir;
    }
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
   * Check for duplicate note/folder UUIDs in currently loaded SDs
   */
  private async checkForDuplicates(backupPath: string): Promise<{
    hasConflicts: boolean;
    duplicateNotes: string[];
    duplicateFolders: string[];
    conflictingSds: { id: string; name: string; path: string }[];
  }> {
    const duplicateNotes: string[] = [];
    const duplicateFolders: string[] = [];
    const conflictingSdIds = new Set<string>();

    // Scan backup's notes directory
    const notesDir = path.join(backupPath, 'notes');
    if (fs.existsSync(notesDir)) {
      const noteIds = fs.readdirSync(notesDir).filter((id) => !id.startsWith('.'));

      for (const noteId of noteIds) {
        // Skip the default welcome note - every SD has one with the same UUID
        if (noteId === 'default-note') {
          continue;
        }

        // Check if this note ID already exists in the database
        const existingNote = await this.database.getNote(noteId);
        if (existingNote) {
          // Verify the SD still exists (skip orphaned notes from deleted SDs)
          const sd = await this.database.getStorageDir(existingNote.sdId);
          if (sd) {
            duplicateNotes.push(noteId);
            conflictingSdIds.add(existingNote.sdId);
          }
        }
      }
    }

    // Scan backup's folders directory
    const foldersDir = path.join(backupPath, 'folders');
    if (fs.existsSync(foldersDir)) {
      const folderIds = fs.readdirSync(foldersDir).filter((id) => !id.startsWith('.'));

      for (const folderId of folderIds) {
        // Check if this folder ID already exists in the database
        const existingFolder = await this.database.getFolder(folderId);
        if (existingFolder) {
          // Verify the SD still exists (skip orphaned folders from deleted SDs)
          const sd = await this.database.getStorageDir(existingFolder.sdId);
          if (sd) {
            duplicateFolders.push(folderId);
            conflictingSdIds.add(existingFolder.sdId);
          }
        }
      }
    }

    // Get info about conflicting SDs
    const conflictingSds = [];
    for (const sdId of conflictingSdIds) {
      const sd = await this.database.getStorageDir(sdId);
      if (sd) {
        conflictingSds.push({ id: sd.id, name: sd.name, path: sd.path });
      }
    }

    return {
      hasConflicts: duplicateNotes.length > 0 || duplicateFolders.length > 0,
      duplicateNotes,
      duplicateFolders,
      conflictingSds,
    };
  }

  /**
   * Create a pre-operation snapshot (fast, as-is backup of affected notes only)
   */
  async createPreOperationSnapshot(
    sdId: string,
    noteIds: string[],
    description: string
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
      sdUuid: sd.uuid ?? '',
      sdName: sd.name,
      timestamp,
      noteCount: noteIds.length,
      folderCount: 0, // Pre-operation snapshots don't include folder tree
      sizeBytes: totalSize,
      type: 'pre-operation',
      isPacked: false,
      description,
    };

    fs.writeFileSync(path.join(backupPath, 'metadata.json'), JSON.stringify(metadata, null, 2));

    console.log(
      `[BackupManager] Created pre-operation snapshot: ${backupId} (${noteIds.length} notes, ${this.formatBytes(totalSize)})`
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
    sdId: string,
    packAndSnapshot = false,
    description?: string,
    customBackupPath?: string
  ): Promise<BackupInfo> {
    const sd = await this.database.getStorageDir(sdId);
    if (!sd) {
      throw new Error(`Storage directory ${sdId} not found`);
    }

    const backupId = this.generateBackupId();
    const timestamp = Date.now();
    const backupRoot = customBackupPath ?? this.backupDir;
    const backupPath = path.join(backupRoot, backupId);

    console.log(`[BackupManager] Creating backup for SD ${sd.name}`);
    console.log(`[BackupManager] Backup root: ${backupRoot}`);
    console.log(`[BackupManager] Backup path: ${backupPath}`);
    console.log(`[BackupManager] Source SD path: ${sd.path}`);

    // Ensure backup path exists (this will create all parent directories too)
    console.log(`[BackupManager] Creating backup directory: ${backupPath}`);
    try {
      fs.mkdirSync(backupPath, { recursive: true });
      console.log(`[BackupManager] Successfully created backup directory`);

      // Verify it exists
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup directory was created but does not exist: ${backupPath}`);
      }
      console.log(`[BackupManager] Verified backup directory exists`);
    } catch (error) {
      console.error(`[BackupManager] Failed to create backup directory:`, error);
      throw error;
    }

    // Get note and folder counts
    const noteCount = await this.countNotes(sdId);
    const folderCount = this.countFolders(sdId);

    let totalSize = 0;

    if (packAndSnapshot) {
      // TODO: Implement pack and snapshot logic
      // For now, just copy as-is
      console.log('[BackupManager] Pack and snapshot not yet implemented, copying as-is');
    }

    // Copy database file (from user data directory, not SD path)
    const dbSourcePath = path.join(this.userDataPath, 'notecove.db');
    const dbBackupPath = path.join(backupPath, 'database.db');

    console.log(`[BackupManager] Copying database from ${dbSourcePath} to ${dbBackupPath}`);

    // Verify source exists
    if (!fs.existsSync(dbSourcePath)) {
      throw new Error(`Source database file does not exist: ${dbSourcePath}`);
    }

    // Verify destination directory exists
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup directory does not exist: ${backupPath}`);
    }

    try {
      fs.copyFileSync(dbSourcePath, dbBackupPath);
      console.log(`[BackupManager] Successfully copied database file`);
    } catch (error) {
      console.error(`[BackupManager] Failed to copy database file:`, error);
      throw error;
    }

    totalSize += fs.statSync(dbBackupPath).size;

    // Copy all CRDT files
    const notesSourceDir = path.join(sd.path, 'notes');
    const notesBackupDir = path.join(backupPath, 'notes');
    if (fs.existsSync(notesSourceDir)) {
      this.copyDirectory(notesSourceDir, notesBackupDir);
      totalSize += this.getDirectorySize(notesBackupDir);
    }

    // Copy folders directory
    const foldersSource = path.join(sd.path, 'folders');
    const foldersBackup = path.join(backupPath, 'folders');
    if (fs.existsSync(foldersSource)) {
      this.copyDirectory(foldersSource, foldersBackup);
      totalSize += this.getDirectorySize(foldersBackup);
    }

    // Copy folder tree
    const folderTreeSource = path.join(sd.path, 'folder-tree');
    const folderTreeBackup = path.join(backupPath, 'folder-tree');
    if (fs.existsSync(folderTreeSource)) {
      this.copyDirectory(folderTreeSource, folderTreeBackup);
      totalSize += this.getDirectorySize(folderTreeBackup);
    }

    // Copy activity directory (if exists)
    const activitySource = path.join(sd.path, '.activity');
    const activityBackup = path.join(backupPath, '.activity');
    if (fs.existsSync(activitySource)) {
      this.copyDirectory(activitySource, activityBackup);
      totalSize += this.getDirectorySize(activityBackup);
    }

    // Copy SD_VERSION file (if exists)
    const versionSource = path.join(sd.path, 'SD_VERSION');
    const versionBackup = path.join(backupPath, 'SD_VERSION');
    if (fs.existsSync(versionSource)) {
      fs.copyFileSync(versionSource, versionBackup);
      totalSize += fs.statSync(versionBackup).size;
    }

    // Save metadata
    const metadata: BackupMetadata = {
      backupId,
      sdUuid: sd.uuid ?? '',
      sdName: sd.name,
      timestamp,
      noteCount,
      folderCount,
      sizeBytes: totalSize,
      type: 'manual',
      isPacked: packAndSnapshot,
      ...(description !== undefined && { description }),
    };

    fs.writeFileSync(path.join(backupPath, 'metadata.json'), JSON.stringify(metadata, null, 2));

    console.log(
      `[BackupManager] Created manual backup: ${backupId} (${noteCount} notes, ${folderCount} folders, ${this.formatBytes(totalSize)})`
    );

    return {
      ...metadata,
      backupPath,
    };
  }

  /**
   * List all available backups
   */
  listBackups(): BackupInfo[] {
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
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as BackupMetadata;

          backups.push({
            ...metadata,
            backupPath,
          });
        } catch (error) {
          console.error(`[BackupManager] Failed to read metadata for backup ${entry}:`, error);
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
    registerAsNew = false
  ): Promise<{ sdId: string; sdPath: string }> {
    const backups = this.listBackups();
    const backup = backups.find((b) => b.backupId === backupId);

    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    // Check for duplicate SD UUID if not registering as new
    if (!registerAsNew) {
      const existingSd = await this.database.getStorageDirByUuid(backup.sdUuid);
      if (existingSd) {
        throw new Error(
          `Cannot restore: A storage directory with UUID "${backup.sdUuid}" already exists (name: "${existingSd.name}", path: "${existingSd.path}"). ` +
            `Please unload that storage directory first, or check "Register as new SD" to restore as a separate copy.`
        );
      }
    }

    // Check for duplicate notes and folders
    const duplicateCheck = await this.checkForDuplicates(backup.backupPath);
    if (duplicateCheck.hasConflicts) {
      const sdNames = Array.from(new Set(duplicateCheck.conflictingSds.map((sd) => sd.name))).join(
        ', '
      );
      const noteCount = duplicateCheck.duplicateNotes.length;
      const folderCount = duplicateCheck.duplicateFolders.length;

      let errorMsg = `Cannot restore: Found ${noteCount} duplicate note(s) and ${folderCount} duplicate folder(s) that already exist in the following storage director${duplicateCheck.conflictingSds.length > 1 ? 'ies' : 'y'}: ${sdNames}.\n\n`;
      errorMsg += `Please unload the conflicting storage director${duplicateCheck.conflictingSds.length > 1 ? 'ies' : 'y'} before restoring this backup.`;

      throw new Error(errorMsg);
    }

    // Ensure target path exists
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    // Check if target path is empty
    const targetContents = fs.readdirSync(targetPath);
    if (targetContents.length > 0) {
      throw new Error(`Target path ${targetPath} is not empty. Please choose an empty directory.`);
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

    // Copy folders
    const foldersSource = path.join(backup.backupPath, 'folders');
    const foldersTarget = path.join(targetPath, 'folders');
    if (fs.existsSync(foldersSource)) {
      this.copyDirectory(foldersSource, foldersTarget);
    }

    // Copy folder tree
    const folderTreeSource = path.join(backup.backupPath, 'folder-tree');
    const folderTreeTarget = path.join(targetPath, 'folder-tree');
    if (fs.existsSync(folderTreeSource)) {
      this.copyDirectory(folderTreeSource, folderTreeTarget);
    }

    // Copy activity directory (if exists)
    const activitySource = path.join(backup.backupPath, '.activity');
    const activityTarget = path.join(targetPath, '.activity');
    if (fs.existsSync(activitySource)) {
      this.copyDirectory(activitySource, activityTarget);
    }

    // Copy SD_VERSION file (if exists)
    const versionSource = path.join(backup.backupPath, 'SD_VERSION');
    const versionTarget = path.join(targetPath, 'SD_VERSION');
    if (fs.existsSync(versionSource)) {
      fs.copyFileSync(versionSource, versionTarget);
    }

    // Create SD_ID file (restore original UUID or generate new one)
    const sdIdPath = path.join(targetPath, 'SD_ID');
    const sdUuid = registerAsNew ? crypto.randomUUID() : backup.sdUuid;
    fs.writeFileSync(sdIdPath, sdUuid);

    // Determine the SD name (add suffix if registering as new to avoid name conflicts)
    const sdName = registerAsNew ? `${backup.sdName} (Restored)` : backup.sdName;

    // Register SD in database
    let sd;
    try {
      sd = await this.database.createStorageDir(sdUuid, sdName, targetPath);
    } catch (error) {
      // Check if this is a UNIQUE constraint error
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        // Find which SD has the conflicting name or path
        const allSDs = await this.database.getAllStorageDirs();
        const conflictingSD = allSDs.find(
          (existingSd) => existingSd.name === sdName || existingSd.path === targetPath
        );

        if (conflictingSD) {
          if (conflictingSD.name === sdName) {
            throw new Error(
              `A storage directory with the name "${sdName}" already exists at "${conflictingSD.path}". ` +
                `Please unload that storage directory first, or choose "Register as new SD" to restore with a different name.`
            );
          } else if (conflictingSD.path === targetPath) {
            throw new Error(
              `A storage directory named "${conflictingSD.name}" is already registered at path "${targetPath}". ` +
                `Please unload that storage directory first, or choose a different restore location.`
            );
          }
        }
        // If we couldn't find the conflicting SD, throw a generic error
        throw new Error(
          `Cannot register storage directory: A storage directory with the same name or path already exists. ` +
            `Please unload any existing storage directories with the name "${sdName}" or path "${targetPath}" first.`
        );
      }
      // Re-throw other errors
      throw error;
    }

    console.log(`[BackupManager] Restored backup ${backupId} to ${targetPath} (SD ID: ${sd.id})`);

    // Initialize the restored SD (load notes into cache, set up watchers, etc.)
    if (this.onNewStorageDir) {
      console.log(`[BackupManager] Initializing restored SD: ${sd.id}`);
      await this.onNewStorageDir(sd.id, targetPath);
      console.log(`[BackupManager] SD initialization complete`);
    }

    return { sdId: sd.id, sdPath: targetPath };
  }

  /**
   * Restore SD from a custom backup path (not in the managed backups directory)
   */
  async restoreFromCustomPath(
    backupPath: string,
    targetPath: string,
    registerAsNew = false
  ): Promise<{ sdId: string; sdPath: string }> {
    // Verify backup path exists
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup path does not exist: ${backupPath}`);
    }

    // Read metadata to get backup info
    const metadataPath = path.join(backupPath, 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      throw new Error(`Invalid backup: metadata.json not found in ${backupPath}`);
    }

    let backup: BackupMetadata;
    try {
      backup = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as BackupMetadata;
    } catch (error) {
      throw new Error(
        `Failed to read backup metadata: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Check for duplicate SD UUID if not registering as new
    if (!registerAsNew) {
      const existingSd = await this.database.getStorageDirByUuid(backup.sdUuid);
      if (existingSd) {
        throw new Error(
          `Cannot restore: A storage directory with UUID "${backup.sdUuid}" already exists (name: "${existingSd.name}", path: "${existingSd.path}"). ` +
            `Please unload that storage directory first, or check "Register as new SD" to restore as a separate copy.`
        );
      }
    }

    // Check for duplicate notes and folders
    const duplicateCheck = await this.checkForDuplicates(backupPath);
    if (duplicateCheck.hasConflicts) {
      const sdNames = Array.from(new Set(duplicateCheck.conflictingSds.map((sd) => sd.name))).join(
        ', '
      );
      const noteCount = duplicateCheck.duplicateNotes.length;
      const folderCount = duplicateCheck.duplicateFolders.length;

      let errorMsg = `Cannot restore: Found ${noteCount} duplicate note(s) and ${folderCount} duplicate folder(s) that already exist in the following storage director${duplicateCheck.conflictingSds.length > 1 ? 'ies' : 'y'}: ${sdNames}.\n\n`;
      errorMsg += `Please unload the conflicting storage director${duplicateCheck.conflictingSds.length > 1 ? 'ies' : 'y'} before restoring this backup.`;

      throw new Error(errorMsg);
    }

    // Ensure target path exists
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    // Check if target path is empty
    const targetContents = fs.readdirSync(targetPath);
    if (targetContents.length > 0) {
      throw new Error(`Target path ${targetPath} is not empty. Please choose an empty directory.`);
    }

    // Copy database
    const dbSourcePath = path.join(backupPath, 'database.db');
    const dbTargetPath = path.join(targetPath, 'notecove.db');
    if (!fs.existsSync(dbSourcePath)) {
      throw new Error(`Backup is missing database.db file`);
    }
    fs.copyFileSync(dbSourcePath, dbTargetPath);

    // Copy notes
    const notesSourceDir = path.join(backupPath, 'notes');
    const notesTargetDir = path.join(targetPath, 'notes');
    if (fs.existsSync(notesSourceDir)) {
      this.copyDirectory(notesSourceDir, notesTargetDir);
    }

    // Copy folders
    const foldersSource = path.join(backupPath, 'folders');
    const foldersTarget = path.join(targetPath, 'folders');
    if (fs.existsSync(foldersSource)) {
      this.copyDirectory(foldersSource, foldersTarget);
    }

    // Copy folder tree
    const folderTreeSource = path.join(backupPath, 'folder-tree');
    const folderTreeTarget = path.join(targetPath, 'folder-tree');
    if (fs.existsSync(folderTreeSource)) {
      this.copyDirectory(folderTreeSource, folderTreeTarget);
    }

    // Copy activity directory (if exists)
    const activitySource = path.join(backupPath, '.activity');
    const activityTarget = path.join(targetPath, '.activity');
    if (fs.existsSync(activitySource)) {
      this.copyDirectory(activitySource, activityTarget);
    }

    // Copy SD_VERSION file (if exists)
    const versionSource = path.join(backupPath, 'SD_VERSION');
    const versionTarget = path.join(targetPath, 'SD_VERSION');
    if (fs.existsSync(versionSource)) {
      fs.copyFileSync(versionSource, versionTarget);
    }

    // Create SD_ID file (restore original UUID or generate new one)
    const sdIdPath = path.join(targetPath, 'SD_ID');
    const sdUuid = registerAsNew ? crypto.randomUUID() : backup.sdUuid;
    fs.writeFileSync(sdIdPath, sdUuid);

    // Determine the SD name (add suffix if registering as new to avoid name conflicts)
    const sdName = registerAsNew ? `${backup.sdName} (Restored)` : backup.sdName;

    // Register SD in database
    let sd;
    try {
      sd = await this.database.createStorageDir(sdUuid, sdName, targetPath);
    } catch (error) {
      // Check if this is a UNIQUE constraint error
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        // Find which SD has the conflicting name or path
        const allSDs = await this.database.getAllStorageDirs();
        const conflictingSD = allSDs.find(
          (existingSd) => existingSd.name === sdName || existingSd.path === targetPath
        );

        if (conflictingSD) {
          if (conflictingSD.name === sdName) {
            throw new Error(
              `A storage directory with the name "${sdName}" already exists at "${conflictingSD.path}". ` +
                `Please unload that storage directory first, or choose "Register as new SD" to restore with a different name.`
            );
          } else if (conflictingSD.path === targetPath) {
            throw new Error(
              `A storage directory named "${conflictingSD.name}" is already registered at path "${targetPath}". ` +
                `Please unload that storage directory first, or choose a different restore location.`
            );
          }
        }
        // If we couldn't find the conflicting SD, throw a generic error
        throw new Error(
          `Cannot register storage directory: A storage directory with the same name or path already exists. ` +
            `Please unload any existing storage directories with the name "${sdName}" or path "${targetPath}" first.`
        );
      }
      // Re-throw other errors
      throw error;
    }

    console.log(
      `[BackupManager] Restored custom backup from ${backupPath} to ${targetPath} (SD ID: ${sd.id})`
    );

    // Initialize the restored SD (load notes into cache, set up watchers, etc.)
    if (this.onNewStorageDir) {
      console.log(`[BackupManager] Initializing restored SD: ${sd.id}`);
      await this.onNewStorageDir(sd.id, targetPath);
      console.log(`[BackupManager] SD initialization complete`);
    }

    return { sdId: sd.id, sdPath: targetPath };
  }

  /**
   * Delete a backup
   */
  deleteBackup(backupId: string): void {
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
  cleanupOldSnapshots(): number {
    const backups = this.listBackups();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    let deletedCount = 0;

    for (const backup of backups) {
      if (backup.type === 'pre-operation' && backup.timestamp < sevenDaysAgo) {
        this.deleteBackup(backup.backupId);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`[BackupManager] Cleaned up ${deletedCount} old pre-operation snapshots`);
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
  private async countNotes(sdId: string): Promise<number> {
    const result = await this.database.getAdapter().get<{
      count: number;
    }>('SELECT COUNT(*) as count FROM notes WHERE sd_id = ? AND deleted = 0', [sdId]);

    return result?.count ?? 0;
  }

  /**
   * Helper: Count folders in SD
   */
  private countFolders(_sdId: string): number {
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
