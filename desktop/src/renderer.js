import { NoteCoveEditor } from './lib/editor.js';
import { NoteManager } from './lib/note-manager.js';
import { SyncManager } from './lib/sync-manager.js';
import { debounce, escapeHtml, getPreview, formatDate } from './lib/utils.js';

// NoteCove Renderer Process
class NoteCoveApp {
  constructor() {
    this.currentNote = null;
    this.notes = [];
    this.isEditing = false;
    this.editor = null;
    this.noteManager = null;
    this.syncManager = null;
    this.searchQuery = '';
    this.currentFolderId = 'all-notes'; // Default to All Notes folder
    this.folderManager = null;
    this.selectedTag = null; // Selected tag filter
    this.isSettingContent = false; // Flag to prevent update handlers during programmatic content changes

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

    // Get folder manager from note manager
    this.folderManager = this.noteManager.getFolderManager();
    this.folderManager.addListener((event, data) => this.handleFolderEvent(event, data));

    // Initialize editor
    this.initializeEditor();

    // Initialize sync manager
    this.initializeSyncManager();

    // Update UI after notes are loaded
    this.updateUI();
    this.renderFolderTree();
    this.renderTagsList();
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

    // Setup the formatting toolbar
    this.editor.setupToolbar();
  }

  initializeSyncManager() {
    if (!this.noteManager || !this.noteManager.fileStorage) {
      console.log('Sync manager not initialized: file storage not available');
      return;
    }

    // Create sync manager
    this.syncManager = new SyncManager(this.noteManager, this.noteManager.fileStorage);

    // Add sync event listeners
    this.syncManager.addListener((event, data) => this.handleSyncEvent(event, data));

    // Start watching for file changes
    this.syncManager.startWatching();
  }

  handleSyncEvent(event, data) {
    switch (event) {
      case 'status-changed':
        console.log('Sync status changed:', data.status);
        this.updateSyncStatus(data.status);
        break;
      case 'note-synced':
        console.log('Note synced:', data.noteId, data.action);
        this.updateStatus(`Synced: ${data.action}`);
        // Refresh the notes list if a note was added or updated externally
        if (data.action === 'added' || data.action === 'deleted') {
          this.notes = this.noteManager.getAllNotes();
          this.updateUI();
        } else if (data.action === 'updated') {
          // Only update the notes array, don't re-render to avoid flickering
          this.notes = this.noteManager.getAllNotes();
          this.renderNotesList();
        }
        break;
      case 'conflict-detected':
        console.warn('Sync conflict detected:', data.noteId);
        this.updateStatus(`Conflict resolved: ${data.resolution} version kept`);
        break;
      case 'force-sync-complete':
        console.log('Force sync completed:', data.noteCount, 'notes');
        this.updateStatus('Sync complete');
        break;
    }
  }

  updateSyncStatus(status) {
    // Update sync status in UI
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) {
      let statusText = '';
      let statusIcon = '';
      switch (status) {
        case 'watching':
          statusIcon = '👁️';
          statusText = 'Watching';
          break;
        case 'syncing':
          statusIcon = '🔄';
          statusText = 'Syncing...';
          break;
        case 'error':
          statusIcon = '⚠️';
          statusText = 'Sync Error';
          break;
        case 'idle':
        default:
          statusIcon = '✓';
          statusText = 'Sync Ready';
          break;
      }
      syncStatus.textContent = `${statusIcon} ${statusText}`;
    }
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

  handleFolderEvent(event, data) {
    switch (event) {
      case 'folders-loaded':
      case 'folder-created':
      case 'folder-updated':
      case 'folder-deleted':
        this.renderFolderTree();
        break;
    }
  }

