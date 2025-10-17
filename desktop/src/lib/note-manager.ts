import { generateUUID, validateNote, type Note } from './utils';
import { FolderManager } from './folder-manager';
import { SyncManager } from './sync-manager';

type NoteListener = (event: string, data: any) => void;

/**
 * Note Manager - handles CRUD operations for notes
 * Storage is handled entirely by SyncManager (CRDT-based)
 */
export class NoteManager {
  notes: Map<string, Note>;
  listeners: Set<NoteListener>;
  isElectron: boolean;
  folderManager: FolderManager;
  watchId: string | null;
  syncManager: SyncManager | null;

  constructor() {
    this.notes = new Map();
    this.listeners = new Set();
    this.isElectron = window.electronAPI?.isElectron || false;
    this.folderManager = new FolderManager();
    this.watchId = null;
    this.syncManager = null; // Will be set after SyncManager is initialized

    this.setupFolderListener();
  }

  /**
   * Set the sync manager to use for CRDT-based sync
   * @param syncManager - Sync manager instance
   */
  async setSyncManager(syncManager: SyncManager): Promise<void> {
    this.syncManager = syncManager;
    console.log('NoteManager: SyncManager integration enabled');

    // Update FolderManager with CRDT manager for conflict-free sync
    if (syncManager.crdtManager) {
      this.folderManager.crdtManager = syncManager.crdtManager;
      this.folderManager.updateStore = syncManager.updateStore;
      this.folderManager.notesPath = syncManager.notesPath;
      // Initialize folder CRDT document
      await syncManager.updateStore.initialize('.folders');
      // Reload folders with CRDT support
      await this.folderManager.loadCustomFolders();
    }

    // Reload notes from CRDT now that SyncManager is available
    console.log('NoteManager: Reloading notes from CRDT');
    await this.loadNotes();
    this.notify('notes-loaded', { notes: Array.from(this.notes.values()) });
  }

  /**
   * Setup folder manager listener
   */
  setupFolderListener(): void {
    this.folderManager.addListener((event, data) => {
      this.notify(`folder-${event}`, data);
    });
  }

