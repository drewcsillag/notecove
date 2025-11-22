/**
 * Export Service
 *
 * Handles exporting notes to Markdown format.
 * Supports single note, multi-note, and export all operations.
 */

import type { JSONContent } from '@tiptap/core';
import {
  prosemirrorToMarkdown,
  generateNoteFilename,
  type NoteTitleLookup,
  type ExportProgress,
  type ExportResult,
} from '../utils/markdown-export';

// Types for folder structure
export interface FolderInfo {
  id: string;
  name: string;
  parentId: string | null;
}

export interface NoteForExport {
  id: string;
  title: string;
  folderId: string | null;
  content: JSONContent;
  isEmpty: boolean;
}

/**
 * Export selected notes to markdown files
 */
export async function exportNotes(
  noteIds: string[],
  noteTitleLookup: NoteTitleLookup,
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult | null> {
  // Show folder picker
  const destinationPath = await window.electronAPI.export.selectDirectory();
  if (!destinationPath) {
    return null; // User cancelled
  }

  // Get note data for export
  const notes = (await window.electronAPI.export.getNotesForExport(noteIds)) as NoteForExport[];

  if (notes.length === 0) {
    return {
      success: true,
      exportedCount: 0,
      skippedCount: noteIds.length,
      errors: [],
      destinationPath,
    };
  }

  const existingFilenames = new Set<string>();
  const errors: string[] = [];
  let exportedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    if (!note) continue;

    // Report progress
    onProgress?.({
      current: i + 1,
      total: notes.length,
      currentNoteName: note.title,
    });

    // Skip empty notes
    if (note.isEmpty) {
      skippedCount++;
      continue;
    }

    try {
      // Convert to markdown
      const markdown = prosemirrorToMarkdown(note.content, noteTitleLookup);

      // Generate filename
      const filename = generateNoteFilename(note.title, existingFilenames);
      const filePath = `${destinationPath}/${filename}`;

      // Write file
      const result = await window.electronAPI.export.writeFile(filePath, markdown);
      if (result.success) {
        exportedCount++;
      } else {
        errors.push(`Failed to write "${note.title}": ${result.error}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Error exporting "${note.title}": ${message}`);
    }
  }

  // Show completion message
  await window.electronAPI.export.showCompletionMessage(
    exportedCount,
    skippedCount,
    destinationPath,
    errors
  );

  return {
    success: errors.length === 0,
    exportedCount,
    skippedCount,
    errors,
    destinationPath,
  };
}

/**
 * Export all notes from an SD with folder structure
 */
export async function exportAllNotes(
  _sdId: string,
  folders: FolderInfo[],
  allNotes: { id: string; folderId: string | null; deleted: boolean }[],
  noteTitleLookup: NoteTitleLookup,
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult | null> {
  // Show folder picker
  const destinationPath = await window.electronAPI.export.selectDirectory();
  if (!destinationPath) {
    return null; // User cancelled
  }

  // Filter out deleted notes and notes in Recently Deleted folder
  const recentlyDeletedFolderId = '__recently_deleted__';
  const notesToExport = allNotes.filter(
    (note) => !note.deleted && note.folderId !== recentlyDeletedFolderId
  );

  if (notesToExport.length === 0) {
    await window.electronAPI.export.showCompletionMessage(0, 0, destinationPath, []);
    return {
      success: true,
      exportedCount: 0,
      skippedCount: 0,
      errors: [],
      destinationPath,
    };
  }

  // Build folder path map (folderId -> relative path)
  const folderPaths = buildFolderPaths(folders);

  // Create all necessary directories
  const uniquePaths = new Set<string>();
  for (const note of notesToExport) {
    if (note.folderId && folderPaths.has(note.folderId)) {
      const path = folderPaths.get(note.folderId);
      if (path !== undefined) {
        uniquePaths.add(path);
      }
    }
  }

  for (const relativePath of uniquePaths) {
    const fullPath = `${destinationPath}/${relativePath}`;
    await window.electronAPI.export.createDirectory(fullPath);
  }

  // Get note data for export
  const noteIds = notesToExport.map((n) => n.id);
  const notes = (await window.electronAPI.export.getNotesForExport(noteIds)) as NoteForExport[];

  // Track filenames per directory to handle collisions
  const filenamesByDir = new Map<string, Set<string>>();

  const errors: string[] = [];
  let exportedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    if (!note) continue;

    // Report progress
    onProgress?.({
      current: i + 1,
      total: notes.length,
      currentNoteName: note.title,
    });

    // Skip empty notes
    if (note.isEmpty) {
      skippedCount++;
      continue;
    }

    try {
      // Determine target directory
      let targetDir = destinationPath;
      if (note.folderId && folderPaths.has(note.folderId)) {
        targetDir = `${destinationPath}/${folderPaths.get(note.folderId)}`;
      }

      // Get or create filename set for this directory
      if (!filenamesByDir.has(targetDir)) {
        filenamesByDir.set(targetDir, new Set<string>());
      }
      const existingFilenames = filenamesByDir.get(targetDir) ?? new Set<string>();

      // Convert to markdown
      const markdown = prosemirrorToMarkdown(note.content, noteTitleLookup);

      // Generate filename
      const filename = generateNoteFilename(note.title, existingFilenames);
      const filePath = `${targetDir}/${filename}`;

      // Write file
      const result = await window.electronAPI.export.writeFile(filePath, markdown);
      if (result.success) {
        exportedCount++;
      } else {
        errors.push(`Failed to write "${note.title}": ${result.error}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Error exporting "${note.title}": ${message}`);
    }
  }

  // Show completion message
  await window.electronAPI.export.showCompletionMessage(
    exportedCount,
    skippedCount,
    destinationPath,
    errors
  );

  return {
    success: errors.length === 0,
    exportedCount,
    skippedCount,
    errors,
    destinationPath,
  };
}

/**
 * Build a map of folder ID -> relative path
 */
function buildFolderPaths(folders: FolderInfo[]): Map<string, string> {
  const folderMap = new Map<string, FolderInfo>();
  for (const folder of folders) {
    folderMap.set(folder.id, folder);
  }

  const paths = new Map<string, string>();

  function getPath(folderId: string): string {
    const cachedPath = paths.get(folderId);
    if (cachedPath !== undefined) {
      return cachedPath;
    }

    const folder = folderMap.get(folderId);
    if (!folder) {
      return '';
    }

    // Sanitize folder name for filesystem
    const safeName = folder.name.replace(/[<>:"/\\|?*]/g, '_');

    if (folder.parentId && folderMap.has(folder.parentId)) {
      const parentPath = getPath(folder.parentId);
      const fullPath = parentPath ? `${parentPath}/${safeName}` : safeName;
      paths.set(folderId, fullPath);
      return fullPath;
    }

    paths.set(folderId, safeName);
    return safeName;
  }

  // Build paths for all folders
  for (const folder of folders) {
    getPath(folder.id);
  }

  return paths;
}

/**
 * Build a note title lookup function from a list of notes
 */
export function buildNoteTitleLookup(notes: { id: string; title: string }[]): NoteTitleLookup {
  const titleMap = new Map<string, string>();
  for (const note of notes) {
    titleMap.set(note.id.toLowerCase(), note.title);
  }

  return (noteId: string) => titleMap.get(noteId.toLowerCase());
}