  setupEventListeners() {
    // New note button (welcome screen)
    const newNoteBtn = document.querySelector('.new-note-btn');
    if (newNoteBtn) {
      newNoteBtn.addEventListener('click', () => this.createNewNote());
    }

    // New note button (sidebar)
    const newNoteBtnSidebar = document.getElementById('newNoteBtn');
    if (newNoteBtnSidebar) {
      newNoteBtnSidebar.addEventListener('click', () => this.createNewNote());
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

    // Delete note button
    const deleteNoteBtn = document.getElementById('deleteNoteBtn');
    if (deleteNoteBtn) {
      deleteNoteBtn.addEventListener('click', () => this.deleteCurrentNote());
    }

    // Editor events are handled via TipTap callbacks

    // Search
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.onSearch(e.target.value));
    }

    // Use event delegation for note item clicks to avoid race conditions
    // when DOM is recreated by renderNotesList()
    const notesList = document.getElementById('notesList');
    if (notesList) {
      notesList.addEventListener('click', (e) => {
        // Find the closest .note-item element
        const noteItem = e.target.closest('.note-item');
        if (!noteItem) return;

        // Don't select if clicking on action buttons
        if (e.target.closest('.note-actions')) return;

        const noteId = noteItem.dataset.noteId;
        if (noteId) {
          this.selectNote(noteId);
        }
      });
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  setupElectronListeners() {
    if (!window.electronAPI) return;

    // Menu actions
    window.electronAPI.onMenuAction((action) => {
      switch (action) {
        case 'menu:new-note':
          this.createNewNote();
          break;
        case 'menu:save':
          this.saveCurrentNote();
          break;
      }
    });

    // Window maximize state
    window.electronAPI.onWindowMaximized((isMaximized) => {
      console.log('Window maximized state changed:', isMaximized);
      if (isMaximized) {
        document.body.classList.add('maximized');
      } else {
        document.body.classList.remove('maximized');
      }
      console.log('Body classes:', document.body.className);
    });
  }

  handleEditorUpdate() {
    // Don't update note if we're programmatically setting content
    if (this.isSettingContent) {
      return;
    }

    if (this.currentNote && this.editor) {
      const content = this.editor.getContent();
      const text = this.editor.getText();

      // Extract title from first line
      const firstLine = text.split('\n')[0].trim();
      const title = firstLine || 'Untitled';

      // Extract tags from content
      const tags = this.extractTags(text);

      // Check if tags or title have changed
      const tagsChanged = JSON.stringify(this.currentNote.tags || []) !== JSON.stringify(tags);
      const titleChanged = this.currentNote.title !== title;

      this.currentNote.title = title;
      this.currentNote.content = content;
      this.currentNote.tags = tags;
      this.noteManager.updateNote(this.currentNote.id, { title, content, tags });

      // Re-render notes list if title changed (to update sidebar)
      if (titleChanged) {
        this.renderNotesList();
      }

      // Re-render tags list if tags changed
      if (tagsChanged) {
        this.renderTagsList();
      }
    }
  }

  /**
   * Extract hashtags from text
   * @param {string} text - Text to extract tags from
   * @returns {Array<string>} Array of unique tags (without # prefix)
   */
  extractTags(text) {
    const tagRegex = /#[\w-]+/g;
    const matches = text.match(tagRegex) || [];
    // Remove # prefix and deduplicate
    const tags = [...new Set(matches.map(tag => tag.substring(1)))];
    return tags;
  }

  handleEditorFocus() {
    this.isEditing = true;
  }

  handleEditorBlur() {
    this.isEditing = false;
    this.saveCurrentNote();
    // Don't call renderNotesList() here as it recreates the DOM and can interfere with click events
    // The notes list will be updated by handleEditorUpdate() when the title changes
  }

  updateUI() {
    const notesList = document.getElementById('notesList');
    const welcomeState = document.getElementById('welcomeState');
    const editorState = document.getElementById('editorState');

    // Always render notes list if viewing trash (even if all non-deleted notes are gone)
    const shouldShowNotesList = this.notes.length > 0 || this.currentFolderId === 'trash';

    if (!shouldShowNotesList) {
      // Show welcome state
      welcomeState.style.display = 'flex';
      editorState.style.display = 'none';
      notesList.innerHTML = '<div style="padding: 16px; text-align: center; color: #6B7280;">No notes yet</div>';
    } else {
      // Show notes list
      this.renderNotesList();
      this.renderTagsList();

      if (this.currentNote) {
        welcomeState.style.display = 'none';
        editorState.style.display = 'flex';
        // Always render current note when updateUI is called
        // The isSettingContent flag in renderCurrentNote prevents infinite loops
        this.renderCurrentNote();
      } else {
        welcomeState.style.display = 'flex';
        editorState.style.display = 'none';
      }
    }
  }

  renderNotesList() {
    const notesList = document.getElementById('notesList');
    const notesCount = document.getElementById('notesCount');

    // Get notes based on search query or all notes
    let filteredNotes = this.searchQuery ?
      this.noteManager.searchNotes(this.searchQuery) :
      this.notes;

    // Filter by folder if not "all-notes"
    if (this.currentFolderId && this.currentFolderId !== 'all-notes') {
      filteredNotes = this.noteManager.getNotesInFolder(this.currentFolderId);

      // Apply search filter if there's a query
      if (this.searchQuery) {
        const normalizedQuery = this.searchQuery.toLowerCase();
        filteredNotes = filteredNotes.filter(note => {
          return (
            note.title.toLowerCase().includes(normalizedQuery) ||
            note.content.toLowerCase().includes(normalizedQuery) ||
            note.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))
          );
        });
      }
    }