  /**
   * Add a listener for note changes
   * @param listener - Function to call on changes
   */
  addListener(listener: NoteListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove a listener
   * @param listener - Listener to remove
   */
  removeListener(listener: NoteListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of changes
   * @param event - Event type
   * @param data - Event data
   */
  notify(event: string, data: any): void {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in note manager listener:', error);
      }
    });
  }


  /**
   * Load notes from storage (CRDT-based in Electron, localStorage in web)
   */
  async loadNotes(): Promise<void> {
    try {
      if (this.isElectron) {
        if (!this.syncManager) {
          console.error('ERROR: loadNotes called before SyncManager is ready!');
          return;
        }

        // Load from CRDT via SyncManager
        const notes = await this.syncManager.loadAllNotes();

        if (notes.length === 0) {
          console.log('No notes found, loading sample notes');
          await this.loadSampleNotes();
        } else {
          console.log(`Adding ${notes.length} notes to NoteManager`);
          notes.forEach(note => {
            console.log(`  Validating note ${note.id}:`, {
              title: note.title,
              hasId: !!note.id,
              hasCreated: !!note.created,
              hasModified: !!note.modified,
              deleted: note.deleted
            });
            if (validateNote(note)) {
              this.notes.set(note.id, note);
              console.log(`    ✓ Added to map`);
            } else {
              console.log(`    ✗ Failed validation`);
            }
          });
          console.log(`NoteManager now has ${this.notes.size} notes`);
        }
      } else {
        // Web mode - use localStorage
        const stored = localStorage.getItem('notecove-notes');
        if (stored) {
          const notes: Note[] = JSON.parse(stored);
          notes.forEach(note => {
            if (validateNote(note)) {
              this.notes.set(note.id, note);
            }
          });
        } else {
          await this.loadSampleNotes();
        }
      }
      this.notify('notes-loaded', { notes: Array.from(this.notes.values()) });
    } catch (error) {
      console.error('Failed to load notes:', error);
      await this.loadSampleNotes();
      this.notify('notes-loaded', { notes: Array.from(this.notes.values()) });
    }
  }

  /**
   * Setup file system watching for changes
   */
  async setupFileWatching(): Promise<void> {
    if (!this.isElectron) return;

    try {
      // Note: fileStorage is not available in this TypeScript version
      // This method would need to be updated if file watching is needed
      console.warn('setupFileWatching not implemented in TypeScript version');
    } catch (error) {
      console.error('Failed to setup file watching:', error);
    }
  }

  /**
   * Check if we're in test mode (should skip sample notes)
   * @returns True if in test mode
   */
  isTestMode(): boolean {
    // Check localStorage for test mode flag
    try {
      return localStorage.getItem('notecove-test-mode') === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Load sample notes for demo
   */
  async loadSampleNotes(): Promise<void> {
    // Skip sample notes in test mode
    if (this.isTestMode()) {
      console.log('[NoteManager] Skipping sample notes (test mode)');
      return;
    }

    console.log('[NoteManager] loadSampleNotes() called');
    // Use stable IDs for sample notes so they persist across restarts
    const sampleNotes: Note[] = [
      {
        id: 'sample-welcome-note',
        title: 'Welcome to NoteCove',
        content: '<h1>Welcome to NoteCove</h1><p>This is your first note! NoteCove is designed to be your digital sanctuary for ideas and thoughts.</p><p><strong>Features:</strong></p><ul><li>Rich text editing</li><li>File-based sync</li><li>Offline-first design</li><li>Advanced organization</li></ul><p>Start by editing this note or create a new note. Everything you write is automatically saved.</p>',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        tags: [],
        deleted: false,
        folderId: 'all-notes'
      },
      {
        id: 'sample-getting-started',
        title: 'Getting Started Guide',
        content: '<h2>Quick Start</h2><p>Here are some tips to get you started with NoteCove:</p><ol><li><strong>Creating Notes:</strong> Use Cmd+N (Mac) or Ctrl+N (Windows/Linux) to create a new note</li><li><strong>Organization:</strong> Use #tags in your notes for easy categorization</li><li><strong>Search:</strong> Use the search box to find notes quickly</li><li><strong>Formatting:</strong> Use the toolbar or keyboard shortcuts for formatting</li></ol><p>Enjoy your note-taking journey! 📝</p>',
        created: new Date(Date.now() - 86400000).toISOString(),
        modified: new Date(Date.now() - 86400000).toISOString(),
        tags: ['tags'],
        deleted: false,
        folderId: 'all-notes'
      }
    ];

    // Add sample notes to the map and persist them to disk
    for (const note of sampleNotes) {
      console.log(`[NoteManager] Adding and persisting sample note:`, { id: note.id, title: note.title });
      this.notes.set(note.id, note);
      // Save to disk so they persist as real notes
      await this.saveNote(note);
    }
    console.log('[NoteManager] Sample notes loaded and persisted, map size:', this.notes.size);
  }

  /**
   * Save notes to storage (web mode only - Electron uses CRDT auto-save)
   */
  async saveNotes(): Promise<void> {
    try {
      if (this.isElectron) {
        // Electron mode: Notes are auto-saved via CRDT on every edit
        // No need to batch save - each note saves individually via SyncManager
        console.log('saveNotes() called in Electron mode - ignoring (CRDT auto-saves)');
        return;
      }

      // Web mode - save to localStorage
      const notesArray = Array.from(this.notes.values());
      localStorage.setItem('notecove-notes', JSON.stringify(notesArray));
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  }

  /**
   * Save a single note
   * @param note - Note to save
   */
  async saveNote(note: Note): Promise<void> {
    try {
      if (this.isElectron) {
        // MUST use SyncManager for CRDT-based sync
        if (!this.syncManager) {
          console.error('ERROR: Trying to save note before SyncManager is ready!');
          console.error('Note:', note.id, note.title);
          console.trace('saveNote called from:');
          return;
        }
        console.log('Saving note with CRDT sync:', note.id);
        await this.syncManager.saveNoteWithCRDT(note);
      } else {
        // Web mode - use localStorage
        await this.saveNotes();
      }
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  }

  /**
   * Get all notes
   * @returns Array of notes
   */
  getAllNotes(): Note[] {
    return Array.from(this.notes.values())
      .filter(note => !note.deleted)
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
  }

  /**
   * Get note by ID
   * @param id - Note ID
   * @returns Note object or null
   */
  getNote(id: string): Note | null {
    return this.notes.get(id) || null;
  }

  /**
   * Get the most recently modified note
   * @returns Most recent note or null if no notes exist
   */
  getMostRecentNote(): Note | null {
    const notes = Array.from(this.notes.values())
      .filter(note => !note.deleted)
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    return notes[0] || null;
  }

  /**
   * Create a new note
   * @param noteData - Initial note data
   * @returns Created note
   */
  async createNote(noteData: Partial<Note> = {}): Promise<Note> {
    const now = new Date().toISOString();
    const note: Note = {
      id: generateUUID(),
      title: '',
      // IMPORTANT: Leave content empty - TipTap will initialize it when editor attaches
      // Do NOT pre-set '<p></p>' as this creates Y.js encoding mismatches
      content: '',
      created: now,
      modified: now,
      tags: [],
      deleted: false,
      folderId: 'all-notes',
      ...noteData
    };

    this.notes.set(note.id, note);
    // IMPORTANT: Await saveNote() to ensure CRDT is fully initialized before continuing
    // This prevents race conditions where the editor binds to a partially-initialized Y.Doc
    await this.saveNote(note);

    // After CRDT initialization, sync the note object with CRDT metadata
    // (e.g., empty title becomes "Untitled" in CRDT)
    if (this.isElectron && this.syncManager) {
      const crdtTitle = this.syncManager.crdtManager.getMetadataDoc(note.id).getMap('metadata').get('title');
      if (crdtTitle && crdtTitle !== note.title) {
        note.title = crdtTitle as string;
        this.notes.set(note.id, note);
      }
    }

    this.notify('note-created', { note });

    return note;
  }

  /**
   * Update an existing note
   * @param id - Note ID
   * @param updates - Updates to apply
   * @returns Updated note or null
   */
  async updateNote(id: string, updates: Partial<Note>): Promise<Note | null> {
    const note = this.notes.get(id);
    if (!note || note.deleted) {
      return null;
    }

    // Only update modified timestamp if content actually changed
    // (not when just extracting title/tags from existing content)
    const contentChanged = updates.content !== undefined;

    const updatedNote: Note = {
      ...note,
      ...updates,
      modified: contentChanged ? new Date().toISOString() : note.modified
    };

    this.notes.set(id, updatedNote);

    // In Electron mode with CRDT, update metadata directly
    // This ensures title/tags/folder changes are reflected in CRDT
    if (this.isElectron && this.syncManager) {
      const metadataUpdates: Record<string, any> = {};
      if (updates.title !== undefined) metadataUpdates.title = updates.title;
      if (updates.tags !== undefined) metadataUpdates.tags = updates.tags;
      if (updates.folderId !== undefined) metadataUpdates.folderId = updates.folderId;
      if (updates.deleted !== undefined) metadataUpdates.deleted = updates.deleted;

      if (Object.keys(metadataUpdates).length > 0) {
        this.syncManager.crdtManager.updateMetadata(id, metadataUpdates);
      }
    }

    // IMPORTANT: Await saveNote when updating critical metadata (folder, deleted status)
    // This ensures the update is flushed to disk before returning, preventing race conditions
    // where the sync loop might reload the note from disk before the flush completes
    const hasCriticalMetadata = updates.folderId !== undefined || updates.deleted !== undefined;
    if (hasCriticalMetadata) {
      await this.saveNote(updatedNote);
    } else {
      this.saveNote(updatedNote); // Non-critical updates can be async
    }

    this.notify('note-updated', { note: updatedNote, updates });

    return updatedNote;
  }

  /**
   * Delete a note (move to trash)
   * @param id - Note ID
   * @returns Success
   */
  async deleteNote(id: string): Promise<boolean> {
    const note = this.notes.get(id);
    if (!note) {
      return false;
    }

    const deletedNote: Note = {
      ...note,
      deleted: true,
      modified: new Date().toISOString()
    };

    this.notes.set(id, deletedNote);
    await this.saveNote(deletedNote); // Wait for save to complete
    this.notify('note-deleted', { note: deletedNote });

    return true;
  }

  /**
   * Permanently delete a note
   * @param id - Note ID
   * @returns Success
   */
  async permanentlyDeleteNote(id: string): Promise<boolean> {
    const note = this.notes.get(id);
    if (!note) return false;

    const success = this.notes.delete(id);
    if (success) {
      // Delete the file in Electron mode
      if (this.isElectron) {
        try {
          // Note: fileStorage is not available in this TypeScript version
          console.warn('permanentlyDeleteNote: file deletion not implemented');
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
   * @param id - Note ID
   * @returns Restored note or null
   */
  restoreNote(id: string): Note | null {
    const note = this.notes.get(id);
    if (!note || !note.deleted) {
      return null;
    }

    const restoredNote: Note = {
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
   * @param query - Search query
   * @returns Matching notes
   */
  searchNotes(query: string): Note[] {
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
   * @param tag - Tag name
   * @returns Notes with the tag
   */
  getNotesByTag(tag: string): Note[] {
    return this.getAllNotes().filter(note =>
      note.tags.includes(tag)
    );
  }

  /**
   * Get all unique tags
   * @returns Array of tag objects with counts
   */
  getAllTags(): Array<{ name: string; count: number }> {
    const tagCounts: Record<string, number> = {};

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
   * @param folderId - Folder ID
   * @returns Notes in the folder
   */
  getNotesInFolder(folderId: string): Note[] {
    if (folderId === 'all-notes') {
      return this.getAllNotes();
    } else if (folderId === 'trash') {
      return Array.from(this.notes.values())
        .filter(note => note.deleted)
        .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    } else {
      return this.getAllNotes().filter(note => note.folderId === folderId);
    }
  }

  /**
   * Move note to a different folder
   * @param noteId - Note ID
   * @param folderId - Target folder ID
   * @returns Updated note or null
   */
  async moveNoteToFolder(noteId: string, folderId: string): Promise<Note | null> {
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
   * @returns Folder manager
   */
  getFolderManager(): FolderManager {
    return this.folderManager;
  }

  /**
   * Get folder tree with note counts
   * @returns Folder tree with counts
   */
  getFolderTreeWithCounts(): any[] {
    const tree = this.folderManager.getFolderTree();

    const addCounts = (folders: any[]): any[] => {
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
