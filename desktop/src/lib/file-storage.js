import { validateNote } from './utils.js';

/**
 * File-based storage manager for NoteCove
 */
export class FileStorage {
  constructor() {
    this.isElectron = window.electronAPI?.isElectron || false;
    this.notesPath = null;
    this.initialized = false;
  }

  /**
   * Initialize storage with notes directory
   * @param {string} notesPath - Path to notes directory
   */
  async initialize(notesPath = null) {
    try {
      if (this.isElectron) {
        // Use provided path or default to user documents
        this.notesPath = notesPath || await this.getDefaultNotesPath();
        await this.ensureNotesDirectory();
      } else {
        // Web mode - use localStorage (already handled by NoteManager)
        this.notesPath = 'localStorage';
      }
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      return false;
    }
  }

  /**
   * Get default notes directory path
   */
  async getDefaultNotesPath() {
    if (!this.isElectron) return null;

    try {
      // Get user's documents directory from settings
      let documentsPath = await window.electronAPI.settings.get('documentsPath');

      // If not in settings, this will be set by the main process
      if (!documentsPath) {
        documentsPath = await window.electronAPI.settings.get('documentsPath');
      }

      return `${documentsPath}/NoteCove`;
    } catch (error) {
      console.error('Failed to get default notes path:', error);
      return './notes'; // Fallback to relative path
    }
  }

  /**
   * Ensure notes directory exists
   */
  async ensureNotesDirectory() {
    if (!this.isElectron || !this.notesPath) return;

    try {
      const exists = await window.electronAPI.fileSystem.exists(this.notesPath);
      if (!exists) {
        // Directory creation will be handled by the main process
        console.log('Notes directory will be created at:', this.notesPath);
      }

      // Ensure subdirectories exist for CRDT-based sync
      const crdtDir = `${this.notesPath}/crdt`;
      const notesDir = `${this.notesPath}/notes`;

      const crdtExists = await window.electronAPI.fileSystem.exists(crdtDir);
      if (!crdtExists) {
        console.log('Creating CRDT directory:', crdtDir);
        await window.electronAPI.fileSystem.mkdir(crdtDir);
      }

      const notesExists = await window.electronAPI.fileSystem.exists(notesDir);
      if (!notesExists) {
        console.log('Creating notes directory:', notesDir);
        await window.electronAPI.fileSystem.mkdir(notesDir);
      }

      console.log('Storage structure ready:', { crdtDir, notesDir });
    } catch (error) {
      console.error('Failed to ensure notes directory:', error);
    }
  }

  /**
   * Get file path for a note's JSON cache
   * @param {object|string} noteOrId - Note object or note ID
   * @returns {string} File path
   */
  getNoteFilePath(noteOrId) {
    const noteId = typeof noteOrId === 'string' ? noteOrId : noteOrId?.id;
    if (!this.notesPath || !noteId) return null;

    // Use only note ID for filename to avoid creating multiple files when title changes
    return `${this.notesPath}/notes/${noteId}.json`;
  }

  /**
   * Get file path for a note's CRDT data (source of truth)
   * @param {string} noteId - Note ID
   * @returns {string} File path to .yjs file
   */
  getCRDTFilePath(noteId) {
    if (!this.notesPath || !noteId) return null;
    return `${this.notesPath}/crdt/${noteId}.yjs`;
  }

