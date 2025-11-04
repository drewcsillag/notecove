/**
 * File system abstraction types
 * These interfaces allow the storage layer to be implemented differently
 * on different platforms (Node.js for desktop, native APIs for iOS)
 */

/**
 * Sync Directory structure paths
 */
export interface SyncDirectoryPaths {
  root: string;
  notes: string;
  folders: string;
}

/**
 * Paths for a specific note
 */
export interface NotePaths {
  root: string;
  updates: string;
  snapshots: string;
  packs: string;
  meta: string;
}

/**
 * File system operations abstraction
 * Platform-specific implementations must provide these operations
 */
export interface FileSystemAdapter {
  /**
   * Check if a path exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Create a directory (and parent directories if needed)
   */
  mkdir(path: string): Promise<void>;

  /**
   * Read a file as binary data
   */
  readFile(path: string): Promise<Uint8Array>;

  /**
   * Write a file atomically (with temp file + rename)
   */
  writeFile(path: string, data: Uint8Array): Promise<void>;

  /**
   * Delete a file
   */
  deleteFile(path: string): Promise<void>;

  /**
   * List files in a directory
   */
  listFiles(path: string): Promise<string[]>;

  /**
   * Join path segments
   */
  joinPath(...segments: string[]): string;

  /**
   * Get the base name of a path
   */
  basename(path: string): string;
}

/**
 * File watcher abstraction
 */
export interface FileWatcher {
  /**
   * Watch a directory for changes
   */
  watch(path: string, callback: (event: FileWatchEvent) => void): Promise<void>;

  /**
   * Stop watching
   */
  unwatch(): Promise<void>;
}

/**
 * File watch event types
 */
export enum FileWatchEventType {
  Added = 'added',
  Changed = 'changed',
  Deleted = 'deleted',
}

/**
 * File watch event
 */
export interface FileWatchEvent {
  type: FileWatchEventType;
  path: string;
  filename: string;
}

/**
 * SD (Sync Directory) configuration
 */
export interface SyncDirectoryConfig {
  id: string;
  path: string;
  label: string; // User-friendly name
}

/**
 * Update file metadata
 */
export interface UpdateFile {
  filename: string;
  path: string;
  instanceId: string;
  documentId: string; // note-id or sd-id
  timestamp: number;
}
