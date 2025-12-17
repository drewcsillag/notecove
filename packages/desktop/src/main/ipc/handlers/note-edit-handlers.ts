/**
 * Note Edit Handlers
 *
 * IPC handlers for note editing and organization operations:
 * duplicate, togglePin, move, moveToSD, updateTitle
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import * as Y from 'yjs';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { HandlerContext } from './types';
import type { NoteCache, UUID } from '@notecove/shared';
import { extractTags, extractLinks } from '@notecove/shared';

/**
 * Register all note edit IPC handlers
 */
export function registerNoteEditHandlers(ctx: HandlerContext): void {
  ipcMain.handle('note:duplicate', handleDuplicateNote(ctx));
  ipcMain.handle('note:togglePin', handleTogglePinNote(ctx));
  ipcMain.handle('note:move', handleMoveNote(ctx));
  ipcMain.handle('note:moveToSD', handleMoveNoteToSD(ctx));
  ipcMain.handle('note:updateTitle', handleUpdateTitle(ctx));
}

/**
 * Unregister all note edit IPC handlers
 */
export function unregisterNoteEditHandlers(): void {
  ipcMain.removeHandler('note:duplicate');
  ipcMain.removeHandler('note:togglePin');
  ipcMain.removeHandler('note:move');
  ipcMain.removeHandler('note:moveToSD');
  ipcMain.removeHandler('note:updateTitle');
}

// =============================================================================
// Handler Factories
// =============================================================================

function handleDuplicateNote(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, sourceNoteId: string): Promise<string> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    const sourceNote = await database.getNote(sourceNoteId);
    if (!sourceNote) {
      throw new Error(`Source note ${sourceNoteId} not found`);
    }

    const newNoteId = crypto.randomUUID();

    let sourceDoc = crdtManager.getDocument(sourceNoteId);
    const wasSourceLoaded = sourceDoc != null;

    if (!wasSourceLoaded) {
      await crdtManager.loadNote(sourceNoteId, sourceNote.sdId);
      sourceDoc = crdtManager.getDocument(sourceNoteId);
    }

    if (!sourceDoc) {
      throw new Error(`Failed to load CRDT document for source note ${sourceNoteId}`);
    }

    const sourceState = Y.encodeStateAsUpdate(sourceDoc);

    await crdtManager.loadNote(newNoteId, sourceNote.sdId);

    const newDoc = crdtManager.getDocument(newNoteId);
    if (!newDoc) {
      throw new Error(`Failed to get CRDT document for new note ${newNoteId}`);
    }

    Y.applyUpdate(newDoc, sourceState);

    // Update content to include "Copy of" prefix
    const contentFragment = newDoc.getXmlFragment('content');
    if (contentFragment.length > 0) {
      const firstElement = contentFragment.get(0);
      if (firstElement instanceof Y.XmlElement) {
        const firstText = firstElement.get(0);
        if (firstText instanceof Y.XmlText) {
          const currentText = firstText.toString() as string;
          if (typeof currentText === 'string' && !currentText.startsWith('Copy of ')) {
            firstText.insert(0, 'Copy of ');
          }
        }
      }
    }

    const now = Date.now();
    const newNoteDoc = crdtManager.getNoteDoc(newNoteId);
    if (newNoteDoc) {
      newNoteDoc.initializeNote({
        id: newNoteId,
        created: now,
        modified: now,
        sdId: sourceNote.sdId,
        folderId: sourceNote.folderId,
        deleted: false,
        pinned: false,
      });
    }

    const duplicateTitle = sourceNote.title.startsWith('Copy of ')
      ? sourceNote.title
      : `Copy of ${sourceNote.title}`;

    const duplicateContentText = sourceNote.contentText.startsWith('Copy of ')
      ? sourceNote.contentText
      : `Copy of ${sourceNote.contentText}`;
    const duplicateContentPreview = sourceNote.contentPreview.startsWith('Copy of ')
      ? sourceNote.contentPreview
      : `Copy of ${sourceNote.contentPreview}`;

    await database.upsertNote({
      id: newNoteId,
      title: duplicateTitle,
      sdId: sourceNote.sdId,
      folderId: sourceNote.folderId,
      created: now,
      modified: now,
      deleted: false,
      pinned: false,
      contentPreview: duplicateContentPreview,
      contentText: duplicateContentText,
    });

    if (!wasSourceLoaded) {
      await crdtManager.unloadNote(sourceNoteId);
    }

    broadcastToAll('note:created', {
      sdId: sourceNote.sdId,
      noteId: newNoteId,
      folderId: sourceNote.folderId,
    });

    return newNoteId;
  };
}