  /**
   * Save a note to file
   * @param {object} note - Note to save
   * @returns {boolean} Success
   */
  async saveNote(note) {
    if (!this.initialized || !this.isElectron) return false;

    try {
      if (!validateNote(note)) {
        console.error('Invalid note data:', note);
        return false;
      }

      const filePath = this.getNoteFilePath(note);
      const noteData = {
        ...note,
        savedAt: new Date().toISOString(),
        version: note.version || 1
      };

      const result = await window.electronAPI.fileSystem.writeFile(
        filePath,
        JSON.stringify(noteData, null, 2)
      );

      if (result.success) {
        console.log('Note saved:', filePath);
        return true;
      } else {
        console.error('Failed to save note:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error saving note:', error);
      return false;
    }
  }

  /**
   * Load a note from file
   * @param {string} noteId - Note ID
   * @returns {object|null} Note data or null
   */
  async loadNote(noteId) {
    if (!this.initialized || !this.isElectron) return null;

    try {
      // Since we don't know the filename, we need to search for it
      const notes = await this.loadAllNotes();
      return notes.find(note => note.id === noteId) || null;
    } catch (error) {
      console.error('Error loading note:', error);
      return null;
    }
  }

  /**
   * Load all notes from files
   * @returns {Array} Array of notes
   */
  async loadAllNotes() {
    if (!this.initialized || !this.isElectron) return [];

    try {
      const exists = await window.electronAPI.fileSystem.exists(this.notesPath);
      if (!exists) {
        return [];
      }

      const result = await window.electronAPI.fileSystem.readDir(this.notesPath);
      if (!result.success) {
        console.error('Failed to read notes directory:', result.error);
        return [];
      }

      const notes = [];
      const jsonFiles = result.files.filter(file => file.endsWith('.json'));

      for (const filename of jsonFiles) {
        try {
          const filePath = `${this.notesPath}/${filename}`;
          const fileResult = await window.electronAPI.fileSystem.readFile(filePath);

          if (fileResult.success) {
            const noteData = JSON.parse(fileResult.content);
            if (validateNote(noteData)) {
              notes.push(noteData);
            } else {
              console.warn('Invalid note data in file:', filename);
            }
          }
        } catch (error) {
          console.error('Error parsing note file:', filename, error);
        }
      }

      // Sort by modification date
      return notes.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    } catch (error) {
      console.error('Error loading notes:', error);
      return [];
    }
  }

  /**
   * Delete a note file
   * @param {object} note - Note to delete
   * @returns {boolean} Success
   */
  async deleteNote(note) {
    if (!this.initialized || !this.isElectron) return false;

    try {
      const filePath = this.getNoteFilePath(note);
      const exists = await window.electronAPI.fileSystem.exists(filePath);

      if (exists) {
        // Move to trash folder instead of permanent deletion
        const trashPath = `${this.notesPath}/.trash`;
        const trashExists = await window.electronAPI.fileSystem.exists(trashPath);

        if (!trashExists) {
          console.log('Trash folder will be created at:', trashPath);
        }

        const filename = filePath.split('/').pop();
        const trashFilePath = `${trashPath}/${Date.now()}-${filename}`;

        // For now, just mark as deleted in the file (move to trash would require additional IPC)
        const updatedNote = { ...note, deleted: true, deletedAt: new Date().toISOString() };
        return await this.saveNote(updatedNote);
      }

      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      return false;
    }
  }

  /**
   * Get storage statistics
   * @returns {object} Storage stats
   */
  async getStorageStats() {
    if (!this.initialized) return null;

    try {
      const notes = await this.loadAllNotes();
      const activeNotes = notes.filter(note => !note.deleted);
      const deletedNotes = notes.filter(note => note.deleted);

      return {
        totalNotes: notes.length,
        activeNotes: activeNotes.length,
        deletedNotes: deletedNotes.length,
        storageType: this.isElectron ? 'file' : 'localStorage',
        notesPath: this.notesPath
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return null;
    }
  }

  /**
   * Export notes to a different location
   * @param {string} exportPath - Export destination
   * @param {Array} noteIds - Note IDs to export (all if empty)
   * @returns {boolean} Success
   */
  async exportNotes(exportPath, noteIds = []) {
    if (!this.initialized || !this.isElectron) return false;

    try {
      const allNotes = await this.loadAllNotes();
      const notesToExport = noteIds.length > 0 ?
        allNotes.filter(note => noteIds.includes(note.id)) :
        allNotes.filter(note => !note.deleted);

      for (const note of notesToExport) {
        const exportFilePath = `${exportPath}/${note.id}.json`;

        const result = await window.electronAPI.fileSystem.writeFile(
          exportFilePath,
          JSON.stringify(note, null, 2)
        );

        if (!result.success) {
          console.error('Failed to export note:', note.title, result.error);
          return false;
        }
      }

      console.log('Exported', notesToExport.length, 'notes to', exportPath);
      return true;
    } catch (error) {
      console.error('Error exporting notes:', error);
      return false;
    }
  }

  /**
   * Watch for file system changes
   * @param {Function} callback - Callback for changes
   * @returns {string} Watch ID
   */
  async watchNotes(callback) {
    if (!this.initialized || !this.isElectron || !this.notesPath) return null;

    try {
      // Generate a unique watch ID
      const watchId = `watch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Set up the listener for file change events
      window.electronAPI.onFileChange(watchId, (event, data) => {
        callback(data);
      });

      // Start watching the directory
      await window.electronAPI.fileSystem.watch(this.notesPath, watchId);
      console.log('Watching notes directory:', this.notesPath, 'with ID:', watchId);
      return watchId;
    } catch (error) {
      console.error('Error setting up file watch:', error);
      return null;
    }
  }

  /**
   * Stop watching file system
   * @param {string} watchId - Watch ID to stop
   */
  async unwatchNotes(watchId) {
    if (!this.isElectron || !watchId) return;

    try {
      await window.electronAPI.fileSystem.unwatch(watchId);
      console.log('Stopped watching notes directory');
    } catch (error) {
      console.error('Error stopping file watch:', error);
    }
  }

  /**
   * Save CRDT data for a note (binary Yjs updates)
   * This is the source of truth for syncing
   * @param {string} noteId - Note ID
   * @param {Uint8Array} crdtData - Binary CRDT data
   * @returns {boolean} Success
   */
  async saveCRDT(noteId, crdtData) {
    if (!this.initialized || !this.isElectron) return false;

    try {
      const filePath = this.getCRDTFilePath(noteId);

      // Convert Uint8Array to base64 for storage
      const base64Data = btoa(String.fromCharCode(...crdtData));

      const result = await window.electronAPI.fileSystem.writeFile(
        filePath,
        base64Data
      );

      if (result.success) {
        console.log('CRDT saved:', filePath);
        return true;
      } else {
        console.error('Failed to save CRDT:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error saving CRDT:', error);
      return false;
    }
  }

  /**
   * Load CRDT data for a note
   * @param {string} noteId - Note ID
   * @returns {Uint8Array|null} CRDT data or null
   */
  async loadCRDT(noteId) {
    if (!this.initialized || !this.isElectron) return null;

    try {
      const filePath = this.getCRDTFilePath(noteId);
      const result = await window.electronAPI.fileSystem.readFile(filePath);

      if (result.success) {
        // Convert base64 back to Uint8Array
        const binaryString = atob(result.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        console.log('CRDT loaded:', filePath);
        return bytes;
      } else {
        console.log('No CRDT file found for note:', noteId);
        return null;
      }
    } catch (error) {
      console.error('Error loading CRDT:', error);
      return null;
    }
  }

  /**
   * Check if CRDT file exists for a note
   * @param {string} noteId - Note ID
   * @returns {boolean} True if CRDT file exists
   */
  async hasCRDT(noteId) {
    if (!this.initialized || !this.isElectron) return false;

    try {
      const filePath = this.getCRDTFilePath(noteId);
      return await window.electronAPI.fileSystem.exists(filePath);
    } catch (error) {
      console.error('Error checking CRDT existence:', error);
      return false;
    }
  }

  /**
   * Watch CRDT directory for changes (source of truth for sync)
   * @param {Function} callback - Callback for changes
   * @returns {string} Watch ID
   */
  async watchCRDT(callback) {
    if (!this.initialized || !this.isElectron || !this.notesPath) return null;

    try {
      const crdtPath = `${this.notesPath}/crdt`;
      const watchId = `crdt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Set up the listener for file change events
      window.electronAPI.onFileChange(watchId, (event, data) => {
        callback(data);
      });

      // Start watching the CRDT directory
      await window.electronAPI.fileSystem.watch(crdtPath, watchId);
      console.log('Watching CRDT directory:', crdtPath, 'with ID:', watchId);
      return watchId;
    } catch (error) {
      console.error('Error setting up CRDT watch:', error);
      return null;
    }
  }
}