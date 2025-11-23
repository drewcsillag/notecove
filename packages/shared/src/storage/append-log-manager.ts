/**
 * AppendLogManager - High-level storage manager using append-only logs
 *
 * Provides a similar interface to UpdateManager but uses the new
 * append-only log format for better performance and reliability.
 *
 * @see STORAGE-FORMAT-DESIGN.md for specification
 */

import * as Y from 'yjs';
import { NoteStorageManager, type VectorClock, type NoteSyncStateDb } from './note-storage-manager';
import { FolderStorageManager, type FolderSyncStateDb } from './folder-storage-manager';
import { LogSync } from './log-sync';
import type { FileSystemAdapter } from './types';

/** Storage Directory registration */
interface SDRegistration {
  id: string;
  path: string;
}

/** Result of loading a document */
export interface LoadResult {
  doc: Y.Doc;
  vectorClock: VectorClock;
}

/** Combined database interface for AppendLogManager */
export interface AppendLogManagerDb extends NoteSyncStateDb, FolderSyncStateDb {}

export class AppendLogManager {
  private readonly fs: FileSystemAdapter;
  private readonly db: AppendLogManagerDb;
  private readonly instanceId: string;

  private readonly registeredSDs = new Map<string, SDRegistration>();
  private readonly noteManagers = new Map<string, NoteStorageManager>();
  private readonly folderManagers = new Map<string, FolderStorageManager>();

  /** Track current vector clocks per note for snapshot building */
  private readonly noteVectorClocks = new Map<string, VectorClock>();
  private readonly folderVectorClocks = new Map<string, VectorClock>();

  constructor(fs: FileSystemAdapter, db: AppendLogManagerDb, instanceId: string) {
    this.fs = fs;
    this.db = db;
    this.instanceId = instanceId;
  }

  /**
   * Register a Storage Directory.
   */
  registerSD(sdId: string, sdPath: string): void {
    this.registeredSDs.set(sdId, { id: sdId, path: sdPath });
  }

  /**
   * Unregister a Storage Directory.
   */
  unregisterSD(sdId: string): void {
    this.registeredSDs.delete(sdId);
  }

  /**
   * Check if an SD is registered.
   */
  hasSD(sdId: string): boolean {
    return this.registeredSDs.has(sdId);
  }

  /**
   * Get the path for an SD.
   */
  getSDPath(sdId: string): string {
    const sd = this.registeredSDs.get(sdId);
    if (!sd) {
      throw new Error(`Storage Directory not registered: ${sdId}`);
    }
    return sd.path;
  }

  /**
   * Get note paths for a given SD and note.
   */
  private getNotePaths(
    sdId: string,
    noteId: string
  ): { logs: string; snapshots: string; root: string } {
    const sdPath = this.getSDPath(sdId);
    const noteRoot = this.fs.joinPath(sdPath, 'notes', noteId);
    return {
      root: noteRoot,
      logs: this.fs.joinPath(noteRoot, 'logs'),
      snapshots: this.fs.joinPath(noteRoot, 'snapshots'),
    };
  }

  /**
   * Get folder paths for a given SD.
   */
  private getFolderPaths(sdId: string): { logs: string; snapshots: string } {
    const sdPath = this.getSDPath(sdId);
    return {
      logs: this.fs.joinPath(sdPath, 'folders', 'logs'),
      snapshots: this.fs.joinPath(sdPath, 'folders', 'snapshots'),
    };
  }

  /**
   * Get or create a NoteStorageManager for an SD.
   */
  private getNoteManager(sdId: string): NoteStorageManager {
    let manager = this.noteManagers.get(sdId);
    if (!manager) {
      manager = new NoteStorageManager(this.fs, this.db, this.instanceId);
      this.noteManagers.set(sdId, manager);
    }
    return manager;
  }

  /**
   * Get or create a FolderStorageManager for an SD.
   */
  private getFolderManager(sdId: string): FolderStorageManager {
    let manager = this.folderManagers.get(sdId);
    if (!manager) {
      manager = new FolderStorageManager(this.fs, this.db, this.instanceId);
      this.folderManagers.set(sdId, manager);
    }
    return manager;
  }

