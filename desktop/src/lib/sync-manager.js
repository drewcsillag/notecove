/**
 * Sync Manager - Coordinates CRDT-based multi-instance sync
 * Uses UpdateStore for append-only file operations
 */
import { CRDTManager } from './crdt-manager.js';
import { UpdateStore } from './update-store.js';
import { generateUUID } from './utils.js';

export class SyncManager {
  constructor(noteManager, notesPath, instanceId = null) {
    this.noteManager = noteManager;
    this.notesPath = notesPath;
    this.isElectron = window.electronAPI?.isElectron || false;
    this.watchId = null;
    this.syncStatus = 'idle'; // idle, watching, syncing, error
    this.listeners = new Set();
    this.lastSyncTime = null;
    this.crdtManager = new CRDTManager();

    // Generate or use provided instance ID
    this.instanceId = instanceId || `instance-${generateUUID().substring(0, 8)}`;

    // Create UpdateStore for this instance (pass minimal storage interface)
    const storageInterface = {
      isElectron: this.isElectron,
      notesPath: this.notesPath
    };
    this.updateStore = new UpdateStore(storageInterface, this.instanceId);

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
        console.log('  CRDT document already exists - skipping metadata update');
        console.log('  (Metadata is managed by renderer via editor updates)');
        // Don't update metadata here - it's managed by the renderer via editor updates
        // The CRDT is the source of truth, not the note object
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

      console.log('=== saveNoteWithCRDT complete ===');
      return true;
    } catch (error) {
      console.error('Error saving note with CRDT:', error);
      console.error('Stack trace:', error.stack);
      return false;
    }
  }

  /**
   * Load all notes from CRDT update files
   * @returns {Array} Array of notes
   */
  async loadAllNotes() {
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

      const notes = [];

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
      return notes.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    } catch (error) {
      console.error('Error loading all notes:', error);
      return [];
    }
  }

  /**
   * Load a note and initialize CRDT from update files
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

      // Load ALL updates from all instances (not just "new" ones)
      // This is needed on startup to reconstruct the full note state
      const allUpdates = await this.updateStore.readAllUpdates(noteId);

      if (allUpdates.length === 0) {
        // No updates = note doesn't exist
        return null;
      }

      console.log(`Loading note ${noteId} from ${allUpdates.length} CRDT updates`);

      // Apply all updates to build the current state
      for (const { instanceId, sequence, update } of allUpdates) {
        this.crdtManager.applyUpdate(noteId, update, 'load');
      }

      // Extract the merged note from CRDT
      const note = this.crdtManager.getNoteFromDoc(noteId);
      note.id = noteId;

      // If we extracted a title from content (because metadata title was empty/Untitled),
      // update the metadata to persist it for next load
      const doc = this.crdtManager.getDoc(noteId);
      const yMetadata = doc.getMap('metadata');
      const metadataTitle = yMetadata.get('title');
      if ((!metadataTitle || metadataTitle === 'Untitled') && note.title && note.title !== 'Untitled') {
        console.log(`[SyncManager] Persisting extracted title to metadata: "${note.title}"`);
        this.crdtManager.updateMetadata(noteId, { title: note.title });
        // Flush the metadata update immediately
        await this.updateStore.flush(noteId);
      }

      return note;
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
