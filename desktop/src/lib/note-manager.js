import { generateUUID, validateNote } from './utils.js';
import { FileStorage } from './file-storage.js';
import { FolderManager } from './folder-manager.js';

/**
 * Note Manager - handles CRUD operations for notes
 */
export class NoteManager {
  constructor() {
    this.notes = new Map();
    this.listeners = new Set();
    this.isElectron = window.electronAPI?.isElectron || false;
    this.fileStorage = new FileStorage();
    this.folderManager = new FolderManager();
    this.watchId = null;
    this.syncManager = null; // Will be set after SyncManager is initialized

    this.initializeStorage();
    this.setupFolderListener();
  }

  /**
   * Set the sync manager to use for CRDT-based sync
   * @param {SyncManager} syncManager - Sync manager instance
   */
  async setSyncManager(syncManager) {
    this.syncManager = syncManager;
    console.log('NoteManager: SyncManager integration enabled');

    // Reload notes from CRDT now that SyncManager is available
    console.log('NoteManager: Reloading notes from CRDT');
    await this.loadNotes();
    this.notify('notes-loaded', { notes: Array.from(this.notes.values()) });
  }

  /**
   * Setup folder manager listener
   */
  setupFolderListener() {
    this.folderManager.addListener((event, data) => {
      this.notify(`folder-${event}`, data);
    });
  }

