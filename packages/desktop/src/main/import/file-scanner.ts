/**
 * File Scanner for Markdown Import
 *
 * Pure utility functions for scanning directories and files for markdown content.
 * These functions have no side effects and are easily testable.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ScanResult, ScannedFile, FileTreeNode } from './types';

/** File extensions to include in scan */
const MARKDOWN_EXTENSIONS = ['.md', '.markdown'];

/** Directories to skip during scan */
const SKIP_DIRECTORIES = ['node_modules', '.git', '.svn', '.hg', '__pycache__', '.venv', 'venv'];

/**
 * Check if a file is a markdown file based on extension
 */
function isMarkdownFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return MARKDOWN_EXTENSIONS.includes(ext);
}

/**
 * Check if a path should be skipped (hidden or in skip list)
 */
function shouldSkip(name: string): boolean {
  // Skip hidden files/folders (starting with .)
  if (name.startsWith('.')) {
    return true;
  }
  // Skip known directories
  if (SKIP_DIRECTORIES.includes(name)) {
    return true;
  }
  return false;
}

/**
 * Scan a single markdown file
 */
export async function scanSingleFile(filePath: string): Promise<ScanResult> {
  const absolutePath = path.resolve(filePath);
  const stats = await fs.stat(absolutePath);

  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${filePath}`);
  }

  if (!isMarkdownFile(absolutePath)) {
    throw new Error(`File is not a markdown file: ${filePath}`);
  }

  const name = path.basename(absolutePath, path.extname(absolutePath));

  const file: ScannedFile = {
    absolutePath,
    relativePath: '',
    name,
    parentPath: '',
    size: stats.size,
    modifiedAt: stats.mtimeMs,
  };

  const tree: FileTreeNode = {
    name: path.basename(absolutePath),
    path: '',
    isFolder: false,
    file,
  };

  return {
    rootPath: absolutePath,
    isDirectory: false,
    files: [file],
    tree,
    totalFiles: 1,
    totalSize: stats.size,
  };
}

/**
 * Scan a directory recursively for markdown files
 */
export async function scanDirectory(dirPath: string): Promise<ScanResult> {
  const absolutePath = path.resolve(dirPath);
  const stats = await fs.stat(absolutePath);

  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${dirPath}`);
  }

  const files: ScannedFile[] = [];
  const tree = await buildTree(absolutePath, absolutePath, files);

  return {
    rootPath: absolutePath,
    isDirectory: true,
    files,
    tree,
    totalFiles: files.length,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
  };
}

/**
 * Build tree structure recursively
 */
async function buildTree(
  currentPath: string,
  rootPath: string,
  files: ScannedFile[]
): Promise<FileTreeNode> {
  const name = path.basename(currentPath);
  const relativePath = path.relative(rootPath, currentPath);

  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  const children: FileTreeNode[] = [];

  // Sort entries: folders first, then files, alphabetically
  const sortedEntries = entries
    .filter((entry) => !shouldSkip(entry.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

  for (const entry of sortedEntries) {
    const entryPath = path.join(currentPath, entry.name);

    try {
      if (entry.isDirectory()) {
        // Recurse into subdirectory
        const subtree = await buildTree(entryPath, rootPath, files);
        // Only include folder if it has markdown files (directly or nested)
        if (hasMarkdownFiles(subtree)) {
          children.push(subtree);
        }
      } else if (entry.isFile() && isMarkdownFile(entry.name)) {
        // Add markdown file
        const stats = await fs.stat(entryPath);
        const fileRelativePath = path.relative(rootPath, entryPath);
        const fileName = path.basename(entry.name, path.extname(entry.name));

        const file: ScannedFile = {
          absolutePath: entryPath,
          relativePath: fileRelativePath,
          name: fileName,
          parentPath: relativePath,
          size: stats.size,
          modifiedAt: stats.mtimeMs,
        };

        files.push(file);
        children.push({
          name: entry.name,
          path: fileRelativePath,
          isFolder: false,
          file,
        });
      }
      // Skip symlinks and other special files
    } catch (err) {
      // Skip files we can't access
      console.warn(`[Import] Could not access ${entryPath}:`, err);
    }
  }

  return {
    name,
    path: relativePath,
    isFolder: true,
    children,
  };
}

/**
 * Check if a tree node contains any markdown files
 */
function hasMarkdownFiles(node: FileTreeNode): boolean {
  if (!node.isFolder) {
    return true; // It's a file, so it's a markdown file
  }
  if (!node.children || node.children.length === 0) {
    return false;
  }
  return node.children.some(hasMarkdownFiles);
}

/**
 * Scan a path (auto-detect file vs directory)
 */
export async function scanPath(sourcePath: string): Promise<ScanResult> {
  const absolutePath = path.resolve(sourcePath);
  const stats = await fs.stat(absolutePath);

  if (stats.isDirectory()) {
    return scanDirectory(absolutePath);
  } else if (stats.isFile()) {
    return scanSingleFile(absolutePath);
  } else {
    throw new Error(`Unsupported path type: ${sourcePath}`);
  }
}

/**
 * Get unique folder paths from scanned files
 * Returns paths in order suitable for creation (parent before child)
 */
export function getUniqueFolderPaths(files: ScannedFile[]): string[] {
  const folderSet = new Set<string>();

  for (const file of files) {
    if (file.parentPath) {
      // Add all ancestor paths
      const parts = file.parentPath.split(path.sep);
      let currentPath = '';
      for (const part of parts) {
        currentPath = currentPath ? path.join(currentPath, part) : part;
        folderSet.add(currentPath);
      }
    }
  }

  // Sort by depth (shallow first) then alphabetically
  return Array.from(folderSet).sort((a, b) => {
    const depthA = a.split(path.sep).length;
    const depthB = b.split(path.sep).length;
    if (depthA !== depthB) return depthA - depthB;
    return a.localeCompare(b);
  });
}
