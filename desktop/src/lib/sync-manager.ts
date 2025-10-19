/**
 * Sync Manager - Coordinates CRDT-based multi-instance sync
 * Uses UpdateStore for append-only file operations
 */
import { CRDTManager } from './crdt-manager';
import { UpdateStore } from './update-store';
import { AttachmentManager } from './attachment-manager';
import { generateUUID, type Note } from './utils';
import type { NoteManager } from './note-manager';
import * as Y from 'yjs';

type SyncListener = (event: string, data: any) => void;
type SyncStatus = 'idle' | 'watching' | 'syncing' | 'error';

interface SyncStats {
  instanceId: string;
  status: SyncStatus;
  lastSyncTime: Date | null;
  initializedNotes: string[];
  crdtStats: any;
}

export class SyncManager {
  noteManager: NoteManager;
  notesPath: string;
  isElectron: boolean;
  watchId: string | null;
  syncStatus: SyncStatus;
  listeners: Set<SyncListener>;
  lastSyncTime: Date | null;
  crdtManager: CRDTManager;
  instanceId: string;
  updateStore: UpdateStore;
  attachmentManager: AttachmentManager;
  initializedNotes: Set<string>;
  syncInterval: NodeJS.Timeout | null;

  constructor(noteManager: NoteManager, notesPath: string, instanceId: string | null = null) {
    this.noteManager = noteManager;
    this.notesPath = notesPath;
    this.isElectron = window.electronAPI?.isElectron || false;
    this.watchId = null;
    this.syncStatus = 'idle';
    this.listeners = new Set();
    this.lastSyncTime = null;
    this.crdtManager = new CRDTManager();

    // Generate or use provided instance ID
    console.log(`[SyncManager] constructor: instanceId param = ${instanceId}`);
    this.instanceId = instanceId || `instance-${generateUUID().substring(0, 8)}`;
    console.log(`[SyncManager] constructor: using instanceId = ${this.instanceId}`);

    // Create UpdateStore for this instance (pass minimal storage interface)
    const storageInterface = {
      isElectron: this.isElectron,
      notesPath: this.notesPath
    };
    this.updateStore = new UpdateStore(storageInterface, this.instanceId);

    // Create AttachmentManager (pass full storage interface with file operations)
    const attachmentStorageInterface = {
      isElectron: this.isElectron,
      notesPath: this.notesPath,
      readFile: async (path: string): Promise<Uint8Array> => {
        if (!this.isElectron) throw new Error('File operations only available in Electron');
        const result = await window.electronAPI.fileSystem.readFile(path);
        if (!result.success || !result.content) {
          throw new Error(result.error || 'Failed to read file');
        }
        // Electron serializes Uint8Array as {type: 'Buffer', data: [...]}
        // Convert it back to Uint8Array
        if (result.content && typeof result.content === 'object' && 'type' in result.content && result.content.type === 'Buffer') {
          return new Uint8Array((result.content as any).data);
        }
        return result.content;
      },
      writeFile: async (path: string, data: Uint8Array): Promise<void> => {
        if (!this.isElectron) throw new Error('File operations only available in Electron');
        // Electron IPC can handle Uint8Array directly
        await window.electronAPI.fileSystem.writeFile(path, data);
      },
      exists: async (path: string) => {
        if (!this.isElectron) throw new Error('File operations only available in Electron');
        return await window.electronAPI.fileSystem.exists(path);
      },
      mkdir: async (path: string) => {
        if (!this.isElectron) throw new Error('File operations only available in Electron');
        await window.electronAPI.fileSystem.mkdir(path);
      },
      deleteFile: async (path: string) => {
        if (!this.isElectron) throw new Error('File operations only available in Electron');
        await window.electronAPI.fileSystem.deleteFile(path);
      },
      readDir: async (path: string) => {
        if (!this.isElectron) throw new Error('File operations only available in Electron');
        return await window.electronAPI.fileSystem.readDir(path);
      }
    };
    this.attachmentManager = new AttachmentManager(attachmentStorageInterface);

    // Track which notes are initialized with UpdateStore
    this.initializedNotes = new Set();

    // Sync interval timer
    this.syncInterval = null;

    // Listen to CRDT updates
    this.setupCRDTListener();

    console.log('SyncManager created for instance:', this.instanceId);
  }

