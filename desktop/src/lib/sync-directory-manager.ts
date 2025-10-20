/**
 * Sync Directory Manager
 * Manages multiple sync directories (workspaces) that each have their own notes
 */

export interface SyncDirectory {
  id: string;
  name: string;
  path: string;
  created: string;
  lastAccessed: string;
  isExpanded: boolean; // UI state: whether the directory is expanded in the folder tree
  order: number; // Display order in the folder tree
}

export interface SyncDirectoryConfig {
  directories: SyncDirectory[];
  // No activeDirectoryId - all directories are active simultaneously
}

export type SyncDirectoryEvent =
  | { type: 'sync-directory-added'; syncDirectory: SyncDirectory }
  | { type: 'sync-directory-removed'; syncDirectoryId: string }
  | { type: 'sync-directory-updated'; syncDirectory: SyncDirectory };

export type SyncDirectoryEventListener = (eventType: string, data: any) => void;

export class SyncDirectoryManager {
  private config: SyncDirectoryConfig;
  private configPath: string;
  private isElectron: boolean;
  private listeners: Set<SyncDirectoryEventListener> = new Set();

  constructor() {
    this.isElectron = window.electronAPI?.isElectron || false;
    this.configPath = '.sync-directories.json';
    this.config = {
      directories: []
    };
  }

  /**
   * Initialize the manager and load configuration
   * Creates a default sync directory if none exist
   */
  async initialize(): Promise<void> {
    await this.loadConfig();

    // If no sync directories exist, create a default one
    if (this.config.directories.length === 0) {
      await this.createDefaultSyncDirectory();
    }
  }

  /**
   * Create a default sync directory
   */
  private async createDefaultSyncDirectory(): Promise<void> {
    console.log('[SyncDirManager] Creating default sync directory');

    let defaultPath: string | undefined;

    if (this.isElectron) {
      // Get notesPath from electron-store settings
      try {
        const storedPath = await window.electronAPI?.settings.get('notesPath');
        console.log('[SyncDirManager] Stored path from settings:', storedPath);
        if (storedPath) {
          defaultPath = storedPath as string;
        } else {
          // Fallback to getUserDataPath
          const userDataPath = await window.electronAPI?.fileSystem.getUserDataPath();
          console.log('[SyncDirManager] User data path:', userDataPath);
          defaultPath = userDataPath;
        }
      } catch (error) {
        console.error('[SyncDirManager] Failed to get default path:', error);
        throw new Error('Failed to determine default sync directory path');
      }
    } else {
      // Browser mode - use a default name
      defaultPath = 'browser-notes';
    }

    if (!defaultPath) {
      console.error('[SyncDirManager] Could not determine default sync directory path');
      throw new Error('Could not determine default sync directory path');
    }

    console.log('[SyncDirManager] Adding default sync directory with path:', defaultPath);
    // Create default sync directory
    await this.addDirectory('My Notes', defaultPath);
    console.log('[SyncDirManager] Created default sync directory:', defaultPath);
  }

  /**
   * Load sync directories configuration
   */
  private async loadConfig(): Promise<void> {
    if (!this.isElectron) {
      // In browser mode, use localStorage
      const stored = localStorage.getItem('syncDirectories');
      if (stored) {
        try {
          this.config = JSON.parse(stored);
        } catch (error) {
          console.error('Failed to parse sync directories config:', error);
        }
      }
      return;
    }

    // In Electron mode, load from file
    try {
      const userDataPath = await window.electronAPI.fileSystem.getUserDataPath();
      const configPath = `${userDataPath}/${this.configPath}`;

      const result = await window.electronAPI.fileSystem.readFile(configPath);
      if (result.success && result.content) {
        const text = new TextDecoder().decode(result.content);
        this.config = JSON.parse(text);
      }
    } catch (error) {
      // No config file exists yet - this is normal for first run
    }
  }

  /**
   * Save sync directories configuration
   */
  private async saveConfig(): Promise<void> {
    if (!this.isElectron) {
      localStorage.setItem('syncDirectories', JSON.stringify(this.config));
      return;
    }

    try {
      const userDataPath = await window.electronAPI.fileSystem.getUserDataPath();
      const configPath = `${userDataPath}/${this.configPath}`;

      const content = JSON.stringify(this.config, null, 2);
      await window.electronAPI.fileSystem.writeFile(
        configPath,
        new TextEncoder().encode(content)
      );
    } catch (error) {
      console.error('Failed to save sync directories config:', error);
      throw error;
    }
  }

