/**
 * Types for markdown import functionality
 */

/**
 * Result of scanning a directory or file for markdown files
 */
export interface ScanResult {
  /** Root path that was scanned */
  rootPath: string;
  /** Whether the source is a single file or directory */
  isDirectory: boolean;
  /** List of markdown files found */
  files: ScannedFile[];
  /** Tree structure for hierarchy preservation */
  tree: FileTreeNode;
  /** Total file count */
  totalFiles: number;
  /** Total size in bytes */
  totalSize: number;
}

/**
 * Information about a scanned markdown file
 */
export interface ScannedFile {
  /** Absolute path to the file */
  absolutePath: string;
  /** Path relative to scan root (empty string for single file) */
  relativePath: string;
  /** File name without extension */
  name: string;
  /** Parent folder path relative to scan root (empty string for root level) */
  parentPath: string;
  /** File size in bytes */
  size: number;
  /** File modification time (ms since epoch) */
  modifiedAt: number;
}

/**
 * Tree node representing a file or folder in the import source
 */
export interface FileTreeNode {
  /** Name of this folder or file */
  name: string;
  /** Relative path from scan root */
  path: string;
  /** Whether this is a folder */
  isFolder: boolean;
  /** Child nodes (only for folders) */
  children?: FileTreeNode[];
  /** Reference to ScannedFile (only for files) */
  file?: ScannedFile;
}

/**
 * Options for the import operation
 */
export interface ImportOptions {
  /** Target storage directory ID */
  sdId: string;
  /** Target folder ID (null for root level) */
  targetFolderId: string | null;
  /** How to handle folder structure */
  folderMode: 'preserve' | 'container' | 'flatten';
  /** Container folder name (only used with 'container' mode) */
  containerName?: string;
  /** How to handle duplicate names */
  duplicateHandling: 'rename' | 'skip';
}

/**
 * Progress update during import
 */
export interface ImportProgress {
  /** Current phase */
  phase: 'scanning' | 'folders' | 'notes' | 'complete' | 'cancelled' | 'error';
  /** Files processed */
  processedFiles: number;
  /** Total files to process */
  totalFiles: number;
  /** Current file being processed */
  currentFile?: string;
  /** Folders created */
  foldersCreated: number;
  /** Notes created */
  notesCreated: number;
  /** Notes skipped (duplicates) */
  notesSkipped: number;
  /** Errors encountered */
  errors: ImportError[];
}

/**
 * Error that occurred during import
 */
export interface ImportError {
  /** Type of error */
  type: 'file' | 'folder' | 'parse';
  /** Item that caused the error */
  item: string;
  /** Error message */
  message: string;
}

/**
 * Result of an import operation
 */
export interface ImportResult {
  /** Whether import completed successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Number of notes created */
  notesCreated: number;
  /** Number of folders created */
  foldersCreated: number;
  /** Number of files skipped (duplicates) */
  skipped: number;
  /** List of errors that occurred */
  errors: ImportError[];
  /** IDs of created notes */
  noteIds: string[];
  /** IDs of created folders */
  folderIds: string[];
}

/**
 * Mapping from original path to created note
 */
export interface PathToNoteMapping {
  /** Relative path from import root */
  originalPath: string;
  /** Created note ID */
  noteId: string;
  /** Note title */
  title: string;
}
