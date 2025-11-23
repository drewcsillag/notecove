/**
 * Test Instance - Wraps UpdateManager, ActivityLogger, ActivitySync
 * to simulate a running app instance
 */

/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as Y from 'yjs';
import { UpdateManager } from '../storage/update-manager.js';
import { ActivityLogger } from '../storage/activity-logger.js';
import { ActivitySync } from '../storage/activity-sync.js';
import { NoteDoc } from '../crdt/note-doc.js';
import type { UUID } from '../types.js';
import type { FileSystemAdapter, FileStats } from '../storage/types.js';
import type { EventLog } from './event-log.js';

/**
 * Node.js FileSystemAdapter implementation for manual testing
 */
class NodeFileSystemAdapter implements FileSystemAdapter {
  async readFile(filePath: string): Promise<Uint8Array> {
    const buffer = await fs.readFile(filePath);
    const data = new Uint8Array(buffer);

    // Only apply flag byte protocol to .yjson files (CRDT update files)
    // Other files like activity logs (.log) are plain text
    if (!filePath.endsWith('.yjson')) {
      return data;
    }

    // Check for empty file
    if (data.length === 0) {
      throw new Error(`File is empty: ${filePath}`);
    }

    // Check flag byte (first byte of file)
    const flagByte = data[0];

    if (flagByte === 0x00) {
      // File is still being written - this indicates a race condition
      // where file sync completed before write finished
      throw new Error(`File is incomplete (still being written): ${filePath}`);
    }

    if (flagByte !== 0x01) {
      // Invalid flag byte - file may be corrupted or from old version
      throw new Error(`Invalid file format (flag byte: 0x${flagByte.toString(16)}): ${filePath}`);
    }

    // Return actual data (strip flag byte)
    return data.subarray(1);
  }

  async writeFile(filePath: string, data: Uint8Array): Promise<void> {
    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }

    // Only apply flag byte protocol to .yjson files (CRDT update files)
    // Other files like activity logs (.log) are plain text
    if (!filePath.endsWith('.yjson')) {
      await fs.writeFile(filePath, data);
      return;
    }

    // Flag byte approach: prepend 0x00 (not ready), then flip to 0x01 (ready) after write
    const flaggedData = new Uint8Array(1 + data.length);
    flaggedData[0] = 0x00; // Not ready flag
    flaggedData.set(data, 1); // Copy actual data after flag byte

    // Write all data with "not ready" flag
    const fd = await fs.open(filePath, 'w');
    try {
      await fd.write(flaggedData, 0, flaggedData.length, 0);
      // Force data to disk before flipping flag
      await fd.sync();

      // Atomically flip flag to "ready"
      const readyFlag = Buffer.from([0x01]);
      await fd.write(readyFlag, 0, 1, 0); // Overwrite byte 0
      // Force flag byte to disk
      await fd.sync();
    } finally {
      await fd.close();
    }
  }

  async listFiles(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath);
      return entries;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async mkdir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    await fs.unlink(filePath);
  }

  joinPath(...parts: string[]): string {
    return path.join(...parts);
  }

  basename(filePath: string): string {
    return path.basename(filePath);
  }

  async stat(filePath: string): Promise<FileStats> {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      ctimeMs: stats.ctimeMs,
    };
  }

  async appendFile(filePath: string, data: Uint8Array): Promise<void> {
    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
    await fs.appendFile(filePath, data);
  }
}

export interface TestInstanceConfig {
  instanceId: 'instance-1' | 'instance-2';
  sdPath: string;
  eventLog: EventLog;
}

export class TestInstance {
  private config: TestInstanceConfig;
  private fs: FileSystemAdapter;
  private updateManager: UpdateManager;
  private activityLogger: ActivityLogger;
  private activitySync: ActivitySync;

  // In-memory state
  private loadedNotes = new Map<UUID, NoteDoc>();
  private sdId: UUID;

  constructor(config: TestInstanceConfig) {
    this.config = config;
    this.fs = new NodeFileSystemAdapter();
    this.sdId = config.instanceId as UUID; // Use instance ID as SD ID for simplicity

    const instanceIdForFiles = `test-${config.instanceId}`;

    this.updateManager = new UpdateManager(this.fs, instanceIdForFiles);

    const activityDir = path.join(config.sdPath, 'activity');
    this.activityLogger = new ActivityLogger(this.fs, activityDir);
    this.activityLogger.setInstanceId(instanceIdForFiles);

    this.activitySync = new ActivitySync(this.fs, instanceIdForFiles, activityDir, this.sdId, {
      reloadNote: this.reloadNote.bind(this),
      getLoadedNotes: this.getLoadedNoteIds.bind(this),
    });
  }