  /**
   * Add a listener for note changes
   * @param {Function} listener - Function to call on changes
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
   * Notify all listeners of changes
   * @param {string} event - Event type
   * @param {object} data - Event data
   */
  notify(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in note manager listener:', error);
      }
    });
  }

  /**
   * Initialize storage (but don't load notes yet - wait for SyncManager)
   */
  async initializeStorage() {
    try {
      const initialized = await this.fileStorage.initialize();
      if (!initialized) {
        console.warn('Storage initialization failed');
      }
      // Note: We don't load notes here anymore.
      // Notes are loaded in setSyncManager() after CRDT sync is ready.
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }
  }

  /**
   * Load notes from storage
   */
  async loadNotes() {
    try {
      if (this.isElectron) {
        // Load from CRDT if syncManager is available, otherwise use old file storage
        const notes = this.syncManager ?
          await this.syncManager.loadAllNotes() :
          await this.fileStorage.loadAllNotes();

        if (notes.length === 0) {
          this.loadSampleNotes();
        } else {
          notes.forEach(note => {
            if (validateNote(note)) {
              this.notes.set(note.id, note);
            }
          });
        }
      } else {
        // Web mode - use localStorage
        const stored = localStorage.getItem('notecove-notes');
        if (stored) {
          const notes = JSON.parse(stored);
          notes.forEach(note => {
            if (validateNote(note)) {
              this.notes.set(note.id, note);
            }
          });
        } else {
          this.loadSampleNotes();
        }
      }
      this.notify('notes-loaded', { notes: Array.from(this.notes.values()) });
    } catch (error) {
      console.error('Failed to load notes:', error);
      this.loadSampleNotes();
      this.notify('notes-loaded', { notes: Array.from(this.notes.values()) });
    }
  }

  /**
   * Setup file system watching for changes
   */
  async setupFileWatching() {
    if (!this.isElectron) return;

    try {
      this.watchId = await this.fileStorage.watchNotes((change) => {
        console.log('File system change detected:', change);
        // Reload notes when files change externally
        this.loadNotes();
      });
    } catch (error) {
      console.error('Failed to setup file watching:', error);
    }
  }

  /**
   * Load sample notes for demo
   */
  loadSampleNotes() {
    const sampleNotes = [
      {
        id: generateUUID(),
        title: 'Welcome to NoteCove',
        content: '<h1>Welcome to NoteCove</h1><p>This is your first note! NoteCove is designed to be your digital sanctuary for ideas and thoughts.</p><p><strong>Features:</strong></p><ul><li>Rich text editing</li><li>File-based sync</li><li>Offline-first design</li><li>Advanced organization</li></ul><p>Start by editing this note or create a new one. Everything you write is automatically saved.</p>',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        tags: ['welcome', 'getting-started'],
        deleted: false,
        folderId: 'all-notes'
      },
      {
        id: generateUUID(),
        title: 'Getting Started Guide',
        content: '<h2>Quick Start</h2><p>Here are some tips to get you started with NoteCove:</p><ol><li><strong>Creating Notes:</strong> Use Cmd+N (Mac) or Ctrl+N (Windows/Linux) to create a new note</li><li><strong>Organization:</strong> Use #tags in your notes for easy categorization</li><li><strong>Search:</strong> Use the search box to find notes quickly</li><li><strong>Formatting:</strong> Use the toolbar or keyboard shortcuts for formatting</li></ol><p>Enjoy your note-taking journey! 📝</p>',
        created: new Date(Date.now() - 86400000).toISOString(),
        modified: new Date(Date.now() - 86400000).toISOString(),
        tags: ['guide', 'tips'],
        deleted: false,
        folderId: 'all-notes'
      }
    ];

    sampleNotes.forEach(note => {
      this.notes.set(note.id, note);
      // Save sample notes to storage so they persist
      this.saveNote(note);
    });
  }

  /**
   * Save notes to storage
   */
  async saveNotes() {
    try {
      const notesArray = Array.from(this.notes.values());

      if (this.isElectron) {
        // Save individual note files
        for (const note of notesArray) {
          await this.fileStorage.saveNote(note);
        }
      } else {
        // Web mode - use localStorage
        localStorage.setItem('notecove-notes', JSON.stringify(notesArray));
      }
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  }

  /**
   * Save a single note
   * @param {object} note - Note to save
   */
  async saveNote(note) {
    try {
      if (this.isElectron) {
        // Use SyncManager for CRDT-based sync if available
        if (this.syncManager) {
          console.log('Saving note with CRDT sync:', note.id);
          await this.syncManager.saveNoteWithCRDT(note);
        } else {
          console.log('Saving note without sync:', note.id);
          await this.fileStorage.saveNote(note);
        }
      } else {
        await this.saveNotes(); // Save all notes in web mode
      }
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  }

  /**
   * Get all notes
   * @returns {Array} Array of notes
   */
  getAllNotes() {
    return Array.from(this.notes.values())
      .filter(note => !note.deleted)
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));
  }

  /**
   * Get note by ID
   * @param {string} id - Note ID
   * @returns {object|null} Note object or null
   */
  getNote(id) {
    return this.notes.get(id) || null;
  }

  /**
   * Get the most recently modified note
   * @returns {object|null} Most recent note or null if no notes exist
   */
  getMostRecentNote() {
    const notes = Array.from(this.notes.values())
      .filter(note => !note.deleted)
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));
    return notes[0] || null;
  }

  /**
   * Create a new note
   * @param {object} noteData - Initial note data
   * @returns {object} Created note
   */
  createNote(noteData = {}) {
    const now = new Date().toISOString();
    const note = {
      id: generateUUID(),
      title: '',
      content: '',
      created: now,
      modified: now,
      tags: [],
      deleted: false,
      folderId: 'all-notes',
      ...noteData
    };

    this.notes.set(note.id, note);
    this.saveNote(note); // Save asynchronously without blocking
    this.notify('note-created', { note });

    return note;
  }

  /**
   * Update an existing note
   * @param {string} id - Note ID
   * @param {object} updates - Updates to apply
   * @returns {object|null} Updated note or null
   */
  updateNote(id, updates) {
    const note = this.notes.get(id);
    if (!note || note.deleted) {
      return null;
    }

    const updatedNote = {
      ...note,
      ...updates,
      modified: new Date().toISOString()
    };

    this.notes.set(id, updatedNote);
    this.saveNote(updatedNote); // Save asynchronously without blocking
    this.notify('note-updated', { note: updatedNote, updates });

    return updatedNote;
  }

  /**
   * Delete a note (move to trash)
   * @param {string} id - Note ID
   * @returns {boolean} Success
   */
  deleteNote(id) {
    const note = this.notes.get(id);
    if (!note) {
      return false;
    }

    const deletedNote = {
      ...note,
      deleted: true,
      modified: new Date().toISOString()
    };

    this.notes.set(id, deletedNote);
    this.saveNote(deletedNote); // Save asynchronously without blocking
    this.notify('note-deleted', { note: deletedNote });

    return true;
  }

  /**
   * Permanently delete a note
   * @param {string} id - Note ID
   * @returns {boolean} Success
   */
  async permanentlyDeleteNote(id) {
    const note = this.notes.get(id);
    if (!note) return false;

    const success = this.notes.delete(id);
    if (success) {
      // Delete the file in Electron mode
      if (this.isElectron) {
        try {
          await this.fileStorage.deleteNote(note);
        } catch (error) {
          console.error('Failed to delete note file:', error);
        }
      } else {
        await this.saveNotes();
      }
      this.notify('note-permanently-deleted', { id });
    }
    return success;
  }

  /**
   * Restore a note from trash
   * @param {string} id - Note ID
   * @returns {object|null} Restored note or null
   */
  restoreNote(id) {
    const note = this.notes.get(id);
    if (!note || !note.deleted) {
      return null;
    }

    const restoredNote = {
      ...note,
      deleted: false,
      modified: new Date().toISOString()
    };

    this.notes.set(id, restoredNote);
    this.saveNote(restoredNote); // Save asynchronously without blocking
    this.notify('note-restored', { note: restoredNote });

    return restoredNote;
  }

  /**
   * Search notes
   * @param {string} query - Search query
   * @returns {Array} Matching notes
   */
  searchNotes(query) {
    if (!query.trim()) {
      return this.getAllNotes();
    }

    const normalizedQuery = query.toLowerCase();
    return this.getAllNotes().filter(note => {
      return (
        note.title.toLowerCase().includes(normalizedQuery) ||
        note.content.toLowerCase().includes(normalizedQuery) ||
        note.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))
      );
    });
  }

  /**
   * Get notes by tag
   * @param {string} tag - Tag name
   * @returns {Array} Notes with the tag
   */
  getNotesByTag(tag) {
    return this.getAllNotes().filter(note =>
      note.tags.includes(tag)
    );
  }

  /**
   * Get all unique tags
   * @returns {Array} Array of tag objects with counts
   */
  getAllTags() {
    const tagCounts = {};

    this.getAllNotes().forEach(note => {
      note.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get notes in a specific folder
   * @param {string} folderId - Folder ID
   * @returns {Array} Notes in the folder
   */
  getNotesInFolder(folderId) {
    if (folderId === 'all-notes') {
      return this.getAllNotes();
    } else if (folderId === 'trash') {
      return Array.from(this.notes.values())
        .filter(note => note.deleted)
        .sort((a, b) => new Date(b.modified) - new Date(a.modified));
    } else {
      return this.getAllNotes().filter(note => note.folderId === folderId);
    }
  }

  /**
   * Move note to a different folder
   * @param {string} noteId - Note ID
   * @param {string} folderId - Target folder ID
   * @returns {object|null} Updated note or null
   */
  async moveNoteToFolder(noteId, folderId) {
    const note = this.notes.get(noteId);
    if (!note || note.deleted) {
      return null;
    }

    const folder = this.folderManager.getFolder(folderId);
    if (!folder) {
      return null;
    }

    return await this.updateNote(noteId, { folderId });
  }

  /**
   * Get folder manager instance
   * @returns {FolderManager} Folder manager
   */
  getFolderManager() {
    return this.folderManager;
  }

  /**
   * Get folder tree with note counts
   * @returns {Array} Folder tree with counts
   */
  getFolderTreeWithCounts() {
    const tree = this.folderManager.getFolderTree();

    const addCounts = (folders) => {
      return folders.map(folder => {
        const noteCount = this.getNotesInFolder(folder.id).length;
        return {
          ...folder,
          noteCount,
          children: addCounts(folder.children || [])
        };
      });
    };

    return addCounts(tree);
  }
}