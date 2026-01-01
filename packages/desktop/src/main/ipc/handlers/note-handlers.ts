/**
 * Note Handlers (Core)
 *
 * IPC handlers for core note operations: load, unload, getState, applyUpdate,
 * create, delete, restore, permanentDelete.
 *
 * See also:
 * - note-edit-handlers.ts for duplicate, togglePin, move, moveToSD, updateTitle
 * - note-query-handlers.ts for getMetadata, checkExistsInSD, list, search, counts, etc.
 */

/* eslint-disable @typescript-eslint/require-await */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import * as Y from 'yjs';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { HandlerContext } from './types';
import type { UUID } from '@notecove/shared';
import { generateCompactId } from '@notecove/shared';
import { extractTags, extractLinks } from '@notecove/shared';

/**
 * Register all core note IPC handlers
 */
export function registerNoteHandlers(ctx: HandlerContext): void {
  ipcMain.handle('note:load', handleLoadNote(ctx));
  ipcMain.handle('note:unload', handleUnloadNote(ctx));
  ipcMain.handle('note:getState', handleGetState(ctx));
  ipcMain.handle('note:applyUpdate', handleApplyUpdate(ctx));
  ipcMain.handle('note:create', handleCreateNote(ctx));
  ipcMain.handle('note:delete', handleDeleteNote(ctx));
  ipcMain.handle('note:restore', handleRestoreNote(ctx));
  ipcMain.handle('note:permanentDelete', handlePermanentDeleteNote(ctx));
  ipcMain.handle('note:emptyTrash', handleEmptyTrash(ctx));
}

/**
 * Unregister all core note IPC handlers
 */
export function unregisterNoteHandlers(): void {
  ipcMain.removeHandler('note:load');
  ipcMain.removeHandler('note:unload');
  ipcMain.removeHandler('note:getState');
  ipcMain.removeHandler('note:applyUpdate');
  ipcMain.removeHandler('note:create');
  ipcMain.removeHandler('note:delete');
  ipcMain.removeHandler('note:restore');
  ipcMain.removeHandler('note:permanentDelete');
  ipcMain.removeHandler('note:emptyTrash');
}

// =============================================================================
// Handler Factories
// =============================================================================

function handleLoadNote(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, noteId: string): Promise<void> => {
    const { crdtManager, database } = ctx;

    // Get note from database to find its sdId
    const note = await database.getNote(noteId);
    if (!note) {
      throw new Error(`Cannot load note: note ${noteId} not found in database`);
    }
    const sdId = note.sdId;

    await crdtManager.loadNote(noteId, sdId);

    // Sync CRDT metadata to SQLite cache
    const noteDoc = crdtManager.getNoteDoc(noteId);
    if (noteDoc) {
      const crdtMetadata = noteDoc.getMetadata();

      // Only update if CRDT has initialized metadata
      if (crdtMetadata.id) {
        await database.upsertNote({
          ...note,
          folderId: crdtMetadata.folderId,
          created: crdtMetadata.created,
          modified: crdtMetadata.modified,
          deleted: crdtMetadata.deleted,
        });
      }
    }
  };
}

function handleUnloadNote(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, noteId: string): Promise<void> => {
    await ctx.crdtManager.unloadNote(noteId);
  };
}

function handleGetState(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    stateVector?: Uint8Array
  ): Promise<Uint8Array> => {
    const doc = ctx.crdtManager.getDocument(noteId);
    if (!doc) {
      throw new Error(`Note ${noteId} not loaded`);
    }

    if (stateVector) {
      console.log(
        `[handleGetState] Note ${noteId}: Received state vector (${stateVector.length} bytes)`
      );
      const update = Y.encodeStateAsUpdate(doc, stateVector);
      console.log(
        `[handleGetState] Note ${noteId}: Returning diff update (${update.length} bytes)`
      );
      return update;
    } else {
      console.log(`[handleGetState] Note ${noteId}: No state vector, returning full state`);
      const update = Y.encodeStateAsUpdate(doc);
      console.log(
        `[handleGetState] Note ${noteId}: Returning full update (${update.length} bytes)`
      );
      return update;
    }
  };
}

