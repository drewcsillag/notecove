import { NoteCoveEditor } from './lib/editor';
import { NoteManager } from './lib/note-manager';
import { SyncManager } from './lib/sync-manager';
import { SyncDirectoryManager } from './lib/sync-directory-manager';
import { escapeHtml, getPreview, formatDate, normalizeTextContent, type Note } from './lib/utils';

interface Folder {
  id: string;
  name: string;
  icon?: string;
  isSpecial?: boolean;
  isRoot?: boolean;
  children?: Folder[];
}

interface TagFilterState {
  tag: string;
  mode: 'include' | 'exclude';
}

interface GapSummary {
  totalMissing: number;
  instanceCount: number;
  instances: Array<{
    instanceId: string;
    missing: number;
  }>;
  lastChecked: number;
}

interface LastOpenedNote {
  noteId: string;
  timestamp: number;
}

interface PanelSizes {
  sidebar: number;
  notesPanel: number;
}

// NoteCove Renderer Process
class NoteCoveApp {
  currentNote: Note | null;
  notes: Note[];
  isEditing: boolean;
  editor: NoteCoveEditor | null;
  noteManager: NoteManager | null;
  syncManager: SyncManager | null;
  syncDirectoryManager: SyncDirectoryManager;
  searchQuery: string;
  tagSearchQuery: string;
  currentFolderId: string;
  currentSyncDirectoryId: string | null; // Track which sync directory the current folder belongs to
  folderManager: any; // FolderManager type from note-manager
  tagFilterState: TagFilterState | null;
  isSettingContent: boolean;
  noteGaps: Map<string, GapSummary>;
  isElectron: boolean;

  // Panel resize state
  isResizing: boolean;
  resizingPanel: string | null;
  startX: number;
  startWidth: number;

  // Sidebar sections resize state
  isSidebarResizing: boolean;
  startY: number;
  startFolderHeight: number;

  // Private flags
  private _isRendering: boolean;

  // Context menu state
  contextMenuFolderId: string | null;

  // Multi-select state
  selectedNoteIds: Set<string>;
  isMultiSelectMode: boolean;
  lastSelectedNoteId: string | null; // For shift-click range selection

  constructor() {
    this.currentNote = null;
    this.notes = [];
    this.isEditing = false;
    this.editor = null;
    this.noteManager = null;
    this.syncManager = null;
    this.syncDirectoryManager = new SyncDirectoryManager();
    this.searchQuery = '';
    this.tagSearchQuery = '';
    this.currentFolderId = 'all-notes'; // Default to All Notes folder
    this.currentSyncDirectoryId = null; // Will be set to the first sync directory
    this.folderManager = null;
    this.tagFilterState = null; // Tag filter state: { tag: string, mode: 'include' | 'exclude' } or null
    this.isSettingContent = false; // Flag to prevent update handlers during programmatic content changes
    this.noteGaps = new Map(); // Track gaps per note: noteId -> gap summary
    this.selectedNoteIds = new Set();
    this.isMultiSelectMode = false;
    this.lastSelectedNoteId = null;
    this.isElectron = false;
    this._isRendering = false;
    this.contextMenuFolderId = null;

    // Panel resize state
    this.isResizing = false;
    this.resizingPanel = null;
    this.startX = 0;
    this.startWidth = 0;

    // Sidebar sections resize state
    this.isSidebarResizing = false;
    this.startY = 0;
    this.startFolderHeight = 0;

    this.initializeApp();
    this.setupEventListeners();
    this.initializePanelSizes();
  }

  async initializeApp(): Promise<void> {
    console.log('NoteCove Desktop v0.1.0 - Initializing...');

    // Check if we have electron API
    this.isElectron = window.electronAPI?.isElectron || false;
    if (this.isElectron) {
      console.log('Electron API available');
      this.setupElectronListeners();
    } else {
      console.log('Running in web mode');
    }

    // Initialize note manager
    this.noteManager = new NoteManager();
    this.noteManager.addListener((event: string, data: any) => this.handleNoteEvent(event, data));

    // Get folder manager from note manager
    this.folderManager = this.noteManager.getFolderManager();
    this.folderManager.addListener((event: string, data: any) => this.handleFolderEvent(event, data));

    // Initialize sync directory manager
    await this.syncDirectoryManager.initialize();

    // Initialize editor
    this.initializeEditor();

    // In web mode, load notes from localStorage BEFORE checking if sample notes should be loaded
    if (!this.isElectron) {
      await this.noteManager.loadNotes();
    }

    // Initialize sync manager (will reload notes from CRDT in Electron mode, or check for sample notes in web mode)
    await this.initializeSyncManager();

    // Now that syncManager is initialized, update editor with attachmentManager
    if (this.editor && this.syncManager) {
      (this.editor as any).options.attachmentManager = this.syncManager.attachmentManager;
      console.log('[renderer] AttachmentManager connected to editor');
    }

    // Update UI after notes are loaded
    this.updateUI();
    this.renderFolderTree();
    this.renderTagsList();

    // Setup note link hover preview
    this.setupNoteLinkHoverPreview();
  }

  initializeEditor(): void {
    const editorElement = document.getElementById('editor');
    if (!editorElement) {
      console.error('Editor element not found');
      return;
    }

    this.editor = new NoteCoveEditor(editorElement, {
      placeholder: 'Start writing your note...',
      onUpdate: () => this.handleEditorUpdate(),
      onFocus: () => this.handleEditorFocus(),
      onBlur: () => this.handleEditorBlur(),
      onReady: () => this.handleEditorReady(),
      isSettingContent: () => this.isSettingContent,
      onNavigateToNote: (noteId: string | null, noteTitle: string) => this.handleNoteLinkClick(noteId, noteTitle),
      onFindNoteByTitle: (title: string) => this.findNoteByTitle(title),
      onValidateNoteLink: (noteId: string | null, title: string) => this.validateNoteLink(noteId, title),
      onSearchNotes: (query: string) => this.searchNotes(query),
      attachmentManager: this.syncManager?.attachmentManager
    });

    // Setup the formatting toolbar
    this.editor.setupToolbar();
  }

  async initializeSyncManager(): Promise<void> {
    if (!this.noteManager) {
      console.log('Sync manager not initialized: note manager not available');
      return;
    }

    // Only initialize sync manager in Electron mode
    if (!this.isElectron) {
      console.log('Skipping sync manager initialization in web mode');
      console.log('[renderer] Test mode check:', this.noteManager.isTestMode());
      console.log('[renderer] Notes count:', this.noteManager.getAllNotes().length);
      // In web mode, load sample notes if no notes exist (and not in test mode)
      if (this.noteManager.getAllNotes().length === 0 && !this.noteManager.isTestMode()) {
        console.log('[renderer] Loading sample notes');
        await this.noteManager.loadSampleNotes();
      } else {
        console.log('[renderer] NOT loading sample notes');
      }
      return;
    }

    // Get instance ID from settings
    const instanceId = await window.electronAPI?.settings.get('instance') as string | undefined;

    // Get all sync directories
    const syncDirs = this.syncDirectoryManager.getDirectories();

    if (syncDirs.length === 0) {
      console.warn('No sync directories configured!');
      return;
    }

    // Create sync manager for each directory
    for (const syncDir of syncDirs) {
      console.log(`Initializing sync manager for directory: ${syncDir.name} (${syncDir.path})`);

      const syncManager = new SyncManager(this.noteManager, syncDir.path, instanceId);

      // Add sync event listeners
      syncManager.addListener((event: string, data: any) => this.handleSyncEvent(event, data));

      // Add to NoteManager's sync manager map
      await this.noteManager.addSyncManagerForDirectory(syncDir.id, syncManager);

      // Start watching CRDT files for sync
      syncManager.startWatching();
      console.log(`Sync manager initialized for directory ${syncDir.name}`);
    }

    // Set primary sync manager reference for backwards compatibility
    if (syncDirs.length > 0) {
      this.syncManager = this.noteManager.syncManager;
      // Set the first sync directory as the current one
      this.currentSyncDirectoryId = syncDirs[0].id;
    }

    console.log(`Initialized ${syncDirs.length} sync manager(s)`);
  }

  handleSyncEvent(event: string, data: any): void {
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
          this.notes = this.noteManager!.getAllNotes();
          this.updateUI();
        } else if (data.action === 'updated') {
          // Only update the notes array, don't re-render to avoid flickering
          this.notes = this.noteManager!.getAllNotes();
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

  updateSyncStatus(status: string): void {
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

  handleNoteEvent(event: string, data: any): void {
    switch (event) {
      case 'notes-loaded':
        this.notes = data.notes;
        this.updateUI();
        // Restore last opened note after notes are loaded and editor is ready
        this.restoreLastOpenedNoteWhenReady();
        // Update folder counts now that notes are loaded
        this.renderFolderTree();
        break;
      case 'note-created':
        // Update the notes array
        this.notes = this.noteManager!.getAllNotes();

        // If this came from sync (not from local createNewNote), update the UI
        if (data.source === 'sync') {
          console.log('[renderer] New note discovered from sync:', data.note?.title);
          this.renderNotesList();
          this.renderTagsList();
        }

        // Always update folder counts
        this.renderFolderTree();
        break;
      case 'note-updated':
        // Update the notes array in memory
        this.notes = this.noteManager!.getAllNotes();

        // If this came from sync, update the UI to show changes
        if (data.source === 'sync') {
          console.log('[renderer] Note updated from sync:', data.note?.id, data.note?.title);
          // Re-render notes list (to show title changes)
          this.renderNotesList();
          // Re-render tags list (to show tag changes)
          this.renderTagsList();
          // Update folder tree (in case folder changed)
          this.renderFolderTree();

          // If this is the currently open note, update the editor metadata
          if (this.currentNote && this.currentNote.id === data.note?.id) {
            // Update current note reference with synced data
            this.currentNote = data.note;
          }
        }
        break;
      case 'note-deleted':
        console.log('[renderer] Note deleted event received:', data.note?.id, data.note?.title);
        this.notes = this.noteManager!.getAllNotes();
        console.log('[renderer] After getAllNotes(), notes count:', this.notes.length);
        this.updateUI();
        // Update folder counts when notes are deleted/restored
        this.renderFolderTree();
        break;
      case 'note-restored':
        this.notes = this.noteManager!.getAllNotes();
        this.updateUI();
        // Update folder counts when notes are deleted/restored
        this.renderFolderTree();
        break;
      case 'folders-synced':
        // Folder structure was synced from another instance
        console.log('[renderer] Folders synced from another instance');
        this.renderFolderTree();
        break;
      case 'note-gaps-detected':
        // Gaps were detected for this note
        console.log('[renderer] Gaps detected for note:', data.noteId, data.summary);
        this.noteGaps.set(data.noteId, data.summary);
        this.updateGapIndicators(data.noteId);
        break;
      case 'note-gaps-resolved':
        // Gaps were resolved for this note
        console.log('[renderer] Gaps resolved for note:', data.noteId);
        this.noteGaps.delete(data.noteId);
        this.updateGapIndicators(data.noteId);
        break;
    }
  }

  handleFolderEvent(event: string, _data: any): void {
    switch (event) {
      case 'folders-loaded':
      case 'folder-created':
      case 'folder-updated':
      case 'folder-deleted':
      case 'folder-state-changed':
        this.renderFolderTree();
        break;
    }
  }

  setupEventListeners(): void {
    // Save current note before window closes
    window.addEventListener('beforeunload', () => {
      console.log('Window closing - saving current note');
      this.saveCurrentNote();
      // Also flush any pending CRDT updates
      if (this.syncManager && this.currentNote) {
        this.syncManager.updateStore.flush(this.currentNote.id);
      }
    });

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

    // Delete note button
    const deleteNoteBtn = document.getElementById('deleteNoteBtn');
    if (deleteNoteBtn) {
      deleteNoteBtn.addEventListener('click', () => this.deleteCurrentNote());
    }

    // Editor events are handled via TipTap callbacks

    // Search
    const searchInput = document.querySelector('.search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.onSearch((e.target as HTMLInputElement).value));
    }

    // Tag search
    const tagSearchInput = document.getElementById('tagSearchInput') as HTMLInputElement;
    if (tagSearchInput) {
      tagSearchInput.addEventListener('input', (e) => {
        this.tagSearchQuery = (e.target as HTMLInputElement).value.toLowerCase();
        this.renderTagsList();
      });
    }

    // Clear tag filter button
    const clearTagFilterBtn = document.getElementById('clearTagFilterBtn');
    if (clearTagFilterBtn) {
      clearTagFilterBtn.addEventListener('click', () => this.clearTagFilter());
    }

    // Use event delegation for note item clicks to avoid race conditions
    // when DOM is recreated by renderNotesList()
    const notesList = document.getElementById('notesList');
    if (notesList) {
      notesList.addEventListener('click', (e) => {
        // Find the closest .note-item element
        const noteItem = (e.target as HTMLElement).closest('.note-item') as HTMLElement;
        if (!noteItem) return;

        // Don't select if clicking on action buttons
        if ((e.target as HTMLElement).closest('.note-actions')) return;

        const noteId = noteItem.dataset.noteId;
        if (noteId) {
          this.handleNoteClick(noteId, e as MouseEvent);
        }
      });

      // Right-click context menu for notes
      notesList.addEventListener('contextmenu', (e) => {
        const noteItem = (e.target as HTMLElement).closest('.note-item') as HTMLElement;
        if (noteItem) {
          const noteId = noteItem.dataset.noteId;
          if (noteId) {
            e.preventDefault();
            this.showNoteContextMenu(e as MouseEvent, noteId);
          }
        }
      });
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));

    // Context menu click handlers
    const contextMenu = document.getElementById('folderContextMenu');
    if (contextMenu) {
      contextMenu.addEventListener('click', (e) => {
        const menuItem = (e.target as HTMLElement).closest('.context-menu-item') as HTMLElement;
        if (menuItem && !menuItem.classList.contains('disabled')) {
          const action = menuItem.dataset.action;
          if (action) {
            this.handleFolderContextMenuAction(action);
          }
        }
      });
    }

    // Note context menu click handlers
    const noteContextMenu = document.getElementById('noteContextMenu');
    if (noteContextMenu) {
      noteContextMenu.addEventListener('click', (e) => {
        const menuItem = (e.target as HTMLElement).closest('.context-menu-item') as HTMLElement;
        if (menuItem) {
          const action = menuItem.dataset.action;
          if (action) {
            this.handleNoteContextMenuAction(action);
          }
        }
      });
    }

    // Hide context menus when clicking outside or pressing Escape
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.context-menu') && !target.closest('.note-item')) {
        this.hideNoteContextMenu();
        // Clear selection when clicking away (unless clicking in editor or other UI elements)
        if (!target.closest('.ProseMirror') && !target.closest('.sidebar') && !target.closest('.toolbar')) {
          this.clearSelection();
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideNoteContextMenu();
        // Note: Escape key already clears selection via handleKeyboard()
      }
    });

