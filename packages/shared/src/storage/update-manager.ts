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
import {
  type SnapshotData,
  type SnapshotFileMetadata,
  type VectorClock,
  SNAPSHOT_FORMAT_VERSION,
  parseSnapshotFilename,
  generateSnapshotFilename,
  encodeSnapshotFile,
  decodeSnapshotFile,
} from '../crdt/snapshot-format';
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
  private async getNextSequence(type: UpdateType, sdId: UUID, documentId: UUID): Promise<number> {
    const key = `${type}:${documentId}`;

    // If already initialized, return next sequence
    const current = this.sequenceCounters.get(key);
    if (current !== undefined) {
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

  /**
   * Write a snapshot for a note
   * @param sdId - Storage directory ID
   * @param noteId - Note ID
   * @param documentState - Full Yjs document state (from Y.encodeStateAsUpdate)
   * @param maxSequences - Vector clock (highest sequence per instance)
   * @returns Snapshot filename
   */
  async writeSnapshot(
    sdId: UUID,
    noteId: UUID,
    documentState: Uint8Array,
    maxSequences: VectorClock
  ): Promise<string> {
    const sdStructure = this.getSDStructure(sdId);

    // Ensure note directory exists
    await sdStructure.initializeNote(noteId);

    // Calculate total changes from vector clock
    const totalChanges = Object.values(maxSequences).reduce((sum, seq) => sum + seq + 1, 0);

    // Create snapshot data
    const snapshot: SnapshotData = {
      version: SNAPSHOT_FORMAT_VERSION,
      noteId,
      timestamp: Date.now(),
      totalChanges,
      documentState,
      maxSequences,
    };

    // Generate filename
    const filename = generateSnapshotFilename(totalChanges, this.instanceId);

    // Encode and write
    const encoded = encodeSnapshotFile(snapshot);
    const filePath = sdStructure.getSnapshotFilePath(noteId, filename);

    await this.fs.writeFile(filePath, encoded);
    return filename;
  }

  /**
   * List all snapshot files for a note
   * @param sdId - Storage directory ID
   * @param noteId - Note ID
   * @returns Array of snapshot metadata, sorted by totalChanges (highest first)
   */
  async listSnapshotFiles(sdId: UUID, noteId: UUID): Promise<SnapshotFileMetadata[]> {
    const sdStructure = this.getSDStructure(sdId);
    const snapshotsPath = sdStructure.getSnapshotsPath(noteId);

    const snapshotsExist = await this.fs.exists(snapshotsPath);
    if (!snapshotsExist) {
      return [];
    }

    const files = await this.fs.listFiles(snapshotsPath);
    const snapshots: SnapshotFileMetadata[] = [];

    for (const filename of files) {
      const metadata = parseSnapshotFilename(filename);
      if (!metadata) {
        continue;
      }

      snapshots.push(metadata);
    }

    // Sort by totalChanges (highest first) for easy selection of best snapshot
    snapshots.sort((a, b) => b.totalChanges - a.totalChanges);
    return snapshots;
  }

  /**
   * Read a snapshot file
   * @param sdId - Storage directory ID
   * @param noteId - Note ID
   * @param filename - Snapshot filename
   * @returns Snapshot data
   * @throws Error if snapshot file is corrupted or not found
   */
  async readSnapshot(sdId: UUID, noteId: UUID, filename: string): Promise<SnapshotData> {
    const sdStructure = this.getSDStructure(sdId);
    const filePath = sdStructure.getSnapshotFilePath(noteId, filename);

    const encoded = await this.fs.readFile(filePath);
    return decodeSnapshotFile(encoded);
  }

  /**
   * Read a single update file by path
   * @param filePath - Full path to the update file
   * @returns Decoded update data
   * @throws Error if file is corrupted or not found
   */
  async readUpdateFile(filePath: string): Promise<Uint8Array> {
    const encoded = await this.fs.readFile(filePath);
    return decodeUpdateFile(encoded);
  }

  /**
   * Build vector clock from update files for a note
   * Maps instance-id -> highest sequence number seen
   * @param sdId - Storage directory ID
   * @param noteId - Note ID
   * @returns Vector clock
   */
  async buildVectorClock(sdId: UUID, noteId: UUID): Promise<VectorClock> {
    const updateFiles = await this.listNoteUpdateFiles(sdId, noteId);
    const vectorClock: VectorClock = {};

    for (const file of updateFiles) {
      const metadata = parseUpdateFilename(file.filename);
      if (!metadata || metadata.sequence === undefined) {
        // Skip old format files without sequence numbers
        continue;
      }

      const currentMax = vectorClock[metadata.instanceId] ?? -1;
      if (metadata.sequence > currentMax) {
        vectorClock[metadata.instanceId] = metadata.sequence;
      }
    }

    return vectorClock;
  }

  /**
   * Check if a snapshot should be created for a note
   * @param sdId - Storage directory ID
   * @param noteId - Note ID
   * @param threshold - Minimum number of new updates to trigger snapshot (default: 100)
   * @returns True if snapshot should be created
   */
  async shouldCreateSnapshot(sdId: UUID, noteId: UUID, threshold = 100): Promise<boolean> {
    // Get existing snapshots
    const snapshots = await this.listSnapshotFiles(sdId, noteId);

    // Get all update files
    const updateFiles = await this.listNoteUpdateFiles(sdId, noteId);

    // Count updates with sequence numbers
    const updatesWithSequence = updateFiles.filter((file) => {
      const metadata = parseUpdateFilename(file.filename);
      return metadata && metadata.sequence !== undefined;
    });

    if (snapshots.length === 0) {
      // No snapshots yet - create one if we have enough updates
      return updatesWithSequence.length >= threshold;
    }

    // Get the best (most recent) snapshot
    const bestSnapshot = snapshots[0]; // Already sorted by totalChanges desc
    if (!bestSnapshot) {
      return updatesWithSequence.length >= threshold;
    }

    // Count how many updates are newer than the snapshot
    // Updates are newer if their sequence > snapshot.maxSequences[instanceId]
    try {
      const snapshot = await this.readSnapshot(sdId, noteId, bestSnapshot.filename);
      let newUpdateCount = 0;

      for (const file of updateFiles) {
        const metadata = parseUpdateFilename(file.filename);
        if (!metadata || metadata.sequence === undefined) {
          continue;
        }

        const snapshotSeq = snapshot.maxSequences[metadata.instanceId] ?? -1;
        if (metadata.sequence > snapshotSeq) {
          newUpdateCount++;
        }
      }

      return newUpdateCount >= threshold;
    } catch (error) {
      // If we can't read the snapshot, create a new one if we have enough updates
      console.error('Failed to read snapshot for shouldCreateSnapshot check:', error);
      return updatesWithSequence.length >= threshold;
    }
  }
}