function handleApplyUpdate(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, noteId: string, update: Uint8Array): Promise<void> => {
    const { crdtManager, database, broadcastToAll, recordRecentEdit } = ctx;

    await crdtManager.applyUpdate(noteId, update);

    // Sync CRDT metadata back to SQLite cache
    try {
      const noteDoc = crdtManager.getNoteDoc(noteId);
      if (noteDoc) {
        const crdtMetadata = noteDoc.getMetadata();
        const cachedNote = await database.getNote(noteId);

        // Record this as a recent edit for polling group prioritization
        if (cachedNote && recordRecentEdit) {
          recordRecentEdit(noteId, cachedNote.sdId);
        }

        if (cachedNote) {
          const deleted = crdtMetadata.deleted;
          const folderId = crdtMetadata.folderId;
          const modified = crdtMetadata.modified;
          // NOTE: We intentionally do NOT sync sdId from CRDT metadata to the database.
          // Different profiles may have different SD IDs for the same path on disk.
          // The database's sdId represents which LOCAL SD the note belongs to, not
          // which SD the creating instance used.

          const metadataChanged =
            cachedNote.deleted !== deleted || cachedNote.folderId !== folderId;

          if (metadataChanged) {
            console.log(`[IPC] Syncing CRDT metadata to SQLite cache for note ${noteId}:`, {
              deleted,
              folderId,
            });

            await database.upsertNote({
              ...cachedNote,
              deleted,
              folderId,
              modified,
            });

            if (deleted && !cachedNote.deleted) {
              console.log(`[IPC] Broadcasting note:deleted event for synced deletion of ${noteId}`);
              broadcastToAll('note:deleted', noteId);
            } else if (!deleted && cachedNote.deleted) {
              console.log(
                `[IPC] Broadcasting note:restored event for synced restoration of ${noteId}`
              );
            }
          }
        }
      }
    } catch (err) {
      console.error(`[IPC] Failed to sync CRDT metadata to SQLite for note ${noteId}:`, err);
    }

    // Reindex tags after applying update
    try {
      const note = await database.getNote(noteId);
      if (note) {
        const doc = crdtManager.getDocument(noteId);
        if (doc) {
          const content = doc.getXmlFragment('content');
          let contentText = '';

          content.forEach((item) => {
            if (item instanceof Y.XmlText) {
              contentText += String(item.toString()) + '\n';
            } else if (item instanceof Y.XmlElement) {
              const extractText = (elem: Y.XmlElement): string => {
                let text = '';
                elem.forEach((child) => {
                  if (child instanceof Y.XmlText) {
                    text += String(child.toString());
                  } else if (child instanceof Y.XmlElement) {
                    text += extractText(child);
                  }
                });
                return text;
              };
              contentText += extractText(item) + '\n';
            }
          });

          // Extract and update tags
          const tags = extractTags(contentText);
          console.log(`[IPC] Reindexing ${tags.length} tags after CRDT update for note ${noteId}`);

          const existingTags = await database.getTagsForNote(noteId);
          const existingTagsMap = new Map(existingTags.map((t) => [t.name.toLowerCase(), t]));
          const newTagNames = new Set(tags);

          const tagsToRemove = existingTags.filter(
            (tag) => !newTagNames.has(tag.name.toLowerCase())
          );
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

          // Extract and update inter-note links
          const links = extractLinks(contentText);
          console.log(
            `[IPC] Reindexing ${links.length} inter-note links after CRDT update for note ${noteId}`
          );

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
        }
      }
    } catch (err) {
      console.error(
        `[IPC] Failed to reindex tags/links after CRDT update for note ${noteId}:`,
        err
      );
    }

    // Broadcast update to all other windows
    broadcastToAll('note:updated', noteId, update);
  };
}

function handleCreateNote(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string | null,
    initialContent?: string
  ): Promise<string> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    const noteId = generateCompactId();
    await crdtManager.loadNote(noteId, sdId);

    const noteDoc = crdtManager.getNoteDoc(noteId);
    if (noteDoc) {
      const now = Date.now();
      noteDoc.initializeNote({
        id: noteId,
        created: now,
        modified: now,
        sdId: sdId,
        folderId: folderId,
        deleted: false,
        pinned: false,
      });
    } else {
      console.error(`[Note] Failed to get NoteDoc for ${noteId} after loading`);
    }

    if (initialContent) {
      console.log('[Note] Initial content not yet implemented:', initialContent);
    }

    await database.upsertNote({
      id: noteId,
      title: 'Untitled',
      sdId,
      folderId,
      created: Date.now(),
      modified: Date.now(),
      deleted: false,
      pinned: false,
      contentPreview: '',
      contentText: '',
    });

    broadcastToAll('note:created', { sdId, noteId, folderId });

    return noteId;
  };
}

