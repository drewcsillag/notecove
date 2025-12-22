/**
 * Note Query Handlers
 *
 * IPC handlers for note query operations:
 * getMetadata, checkExistsInSD, list, search, counts, createSnapshot, getInfo, reloadFromCRDTLogs
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import * as Y from 'yjs';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { HandlerContext } from './types';
import type { NoteMetadata } from '../types';
import type { NoteCache } from '@notecove/shared';

/**
 * Register all note query IPC handlers
 */
export function registerNoteQueryHandlers(ctx: HandlerContext): void {
  ipcMain.handle('note:getMetadata', handleGetMetadata(ctx));
  ipcMain.handle('note:checkExistsInSD', handleCheckNoteExistsInSD(ctx));
  ipcMain.handle('note:list', handleListNotes(ctx));
  ipcMain.handle('note:search', handleSearchNotes(ctx));
  ipcMain.handle('note:getCountForFolder', handleGetNoteCountForFolder(ctx));
  ipcMain.handle('note:getAllNotesCount', handleGetAllNotesCount(ctx));
  ipcMain.handle('note:getDeletedNoteCount', handleGetDeletedNoteCount(ctx));
  ipcMain.handle('note:createSnapshot', handleCreateSnapshot(ctx));
  ipcMain.handle('note:getInfo', handleGetNoteInfo(ctx));
  ipcMain.handle('note:reloadFromCRDTLogs', handleReloadFromCRDTLogs(ctx));
}

/**
 * Unregister all note query IPC handlers
 */
export function unregisterNoteQueryHandlers(): void {
  ipcMain.removeHandler('note:getMetadata');
  ipcMain.removeHandler('note:checkExistsInSD');
  ipcMain.removeHandler('note:list');
  ipcMain.removeHandler('note:search');
  ipcMain.removeHandler('note:getCountForFolder');
  ipcMain.removeHandler('note:getAllNotesCount');
  ipcMain.removeHandler('note:getDeletedNoteCount');
  ipcMain.removeHandler('note:createSnapshot');
  ipcMain.removeHandler('note:getInfo');
  ipcMain.removeHandler('note:reloadFromCRDTLogs');
}

// =============================================================================
// Handler Factories
// =============================================================================

function handleGetMetadata(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, noteId: string): Promise<NoteMetadata> => {
    const { crdtManager, database } = ctx;

    const note = await database.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    const noteDoc = crdtManager.getNoteDoc(noteId);
    let crdtMetadata: import('@notecove/shared').NoteMetadata | null = null;

    if (noteDoc) {
      crdtMetadata = noteDoc.getMetadata();
    } else {
      await crdtManager.loadNote(noteId, note.sdId);
      const loadedNoteDoc = crdtManager.getNoteDoc(noteId);
      if (loadedNoteDoc) {
        crdtMetadata = loadedNoteDoc.getMetadata();
      }
    }

    return {
      noteId: noteId,
      sdId: note.sdId,
      title: note.title,
      folderId: crdtMetadata?.folderId ?? note.folderId ?? '',
      createdAt: crdtMetadata?.created ?? note.created,
      modifiedAt: crdtMetadata?.modified ?? note.modified,
      deleted: note.deleted,
    };
  };
}

function handleCheckNoteExistsInSD(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    targetSdId: string
  ): Promise<{ exists: boolean; isDeleted: boolean }> => {
    const note = await ctx.database.getNote(noteId);

    if (note?.sdId !== targetSdId) {
      return { exists: false, isDeleted: false };
    }

    return { exists: true, isDeleted: note.deleted };
  };
}

function handleListNotes(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId?: string | null
  ): Promise<NoteCache[]> => {
    const { database } = ctx;

    console.log('[IPC] note:list called with:', { sdId, folderId });

    let notes: NoteCache[];

    if (folderId && (folderId === 'all-notes' || folderId.startsWith('all-notes:'))) {
      notes = await database.getNotesBySd(sdId);
    } else if (
      folderId &&
      (folderId === 'recently-deleted' || folderId.startsWith('recently-deleted:'))
    ) {
      notes = await database.getDeletedNotes(sdId);
    } else if (folderId !== undefined) {
      notes = await database.getNotesByFolder(folderId);
    } else {
      notes = await database.getNotesBySd(sdId);
    }

    console.log('[IPC] note:list returning', notes.length, 'notes for sdId:', sdId);
    return notes;
  };
}

