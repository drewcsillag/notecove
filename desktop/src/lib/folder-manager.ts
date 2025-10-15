import { generateUUID } from './utils';
import { CRDTManager } from './crdt-manager';
import { UpdateStore } from './update-store';

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  created: string;
  isRoot?: boolean;
  isSpecial?: boolean;
  icon?: string;
}

interface FolderWithChildren extends Folder {
  children: FolderWithChildren[];
  noteCount?: number;
}

type FolderListener = (event: string, data: any) => void;

/**
 * Folder Manager - handles folder organization for notes
 */
export class FolderManager {
  folders: Map<string, Folder>;
  listeners: Set<FolderListener>;
  isElectron: boolean;
  folderState: Map<string, boolean>;
  notesPath: string | null;
  crdtManager: CRDTManager | null;
  updateStore: UpdateStore | null;

  constructor(notesPath: string | null = null, crdtManager: CRDTManager | null = null, updateStore: UpdateStore | null = null) {
    this.folders = new Map();
    this.listeners = new Set();
    this.isElectron = window.electronAPI?.isElectron || false;
    this.folderState = new Map(); // folderId -> isExpanded (boolean)
    this.notesPath = notesPath; // Path to notes directory
    this.crdtManager = crdtManager; // CRDT manager for folder sync
    this.updateStore = updateStore; // Update store for flushing

    this.initializeFolders();
    this.loadFolderState();
  }

