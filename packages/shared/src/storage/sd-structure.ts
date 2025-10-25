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
      meta: this.fs.joinPath(noteRoot, 'meta'),
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
    await this.fs.mkdir(notePaths.meta);
  }

  /**
   * Check if SD structure exists
   */
  async exists(): Promise<boolean> {
    const paths = this.getPaths();
    return (
      (await this.fs.exists(paths.root)) &&
      (await this.fs.exists(paths.notes)) &&
      (await this.fs.exists(paths.folders))
    );
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
}