function handleDeleteNote(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, noteId: string): Promise<void> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    const note = await database.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    const now = Date.now();

    const noteDoc = crdtManager.getNoteDoc(noteId);
    if (noteDoc) {
      noteDoc.markDeleted();
      // Unpin note when deleting - pinned notes in trash don't make sense
      if (note.pinned) {
        noteDoc.updateMetadata({ pinned: false, modified: now });
      }
    } else {
      await crdtManager.loadNote(noteId, note.sdId);
      const loadedNoteDoc = crdtManager.getNoteDoc(noteId);
      if (loadedNoteDoc) {
        loadedNoteDoc.markDeleted();
        if (note.pinned) {
          loadedNoteDoc.updateMetadata({ pinned: false, modified: now });
        }
      } else {
        console.error(`[Note] Failed to load NoteDoc for ${noteId}`);
      }
    }

    await database.upsertNote({
      ...note,
      deleted: true,
      pinned: false, // Always unpin when deleting
      modified: now,
    });

    broadcastToAll('note:deleted', noteId);
  };
}

function handleRestoreNote(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, noteId: string): Promise<void> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    const note = await database.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    const noteDoc = crdtManager.getNoteDoc(noteId);
    if (noteDoc) {
      noteDoc.markRestored();
    } else {
      await crdtManager.loadNote(noteId, note.sdId);
      const loadedNoteDoc = crdtManager.getNoteDoc(noteId);
      if (loadedNoteDoc) {
        loadedNoteDoc.markRestored();
      } else {
        console.error(`[Note] Failed to load NoteDoc for ${noteId}`);
      }
    }

    await database.upsertNote({
      ...note,
      deleted: false,
      modified: Date.now(),
    });

    broadcastToAll('note:restored', noteId);
  };
}

// =============================================================================
// Exported Functions (used by other modules)
// =============================================================================

/**
 * Internal function to permanently delete a note (used by IPC handler and auto-cleanup)
 */
export async function permanentlyDeleteNote(
  ctx: HandlerContext,
  noteId: string,
  skipDeletedCheck = false
): Promise<void> {
  const { crdtManager, database, getDeletionLogger, broadcastToAll } = ctx;

  const logMsg = (msg: string) => {
    console.log(msg);
    if (process.env['NODE_ENV'] === 'test') {
      void fs
        .appendFile('/var/tmp/auto-cleanup.log', `${new Date().toISOString()} ${msg}\n`)
        .catch(() => {
          // Ignore logging errors
        });
    }
  };

  try {
    logMsg(`[permanentlyDeleteNote] Starting permanent delete for note ${noteId}`);

    const note = await database.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    logMsg(`[permanentlyDeleteNote] Found note ${noteId} in SD ${note.sdId}`);

    if (!skipDeletedCheck && !note.deleted) {
      throw new Error(`Note ${noteId} must be soft-deleted before permanent delete`);
    }

    await crdtManager.unloadNote(noteId);
    logMsg(`[permanentlyDeleteNote] Unloaded note ${noteId} from memory`);

    if (getDeletionLogger) {
      const deletionLogger = getDeletionLogger(note.sdId);
      if (deletionLogger) {
        await deletionLogger.recordDeletion(noteId);
        logMsg(`[permanentlyDeleteNote] Recorded deletion in deletion log for SD ${note.sdId}`);
      } else {
        logMsg(`[permanentlyDeleteNote] WARNING: No deletion logger found for SD ${note.sdId}`);
      }
    }

    const sd = await database.getStorageDir(note.sdId);
    if (!sd) {
      logMsg(
        `[permanentlyDeleteNote] WARNING: Storage directory ${note.sdId} not found, skipping file deletion`
      );
    } else {
      const noteDir = path.join(sd.path, 'notes', noteId);
      logMsg(`[permanentlyDeleteNote] Deleting note directory: ${noteDir}`);

      try {
        await fs.rm(noteDir, { recursive: true, force: true });
        logMsg(`[permanentlyDeleteNote] Successfully deleted note directory: ${noteDir}`);
      } catch (err) {
        logMsg(
          `[permanentlyDeleteNote] ERROR: Failed to delete note directory: ${noteDir}, error: ${String(err)}`
        );
      }
    }

    await database.deleteNote(noteId);
    logMsg(`[permanentlyDeleteNote] Deleted note ${noteId} from database`);

    if (noteId === 'default-note') {
      await database.setState('defaultNoteDeleted', 'true');
      logMsg(`[permanentlyDeleteNote] Marked default note as permanently deleted`);
    }

    broadcastToAll('note:permanentDeleted', noteId);
    logMsg(`[permanentlyDeleteNote] Broadcast permanentDeleted event for note ${noteId}`);
  } catch (err) {
    logMsg(`[permanentlyDeleteNote] ERROR permanently deleting note ${noteId}: ${String(err)}`);
    throw err;
  }
}

