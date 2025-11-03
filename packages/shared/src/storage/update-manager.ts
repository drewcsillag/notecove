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
 * Supports multiple Storage Directories
 */
export class UpdateManager {
  private sdStructures = new Map<UUID, SyncDirectoryStructure>();
  // Sequence counters: key = "documentType:documentId", value = next sequence number
  private sequenceCounters = new Map<string, number>();

  constructor(
    private readonly fs: FileSystemAdapter,
    private readonly instanceId: string
  ) {}

  /**
   * Register a Storage Directory
   */
  registerSD(sdId: UUID, sdPath: string): void {
    const config = {
      id: sdId,
      path: sdPath,
      label: '', // Not needed for UpdateManager operations
    };
    const structure = new SyncDirectoryStructure(this.fs, config);
    this.sdStructures.set(sdId, structure);
  }

  /**
   * Unregister a Storage Directory
   */
  unregisterSD(sdId: UUID): void {
    this.sdStructures.delete(sdId);
  }

  /**
   * Get SD structure for a given SD ID
   * @throws Error if SD is not registered
   */
  private getSDStructure(sdId: UUID): SyncDirectoryStructure {
    const structure = this.sdStructures.get(sdId);
    if (!structure) {
      throw new Error(`Storage Directory not registered: ${sdId}`);
    }
    return structure;
  }

  /**
   * Write a note update to disk
   */
  async writeNoteUpdate(sdId: UUID, noteId: UUID, update: Uint8Array): Promise<string> {
    const sdStructure = this.getSDStructure(sdId);

    // Ensure note directory exists
    await sdStructure.initializeNote(noteId);

    // Get next sequence number for this note
    const sequence = await this.getNextSequence(UpdateType.Note, sdId, noteId);

    const filename = generateUpdateFilename(
      UpdateType.Note,
      this.instanceId,
      noteId,
      Date.now(),
      sequence
    );

    const encoded = encodeUpdateFile(update);
    const filePath = sdStructure.getNoteUpdateFilePath(noteId, filename);

    await this.fs.writeFile(filePath, encoded);
    return filename;
  }

  /**
   * Write a folder tree update to disk
   */
  async writeFolderUpdate(sdId: UUID, update: Uint8Array): Promise<string> {
    const sdStructure = this.getSDStructure(sdId);

    // Get next sequence number for this folder tree
    const sequence = await this.getNextSequence(UpdateType.FolderTree, sdId, sdId);

    const filename = generateUpdateFilename(
      UpdateType.FolderTree,
      this.instanceId,
      sdId,
      Date.now(),
      sequence
    );

    const encoded = encodeUpdateFile(update);
    const filePath = sdStructure.getFolderUpdateFilePath(filename);

    await this.fs.writeFile(filePath, encoded);
    return filename;
  }

  /**
   * Read all updates for a note
   */
  async readNoteUpdates(sdId: UUID, noteId: UUID): Promise<Uint8Array[]> {
    const sdStructure = this.getSDStructure(sdId);
    const notePaths = sdStructure.getNotePaths(noteId);

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
  async readFolderUpdates(sdId: UUID): Promise<Uint8Array[]> {
    const sdStructure = this.getSDStructure(sdId);
    const folderPaths = sdStructure.getFolderPaths();

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
  async listNoteUpdateFiles(sdId: UUID, noteId: UUID): Promise<UpdateFile[]> {
    const sdStructure = this.getSDStructure(sdId);
    const notePaths = sdStructure.getNotePaths(noteId);

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
  async listFolderUpdateFiles(sdId: UUID): Promise<UpdateFile[]> {
    const sdStructure = this.getSDStructure(sdId);
    const folderPaths = sdStructure.getFolderPaths();

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

  /**
   * Get next sequence number for a document
   * Initializes by scanning existing files if not yet initialized
   */
  private async getNextSequence(
    type: UpdateType,
    sdId: UUID,
    documentId: UUID
  ): Promise<number> {
    const key = `${type}:${documentId}`;

    // If already initialized, return next sequence
    if (this.sequenceCounters.has(key)) {
      const current = this.sequenceCounters.get(key)!;
      this.sequenceCounters.set(key, current + 1);
      return current;
    }

    // Initialize by scanning existing files written by this instance
    let maxSeq = -1;

    try {
      if (type === UpdateType.Note) {
        const files = await this.listNoteUpdateFiles(sdId, documentId);
        // Only look at files written by this instance
        const ourFiles = files.filter((f) => f.instanceId === this.instanceId);
        for (const file of ourFiles) {
          const metadata = parseUpdateFilename(file.filename);
          if (metadata?.sequence !== undefined && metadata.sequence > maxSeq) {
            maxSeq = metadata.sequence;
          }
        }
      } else if (type === UpdateType.FolderTree) {
        const files = await this.listFolderUpdateFiles(sdId);
        const ourFiles = files.filter((f) => f.instanceId === this.instanceId);
        for (const file of ourFiles) {
          const metadata = parseUpdateFilename(file.filename);
          if (metadata?.sequence !== undefined && metadata.sequence > maxSeq) {
            maxSeq = metadata.sequence;
          }
        }
      }
    } catch (error) {
      // If scanning fails, start from 0
      console.warn(`Failed to scan existing files for ${key}, starting from 0:`, error);
    }

    // Start from maxSeq + 1 (or 0 if no files found)
    const nextSeq = maxSeq + 1;
    this.sequenceCounters.set(key, nextSeq + 1);
    return nextSeq;
  }
}