function handleTogglePinNote(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, noteId: string): Promise<void> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    const note = await database.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    const newPinned = !note.pinned;
    const now = Date.now();

    const noteDoc = crdtManager.getNoteDoc(noteId);
    if (noteDoc) {
      noteDoc.updateMetadata({
        pinned: newPinned,
        modified: now,
      });
    } else {
      await crdtManager.loadNote(noteId, note.sdId);
      const loadedNoteDoc = crdtManager.getNoteDoc(noteId);
      if (loadedNoteDoc) {
        loadedNoteDoc.updateMetadata({
          pinned: newPinned,
          modified: now,
        });
      }
    }

    await database.upsertNote({
      ...note,
      pinned: newPinned,
      modified: now,
    });

    broadcastToAll('note:pinned', { noteId, pinned: newPinned });
  };
}

function handleMoveNote(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    newFolderId: string | null
  ): Promise<void> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    const note = await database.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    const noteDoc = crdtManager.getNoteDoc(noteId);
    if (noteDoc) {
      noteDoc.updateMetadata({
        folderId: newFolderId,
        modified: Date.now(),
      });
    } else {
      await crdtManager.loadNote(noteId, note.sdId);
      const loadedNoteDoc = crdtManager.getNoteDoc(noteId);
      if (loadedNoteDoc) {
        loadedNoteDoc.updateMetadata({
          folderId: newFolderId,
          modified: Date.now(),
        });
      } else {
        console.error(`[Note] Failed to load NoteDoc for ${noteId}`);
      }
    }

    await database.upsertNote({
      ...note,
      folderId: newFolderId,
      modified: Date.now(),
    });

    broadcastToAll('note:moved', { noteId, oldFolderId: note.folderId, newFolderId });
  };
}

function handleMoveNoteToSD(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    sourceSdId: string,
    targetSdId: string,
    targetFolderId: string | null,
    conflictResolution: 'replace' | 'keepBoth' | null
  ): Promise<void> => {
    const { crdtManager, database, noteMoveManager, broadcastToAll } = ctx;

    const sourceNote = await database.getNote(noteId);
    if (sourceNote?.sdId !== sourceSdId) {
      throw new Error(`Note ${noteId} not found in source SD ${sourceSdId}`);
    }

    const targetNotes = await database.getNotesBySd(targetSdId);
    const existingNote = targetNotes.find((n) => n.id === noteId);
    const hasConflict = existingNote !== undefined && !existingNote.deleted;

    if (hasConflict && !conflictResolution) {
      throw new Error('Note already exists in target SD');
    }

    // Handle 'keepBoth' with legacy code path
    if (hasConflict && conflictResolution === 'keepBoth') {
      await moveNoteToSD_Legacy(ctx, noteId, sourceSdId, targetSdId, targetFolderId, sourceNote);
      return;
    }

    // Handle 'replace' by deleting existing
    if (hasConflict && conflictResolution === 'replace') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      await (database as any).adapter.exec('DELETE FROM notes WHERE id = ? AND sd_id = ?', [
        noteId,
        targetSdId,
      ]);
      console.log('[IPC] Deleted existing note from target SD for replace:', {
        noteId,
        targetSdId,
      });
    }

    const sourceSD = await database.getStorageDir(sourceSdId);
    const targetSD = await database.getStorageDir(targetSdId);

    if (!sourceSD?.uuid) {
      throw new Error(`Source SD ${sourceSdId} not found or missing UUID`);
    }
    if (!targetSD?.uuid) {
      throw new Error(`Target SD ${targetSdId} not found or missing UUID`);
    }

    const moveId = await noteMoveManager.initiateMove({
      noteId,
      sourceSdUuid: sourceSD.uuid,
      targetSdUuid: targetSD.uuid,
      targetFolderId,
      sourceSdPath: sourceSD.path,
      targetSdPath: targetSD.path,
      instanceId: '',
    });

    const result = await noteMoveManager.executeMove(moveId);

    if (!result.success) {
      throw new Error(result.error ?? 'Move failed');
    }

    await crdtManager.recordMoveActivity(noteId, targetSdId);

    broadcastToAll('note:deleted', noteId);
    broadcastToAll('note:created', {
      sdId: targetSdId,
      noteId: noteId,
      folderId: targetFolderId,
    });
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

