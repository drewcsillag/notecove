/**
 * Storage Inspector Service
 *
 * Service for reading and parsing storage directory contents.
 * Provides tree structure listing and file reading capabilities
 * for the Storage Inspector UI.
 */

import type { FileSystemAdapter } from '@notecove/shared';
import {
  parseCrdtLogWithOffsets,
  parseSnapshotWithOffsets,
  type ParsedCrdtLogResult,
  type ParsedSnapshotResult,
} from './binary-parser';

/**
 * File type detected from path and content
 */
export type InspectorFileType =
  | 'crdtlog'
  | 'snapshot'
  | 'activity'
  | 'profile'
  | 'image'
  | 'identity'
  | 'directory'
  | 'unknown';

/**
 * Tree node representing a file or directory in the SD
 */
export interface SDTreeNode {
  name: string;
  path: string;
  type: InspectorFileType;
  size?: number;
  modified?: Date;
  children?: SDTreeNode[];
}

/**
 * Result of listing SD contents
 */
export interface SDContentsResult {
  root: string;
  children: SDTreeNode[];
  error?: string;
}

/**
 * Result of reading a file
 */
export interface FileInfoResult {
  path: string;
  type: InspectorFileType;
  size: number;
  modified: Date;
  data: Uint8Array;
  error?: string;
}

/**
 * Result of parsing a file for hex viewer display
 */
export interface ParsedFileResult {
  type: InspectorFileType;
  crdtLog?: ParsedCrdtLogResult;
  snapshot?: ParsedSnapshotResult;
  error?: string;
}

/**
 * Service for inspecting storage directory contents
 */
export class StorageInspectorService {
  constructor(private fs: FileSystemAdapter) {}

  /**
   * List all contents of a storage directory as a tree structure
   */
  async listSDContents(sdPath: string): Promise<SDContentsResult> {
    try {
      // Check if SD exists
      if (!(await this.fs.exists(sdPath))) {
        return {
          root: sdPath,
          children: [],
          error: `Storage directory does not exist: ${sdPath}`,
        };
      }

      const children: SDTreeNode[] = [];

      // Read top-level directories and files
      const topLevelItems = [
        'notes',
        'folders',
        'activity',
        'profiles',
        'media',
        'SD_ID',
        'SD_VERSION',
      ];

      for (const item of topLevelItems) {
        const itemPath = this.fs.joinPath(sdPath, item);
        if (await this.fs.exists(itemPath)) {
          const node = await this.buildTreeNode(sdPath, item);
          if (node) {
            children.push(node);
          }
        }
      }

      return { root: sdPath, children };
    } catch (error) {
      return {
        root: sdPath,
        children: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build a tree node for a file or directory
   */
  private async buildTreeNode(sdPath: string, relativePath: string): Promise<SDTreeNode | null> {
    const fullPath = this.fs.joinPath(sdPath, relativePath);
    const name = relativePath.split('/').pop() ?? relativePath;

    try {
      const stats = await this.fs.stat(fullPath);

      if (stats.isDirectory) {
        const children = await this.buildDirectoryChildren(sdPath, relativePath);
        return {
          name,
          path: relativePath,
          type: 'directory',
          children,
        };
      } else {
        const type = this.detectFileType(relativePath);
        return {
          name,
          path: relativePath,
          type,
          size: stats.size,
          modified: new Date(stats.mtimeMs),
        };
      }
    } catch (error) {
      console.error(`[StorageInspector] Error reading ${fullPath}:`, error);
      return null;
    }
  }

  /**
   * Build children for a directory node
   */
  private async buildDirectoryChildren(
    sdPath: string,
    relativePath: string
  ): Promise<SDTreeNode[]> {
    const fullPath = this.fs.joinPath(sdPath, relativePath);
    const children: SDTreeNode[] = [];

    try {
      const items = await this.fs.listFiles(fullPath);

      for (const item of items) {
        const childRelativePath = this.fs.joinPath(relativePath, item);
        const node = await this.buildTreeNode(sdPath, childRelativePath);
        if (node) {
          children.push(node);
        }
      }

      // Sort: directories first, then files, alphabetically
      children.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error(`[StorageInspector] Error listing ${fullPath}:`, error);
    }

    return children;
  }

  /**
   * Read file info including metadata and raw bytes
   */
  async readFileInfo(sdPath: string, relativePath: string): Promise<FileInfoResult> {
    const fullPath = this.fs.joinPath(sdPath, relativePath);

    try {
      // Check if file exists
      if (!(await this.fs.exists(fullPath))) {
        return {
          path: fullPath,
          type: 'unknown',
          size: 0,
          modified: new Date(),
          data: new Uint8Array(),
          error: `File not found: ${fullPath}`,
        };
      }

      const stats = await this.fs.stat(fullPath);
      const data = await this.fs.readFile(fullPath);
      const type = this.detectFileType(relativePath);

      return {
        path: fullPath,
        type,
        size: stats.size,
        modified: new Date(stats.mtimeMs),
        data: data instanceof Uint8Array ? data : new Uint8Array(data),
      };
    } catch (error) {
      return {
        path: fullPath,
        type: 'unknown',
        size: 0,
        modified: new Date(),
        data: new Uint8Array(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Detect file type from path
   */
  private detectFileType(relativePath: string): InspectorFileType {
    const name = relativePath.split('/').pop() ?? relativePath;
    const lowerPath = relativePath.toLowerCase();

    // Identity files
    if (name === 'SD_ID' || name === 'SD_VERSION') {
      return 'identity';
    }

    // CRDT log files
    if (lowerPath.endsWith('.crdtlog')) {
      return 'crdtlog';
    }

    // Snapshot files
    if (lowerPath.endsWith('.snapshot')) {
      return 'snapshot';
    }

    // Activity logs (matches 'activity/foo.log' or 'bar/activity/foo.log')
    if (
      (lowerPath.startsWith('activity/') || lowerPath.includes('/activity/')) &&
      lowerPath.endsWith('.log')
    ) {
      return 'activity';
    }

    // Profile files (matches 'profiles/foo.json' or 'bar/profiles/foo.json')
    if (
      (lowerPath.startsWith('profiles/') || lowerPath.includes('/profiles/')) &&
      lowerPath.endsWith('.json')
    ) {
      return 'profile';
    }

    // Image files (matches 'media/foo.png' or 'bar/media/foo.png')
    if (lowerPath.startsWith('media/') || lowerPath.includes('/media/')) {
      const ext = name.split('.').pop()?.toLowerCase();
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext ?? '')) {
        return 'image';
      }
    }

    return 'unknown';
  }

  /**
   * Parse a binary file and return structured data with byte offsets
   * for hex viewer color coding
   */
  parseFile(data: Uint8Array, type: InspectorFileType): ParsedFileResult {
    try {
      switch (type) {
        case 'crdtlog':
          return {
            type,
            crdtLog: parseCrdtLogWithOffsets(data),
          };

        case 'snapshot':
          return {
            type,
            snapshot: parseSnapshotWithOffsets(data),
          };

        // Activity logs and profiles can be added later
        default:
          return { type };
      }
    } catch (error) {
      return {
        type,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
