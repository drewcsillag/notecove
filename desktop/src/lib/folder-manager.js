import { generateUUID } from './utils.js';

/**
 * Folder Manager - handles folder organization for notes
 */
export class FolderManager {
  constructor() {
    this.folders = new Map();
    this.listeners = new Set();
    this.isElectron = window.electronAPI?.isElectron || false;
    this.folderState = new Map(); // folderId -> isExpanded (boolean)

    this.initializeFolders();
    this.loadFolderState();
  }

  /**
   * Add a listener for folder changes
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
        console.error('Error in folder manager listener:', error);
      }
    });
  }

  /**
   * Initialize default folders
   */
  initializeFolders() {
    // Root folder (invisible)
    const rootFolder = {
      id: 'root',
      name: 'Root',
      parentId: null,
      path: '',
      created: new Date().toISOString(),
      isRoot: true
    };

    // All Notes folder
    const allNotesFolder = {
      id: 'all-notes',
      name: 'All Notes',
      parentId: 'root',
      path: 'All Notes',
      created: new Date().toISOString(),
      isSpecial: true,
      icon: '📝'
    };

    // Recently Deleted folder
    const trashFolder = {
      id: 'trash',
      name: 'Recently Deleted',
      parentId: 'root',
      path: 'Recently Deleted',
      created: new Date().toISOString(),
      isSpecial: true,
      icon: '🗑️'
    };

    this.folders.set('root', rootFolder);
    this.folders.set('all-notes', allNotesFolder);
    this.folders.set('trash', trashFolder);

    this.loadCustomFolders();
  }

  /**
   * Load custom folders from storage
   */
  async loadCustomFolders() {
    try {
      if (this.isElectron) {
        const storedFolders = await window.electronAPI.settings.get('folders');
        if (storedFolders && Array.isArray(storedFolders)) {
          storedFolders.forEach(folder => {
            this.folders.set(folder.id, folder);
          });
        }
      } else {
        // Web mode - use localStorage
        const stored = localStorage.getItem('notecove-folders');
        if (stored) {
          const folders = JSON.parse(stored);
          folders.forEach(folder => {
            this.folders.set(folder.id, folder);
          });
        }
      }
      this.notify('folders-loaded', { folders: this.getFolderTree() });
    } catch (error) {
      console.error('Failed to load custom folders:', error);
    }
  }

  /**
   * Save folders to storage
   */
  async saveFolders() {
    try {
      const customFolders = Array.from(this.folders.values())
        .filter(folder => !folder.isSpecial && !folder.isRoot);

      if (this.isElectron) {
        await window.electronAPI.settings.set('folders', customFolders);
      } else {
        localStorage.setItem('notecove-folders', JSON.stringify(customFolders));
      }
    } catch (error) {
      console.error('Failed to save folders:', error);
    }
  }

  /**
   * Create a new folder
   * @param {string} name - Folder name
   * @param {string} parentId - Parent folder ID
   * @returns {object} Created folder
   */
  async createFolder(name, parentId = 'root') {
    const parent = this.folders.get(parentId);
    if (!parent) {
      throw new Error('Parent folder not found');
    }

    const folder = {
      id: generateUUID(),
      name: name.trim(),
      parentId,
      path: parent.path ? `${parent.path}/${name.trim()}` : name.trim(),
      created: new Date().toISOString(),
      isSpecial: false,
      isRoot: false
    };

    this.folders.set(folder.id, folder);
    await this.saveFolders();
    this.notify('folder-created', { folder });

    return folder;
  }

  /**
   * Update a folder
   * @param {string} folderId - Folder ID
   * @param {object} updates - Updates to apply
   * @returns {object|null} Updated folder or null
   */
  async updateFolder(folderId, updates) {
    const folder = this.folders.get(folderId);
    if (!folder || folder.isSpecial || folder.isRoot) {
      return null;
    }

    const updatedFolder = { ...folder, ...updates };

    // Update path if name changed
    if (updates.name) {
      const parent = this.folders.get(folder.parentId);
      updatedFolder.path = parent.path ?
        `${parent.path}/${updates.name}` :
        updates.name;

      // Update paths of all child folders
      this.updateChildPaths(folderId, updatedFolder.path);
    }

    this.folders.set(folderId, updatedFolder);
    await this.saveFolders();
    this.notify('folder-updated', { folder: updatedFolder });

    return updatedFolder;
  }

  /**
   * Delete a folder
   * @param {string} folderId - Folder ID
   * @returns {boolean} Success
   */
  async deleteFolder(folderId) {
    const folder = this.folders.get(folderId);
    if (!folder || folder.isSpecial || folder.isRoot) {
      return false;
    }

    // Check if folder has children
    const children = this.getChildFolders(folderId);
    if (children.length > 0) {
      throw new Error('Cannot delete folder with subfolders');
    }

    this.folders.delete(folderId);
    await this.saveFolders();
    this.notify('folder-deleted', { folderId });

    return true;
  }


  /**
   * Get folder by ID
   * @param {string} folderId - Folder ID
   * @returns {object|null} Folder or null
   */
  getFolder(folderId) {
    return this.folders.get(folderId) || null;
  }

