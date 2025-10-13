/**
 * Sync Manager - Handles file synchronization and conflict detection
 */
import { CRDTManager } from './crdt-manager.js';

export class SyncManager {
  constructor(noteManager, fileStorage) {
    this.noteManager = noteManager;
    this.fileStorage = fileStorage;
    this.isElectron = window.electronAPI?.isElectron || false;
    this.watchId = null;
    this.syncStatus = 'idle'; // idle, watching, syncing, error
    this.listeners = new Set();
    this.lastSyncTime = null;
    this.conflictedNotes = new Map(); // noteId -> conflict info
    this.crdtManager = new CRDTManager();
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
   * Start watching for file changes
   */
  async startWatching() {
    if (!this.isElectron || this.watchId) {
      return; // Already watching or not in Electron
    }

    try {
      const notesPath = this.fileStorage.notesPath;
      if (!notesPath || notesPath === 'localStorage') {
        console.log('Not in Electron mode or invalid notes path');
        return;
      }

      // Set up listener for note manager events to auto-save with CRDT
      this.setupNoteManagerListener();

      // Generate unique watch ID
      this.watchId = `notes-${Date.now()}`;

      // Set up event listener for file changes
      if (window.electronAPI && window.electronAPI.onFileChange) {
        window.electronAPI.onFileChange(this.watchId, (event, data) => {
          this.handleFileChange(data);
        });
      }

      // Start watching
      const result = await window.electronAPI.fileSystem.watch(notesPath, this.watchId);

      if (result.success) {
        this.updateStatus('watching');
        this.lastSyncTime = new Date();
        console.log('Started watching notes directory:', notesPath);
      } else {
        console.error('Failed to start watching:', result.error);
        this.updateStatus('error');
      }
    } catch (error) {
      console.error('Error starting file watch:', error);
      this.updateStatus('error');
    }
  }

  /**
   * Set up listener for note manager events
   */
  setupNoteManagerListener() {
    if (!this.noteManager) return;

    // Listen for note updates and save with CRDT state
    this.noteManager.addListener((event, data) => {
      if (event === 'note-saved' && data.note) {
        // Update CRDT when note is saved
        const note = data.note;
        if (this.crdtManager.isDocEmpty(note.id)) {
          this.crdtManager.initializeNote(note.id, note);
        } else {
          this.crdtManager.updateNote(note.id, note);
        }
      }
    });
  }

  /**
   * Stop watching for file changes
   */
  async stopWatching() {
    if (!this.isElectron || !this.watchId) {
      return;
    }

    try {
      await window.electronAPI.fileSystem.unwatch(this.watchId);
      this.watchId = null;
      this.updateStatus('idle');
      console.log('Stopped watching notes directory');
    } catch (error) {
      console.error('Error stopping file watch:', error);
    }
  }

  /**
   * Handle file system changes
   * @param {object} data - Change data from chokidar
   */
  async handleFileChange(data) {
    const { event: eventType, path: filePath } = data;

    // Only process .json files (notes)
    if (!filePath.endsWith('.json')) {
      return;
    }

    console.log('File change detected:', eventType, filePath);
    this.updateStatus('syncing');

    try {
      // Extract note ID from filename
      const filename = filePath.split('/').pop();
      const noteId = filename.replace('.json', '');

      switch (eventType) {
        case 'add':
        case 'change':
          await this.handleNoteChanged(noteId, filePath);
          break;

        case 'unlink':
          await this.handleNoteDeleted(noteId);
          break;
      }

      this.lastSyncTime = new Date();
      this.updateStatus('watching');
    } catch (error) {
      console.error('Error handling file change:', error);
      this.updateStatus('error');
    }
  }

  /**
   * Handle note added or changed externally
   * @param {string} noteId - Note ID
   * @param {string} filePath - File path
   */
  async handleNoteChanged(noteId, filePath) {
    try {
      // Read the file
      const result = await window.electronAPI.fileSystem.readFile(filePath);
      if (!result.success) {
        console.error('Failed to read changed file:', result.error);
        return;
      }

      const externalNote = JSON.parse(result.content);
      const localNote = this.noteManager.getNote(noteId);

      // Use CRDT merging for conflict-free synchronization
      if (localNote) {
        // Initialize CRDT if not already done
        if (this.crdtManager.isDocEmpty(noteId)) {
          this.crdtManager.initializeNote(noteId, localNote);
        }

        // Merge external note using CRDT
        const mergedNote = this.crdtManager.mergeExternalNote(noteId, externalNote);

        // Update the note in memory WITHOUT saving to disk (to prevent infinite loop)
        this.noteManager.notes.set(noteId, mergedNote);
        this.noteManager.notify('note-updated', { note: mergedNote, updates: mergedNote });

        console.log('Note synced with CRDT merge:', noteId);
        this.notify('note-synced', {
          noteId,
          action: 'merged',
          hasCrdtState: !!externalNote.crdtState
        });
      } else {
        // New note - initialize CRDT and add to note manager
        this.crdtManager.initializeNote(noteId, externalNote);
        this.noteManager.notes.set(noteId, externalNote);
        this.noteManager.notify('note-created', { note: externalNote });

        console.log('New note synced from external change:', noteId);
        this.notify('note-synced', { noteId, action: 'added' });
      }
    } catch (error) {
      console.error('Error handling note change:', error);
    }
  }

  /**
   * Handle note deleted externally
   * @param {string} noteId - Note ID
   */
  async handleNoteDeleted(noteId) {
    const localNote = this.noteManager.getNote(noteId);

    if (localNote) {
      // Mark as deleted
      this.noteManager.deleteNote(noteId);

      // Clean up CRDT document
      this.crdtManager.removeDoc(noteId);

      console.log('Note synced deletion from external change:', noteId);
      this.notify('note-synced', { noteId, action: 'deleted' });
    }
  }

  /**
   * Check if there's a conflict between local and external note
   * @param {object} localNote - Local version
   * @param {object} externalNote - External version
   * @returns {boolean} True if conflict exists
   */
  hasConflict(localNote, externalNote) {
    // Simple conflict detection: check if local note was modified after external note was saved
    // A more sophisticated approach would use version vectors or CRDTs (Phase 3, Commit 9)

    if (!localNote.modified || !externalNote.modified) {
      return false;
    }

    const localTime = new Date(localNote.modified).getTime();
    const externalTime = new Date(externalNote.modified).getTime();
    const savedTime = externalNote.savedAt ? new Date(externalNote.savedAt).getTime() : externalTime;

    // Conflict if local was modified after external was saved
    // AND local and external have different content
    const timeDiff = Math.abs(localTime - savedTime);
    const hasTimingConflict = timeDiff < 5000; // Within 5 seconds = potential conflict

    const hasContentDiff = localNote.content !== externalNote.content ||
                          localNote.title !== externalNote.title;

    return hasTimingConflict && hasContentDiff;
  }

  /**
   * Handle a conflict between local and external versions
   * @param {string} noteId - Note ID
   * @param {object} localNote - Local version
   * @param {object} externalNote - External version
   */
  handleConflict(noteId, localNote, externalNote) {
    console.warn('Conflict detected for note:', noteId);

    // Store conflict information
    this.conflictedNotes.set(noteId, {
      localVersion: { ...localNote },
      externalVersion: { ...externalNote },
      detectedAt: new Date()
    });

    // For now, use "last write wins" strategy
    // In Phase 3 Commit 9, we'll implement proper CRDT-based merging
    const localTime = new Date(localNote.modified).getTime();
    const externalTime = new Date(externalNote.modified).getTime();

    if (externalTime > localTime) {
      // External version is newer - accept it
      this.noteManager.updateNote(noteId, externalNote);
      console.log('Conflict resolved: accepted external version (newer)');
    } else {
      // Local version is newer - keep it and save it
      this.fileStorage.saveNote(localNote);
      console.log('Conflict resolved: kept local version (newer)');
    }

    this.notify('conflict-detected', {
      noteId,
      resolution: externalTime > localTime ? 'external' : 'local',
      conflict: this.conflictedNotes.get(noteId)
    });
  }

  /**
   * Save a note with CRDT state
   * @param {object} note - Note to save
   * @returns {boolean} Success
   */
  async saveNoteWithCRDT(note) {
    if (!this.isElectron) {
      // In web mode, just save normally
      return await this.fileStorage.saveNote(note);
    }

    try {
      // Initialize or update CRDT document
      if (this.crdtManager.isDocEmpty(note.id)) {
        this.crdtManager.initializeNote(note.id, note);
      } else {
        this.crdtManager.updateNote(note.id, note);
      }

      // Get CRDT state
      const crdtState = this.crdtManager.getState(note.id);

      // Save note with CRDT state
      const noteWithCRDT = {
        ...note,
        crdtState
      };

      return await this.fileStorage.saveNote(noteWithCRDT);
    } catch (error) {
      console.error('Error saving note with CRDT:', error);
      return false;
    }
  }

  /**
   * Load a note and initialize CRDT
   * @param {string} noteId - Note ID
   * @returns {object|null} Note data
   */
  async loadNoteWithCRDT(noteId) {
    try {
      const note = await this.fileStorage.loadNote(noteId);
      if (!note) return null;

      // If note has CRDT state, apply it
      if (note.crdtState) {
        this.crdtManager.applyState(noteId, note.crdtState);
      } else {
        // Initialize CRDT with note content
        this.crdtManager.initializeNote(noteId, note);
      }

      return note;
    } catch (error) {
      console.error('Error loading note with CRDT:', error);
      return null;
    }
  }

  /**
   * Get sync status
   * @returns {object} Sync status information
   */
  getStatus() {
    return {
      status: this.syncStatus,
      watching: !!this.watchId,
      lastSyncTime: this.lastSyncTime,
      conflictCount: this.conflictedNotes.size,
      crdtDocCount: this.crdtManager.getStats().documentCount
    };
  }

  /**
   * Get conflicted notes
   * @returns {Map} Map of note IDs to conflict info
   */
  getConflicts() {
    return this.conflictedNotes;
  }

  /**
   * Clear conflict for a note
   * @param {string} noteId - Note ID
   */
  clearConflict(noteId) {
    this.conflictedNotes.delete(noteId);
    this.notify('conflict-resolved', { noteId });
  }

  /**
   * Force sync all notes
   */
  async forceSyncAll() {
    if (!this.isElectron) {
      console.log('Force sync only available in Electron mode');
      return;
    }

    this.updateStatus('syncing');

    try {
      // Reload all notes from disk
      const diskNotes = await this.fileStorage.loadAllNotes();
      const localNotes = Array.from(this.noteManager.notes.values());

      console.log(`Force sync: ${diskNotes.length} notes on disk, ${localNotes.length} local notes`);

      // Update local notes with disk versions using CRDT merge
      for (const diskNote of diskNotes) {
        const localNote = this.noteManager.getNote(diskNote.id);

        if (localNote) {
          // Initialize CRDT if needed
          if (this.crdtManager.isDocEmpty(diskNote.id)) {
            this.crdtManager.initializeNote(diskNote.id, localNote);
          }

          // Merge using CRDT
          const mergedNote = this.crdtManager.mergeExternalNote(diskNote.id, diskNote);
          this.noteManager.updateNote(diskNote.id, mergedNote);
        } else {
          // New note from disk
          this.crdtManager.initializeNote(diskNote.id, diskNote);
          this.noteManager.updateNote(diskNote.id, diskNote);
        }
      }

      this.lastSyncTime = new Date();
      this.updateStatus('watching');
      this.notify('force-sync-complete', { noteCount: diskNotes.length });

      console.log('Force sync completed with CRDT merging');
    } catch (error) {
      console.error('Error during force sync:', error);
      this.updateStatus('error');
    }
  }

  /**
   * Clean up resources
   */
  async destroy() {
    await this.stopWatching();
    this.listeners.clear();
    this.conflictedNotes.clear();
    this.crdtManager.destroy();
  }
}