async function moveNoteToSD_Legacy(
  ctx: HandlerContext,
  noteId: string,
  sourceSdId: string,
  targetSdId: string,
  targetFolderId: string | null,
  sourceNote: NoteCache
): Promise<void> {
  const { database, broadcastToAll } = ctx;

  const targetNoteId: string = crypto.randomUUID();

  await copyNoteCRDTFiles(ctx, noteId, sourceSdId, targetNoteId, targetSdId);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
  await (database as any).adapter.exec('BEGIN TRANSACTION');

  try {
    await database.upsertNote({
      id: targetNoteId,
      title: sourceNote.title,
      sdId: targetSdId,
      folderId: targetFolderId,
      created: sourceNote.created,
      modified: Date.now(),
      deleted: false,
      pinned: sourceNote.pinned,
      contentPreview: sourceNote.contentPreview,
      contentText: sourceNote.contentText,
    });
    console.log('[IPC] Created note in target SD:', {
      targetNoteId,
      targetSdId,
      targetFolderId,
      title: sourceNote.title,
    });

    await database.deleteNote(noteId);
    console.log('[IPC] Permanently deleted note from source SD:', {
      noteId,
      sourceSdId,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    await (database as any).adapter.exec('COMMIT');
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    await (database as any).adapter.exec('ROLLBACK');
    throw err;
  }

  broadcastToAll('note:deleted', noteId);
  broadcastToAll('note:created', {
    sdId: targetSdId,
    noteId: targetNoteId,
    folderId: targetFolderId,
  });
}

async function copyNoteCRDTFiles(
  ctx: HandlerContext,
  sourceNoteId: string,
  sourceSdId: string,
  targetNoteId: string,
  targetSdId: string
): Promise<void> {
  const { database } = ctx;

  console.log('[IPC] Copying CRDT files:', {
    sourceNoteId,
    sourceSdId,
    targetNoteId,
    targetSdId,
  });

  try {
    const sourceSD = await database.getStorageDir(sourceSdId);
    const targetSD = await database.getStorageDir(targetSdId);

    if (!sourceSD) {
      throw new Error(`Source SD ${sourceSdId} not found`);
    }
    if (!targetSD) {
      throw new Error(`Target SD ${targetSdId} not found`);
    }

    const sourceNoteDir = path.join(sourceSD.path, 'notes', sourceNoteId);
    const targetNoteDir = path.join(targetSD.path, 'notes', targetNoteId);

    try {
      await fs.access(sourceNoteDir);
      await copyDirectoryRecursive(sourceNoteDir, targetNoteDir);
      console.log('[IPC] Successfully copied CRDT files from', sourceNoteDir, 'to', targetNoteDir);
    } catch {
      console.warn(`[IPC] Source note directory not found: ${sourceNoteDir}`);
    }
  } catch (err) {
    console.error('[IPC] Failed to copy CRDT files:', err);
    throw err;
  }
}

async function copyDirectoryRecursive(source: string, destination: string): Promise<void> {
  await fs.mkdir(destination, { recursive: true });

  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryRecursive(sourcePath, destPath);
    } else {
      await fs.copyFile(sourcePath, destPath);
    }
  }
}

