// NoteCove Renderer Process
class NoteCoveApp {
  constructor() {
    this.currentNote = null;
    this.notes = [];
    this.isEditing = false;

    this.initializeApp();
    this.setupEventListeners();
  }

  initializeApp() {
    console.log('NoteCove Desktop v0.1.0 - Initializing...');

    // Check if we have electron API
    if (window.electronAPI) {
      console.log('Electron API available');
      this.setupElectronListeners();
    } else {
      console.log('Running in web mode');
    }

    // Load existing notes (placeholder for now)
    this.loadNotes();
    this.updateUI();
  }

  setupEventListeners() {
    // New note button
    const newNoteBtn = document.querySelector('.new-note-btn');
    if (newNoteBtn) {
      newNoteBtn.addEventListener('click', () => this.createNewNote());
    }

    // Note title input
    const titleInput = document.getElementById('noteTitleInput');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => this.onTitleChange(e.target.value));
      titleInput.addEventListener('blur', () => this.saveCurrentNote());
    }

    // Editor
    const editor = document.getElementById('editor');
    if (editor) {
      editor.addEventListener('input', () => this.onEditorChange());
      editor.addEventListener('focus', () => this.onEditorFocus());
      editor.addEventListener('blur', () => this.saveCurrentNote());
    }

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

  loadNotes() {
    // Placeholder: Load notes from storage
    // This will be implemented with actual file system in later commits
    this.notes = [
      {
        id: '1',
        title: 'Welcome to NoteCove',
        content: 'This is your first note! Start typing to edit it.',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        tags: ['welcome']
      }
    ];
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

    notesList.innerHTML = this.notes.map(note => `
      <div class="note-item ${this.currentNote?.id === note.id ? 'active' : ''}"
           onclick="app.selectNote('${note.id}')">
        <div class="note-title">${this.escapeHtml(note.title || 'Untitled')}</div>
        <div class="note-preview">${this.getPreview(note.content)}</div>
      </div>
    `).join('');
  }

  renderCurrentNote() {
    if (!this.currentNote) return;

    const titleInput = document.getElementById('noteTitleInput');
    const editor = document.getElementById('editor');

    if (titleInput) {
      titleInput.value = this.currentNote.title || '';
    }

    if (editor) {
      editor.innerHTML = this.formatContent(this.currentNote.content || '');
    }
  }

  createNewNote() {
    const newNote = {
      id: Date.now().toString(),
      title: '',
      content: '',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      tags: []
    };

    this.notes.unshift(newNote);
    this.currentNote = newNote;
    this.updateUI();

    // Focus on title input
    setTimeout(() => {
      const titleInput = document.getElementById('noteTitleInput');
      if (titleInput) {
        titleInput.focus();
      }
    }, 100);
  }

  selectNote(noteId) {
    const note = this.notes.find(n => n.id === noteId);
    if (note) {
      this.saveCurrentNote(); // Save previous note
      this.currentNote = note;
      this.updateUI();
    }
  }

  onTitleChange(title) {
    if (this.currentNote) {
      this.currentNote.title = title;
      this.currentNote.modified = new Date().toISOString();
      this.updateNoteInList();
    }
  }

  onEditorChange() {
    if (this.currentNote) {
      const editor = document.getElementById('editor');
      this.currentNote.content = editor.textContent || '';
      this.currentNote.modified = new Date().toISOString();
      this.updateNoteInList();
    }
  }

  onEditorFocus() {
    this.isEditing = true;
  }

  updateNoteInList() {
    // Update the note item in the sidebar
    this.renderNotesList();
  }

  saveCurrentNote() {
    if (this.currentNote) {
      // Placeholder: Save to file system
      console.log('Saving note:', this.currentNote.title);
      this.updateStatus('Saved');
    }
  }

  onSearch(query) {
    // Placeholder: Implement search
    console.log('Searching for:', query);
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

  formatContent(content) {
    // Basic HTML escaping and formatting
    return this.escapeHtml(content).replace(/\n/g, '<br>');
  }

  getPreview(content) {
    const preview = (content || '').replace(/\n/g, ' ').substring(0, 60);
    return preview.length < content.length ? preview + '...' : preview;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

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