  /**
   * Add a new sync directory
   */
  async addDirectory(name: string, path: string): Promise<SyncDirectory> {
    // Check if path already exists
    const existing = this.config.directories.find(d => d.path === path);
    if (existing) {
      throw new Error('A sync directory with this path already exists');
    }

    const now = new Date().toISOString();
    const maxOrder = this.config.directories.reduce((max, d) => Math.max(max, d.order), -1);

    const directory: SyncDirectory = {
      id: this.generateId(path), // Generate stable ID from path
      name,
      path,
      created: now,
      lastAccessed: now,
      isExpanded: true, // Expand by default
      order: maxOrder + 1
    };

    this.config.directories.push(directory);
    await this.saveConfig();
    this.notifyListeners('sync-directory-added', { syncDirectory: directory });
    return directory;
  }

  /**
   * Remove a sync directory
   */
  async removeDirectory(id: string): Promise<void> {
    // Prevent removing the last sync directory
    if (this.config.directories.length === 1) {
      throw new Error('Cannot remove the last sync directory');
    }

    const index = this.config.directories.findIndex(d => d.id === id);
    if (index === -1) {
      throw new Error('Sync directory not found');
    }

    this.config.directories.splice(index, 1);
    await this.saveConfig();
    this.notifyListeners('sync-directory-removed', { syncDirectoryId: id });
  }

  /**
   * Update a sync directory
   */
  async updateDirectory(id: string, updates: Partial<Pick<SyncDirectory, 'name' | 'path'>>): Promise<void> {
    const directory = this.config.directories.find(d => d.id === id);
    if (!directory) {
      throw new Error('Sync directory not found');
    }

    if (updates.name !== undefined) {
      directory.name = updates.name;
    }
    if (updates.path !== undefined) {
      // Check if new path conflicts with existing directories
      const existing = this.config.directories.find(d => d.id !== id && d.path === updates.path);
      if (existing) {
        throw new Error('A sync directory with this path already exists');
      }
      directory.path = updates.path;
    }

    await this.saveConfig();
  }

  /**
   * Toggle expanded state of a sync directory
   */
  async toggleExpanded(id: string): Promise<void> {
    const directory = this.config.directories.find(d => d.id === id);
    if (!directory) {
      throw new Error('Sync directory not found');
    }

    directory.isExpanded = !directory.isExpanded;
    directory.lastAccessed = new Date().toISOString();
    await this.saveConfig();
  }

  /**
   * Reorder sync directories
   */
  async reorderDirectories(directoryIds: string[]): Promise<void> {
    // Update order based on the provided array
    directoryIds.forEach((id, index) => {
      const directory = this.config.directories.find(d => d.id === id);
      if (directory) {
        directory.order = index;
      }
    });

    await this.saveConfig();
  }

  /**
   * Get all sync directories sorted by order
   */
  getDirectories(): SyncDirectory[] {
    return [...this.config.directories].sort((a, b) => a.order - b.order);
  }

  /**
   * Get a specific sync directory
   */
  getDirectory(id: string): SyncDirectory | null {
    return this.config.directories.find(d => d.id === id) || null;
  }

  /**
   * Get the sync directory for a given notes path
   */
  getDirectoryByPath(path: string): SyncDirectory | null {
    return this.config.directories.find(d => d.path === path) || null;
  }

  /**
   * Generate a deterministic ID for a sync directory based on its path
   * This ensures the same path always gets the same ID, which is critical
   * for note persistence when removing and re-adding directories.
   */
  private generateId(path: string): string {
    // Create a simple hash from the path
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
      const char = path.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Convert to positive number and base36 string
    const hashStr = Math.abs(hash).toString(36);
    return `sync-${hashStr}`;
  }

  /**
   * Add event listener
   */
  addListener(listener: SyncDirectoryEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeListener(listener: SyncDirectoryEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of an event
   */
  private notifyListeners(eventType: string, data: any): void {
    this.listeners.forEach(listener => {
      try {
        listener(eventType, data);
      } catch (error) {
        console.error('[SyncDirectoryManager] Error in listener:', error);
      }
    });
  }

  // Method aliases for backward compatibility with tests
  async addSyncDirectory(name: string, path: string): Promise<SyncDirectory> {
    return this.addDirectory(name, path);
  }

  async removeSyncDirectory(id: string): Promise<void> {
    return this.removeDirectory(id);
  }

  getAllSyncDirectories(): SyncDirectory[] {
    return this.getDirectories();
  }

  getSyncDirectory(id: string): SyncDirectory | null {
    return this.getDirectory(id);
  }
}
