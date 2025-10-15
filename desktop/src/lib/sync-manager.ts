/**
 * Sync Manager - Coordinates CRDT-based multi-instance sync
 * Uses UpdateStore for append-only file operations
 */
import { CRDTManager } from './crdt-manager';
import { UpdateStore } from './update-store';
import { generateUUID } from './utils';
import type { NoteManager } from './note-manager';
import * as Y from 'yjs';

interface Note {
  id: string;
  title: string;
  content: string;
  created: string;
  modified: string;
  tags: string[];
  deleted: boolean;
  folderId: string;
}

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
   * Set up listener for CRDT update events
   */
  setupCRDTListener(): void {
    this.crdtManager.addListener(async (event, data) => {
      if (event === 'doc-updated') {
        // CRDT document was updated locally
        // Add update to UpdateStore buffer (will be flushed on idle)
        const { noteId, update } = data;
        await this.updateStore.addUpdate(noteId, new Uint8Array(update));
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
      // Sync the .folders CRDT document just like any other note
      const folderId = '.folders';

      console.log('[syncFolders] Checking for folder changes...');

      // Initialize UpdateStore for folders if not done yet
      if (!this.initializedNotes.has(folderId)) {
        console.log('[syncFolders] Initializing UpdateStore for .folders');
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
      const exists = await window.electronAPI.fileSystem.exists(this.notesPath);
      if (!exists) {
        return;
      }

      // Read all subdirectories (each is a note)
      const result = await window.electronAPI.fileSystem.readDir(this.notesPath);
      if (!result.success) {
        return;
      }

      // Get currently known note IDs
      const knownNoteIds = new Set(this.noteManager.getAllNotes().map(n => n.id));

      // Check each directory
      for (const item of result.files) {
        // Skip hidden files and already-known notes
        if (item.startsWith('.') || knownNoteIds.has(item)) continue;

        const noteId = item;
        const noteDir = `${this.notesPath}/${noteId}`;

        // Check if updates directory exists (indicates this is a real note)
        const updatesDir = `${noteDir}/updates`;
        const updatesExist = await window.electronAPI.fileSystem.exists(updatesDir);

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

      // Apply each update to the CRDT
      for (const { instanceId, sequence, update } of newUpdates) {
        this.crdtManager.applyUpdate(noteId, update, 'remote');
        console.log(`Applied update ${sequence} from ${instanceId} to note ${noteId}`);
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
        console.log(`[syncNote] Notifying note-deleted for ${noteId}`);
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
        // (deleted flag, folder assignments) even if the CRDT already exists
        const criticalMetadata: Record<string, any> = {};
        if (note.deleted !== undefined) {
          criticalMetadata.deleted = note.deleted;
        }
        if (note.folderId !== undefined) {
          criticalMetadata.folder = note.folderId; // Note: CRDT uses 'folder', not 'folderId'
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
      const exists = await window.electronAPI.fileSystem.exists(this.notesPath);
      console.log('Notes directory exists:', exists);
      if (!exists) {
        return [];
      }

      // Read all subdirectories (each is a note)
      const result = await window.electronAPI.fileSystem.readDir(this.notesPath);
      if (!result.success) {
        console.error('Failed to read notes directory:', result.error);
        return [];
      }

      console.log('Found items in notes directory:', result.files.length);

      const notes: Note[] = [];

      for (const item of result.files) {
        // Skip hidden files and non-directories
        if (item.startsWith('.')) continue;

        // Each directory is a note ID
        const noteId = item;
        console.log(`Checking note directory: ${noteId}`);

        const noteDir = `${this.notesPath}/${noteId}`;

        // Check if updates directory exists (indicates this is a real note)
        const updatesDir = `${noteDir}/updates`;
        const updatesExist = await window.electronAPI.fileSystem.exists(updatesDir);
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

      console.log(`[SyncManager] Loading note ${noteId} from ${allUpdates.length} CRDT updates`);

      // IMPORTANT: Clear any existing Y.Doc content before loading
      // This ensures we start fresh and apply all updates in order
      this.crdtManager.clearDoc(noteId);

      // Apply all updates to build the current state
      for (const { update } of allUpdates) {
        this.crdtManager.applyUpdate(noteId, update, 'load');
      }

      // Check metadata AFTER applying all updates
      const doc = this.crdtManager.getDoc(noteId);
      const yMetadata = doc.getMap('metadata');
      const metadataTitle = yMetadata.get('title');
      console.log(`[SyncManager] After applying updates, metadata title: "${metadataTitle}"`);

      // Extract the merged note from CRDT
      const note = this.crdtManager.getNoteFromDoc(noteId);
      note.id = noteId;
      console.log(`[SyncManager] Extracted note title from getNoteFromDoc: "${note.title}"`);

      // If we extracted a title from content (because metadata title was empty/Untitled),
      // update the metadata to persist it for next load
      if ((!metadataTitle || metadataTitle === 'Untitled') && note.title && note.title !== 'Untitled') {
        console.log(`[SyncManager] Persisting extracted title to metadata: "${note.title}"`);
        this.crdtManager.updateMetadata(noteId, { title: note.title });
        // Flush the metadata update immediately
        const flushResult = await this.updateStore.flush(noteId);
        console.log(`[SyncManager] Flush result:`, flushResult);
        // Verify the title is now in metadata
        const newMetadataTitle = yMetadata.get('title');
        console.log(`[SyncManager] After flush, metadata title: "${newMetadataTitle}"`);
      }

      return note;
    } catch (error) {
      console.error('Error loading note:', error);
      return null;
    }
  }

  /**
   * Get the CRDT document for a note (for TipTap integration)
   * @param noteId - Note ID
   * @returns Yjs document
   */
  getDoc(noteId: string): Y.Doc {
    return this.crdtManager.getDoc(noteId);
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
