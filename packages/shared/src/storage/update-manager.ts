/**
 * Update file management
 * Handles reading and writing CRDT update files
 */

import type { FileSystemAdapter, UpdateFile } from './types';
import type { UUID } from '../types';
import {
  UpdateType,
  parseUpdateFilename,
  generateUpdateFilename,
  encodeUpdateFile,
  decodeUpdateFile,
} from '../crdt/update-format';
import { SyncDirectoryStructure } from './sd-structure';

/**
 * Manages reading and writing update files
 */
export class UpdateManager {
  constructor(
    private readonly fs: FileSystemAdapter,
    private readonly sdStructure: SyncDirectoryStructure,
    private readonly instanceId: string
  ) {}

  /**
   * Write a note update to disk
   */
  async writeNoteUpdate(noteId: UUID, update: Uint8Array): Promise<string> {
    // Ensure note directory exists
    await this.sdStructure.initializeNote(noteId);

    const filename = generateUpdateFilename(UpdateType.Note, this.instanceId, noteId, Date.now());

    const encoded = encodeUpdateFile(update);
    const filePath = this.sdStructure.getNoteUpdateFilePath(noteId, filename);

    await this.fs.writeFile(filePath, encoded);
    return filename;
  }

  /**
   * Write a folder tree update to disk
   */
  async writeFolderUpdate(sdId: string, update: Uint8Array): Promise<string> {
    const filename = generateUpdateFilename(
      UpdateType.FolderTree,
      this.instanceId,
      sdId,
      Date.now()
    );

    const encoded = encodeUpdateFile(update);
    const filePath = this.sdStructure.getFolderUpdateFilePath(filename);

    await this.fs.writeFile(filePath, encoded);
    return filename;
  }

  /**
   * Read all updates for a note
   */
  async readNoteUpdates(noteId: UUID): Promise<Uint8Array[]> {
    const notePaths = this.sdStructure.getNotePaths(noteId);

    const noteExists = await this.fs.exists(notePaths.updates);
    if (!noteExists) {
      return [];
    }

    const files = await this.fs.listFiles(notePaths.updates);
    const updates: Uint8Array[] = [];

    for (const filename of files) {
      if (!filename.endsWith('.yjson')) {
        continue;
      }

      const filePath = this.fs.joinPath(notePaths.updates, filename);
      try {
        const encoded = await this.fs.readFile(filePath);
        const decoded = decodeUpdateFile(encoded);
        updates.push(decoded);
      } catch (error) {
        // Log error but continue with other files
        console.error(`Failed to read update file ${filename}:`, error);
      }
    }

    return updates;
  }

  /**
   * Read all updates for folder tree
   */
  async readFolderUpdates(): Promise<Uint8Array[]> {
    const folderPaths = this.sdStructure.getFolderPaths();

    const folderExists = await this.fs.exists(folderPaths.updates);
    if (!folderExists) {
      return [];
    }

    const files = await this.fs.listFiles(folderPaths.updates);
    const updates: Uint8Array[] = [];

    for (const filename of files) {
      if (!filename.endsWith('.yjson')) {
        continue;
      }

      const filePath = this.fs.joinPath(folderPaths.updates, filename);
      try {
        const encoded = await this.fs.readFile(filePath);
        const decoded = decodeUpdateFile(encoded);
        updates.push(decoded);
      } catch (error) {
        console.error(`Failed to read update file ${filename}:`, error);
      }
    }

    return updates;
  }

  /**
   * List all update files for a note
   */
  async listNoteUpdateFiles(noteId: UUID): Promise<UpdateFile[]> {
    const notePaths = this.sdStructure.getNotePaths(noteId);

    const noteExists = await this.fs.exists(notePaths.updates);
    if (!noteExists) {
      return [];
    }

    const files = await this.fs.listFiles(notePaths.updates);
    const updateFiles: UpdateFile[] = [];

    for (const filename of files) {
      const metadata = parseUpdateFilename(filename);
      if (!metadata) {
        continue;
      }

      updateFiles.push({
        filename,
        path: this.fs.joinPath(notePaths.updates, filename),
        instanceId: metadata.instanceId,
        documentId: metadata.documentId,
        timestamp: metadata.timestamp,
      });
    }

    // Sort by timestamp (oldest first)
    updateFiles.sort((a, b) => a.timestamp - b.timestamp);
    return updateFiles;
  }

  /**
   * List all update files for folder tree
   */
  async listFolderUpdateFiles(): Promise<UpdateFile[]> {
    const folderPaths = this.sdStructure.getFolderPaths();

    const folderExists = await this.fs.exists(folderPaths.updates);
    if (!folderExists) {
      return [];
    }

    const files = await this.fs.listFiles(folderPaths.updates);
    const updateFiles: UpdateFile[] = [];

    for (const filename of files) {
      const metadata = parseUpdateFilename(filename);
      if (!metadata) {
        continue;
      }

      updateFiles.push({
        filename,
        path: this.fs.joinPath(folderPaths.updates, filename),
        instanceId: metadata.instanceId,
        documentId: metadata.documentId,
        timestamp: metadata.timestamp,
      });
    }

    updateFiles.sort((a, b) => a.timestamp - b.timestamp);
    return updateFiles;
  }

  /**
   * Delete old update files (for packing)
   */
  async deleteUpdateFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await this.fs.deleteFile(filePath);
      } catch (error) {
        console.error(`Failed to delete update file ${filePath}:`, error);
      }
    }
  }
}