function handleSearchNotes(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    query: string,
    limit?: number
  ): Promise<import('@notecove/shared').SearchResult[]> => {
    return await ctx.database.searchNotes(query, limit);
  };
}

function handleGetNoteCountForFolder(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string | null
  ): Promise<number> => {
    return await ctx.database.getNoteCountForFolder(sdId, folderId);
  };
}

function handleGetAllNotesCount(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, sdId: string): Promise<number> => {
    return await ctx.database.getAllNotesCount(sdId);
  };
}

function handleGetDeletedNoteCount(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, sdId: string): Promise<number> => {
    return await ctx.database.getDeletedNoteCount(sdId);
  };
}

function handleCreateSnapshot(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string
  ): Promise<{ success: boolean; filename?: string; error?: string }> => {
    const { crdtManager, storageManager } = ctx;

    try {
      const noteDoc = crdtManager.getNoteDoc(noteId);
      if (!noteDoc) {
        throw new Error(`Note ${noteId} not loaded`);
      }

      const metadata = noteDoc.getMetadata();
      const sdId = metadata.sdId;

      const doc = crdtManager.getDocument(noteId);
      if (!doc) {
        throw new Error(`Note ${noteId} document not found`);
      }

      const encodedState = Y.encodeStateAsUpdate(doc);
      await storageManager.saveNoteSnapshot(sdId, noteId, encodedState);

      console.log(`[IPC] Manual snapshot created for note ${noteId}`);
      return { success: true, filename: 'db-snapshot' };
    } catch (error) {
      console.error(`[IPC] Failed to create snapshot for note ${noteId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
}

function handleGetNoteInfo(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string
  ): Promise<{
    id: string;
    title: string;
    sdId: string;
    sdName: string;
    sdPath: string;
    folderId: string | null;
    folderName: string | null;
    folderPath: string | null;
    fullFolderPath: string;
    created: number;
    modified: number;
    tags: string[];
    characterCount: number;
    wordCount: number;
    paragraphCount: number;
    vectorClock: Record<string, { sequence: number; offset: number; file: string }>;
    documentHash: string;
    crdtUpdateCount: number;
    noteDirPath: string;
    totalFileSize: number;
    snapshotCount: number;
    deleted: boolean;
    pinned: boolean;
    contentPreview: string;
  } | null> => {
    const { crdtManager, database, storageManager } = ctx;

    const note = await database.getNote(noteId);
    if (!note) {
      return null;
    }

    const sd = await database.getStorageDir(note.sdId);
    if (!sd) {
      return null;
    }

    let folderName: string | null = null;
    let folderPath: string | null = null;
    if (note.folderId) {
      const folder = await database.getFolder(note.folderId);
      if (folder) {
        folderName = folder.name;
        const pathParts: string[] = [folder.name];
        let currentFolder = folder;
        while (currentFolder.parentId) {
          const parentFolder = await database.getFolder(currentFolder.parentId);
          if (!parentFolder) break;
          pathParts.unshift(parentFolder.name);
          currentFolder = parentFolder;
        }
        folderPath = pathParts.join(' / ');
      }
    }

    const tagRecords = await database.getTagsForNote(noteId);
    const tags = tagRecords.map((t) => t.name);

    const doc = crdtManager.getDocument(noteId);

    const extractTextFromContent = (content: Y.XmlFragment): string => {
      let text = '';
      content.forEach((item) => {
        if (item instanceof Y.XmlText) {
          text += String(item.toString()) + '\n';
        } else if (item instanceof Y.XmlElement) {
          const extractText = (el: Y.XmlElement | Y.XmlText): string => {
            if (el instanceof Y.XmlText) {
              return String(el.toString());
            }
            let innerText = '';
            el.forEach((child: unknown) => {
              const childElement = child as Y.XmlElement | Y.XmlText;
              innerText += extractText(childElement);
            });
            return innerText;
          };
          text += extractText(item) + '\n';
        }
      });
      return text;
    };

    const countParagraphs = (content: Y.XmlFragment): number => {
      let count = 0;
      content.forEach((item) => {
        if (item instanceof Y.XmlText) {
          if (String(item.toString()).trim()) {
            count++;
          }
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
          if (extractText(item).trim()) {
            count++;
          }
        }
      });
      return count;
    };

    let contentText = '';
    let paragraphCount = 0;
    let characterCount = 0;
    let wordCount = 0;
    let vectorClock: Record<string, { sequence: number; offset: number; file: string }> = {};
    let documentHash = '';

    if (doc) {
      console.log(`[NoteInfo] Note ${noteId} is loaded in memory`);
      const content = doc.getXmlFragment('content');
      contentText = extractTextFromContent(content);
      paragraphCount = countParagraphs(content);
      characterCount = contentText.length;
      wordCount = contentText
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length;

      // Get vector clock from in-memory document snapshot (not storageManager's map)
      // The storageManager map only tracks local writes, but the snapshot has the full clock
      vectorClock = crdtManager.getVectorClock(noteId) ?? {};
      console.log(`[NoteInfo] Vector clock from snapshot:`, JSON.stringify(vectorClock));

      documentHash = crypto
        .createHash('sha256')
        .update(Y.encodeStateAsUpdate(doc))
        .digest('hex')
        .substring(0, 16);
    } else {
      console.log(`[NoteInfo] Note ${noteId} NOT in memory, checking DB cache`);
      const syncState = await database.getNoteSyncState(noteId, note.sdId);

      if (syncState) {
        console.log(`[NoteInfo] Found DB sync state, vectorClock from DB:`, syncState.vectorClock);
        try {
          vectorClock = JSON.parse(syncState.vectorClock) as Record<
            string,
            { sequence: number; offset: number; file: string }
          >;
        } catch {
          vectorClock = {};
        }

        if (syncState.documentState.length > 0) {
          try {
            const tempDoc = new Y.Doc();
            Y.applyUpdate(tempDoc, syncState.documentState);
            const content = tempDoc.getXmlFragment('content');
            contentText = extractTextFromContent(content);
            paragraphCount = countParagraphs(content);
            characterCount = contentText.length;
            wordCount = contentText
              .trim()
              .split(/\s+/)
              .filter((word) => word.length > 0).length;

            documentHash = crypto
              .createHash('sha256')
              .update(syncState.documentState)
              .digest('hex')
              .substring(0, 16);
          } catch (err) {
            console.error('[NoteInfo] Failed to parse document state from sync cache:', err);
          }
        }
      } else {
        console.log(`[NoteInfo] No DB cache for note ${noteId}, loading from disk`);
        try {
          const loadResult = await storageManager.loadNote(note.sdId, noteId);
          vectorClock = loadResult.vectorClock;
          console.log(`[NoteInfo] Loaded from disk, vectorClock:`, JSON.stringify(vectorClock));

          const content = loadResult.doc.getXmlFragment('content');
          contentText = extractTextFromContent(content);
          paragraphCount = countParagraphs(content);
          characterCount = contentText.length;
          wordCount = contentText
            .trim()
            .split(/\s+/)
            .filter((word) => word.length > 0).length;

          documentHash = crypto
            .createHash('sha256')
            .update(Y.encodeStateAsUpdate(loadResult.doc))
            .digest('hex')
            .substring(0, 16);

          loadResult.doc.destroy();
        } catch (err) {
          console.error(`[NoteInfo] Failed to load note ${noteId} from disk:`, err);
          // Leave vectorClock as empty - the load failed so we have no reliable source
        }
      }
    }

    const noteDir = path.join(sd.path, 'notes', noteId);
    const noteDirPath = noteDir;
    const logsDir = path.join(noteDir, 'logs');
    const snapshotsDir = path.join(noteDir, 'snapshots');

    let logs: string[] = [];
    let snapshots: string[] = [];

    try {
      logs = await fs.readdir(logsDir);
      logs = logs.filter((f) => f.endsWith('.crdtlog'));
    } catch {
      // Directory may not exist
    }

    try {
      snapshots = await fs.readdir(snapshotsDir);
      snapshots = snapshots.filter((f) => f.endsWith('.snapshot'));
    } catch {
      // Directory may not exist
    }

    const crdtUpdateCount = Object.values(vectorClock).reduce(
      (sum, entry) => sum + entry.sequence,
      0
    );
    const snapshotCount = snapshots.length;

    const logSizes = await Promise.all(
      logs.map(async (log) => {
        try {
          const logPath = path.join(logsDir, log);
          const stats = await fs.stat(logPath);
          return stats.size;
        } catch {
          return 0;
        }
      })
    );

    const snapshotSizes = await Promise.all(
      snapshots.map(async (snapshot) => {
        try {
          const snapshotPath = path.join(snapshotsDir, snapshot);
          const stats = await fs.stat(snapshotPath);
          return stats.size;
        } catch {
          return 0;
        }
      })
    );

    const totalFileSize =
      logSizes.reduce((sum, size) => sum + size, 0) +
      snapshotSizes.reduce((sum, size) => sum + size, 0);

    const fullFolderPath = folderPath ? `${sd.name} / ${folderPath}` : sd.name;

    return {
      id: noteId,
      title: note.title,
      sdId: note.sdId,
      sdName: sd.name,
      sdPath: sd.path,
      folderId: note.folderId,
      folderName,
      folderPath,
      fullFolderPath,
      created: note.created,
      modified: note.modified,
      tags,
      characterCount,
      wordCount,
      paragraphCount,
      vectorClock,
      documentHash,
      crdtUpdateCount,
      noteDirPath,
      totalFileSize,
      snapshotCount,
      deleted: note.deleted,
      pinned: note.pinned,
      contentPreview: note.contentPreview,
    };
  };
}

function handleReloadFromCRDTLogs(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const { crdtManager, database } = ctx;

    try {
      const note = await database.getNote(noteId);
      if (!note) {
        throw new Error(`Note ${noteId} not found`);
      }

      // Force unload the note to ensure it's removed from memory
      // This is necessary because refCount may be > 1 due to multiple handlers
      // calling loadNote(), and we need to guarantee a fresh reload from disk
      await crdtManager.forceUnloadNote(noteId);

      // Clear the sync state cache
      await database.deleteNoteSyncState(noteId, note.sdId);

      // Reload the note from CRDT logs
      await crdtManager.loadNote(noteId, note.sdId);

      // Get the new document state
      const newDoc = crdtManager.getNoteDoc(noteId);
      if (!newDoc) {
        throw new Error(`Failed to reload note ${noteId}`);
      }

      // Update database cache with reloaded data
      const metadata = newDoc.getMetadata();
      const content = crdtManager.getDocument(noteId)?.getXmlFragment('content');
      let contentText = '';
      if (content) {
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
      }

      const lines = contentText.split('\n');
      const title = lines[0]?.trim() ?? 'Untitled';
      const contentAfterTitle = lines.slice(1).join('\n').trim();
      const contentPreview = contentAfterTitle.substring(0, 200);

      await database.upsertNote({
        id: noteId,
        title,
        sdId: note.sdId,
        folderId: metadata.folderId,
        created: metadata.created,
        modified: metadata.modified,
        deleted: metadata.deleted,
        pinned: metadata.pinned,
        contentPreview,
        contentText,
      });

      console.log(`[ReloadFromCRDTLogs] Successfully reloaded note ${noteId} from CRDT logs`);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ReloadFromCRDTLogs] Error:`, error);
      return { success: false, error: errorMessage };
    }
  };
}