    // Filter by selected tag
    if (this.selectedTag) {
      filteredNotes = filteredNotes.filter(note =>
        note.tags && note.tags.includes(this.selectedTag)
      );
    }

    // Update notes count - show count in current folder view
    if (notesCount) {
      if (this.currentFolderId && this.currentFolderId !== 'all-notes') {
        notesCount.textContent = this.noteManager.getNotesInFolder(this.currentFolderId).length;
      } else {
        notesCount.textContent = this.notes.length;
      }
    }

    if (filteredNotes.length === 0) {
      notesList.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-secondary);">
          ${this.searchQuery ? 'No notes found' : 'No notes yet'}
        </div>
      `;
      return;
    }

    // Check if we're in trash view
    const isTrashView = this.currentFolderId === 'trash';

    notesList.innerHTML = filteredNotes.map(note => `
      <div class="note-item ${this.currentNote?.id === note.id ? 'active' : ''}"
           ${!isTrashView ? 'draggable="true"' : 'draggable="true"'}
           data-note-id="${note.id}"
           ${!isTrashView ? 'ondragstart="app.handleNoteDragStart(event)" ondragend="app.handleNoteDragEnd(event)"' : 'ondragstart="app.handleTrashNoteDragStart(event)" ondragend="app.handleNoteDragEnd(event)"'}>
        <div class="note-title">${escapeHtml(note.title || 'Untitled')}</div>
        <div class="note-preview">${getPreview(note.content, 60)}</div>
        <div class="note-meta">${formatDate(note.modified)}</div>
        ${isTrashView ? `
          <div class="note-actions" onclick="event.stopPropagation()">
            <button class="note-action-btn restore-btn" onclick="app.restoreNote('${note.id}')" title="Restore">↩️</button>
            <button class="note-action-btn delete-btn" onclick="app.permanentlyDeleteNote('${note.id}')" title="Delete Forever">🗑️</button>
          </div>
        ` : ''}
      </div>
    `).join('');

    // Note: Click event listeners are set up once using event delegation in initializeEventListeners()
    // No need to add individual listeners here, which prevents race conditions when DOM is recreated
  }

  /**
   * Render tags list with counts
   */
  renderTagsList() {
    const tagsList = document.getElementById('tagsList');
    if (!tagsList) return;

    // Collect all tags with counts
    const tagCounts = new Map();
    this.notes.forEach(note => {
      if (note.tags && note.tags.length > 0) {
        note.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });

    // Sort tags alphabetically
    const sortedTags = Array.from(tagCounts.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    if (sortedTags.length === 0) {
      tagsList.innerHTML = `
        <div style="padding: 8px; text-align: center; color: var(--text-secondary); font-size: 12px;">
          No tags yet
        </div>
      `;
      return;
    }

    tagsList.innerHTML = sortedTags.map(([tag, count]) => `
      <div class="tag-item ${this.selectedTag === tag ? 'active' : ''}"
           data-tag="${escapeHtml(tag)}">
        <span class="tag-name">#${escapeHtml(tag)}</span>
        <span class="tag-count">${count}</span>
      </div>
    `).join('');

    // Add click event listeners
    const tagItems = tagsList.querySelectorAll('.tag-item');
    tagItems.forEach(item => {
      item.addEventListener('click', () => {
        const tag = item.dataset.tag;
        this.selectTag(tag);
      });
    });
  }

  /**
   * Select a tag to filter notes
   * @param {string} tag - Tag to filter by
   */
  selectTag(tag) {
    // Toggle tag selection - clicking the same tag deselects it
    if (this.selectedTag === tag) {
      this.selectedTag = null;
    } else {
      this.selectedTag = tag;
    }

    this.renderTagsList();
    this.renderNotesList();
  }

  renderCurrentNote(scrollToTop = true) {
    if (!this.currentNote) return;

    // Always update editor content when switching notes
    if (this.editor) {
      // Set flag to prevent handleEditorUpdate from firing during programmatic content change
      this.isSettingContent = true;
      // Pass the note ID so the editor can track which note is currently loaded
      this.editor.setContent(this.currentNote.content || '', this.currentNote.id);
      this.isSettingContent = false;

      // Only focus editor if search input doesn't have focus
      const searchInput = document.querySelector('.search-input');
      if (!searchInput || document.activeElement !== searchInput) {
        this.editor.focus();
      }

      // Scroll to top of editor container only when switching notes
      if (scrollToTop) {
        setTimeout(() => {
          const editorContainer = document.querySelector('.editor-container');
          if (editorContainer) {
            editorContainer.scrollTop = 0;
          }
        }, 0);
      }
    }
  }

  createNewNote() {
    // Create note in the currently selected folder
    const newNote = this.noteManager.createNote({
      folderId: this.currentFolderId || 'all-notes'
    });
    this.currentNote = newNote;
    this.isEditing = false; // Reset editing state to ensure editor gets cleared

    // Don't call updateUI() here as it recreates the DOM and can interfere with click events
    // Instead, just update what's needed:

    // 1. Add the new note to the notes list (uses event delegation for clicks)
    this.renderNotesList();
    this.renderTagsList();

    // 2. Update editor content
    this.renderCurrentNote();

    // 3. Show editor state if it's hidden
    const welcomeState = document.getElementById('welcomeState');
    const editorState = document.getElementById('editorState');
    if (this.currentNote) {
      welcomeState.style.display = 'none';
      editorState.style.display = 'flex';
    }

    // Focus on editor after DOM updates complete
    setTimeout(() => {
      if (this.editor) {
        this.editor.focus();
      }
    }, 100);
  }

  async createNewFolder() {
    // Determine parent folder
    let parentId = 'root';
    let parentName = null;

    // If a custom folder is selected (not special folders), offer to create subfolder
    if (this.currentFolderId && this.currentFolderId !== 'all-notes' && this.currentFolderId !== 'trash') {
      const currentFolder = this.folderManager.getFolder(this.currentFolderId);
      if (currentFolder && !currentFolder.isSpecial) {
        const createSubfolder = await this.showConfirmDialog(
          'Create Subfolder?',
          `Create a subfolder inside "${currentFolder.name}"?`
        );
        if (createSubfolder) {
          parentId = this.currentFolderId;
          parentName = currentFolder.name;
        }
      }
    }

    // Create a simple input dialog
    const message = parentName ? `Enter subfolder name for "${parentName}":` : 'Enter folder name:';
    const folderName = await this.showInputDialog('New Folder', message);
    if (!folderName || !folderName.trim()) return;

    try {
      const folder = await this.folderManager.createFolder(folderName, parentId);
      if (parentName) {
        this.updateStatus(`Created subfolder "${folder.name}" in "${parentName}"`);
      } else {
        this.updateStatus(`Created folder "${folder.name}"`);
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
      this.updateStatus('Failed to create folder');
    }
  }

  showInputDialog(title, message, defaultValue = '') {
    return new Promise((resolve) => {
      // Create overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      // Create dialog
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: var(--surface);
        border-radius: 8px;
        padding: 24px;
        min-width: 400px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      `;

