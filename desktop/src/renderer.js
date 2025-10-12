import { NoteCoveEditor } from './lib/editor.js';
import { NoteManager } from './lib/note-manager.js';
import { debounce, escapeHtml, getPreview, formatDate } from './lib/utils.js';

// NoteCove Renderer Process
class NoteCoveApp {
  constructor() {
    this.currentNote = null;
    this.notes = [];
    this.isEditing = false;
    this.editor = null;
    this.noteManager = null;
    this.searchQuery = '';

    this.initializeApp();
    this.setupEventListeners();
  }

  async initializeApp() {
    console.log('NoteCove Desktop v0.1.0 - Initializing...');

    // Check if we have electron API
    if (window.electronAPI) {
      console.log('Electron API available');
      this.setupElectronListeners();
    } else {
      console.log('Running in web mode');
    }

    // Initialize note manager
    this.noteManager = new NoteManager();
    this.noteManager.addListener((event, data) => this.handleNoteEvent(event, data));

    // Initialize editor
    this.initializeEditor();

    // Update UI after notes are loaded
    this.updateUI();
  }

  initializeEditor() {
    const editorElement = document.getElementById('editor');
    if (!editorElement) {
      console.error('Editor element not found');
      return;
    }

    this.editor = new NoteCoveEditor(editorElement, {
      placeholder: 'Start writing your note...',
      onUpdate: () => this.handleEditorUpdate(),
      onFocus: () => this.handleEditorFocus(),
      onBlur: () => this.handleEditorBlur()
    });
  }

  handleNoteEvent(event, data) {
    switch (event) {
      case 'notes-loaded':
        this.notes = data.notes;
        this.updateUI();
        break;
      case 'note-created':
        this.notes = this.noteManager.getAllNotes();
        this.updateUI();
        break;
      case 'note-updated':
        // Only update the notes array in memory, don't re-render to avoid flickering
        this.notes = this.noteManager.getAllNotes();
        break;
      case 'note-deleted':
      case 'note-restored':
        this.notes = this.noteManager.getAllNotes();
        this.updateUI();
        break;
    }
  }

  setupEventListeners() {
    // New note button
    const newNoteBtn = document.querySelector('.new-note-btn');
    if (newNoteBtn) {
      newNoteBtn.addEventListener('click', () => this.createNewNote());
    }

    // New folder button
    const newFolderBtn = document.getElementById('newFolderBtn');
    if (newFolderBtn) {
      newFolderBtn.addEventListener('click', () => this.createNewFolder());
    }

    // Reset store button
    const resetStoreBtn = document.getElementById('resetStoreBtn');
    if (resetStoreBtn) {
      resetStoreBtn.addEventListener('click', () => this.resetNoteStore());
    }

    // Editor events are handled via TipTap callbacks

    // Search
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.onSearch(e.target.value));
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  setupElectronListeners() {
    if (!window.electronAPI) return;

    // Menu actions
    window.electronAPI.onMenuAction((event, action) => {
      switch (action) {
        case 'menu:new-note':
          this.createNewNote();
          break;
        case 'menu:save':
          this.saveCurrentNote();
          break;
      }
    });
  }

  handleEditorUpdate() {
    if (this.currentNote && this.editor) {
      const content = this.editor.getContent();
      const text = this.editor.getText();

      // Extract title from first line
      const firstLine = text.split('\n')[0].trim();
      const title = firstLine || 'Untitled';

      this.currentNote.title = title;
      this.currentNote.content = content;
      this.noteManager.updateNote(this.currentNote.id, { title, content });
    }
  }

  handleEditorFocus() {
    this.isEditing = true;
  }

  handleEditorBlur() {
    this.isEditing = false;
    this.saveCurrentNote();
    // Update the notes list when done editing
    this.renderNotesList();
  }

  updateUI() {
    const notesList = document.getElementById('notesList');
    const welcomeState = document.getElementById('welcomeState');
    const editorState = document.getElementById('editorState');

    if (this.notes.length === 0) {
      // Show welcome state
      welcomeState.style.display = 'flex';
      editorState.style.display = 'none';
      notesList.innerHTML = '<div style="padding: 16px; text-align: center; color: #6B7280;">No notes yet</div>';
    } else {
      // Show notes list
      this.renderNotesList();

      if (this.currentNote) {
        welcomeState.style.display = 'none';
        editorState.style.display = 'flex';
        this.renderCurrentNote();
      } else {
        welcomeState.style.display = 'flex';
        editorState.style.display = 'none';
      }
    }
  }

