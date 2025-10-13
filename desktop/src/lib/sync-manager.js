/**
 * Sync Manager - Coordinates CRDT-based multi-instance sync
 * Uses UpdateStore for append-only file operations
 */
import { CRDTManager } from './crdt-manager.js';
import { UpdateStore } from './update-store.js';
import { generateUUID } from './utils.js';

export class SyncManager {
  constructor(noteManager, fileStorage, instanceId = null) {
    this.noteManager = noteManager;
    this.fileStorage = fileStorage;
    this.isElectron = window.electronAPI?.isElectron || false;
    this.watchId = null;
    this.syncStatus = 'idle'; // idle, watching, syncing, error
    this.listeners = new Set();
    this.lastSyncTime = null;
    this.crdtManager = new CRDTManager();

    // Generate or use provided instance ID
    this.instanceId = instanceId || `instance-${generateUUID().substring(0, 8)}`;

    // Create UpdateStore for this instance
    this.updateStore = new UpdateStore(fileStorage, this.instanceId);

    // Track which notes are initialized with UpdateStore
    this.initializedNotes = new Set();

    // Listen to CRDT updates
    this.setupCRDTListener();

    console.log('SyncManager created for instance:', this.instanceId);
  }

  /**
   * Add a listener for sync events
   * @param {Function} listener - Callback for sync events
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * Remove a listener
   * @param {Function} listener - Listener to remove
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of sync events
   * @param {string} event - Event type
   * @param {object} data - Event data
   */
  notify(event, data) {
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
   * @param {string} status - New status
   */
  updateStatus(status) {
    this.syncStatus = status;
    this.notify('status-changed', { status, time: new Date() });
  }

  /**
   * Set up listener for CRDT update events
   */
  setupCRDTListener() {
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
  async startWatching() {
    if (!this.isElectron) {
      console.log('Not in Electron mode, skipping file watch');
      return;
    }

    if (this.watchId) {
      console.log('Already watching');
      return;
    }

    try {
      const notesPath = this.fileStorage.notesPath;
      if (!notesPath || notesPath === 'localStorage') {
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
  async stopWatching() {
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
  async performSync() {
    if (!this.isElectron) return;

    this.updateStatus('syncing');

    try {
      // Get all notes that have been loaded
      const notes = this.noteManager.getAllNotes();

      for (const note of notes) {
        await this.syncNote(note.id);
      }

      this.lastSyncTime = new Date();
      this.updateStatus('watching');
    } catch (error) {
      console.error('Error performing sync:', error);
      this.updateStatus('error');
    }
  }

  /**
   * Sync a specific note
   * @param {string} noteId - Note ID
   */
  async syncNote(noteId) {
    try {
      // Initialize UpdateStore for this note if not done yet
      if (!this.initializedNotes.has(noteId)) {
        await this.updateStore.initialize(noteId);
        this.initializedNotes.add(noteId);
      }

      // Read new updates from other instances
      const newUpdates = await this.updateStore.readNewUpdates(noteId);

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

      // Update in NoteManager (this will NOT trigger a save because we're not calling saveNote)
      this.noteManager.notes.set(noteId, mergedNote);

      // Notify UI to update
      this.noteManager.notify('note-updated', {
        note: mergedNote,
        source: 'sync'
      });

      this.notify('note-synced', { noteId, updateCount: newUpdates.length });
    } catch (error) {
      console.error(`Error syncing note ${noteId}:`, error);
    }
  }

  /**
   * Save a note with CRDT
   * Called by NoteManager when a note is saved locally
   * @param {object} note - Note to save
   * @returns {boolean} Success
   */
  async saveNoteWithCRDT(note) {
    console.log('=== saveNoteWithCRDT called ===');
    console.log('  Note ID:', note.id);
    console.log('  Note title:', note.title);

    if (!this.isElectron) {
      // Web mode - just save normally
      console.log('  Using web mode save');
      return await this.fileStorage.saveNote(note);
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
        console.log('  Updating existing CRDT metadata');
        // Only update metadata - content is handled by TipTap directly
        this.crdtManager.updateMetadata(note.id, {
          title: note.title,
          tags: note.tags,
          folder: note.folder
        });
      }

      // Get pending updates from CRDT manager
      const pendingUpdates = this.crdtManager.getPendingUpdates(note.id);
      console.log('  Pending CRDT updates:', pendingUpdates.length);

      // Add all pending updates to UpdateStore
      for (const update of pendingUpdates) {
        await this.updateStore.addUpdate(note.id, new Uint8Array(update));
      }

      // Clear pending updates from CRDT manager (they're now in UpdateStore)
      this.crdtManager.clearPendingUpdates(note.id);

      // Also save a JSON cache for fast loading
      console.log('  Saving JSON cache...');
      const noteSaved = await this.fileStorage.saveNote(note);
      console.log('  JSON saved:', noteSaved);

      console.log('=== saveNoteWithCRDT complete ===');
      return noteSaved;
    } catch (error) {
      console.error('Error saving note with CRDT:', error);
      console.error('Stack trace:', error.stack);
      return false;
    }
  }

  /**
   * Load a note and initialize CRDT
   * @param {string} noteId - Note ID
   * @returns {object} Note or null
   */
  async loadNote(noteId) {
    try {
      // Initialize UpdateStore for this note
      if (!this.initializedNotes.has(noteId)) {
        await this.updateStore.initialize(noteId);
        this.initializedNotes.add(noteId);
      }

      // Load from JSON cache first (fast)
      const cachedNote = await this.fileStorage.loadNote(noteId);

      if (cachedNote) {
        // Initialize CRDT with cached note
        if (this.crdtManager.isDocEmpty(noteId)) {
          this.crdtManager.initializeNote(noteId, cachedNote);
        }

        // Sync any new updates
        await this.syncNote(noteId);

        // Return the potentially updated note
        return this.crdtManager.getNoteFromDoc(noteId);
      }

      return null;
    } catch (error) {
      console.error('Error loading note:', error);
      return null;
    }
  }

  /**
   * Get the CRDT document for a note (for TipTap integration)
   * @param {string} noteId - Note ID
   * @returns {Y.Doc} Yjs document
   */
  getDoc(noteId) {
    return this.crdtManager.getDoc(noteId);
  }

  /**
   * Get the content fragment for TipTap
   * @param {string} noteId - Note ID
   * @returns {Y.XmlFragment} Fragment for TipTap
   */
  getContentFragment(noteId) {
    return this.crdtManager.getContentFragment(noteId);
  }

  /**
   * Get sync statistics
   * @returns {object} Stats
   */
  getStats() {
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
  async destroy() {
    await this.stopWatching();
    this.crdtManager.destroy();
    this.listeners.clear();
    console.log('SyncManager destroyed');
  }
}
