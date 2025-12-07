/**
 * Sync Directory structure management
 * Handles creation and path management for SD directories
 */

import type {
  FileSystemAdapter,
  SyncDirectoryPaths,
  NotePaths,
  SyncDirectoryConfig,
} from './types';
import type { UUID } from '../types';

/**
 * Sync Directory structure manager
 */
export class SyncDirectoryStructure {
  constructor(
    private readonly fs: FileSystemAdapter,
    private readonly config: SyncDirectoryConfig
  ) {}

  /**
   * Get paths for the sync directory
   */
  getPaths(): SyncDirectoryPaths {
    return {
      root: this.config.path,
      notes: this.fs.joinPath(this.config.path, 'notes'),
      folders: this.fs.joinPath(this.config.path, 'folders'),
      activity: this.fs.joinPath(this.config.path, 'activity'),
      profiles: this.fs.joinPath(this.config.path, 'profiles'),
      media: this.fs.joinPath(this.config.path, 'media'),
    };
  }

  /**
   * Get paths for a specific note
   */
  getNotePaths(noteId: UUID): NotePaths {
    const paths = this.getPaths();
    const noteRoot = this.fs.joinPath(paths.notes, noteId);
    return {
      root: noteRoot,
      updates: this.fs.joinPath(noteRoot, 'updates'),
      snapshots: this.fs.joinPath(noteRoot, 'snapshots'),
      packs: this.fs.joinPath(noteRoot, 'packs'),
      meta: this.fs.joinPath(noteRoot, 'meta'),
      logs: this.fs.joinPath(noteRoot, 'logs'),
    };
  }

  /**
   * Get paths for folder tree
   */
  getFolderPaths() {
    const paths = this.getPaths();
    return {
      root: paths.folders,
      updates: this.fs.joinPath(paths.folders, 'updates'),
      meta: this.fs.joinPath(paths.folders, 'meta'),
    };
  }

  /**
   * Initialize SD structure (create directories if needed)
   */
  async initialize(): Promise<void> {
    const paths = this.getPaths();

    // Create root directories
    await this.fs.mkdir(paths.root);
    await this.fs.mkdir(paths.notes);
    await this.fs.mkdir(paths.folders);
    await this.fs.mkdir(paths.activity);
    await this.fs.mkdir(paths.profiles);
    await this.fs.mkdir(paths.media);

    // Create folder structure
    const folderPaths = this.getFolderPaths();
    await this.fs.mkdir(folderPaths.updates);
    await this.fs.mkdir(folderPaths.meta);
  }

  /**
   * Initialize structure for a specific note
   */
  async initializeNote(noteId: UUID): Promise<void> {
    const notePaths = this.getNotePaths(noteId);
    await this.fs.mkdir(notePaths.root);
    await this.fs.mkdir(notePaths.updates);
    await this.fs.mkdir(notePaths.snapshots);
    await this.fs.mkdir(notePaths.packs);
    await this.fs.mkdir(notePaths.meta);
  }

  /**
   * Check if SD structure exists
   */
  async exists(): Promise<boolean> {
    const paths = this.getPaths();
    // Note: activity directory is optional for backwards compatibility
    return (
      (await this.fs.exists(paths.root)) &&
      (await this.fs.exists(paths.notes)) &&
      (await this.fs.exists(paths.folders))
    );
  }

  /**
   * Get activity directory path
   */
  getActivityPath(): string {
    return this.getPaths().activity;
  }

  /**
   * Get media directory path (for images, future: videos, audio)
   */
  getMediaPath(): string {
    return this.getPaths().media;
  }

  /**
   * Check if note structure exists
   */
  async noteExists(noteId: UUID): Promise<boolean> {
    const notePaths = this.getNotePaths(noteId);
    return await this.fs.exists(notePaths.root);
  }

  /**
   * List all note IDs in the SD
   */
  async listNotes(): Promise<UUID[]> {
    const paths = this.getPaths();
    const noteExists = await this.fs.exists(paths.notes);
    if (!noteExists) {
      return [];
    }
    const files = await this.fs.listFiles(paths.notes);
    return files;
  }

  /**
   * Get update file path for a note
   */
  getNoteUpdateFilePath(noteId: UUID, filename: string): string {
    const notePaths = this.getNotePaths(noteId);
    return this.fs.joinPath(notePaths.updates, filename);
  }

  /**
   * Get update file path for folder tree
   */
  getFolderUpdateFilePath(filename: string): string {
    const folderPaths = this.getFolderPaths();
    return this.fs.joinPath(folderPaths.updates, filename);
  }

  /**
   * Get snapshots directory path for a note
   */
  getSnapshotsPath(noteId: UUID): string {
    const notePaths = this.getNotePaths(noteId);
    return notePaths.snapshots;
  }

  /**
   * Get snapshot file path for a note
   */
  getSnapshotFilePath(noteId: UUID, filename: string): string {
    const snapshotsPath = this.getSnapshotsPath(noteId);
    return this.fs.joinPath(snapshotsPath, filename);
  }

  /**
   * Get packs directory path for a note
   */
  getPacksPath(noteId: UUID): string {
    const notePaths = this.getNotePaths(noteId);
    return notePaths.packs;
  }

  /**
   * Get pack file path for a note
   */
  getPackFilePath(noteId: UUID, filename: string): string {
    const packsPath = this.getPacksPath(noteId);
    return this.fs.joinPath(packsPath, filename);
  }

  /**
   * Get profiles directory path
   */
  getProfilesPath(): string {
    return this.getPaths().profiles;
  }

  /**
   * Get profile presence file path for a specific profile
   * File format: {SD}/profiles/{profileId}.json
   */
  getProfilePresenceFilePath(profileId: string): string {
    const profilesPath = this.getProfilesPath();
    return this.fs.joinPath(profilesPath, `${profileId}.json`);
  }
}