  /**
   * Get all folders as a flat array
   * @returns {Array} Array of folders
   */
  getAllFolders() {
    return Array.from(this.folders.values());
  }

  /**
   * Get child folders of a parent
   * @param {string} parentId - Parent folder ID
   * @returns {Array} Child folders
   */
  getChildFolders(parentId) {
    return Array.from(this.folders.values())
      .filter(folder => folder.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get folder tree structure
   * @returns {Array} Tree structure
   */
  getFolderTree() {
    const buildTree = (parentId) => {
      const children = this.getChildFolders(parentId);
      return children.map(folder => ({
        ...folder,
        children: buildTree(folder.id)
      }));
    };

    // Get all root-level folders including special folders
    const rootFolders = buildTree('root');

    return rootFolders;
  }

  /**
   * Update paths of child folders when parent path changes
   * @param {string} parentId - Parent folder ID
   * @param {string} newParentPath - New parent path
   */
  updateChildPaths(parentId, newParentPath) {
    const children = this.getChildFolders(parentId);
    children.forEach(child => {
      const updatedChild = {
        ...child,
        path: `${newParentPath}/${child.name}`
      };
      this.folders.set(child.id, updatedChild);

      // Recursively update grandchildren
      this.updateChildPaths(child.id, updatedChild.path);
    });
  }

  /**
   * Move folder to a new parent
   * @param {string} folderId - Folder ID to move
   * @param {string} newParentId - New parent folder ID
   * @returns {object|null} Updated folder or null
   */
  async moveFolder(folderId, newParentId) {
    const folder = this.folders.get(folderId);
    const newParent = this.folders.get(newParentId);

    if (!folder || !newParent || folder.isSpecial || folder.isRoot) {
      return null;
    }

    // Prevent moving folder into itself or its own subtree
    if (folderId === newParentId || this.isDescendant(newParentId, folderId)) {
      return null;
    }

    // Cannot move into trash or all-notes
    if (newParentId === 'trash' || newParentId === 'all-notes') {
      return null;
    }

    const updatedFolder = {
      ...folder,
      parentId: newParentId,
      path: newParent.path ? `${newParent.path}/${folder.name}` : folder.name
    };

    this.folders.set(folderId, updatedFolder);
    this.updateChildPaths(folderId, updatedFolder.path);

    await this.saveFolders();
    this.notify('folder-moved', { folder: updatedFolder, newParentId });

    return updatedFolder;
  }

  /**
   * Check if one folder is a descendant of another
   * @param {string} descendantId - Potential descendant ID
   * @param {string} ancestorId - Potential ancestor ID
   * @returns {boolean} True if descendant
   */
  isDescendant(descendantId, ancestorId) {
    let current = this.folders.get(descendantId);
    while (current && current.parentId) {
      if (current.parentId === ancestorId) {
        return true;
      }
      current = this.folders.get(current.parentId);
    }
    return false;
  }

  /**
   * Get folder breadcrumb path
   * @param {string} folderId - Folder ID
   * @returns {Array} Breadcrumb array
   */
  getBreadcrumb(folderId) {
    const breadcrumb = [];
    let current = this.folders.get(folderId);

    while (current && current.parentId) {
      breadcrumb.unshift(current);
      current = this.folders.get(current.parentId);
    }

    return breadcrumb;
  }

  /**
   * Load folder collapse/expand state from storage
   */
  loadFolderState() {
    try {
      const stored = localStorage.getItem('notecove-folder-state');
      if (stored) {
        const state = JSON.parse(stored);
        Object.entries(state).forEach(([id, expanded]) => {
          this.folderState.set(id, expanded);
        });
      }
    } catch (error) {
      console.error('Failed to load folder state:', error);
    }
  }

  /**
   * Save folder collapse/expand state to storage
   */
  saveFolderState() {
    try {
      const state = {};
      this.folderState.forEach((expanded, id) => {
        state[id] = expanded;
      });
      localStorage.setItem('notecove-folder-state', JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save folder state:', error);
    }
  }

  /**
   * Toggle folder expanded/collapsed state
   * @param {string} folderId - Folder ID to toggle
   */
  toggleFolderExpanded(folderId) {
    const currentState = this.folderState.get(folderId) ?? true; // default expanded
    this.folderState.set(folderId, !currentState);
    this.saveFolderState();
    this.notify('folder-state-changed', { folderId, expanded: !currentState });
  }

  /**
   * Check if a folder is expanded
   * @param {string} folderId - Folder ID to check
   * @returns {boolean} True if expanded (default), false if collapsed
   */
  isFolderExpanded(folderId) {
    return this.folderState.get(folderId) ?? true; // default expanded
  }

  /**
   * Check if a folder has child folders
   * @param {string} folderId - Folder ID to check
   * @returns {boolean} True if folder has children
   */
  hasChildFolders(folderId) {
    return Array.from(this.folders.values()).some(
      folder => folder.parentId === folderId && folder.id !== 'root'
    );
  }
}