  /**
   * Write a note update to the log file.
   * Returns the sequence number of the written update.
   */
  async writeNoteUpdate(sdId: string, noteId: string, update: Uint8Array): Promise<number> {
    const manager = this.getNoteManager(sdId);
    const paths = this.getNotePaths(sdId, noteId);

    const result = await manager.saveUpdate(sdId, noteId, paths, update);

    // Update vector clock for this note
    const key = `${sdId}:${noteId}`;
    const existingClock = this.noteVectorClocks.get(key) || {};
    existingClock[this.instanceId] = {
      sequence: result.sequence,
      offset: result.offset,
      file: result.file,
    };
    this.noteVectorClocks.set(key, existingClock);

    return result.sequence;
  }

  /**
   * Write a folder tree update to the log file.
   * Returns the sequence number of the written update.
   */
  async writeFolderUpdate(sdId: string, update: Uint8Array): Promise<number> {
    const manager = this.getFolderManager(sdId);
    const paths = this.getFolderPaths(sdId);

    const result = await manager.saveUpdate(sdId, paths, update);

    // Update vector clock for folders
    const existingClock = this.folderVectorClocks.get(sdId) || {};
    existingClock[this.instanceId] = {
      sequence: result.sequence,
      offset: result.offset,
      file: result.file,
    };
    this.folderVectorClocks.set(sdId, existingClock);

    return result.sequence;
  }

  /**
   * Load a note from storage.
   * First tries DB cache, then falls back to full load from files.
   */
  async loadNote(sdId: string, noteId: string): Promise<LoadResult> {
    const manager = this.getNoteManager(sdId);
    const paths = this.getNotePaths(sdId, noteId);

    // Try cache first
    const cached = await manager.loadNoteFromCache(sdId, noteId, paths);
    if (cached) {
      // Store vector clock for later snapshot building
      this.noteVectorClocks.set(`${sdId}:${noteId}`, cached.vectorClock);
      return cached;
    }

    // Full load from files
    const result = await manager.loadNote(sdId, noteId, paths);
    this.noteVectorClocks.set(`${sdId}:${noteId}`, result.vectorClock);
    return result;
  }

  /**
   * Load a folder tree from storage.
   */
  async loadFolderTree(sdId: string): Promise<LoadResult> {
    const manager = this.getFolderManager(sdId);
    const paths = this.getFolderPaths(sdId);

    // Try cache first
    const cached = await manager.loadFolderTreeFromCache(sdId, paths);
    if (cached) {
      this.folderVectorClocks.set(sdId, cached.vectorClock);
      return cached;
    }

    // Full load from files
    const result = await manager.loadFolderTree(sdId, paths);
    this.folderVectorClocks.set(sdId, result.vectorClock);
    return result;
  }

  /**
   * Save a note snapshot to the database.
   * Call this periodically or after significant changes.
   */
  async saveNoteSnapshot(sdId: string, noteId: string, doc: Y.Doc): Promise<void> {
    const manager = this.getNoteManager(sdId);
    const key = `${sdId}:${noteId}`;
    const vectorClock = this.noteVectorClocks.get(key) || {};

    await manager.saveDbSnapshot(sdId, noteId, doc, vectorClock);
  }

  /**
   * Save a folder tree snapshot to the database.
   */
  async saveFolderSnapshot(sdId: string, doc: Y.Doc): Promise<void> {
    const manager = this.getFolderManager(sdId);
    const vectorClock = this.folderVectorClocks.get(sdId) || {};

    await manager.saveDbSnapshot(sdId, doc, vectorClock);
  }

  /**
   * Get the current vector clock for a note.
   */
  getNoteVectorClock(sdId: string, noteId: string): VectorClock {
    return this.noteVectorClocks.get(`${sdId}:${noteId}`) || {};
  }

  /**
   * Get the current vector clock for folders.
   */
  getFolderVectorClock(sdId: string): VectorClock {
    return this.folderVectorClocks.get(sdId) || {};
  }

  /**
   * Create a LogSync instance for syncing from other instances.
   */
  createLogSync(callbacks: {
    applyUpdate: (noteId: string, update: Uint8Array) => Promise<void>;
    reloadNote: (noteId: string) => Promise<void>;
    getLoadedNotes: () => string[];
  }): LogSync {
    return new LogSync(this.fs, this.instanceId, callbacks);
  }

  /**
   * Shutdown the manager, finalizing all log writers.
   */
  async shutdown(): Promise<void> {
    // Finalize all note managers
    for (const manager of this.noteManagers.values()) {
      await manager.finalize();
    }

    // Finalize all folder managers
    for (const manager of this.folderManagers.values()) {
      await manager.finalize();
    }
  }

  /**
   * Get the instance ID.
   */
  getInstanceId(): string {
    return this.instanceId;
  }
}