  renderNotesList() {
    const notesList = document.getElementById('notesList');
    const filteredNotes = this.searchQuery ?
      this.noteManager.searchNotes(this.searchQuery) :
      this.notes;

    if (filteredNotes.length === 0) {
      notesList.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-secondary);">
          ${this.searchQuery ? 'No notes found' : 'No notes yet'}
        </div>
      `;
      return;
    }

    notesList.innerHTML = filteredNotes.map(note => `
      <div class="note-item ${this.currentNote?.id === note.id ? 'active' : ''}"
           onclick="app.selectNote('${note.id}')">
        <div class="note-title">${escapeHtml(note.title || 'Untitled')}</div>
        <div class="note-preview">${getPreview(this.editor ? this.editor.getText() : note.content, 60)}</div>
        <div class="note-meta">${formatDate(note.modified)}</div>
      </div>
    `).join('');
  }

  renderCurrentNote() {
    if (!this.currentNote) return;

    // Always update editor content when switching notes
    if (this.editor) {
      this.editor.setContent(this.currentNote.content || '');
      this.editor.focus();
    }
  }

  createNewNote() {
    const newNote = this.noteManager.createNote();
    this.currentNote = newNote;
    this.updateUI();

    // Focus on editor
    setTimeout(() => {
      if (this.editor) {
        this.editor.focus();
      }
    }, 100);
  }

  createNewFolder() {
    // For now, just log a message. A proper modal dialog would be better.
    console.log('Create folder feature coming soon!');
    // TODO: Implement a proper modal dialog for folder creation
    this.updateStatus('Folder feature coming soon');
  }

  async resetNoteStore() {
    // Create a simple confirmation using dialog API if available
    if (window.electronAPI && window.electronAPI.dialog) {
      const result = await window.electronAPI.dialog.showMessageBox({
        type: 'warning',
        buttons: ['Cancel', 'Reset'],
        defaultId: 0,
        title: 'Reset Note Store',
        message: 'Are you sure you want to reset the note store?',
        detail: 'This will delete all notes and reset to the initial state. This cannot be undone.'
      });

      if (result.response !== 1) {
        return; // User cancelled
      }
    } else {
      // Fallback for web mode
      const confirmed = window.confirm('Are you sure you want to reset the note store? This will delete all notes and cannot be undone.');
      if (!confirmed) return;
    }

    // Clear localStorage first
    localStorage.clear();

    // Delete all note files if in Electron
    if (window.electronAPI && window.electronAPI.fileSystem) {
      try {
        const notesPath = await window.electronAPI.settings.get('notesPath');
        const result = await window.electronAPI.fileSystem.readDir(notesPath);
        if (result.success && result.files) {
          // Delete each JSON file
          for (const filename of result.files) {
            if (filename.endsWith('.json')) {
              const filePath = `${notesPath}/${filename}`;
              await window.electronAPI.fileSystem.deleteFile(filePath);
              console.log('Deleted:', filePath);
            }
          }
        }
      } catch (error) {
        console.error('Failed to clear note files:', error);
      }
    }

    // Reload the page to get a fresh start
    window.location.reload();
  }

  selectNote(noteId) {
    const note = this.noteManager.getNote(noteId);
    if (note && !note.deleted) {
      this.saveCurrentNote(); // Save previous note
      this.currentNote = note;
      this.updateUI();
    }
  }


  updateNoteInList() {
    // Update the note item in the sidebar
    this.renderNotesList();
  }

  saveCurrentNote() {
    if (this.currentNote) {
      // Note is automatically saved via noteManager updates
      this.updateStatus('Saved');
    }
  }

  onSearch(query) {
    this.searchQuery = query.trim();
    this.updateUI();
  }

  handleKeyboard(e) {
    // Handle global keyboard shortcuts
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case 'n':
          e.preventDefault();
          this.createNewNote();
          break;
        case 's':
          e.preventDefault();
          this.saveCurrentNote();
          break;
      }
    }
  }

  // Removed - now using imported utility functions

  updateStatus(message) {
    const statusLeft = document.querySelector('.status-left');
    if (statusLeft) {
      statusLeft.textContent = message;
      setTimeout(() => {
        statusLeft.textContent = 'Ready';
      }, 2000);
    }
  }
}

// Global functions for HTML onclick handlers
window.createNewNote = () => {
  if (window.app) {
    window.app.createNewNote();
  }
};

window.app = null;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new NoteCoveApp();
});

// Export for module usage
export default NoteCoveApp;