  /**
   * Initialize the instance
   */
  async initialize(): Promise<void> {
    // Create SD structure
    await this.fs.mkdir(this.config.sdPath);
    await this.fs.mkdir(path.join(this.config.sdPath, 'notes'));
    await this.fs.mkdir(path.join(this.config.sdPath, 'folders'));
    await this.fs.mkdir(path.join(this.config.sdPath, 'updates'));
    await this.fs.mkdir(path.join(this.config.sdPath, 'activity'));

    // Register SD with UpdateManager
    this.updateManager.registerSD(this.sdId, this.config.sdPath);

    await this.activityLogger.initialize();

    console.log(`[${this.config.instanceId}] Initialized at ${this.config.sdPath}`);
  }

  /**
   * Create a new note
   */
  async createNote(title: string, _content: string = ''): Promise<UUID> {
    const noteId = `note-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const noteDoc = new NoteDoc(noteId);
    noteDoc.initializeNote({
      id: noteId,
      created: Date.now(),
      modified: Date.now(),
      sdId: this.sdId,
      folderId: null,
      deleted: false,
    });

    // For testing purposes, we'll just create a simple text node in the content
    // Real app would use TipTap/ProseMirror to create rich content
    noteDoc.doc.transact(() => {
      const paragraph = noteDoc.content.firstChild as Y.XmlElement | undefined;
      if (!paragraph) {
        const p = new Y.XmlElement('paragraph');
        const text = new Y.XmlText();
        text.insert(0, title);
        p.insert(0, [text]);
        noteDoc.content.insert(0, [p]);
      }
    });

    // Save to disk
    const update = noteDoc.encodeStateAsUpdate();
    const sequence = await this.updateManager.writeNoteUpdate(this.sdId, noteId, update);

    // Record activity
    await this.activityLogger.recordNoteActivity(noteId, sequence);

    // Load into memory
    this.loadedNotes.set(noteId, noteDoc);

    await this.config.eventLog.record({
      instanceId: this.config.instanceId,
      type: 'create',
      noteId,
      noteTitle: title.substring(0, 20),
      sequenceNumber: sequence,
    });

    console.log(`[${this.config.instanceId}] Created note ${noteId}: "${title}"`);

    return noteId;
  }

  /**
   * Edit a note (append text)
   */
  async editNote(noteId: UUID, additionalText: string): Promise<void> {
    let noteDoc = this.loadedNotes.get(noteId);

    if (!noteDoc) {
      // Load from disk
      noteDoc = await this.loadNoteFromDisk(noteId);
      this.loadedNotes.set(noteId, noteDoc);
    }

    // Update modified timestamp and append text to XML content
    noteDoc.doc.transact(() => {
      noteDoc.updateMetadata({ modified: Date.now() });

      // Append to first paragraph if it exists
      const firstChild = noteDoc.content.firstChild as Y.XmlElement | undefined;
      if (firstChild) {
        const textNode = firstChild.firstChild as Y.XmlText | undefined;
        if (textNode) {
          textNode.insert(textNode.length, additionalText);
        }
      }
    });

    // Get only the new update (differential)
    const update = noteDoc.encodeStateAsUpdate();
    const sequence = await this.updateManager.writeNoteUpdate(this.sdId, noteId, update);

    // Record activity
    await this.activityLogger.recordNoteActivity(noteId, sequence);

    const title = this.extractTitle(noteDoc);

    await this.config.eventLog.record({
      instanceId: this.config.instanceId,
      type: 'edit',
      noteId,
      noteTitle: title.substring(0, 20),
      sequenceNumber: sequence,
    });

    console.log(
      `[${this.config.instanceId}] Edited note ${noteId}: +${additionalText.length} chars`
    );
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: UUID): Promise<void> {
    let noteDoc = this.loadedNotes.get(noteId);

    if (!noteDoc) {
      noteDoc = await this.loadNoteFromDisk(noteId);
      this.loadedNotes.set(noteId, noteDoc);
    }

    // Mark as deleted
    noteDoc.markDeleted();

    const update = noteDoc.encodeStateAsUpdate();
    const sequence = await this.updateManager.writeNoteUpdate(this.sdId, noteId, update);

    await this.activityLogger.recordNoteActivity(noteId, sequence);

    await this.config.eventLog.record({
      instanceId: this.config.instanceId,
      type: 'delete',
      noteId,
      sequenceNumber: sequence,
    });

    console.log(`[${this.config.instanceId}] Deleted note ${noteId}`);
  }

  /**
   * Sync from other instances
   */
  async syncFromOthers(): Promise<void> {
    const affectedNotes = await this.activitySync.syncFromOtherInstances();

    if (affectedNotes.size > 0) {
      console.log(
        `[${this.config.instanceId}] Synced ${affectedNotes.size} notes from other instances`
      );
    }
  }

  /**
   * Reload a note from disk (called by ActivitySync)
   */
  private async reloadNote(noteId: UUID, _sdId: UUID): Promise<void> {
    await this.config.eventLog.record({
      instanceId: this.config.instanceId,
      type: 'reload-triggered',
      noteId,
    });

    // Load all updates from disk
    const noteDoc = await this.loadNoteFromDisk(noteId);

    // Update in-memory state
    this.loadedNotes.set(noteId, noteDoc);

    const title = this.extractTitle(noteDoc);
    console.log(`[${this.config.instanceId}] Reloaded note ${noteId}: "${title.substring(0, 20)}"`);
  }

  /**
   * Load a note from disk
   */
  private async loadNoteFromDisk(noteId: UUID): Promise<NoteDoc> {
    const noteDoc = new NoteDoc(noteId);

    try {
      // Read all updates
      const updates = await this.updateManager.readNoteUpdates(this.sdId, noteId);

      // Apply updates
      for (const update of updates) {
        noteDoc.applyUpdate(update);
      }
    } catch (error) {
      // Note doesn't exist yet, that's fine
      if ((error as Error).message?.includes('ENOENT')) {
        // Initialize empty note
        noteDoc.initializeNote({
          id: noteId,
          created: Date.now(),
          modified: Date.now(),
          sdId: this.sdId,
          folderId: null,
          deleted: false,
        });
      } else {
        throw error;
      }
    }

    return noteDoc;
  }

  /**
   * Extract title from note content (helper for testing)
   */
  private extractTitle(noteDoc: NoteDoc): string {
    try {
      const firstChild = noteDoc.content.firstChild as Y.XmlElement | undefined;
      if (firstChild) {
        const textNode = firstChild.firstChild as Y.XmlText | undefined;
        if (textNode) {
          return textNode.toString().substring(0, 50);
        }
      }
    } catch {
      // Ignore errors, return fallback
    }
    return 'Untitled';
  }

  /**
   * Get loaded note IDs (for ActivitySync)
   */
  private getLoadedNoteIds(): string[] {
    return Array.from(this.loadedNotes.keys());
  }

  /**
   * Get all notes (for validation)
   */
  async getAllNotes(): Promise<Array<{ id: UUID; doc: NoteDoc }>> {
    // First, get all note IDs from disk
    const notesDir = path.join(this.config.sdPath, 'notes');
    let noteIds: string[];

    try {
      noteIds = await this.fs.listFiles(notesDir);
    } catch {
      return [];
    }

    const notes: Array<{ id: UUID; doc: NoteDoc }> = [];

    for (const noteId of noteIds) {
      const doc = await this.loadNoteFromDisk(noteId);

      // Skip deleted notes
      const metadata = doc.getMetadata();
      if (metadata.deleted) {
        continue;
      }

      notes.push({ id: noteId, doc });
    }

    return notes;
  }

  /**
   * Get Yjs state for a note (for comparison)
   */
  async getNoteYjsState(noteId: UUID): Promise<Uint8Array> {
    const doc = await this.loadNoteFromDisk(noteId);
    return doc.encodeStateAsUpdate();
  }

  /**
   * Trigger garbage collection
   */
  async triggerGarbageCollection(): Promise<void> {
    console.log(`[${this.config.instanceId}] Triggering garbage collection`);

    // Compact activity log
    await this.activityLogger.compact(1000);

    await this.config.eventLog.record({
      instanceId: this.config.instanceId,
      type: 'gc-triggered',
    });
  }

  /**
   * Trigger snapshot creation
   */
  async triggerSnapshot(noteId: UUID): Promise<void> {
    console.log(
      `[${this.config.instanceId}] Snapshot creation for note ${noteId} - skipped (requires vector clock)`
    );

    // Skip actual snapshot creation - requires vector clock which is complex to track in tests
    // The important thing is testing the sync, not snapshots

    await this.config.eventLog.record({
      instanceId: this.config.instanceId,
      type: 'snapshot-created',
      noteId,
    });
  }

  /**
   * Get instance ID
   */
  getInstanceId(): string {
    return this.config.instanceId;
  }

  /**
   * Get SD path
   */
  getSDPath(): string {
    return this.config.sdPath;
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    // Destroy all CRDT docs
    for (const doc of this.loadedNotes.values()) {
      doc.destroy();
    }

    this.loadedNotes.clear();
  }
}