      dialog.innerHTML = `
        <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">${title}</h3>
        <p style="margin: 0 0 16px 0; color: var(--text-secondary);">${message}</p>
        <input type="text" id="dialogInput" value="${defaultValue}"
               style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px;
                      background: var(--background); color: var(--text-primary); font-size: 14px; box-sizing: border-box;" />
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
          <button id="dialogCancel" style="padding: 8px 16px; border: 1px solid var(--border);
                  background: var(--background); color: var(--text-primary); border-radius: 4px;
                  cursor: pointer;">Cancel</button>
          <button id="dialogOk" style="padding: 8px 16px; border: none; background: var(--primary-color);
                  color: white; border-radius: 4px; cursor: pointer;">OK</button>
        </div>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const input = dialog.querySelector('#dialogInput');
      const okBtn = dialog.querySelector('#dialogOk');
      const cancelBtn = dialog.querySelector('#dialogCancel');

      const cleanup = () => {
        document.body.removeChild(overlay);
      };

      okBtn.onclick = () => {
        cleanup();
        resolve(input.value);
      };

      cancelBtn.onclick = () => {
        cleanup();
        resolve(null);
      };

      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          cleanup();
          resolve(input.value);
        } else if (e.key === 'Escape') {
          cleanup();
          resolve(null);
        }
      };

      // Focus input
      setTimeout(() => input.focus(), 100);
    });
  }

  renderFolderTree() {
    const folderTree = document.getElementById('folderTree');
    if (!folderTree || !this.folderManager) return;

    const tree = this.folderManager.getFolderTree();
    folderTree.innerHTML = this.renderFolderItems(tree);
  }

  renderFolderItems(folders, level = 0) {
    if (!folders || folders.length === 0) return '';

    return folders.map(folder => {
      const indent = level * 16;
      const icon = folder.icon || '📁';
      const hasChildren = folder.children && folder.children.length > 0;
      const isActive = this.currentFolderId === folder.id;
      const isDraggable = !folder.isSpecial && !folder.isRoot;

      return `
        <div class="folder-item ${isActive ? 'active' : ''}"
             style="padding-left: ${indent + 8}px"
             data-folder-id="${folder.id}"
             ${isDraggable ? 'draggable="true"' : ''}
             ${isDraggable ? 'ondragstart="app.handleFolderDragStart(event)"' : ''}
             ${isDraggable ? 'ondragend="app.handleFolderDragEnd(event)"' : ''}
             onclick="app.selectFolder('${folder.id}')"
             ondragover="app.handleFolderDragOver(event)"
             ondragleave="app.handleFolderDragLeave(event)"
             ondrop="app.handleFolderDrop(event)">
          <span class="folder-icon">${icon}</span>
          <span class="folder-name">${escapeHtml(folder.name)}</span>
        </div>
        ${hasChildren ? this.renderFolderItems(folder.children, level + 1) : ''}
      `;
    }).join('');
  }

  selectFolder(folderId) {
    this.currentFolderId = folderId;
    this.renderFolderTree();
    this.updateUI();
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

    // Clear all localStorage data including folders and notes
    localStorage.clear();

    // Reset folders to default structure
    localStorage.removeItem('notecove-folders');

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

    // Reload the page to get a fresh start with default folders
    window.location.reload();
  }

  selectNote(noteId) {
    const note = this.noteManager.getNote(noteId);
    if (note && !note.deleted) {
      this.saveCurrentNote(); // Save previous note
      this.currentNote = note;
      this.isEditing = false; // Reset editing state when switching notes

      // Don't call updateUI() here as it recreates the DOM and breaks event handling
      // Instead, just update what's needed:

      // 1. Show editor state and hide welcome state
      const welcomeState = document.getElementById('welcomeState');
      const editorState = document.getElementById('editorState');
      if (welcomeState && editorState) {
        welcomeState.style.display = 'none';
        editorState.style.display = 'flex';
      }

      // 2. Update editor content
      this.renderCurrentNote();

      // 3. Update active state in sidebar (without recreating HTML)
      const notesList = document.getElementById('notesList');
      if (notesList) {
        notesList.querySelectorAll('.note-item').forEach(item => {
          item.classList.toggle('active', item.dataset.noteId === noteId);
        });
      }

      // 4. Update tags list
      this.renderTagsList();
    }
  }


  updateNoteInList() {
    // Update the note item in the sidebar
    this.renderNotesList();
  }

  saveCurrentNote() {
    if (this.currentNote && this.editor) {
      // Force immediate save of current content (don't wait for debounce)
      const content = this.editor.getContent();
      const text = this.editor.getText();
      const firstLine = text.split('\n')[0].trim();
      const title = firstLine || 'Untitled';
      const tags = this.extractTags(text);

      this.currentNote.title = title;
      this.currentNote.content = content;
      this.currentNote.tags = tags;
      this.noteManager.updateNote(this.currentNote.id, { title, content, tags });

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

  async deleteCurrentNote() {
    if (!this.currentNote) return;

    const confirmed = await this.showConfirmDialog(
      'Move to Trash',
      `Move "${this.currentNote.title || 'Untitled'}" to trash?`
    );

    if (!confirmed) return;

    const noteId = this.currentNote.id;
    this.noteManager.deleteNote(noteId);
    this.currentNote = null;
    this.updateStatus('Moved to trash');
    this.updateUI();
  }

  showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      // Create overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      // Create dialog
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: var(--surface);
        border-radius: 8px;
        padding: 24px;
        min-width: 400px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      `;

