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
import {
  type PackData,
  type PackUpdateEntry,
  type PackFileMetadata,
  PACK_FORMAT_VERSION,
  parsePackFilename,
  generatePackFilename,
  encodePackFile,
  decodePackFile,
  validatePackData,
} from '../crdt/pack-format';
import { type GCConfig, type GCStats } from '../crdt/gc-config';
import { SyncDirectoryStructure } from './sd-structure';

/**
 * Compression/decompression function type
 */
export type CompressionFn = (data: Uint8Array) => Promise<Uint8Array>;

/**
 * Manages reading and writing update files
 * Supports multiple Storage Directories
 */
export class UpdateManager {
  private sdStructures = new Map<UUID, SyncDirectoryStructure>();
  // Sequence counters: key = "documentType:documentId", value = next sequence number
  private sequenceCounters = new Map<string, number>();
  // Locks for sequence initialization to prevent race conditions
  private sequenceInitLocks = new Map<string, Promise<void>>();

  constructor(
    private readonly fs: FileSystemAdapter,
    private readonly instanceId: string,
    private readonly compress?: CompressionFn,
    private readonly decompress?: CompressionFn
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
   * List all note IDs in an SD
   */
  async listNotes(sdId: UUID): Promise<UUID[]> {
    const sdStructure = this.getSDStructure(sdId);
    return await sdStructure.listNotes();
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
   * Uses locking to prevent race conditions during initialization
   */
  private async getNextSequence(type: UpdateType, sdId: UUID, documentId: UUID): Promise<number> {
    const key = `${type}:${documentId}`;

    // If already initialized, return next sequence
    const current = this.sequenceCounters.get(key);
    if (current !== undefined) {
      this.sequenceCounters.set(key, current + 1);
      return current;
    }

    // Check if another call is already initializing this sequence
    const existingLock = this.sequenceInitLocks.get(key);
    if (existingLock) {
      // Wait for the other initialization to complete
      await existingLock;
      // Now try again (should be initialized)
      return this.getNextSequence(type, sdId, documentId);
    }

    // Create a lock for this initialization
    let resolveLock: (() => void) | undefined;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.sequenceInitLocks.set(key, lockPromise);

    try {
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
    } finally {
      // Release the lock
      this.sequenceInitLocks.delete(key);
      if (resolveLock) {
        resolveLock();
      }
    }
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

    // Generate filename (with compression if available)
    const filename = generateSnapshotFilename(totalChanges, this.instanceId, !!this.compress);

    // Encode and write (with compression if available)
    const encoded = await encodeSnapshotFile(snapshot, this.compress);
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
    return await decodeSnapshotFile(encoded, this.decompress);
  }

  /**
   * List pack files for a note, sorted by start sequence (ascending)
   * Phase 4.1bis Phase 2: Packing
   *
   * @param sdId - Storage directory ID
   * @param noteId - Note ID
   * @returns Array of pack file metadata
   */
  async listPackFiles(sdId: UUID, noteId: UUID): Promise<PackFileMetadata[]> {
    const sdStructure = this.getSDStructure(sdId);
    const packsPath = sdStructure.getPacksPath(noteId);

    const packsExist = await this.fs.exists(packsPath);
    if (!packsExist) {
      return [];
    }

    const files = await this.fs.listFiles(packsPath);
    const packs: PackFileMetadata[] = [];

    for (const filename of files) {
      const metadata = parsePackFilename(filename);
      if (!metadata) {
        continue;
      }

      packs.push(metadata);
    }

    // Sort by start sequence (ascending) for sequential loading
    packs.sort((a, b) => a.startSeq - b.startSeq);
    return packs;
  }

  /**
   * Read a pack file
   * Phase 4.1bis Phase 2: Packing
   *
   * @param sdId - Storage directory ID
   * @param noteId - Note ID
   * @param filename - Pack filename
   * @returns Pack data
   * @throws Error if pack file is corrupted or not found
   */
  async readPackFile(sdId: UUID, noteId: UUID, filename: string): Promise<PackData> {
    const sdStructure = this.getSDStructure(sdId);
    const filePath = sdStructure.getPackFilePath(noteId, filename);

    const encoded = await this.fs.readFile(filePath);
    const pack = await decodePackFile(encoded, this.decompress);

    // Validate pack integrity
    validatePackData(pack);

    return pack;
  }

  /**
   * Create a pack from update files
   * Phase 4.1bis Phase 2: Packing
   *
   * Atomic operation: writes pack file, then deletes source update files
   *
   * @param sdId - Storage directory ID
   * @param noteId - Note ID
   * @param updateFiles - Array of update file paths to pack (must be contiguous sequences)
   * @returns Pack filename
   * @throws Error if sequences are not contiguous or files can't be read
   */
  async createPack(
    sdId: UUID,
    noteId: UUID,
    updateFiles: Array<{ path: string; metadata: { seq: number; timestamp: number } }>
  ): Promise<string> {
    if (updateFiles.length === 0) {
      throw new Error('Cannot create pack from empty update list');
    }

    // Sort by sequence to ensure contiguity
    updateFiles.sort((a, b) => a.metadata.seq - b.metadata.seq);

    // Extract metadata
    const firstFile = updateFiles[0];
    const lastFile = updateFiles[updateFiles.length - 1];
    if (!firstFile || !lastFile) {
      throw new Error('Invalid update files array');
    }

    const startSeq = firstFile.metadata.seq;
    const endSeq = lastFile.metadata.seq;

    // Verify contiguous sequences
    for (let i = 0; i < updateFiles.length; i++) {
      const file = updateFiles[i];
      if (!file) continue;

      const expectedSeq = startSeq + i;
      if (file.metadata.seq !== expectedSeq) {
        throw new Error(
          `Non-contiguous sequence: expected ${expectedSeq}, got ${file.metadata.seq}`
        );
      }
    }

    // Extract instance ID from first file path
    const firstFilename = this.fs.basename(firstFile.path);
    const firstMetadata = parseUpdateFilename(firstFilename);
    if (!firstMetadata) {
      throw new Error(`Cannot parse update filename: ${firstFilename}`);
    }
    const instanceId = firstMetadata.instanceId;

    // Read all update files
    const updates: PackUpdateEntry[] = [];
    for (const file of updateFiles) {
      const data = await this.readUpdateFile(file.path);
      updates.push({
        seq: file.metadata.seq,
        timestamp: file.metadata.timestamp,
        data,
      });
    }

    // Create pack data
    const pack: PackData = {
      version: PACK_FORMAT_VERSION,
      instanceId,
      noteId,
      sequenceRange: [startSeq, endSeq],
      updates,
    };

    // Validate before writing
    validatePackData(pack);

    // Write pack file (with compression if available)
    const sdStructure = this.getSDStructure(sdId);
    const filename = generatePackFilename(instanceId, startSeq, endSeq, !!this.compress);
    const packPath = sdStructure.getPackFilePath(noteId, filename);
    const encoded = await encodePackFile(pack, this.compress);
    await this.fs.writeFile(packPath, encoded);

    // Delete original update files (atomic: pack written first)
    for (const file of updateFiles) {
      try {
        await this.fs.deleteFile(file.path);
      } catch (error) {
        // Log error but don't fail - duplicates are OK (CRDT convergence)
        console.warn(`[Packing] Failed to delete update file ${file.path}:`, error);
      }
    }

    return filename;
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

  /**
   * Run garbage collection on a note's CRDT files
   * Deletes old snapshots, packs, and updates according to the GC config
   *
   * Algorithm:
   * 1. Keep newest N snapshots (per config)
   * 2. Find oldest kept snapshot's vector clock
   * 3. Delete packs fully incorporated into oldest kept snapshot
   * 4. Delete updates fully incorporated into oldest kept snapshot
   * 5. Respect minimum history duration (keep recent files regardless)
   *
   * @param sdId - Storage directory ID
   * @param noteId - Note ID
   * @param config - GC configuration
   * @returns Statistics from the GC run
   */
  async runGarbageCollection(sdId: UUID, noteId: UUID, config: GCConfig): Promise<GCStats> {
    const startTime = Date.now();
    const stats: GCStats = {
      startTime,
      duration: 0,
      snapshotsDeleted: 0,
      packsDeleted: 0,
      updatesDeleted: 0,
      totalFilesDeleted: 0,
      diskSpaceFreed: 0,
      errors: [],
    };

    try {
      // Step 1: Clean up old snapshots (keep newest N)
      await this.gcSnapshots(sdId, noteId, config, stats);

      // Step 2: Determine oldest kept snapshot's vector clock
      const oldestKeptSnapshot = await this.getOldestKeptSnapshot(
        sdId,
        noteId,
        config.snapshotRetentionCount
      );

      if (oldestKeptSnapshot) {
        // Step 3: Clean up packs incorporated into snapshot
        await this.gcPacks(sdId, noteId, oldestKeptSnapshot.maxSequences, config, stats);

        // Step 4: Clean up updates incorporated into snapshot
        await this.gcUpdates(sdId, noteId, oldestKeptSnapshot.maxSequences, config, stats);
      }

      stats.totalFilesDeleted = stats.snapshotsDeleted + stats.packsDeleted + stats.updatesDeleted;
      stats.duration = Date.now() - startTime;

      return stats;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      stats.errors.push(`GC failed: ${errorMsg}`);
      stats.duration = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Delete old snapshots, keeping only the newest N
   * @private
   */
  private async gcSnapshots(
    sdId: UUID,
    noteId: UUID,
    config: GCConfig,
    stats: GCStats
  ): Promise<void> {
    try {
      const snapshots = await this.listSnapshotFiles(sdId, noteId);

      // Sort by totalChanges descending (newest first)
      snapshots.sort((a, b) => b.totalChanges - a.totalChanges);

      // Keep newest N snapshots
      const snapshotsToDelete = snapshots.slice(config.snapshotRetentionCount);

      for (const snapshot of snapshotsToDelete) {
        try {
          const sdStructure = this.getSDStructure(sdId);
          const filePath = sdStructure.getSnapshotFilePath(noteId, snapshot.filename);

          // Get file size before deletion
          const size = await this.getFileSize(filePath);

          await this.fs.deleteFile(filePath);
          stats.snapshotsDeleted++;
          stats.diskSpaceFreed += size;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          stats.errors.push(`Failed to delete snapshot ${snapshot.filename}: ${errorMsg}`);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      stats.errors.push(`Failed to list snapshots: ${errorMsg}`);
    }
  }

  /**
   * Get the oldest snapshot that will be kept (for determining what to GC)
   * @private
   */
  private async getOldestKeptSnapshot(
    sdId: UUID,
    noteId: UUID,
    retentionCount: number
  ): Promise<SnapshotData | null> {
    try {
      const snapshots = await this.listSnapshotFiles(sdId, noteId);

      if (snapshots.length === 0) {
        return null;
      }

      // Sort by totalChanges descending (newest first)
      snapshots.sort((a, b) => b.totalChanges - a.totalChanges);

      // Get the Nth snapshot (oldest one we'll keep), or the oldest available
      const oldestKeptIndex = Math.min(retentionCount - 1, snapshots.length - 1);
      const oldestKept = snapshots[oldestKeptIndex];

      if (!oldestKept) {
        return null;
      }

      // Load it to get the vector clock
      return await this.readSnapshot(sdId, noteId, oldestKept.filename);
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete packs fully incorporated into the oldest kept snapshot
   * @private
   */
  private async gcPacks(
    sdId: UUID,
    noteId: UUID,
    oldestMaxSequences: VectorClock,
    config: GCConfig,
    stats: GCStats
  ): Promise<void> {
    try {
      const packs = await this.listPackFiles(sdId, noteId);
      const now = Date.now();
      const minHistoryTimestamp = now - config.minimumHistoryDuration;

      for (const pack of packs) {
        try {
          const maxSeqForInstance = oldestMaxSequences[pack.instanceId] ?? -1;

          // Pack is fully incorporated if its endSeq <= maxSeq for that instance
          if (pack.endSeq <= maxSeqForInstance) {
            // Check minimum history duration
            const packData = await this.readPackFile(sdId, noteId, pack.filename);
            const newestUpdate = packData.updates[packData.updates.length - 1];

            if (newestUpdate && newestUpdate.timestamp < minHistoryTimestamp) {
              // Pack is old enough to delete
              const sdStructure = this.getSDStructure(sdId);
              const filePath = sdStructure.getPackFilePath(noteId, pack.filename);

              const size = await this.getFileSize(filePath);

              await this.fs.deleteFile(filePath);
              stats.packsDeleted++;
              stats.diskSpaceFreed += size;
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          stats.errors.push(`Failed to GC pack ${pack.filename}: ${errorMsg}`);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      stats.errors.push(`Failed to list packs: ${errorMsg}`);
    }
  }

  /**
   * Delete update files fully incorporated into the oldest kept snapshot
   * @private
   */
  private async gcUpdates(
    sdId: UUID,
    noteId: UUID,
    oldestMaxSequences: VectorClock,
    config: GCConfig,
    stats: GCStats
  ): Promise<void> {
    try {
      const updateFiles = await this.listNoteUpdateFiles(sdId, noteId);
      const now = Date.now();
      const minHistoryTimestamp = now - config.minimumHistoryDuration;

      for (const updateFile of updateFiles) {
        try {
          const metadata = parseUpdateFilename(updateFile.filename);

          if (!metadata?.sequence) continue;

          const maxSeqForInstance = oldestMaxSequences[metadata.instanceId] ?? -1;

          // Update is fully incorporated if its seq <= maxSeq for that instance
          if (metadata.sequence <= maxSeqForInstance) {
            // Check minimum history duration
            if (metadata.timestamp < minHistoryTimestamp) {
              // Update is old enough to delete
              const size = await this.getFileSize(updateFile.path);

              await this.fs.deleteFile(updateFile.path);
              stats.updatesDeleted++;
              stats.diskSpaceFreed += size;
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          stats.errors.push(`Failed to GC update ${updateFile.filename}: ${errorMsg}`);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      stats.errors.push(`Failed to list updates: ${errorMsg}`);
    }
  }

  /**
   * Get file size in bytes
   * @private
   */
  private async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await this.fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }
}
