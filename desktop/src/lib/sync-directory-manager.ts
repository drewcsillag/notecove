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

export class SyncDirectoryManager {
  private config: SyncDirectoryConfig;
  private configPath: string;
  private isElectron: boolean;

  constructor() {
    this.isElectron = window.electronAPI?.isElectron || false;
    this.configPath = '.sync-directories.json';
    this.config = {
      directories: []
    };
  }

  /**
   * Initialize the manager and load configuration
   */
  async initialize(): Promise<void> {
    await this.loadConfig();
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
      console.log('No existing sync directories config, starting fresh');
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
      id: this.generateId(),
      name,
      path,
      created: now,
      lastAccessed: now,
      isExpanded: true, // Expand by default
      order: maxOrder + 1
    };

    this.config.directories.push(directory);
    await this.saveConfig();
    return directory;
  }

  /**
   * Remove a sync directory
   */
  async removeDirectory(id: string): Promise<void> {
    const index = this.config.directories.findIndex(d => d.id === id);
    if (index === -1) {
      throw new Error('Sync directory not found');
    }

    this.config.directories.splice(index, 1);
    await this.saveConfig();
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
   * Generate a unique ID for a sync directory
   */
  private generateId(): string {
    return `sync-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