  /**
   * Add a listener for folder changes
   * @param listener - Function to call on changes
   */
  addListener(listener: FolderListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove a listener
   * @param listener - Listener to remove
   */
  removeListener(listener: FolderListener): void {
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
        console.error('Error in folder manager listener:', error);
      }
    });
  }

  /**
   * Initialize default folders
   */
  initializeFolders(): void {
    // Root folder (invisible)
    const rootFolder: Folder = {
      id: 'root',
      name: 'Root',
      parentId: null,
      path: '',
      created: new Date().toISOString(),
      isRoot: true
    };

    // All Notes folder
    const allNotesFolder: Folder = {
      id: 'all-notes',
      name: 'All Notes',
      parentId: 'root',
      path: 'All Notes',
      created: new Date().toISOString(),
      isSpecial: true,
      icon: '📝'
    };

    // Recently Deleted folder
    const trashFolder: Folder = {
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
  async loadCustomFolders(): Promise<void> {
    try {
      let storedFolders: Folder[] | null = null;

      // Try CRDT-based storage first (for multi-instance sync)
      if (this.isElectron && this.crdtManager) {
        const foldersDoc = this.crdtManager.getDoc('.folders');
        if (!this.crdtManager.isDocEmpty('.folders')) {
          const yMap = foldersDoc.getMap('folders');
          storedFolders = [];

          yMap.forEach((folderData: any, folderId: string) => {
            storedFolders!.push({ id: folderId, ...folderData });
          });

          console.log('[FolderManager] Loaded folders from CRDT:', storedFolders.length);
        }
      }

      // Fall back to settings/localStorage if no CRDT storage
      if (!storedFolders || storedFolders.length === 0) {
        if (this.isElectron) {
          storedFolders = (await window.electronAPI?.settings.get('folders')) || null;
        } else {
          // Web mode - use localStorage
          const stored = localStorage.getItem('notecove-folders');
          if (stored) {
            storedFolders = JSON.parse(stored);
          }
        }
      }

      if (storedFolders && Array.isArray(storedFolders)) {
        storedFolders.forEach(folder => {
          this.folders.set(folder.id, folder);
        });
      }

      this.notify('folders-loaded', { folders: this.getFolderTree() });
    } catch (error) {
      console.error('Failed to load custom folders:', error);
    }
  }

  /**
   * Save folders to storage
   */
  async saveFolders(): Promise<void> {
    try {
      const customFolders = Array.from(this.folders.values())
        .filter(folder => !folder.isSpecial && !folder.isRoot);

      // Save to CRDT for multi-instance sync
      if (this.isElectron && this.crdtManager) {
        console.log('[FolderManager] Saving folders to CRDT...');
        const foldersDoc = this.crdtManager.getDoc('.folders');

        foldersDoc.transact(() => {
          const yMap = foldersDoc.getMap('folders');

          // Clear existing folders
          yMap.clear();

          // Add all custom folders
          customFolders.forEach(folder => {
            const { id, ...folderData } = folder;
            console.log(`[FolderManager]   Adding folder: ${folder.name} (${id})`);
            yMap.set(id, folderData);
          });
        });

        console.log('[FolderManager] Saved folders to CRDT:', customFolders.length);

        // Flush immediately so other instances see the changes
        // (Updates are automatically added to buffer by CRDT listener)
        if (this.updateStore) {
          console.log('[FolderManager] Flushing folder updates...');
          await this.updateStore.flush('.folders');
          console.log('[FolderManager] Flushed folder updates immediately');
        } else {
          console.log('[FolderManager] WARNING: No updateStore available for flush!');
        }

        // Also save to settings as backup
        await window.electronAPI?.settings.set('folders', customFolders);
      } else if (this.isElectron) {
        await window.electronAPI?.settings.set('folders', customFolders);
      } else {
        localStorage.setItem('notecove-folders', JSON.stringify(customFolders));
      }
    } catch (error) {
      console.error('Failed to save folders:', error);
    }
  }

  /**
   * Create a new folder
   * @param name - Folder name
   * @param parentId - Parent folder ID
   * @returns Created folder
   */
  async createFolder(name: string, parentId = 'root'): Promise<Folder> {
    const parent = this.folders.get(parentId);
    if (!parent) {
      throw new Error('Parent folder not found');
    }

    const folder: Folder = {
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
   * @param folderId - Folder ID
   * @param updates - Updates to apply
   * @returns Updated folder or null
   */
  async updateFolder(folderId: string, updates: Partial<Folder>): Promise<Folder | null> {
    const folder = this.folders.get(folderId);
    if (!folder || folder.isSpecial || folder.isRoot) {
      return null;
    }

    const updatedFolder: Folder = { ...folder, ...updates };

    // Update path if name changed
    if (updates.name) {
      const parent = this.folders.get(folder.parentId!);
      if (parent) {
        updatedFolder.path = parent.path ?
          `${parent.path}/${updates.name}` :
          updates.name;

        // Update paths of all child folders
        this.updateChildPaths(folderId, updatedFolder.path);
      }
    }

    this.folders.set(folderId, updatedFolder);
    await this.saveFolders();
    this.notify('folder-updated', { folder: updatedFolder });

    return updatedFolder;
  }

  /**
   * Delete a folder
   * @param folderId - Folder ID
   * @returns Success
   */
  async deleteFolder(folderId: string): Promise<boolean> {
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
   * @param folderId - Folder ID
   * @returns Folder or null
   */
  getFolder(folderId: string): Folder | null {
    return this.folders.get(folderId) || null;
  }

  /**
   * Get all folders as a flat array
   * @returns Array of folders
   */
  getAllFolders(): Folder[] {
    return Array.from(this.folders.values());
  }

  /**
   * Get child folders of a parent
   * @param parentId - Parent folder ID
   * @returns Child folders
   */
  getChildFolders(parentId: string): Folder[] {
    return Array.from(this.folders.values())
      .filter(folder => folder.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get folder tree structure
   * @returns Tree structure
   */
  getFolderTree(): FolderWithChildren[] {
    const buildTree = (parentId: string): FolderWithChildren[] => {
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
   * @param parentId - Parent folder ID
   * @param newParentPath - New parent path
   */
  updateChildPaths(parentId: string, newParentPath: string): void {
    const children = this.getChildFolders(parentId);
    children.forEach(child => {
      const updatedChild: Folder = {
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
   * @param folderId - Folder ID to move
   * @param newParentId - New parent folder ID
   * @returns Updated folder or null
   */
  async moveFolder(folderId: string, newParentId: string): Promise<Folder | null> {
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

    const updatedFolder: Folder = {
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
   * @param descendantId - Potential descendant ID
   * @param ancestorId - Potential ancestor ID
   * @returns True if descendant
   */
  isDescendant(descendantId: string, ancestorId: string): boolean {
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
   * @param folderId - Folder ID
   * @returns Breadcrumb array
   */
  getBreadcrumb(folderId: string): Folder[] {
    const breadcrumb: Folder[] = [];
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
  loadFolderState(): void {
    try {
      const stored = localStorage.getItem('notecove-folder-state');
      if (stored) {
        const state: Record<string, boolean> = JSON.parse(stored);
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
  saveFolderState(): void {
    try {
      const state: Record<string, boolean> = {};
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
   * @param folderId - Folder ID to toggle
   */
  toggleFolderExpanded(folderId: string): void {
    const currentState = this.folderState.get(folderId) ?? true; // default expanded
    this.folderState.set(folderId, !currentState);
    this.saveFolderState();
    this.notify('folder-state-changed', { folderId, expanded: !currentState });
  }

  /**
   * Check if a folder is expanded
   * @param folderId - Folder ID to check
   * @returns True if expanded (default), false if collapsed
   */
  isFolderExpanded(folderId: string): boolean {
    return this.folderState.get(folderId) ?? true; // default expanded
  }

  /**
   * Check if a folder has child folders
   * @param folderId - Folder ID to check
   * @returns True if folder has children
   */
  hasChildFolders(folderId: string): boolean {
    return Array.from(this.folders.values()).some(
      folder => folder.parentId === folderId && folder.id !== 'root'
    );
  }
}