      dialog.innerHTML = `
        <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">${title}</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">${message}</p>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button id="dialogCancel" style="padding: 8px 16px; border: 1px solid var(--border);
                  background: var(--background); color: var(--text-primary); border-radius: 4px;
                  cursor: pointer;">Cancel</button>
          <button id="dialogConfirm" style="padding: 8px 16px; border: none; background: #ef4444;
                  color: white; border-radius: 4px; cursor: pointer;">Move to Trash</button>
        </div>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const confirmBtn = dialog.querySelector('#dialogConfirm');
      const cancelBtn = dialog.querySelector('#dialogCancel');

      const cleanup = () => {
        document.body.removeChild(overlay);
      };

      confirmBtn.onclick = () => {
        cleanup();
        resolve(true);
      };

      cancelBtn.onclick = () => {
        cleanup();
        resolve(false);
      };

      // Handle Escape key
      const handleKeydown = (e) => {
        if (e.key === 'Escape') {
          cleanup();
          resolve(false);
          document.removeEventListener('keydown', handleKeydown);
        }
      };
      document.addEventListener('keydown', handleKeydown);

      // Focus confirm button
      setTimeout(() => confirmBtn.focus(), 100);
    });
  }

  restoreNote(noteId) {
    const note = this.noteManager.restoreNote(noteId);
    if (note) {
      this.updateStatus(`Restored "${note.title || 'Untitled'}"`);
      this.updateUI();
    }
  }

  async permanentlyDeleteNote(noteId) {
    const note = this.noteManager.getNote(noteId);
    if (!note) return;

    const confirmed = await this.showConfirmDialog(
      'Delete Permanently',
      `Permanently delete "${note.title || 'Untitled'}"? This cannot be undone.`
    );

    if (!confirmed) return;

    this.noteManager.permanentlyDeleteNote(noteId);
    if (this.currentNote?.id === noteId) {
      this.currentNote = null;
    }
    this.updateStatus('Permanently deleted');
    this.updateUI();
  }

  // Removed - now using imported utility functions

  // Drag-and-drop handlers for notes
  handleNoteDragStart(e) {
    const noteId = e.target.closest('.note-item').dataset.noteId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', noteId);
    e.dataTransfer.setData('text/note-type', 'active');
    e.target.classList.add('dragging');
  }

  handleTrashNoteDragStart(e) {
    const noteId = e.target.closest('.note-item').dataset.noteId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', noteId);
    e.dataTransfer.setData('text/note-type', 'deleted');
    e.target.classList.add('dragging');
  }

  handleNoteDragEnd(e) {
    e.target.classList.remove('dragging');
  }

  handleFolderDragStart(e) {
    const folderItem = e.target.closest('.folder-item');
    const folderId = folderItem.dataset.folderId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', folderId);
    e.dataTransfer.setData('text/drag-type', 'folder');
    folderItem.classList.add('dragging');
  }

  handleFolderDragEnd(e) {
    const folderItem = e.target.closest('.folder-item');
    if (folderItem) {
      folderItem.classList.remove('dragging');
    }
  }

  handleFolderDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const folderItem = e.target.closest('.folder-item');
    if (folderItem) {
      folderItem.classList.add('drag-over');
    }
  }

  handleFolderDragLeave(e) {
    const folderItem = e.target.closest('.folder-item');
    if (folderItem) {
      folderItem.classList.remove('drag-over');
    }
  }

  async handleFolderDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const folderItem = e.target.closest('.folder-item');
    if (folderItem) {
      folderItem.classList.remove('drag-over');

      const draggedId = e.dataTransfer.getData('text/plain');
      const dragType = e.dataTransfer.getData('text/drag-type');
      const noteType = e.dataTransfer.getData('text/note-type');
      const targetFolderId = folderItem.dataset.folderId;

      // Handle folder drop - moving folder to become subfolder
      if (dragType === 'folder' && draggedId && targetFolderId) {
        const movedFolder = await this.noteManager.getFolderManager().moveFolder(draggedId, targetFolderId);
        if (movedFolder) {
          this.updateStatus(`Moved folder to "${this.noteManager.getFolderManager().getFolder(targetFolderId)?.name || 'folder'}"`);
          this.renderFolderTree();
        } else {
          this.updateStatus('Cannot move folder there');
        }
        return;
      }

      // Handle note drop
      const noteId = draggedId;
      const folderId = targetFolderId;

      if (noteId && folderId) {
        const note = this.noteManager.getNote(noteId);
        if (!note) return;

        // If dropping an active note into trash, delete it
        if (folderId === 'trash' && noteType === 'active' && !note.deleted) {
          const confirmed = await this.showConfirmDialog(
            'Move to Trash',
            `Are you sure you want to move "${note.title || 'Untitled'}" to trash?`
          );
          if (confirmed) {
            this.noteManager.deleteNote(noteId);
            this.updateStatus(`Moved "${note.title || 'Untitled'}" to trash`);
            this.updateUI();
            // Clear editor if the deleted note was selected
            if (this.currentNoteId === noteId) {
              this.currentNoteId = null;
              this.clearEditor();
            }
          }
          return;
        }

        // Don't allow dropping deleted notes into trash
        if (folderId === 'trash' && noteType === 'deleted') {
          this.updateStatus('Note is already in trash');
          return;
        }

        // If dragging from trash, restore the note
        if (noteType === 'deleted' && note.deleted) {
          // Restore and move to the target folder
          const restoredNote = this.noteManager.restoreNote(noteId);
          if (restoredNote && folderId !== 'all-notes') {
            await this.noteManager.moveNoteToFolder(noteId, folderId);
            this.updateStatus(`Restored "${note.title || 'Untitled'}" to folder`);
          } else {
            this.updateStatus(`Restored "${note.title || 'Untitled'}"`);
          }
          this.updateUI();
        }
        // Otherwise, just move the note
        else if (!note.deleted && note.folderId !== folderId && folderId !== 'all-notes') {
          await this.noteManager.moveNoteToFolder(noteId, folderId);
          this.updateStatus(`Moved "${note.title || 'Untitled'}" to folder`);
          this.updateUI();
        }
      }
    }
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