function handleUpdateTitle(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    title: string,
    contentText?: string
  ): Promise<void> => {
    const { database, broadcastToAll } = ctx;

    console.log(`[IPC] handleUpdateTitle called - noteId: ${noteId}, title: "${title}"`);

    const note = await database.getNote(noteId);
    if (!note) {
      console.error(`[IPC] Note ${noteId} not found in database`);
      throw new Error(`Note ${noteId} not found`);
    }

    console.log(`[IPC] Found note in database, current title: "${note.title}"`);

    const updates: Partial<typeof note> = {
      ...note,
      title,
      modified: Date.now(),
    };

    if (contentText !== undefined) {
      updates.contentText = contentText;
      const lines = contentText.split('\n');
      const contentAfterTitle = lines.slice(1).join('\n').trim();
      updates.contentPreview = contentAfterTitle.substring(0, 200);
    }

    await database.upsertNote(updates as typeof note);

    console.log(
      `[IPC] Title${contentText !== undefined ? ' and content' : ''} updated successfully in database`
    );

    // Extract and update tags if content was provided
    if (contentText !== undefined) {
      try {
        const tags = extractTags(contentText);
        console.log(`[IPC] Extracted ${tags.length} tags from note ${noteId}:`, tags);

        const existingTags = await database.getTagsForNote(noteId);
        const existingTagsMap = new Map(existingTags.map((t) => [t.name.toLowerCase(), t]));
        const newTagNames = new Set(tags);

        const tagsToRemove = existingTags.filter((tag) => !newTagNames.has(tag.name.toLowerCase()));
        const tagsToAdd = tags.filter((tagName) => !existingTagsMap.has(tagName));

        for (const tag of tagsToRemove) {
          console.log(`[IPC] Removing tag ${tag.name} from note ${noteId}`);
          await database.removeTagFromNote(noteId, tag.id);
        }

        for (const tagName of tagsToAdd) {
          let tag = await database.getTagByName(tagName);
          if (!tag) {
            console.log(`[IPC] Creating new tag: ${tagName}`);
            tag = await database.createTag(tagName);
          }
          console.log(`[IPC] Adding tag ${tag.name} to note ${noteId}`);
          await database.addTagToNote(noteId, tag.id);
        }

        console.log(`[IPC] Tags updated successfully for note ${noteId}`);

        // Extract and update inter-note links
        const links = extractLinks(contentText);
        console.log(`[IPC] Extracted ${links.length} inter-note links from note ${noteId}`);

        const existingLinks: UUID[] = await database.getLinksFromNote(noteId);
        const existingLinksSet = new Set<UUID>(existingLinks);
        const newLinksSet = new Set<UUID>(links);

        const linksToRemove: UUID[] = existingLinks.filter((linkId) => !newLinksSet.has(linkId));
        const linksToAdd: UUID[] = links.filter((linkId) => !existingLinksSet.has(linkId));

        for (const linkId of linksToRemove) {
          console.log(`[IPC] Removing link ${noteId} -> ${linkId}`);
          await database.removeLink(noteId, linkId);
        }

        for (const linkId of linksToAdd) {
          console.log(`[IPC] Adding link ${noteId} -> ${linkId}`);
          await database.addLink(noteId, linkId);
        }

        console.log(`[IPC] Links updated successfully for note ${noteId}`);
      } catch (err) {
        console.error(`[IPC] Failed to update tags/links for note ${noteId}:`, err);
      }
    }

    broadcastToAll('note:title-updated', { noteId, title });
  };
}