/**
 * Auto-cleanup: Permanently delete notes from Recently Deleted that are older than the threshold
 * This function should be called on app startup.
 * @param ctx Handler context
 * @param thresholdDays Number of days after which deleted notes should be permanently deleted (default: 30)
 */
export async function runAutoCleanup(ctx: HandlerContext, thresholdDays = 30): Promise<void> {
  const { database } = ctx;
  const cutoffTimestamp = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;

  const logMsg = (msg: string) => {
    console.log(msg);
    if (process.env['NODE_ENV'] === 'test') {
      void fs
        .appendFile('/var/tmp/auto-cleanup.log', `${new Date().toISOString()} ${msg}\n`)
        .catch(() => {
          // Ignore logging errors
        });
    }
  };

  logMsg(
    `[auto-cleanup] Starting auto-cleanup (threshold: ${thresholdDays} days, cutoff: ${cutoffTimestamp} = ${new Date(cutoffTimestamp).toISOString()})...`
  );

  try {
    // Get old deleted notes from database
    const noteIds: string[] = await database.autoCleanupDeletedNotes(thresholdDays);
    logMsg(`[auto-cleanup] Found ${noteIds.length} old notes to clean: ${JSON.stringify(noteIds)}`);

    if (noteIds.length > 0) {
      // Permanently delete each note (files + database entry)
      for (const noteId of noteIds) {
        try {
          logMsg(`[auto-cleanup] Permanently deleting note ${noteId}...`);
          await permanentlyDeleteNote(ctx, noteId, true); // Skip deleted check since we know they're deleted
          logMsg(`[auto-cleanup] Successfully deleted note ${noteId}`);
        } catch (err) {
          logMsg(`[auto-cleanup] Failed to permanently delete note ${noteId}: ${String(err)}`);
          // Continue with other notes even if one fails
        }
      }

      logMsg(`[auto-cleanup] Successfully cleaned up ${noteIds.length} notes`);
    } else {
      logMsg('[auto-cleanup] No notes to clean up');
    }
  } catch (err) {
    logMsg(`[auto-cleanup] Auto-cleanup failed: ${String(err)}`);
    // Don't throw - auto-cleanup failure should not prevent app startup
  }
}

function handlePermanentDeleteNote(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, noteId: string): Promise<void> => {
    await permanentlyDeleteNote(ctx, noteId, false);
  };
}

/**
 * Empty trash - permanently delete all notes in the trash for a specific SD
 * @returns The number of notes that were permanently deleted
 */
function handleEmptyTrash(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, sdId: string): Promise<number> => {
    const { database } = ctx;

    // Get all deleted notes for this SD
    const deletedNotes = await database.getDeletedNotes(sdId);

    if (deletedNotes.length === 0) {
      return 0;
    }

    let deletedCount = 0;

    // Permanently delete each note
    for (const note of deletedNotes) {
      try {
        await permanentlyDeleteNote(ctx, note.id, true); // Skip deleted check since we know they're deleted
        deletedCount++;
      } catch (err) {
        console.error(`[EmptyTrash] Failed to permanently delete note ${note.id}:`, err);
        // Continue with other notes even if one fails
      }
    }

    return deletedCount;
  };
}