    // Right-click context menu for custom folders (use event delegation)
    const folderTree = document.getElementById('folderTree');
    if (folderTree) {
      folderTree.addEventListener('contextmenu', (e) => {
        const folderItem = (e.target as HTMLElement).closest('.folder-item') as HTMLElement;
        if (folderItem) {
          const folderId = folderItem.dataset.folderId;
          if (folderId) {
            this.showFolderContextMenu(e as MouseEvent, folderId);
          }
        }
      });
    }

    // Folder picker modal event listeners
    const folderPickerClose = document.getElementById('folderPickerClose');
    if (folderPickerClose) {
      folderPickerClose.addEventListener('click', () => this.hideFolderPicker());
    }

    const folderPickerCancel = document.getElementById('folderPickerCancel');
    if (folderPickerCancel) {
      folderPickerCancel.addEventListener('click', () => this.hideFolderPicker());
    }

    // Add escape key handler for folder picker modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('folderPickerModal');
        if (modal && modal.style.display !== 'none') {
          this.hideFolderPicker();
        }
      }
    });

    // Setup panel resize handlers
    this.setupPanelResize();
  }

  initializePanelSizes(): void {
    // Load saved panel sizes from localStorage or use defaults
    try {
      const saved = localStorage.getItem('notecove-panel-sizes');
      if (saved) {
        const sizes: PanelSizes = JSON.parse(saved);
        const sidebar = document.querySelector('.sidebar') as HTMLElement;
        const notesPanel = document.querySelector('.notes-panel') as HTMLElement;

        if (sidebar && sizes.sidebar) {
          sidebar.style.flex = `0 0 ${sizes.sidebar}%`;
        }
        if (notesPanel && sizes.notesPanel) {
          notesPanel.style.flex = `0 0 ${sizes.notesPanel}%`;
        }
      }

      // Load saved folder section height
      const savedFolderHeight = localStorage.getItem('notecove-folder-section-height');
      if (savedFolderHeight) {
        const folderSection = document.querySelector('.folder-section') as HTMLElement;
        if (folderSection) {
          folderSection.style.flex = `0 0 ${savedFolderHeight}px`;
        }
      }
    } catch (error) {
      console.error('Failed to load panel sizes:', error);
    }
  }

  setupPanelResize(): void {
    const resizeHandles = document.querySelectorAll('.resize-handle');

    resizeHandles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => this.startResize(e as MouseEvent));
    });

    // Setup sidebar sections resize (folders/tags)
    const sidebarResizeHandle = document.getElementById('sidebarResizeHandle');
    if (sidebarResizeHandle) {
      sidebarResizeHandle.addEventListener('mousedown', (e) => this.startSidebarSectionsResize(e as MouseEvent));
    }

    document.addEventListener('mousemove', (e) => {
      this.doResize(e);
      this.doSidebarSectionsResize(e);
    });
    document.addEventListener('mouseup', () => {
      this.stopResize();
      this.stopSidebarSectionsResize();
    });
  }

  startResize(e: MouseEvent): void {
    this.isResizing = true;
    this.startX = e.clientX;

    const handle = (e.target as HTMLElement).closest('.resize-handle') as HTMLElement;
    this.resizingPanel = handle.dataset.resize || null;

    const panel = document.querySelector(`.${this.resizingPanel}`) as HTMLElement;
    if (panel) {
      this.startWidth = panel.offsetWidth;
    }

    handle.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    e.preventDefault();
  }

  doResize(e: MouseEvent): void {
    if (!this.isResizing || !this.resizingPanel) return;

    const deltaX = e.clientX - this.startX;
    const panel = document.querySelector(`.${this.resizingPanel}`) as HTMLElement;

    if (!panel) return;

    const container = document.getElementById('app') as HTMLElement;
    const containerWidth = container.offsetWidth;

    // Calculate new width as percentage
    const newWidth = this.startWidth + deltaX;
    const newPercentage = (newWidth / containerWidth) * 100;

    // Enforce min/max constraints (10% - 50%)
    const clampedPercentage = Math.max(10, Math.min(50, newPercentage));

    panel.style.flex = `0 0 ${clampedPercentage}%`;
  }

  stopResize(): void {
    if (!this.isResizing) return;

    this.isResizing = false;

    const handle = document.querySelector('.resize-handle.resizing');
    if (handle) {
      handle.classList.remove('resizing');
    }

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Save panel sizes
    this.savePanelSizes();

    this.resizingPanel = null;
  }

  savePanelSizes(): void {
    try {
      const sidebar = document.querySelector('.sidebar') as HTMLElement;
      const notesPanel = document.querySelector('.notes-panel') as HTMLElement;

      const sizes: PanelSizes = {
        sidebar: parseFloat(sidebar.style.flex.match(/[\d.]+/)?.[0] || '25'),
        notesPanel: parseFloat(notesPanel.style.flex.match(/[\d.]+/)?.[0] || '25')
      };

      localStorage.setItem('notecove-panel-sizes', JSON.stringify(sizes));
    } catch (error) {
      console.error('Failed to save panel sizes:', error);
    }
  }

  startSidebarSectionsResize(e: MouseEvent): void {
    this.isSidebarResizing = true;
    this.startY = e.clientY;

    const folderSection = document.querySelector('.folder-section') as HTMLElement;
    if (folderSection) {
      this.startFolderHeight = folderSection.offsetHeight;
    }

    const handle = document.getElementById('sidebarResizeHandle');
    if (handle) {
      handle.classList.add('resizing');
    }

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    e.preventDefault();
  }

  doSidebarSectionsResize(e: MouseEvent): void {
    if (!this.isSidebarResizing) return;

    const deltaY = e.clientY - this.startY;
    const folderSection = document.querySelector('.folder-section') as HTMLElement;
    const tagsSection = document.querySelector('.tags-section') as HTMLElement;

    if (!folderSection || !tagsSection) return;

    // Calculate new height
    const newFolderHeight = this.startFolderHeight + deltaY;

    // Get the total available height
    const sidebarContent = document.querySelector('.sidebar-content') as HTMLElement;
    if (!sidebarContent) return;

    const totalHeight = sidebarContent.offsetHeight;
    const handleHeight = 6; // Height of resize handle

    // Enforce minimum heights
    const minFolderHeight = 100;
    const minTagsHeight = 80;
    const maxFolderHeight = totalHeight - minTagsHeight - handleHeight;

    const clampedFolderHeight = Math.max(minFolderHeight, Math.min(maxFolderHeight, newFolderHeight));

    // Update folder section flex-basis
    folderSection.style.flex = `0 0 ${clampedFolderHeight}px`;
  }

  stopSidebarSectionsResize(): void {
    if (!this.isSidebarResizing) return;

    this.isSidebarResizing = false;

    const handle = document.getElementById('sidebarResizeHandle');
    if (handle) {
      handle.classList.remove('resizing');
    }

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Save sidebar section sizes
    this.saveSidebarSectionSizes();
  }

  saveSidebarSectionSizes(): void {
    try {
      const folderSection = document.querySelector('.folder-section') as HTMLElement;

      if (folderSection && folderSection.style.flex) {
        const folderHeight = parseInt(folderSection.style.flex.match(/(\d+)px/)?.[1] || '0');
        if (folderHeight > 0) {
          localStorage.setItem('notecove-folder-section-height', folderHeight.toString());
        }
      }
    } catch (error) {
      console.error('Failed to save sidebar section sizes:', error);
    }
  }

  setupElectronListeners(): void {
    if (!window.electronAPI) return;

    // Menu actions
    window.electronAPI?.onMenuAction?.((action: string) => {
      switch (action) {
        case 'menu:new-note':
          this.createNewNote();
          break;
        case 'menu:save':
          this.saveCurrentNote();
          break;
      }
    });

    // Handle save before quit
    window.electronAPI?.onSaveBeforeQuit?.(() => {
      console.log('Save before quit triggered');
      this.saveCurrentNote();
      if (this.syncManager && this.currentNote) {
        this.syncManager.updateStore.flush(this.currentNote.id);
      }
    });

    // Window maximize state
    window.electronAPI?.onWindowMaximized?.((isMaximized: boolean) => {
      console.log('Window maximized state changed:', isMaximized);
      if (isMaximized) {
        document.body.classList.add('maximized');
      } else {
        document.body.classList.remove('maximized');
      }
      console.log('Body classes:', document.body.className);
    });
  }

  handleEditorReady(): void {
    console.log('[renderer] handleEditorReady() - editor is fully initialized');
    // Clear the isSettingContent flag now that editor is ready
    this.isSettingContent = false;
    // Also clear the rendering flag
    this._isRendering = false;
  }

  async handleEditorUpdate(): Promise<void> {
    // Don't update note if we're programmatically setting content
    if (this.isSettingContent) {
      console.log('[renderer] handleEditorUpdate() skipped - isSettingContent=true');
      return;
    }

    if (this.currentNote && this.editor) {
      const text = this.editor.getText();

      // Extract title from first line
      const firstLine = text.split('\n')[0].trim();
      const title = firstLine || 'Untitled';

      // Extract tags from content
      const tags = this.extractTags(text);

      // Check if tags or title have changed
      const tagsChanged = JSON.stringify(this.currentNote.tags || []) !== JSON.stringify(tags);
      const titleChanged = this.currentNote.title !== title;

      // Update local copy for UI (but don't modify the Map object directly)
      // In Electron mode, the source of truth is the CRDT, not the in-memory object
      if (!this.isElectron) {
        this.currentNote.title = title;
        this.currentNote.tags = tags;
      }

      // In Electron/CRDT mode, content is automatically saved by Collaboration extension
      // We only need to update metadata (title, tags)
      if (this.isElectron && this.syncManager) {
        // Only update metadata if something actually changed
        // Also, don't overwrite a real title with "Untitled" (which could happen if editor is empty/not fully loaded)
        const shouldUpdate = (titleChanged || tagsChanged) &&
                            !(title === 'Untitled' && this.currentNote.title && this.currentNote.title !== 'Untitled');

        if (shouldUpdate) {
          // Update metadata in CRDT (this is the source of truth)
          this.syncManager.crdtManager.updateMetadata(this.currentNote.id, { title, tags });
          // Also update the in-memory note object
          const updatedNote = await this.noteManager!.updateNote(this.currentNote.id, { title, tags });
          // Update our local reference to keep it in sync
          if (updatedNote) {
            this.currentNote = updatedNote;
          }
          // Flush immediately to ensure metadata is saved
          this.syncManager.updateStore.flush(this.currentNote.id);
        }
      } else {
        // Web mode: save content as HTML
        const content = this.editor.getContent();
        this.currentNote.content = content;
        const updatedNote = await this.noteManager!.updateNote(this.currentNote.id, { title, content, tags });
        // Update our local reference to keep it in sync
        if (updatedNote) {
          this.currentNote = updatedNote;
        }
      }

      // Re-render notes list if title changed (to update sidebar)
      if (titleChanged) {
        // Update the cached notes array so renderNotesList() sees the new title
        this.notes = this.noteManager!.getAllNotes();
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
   * Only matches # when preceded by whitespace, newline, or at start of text
   * @param text - Text to extract tags from
   * @returns Array of unique tags (without # prefix)
   */
  extractTags(text: string): string[] {
    // Match # only when preceded by whitespace, newline, or at start
    const tagRegex = /(^|\s)(#[\w-]+)/g;
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(text)) !== null) {
      // match[2] is the hashtag (including #)
      matches.push(match[2].substring(1)); // Remove # prefix
    }

    // Deduplicate
    const tags = [...new Set(matches)];
    return tags;
  }

  handleEditorFocus(): void {
    this.isEditing = true;
  }

  handleEditorBlur(): void {
    this.isEditing = false;
    this.saveCurrentNote();
    // Don't call renderNotesList() here as it recreates the DOM and can interfere with click events
    // The notes list will be updated by handleEditorUpdate() when the title changes
  }

  updateUI(): void {
    const notesList = document.getElementById('notesList');
    const welcomeState = document.getElementById('welcomeState');
    const editorState = document.getElementById('editorState');

    if (!notesList || !welcomeState || !editorState) return;

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

  renderNotesList(): void {
    const notesList = document.getElementById('notesList');
    const notesCount = document.getElementById('notesCount');

    if (!notesList || !this.noteManager) return;

    // Get notes based on search query or all notes
    let filteredNotes = this.searchQuery ?
      this.noteManager.searchNotes(this.searchQuery) :
      this.notes;

    // Filter by folder (including "all-notes")
    if (this.currentFolderId) {
      // Pass sync directory ID to getNotesInFolder to filter correctly
      filteredNotes = this.noteManager.getNotesInFolder(this.currentFolderId, this.currentSyncDirectoryId || undefined);

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
    } else if (this.currentSyncDirectoryId) {
      // If no folder selected but sync directory is selected, filter by sync directory only
      filteredNotes = filteredNotes.filter(note => {
        return note.syncDirectoryId === this.currentSyncDirectoryId;
      });
    }

    // Filter by tag (include or exclude mode)
    if (this.tagFilterState) {
      const { tag, mode } = this.tagFilterState;
      if (mode === 'include') {
        // Include mode: show only notes WITH the tag
        filteredNotes = filteredNotes.filter(note =>
          note.tags && note.tags.includes(tag)
        );
      } else if (mode === 'exclude') {
        // Exclude mode: show only notes WITHOUT the tag
        filteredNotes = filteredNotes.filter(note =>
          !note.tags || !note.tags.includes(tag)
        );
      }
    }

    // Update notes count - show count in current folder view, filtered by sync directory
    if (notesCount) {
      if (this.currentFolderId && this.currentFolderId !== 'all-notes') {
        notesCount.textContent = this.noteManager.getNotesInFolder(this.currentFolderId, this.currentSyncDirectoryId || undefined).length.toString();
      } else {
        // For "all-notes", filter by current sync directory
        const allNotes = this.currentSyncDirectoryId
          ? this.notes.filter(note => note.syncDirectoryId === this.currentSyncDirectoryId)
          : this.notes;
        notesCount.textContent = allNotes.length.toString();
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

    // Add Empty Trash button if in trash view and there are notes
    const emptyTrashButton = isTrashView && filteredNotes.length > 0 ? `
      <div style="padding: 8px; border-bottom: 1px solid var(--border-color);">
        <button class="empty-trash-btn" onclick="app.emptyTrash()" style="width: 100%; padding: 8px; background-color: var(--danger-color, #dc3545); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
          Empty Trash (${filteredNotes.length})
        </button>
      </div>
    ` : '';

    notesList.innerHTML = emptyTrashButton + filteredNotes.map(note => {
      const isActive = this.currentNote?.id === note.id;
      const isSelected = this.selectedNoteIds.has(note.id);
      const classes = ['note-item'];
      if (isActive) classes.push('active');
      if (isSelected) classes.push('selected');

      return `
      <div class="${classes.join(' ')}"
           ${!isTrashView ? 'draggable="true"' : 'draggable="true"'}
           data-note-id="${note.id}"
           ${!isTrashView ? 'ondragstart="app.handleNoteDragStart(event)" ondragend="app.handleNoteDragEnd(event)"' : 'ondragstart="app.handleTrashNoteDragStart(event)" ondragend="app.handleNoteDragEnd(event)"'}>
        <div class="note-title">
          ${escapeHtml(note.title || 'Untitled')}
          ${this.noteGaps.has(note.id) ? '<span class="sync-status-icon" title="Syncing...">⚠️</span>' : ''}
        </div>
        <div class="note-preview">${getPreview(note.content, 60)}</div>
        <div class="note-meta">${formatDate(note.modified)}</div>
        ${isTrashView ? `
          <div class="note-actions" onclick="event.stopPropagation()">
            <button class="note-action-btn restore-btn" onclick="app.restoreNote('${note.id}')" title="Restore">↩️</button>
            <button class="note-action-btn delete-btn" onclick="app.permanentlyDeleteNote('${note.id}')" title="Delete Forever">🗑️</button>
          </div>
        ` : ''}
      </div>
    `}).join('');

    // Update selection badge to reflect current state after re-render
    this.updateSelectionBadge();

    // Note: Click event listeners are set up once using event delegation in initializeEventListeners()
    // No need to add individual listeners here, which prevents race conditions when DOM is recreated
  }

  /**
   * Update gap indicators for a note
   * @param noteId - Note ID
   */
  updateGapIndicators(noteId: string): void {
    // Update note list (will show/hide gap icon)
    this.renderNotesList();

    // Update editor status bar if this note is currently open
    if (this.currentNote && this.currentNote.id === noteId) {
      this.updateEditorStatusBar();
    }
  }

  /**
   * Update the editor status bar with gap information
   */
  updateEditorStatusBar(): void {
    // Find or create editor status bar
    const editorSection = document.querySelector('.editor-section');
    if (!editorSection) return;

    let statusBar = editorSection.querySelector('.editor-status-bar') as HTMLElement;
    if (!statusBar) {
      // Create status bar if it doesn't exist
      statusBar = document.createElement('div');
      statusBar.className = 'editor-status-bar';
      editorSection.appendChild(statusBar);
    }

    // Clear existing content
    statusBar.innerHTML = '';

    // Add gap indicator if current note has gaps
    if (this.currentNote && this.noteGaps.has(this.currentNote.id)) {
      const summary = this.noteGaps.get(this.currentNote.id)!;
      const tooltipText = this.buildGapTooltip(summary);

      const gapIndicator = document.createElement('div');
      gapIndicator.className = 'gap-indicator';
      gapIndicator.title = tooltipText;
      gapIndicator.innerHTML = `
        <span class="status-icon warning" title="${tooltipText}">⚠️</span>
        <span class="status-text" title="${tooltipText}">Syncing... (waiting for updates)</span>
      `;
      statusBar.appendChild(gapIndicator);
    }
  }

  /**
   * Build tooltip text for gap indicator
   * @param summary - Gap summary
   * @returns Tooltip text
   */
  buildGapTooltip(summary: GapSummary): string {
    const lines = ['Waiting for updates:'];
    summary.instances.forEach(inst => {
      const deviceName = inst.instanceId.substring(9, 17); // Show 8 chars
      lines.push(`• Device ${deviceName}: ${inst.missing} updates missing`);
    });
    lines.push(`\nLast checked: ${new Date(summary.lastChecked).toLocaleTimeString()}`);
    return lines.join('\n');
  }

  /**
   * Render tags list with counts
   */
  renderTagsList(): void {
    const tagsList = document.getElementById('tagsList');
    if (!tagsList) return;

    // Update clear button visibility
    const clearBtn = document.getElementById('clearTagFilterBtn');
    if (clearBtn) {
      clearBtn.style.display = this.tagFilterState ? 'block' : 'none';
    }

    // Collect all tags with counts
    const tagCounts = new Map<string, number>();
    this.notes.forEach(note => {
      if (note.tags && note.tags.length > 0) {
        note.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });

    // Sort tags alphabetically
    let sortedTags = Array.from(tagCounts.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    // Filter by search query if present
    if (this.tagSearchQuery) {
      sortedTags = sortedTags.filter(([tag]) =>
        tag.toLowerCase().includes(this.tagSearchQuery)
      );
    }

    if (sortedTags.length === 0) {
      tagsList.innerHTML = `
        <div style="padding: 8px; text-align: center; color: var(--text-secondary); font-size: 12px;">
          ${this.tagSearchQuery ? 'No matching tags' : 'No tags yet'}
        </div>
      `;
      return;
    }

    tagsList.innerHTML = sortedTags.map(([tag, count]) => {
      // Determine if this tag is active and what mode
      const isActive = this.tagFilterState && this.tagFilterState.tag === tag;
      const isExclude = isActive && this.tagFilterState && this.tagFilterState.mode === 'exclude';
      const isInclude = isActive && this.tagFilterState && this.tagFilterState.mode === 'include';

      return `
        <div class="tag-item ${isInclude ? 'active' : ''} ${isExclude ? 'tag-exclude' : ''}"
             data-tag="${escapeHtml(tag)}">
          <span class="tag-name" style="${isExclude ? 'text-decoration: line-through;' : ''}">#${escapeHtml(tag)}</span>
          <span class="tag-count">${count}</span>
        </div>
      `;
    }).join('');

    // Add click event listeners
    const tagItems = tagsList.querySelectorAll('.tag-item');
    tagItems.forEach(item => {
      item.addEventListener('click', () => {
        const tag = (item as HTMLElement).dataset.tag;
        if (tag) {
          this.selectTag(tag);
        }
      });
    });
  }

  /**
   * Select a tag to filter notes
   * Three-state cycling: null → include → exclude → null
   * @param tag - Tag to filter by
   */
  selectTag(tag: string): void {
    // Cycle through three states:
    // 1. null (no filter) → include (show only notes WITH tag)
    // 2. include → exclude (show only notes WITHOUT tag)
    // 3. exclude → null (clear filter)

    if (!this.tagFilterState || this.tagFilterState.tag !== tag) {
      // State 1: null → include
      this.tagFilterState = { tag, mode: 'include' };
    } else if (this.tagFilterState.mode === 'include') {
      // State 2: include → exclude
      this.tagFilterState = { tag, mode: 'exclude' };
    } else {
      // State 3: exclude → null
      this.tagFilterState = null;
    }

    this.renderTagsList();
    this.renderNotesList();
  }

  /**
   * Clear the active tag filter
   */
  clearTagFilter(): void {
    this.tagFilterState = null;
    this.renderTagsList();
    this.renderNotesList();
  }

  /**
   * Render backlinks panel showing notes that link to the current note
   */
  renderBacklinks(): void {
    console.log('[renderBacklinks] Called');
    const backlinksPanel = document.getElementById('backlinksPanel');
    const backlinksList = document.getElementById('backlinksList');
    const backlinksCount = document.getElementById('backlinksCount');

    console.log('[renderBacklinks] Elements:', {
      panel: !!backlinksPanel,
      list: !!backlinksList,
      count: !!backlinksCount,
      noteManager: !!this.noteManager,
      currentNote: !!this.currentNote,
      currentNoteId: this.currentNote?.id,
      currentNoteTitle: this.currentNote?.title
    });

    if (!backlinksPanel || !backlinksList || !backlinksCount || !this.noteManager || !this.currentNote) {
      console.log('[renderBacklinks] Missing required elements, returning early');
      return;
    }

    // Get backlinks for the current note
    console.log('[renderBacklinks] Getting backlinks for note:', this.currentNote.id);
    const backlinks = this.noteManager.getBacklinks(this.currentNote.id);
    console.log('[renderBacklinks] Got', backlinks.length, 'backlinks');

    // Update count
    backlinksCount.textContent = backlinks.length.toString();

    // Show/hide panel based on whether there are backlinks
    if (backlinks.length === 0) {
      backlinksPanel.style.display = 'none';
      return;
    }

    backlinksPanel.style.display = 'block';

    // Render backlinks
    backlinksList.innerHTML = backlinks.map(({ note, context }) => `
      <div class="backlink-item" data-note-id="${note.id}">
        <div class="backlink-item-title">${escapeHtml(note.title)}</div>
        <div class="backlink-item-context">${escapeHtml(context)}</div>
      </div>
    `).join('');

    // Add click handlers
    backlinksList.querySelectorAll('.backlink-item').forEach(item => {
      item.addEventListener('click', () => {
        const noteId = (item as HTMLElement).dataset.noteId;
        if (noteId) {
          this.selectNote(noteId);
        }
      });
    });
  }

  /**
   * Setup hover preview for note links
   */
  setupNoteLinkHoverPreview(): void {
    const preview = document.getElementById('noteLinkPreview');
    if (!preview) return;

    const previewTitle = preview.querySelector('.note-link-preview-title') as HTMLElement;
    const previewContent = preview.querySelector('.note-link-preview-content') as HTMLElement;
    if (!previewTitle || !previewContent) return;

    let hoverTimeout: NodeJS.Timeout | null = null;
    let currentLink: Element | null = null;

    // Use event delegation on the editor
    const editor = document.getElementById('editor');
    if (!editor) return;

    editor.addEventListener('mouseover', (e) => {
      const target = e.target as HTMLElement;

      // Check if hovering over a note link
      const noteLink = target.closest('[data-note-link]');
      if (!noteLink) {
        // Not hovering over a link, hide preview
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
          hoverTimeout = null;
        }
        preview.classList.remove('visible');
        preview.style.display = 'none';
        currentLink = null;
        return;
      }

      // Same link, don't update
      if (noteLink === currentLink) return;
      currentLink = noteLink;

      // Clear any existing timeout
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }

      // Show preview after short delay
      hoverTimeout = setTimeout(() => {
        const noteId = noteLink.getAttribute('data-note-id');
        const noteTitle = noteLink.getAttribute('data-note-title') || noteLink.textContent || '';

        if (!noteId && !noteTitle) return;

        // Get the note
        let note: Note | undefined;
        if (noteId) {
          note = this.noteManager?.getNote(noteId);
        }
        if (!note && noteTitle) {
          // Try to find by title
          const allNotes = this.noteManager?.getAllNotes() || [];
          note = allNotes.find(n => n.title === noteTitle);
        }

        if (!note) {
          previewTitle.textContent = noteTitle;
          previewContent.textContent = 'Note not found';
        } else {
          previewTitle.textContent = note.title;

          // Get note content (strip HTML tags for preview)
          let content = note.content || '';

          // In Electron mode, try to get from CRDT
          if (this.isElectron && this.syncManager) {
            try {
              const yDoc = this.syncManager.crdtManager.getContentDoc(note.id);
              const yContent = yDoc.getXmlFragment('default');
              content = yContent.toString();
            } catch (error) {
              // Fall back to note.content
            }
          }

          // Normalize content: strip markup and normalize whitespace
          content = normalizeTextContent(content);
          const maxLength = 300;
          if (content.length > maxLength) {
            content = content.substring(0, maxLength) + '...';
          }

          previewContent.textContent = content || '(Empty note)';
        }

        // Position the preview near the cursor
        const rect = noteLink.getBoundingClientRect();
        const x = rect.left;
        const y = rect.bottom + 8; // 8px below the link

        // Check if preview would go off screen
        const previewWidth = 400; // max-width from CSS
        const previewHeight = 250; // estimated max height

        let finalX = x;
        let finalY = y;

        // Adjust horizontal position if needed
        if (x + previewWidth > window.innerWidth) {
          finalX = window.innerWidth - previewWidth - 16;
        }

        // Adjust vertical position if needed (show above if not enough space below)
        if (y + previewHeight > window.innerHeight) {
          finalY = rect.top - previewHeight - 8;
        }

        preview.style.left = `${finalX}px`;
        preview.style.top = `${finalY}px`;
        preview.style.display = 'block';

        // Trigger reflow to enable transition
        preview.offsetHeight;
        preview.classList.add('visible');
      }, 300); // 300ms delay before showing
    });

    // Hide preview when mouse leaves editor
    editor.addEventListener('mouseleave', () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
      preview.classList.remove('visible');
      preview.style.display = 'none';
      currentLink = null;
    });
  }

  async renderCurrentNote(scrollToTop: boolean = true): Promise<void> {
    if (!this.currentNote) return;

    // Prevent concurrent calls - wait for previous render to complete
    if (this._isRendering) {
      console.log('[renderer] renderCurrentNote() already in progress, skipping duplicate call');
      return;
    }
    this._isRendering = true;

    console.log(`[renderer] renderCurrentNote() called for note:`, {
      id: this.currentNote.id,
      title: this.currentNote.title,
      hasContent: !!this.currentNote.content,
      contentLength: this.currentNote.content?.length
    });

    // Always update editor content when switching notes
    if (this.editor) {
      // Set flag to prevent handleEditorUpdate from firing during programmatic content change
      this.isSettingContent = true;

      // In Electron mode with CRDT, bind editor to CONTENT Y.Doc
      // IMPORTANT: Pass only content Y.Doc to TipTap, not metadata doc
      // This prevents our metadata updates from interfering with TipTap's cursor tracking
      if (this.isElectron && this.syncManager) {
        const yDoc = this.syncManager.crdtManager.getContentDoc(this.currentNote.id);

        // Initialize the Y.Doc with metadata if it's empty
        // This ensures sample notes and new notes have proper metadata
        const isEmpty = this.syncManager.crdtManager.isDocEmpty(this.currentNote.id);
        console.log(`[renderer] Y.Doc isEmpty: ${isEmpty}`);
        if (isEmpty) {
          // Extract title from HTML content if available (for sample notes)
          // This ensures we use the original title from the HTML, not a potentially modified one
          let noteToInitialize = { ...this.currentNote };

          // DEBUG: Log before extraction
          const debugInfo = {
            noteId: this.currentNote.id,
            originalTitle: this.currentNote.title,
            hasContent: !!this.currentNote.content,
            contentLength: this.currentNote.content?.length,
            hasH1: this.currentNote.content?.includes('<h1>'),
            contentPreview: this.currentNote.content?.substring(0, 100)
          };
          console.log('[renderer] DEBUG before title extraction:', JSON.stringify(debugInfo));

          if (noteToInitialize.content && noteToInitialize.content.includes('<h1>')) {
            const h1Match = noteToInitialize.content.match(/<h1[^>]*>(.*?)<\/h1>/);
            if (h1Match) {
              noteToInitialize.title = h1Match[1];
              console.log('[renderer] Extracted title from HTML:', noteToInitialize.title);
            }
          }

          console.log('[renderer] Initializing Y.Doc with note:', {
            id: noteToInitialize.id,
            title: noteToInitialize.title
          });
          this.syncManager.crdtManager.initializeNote(this.currentNote.id, noteToInitialize);
          // Wait a moment for the async update listener to process
          await new Promise(resolve => setTimeout(resolve, 10));
          // Flush metadata FIRST before binding editor
          console.log('[renderer] Flushing metadata before binding editor');
          await this.syncManager.updateStore.flush(this.currentNote.id);

          // Update the note object in noteManager Map with the CRDT title
          // This ensures the notes list shows the correct title
          const crdtTitle = this.syncManager.crdtManager.getMetadataDoc(this.currentNote.id).getMap('metadata').get('title') as string;
          console.log('[renderer] Checking if note title needs sync - CRDT:', crdtTitle, 'Note:', this.currentNote.title);
          if (crdtTitle) {
            console.log('[renderer] Syncing note object title from CRDT:', crdtTitle);
            this.currentNote.title = crdtTitle;
            // IMPORTANT: Update the actual note object in the Map, not just currentNote reference
            const noteInMap = this.noteManager!.notes.get(this.currentNote.id);
            if (noteInMap) {
              noteInMap.title = crdtTitle;
            }
            // Update the notes list to show correct title
            this.renderNotesList();
          }

          // Now bind editor
          console.log('[renderer] Binding editor to Y.Doc');
          this.editor.setDocument(yDoc, this.currentNote.id);

          // If the note has HTML content (e.g., sample notes), set it after binding
          if (this.currentNote.content && this.currentNote.content !== '<p></p>') {
            console.log('[renderer] Setting HTML content to editor, length:', this.currentNote.content.length);
            // Set the HTML content - TipTap will convert it to Y.XmlFragment
            this.editor.setContent(this.currentNote.content, this.currentNote.id);
            // Flush content updates
            console.log('[renderer] Flushing content updates');
            await this.syncManager.updateStore.flush(this.currentNote.id);
          }
        } else {
          console.log('[renderer] Y.Doc not empty, just binding editor');
          this.editor.setDocument(yDoc, this.currentNote.id);
        }
      } else {
        // Web mode: use HTML content
        this.editor.setContent(this.currentNote.content || '', this.currentNote.id);
      }

      // Don't clear isSettingContent here - wait for editor's onReady callback
      // this.isSettingContent = false;

      // Only focus editor if search input doesn't have focus
      const searchInput = document.querySelector('.search-input') as HTMLInputElement;
      if (!searchInput || document.activeElement !== searchInput) {
        this.editor.focus();
      }

      // Scroll to top of editor container only when switching notes
      if (scrollToTop) {
        setTimeout(() => {
          const editorContainer = document.querySelector('.editor-container') as HTMLElement;
          if (editorContainer) {
            editorContainer.scrollTop = 0;
          }
        }, 0);
      }
    }
  }

  async createNewNote(): Promise<void> {
    const previousNote = this.currentNote;

    // Save the current note before creating a new one (critical for Electron mode)
    if (previousNote) {
      await this.saveCurrentNote();
    }

    // Create note in the currently selected folder and sync directory
    // IMPORTANT: Await to ensure CRDT initialization completes before rendering
    const newNote = await this.noteManager!.createNote({
      folderId: (this.currentFolderId && this.currentFolderId !== 'all-notes') ? this.currentFolderId : '',
      syncDirectoryId: this.currentSyncDirectoryId || undefined
    });

    this.currentNote = newNote;
    this.isEditing = false; // Reset editing state to ensure editor gets cleared

    // In Electron mode, flush the new note immediately to ensure it's persisted
    // The Y.Doc is now fully initialized, so all subsequent updates will be captured
    if (this.isElectron) {
      // Get the correct sync manager for this note's directory
      const syncManager = this.noteManager!.getSyncManagerForNote(newNote.id);
      if (syncManager) {
        await syncManager.updateStore.flush(newNote.id);
      }
    }

    // Don't call updateUI() here as it recreates the DOM and can interfere with click events
    // Instead, just update what's needed:

    // 1. Add the new note to the notes list (uses event delegation for clicks)
    this.renderNotesList();
    this.renderTagsList();
    this.renderFolderTree(); // Update folder counts

    // 2. Update editor content
    await this.renderCurrentNote();

    // 3. Show editor state if it's hidden
    const welcomeState = document.getElementById('welcomeState');
    const editorState = document.getElementById('editorState');
    if (this.currentNote) {
      if (welcomeState) welcomeState.style.display = 'none';
      if (editorState) editorState.style.display = 'flex';
    }

    // Focus on editor after DOM updates complete
    setTimeout(() => {
      if (this.editor) {
        this.editor.focus();
      }
    }, 100);
  }

  async createNewFolder(): Promise<void> {
    if (!this.folderManager) return;

    // Get the appropriate folder manager for the current sync directory
    let folderManager = this.folderManager; // Default to primary
    if (this.noteManager && this.currentSyncDirectoryId) {
      const syncDirFolderManager = this.noteManager.getFolderManagerForDirectory(this.currentSyncDirectoryId);
      if (syncDirFolderManager) {
        folderManager = syncDirFolderManager;
      }
    }

    // Determine parent folder
    let parentId = 'root';
    let parentName: string | null = null;

    // If a custom folder is selected (not special folders), offer to create subfolder
    if (this.currentFolderId && this.currentFolderId !== 'all-notes' && this.currentFolderId !== 'trash') {
      const currentFolder = folderManager.getFolder(this.currentFolderId);
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
      const folder = await folderManager.createFolder(folderName, parentId);
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

  showInputDialog(title: string, message: string, defaultValue: string = ''): Promise<string | null> {
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

      const input = dialog.querySelector('#dialogInput') as HTMLInputElement;
      const okBtn = dialog.querySelector('#dialogOk') as HTMLButtonElement;
      const cancelBtn = dialog.querySelector('#dialogCancel') as HTMLButtonElement;

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

  renderFolderTree(): void {
    const folderTree = document.getElementById('folderTree');
    if (!folderTree || !this.folderManager) return;

    const syncDirs = this.syncDirectoryManager.getDirectories();

    // Render sync directories with grouping
    let html = '';
    for (const syncDir of syncDirs) {
      const isExpanded = syncDir.isExpanded;

      html += `
        <div class="sync-directory-group" data-sync-dir-id="${syncDir.id}">
          <div class="sync-directory-header"
               onclick="app.toggleSyncDirectory('${syncDir.id}')"
               style="
                 padding: 8px 12px;
                 display: flex;
                 align-items: center;
                 gap: 8px;
                 cursor: pointer;
                 font-weight: 600;
                 color: var(--text-primary);
                 background: var(--surface);
                 border-radius: 4px;
                 margin-bottom: 4px;
                 user-select: none;
               ">
            <span class="collapse-arrow">${isExpanded ? '▼' : '▶'}</span>
            <span style="font-size: 18px;">💼</span>
            <span>${escapeHtml(syncDir.name)}</span>
          </div>
          ${isExpanded ? this.renderFoldersForSyncDirectory(syncDir.id) : ''}
        </div>
      `;
    }

    folderTree.innerHTML = html;
  }

  /**
   * Render folders for a specific sync directory
   */
  renderFoldersForSyncDirectory(syncDirId: string): string {
    if (!this.noteManager) return '';

    // Get the folder manager for this specific sync directory
    const folderManager = this.noteManager.getFolderManagerForDirectory(syncDirId);
    if (!folderManager) {
      console.warn(`No FolderManager found for sync directory ${syncDirId}`);
      return '';
    }

    const tree = folderManager.getFolderTree();
    return `<div class="sync-directory-folders">${this.renderFolderItems(tree, 0, syncDirId)}</div>`;
  }

  /**
   * Toggle sync directory expand/collapse
   */
  async toggleSyncDirectory(syncDirId: string): Promise<void> {
    await this.syncDirectoryManager.toggleExpanded(syncDirId);
    this.renderFolderTree();
  }

  renderFolderItems(folders: Folder[] | undefined, level: number = 0, syncDirId?: string): string {
    if (!folders || folders.length === 0) return '';

    // Get the appropriate folder manager
    const folderManager = syncDirId && this.noteManager
      ? this.noteManager.getFolderManagerForDirectory(syncDirId) || this.folderManager
      : this.folderManager;

    return folders.map(folder => {
      const indent = level * 16;
      const icon = folder.icon || '📁';
      const hasChildren = folder.children && folder.children.length > 0;
      const isExpanded = folderManager.isFolderExpanded(folder.id);
      // Only highlight if both folder ID and sync directory ID match
      const isActive = this.currentFolderId === folder.id &&
                       this.currentSyncDirectoryId === syncDirId;
      const isDraggable = !folder.isSpecial && !folder.isRoot;

      // Show collapse arrow only if folder has children
      const collapseArrow = hasChildren
        ? `<span class="folder-collapse-arrow" onclick="event.stopPropagation(); app.toggleFolderCollapse('${folder.id}')">${isExpanded ? '▼' : '▶'}</span>`
        : '<span class="folder-collapse-arrow" style="visibility: hidden;">▼</span>';

      // Get note count for this folder (direct children only), filtered by sync directory
      const noteCount = this.noteManager!.getNotesInFolder(folder.id, syncDirId).length;

      return `
        <div class="folder-item ${isActive ? 'active' : ''} ${isDraggable ? 'folder-item-custom' : ''}"
             style="padding-left: ${indent + 8}px"
             data-folder-id="${folder.id}"
             ${isDraggable ? 'draggable="true"' : ''}
             ${isDraggable ? 'ondragstart="app.handleFolderDragStart(event)"' : ''}
             ${isDraggable ? 'ondragend="app.handleFolderDragEnd(event)"' : ''}
             onclick="app.selectFolder('${folder.id}', '${syncDirId || ''}')"
             ondragover="app.handleFolderDragOver(event)"
             ondragleave="app.handleFolderDragLeave(event)"
             ondrop="app.handleFolderDrop(event)">
          ${collapseArrow}
          <span class="folder-icon">${icon}</span>
          <span class="folder-name">${escapeHtml(folder.name)}</span>
          <span class="folder-count">${noteCount}</span>
        </div>
        ${hasChildren && isExpanded ? this.renderFolderItems(folder.children, level + 1, syncDirId) : ''}
      `;
    }).join('');
  }

  selectFolder(folderId: string, syncDirId?: string): void {
    this.currentFolderId = folderId;
    this.currentSyncDirectoryId = syncDirId || null;
    this.clearSelection(); // Clear multi-select when changing folders
    this.renderFolderTree();
    this.updateUI();
  }

  /**
   * Toggle folder collapse/expand state
   * @param folderId - Folder ID to toggle
   */
  toggleFolderCollapse(folderId: string): void {
    this.folderManager.toggleFolderExpanded(folderId);
  }

  /**
   * Find a note by title (used by note link extension)
   * @param title - Note title to search for
   * @returns Note object with id and title, or null if not found
   */
  findNoteByTitle(title: string): { id: string; title: string } | null {
    if (!this.noteManager) return null;

    const notes = this.noteManager.getAllNotes();
    const foundNote = notes.find(note =>
      !note.deleted && note.title.toLowerCase() === title.toLowerCase()
    );

    return foundNote ? { id: foundNote.id, title: foundNote.title } : null;
  }

  /**
   * Search for notes matching a query string (for autocomplete)
   * Returns notes sorted by relevance
   */
  searchNotes(query: string): { id: string; title: string }[] {
    if (!this.noteManager) return [];

    console.log('[searchNotes] Query:', JSON.stringify(query), 'Length:', query.length);

    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) {
      // No query - return recent notes
      const notes = this.noteManager.getAllNotes();
      const results = notes
        .filter(note => !note.deleted)
        .sort((a, b) => new Date(b.modified || b.created).getTime() - new Date(a.modified || a.created).getTime())
        .slice(0, 10)
        .map(note => ({ id: note.id, title: note.title }));
      console.log('[searchNotes] No query - returning', results.length, 'recent notes');
      return results;
    }

    // Search for notes matching the query
    const notes = this.noteManager.getAllNotes();
    console.log('[searchNotes] Searching', notes.length, 'notes for:', lowerQuery);
    const matches = notes
      .filter(note => {
        if (note.deleted) return false;
        return note.title.toLowerCase().includes(lowerQuery);
      })
      .map(note => {
        // Calculate relevance score
        const titleLower = note.title.toLowerCase();
        let score = 0;

        // Exact match gets highest score
        if (titleLower === lowerQuery) {
          score = 1000;
        }
        // Starts with query gets high score
        else if (titleLower.startsWith(lowerQuery)) {
          score = 100;
        }
        // Contains query gets medium score
        else {
          score = 10;
        }

        // Boost score for recently modified notes
        const daysSinceModified = (Date.now() - new Date(note.modified || note.created).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceModified < 7) {
          score += 5;
        }

        return {
          id: note.id,
          title: note.title,
          score
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ id, title }) => ({ id, title }));

    console.log('[searchNotes] Found', matches.length, 'matches:', matches.map(m => m.title));
    return matches;
  }

  /**
   * Validate a note link (check if target note exists)
   * @param noteId - Note ID (preferred)
   * @param title - Note title (fallback)
   * @returns true if the note exists and is not deleted, false otherwise
   */
  validateNoteLink(noteId: string | null, title: string): boolean {
    if (!this.noteManager) return false;

    // Try to validate by ID first (most reliable)
    if (noteId) {
      const note = this.noteManager.getNote(noteId);
      return note !== null && !note.deleted;
    }

    // Fallback: validate by title
    const foundNote = this.findNoteByTitle(title);
    return foundNote !== null;
  }

  /**
   * Handle clicking on a note link in the editor
   * Navigates to the linked note using ID (preferred) or title (fallback)
   */
  async handleNoteLinkClick(noteId: string | null, noteTitle: string): Promise<void> {
    if (!this.noteManager) return;

    console.log(`[NoteLink] Clicked link:`, { noteId, noteTitle });

    // Try to navigate by ID first (most reliable)
    if (noteId) {
      const note = this.noteManager.getNote(noteId);
      if (note && !note.deleted) {
        console.log(`[NoteLink] Found note by ID:`, { id: note.id, title: note.title });
        await this.selectNote(noteId);
        return;
      } else {
        console.warn(`[NoteLink] Note ID ${noteId} not found or deleted, trying title...`);
      }
    }

    // Fallback: find by title (case-insensitive)
    const foundNote = this.findNoteByTitle(noteTitle);
    if (foundNote) {
      console.log(`[NoteLink] Found note by title:`, foundNote);
      await this.selectNote(foundNote.id);
    } else {
      console.warn(`[NoteLink] Note not found: "${noteTitle}"`);
      // Could optionally show a notification to the user
    }
  }

  /**
   * Handle note click with multi-select support
   */
  handleNoteClick(noteId: string, event: MouseEvent): void {
    const isCtrlOrCmd = event.ctrlKey || event.metaKey;
    const isShift = event.shiftKey;

    if (isCtrlOrCmd) {
      // Cmd/Ctrl + Click: Toggle selection
      this.toggleNoteSelection(noteId);
    } else if (isShift) {
      // Shift + Click: Range selection
      this.rangeSelectNotes(noteId);
    } else {
      // Regular click: Clear selection and select single note
      this.clearSelection();
      this.selectNote(noteId);
    }
  }

  /**
   * Toggle selection of a single note
   */
  toggleNoteSelection(noteId: string): void {
    // If starting a new multi-select and clicking a different note than the active one,
    // automatically include the active note in the selection
    // BUT only if the active note is not in trash and exists in the current filtered view
    if (this.selectedNoteIds.size === 0 && this.currentNote && noteId !== this.currentNote.id) {
      const activeNoteInFilteredView = this.getFilteredNotes().some(n => n.id === this.currentNote!.id);
      if (activeNoteInFilteredView) {
        this.selectedNoteIds.add(this.currentNote.id);
      }
    }

    if (this.selectedNoteIds.has(noteId)) {
      this.selectedNoteIds.delete(noteId);
    } else {
      this.selectedNoteIds.add(noteId);
    }

    this.isMultiSelectMode = this.selectedNoteIds.size > 0;
    this.lastSelectedNoteId = noteId;

    this.updateSelectionUI();
  }

  /**
   * Select range of notes from last selected to current
   */
  rangeSelectNotes(noteId: string): void {
    if (!this.noteManager) return;

    const visibleNotes = this.getFilteredNotes();
    const noteIds = visibleNotes.map(n => n.id);

    const currentIndex = noteIds.indexOf(noteId);
    const lastIndex = this.lastSelectedNoteId ? noteIds.indexOf(this.lastSelectedNoteId) : -1;

    if (currentIndex === -1) return;

    // If starting a new range selection, auto-include the active note
    if (lastIndex === -1 && this.currentNote && noteId !== this.currentNote.id) {
      this.selectedNoteIds.add(this.currentNote.id);
      const activeNoteIndex = noteIds.indexOf(this.currentNote.id);
      if (activeNoteIndex !== -1) {
        // Range select from active note to clicked note
        const startIndex = Math.min(currentIndex, activeNoteIndex);
        const endIndex = Math.max(currentIndex, activeNoteIndex);
        for (let i = startIndex; i <= endIndex; i++) {
          this.selectedNoteIds.add(noteIds[i]);
        }
        this.lastSelectedNoteId = noteId;
      }
    } else if (lastIndex === -1) {
      // No active note or clicking the active note, just select this one
      this.selectedNoteIds.clear();
      this.selectedNoteIds.add(noteId);
      this.lastSelectedNoteId = noteId;
    } else {
      // Select all notes in range
      const startIndex = Math.min(currentIndex, lastIndex);
      const endIndex = Math.max(currentIndex, lastIndex);

      for (let i = startIndex; i <= endIndex; i++) {
        this.selectedNoteIds.add(noteIds[i]);
      }
    }

    this.isMultiSelectMode = this.selectedNoteIds.size > 0;
    this.updateSelectionUI();
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.selectedNoteIds.clear();
    this.isMultiSelectMode = false;
    this.lastSelectedNoteId = null;
    this.updateSelectionUI();
  }

  /**
   * Select all visible notes
   */
  selectAllNotes(): void {
    const visibleNotes = this.getFilteredNotes();
    this.selectedNoteIds.clear();
    visibleNotes.forEach(note => this.selectedNoteIds.add(note.id));
    this.isMultiSelectMode = this.selectedNoteIds.size > 0;

    if (visibleNotes.length > 0) {
      this.lastSelectedNoteId = visibleNotes[visibleNotes.length - 1].id;
    }

    this.updateSelectionUI();
  }

  /**
   * Update UI to reflect current selection state
   */
  updateSelectionUI(): void {
    // Update note item styling
    const noteItems = document.querySelectorAll('.note-item');
    noteItems.forEach(item => {
      const noteId = (item as HTMLElement).dataset.noteId;
      if (noteId && this.selectedNoteIds.has(noteId)) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });

    // Update selection badge
    this.updateSelectionBadge();
  }

  /**
   * Update the floating selection count badge
   */
  updateSelectionBadge(): void {
    let badge = document.getElementById('selectionBadge');

    // Show badge when 1+ notes are selected
    if (this.selectedNoteIds.size >= 1) {
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'selectionBadge';
        badge.className = 'selection-badge';
        document.body.appendChild(badge);
      }
      const text = this.selectedNoteIds.size === 1
        ? '1 note selected'
        : `${this.selectedNoteIds.size} notes selected`;
      badge.textContent = text;
      badge.style.display = 'block';
    } else if (badge) {
      badge.style.display = 'none';
    }
  }

  /**
   * Get filtered notes based on current folder/search/tag filters
   */
  getFilteredNotes(): Note[] {
    if (!this.noteManager) return [];

    let filteredNotes: Note[];

    // Filter by folder
    if (this.currentFolderId === 'all-notes') {
      filteredNotes = this.noteManager.getAllNotes();
    } else if (this.currentFolderId === 'trash') {
      filteredNotes = Array.from(this.noteManager['notes'].values())
        .filter(note => note.deleted)
        .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    } else {
      filteredNotes = this.noteManager.getNotesInFolder(this.currentFolderId, this.currentSyncDirectoryId || undefined);
    }

    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filteredNotes = filteredNotes.filter(note =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
      );
    }

    // Apply tag filter
    if (this.tagFilterState) {
      const { tag, mode } = this.tagFilterState;
      filteredNotes = filteredNotes.filter(note => {
        const hasTags = note.tags && note.tags.length > 0;
        const hasTag = hasTags && note.tags!.includes(tag);
        return mode === 'include' ? hasTag : !hasTag;
      });
    }

    return filteredNotes;
  }

  /**
   * Show context menu for notes
   */
  showNoteContextMenu(event: MouseEvent, noteId: string): void {
    // If right-clicking an unselected note, clear selection and select only that note
    // If right-clicking a selected note, keep current selection
    if (!this.selectedNoteIds.has(noteId)) {
      this.selectedNoteIds.clear();
      this.selectedNoteIds.add(noteId);
      this.isMultiSelectMode = true;
      this.lastSelectedNoteId = noteId;
      this.updateSelectionUI();
    }

    const menu = document.getElementById('noteContextMenu');
    if (!menu) return;

    // Update delete menu text based on selection count
    const deleteText = document.getElementById('deleteMenuText');
    if (deleteText) {
      if (this.selectedNoteIds.size > 1) {
        deleteText.textContent = `Delete ${this.selectedNoteIds.size} notes`;
      } else {
        deleteText.textContent = 'Delete';
      }
    }

    // Position menu at mouse location
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.style.display = 'block';
  }

  /**
   * Hide note context menu
   */
  hideNoteContextMenu(): void {
    const menu = document.getElementById('noteContextMenu');
    if (menu) {
      menu.style.display = 'none';
    }
  }

  /**
   * Handle note context menu actions
   */
  async handleNoteContextMenuAction(action: string): Promise<void> {
    this.hideNoteContextMenu();

    switch (action) {
      case 'new':
        this.createNewNote();
        break;

      case 'delete':
        await this.deleteSelectedNotes();
        break;

      case 'move':
        this.showFolderPicker('move');
        break;

      case 'duplicate':
        this.showFolderPicker('duplicate');
        break;

      default:
        console.warn('Unknown note context menu action:', action);
    }
  }

  /**
   * Delete all selected notes (move to trash)
   */
  async deleteSelectedNotes(): Promise<void> {
    if (!this.noteManager || this.selectedNoteIds.size === 0) return;

    const noteIds = Array.from(this.selectedNoteIds);

    for (const noteId of noteIds) {
      const note = this.noteManager.getNote(noteId);
      if (note && !note.deleted) {
        note.deleted = true;
        note.modified = new Date().toISOString();
        await this.noteManager.saveNote(note);
      }
    }

    // Clear selection
    this.clearSelection();

    // Refresh notes from manager
    this.notes = this.noteManager.getAllNotes();

    // Refresh notes list
    this.renderNotesList();

    // If current note was deleted, clear editor
    if (this.currentNote && noteIds.includes(this.currentNote.id)) {
      this.currentNote = null;
      if (this.editor) {
        this.editor.commands.setContent('');
      }
    }
  }

  /**
   * Show folder picker modal for moving or duplicating notes
   */
  showFolderPicker(action: 'move' | 'duplicate'): void {
    const modal = document.getElementById('folderPickerModal');
    const title = document.getElementById('folderPickerTitle');

    if (!modal || !title) return;

    // Store the action for later use
    (modal as any).dataset.action = action;

    // Update modal title based on action and selection count
    const selectedCount = this.selectedNoteIds.size;
    let titleText = '';

    if (action === 'move') {
      if (selectedCount === 1) {
        titleText = 'Move to Folder';
      } else {
        titleText = `Move ${selectedCount} Notes to Folder`;
      }
    } else {
      if (selectedCount === 1) {
        titleText = 'Duplicate to Folder';
      } else {
        titleText = `Duplicate ${selectedCount} Notes to Folder`;
      }
    }

    title.textContent = titleText;

    // Render folder tree in picker
    this.renderFolderPickerTree(action);

    // Show modal
    modal.style.display = 'flex';
  }

  /**
   * Hide folder picker modal
   */
  hideFolderPicker(): void {
    const modal = document.getElementById('folderPickerModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Show cross-directory move confirmation dialog
   * @param noteCount - Number of notes being moved
   * @param targetSyncDirectoryId - Target sync directory ID
   * @returns Promise that resolves to true if confirmed, false if cancelled
   */
  private showCrossDirectoryMoveDialog(noteCount: number, targetSyncDirectoryId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = document.getElementById('crossDirectoryMoveDialog');
      const message = document.getElementById('crossDirectoryMoveMessage');
      const confirmBtn = document.getElementById('crossDirectoryMoveConfirm');
      const cancelBtn = document.getElementById('crossDirectoryMoveCancel');
      const closeBtn = document.getElementById('crossDirectoryMoveClose');
      const checkbox = document.getElementById('dontAskAgainCheckbox') as HTMLInputElement;

      if (!modal || !message || !confirmBtn || !cancelBtn || !closeBtn || !checkbox) {
        resolve(false);
        return;
      }

      // Get target sync directory name
      const targetSyncDir = this.syncDirectoryManager?.getSyncDirectory(targetSyncDirectoryId);
      const targetName = targetSyncDir?.name || 'another sync directory';

      // Set message
      const noteText = noteCount === 1 ? 'this note' : `these ${noteCount} notes`;
      message.textContent = `Are you sure you want to move ${noteText} to "${targetName}"? The note${noteCount > 1 ? 's' : ''} will be copied to the new location and removed from the current sync directory.`;

      // Reset checkbox
      checkbox.checked = false;

      // Handle confirm
      const handleConfirm = () => {
        // Save "don't ask again" preference
        if (checkbox.checked) {
          localStorage.setItem('dontAskCrossDirectoryMove', 'true');
        }
        cleanup();
        modal.style.display = 'none';
        resolve(true);
      };

      // Handle cancel
      const handleCancel = () => {
        cleanup();
        modal.style.display = 'none';
        resolve(false);
      };

      // Cleanup event listeners
      const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        closeBtn.removeEventListener('click', handleCancel);
      };

      // Add event listeners
      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
      closeBtn.addEventListener('click', handleCancel);

      // Show modal
      modal.style.display = 'flex';
    });
  }

  /**
   * Render folder tree in the folder picker
   */
  renderFolderPickerTree(action: 'move' | 'duplicate'): void {
    const treeContainer = document.getElementById('folderPickerTree');
    if (!treeContainer || !this.noteManager) return;

    treeContainer.innerHTML = '';

    // Get current note's folder and sync directory
    let currentFolderId: string | null = null;
    let currentSyncDirectoryId: string | null = null;
    if (this.selectedNoteIds.size === 1) {
      const noteId = Array.from(this.selectedNoteIds)[0];
      const note = this.noteManager.getNote(noteId);
      currentFolderId = note?.folderId || 'all-notes';
      currentSyncDirectoryId = note?.syncDirectoryId || this.noteManager.primarySyncDirectoryId;
    }

    // Render folders for each sync directory
    const syncDirectories = this.syncDirectoryManager?.getAllSyncDirectories() || [];

    for (const syncDir of syncDirectories) {
      // Create section header for sync directory
      const sectionHeader = document.createElement('div');
      sectionHeader.className = 'folder-picker-section-header';
      sectionHeader.textContent = syncDir.name;
      treeContainer.appendChild(sectionHeader);

      // Get folders for this sync directory
      const folderManager = this.noteManager.getFolderManagerForDirectory(syncDir.id);
      if (!folderManager) continue;

      const folders = folderManager.getAllFolders();

      // Check if this is the same sync directory as the current note
      const isSameSyncDirectory = syncDir.id === currentSyncDirectoryId;

      // Add special folders first (All Notes, Recently Deleted)
      // All at the same indentation level as root custom folders
      // Only disable if it's a move to the same folder in the same sync directory
      const allNotesIsDisabled = action === 'move' && currentFolderId === 'all-notes' && isSameSyncDirectory;
      const allNotesIsCurrent = currentFolderId === 'all-notes' && isSameSyncDirectory;
      const allNotesItem = this.createFolderPickerItem(
        'all-notes',
        'All Notes',
        syncDir.id,
        1, // Same level as custom folders
        allNotesIsDisabled,
        allNotesIsCurrent
      );
      treeContainer.appendChild(allNotesItem);

      // Add Recently Deleted option
      const trashIsDisabled = action === 'move' && currentFolderId === 'trash' && isSameSyncDirectory;
      const trashIsCurrent = currentFolderId === 'trash' && isSameSyncDirectory;
      const trashItem = this.createFolderPickerItem(
        'trash',
        'Recently Deleted',
        syncDir.id,
        1, // Same level as custom folders
        trashIsDisabled,
        trashIsCurrent
      );
      treeContainer.appendChild(trashItem);

      // Render custom folder tree (excluding special folders)
      const renderFolderTree = (parentId: string, level: number) => {
        const childFolders = folders.filter(f =>
          f.parentId === parentId && !f.isSpecial // Exclude special folders
        );

        for (const folder of childFolders) {
          // Only disable if it's the same folder in the same sync directory
          const isDisabled = action === 'move' && folder.id === currentFolderId && isSameSyncDirectory;
          const isCurrent = folder.id === currentFolderId && isSameSyncDirectory;
          const item = this.createFolderPickerItem(
            folder.id,
            folder.name,
            syncDir.id,
            level,
            isDisabled,
            isCurrent
          );
          treeContainer.appendChild(item);

          // Recursively render child folders
          renderFolderTree(folder.id, level + 1);
        }
      };

      renderFolderTree('root', 1);
    }
  }

  /**
   * Create a folder picker item element
   */
  private createFolderPickerItem(
    folderId: string,
    folderName: string,
    syncDirectoryId: string,
    level: number,
    isDisabled: boolean,
    isCurrent: boolean
  ): HTMLElement {
    const item = document.createElement('div');
    item.className = 'folder-picker-item';
    if (isDisabled) {
      item.classList.add('disabled');
    }
    if (isCurrent) {
      item.classList.add('current');
    }

    item.dataset.folderId = folderId;
    item.dataset.syncDirectoryId = syncDirectoryId;

    // Add indentation
    const indent = document.createElement('span');
    indent.className = 'folder-picker-item-indent';
    indent.style.width = `${level * 20}px`;
    item.appendChild(indent);

    // Add folder icon
    const icon = document.createElement('span');
    icon.className = 'folder-picker-item-icon';
    icon.textContent = '📁';
    item.appendChild(icon);

    // Add folder name
    const name = document.createElement('span');
    name.className = 'folder-picker-item-name';
    name.textContent = folderName;
    item.appendChild(name);

    // Add click handler
    if (!isDisabled) {
      item.addEventListener('click', () => {
        this.handleFolderPickerSelection(folderId, syncDirectoryId);
      });
    }

    return item;
  }

  /**
   * Handle folder selection in picker
   */
  private async handleFolderPickerSelection(folderId: string, syncDirectoryId: string): Promise<void> {
    const modal = document.getElementById('folderPickerModal');
    if (!modal) return;

    const action = (modal as any).dataset.action as 'move' | 'duplicate';
    const noteIds = Array.from(this.selectedNoteIds);

    if (noteIds.length === 0 || !this.noteManager) return;

    // Check if any notes are moving to a different sync directory
    const isCrossDirectory = noteIds.some(noteId => {
      const note = this.noteManager?.getNote(noteId);
      if (!note) return false;
      const noteSyncDirId = note.syncDirectoryId || this.noteManager?.primarySyncDirectoryId;
      return noteSyncDirId !== syncDirectoryId;
    });

    // If it's a cross-directory move and action is 'move', show confirmation dialog
    if (action === 'move' && isCrossDirectory) {
      // Check "don't ask again" preference
      const dontAskAgain = localStorage.getItem('dontAskCrossDirectoryMove') === 'true';

      if (!dontAskAgain) {
        // Show confirmation dialog and wait for user response
        const confirmed = await this.showCrossDirectoryMoveDialog(noteIds.length, syncDirectoryId);
        if (!confirmed) {
          // User cancelled, just hide the folder picker
          this.hideFolderPicker();
          return;
        }
      }
    }

    // Perform the action for each selected note
    for (const noteId of noteIds) {
      if (action === 'move') {
        // Pass target sync directory ID to support cross-directory moves
        await this.noteManager.moveNoteToFolder(noteId, folderId, syncDirectoryId);
      } else {
        // Duplicate not yet implemented (Phase 4B)
        console.log('[TODO] Duplicate note to folder not yet implemented');
      }
    }

    // Hide modal
    this.hideFolderPicker();

    // Refresh UI
    this.notes = this.noteManager.getAllNotes();
    this.renderNotesList();
    this.renderFolderTree();
  }

  async selectNote(noteId: string): Promise<void> {
    if (!this.noteManager) return;

    // Debug: Track where selectNote is being called from
    const stack = new Error().stack?.split('\n').slice(2, 5).join('\n');
    console.log(`[🔀 SELECT NOTE] Attempting to switch to: ${noteId}`, {
      from: this.currentNote?.id,
      stack
    });

    // If this is already the current note, don't reload it
    // This prevents losing unsaved title/tag updates during debounce
    if (this.currentNote && this.currentNote.id === noteId) {
      console.log(`[renderer] selectNote: Note ${noteId} is already selected, skipping`);
      return;
    }

    const note = this.noteManager.getNote(noteId);
    console.log(`[renderer] selectNote(${noteId}):`, {
      found: !!note,
      title: note?.title,
      deleted: note?.deleted
    });
    if (note && !note.deleted) {
      console.log(`[🔄 SWITCH] Switching from ${this.currentNote?.id} to ${noteId}`);
      await this.saveCurrentNote(); // Save previous note - MUST await to prevent race condition
      console.log(`[🔄 SWITCH] Previous note saved, now switching to:`, { id: note.id, title: note.title });
      this.currentNote = note;
      this.isEditing = false; // Reset editing state when switching notes

      // IMPORTANT: Load from disk if Y.Doc doesn't exist yet
      // Do NOT clear existing Y.Docs - Y.js updates are incremental diffs that need previous state
      if (this.isElectron && this.syncManager) {
        const docExists = this.syncManager.crdtManager.hasDoc(noteId);
        if (!docExists) {
          console.log(`[🔄 SWITCH] Y.Doc doesn't exist for ${noteId}, loading from disk...`);
          await this.syncManager.loadNote(noteId);
        } else {
          console.log(`[🔄 SWITCH] Using existing Y.Doc for ${noteId}`);
        }
      }

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
      await this.renderCurrentNote();

      // 3. Update active state in sidebar (without recreating HTML)
      const notesList = document.getElementById('notesList');
      if (notesList) {
        notesList.querySelectorAll('.note-item').forEach(item => {
          (item as HTMLElement).classList.toggle('active', (item as HTMLElement).dataset.noteId === noteId);
        });
      }

      // 4. Update tags list
      this.renderTagsList();

      // 5. Update backlinks panel
      this.renderBacklinks();

      // 6. Update editor status bar (gap indicators)
      this.updateEditorStatusBar();

      // 7. Save as last opened note
      const lastOpenedNote: LastOpenedNote = {
        noteId: this.currentNote.id,
        timestamp: Date.now()
      };
      localStorage.setItem('notecove-last-opened-note', JSON.stringify(lastOpenedNote));
    }
  }

  /**
   * Restore the last opened note when editor is ready
   * Waits for editor initialization to complete before restoring
   */
  async restoreLastOpenedNoteWhenReady(): Promise<void> {
    // Wait for editor to be ready
    const maxWait = 5000; // 5 seconds max
    const startTime = Date.now();
    while (this.editor && !this.editor.getText() && (Date.now() - startTime) < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (!this.editor) {
      console.warn('Editor not ready after timeout, skipping note restoration');
      return;
    }

    this.restoreLastOpenedNote();
  }

  /**
   * Restore the last opened note on startup
   * If the last note was deleted or doesn't exist, open the most recent note
   */
  restoreLastOpenedNote(): void {
    if (!this.noteManager) return;

    // Don't restore if a note is already open (e.g., user just created a new note)
    if (this.currentNote) {
      console.log('[restoreLastOpenedNote] Skipping - note already open:', this.currentNote.id);
      return;
    }

    try {
      const stored = localStorage.getItem('notecove-last-opened-note');

      if (stored) {
        const { noteId } = JSON.parse(stored) as LastOpenedNote;
        const note = this.noteManager.getNote(noteId);

        if (note && !note.deleted) {
          this.selectNote(noteId);
          return;
        }
      }

      // No last opened note or note was deleted - open most recent note
      const recentNote = this.noteManager.getMostRecentNote();
      if (recentNote) {
        this.selectNote(recentNote.id);
      }
    } catch (error) {
      console.error('Failed to restore last opened note:', error);
    }
  }

  updateNoteInList(): void {
    // Update the note item in the sidebar
    this.renderNotesList();
  }

  async saveCurrentNote(): Promise<void> {
    if (this.currentNote && this.editor) {
      console.log('[saveCurrentNote] Starting save for note:', this.currentNote.id);

      // DEBUG: Check Y.Doc BEFORE save operations
      if (this.syncManager) {
        const yDoc = this.syncManager.crdtManager.getContentDoc(this.currentNote.id);
        const yContent = yDoc.getXmlFragment('default');
        console.log('[saveCurrentNote] Y.Doc BEFORE save:', {
          noteId: this.currentNote.id,
          length: yContent.length,
          hasImage: yContent.toString().includes('<image'),
          preview: yContent.toString().substring(0, 200)
        });
      }

      // Force immediate save of current content (don't wait for debounce)
      const text = this.editor.getText();
      const firstLine = text.split('\n')[0].trim();
      const title = firstLine || 'Untitled';
      const tags = this.extractTags(text);

      // Don't modify the note object directly in Electron mode
      // The CRDT is the source of truth
      if (!this.isElectron) {
        this.currentNote.title = title;
        this.currentNote.tags = tags;
      }

      // In Electron/CRDT mode, content is in Y.Doc
      if (this.isElectron && this.syncManager) {
        // Don't overwrite a real title with "Untitled" (which could happen if editor is empty/not fully loaded)
        const shouldUpdate = !(title === 'Untitled' && this.currentNote.title && this.currentNote.title !== 'Untitled');

        if (shouldUpdate) {
          // Check if title or tags actually changed
          const titleChanged = title !== this.currentNote.title;
          const tagsChanged = JSON.stringify(tags) !== JSON.stringify(this.currentNote.tags);
          const metadataChanged = titleChanged || tagsChanged;

          console.log(`[💾 SAVE] Saving note ${this.currentNote.id} - Title: "${title}" (changed: ${metadataChanged})`);

          if (metadataChanged) {
            // DEBUG: Check Y.Doc BEFORE updateMetadata
            const yDocBeforeMetadata = this.syncManager.crdtManager.getContentDoc(this.currentNote.id);
            const yContentBeforeMetadata = yDocBeforeMetadata.getXmlFragment('default');
            console.log('[💾 SAVE] Y.Doc before updateMetadata:', {
              hasImage: yContentBeforeMetadata.toString().includes('<image')
            });

            // Update metadata in CRDT (this is the source of truth)
            this.syncManager.crdtManager.updateMetadata(this.currentNote.id, { title, tags });

            // DEBUG: Check Y.Doc AFTER updateMetadata
            const yDocAfterMetadata = this.syncManager.crdtManager.getContentDoc(this.currentNote.id);
            const yContentAfterMetadata = yDocAfterMetadata.getXmlFragment('default');
            console.log('[💾 SAVE] Y.Doc after updateMetadata:', {
              hasImage: yContentAfterMetadata.toString().includes('<image')
            });

            // Only update modified timestamp if metadata actually changed
            this.syncManager.crdtManager.updateModifiedTimestamp(this.currentNote.id);

            // DEBUG: Check Y.Doc AFTER updateModifiedTimestamp
            const yDocAfterTimestamp = this.syncManager.crdtManager.getContentDoc(this.currentNote.id);
            const yContentAfterTimestamp = yDocAfterTimestamp.getXmlFragment('default');
            console.log('[💾 SAVE] Y.Doc after updateModifiedTimestamp:', {
              hasImage: yContentAfterTimestamp.toString().includes('<image')
            });

            // Update the in-memory note object WITHOUT calling updateMetadata again
            // (we already updated metadata above - calling updateNote would duplicate it)
            const note = this.noteManager!.notes.get(this.currentNote.id);
            if (note) {
              note.title = title;
              note.tags = tags;
              note.modified = new Date().toISOString(); // Update in-memory timestamp to match CRDT
              this.noteManager!.notes.set(this.currentNote.id, note);
            }

            // Flush immediately to ensure metadata is saved - MUST await to prevent race condition
            console.log(`[💾 SAVE] Flushing updates to disk...`);
            await this.syncManager.updateStore.flush(this.currentNote.id);
            console.log(`[💾 SAVE] Flush complete for note ${this.currentNote.id}`);
          } else {
            console.log(`[💾 SAVE] No changes detected, skipping metadata update for ${this.currentNote.id}`);
          }
        }
      } else {
        // Web mode: save content as HTML
        const content = this.editor.getContent();
        this.currentNote.content = content;
        await this.noteManager!.updateNote(this.currentNote.id, { title, content, tags });
      }

      // DEBUG: Check Y.Doc AFTER save operations
      if (this.syncManager) {
        const yDoc = this.syncManager.crdtManager.getContentDoc(this.currentNote.id);
        const yContent = yDoc.getXmlFragment('default');
        console.log('[saveCurrentNote] Y.Doc AFTER save:', {
          noteId: this.currentNote.id,
          length: yContent.length,
          hasImage: yContent.toString().includes('<image'),
          preview: yContent.toString().substring(0, 200)
        });
      }

      this.updateStatus('Saved');
    }
  }

  onSearch(query: string): void {
    this.searchQuery = query.trim();
    this.updateUI();
  }

  handleKeyboard(e: KeyboardEvent): void {
    // Handle Escape key to clear selection
    if (e.key === 'Escape') {
      if (this.selectedNoteIds.size > 0) {
        e.preventDefault();
        this.clearSelection();
        return;
      }
    }

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
        case 'a':
          // Cmd/Ctrl+A: Select all notes (only if focus is on notes panel)
          const activeElement = document.activeElement;
          const isInNotesPanel = activeElement?.closest('#notesList') ||
                                activeElement?.closest('.notes-panel');
          if (isInNotesPanel || activeElement?.tagName === 'BODY') {
            e.preventDefault();
            this.selectAllNotes();
          }
          break;
      }
    }
  }

  async deleteCurrentNote(): Promise<void> {
    if (!this.currentNote || !this.noteManager) return;

    const confirmed = await this.showConfirmDialog(
      'Move to Trash',
      `Move "${this.currentNote.title || 'Untitled'}" to trash?`
    );

    if (!confirmed) return;

    const noteId = this.currentNote.id;
    await this.noteManager.deleteNote(noteId);
    this.currentNote = null;
    this.updateStatus('Moved to trash');
    this.updateUI();
  }

  showConfirmDialog(title: string, message: string, confirmButtonText: string = 'Move to Trash'): Promise<boolean> {
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
                  color: white; border-radius: 4px; cursor: pointer;">${confirmButtonText}</button>
        </div>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const confirmBtn = dialog.querySelector('#dialogConfirm') as HTMLButtonElement;
      const cancelBtn = dialog.querySelector('#dialogCancel') as HTMLButtonElement;

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
      const handleKeydown = (e: KeyboardEvent) => {
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

  restoreNote(noteId: string): void {
    if (!this.noteManager) return;

    const note = this.noteManager.restoreNote(noteId);
    if (note) {
      this.updateStatus(`Restored "${note.title || 'Untitled'}"`);
      this.updateUI();
    }
  }

  async permanentlyDeleteNote(noteId: string): Promise<void> {
    if (!this.noteManager) return;

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

  async emptyTrash(): Promise<void> {
    if (!this.noteManager) return;

    const deletedNotes = this.noteManager.getDeletedNotes();
    if (deletedNotes.length === 0) return;

    const confirmed = await this.showConfirmDialog(
      'Empty Trash',
      `Permanently delete all ${deletedNotes.length} note${deletedNotes.length > 1 ? 's' : ''} in trash? This cannot be undone.`,
      'Empty Trash'
    );

    if (!confirmed) return;

    const count = await this.noteManager.emptyTrash();
    if (this.currentNote?.deleted) {
      this.currentNote = null;
    }
    this.updateStatus(`Permanently deleted ${count} note${count > 1 ? 's' : ''}`);
    this.updateUI();
    this.renderFolderTree(); // Update folder counts
  }

  // Drag-and-drop handlers for notes
  handleNoteDragStart(e: DragEvent): void {
    const noteId = ((e.target as HTMLElement).closest('.note-item') as HTMLElement).dataset.noteId!;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', noteId);
    e.dataTransfer!.setData('text/note-type', 'active');
    (e.target as HTMLElement).classList.add('dragging');
  }

  handleTrashNoteDragStart(e: DragEvent): void {
    const noteId = ((e.target as HTMLElement).closest('.note-item') as HTMLElement).dataset.noteId!;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', noteId);
    e.dataTransfer!.setData('text/note-type', 'deleted');
    (e.target as HTMLElement).classList.add('dragging');
  }

  handleNoteDragEnd(e: DragEvent): void {
    (e.target as HTMLElement).classList.remove('dragging');
  }

  handleFolderDragStart(e: DragEvent): void {
    const folderItem = (e.target as HTMLElement).closest('.folder-item') as HTMLElement;
    const folderId = folderItem.dataset.folderId!;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', folderId);
    e.dataTransfer!.setData('text/drag-type', 'folder');
    folderItem.classList.add('dragging');
  }

  handleFolderDragEnd(e: DragEvent): void {
    const folderItem = (e.target as HTMLElement).closest('.folder-item');
    if (folderItem) {
      folderItem.classList.remove('dragging');
    }
  }

  handleFolderDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer!.dropEffect = 'move';

    const folderItem = (e.target as HTMLElement).closest('.folder-item');
    if (folderItem) {
      folderItem.classList.add('drag-over');
    }
  }

  handleFolderDragLeave(e: DragEvent): void {
    const folderItem = (e.target as HTMLElement).closest('.folder-item');
    if (folderItem) {
      folderItem.classList.remove('drag-over');
    }
  }

  async handleFolderDrop(e: DragEvent): Promise<void> {
    if (!this.noteManager) return;

    e.preventDefault();
    e.stopPropagation();

    const folderItem = (e.target as HTMLElement).closest('.folder-item');
    if (folderItem) {
      folderItem.classList.remove('drag-over');

      const draggedId = e.dataTransfer!.getData('text/plain');
      const dragType = e.dataTransfer!.getData('text/drag-type');
      const noteType = e.dataTransfer!.getData('text/note-type');
      const targetFolderId = (folderItem as HTMLElement).dataset.folderId!;

      // Handle folder drop - moving folder to become subfolder
      if (dragType === 'folder' && draggedId && targetFolderId) {
        // If dropped on "All Notes", move to root level instead
        const actualTargetId = targetFolderId === 'all-notes' ? 'root' : targetFolderId;
        const movedFolder = await this.noteManager.getFolderManager().moveFolder(draggedId, actualTargetId);
        if (movedFolder) {
          const targetName = actualTargetId === 'root'
            ? 'top level'
            : this.noteManager.getFolderManager().getFolder(actualTargetId)?.name || 'folder';
          this.updateStatus(`Moved folder to ${targetName}`);
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
            await this.noteManager.deleteNote(noteId);
            this.updateStatus(`Moved "${note.title || 'Untitled'}" to trash`);
            this.updateUI();
            this.renderFolderTree(); // Update folder counts
            // Clear editor if the deleted note was selected
            if (this.currentNote && this.currentNote.id === noteId) {
              this.currentNote = null;
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
          this.renderFolderTree(); // Update folder counts
        }
        // Otherwise, just move the note
        else if (!note.deleted && note.folderId !== folderId && folderId !== 'all-notes') {
          await this.noteManager.moveNoteToFolder(noteId, folderId);
          this.updateStatus(`Moved "${note.title || 'Untitled'}" to folder`);
          this.updateUI();
          this.renderFolderTree(); // Update folder counts
        }
      }
    }
  }

  /**
   * Show folder context menu
   */
  showFolderContextMenu(event: MouseEvent, folderId: string): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.noteManager) return;

    const folder = this.noteManager.getFolderManager().getFolder(folderId);

    // Allow context menu for trash folder, but not other special folders
    if (!folder || folder.isRoot) return;
    if (folder.isSpecial && folderId !== 'trash') return;

    this.contextMenuFolderId = folderId;

    const contextMenu = document.getElementById('folderContextMenu') as HTMLElement;
    if (!contextMenu) return;

    // Position the menu at the mouse cursor
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.display = 'block';

    // Show/hide menu items based on folder type
    const isTrash = folderId === 'trash';

    // Hide standard folder options for trash
    const renameItem = contextMenu.querySelector('[data-action="rename"]') as HTMLElement;
    const deleteItem = contextMenu.querySelector('[data-action="delete"]') as HTMLElement;
    const moveToRootItem = contextMenu.querySelector('[data-action="move-to-root"]') as HTMLElement;
    const emptyTrashItem = contextMenu.querySelector('[data-action="empty-trash"]') as HTMLElement;

    if (isTrash) {
      if (renameItem) renameItem.style.display = 'none';
      if (deleteItem) deleteItem.style.display = 'none';
      if (moveToRootItem) moveToRootItem.style.display = 'none';
      if (emptyTrashItem) emptyTrashItem.style.display = 'block';
    } else {
      if (renameItem) renameItem.style.display = 'block';
      if (deleteItem) deleteItem.style.display = 'block';
      if (moveToRootItem) {
        moveToRootItem.style.display = 'block';
        if (folder.parentId === 'root') {
          moveToRootItem.classList.add('disabled');
        } else {
          moveToRootItem.classList.remove('disabled');
        }
      }
      if (emptyTrashItem) emptyTrashItem.style.display = 'none';
    }

    // Close menu on any click outside
    setTimeout(() => {
      const closeMenu = (e: MouseEvent) => {
        if (!contextMenu.contains(e.target as Node)) {
          this.hideFolderContextMenu();
          document.removeEventListener('click', closeMenu);
        }
      };
      document.addEventListener('click', closeMenu);
    }, 0);
  }

  /**
   * Hide folder context menu
   */
  hideFolderContextMenu(): void {
    const contextMenu = document.getElementById('folderContextMenu') as HTMLElement;
    if (contextMenu) {
      contextMenu.style.display = 'none';
    }
    this.contextMenuFolderId = null;
  }

  /**
   * Handle folder context menu action
   */
  async handleFolderContextMenuAction(action: string): Promise<void> {
    if (!this.noteManager || !this.contextMenuFolderId) return;

    const folderId = this.contextMenuFolderId;

    // Get the appropriate folder manager for the current sync directory
    let folderManager = this.noteManager.getFolderManager(); // Default to primary
    if (this.currentSyncDirectoryId) {
      const syncDirFolderManager = this.noteManager.getFolderManagerForDirectory(this.currentSyncDirectoryId);
      if (syncDirFolderManager) {
        folderManager = syncDirFolderManager;
      }
    }

    const folder = folderManager.getFolder(folderId);
    if (!folder) return;

    this.hideFolderContextMenu();

    switch (action) {
      case 'rename':
        await this.renameFolderDialog(folderId);
        break;

      case 'move-to-root':
        if (folder.parentId !== 'root') {
          const movedFolder = await folderManager.moveFolder(folderId, 'root');
          if (movedFolder) {
            this.updateStatus(`Moved "${folder.name}" to top level`);
            this.renderFolderTree();
          }
        }
        break;

      case 'delete':
        await this.deleteFolderDialog(folderId);
        break;

      case 'empty-trash':
        await this.emptyTrash();
        break;
    }
  }

  /**
   * Show rename folder dialog
   */
  async renameFolderDialog(folderId: string): Promise<void> {
    if (!this.noteManager) return;

    // Get the appropriate folder manager for the current sync directory
    let folderManager = this.noteManager.getFolderManager(); // Default to primary
    if (this.currentSyncDirectoryId) {
      const syncDirFolderManager = this.noteManager.getFolderManagerForDirectory(this.currentSyncDirectoryId);
      if (syncDirFolderManager) {
        folderManager = syncDirFolderManager;
      }
    }

    const folder = folderManager.getFolder(folderId);
    if (!folder) return;

    const newName = prompt('Rename folder:', folder.name);
    if (newName && newName.trim() && newName.trim() !== folder.name) {
      const updated = await folderManager.updateFolder(folderId, { name: newName.trim() });
      if (updated) {
        this.updateStatus(`Renamed folder to "${newName.trim()}"`);
        this.renderFolderTree();
      }
    }
  }

  /**
   * Show delete folder dialog
   */
  async deleteFolderDialog(folderId: string): Promise<void> {
    if (!this.noteManager) return;

    // Get the appropriate folder manager for the current sync directory
    let folderManager = this.noteManager.getFolderManager(); // Default to primary
    if (this.currentSyncDirectoryId) {
      const syncDirFolderManager = this.noteManager.getFolderManagerForDirectory(this.currentSyncDirectoryId);
      if (syncDirFolderManager) {
        folderManager = syncDirFolderManager;
      }
    }

    const folder = folderManager.getFolder(folderId);
    if (!folder) return;

    // Check if folder has notes (within this sync directory)
    const notesInFolder = this.noteManager.getNotesInFolder(folderId, this.currentSyncDirectoryId || undefined);
    if (notesInFolder.length > 0) {
      alert(`Cannot delete folder "${folder.name}" - it contains ${notesInFolder.length} note(s). Please move or delete the notes first.`);
      return;
    }

    // Check if folder has children
    const hasChildren = folderManager.hasChildFolders(folderId);
    if (hasChildren) {
      alert(`Cannot delete folder "${folder.name}" - it contains subfolders. Please delete or move the subfolders first.`);
      return;
    }

    const confirmed = confirm(`Are you sure you want to delete the folder "${folder.name}"?`);
    if (confirmed) {
      const success = await folderManager.deleteFolder(folderId);
      if (success) {
        this.updateStatus(`Deleted folder "${folder.name}"`);
        // If we were viewing this folder, switch to All Notes
        if (this.currentFolderId === folderId) {
          this.currentFolderId = 'all-notes';
        }
        this.renderFolderTree();
        this.updateUI();
      }
    }
  }

  updateStatus(message: string): void {
    const statusLeft = document.querySelector('.status-left');
    if (statusLeft) {
      statusLeft.textContent = message;
      setTimeout(() => {
        statusLeft.textContent = 'Ready';
      }, 2000);
    }
  }

  /**
   * Open settings panel
   */
  openSettings(): void {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'settingsOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create settings panel
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: var(--background);
      border-radius: 8px;
      width: 700px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    `;

    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--border);">
        <h2 style="margin: 0; font-size: 20px; font-weight: 600;">Settings</h2>
        <button id="settingsClose" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary); line-height: 1;">×</button>
      </div>

      <div style="display: flex; border-bottom: 1px solid var(--border); padding: 0 24px;">
        <button class="settings-tab active" data-tab="sync-directories" style="padding: 12px 16px; background: none; border: none; border-bottom: 2px solid var(--primary-color); cursor: pointer; font-weight: 500; color: var(--primary-color);">
          Sync Directories
        </button>
        <button class="settings-tab" data-tab="general" style="padding: 12px 16px; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 500; color: var(--text-secondary);">
          General
        </button>
      </div>

      <div style="padding: 24px; max-height: calc(80vh - 140px); overflow-y: auto;">
        <!-- Sync Directories Tab -->
        <div id="syncDirectoriesTab" class="settings-tab-content" style="display: block;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Sync Directories</h3>
            <button id="addSyncDirectoryBtn" style="padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
              + Add Directory
            </button>
          </div>

          <div id="syncDirectoriesList">
            <!-- Populated dynamically -->
          </div>
        </div>

        <!-- General Tab -->
        <div id="generalTab" class="settings-tab-content" style="display: none;">
          <p style="color: var(--text-secondary);">General settings coming soon...</p>
        </div>
      </div>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Setup tab switching
    const tabs = panel.querySelectorAll('.settings-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const tabName = target.dataset.tab;

        // Update tab styles
        tabs.forEach(t => {
          const el = t as HTMLElement;
          if (el.dataset.tab === tabName) {
            el.style.borderBottomColor = 'var(--primary-color)';
            el.style.color = 'var(--primary-color)';
          } else {
            el.style.borderBottomColor = 'transparent';
            el.style.color = 'var(--text-secondary)';
          }
        });

        // Show/hide tab content
        const tabContents = panel.querySelectorAll('.settings-tab-content');
        // Convert hyphenated tab name to camelCase (e.g. "sync-directories" -> "syncDirectories")
        const camelCaseTabName = tabName!.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        tabContents.forEach(content => {
          const el = content as HTMLElement;
          el.style.display = el.id === `${camelCaseTabName}Tab` ? 'block' : 'none';
        });
      });
    });

    // Render sync directories list
    this.renderSyncDirectoriesList();

    // Close button
    const closeBtn = panel.querySelector('#settingsClose');
    closeBtn?.addEventListener('click', () => this.closeSettings());

    // Add directory button
    const addBtn = panel.querySelector('#addSyncDirectoryBtn');
    addBtn?.addEventListener('click', () => this.showAddSyncDirectoryDialog());

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeSettings();
      }
    });

    // Close on Escape key
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeSettings();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
  }

  /**
   * Close settings panel
   */
  closeSettings(): void {
    const overlay = document.getElementById('settingsOverlay');
    if (overlay) {
      document.body.removeChild(overlay);
    }
  }

  /**
   * Render sync directories list in settings
   */
  async renderSyncDirectoriesList(): Promise<void> {
    const listEl = document.getElementById('syncDirectoriesList');
    if (!listEl) return;

    // Get sync directories from manager
    const directories = this.syncDirectoryManager.getDirectories();

    if (directories.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
          <p style="margin-bottom: 12px;">No sync directories configured yet.</p>
          <p style="font-size: 13px;">Click "Add Directory" to create your first sync directory.</p>
        </div>
      `;
      return;
    }

    // Render directory list (inline HTML to avoid whitespace in test selectors)
    listEl.innerHTML = directories.map(dir =>
      `<div class="sync-directory-group" style="display: flex; align-items: center; justify-content: space-between; padding: 16px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); margin-bottom: 12px;">` +
      `<div class="sync-directory-info" style="flex: 1;">` +
      `<div class="sync-directory-name" style="font-weight: 600; font-size: 15px; margin-bottom: 4px; color: var(--text-primary);">${escapeHtml(dir.name)}</div>` +
      `<div style="font-size: 12px; color: var(--text-secondary); font-family: monospace;">${escapeHtml(dir.path)}</div>` +
      `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Created: ${formatDate(new Date(dir.created))}</div>` +
      `</div>` +
      `<div style="display: flex; gap: 8px;">` +
      `<button onclick="app.renameSyncDirectory('${dir.id}')" style="padding: 6px 12px; border: 1px solid var(--border); background: var(--background); color: var(--text-primary); border-radius: 4px; cursor: pointer; font-size: 13px;">Rename</button>` +
      `<button onclick="app.removeSyncDirectory('${dir.id}')" style="padding: 6px 12px; border: 1px solid #ef4444; background: var(--background); color: #ef4444; border-radius: 4px; cursor: pointer; font-size: 13px;">Remove</button>` +
      `</div>` +
      `</div>`
    ).join('');
  }

  /**
   * Show add sync directory dialog
   */
  async showAddSyncDirectoryDialog(): Promise<void> {
    // Detect cloud storage providers
    const { CloudStorageDetector } = await import('./lib/cloud-storage-detector');
    const detector = new CloudStorageDetector();
    const providers = await detector.detectProviders();

    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.id = 'addSyncDirectoryOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1001;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: var(--background);
      border-radius: 8px;
      padding: 24px;
      width: 500px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    `;

    let providerButtons = '';
    if (providers.length > 0) {
      providerButtons = `
        <div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: var(--text-primary);">Quick Select</h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            ${providers.map(p => `
              <button class="cloud-provider-btn" data-provider-id="${p.id}" style="
                padding: 12px;
                border: 1px solid var(--border);
                background: var(--surface);
                border-radius: 4px;
                cursor: pointer;
                text-align: left;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: border-color 0.2s, background 0.2s;
              " onmouseover="this.style.borderColor='var(--primary-color)'" onmouseout="this.style.borderColor='var(--border)'">
                <span style="font-size: 20px;">${p.icon}</span>
                <span style="font-weight: 500; color: var(--text-primary);">${p.name}</span>
              </button>
            `).join('')}
          </div>
          <div style="text-align: center; margin: 16px 0; color: var(--text-secondary); font-size: 13px;">or</div>
        </div>
      `;
    }

    dialog.innerHTML = `
      <h3 style="margin: 0 0 20px 0; color: var(--text-primary);">Add Sync Directory</h3>

      ${providerButtons}

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 6px; font-weight: 500; color: var(--text-primary);">Name</label>
        <input type="text" id="syncDirName" placeholder="Enter directory name (e.g., Work, Personal)" style="
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--border);
          border-radius: 4px;
          font-size: 14px;
          font-family: inherit;
        ">
      </div>

      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 6px; font-weight: 500; color: var(--text-primary);">Path</label>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="syncDirPath" placeholder="Enter path or click Browse..." style="
            flex: 1;
            padding: 8px 12px;
            border: 1px solid var(--border);
            border-radius: 4px;
            font-size: 14px;
            font-family: 'Courier New', monospace;
            background: var(--surface);
          ">
          <button id="browseDirBtn" style="
            padding: 8px 16px;
            border: 1px solid var(--border);
            background: var(--background);
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
          ">Browse...</button>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button id="cancelAddDir" style="
          padding: 8px 16px;
          border: 1px solid var(--border);
          background: var(--background);
          color: var(--text-primary);
          border-radius: 4px;
          cursor: pointer;
        ">Cancel</button>
        <button id="confirmAddDir" style="
          padding: 8px 16px;
          border: none;
          background: var(--primary-color);
          color: white;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        ">Add</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const nameInput = dialog.querySelector('#syncDirName') as HTMLInputElement;
    const pathInput = dialog.querySelector('#syncDirPath') as HTMLInputElement;
    const browseBtn = dialog.querySelector('#browseDirBtn');
    const cancelBtn = dialog.querySelector('#cancelAddDir');
    const confirmBtn = dialog.querySelector('#confirmAddDir');

    // Provider button handlers
    const providerBtns = dialog.querySelectorAll('.cloud-provider-btn');
    providerBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const providerId = (btn as HTMLElement).dataset.providerId;
        const provider = providers.find(p => p.id === providerId);
        if (provider) {
          nameInput.value = detector.getSuggestedName(provider);
          pathInput.value = detector.getSuggestedPath(provider);
        }
      });
    });

    // Browse button handler
    browseBtn?.addEventListener('click', async () => {
      if (window.electronAPI?.isElectron) {
        try {
          const result = await window.electronAPI.dialog.showOpen({
            properties: ['openDirectory', 'createDirectory'],
            title: 'Select Sync Directory'
          });

          if (!result.canceled && result.filePaths.length > 0) {
            pathInput.value = result.filePaths[0];
          }
        } catch (error) {
          console.error('Failed to show directory picker:', error);
        }
      }
    });

    // Cancel button
    cancelBtn?.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    // Confirm button
    confirmBtn?.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      const path = pathInput.value.trim();

      if (!name) {
        alert('Please enter a name for the sync directory.');
        nameInput.focus();
        return;
      }

      if (!path) {
        alert('Please select a path for the sync directory.');
        return;
      }

      try {
        const newDirectory = await this.syncDirectoryManager.addDirectory(name, path);

        // Initialize sync manager for the new directory
        if (this.isElectron && this.noteManager) {
          const instanceId = await window.electronAPI?.settings.get('instance') as string | undefined;
          const syncManager = new SyncManager(this.noteManager, newDirectory.path, instanceId);

          // Add sync event listeners
          syncManager.addListener((event: string, data: any) => this.handleSyncEvent(event, data));

          // Add to NoteManager's sync manager map
          await this.noteManager.addSyncManagerForDirectory(newDirectory.id, syncManager);

          // Start watching CRDT files for sync
          syncManager.startWatching();
          console.log(`Sync manager initialized for new directory: ${newDirectory.name}`);
        }

        // Update UI
        await this.renderSyncDirectoriesList();
        this.renderFolderTree();
        document.body.removeChild(overlay);
        this.updateStatus(`Added sync directory: ${name}`);
      } catch (error: any) {
        alert(`Failed to add sync directory: ${error.message}`);
      }
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    // Focus name input
    nameInput.focus();
  }

  /**
   * Rename a sync directory
   */
  async renameSyncDirectory(id: string): Promise<void> {
    const directory = this.syncDirectoryManager.getDirectories().find(d => d.id === id);
    if (!directory) return;

    const newName = await this.showInputDialog('Rename Sync Directory', 'Enter new name:', directory.name);
    if (newName && newName.trim() && newName.trim() !== directory.name) {
      try {
        await this.syncDirectoryManager.updateDirectory(id, { name: newName.trim() });
        await this.renderSyncDirectoriesList();
        this.updateStatus(`Renamed to "${newName.trim()}"`);
      } catch (error: any) {
        alert(`Failed to rename sync directory: ${error.message}`);
      }
    }
  }

  /**
   * Remove a sync directory
   */
  async removeSyncDirectory(id: string): Promise<void> {
    const directory = this.syncDirectoryManager.getDirectories().find(d => d.id === id);
    if (!directory) return;

    const confirmed = await this.showConfirmDialog(
      'Remove Sync Directory',
      `Are you sure you want to remove "${directory.name}"? This will not delete any files, only remove it from your sync directory list.`,
      'Remove'
    );

    if (confirmed) {
      try {
        // Check if current note belongs to the directory being removed
        if (this.currentNote) {
          const note = this.noteManager?.getNote(this.currentNote);
          if (note && note.syncDirectoryId === id) {
            // Clear the editor and current note since it's being removed
            this.currentNote = null;
            if (this.editor) {
              this.editor.commands.setContent('');
            }
            // Clear the editor panel title
            const titleElement = document.querySelector('.editor-note-title');
            if (titleElement) {
              titleElement.textContent = '';
            }
          }
        }

        // Remove sync manager and its notes
        if (this.noteManager) {
          await this.noteManager.removeSyncManagerForDirectory(id);
        }

        // Remove from sync directory manager
        await this.syncDirectoryManager.removeDirectory(id);

        // Update UI
        await this.renderSyncDirectoriesList();
        this.renderFolderTree();
        this.renderNotesList();
        this.updateStatus(`Removed "${directory.name}"`);
      } catch (error: any) {
        alert(`Failed to remove sync directory: ${error.message}`);
      }
    }
  }
}

// Global functions for HTML onclick handlers
(window as any).createNewNote = () => {
  if ((window as any).app) {
    (window as any).app.createNewNote();
  }
};

(window as any).openSettings = () => {
  if ((window as any).app) {
    (window as any).app.openSettings();
  }
};

(window as any).app = null;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  (window as any).app = new NoteCoveApp();
});

// Export for module usage
export default NoteCoveApp;