  /**
   * Add a listener for sync events
   * @param listener - Callback for sync events
   */
  addListener(listener: SyncListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove a listener
   * @param listener - Listener to remove
   */
  removeListener(listener: SyncListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of sync events
   * @param event - Event type
   * @param data - Event data
   */
  notify(event: string, data: any): void {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  /**
   * Update sync status
   * @param status - New status
   */
  updateStatus(status: SyncStatus): void {
    this.syncStatus = status;
    this.notify('status-changed', { status, time: new Date() });
  }

  /**
   * Set up listener for CRDT update events (both content and metadata)
   */
  setupCRDTListener(): void {
    this.crdtManager.addListener(async (event, data) => {
      if (event === 'content-updated') {
        // Content update - pass 'content' type to UpdateStore
        const { noteId, update } = data;
        await this.updateStore.addUpdate(noteId, new Uint8Array(update), 'content');
      }
      else if (event === 'metadata-updated') {
        // Metadata update - pass 'metadata' type to UpdateStore
        const { noteId, update } = data;
        await this.updateStore.addUpdate(noteId, new Uint8Array(update), 'metadata');
      }
      // Backward compatibility: also handle old 'doc-updated' event
      else if (event === 'doc-updated') {
        const { noteId, update } = data;
        await this.updateStore.addUpdate(noteId, new Uint8Array(update), 'content');
      }
    });
  }

  /**
   * Start watching for file changes and syncing
   */
  async startWatching(): Promise<void> {
    if (!this.isElectron) {
      console.log('Not in Electron mode, skipping file watch');
      return;
    }

    if (this.watchId) {
      console.log('Already watching');
      return;
    }

    try {
      if (!this.notesPath || this.notesPath === 'localStorage') {
        console.log('Invalid notes path');
        return;
      }

      // Start periodic sync check (every 2 seconds)
      this.syncInterval = setInterval(() => {
        this.performSync();
      }, 2000);

      this.updateStatus('watching');
      this.lastSyncTime = new Date();
      console.log('Started sync watching for instance:', this.instanceId);
    } catch (error) {
      console.error('Error starting sync watch:', error);
      this.updateStatus('error');
    }
  }

  /**
   * Stop watching for changes
   */
  async stopWatching(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Flush any pending updates
    for (const noteId of this.initializedNotes) {
      await this.updateStore.cleanup(noteId);
    }

    this.updateStatus('idle');
    console.log('Stopped sync watching');
  }

  /**
   * Perform sync: read new updates and apply them
   */
  async performSync(): Promise<void> {
    if (!this.isElectron) return;

    this.updateStatus('syncing');

    try {
      console.log('[performSync] Starting sync cycle...');

      // First, scan for new notes created by other instances
      await this.scanForNewNotes();

      // Check for folder changes
      await this.syncFolders();

      // Get ALL notes (including deleted ones) to sync their state
      // We need to sync deleted notes too, otherwise other instances won't see deletions
      const allNotes = Array.from(this.noteManager.notes.values());
      console.log(`[performSync] Syncing ${allNotes.length} notes`);

      for (const note of allNotes) {
        console.log(`[performSync] Syncing note ${note.id} (deleted: ${note.deleted})`);
        await this.syncNote(note.id);
      }

      // Check for gaps after syncing all notes
      await this.checkForGaps();

      this.lastSyncTime = new Date();
      this.updateStatus('watching');
      console.log('[performSync] Sync cycle complete');
    } catch (error) {
      console.error('Error performing sync:', error);
      this.updateStatus('error');
    }
  }

  /**
   * Check for gaps in all notes and emit events
   */
  async checkForGaps(): Promise<void> {
    if (!this.isElectron) return;

    try {
      // Get all notes with gaps
      const notesWithGaps = this.updateStore.getNotesWithGaps();

      // Check each note and emit appropriate events
      for (const noteId of notesWithGaps) {
        const summary = this.updateStore.getGapSummary(noteId);
        if (summary) {
          // Emit gap detected event (NoteManager will forward to renderer)
          this.noteManager.notify('note-gaps-detected', {
            noteId,
            summary
          });
        }
      }

      // Check for notes that previously had gaps but now don't
      const allNotes = Array.from(this.noteManager.notes.values());
      for (const note of allNotes) {
        if (!this.updateStore.hasGaps(note.id)) {
          // This note has no gaps - emit resolved event
          this.noteManager.notify('note-gaps-resolved', { noteId: note.id });
        }
      }
    } catch (error) {
      console.error('Error checking for gaps:', error);
    }
  }

  /**
   * Check for folder structure changes from other instances
   * Uses CRDT-based sync just like notes
   */
  async syncFolders(): Promise<void> {
    if (!this.isElectron) return;

    try {
      // Sync the folders CRDT document just like any other note
      const folderId = 'folders';

      console.log('[syncFolders] Checking for folder changes...');

      // Initialize UpdateStore for folders if not done yet
      if (!this.initializedNotes.has(folderId)) {
        console.log('[syncFolders] Initializing UpdateStore for folders');
        await this.updateStore.initialize(folderId);
        this.initializedNotes.add(folderId);
      }

      // Read new updates from other instances
      const newUpdates = await this.updateStore.readNewUpdates(folderId);
      console.log(`[syncFolders] Found ${newUpdates.length} new folder updates`);

      if (newUpdates.length === 0) {
        return; // No folder changes
      }

      console.log(`[SyncManager] Syncing ${newUpdates.length} folder updates`);

      // Apply each update to the CRDT
      for (const { instanceId, sequence, update } of newUpdates) {
        this.crdtManager.applyUpdate(folderId, update, 'remote');
        console.log(`Applied folder update ${sequence} from ${instanceId}`);
      }

      // Reload folders from CRDT
      const folderManager = this.noteManager.getFolderManager();
      await folderManager.loadCustomFolders();

      // Notify renderer to update folder tree
      this.noteManager.notify('folders-synced', {
        folders: folderManager.getFolderTree()
      });

      console.log('[SyncManager] Folder structure synced');
    } catch (error) {
      console.error('Error syncing folders:', error);
    }
  }

  /**
   * Scan filesystem for new notes created by other instances
   */
  async scanForNewNotes(): Promise<void> {
    if (!this.isElectron) return;

    try {
      if (!this.notesPath || this.notesPath === 'localStorage') {
        return;
      }

      // Check if notes directory exists
      const notesDir = `${this.notesPath}/notes`;
      const exists = await window.electronAPI?.fileSystem.exists(notesDir);
      if (!exists) {
        return;
      }

      // Read all subdirectories (each is a note)
      const result = await window.electronAPI?.fileSystem.readDir(notesDir);
      if (!result || !result.success) {
        return;
      }

      // Get currently known note IDs
      const knownNoteIds = new Set(this.noteManager.getAllNotes().map(n => n.id));

      // Check each directory
      if (!result) return;
      for (const item of result.files || []) {
        // Skip hidden files and already-known notes
        if (item.startsWith('.') || knownNoteIds.has(item)) continue;

        const noteId = item;
        const noteDir = `${this.notesPath}/notes/${noteId}`;

        // Check if updates directory exists (indicates this is a real note)
        const updatesDir = `${noteDir}/updates`;
        const updatesExist = await window.electronAPI?.fileSystem.exists(updatesDir);

        if (!updatesExist) {
          continue; // Not a note directory
        }

        // New note discovered! Load it
        console.log(`[SyncManager] Discovered new note from other instance: ${noteId}`);
        const note = await this.loadNote(noteId);

        if (note) {
          // Add to NoteManager
          this.noteManager.notes.set(noteId, note);

          // Notify UI about new note
          this.noteManager.notify('note-created', { note, source: 'sync' });
          console.log(`[SyncManager] Added new note to manager: ${note.title || noteId}`);
        }
      }
    } catch (error) {
      console.error('Error scanning for new notes:', error);
    }
  }

  /**
   * Sync a specific note
   * @param noteId - Note ID
   */
  async syncNote(noteId: string): Promise<void> {
    try {
      // Initialize UpdateStore for this note if not done yet
      if (!this.initializedNotes.has(noteId)) {
        await this.updateStore.initialize(noteId);
        this.initializedNotes.add(noteId);
      }

      // Read new updates from other instances
      const newUpdates = await this.updateStore.readNewUpdates(noteId);

      console.log(`[syncNote] Found ${newUpdates.length} new updates for note ${noteId}`);

      if (newUpdates.length === 0) {
        return; // No new updates
      }

      console.log(`Syncing ${newUpdates.length} updates for note ${noteId}`);

      // Apply each update to the correct CRDT doc based on type
      for (const { instanceId, sequence, update, type } of newUpdates) {
        if (type === 'content') {
          this.crdtManager.applyContentUpdate(noteId, update, 'remote');
        } else if (type === 'metadata') {
          this.crdtManager.applyMetadataUpdate(noteId, update, 'remote');
        }
        console.log(`Applied ${type} update ${sequence} from ${instanceId} to note ${noteId}`);
      }

      // Extract the merged note from CRDT
      const mergedNote = this.crdtManager.getNoteFromDoc(noteId);
      mergedNote.id = noteId;

      console.log(`[syncNote] Merged note ${noteId}:`, {
        id: mergedNote.id,
        title: mergedNote.title,
        deleted: mergedNote.deleted,
        folderId: mergedNote.folderId
      });

      // Update in NoteManager (this will NOT trigger a save because we're not calling saveNote)
      this.noteManager.notes.set(noteId, mergedNote);

      // Notify UI to update based on what changed
      if (mergedNote.deleted) {
        // If note was deleted, notify as deletion
        this.noteManager.notify('note-deleted', {
          note: mergedNote,
          source: 'sync'
        });
      } else {
        // Normal update
        this.noteManager.notify('note-updated', {
          note: mergedNote,
          source: 'sync'
        });
      }

      this.notify('note-synced', { noteId, updateCount: newUpdates.length });
    } catch (error) {
      console.error(`Error syncing note ${noteId}:`, error);
    }
  }

  /**
   * Save a note with CRDT
   * Called by NoteManager when a note is saved locally
   * @param note - Note to save
   * @returns Success
   */
  async saveNoteWithCRDT(note: Note): Promise<boolean> {
    console.log('=== saveNoteWithCRDT called ===');
    console.log('  Note ID:', note.id);
    console.log('  Note title:', note.title);

    if (!this.isElectron) {
      // Web mode - this shouldn't be called (NoteManager handles web storage)
      console.error('ERROR: saveNoteWithCRDT called in web mode! This should not happen.');
      return false;
    }

    try {
      // Initialize UpdateStore for this note if not done yet
      if (!this.initializedNotes.has(note.id)) {
        await this.updateStore.initialize(note.id);
        this.initializedNotes.add(note.id);
      }

      // Initialize or update CRDT document
      const isEmpty = this.crdtManager.isDocEmpty(note.id);
      console.log('  CRDT doc empty:', isEmpty);

      if (isEmpty) {
        console.log('  Initializing new CRDT document');
        this.crdtManager.initializeNote(note.id, note);
      } else {
        // Always update critical metadata that changes outside the editor
        // (deleted flag, folder assignments, sync directory) even if the CRDT already exists
        const criticalMetadata: Record<string, any> = {};
        if (note.deleted !== undefined) {
          criticalMetadata.deleted = note.deleted;
        }
        if (note.folderId !== undefined) {
          criticalMetadata.folderId = note.folderId;
        }
        if (note.syncDirectoryId !== undefined) {
          criticalMetadata.syncDirectoryId = note.syncDirectoryId;
        }

        if (Object.keys(criticalMetadata).length > 0) {
          console.log('  Updating critical metadata:', criticalMetadata);
          this.crdtManager.updateMetadata(note.id, criticalMetadata);
        } else {
          console.log('  CRDT document already exists - no critical metadata updates');
        }
      }

      // If we updated critical metadata (deletion, folder moves), flush immediately
      // so other instances can see the changes right away
      // (Updates are automatically added to UpdateStore by CRDT listener)
      console.log('  Checking flush: deleted=' + note.deleted + ', folderId=' + note.folderId);
      const hasCriticalMetadata = note.deleted !== undefined || note.folderId !== undefined;
      console.log('  hasCriticalMetadata:', hasCriticalMetadata);
      if (hasCriticalMetadata) {
        console.log('  Flushing critical metadata immediately');
        await this.updateStore.flush(note.id);
      }

      console.log('=== saveNoteWithCRDT complete ===');
      return true;
    } catch (error) {
      console.error('Error saving note with CRDT:', error);
      console.error('Stack trace:', (error as Error).stack);
      return false;
    }
  }

  /**
   * Load all notes from CRDT update files
   * @returns Array of notes
   */
  async loadAllNotes(): Promise<Note[]> {
    if (!this.isElectron) return [];

    try {
      console.log('=== loadAllNotes called ===');
      console.log('Notes path:', this.notesPath);

      if (!this.notesPath || this.notesPath === 'localStorage') {
        console.log('Invalid notes path');
        return [];
      }

      // Check if notes directory exists
      const notesDir = `${this.notesPath}/notes`;
      const exists = await window.electronAPI?.fileSystem.exists(notesDir);
      console.log('Notes directory exists:', exists);
      if (!exists) {
        return [];
      }

      // Read all subdirectories (each is a note)
      const result = await window.electronAPI?.fileSystem.readDir(notesDir);
      if (!result || !result.success) {
        console.error('Failed to read notes directory:', result?.error);
        return [];
      }

      console.log('Found items in notes directory:', result.files?.length || 0);

      const notes: Note[] = [];

      if (!result) return [];
      for (const item of result.files || []) {
        // Skip hidden files and non-directories
        if (item.startsWith('.')) continue;

        // Each directory is a note ID
        const noteId = item;
        console.log(`Checking note directory: ${noteId}`);

        const noteDir = `${this.notesPath}/notes/${noteId}`;

        // Check if updates directory exists (indicates this is a real note)
        const updatesDir = `${noteDir}/updates`;
        const updatesExist = await window.electronAPI?.fileSystem.exists(updatesDir);
        console.log(`  updates/ exists: ${updatesExist}`);

        if (!updatesExist) {
          continue; // Not a note directory
        }

        try {
          // Load the note from CRDT updates
          console.log(`  Loading note ${noteId}...`);
          const note = await this.loadNote(noteId);
          if (note) {
            console.log(`  ✓ Loaded: ${note.title}`);
            notes.push(note);
          } else {
            console.log(`  ✗ loadNote returned null`);
          }
        } catch (error) {
          console.error(`Error loading note ${noteId}:`, error);
        }
      }

      console.log(`=== Loaded ${notes.length} notes total ===`);

      // Sort by modification date
      return notes.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    } catch (error) {
      console.error('Error loading all notes:', error);
      return [];
    }
  }

  /**
   * Load a note and initialize CRDT from update files
   * @param noteId - Note ID
   * @returns Note or null
   */
  async loadNote(noteId: string): Promise<Note | null> {
    try {
      // Initialize UpdateStore for this note
      if (!this.initializedNotes.has(noteId)) {
        await this.updateStore.initialize(noteId);
        this.initializedNotes.add(noteId);
      }

      // Load ALL updates from all instances (not just "new" ones)
      // This is needed on startup to reconstruct the full note state
      const allUpdates = await this.updateStore.readAllUpdates(noteId);

      if (allUpdates.length === 0) {
        // No updates = note doesn't exist
        return null;
      }

      console.log(`[📥 LOAD] Loading note ${noteId} from ${allUpdates.length} CRDT updates`);

      // IMPORTANT: Do NOT clearDoc()! Y.js updates are incremental diffs that expect previous state.
      // Clearing the doc and then applying incremental updates causes corruption.
      // Instead, just apply updates to the existing (or new) Y.Doc.

      // Apply all updates to build the current state
      // Use the type tag to apply each update to the correct Y.Doc
      let prevKeyCount = 0;
      for (let i = 0; i < allUpdates.length; i++) {
        const { update, sequence, instanceId, type } = allUpdates[i];
        console.log(`[📥 LOAD] Applying update ${i+1}/${allUpdates.length} (type: ${type}, seq ${sequence}, instance ${instanceId}, size ${update.length} bytes)`);

        // Apply to the correct doc based on type
        if (type === 'content') {
          this.crdtManager.applyContentUpdate(noteId, update, 'load');
        } else if (type === 'metadata') {
          this.crdtManager.applyMetadataUpdate(noteId, update, 'load');
        }

        // Debug: check metadata after EVERY update to find where keys disappear
        const metadataDoc = this.crdtManager.getMetadataDoc(noteId);
        const yMeta = metadataDoc.getMap('metadata');
        const keys = Array.from(yMeta.keys());

        // Only log if key count changed
        if (i === 0 || keys.length !== prevKeyCount) {
          console.log(`[📥 LOAD]   After update ${i+1}: metadata has ${yMeta.size} keys: [${keys.join(', ')}]`);
          prevKeyCount = keys.length;
        }
      }
      console.log(`[📥 LOAD] All updates applied for note ${noteId}`);

      // DEBUG: Check content Y.Doc AFTER applying all updates
      const contentDocAfterLoad = this.crdtManager.getContentDoc(noteId);
      const yContentAfterLoad = contentDocAfterLoad.getXmlFragment('default');
      console.log(`[📥 LOAD] Content Y.Doc after loading all updates:`, {
        length: yContentAfterLoad.length,
        hasImage: yContentAfterLoad.toString().includes('<image'),
        preview: yContentAfterLoad.toString().substring(0, 300)
      });

      // Check metadata AFTER applying all updates
      const metadataDoc = this.crdtManager.getMetadataDoc(noteId);
      const yMetadata = metadataDoc.getMap('metadata');
      const metadataTitle = yMetadata.get('title');

      // Debug: log ALL metadata keys and values
      const allKeys = Array.from(yMetadata.keys());
      console.log(`[📥 LOAD] Metadata has ${yMetadata.size} keys: [${allKeys.join(', ')}]`);
      console.log(`[📥 LOAD] Metadata values:`,
        `title="${metadataTitle}"`,
        `created="${yMetadata.get('created')}"`,
        `modified="${yMetadata.get('modified')}"`,
        `tags="${JSON.stringify(yMetadata.get('tags'))}"`,
        `folderId="${yMetadata.get('folderId')}"`,
        `deleted="${yMetadata.get('deleted')}"`,
        `syncDirectoryId="${yMetadata.get('syncDirectoryId')}"`
      );

      // Extract the merged note from CRDT
      const note = this.crdtManager.getNoteFromDoc(noteId);
      note.id = noteId;
      console.log(`[SyncManager] Extracted note from getNoteFromDoc: title="${note.title}", syncDirectoryId="${note.syncDirectoryId}"`);

      // IMPORTANT: Do NOT persist extracted titles back to the Y.Doc during load!
      // This creates conflicting CRDT updates that corrupt metadata due to Y.js conflict resolution.
      // The extracted title is used for display purposes only.

      return note;
    } catch (error) {
      console.error('Error loading note:', error);
      return null;
    }
  }

  /**
   * Get the CRDT document for a note (for TipTap integration)
   * @deprecated Use getContentDoc() directly from crdtManager
   * @param noteId - Note ID
   * @returns Yjs document (content doc)
   */
  getDoc(noteId: string): Y.Doc {
    console.warn('[SyncManager] getDoc() is deprecated - use crdtManager.getContentDoc()');
    return this.crdtManager.getContentDoc(noteId);
  }

  /**
   * Get the content fragment for TipTap
   * @param noteId - Note ID
   * @returns Fragment for TipTap
   */
  getContentFragment(noteId: string): Y.XmlFragment {
    return this.crdtManager.getContentFragment(noteId);
  }

  /**
   * Get sync statistics
   * @returns Stats
   */
  getStats(): SyncStats {
    return {
      instanceId: this.instanceId,
      status: this.syncStatus,
      lastSyncTime: this.lastSyncTime,
      initializedNotes: Array.from(this.initializedNotes),
      crdtStats: this.crdtManager.getStats()
    };
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    await this.stopWatching();
    this.crdtManager.destroy();
    this.listeners.clear();
    console.log('SyncManager destroyed');
  }
}
