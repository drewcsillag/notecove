/**
 * Note Discovery
 * Handles discovery of notes that exist on disk but not in the database
 */

import { join } from 'path';
import { BrowserWindow } from 'electron';
import type { Database } from '@notecove/shared';
import { extractTitleFromDoc } from '@notecove/shared';
import type { CRDTManager } from './crdt';
import * as fs from 'fs/promises';
import * as Y from 'yjs';

/**
 * Discover notes that exist on disk but not in the database.
 *
 * This handles the case where node A creates a new note while node B is sleeping.
 * When node B wakes up, the activity sync may timeout waiting for CRDT files to sync.
 * This function scans the notes directory and imports any notes that weren't discovered.
 *
 * @param sdId - Storage directory ID
 * @param sdPath - Path to the storage directory
 * @param database - Database instance
 * @param crdtManager - CRDT manager instance
 * @returns Set of discovered note IDs
 */
export async function discoverNewNotes(
  sdId: string,
  sdPath: string,
  database: Database,
  crdtManager: CRDTManager
): Promise<Set<string>> {
  const discoveredNotes = new Set<string>();

  try {
    // List all note directories on disk
    const notesPath = join(sdPath, 'notes');
    let noteIds: string[];

    try {
      const entries = await fs.readdir(notesPath);
      // Filter to only directories (note folders are UUIDs)
      noteIds = [];
      for (const entry of entries) {
        const entryPath = join(notesPath, entry);
        const stats = await fs.stat(entryPath).catch(() => null);
        if (stats?.isDirectory()) {
          noteIds.push(entry);
        }
      }
    } catch (error: unknown) {
      // Notes directory doesn't exist or can't be read
      console.log(`[discoverNewNotes] Cannot read notes directory for SD ${sdId}`, error);
      return discoveredNotes;
    }

    console.log(`[discoverNewNotes] Found ${noteIds.length} note directories in SD ${sdId}`);

    // Build set of deleted note IDs from all deletion logs
    const deletedNoteIds = new Set<string>();
    const deletionsPath = join(sdPath, 'deletions');
    try {
      const deletionFiles = await fs.readdir(deletionsPath);
      for (const file of deletionFiles) {
        if (!file.endsWith('.log')) continue;
        try {
          const filePath = join(deletionsPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n').filter((l) => l.length > 0);
          for (const line of lines) {
            const [noteId] = line.split('|');
            if (noteId) {
              deletedNoteIds.add(noteId);
            }
          }
        } catch (error: unknown) {
          // Skip unreadable files
          console.log(`[discoverNewNotes] Failed to read deletion log ${file}:`, error);
        }
      }
    } catch (error: unknown) {
      // Deletions directory doesn't exist
      console.log(`[discoverNewNotes] Cannot read deletions directory for SD ${sdId}:`, error);
    }

    console.log(`[discoverNewNotes] Found ${deletedNoteIds.size} deleted notes in logs`);

    // Check each note against the database
    for (const noteId of noteIds) {
      // Skip if we know it was deleted
      if (deletedNoteIds.has(noteId)) {
        console.log(`[discoverNewNotes] Skipping deleted note ${noteId}`);
        continue;
      }

      // Check if note exists in database
      const existingNote = await database.getNote(noteId);
      if (existingNote) {
        // Note already known
        continue;
      }

      console.log(`[discoverNewNotes] Discovered new note ${noteId}, attempting to import...`);

      // Try to load the note from CRDT storage
      try {
        const doc = await crdtManager.loadNote(noteId, sdId);
        const noteDoc = crdtManager.getNoteDoc(noteId);

        if (!noteDoc) {
          console.log(`[discoverNewNotes] Note doc not found for ${noteId}, will retry later`);
          await crdtManager.unloadNote(noteId);
          continue;
        }

        // Extract content
        const content = doc.getXmlFragment('content');
        if (content.length === 0) {
          console.log(`[discoverNewNotes] Note ${noteId} has no content, will retry later`);
          await crdtManager.unloadNote(noteId);
          continue;
        }

        // Extract text content
        let contentText = '';
        content.forEach((item) => {
          if (item instanceof Y.XmlText) {
            contentText += String(item.toString()) + '\n';
          } else if (item instanceof Y.XmlElement) {
            const extractText = (el: Y.XmlElement | Y.XmlText): string => {
              if (el instanceof Y.XmlText) {
                return String(el.toString());
              }
              let text = '';
              el.forEach((child: unknown) => {
                const childElement = child as Y.XmlElement | Y.XmlText;
                text += extractText(childElement);
              });
              return text;
            };
            contentText += extractText(item) + '\n';
          }
        });

        // Generate content preview
        const lines = contentText.split('\n');
        const contentAfterTitle = lines.slice(1).join('\n').trim();
        const contentPreview = contentAfterTitle.substring(0, 200);

        // Extract title
        let title = extractTitleFromDoc(doc, 'content');
        title = title.replace(/<[^>]+>/g, '').trim() || 'Untitled';

        // Get metadata from NoteDoc
        const crdtMetadata = noteDoc.getMetadata();
        const folderId = crdtMetadata.folderId;

        // Upsert into database
        await database.upsertNote({
          id: noteId,
          title,
          sdId,
          folderId,
          created: crdtMetadata.created,
          modified: crdtMetadata.modified,
          deleted: crdtMetadata.deleted,
          pinned: crdtMetadata.pinned,
          contentPreview,
          contentText,
        });

        // Unload the note (we just imported it, not opened it)
        await crdtManager.unloadNote(noteId);

        discoveredNotes.add(noteId);
        console.log(`[discoverNewNotes] Successfully imported note ${noteId}: "${title}"`);

        // Broadcast to all windows
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send('note:created', { sdId, noteId, folderId });
        }
      } catch (error: unknown) {
        console.error(`[discoverNewNotes] Failed to import note ${noteId}:`, error);
        await crdtManager.unloadNote(noteId).catch(() => {
          // Ignore unload errors
        });
      }
    }

    // If we discovered any notes, reload the folder tree to ensure folders are synced
    if (discoveredNotes.size > 0) {
      console.log(`[discoverNewNotes] Reloading folder tree for SD ${sdId}`);
      try {
        const folderTree = await crdtManager.loadFolderTree(sdId);
        const folders = folderTree.getActiveFolders();

        // Update folder cache
        for (const folder of folders) {
          await database.upsertFolder(folder);
        }

        // Broadcast folder update
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send('folder:updated', { sdId });
        }
      } catch (error) {
        console.error(`[discoverNewNotes] Failed to reload folder tree for SD ${sdId}:`, error);
      }
    }

    return discoveredNotes;
  } catch (error) {
    console.error(`[discoverNewNotes] Error discovering notes for SD ${sdId}:`, error);
    return discoveredNotes;
  }
}
