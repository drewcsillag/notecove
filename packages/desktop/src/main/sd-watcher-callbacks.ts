/**
 * SD Watcher Callback Factories
 *
 * Factory functions to create activity and deletion sync callbacks.
 * These are extracted from SDWatcherManager to reduce complexity.
 */

import { BrowserWindow } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import * as Y from 'yjs';
import type { Database } from '@notecove/shared';
import {
  extractTitleFromDoc,
  extractTextAndSnippet,
  resolveLinks,
  type ActivitySyncCallbacks,
  type DeletionSyncCallbacks,
} from '@notecove/shared';
import type { CRDTManager } from './crdt';
import { getSyncMetrics } from './telemetry/sync-metrics';

export interface ActivityCallbackContext {
  sdId: string;
  sdPath: string;
  crdtManager: CRDTManager;
  database: Database;
}

export interface DeletionCallbackContext {
  sdId: string;
  crdtManager: CRDTManager;
  database: Database;
}

/**
 * Create activity sync callbacks for a storage directory
 */
export function createActivitySyncCallbacks(
  context: ActivityCallbackContext
): ActivitySyncCallbacks {
  const { sdId, sdPath, crdtManager, database } = context;

  return {
    reloadNote: async (noteId: string, sdIdFromSync: string) => {
      // Debug: broadcast that we're attempting to reload
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('test:activity-watcher-debug', {
          sdId,
          filename: 'reloadNote',
          reason: 'reload-attempt',
          noteId,
        });
      }

      try {
        const existingNote = await database.getNote(noteId);

        if (!existingNote) {
          // Note created in another instance
          // Debug: broadcast that note doesn't exist
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('test:activity-watcher-debug', {
              sdId,
              filename: 'reloadNote',
              reason: 'note-not-exists',
              noteId,
            });
          }

          await crdtManager.loadNote(noteId, sdIdFromSync);

          // Extract metadata and insert into database
          const noteDoc = crdtManager.getNoteDoc(noteId);
          const doc = crdtManager.getDocument(noteId);
          if (!doc) {
            console.error(`[ActivitySync] Failed to get document for note ${noteId}`);
            // Debug: broadcast load failure
            for (const window of BrowserWindow.getAllWindows()) {
              window.webContents.send('test:activity-watcher-debug', {
                sdId,
                filename: 'reloadNote',
                reason: 'doc-load-failed',
                noteId,
              });
            }
            return;
          }

          const crdtMetadata = noteDoc?.getMetadata();
          const folderId = crdtMetadata?.folderId ?? null;

          // Extract text content for caching
          const content = doc.getXmlFragment('content');

          // Debug: broadcast content length
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('test:activity-watcher-debug', {
              sdId,
              filename: 'reloadNote',
              reason: 'content-length',
              noteId,
              contentLength: content.length,
            });
          }

          // Skip empty notes to prevent importing blank/incomplete notes
          // This prevents spurious blank notes appearing on startup
          //
          // IMPORTANT: Throw an error instead of returning, so pollAndReload
          // can retry with exponential backoff
          if (content.length === 0) {
            console.log(
              `[ActivitySync] Note ${noteId} has no content - file may be incomplete, will retry`
            );
            // Debug: broadcast empty note
            for (const window of BrowserWindow.getAllWindows()) {
              window.webContents.send('test:activity-watcher-debug', {
                sdId,
                filename: 'reloadNote',
                reason: 'empty-note-retrying',
                noteId,
              });
            }
            // Unload the note since we're not importing it
            await crdtManager.unloadNote(noteId);
            throw new Error('Note is incomplete - content is empty');
          }

          const { contentText, contentPreview } = extractTextAndSnippet(content, 200);

          // Extract title and strip any HTML/XML tags
          let newNoteTitle = extractTitleFromDoc(doc, 'content');
          newNoteTitle = newNoteTitle.replace(/<[^>]+>/g, '').trim() || 'Untitled';

          // Resolve [[uuid]] links to [[title]] in title and preview
          const linkResolver = async (linkNoteId: string) => {
            const linkedNote = await database.getNote(linkNoteId);
            return linkedNote?.title ?? null;
          };
          const resolvedTitle = await resolveLinks(newNoteTitle, linkResolver);
          const resolvedPreview = await resolveLinks(contentPreview, linkResolver);

          await database.upsertNote({
            id: noteId,
            title: resolvedTitle,
            sdId: sdIdFromSync,
            folderId,
            created: crdtMetadata?.created ?? Date.now(),
            modified: crdtMetadata?.modified ?? Date.now(),
            deleted: crdtMetadata?.deleted ?? false,
            pinned: crdtMetadata?.pinned ?? false,
            contentPreview: resolvedPreview,
            contentText,
          });

          // Broadcast to all windows
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('note:created', { sdId: sdIdFromSync, noteId, folderId });
          }

          // Debug: broadcast successful import
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('test:activity-watcher-debug', {
              sdId,
              filename: 'reloadNote',
              reason: 'note-imported',
              noteId,
              title: newNoteTitle,
            });
          }
        } else {
          // Note exists, reload and update metadata
          // First check if the note is currently loaded in memory
          const wasLoaded = crdtManager.getNoteDoc(noteId) !== undefined;

          if (wasLoaded) {
            // Note is open - reload it in place
            await crdtManager.reloadNote(noteId);
          } else {
            // Note is NOT open - temporarily load it to sync metadata
            // This is critical for syncing title/folder/pin changes on unopened notes
            await crdtManager.loadNote(noteId, existingNote.sdId);
          }

          // Extract updated title and metadata from the (now loaded) document
          const noteDoc = crdtManager.getNoteDoc(noteId);
          const doc = crdtManager.getDocument(noteId);
          if (doc) {
            // CRITICAL: Broadcast the updated CRDT state to all renderer windows
            // This allows TipTap editors to update their Y.Doc with the new state
            const stateUpdate = Y.encodeStateAsUpdate(doc);

            // Log actual content for debugging
            const contentFrag = doc.getXmlFragment('content');
            let debugContentText = '';
            contentFrag.forEach((item) => {
              if (item instanceof Y.XmlText) {
                debugContentText += String(item.toString());
              } else if (item instanceof Y.XmlElement) {
                item.forEach((child: unknown) => {
                  if (child instanceof Y.XmlText) {
                    debugContentText += String(child.toString());
                  }
                });
              }
            });

            console.log(
              `[ActivitySync] Broadcasting note:updated for ${noteId} (${stateUpdate.length} bytes), content: "${debugContentText.substring(0, 50)}..."`
            );
            for (const window of BrowserWindow.getAllWindows()) {
              window.webContents.send('note:updated', noteId, stateUpdate);
            }

            const crdtMetadata = noteDoc?.getMetadata();
            // Extract title and strip any HTML/XML tags
            let newTitle = extractTitleFromDoc(doc, 'content');
            newTitle = newTitle.replace(/<[^>]+>/g, '').trim() || 'Untitled';

            // Always re-extract content from CRDT to ensure proper formatting
            // (cached contentText may have old format without proper newlines)
            const content = doc.getXmlFragment('content');
            const extracted = extractTextAndSnippet(content, 200);
            const contentText = extracted.contentText;
            const contentPreview = extracted.contentPreview;

            // Resolve [[uuid]] links to [[title]] in title and preview
            const linkResolver = async (linkNoteId: string) => {
              const linkedNote = await database.getNote(linkNoteId);
              return linkedNote?.title ?? null;
            };
            const resolvedTitle = await resolveLinks(newTitle, linkResolver);
            const resolvedPreview = await resolveLinks(contentPreview, linkResolver);

            // Detect folder change (for note:moved event)
            const oldFolderId = existingNote.folderId;
            const newFolderId = crdtMetadata?.folderId ?? existingNote.folderId;
            const folderChanged = oldFolderId !== newFolderId;

            // Preserve deleted state from database if already deleted.
            // This prevents the sync from "undeleting" notes when CRDT writes
            // didn't complete before shutdown. Once a note is deleted locally,
            // it should stay deleted unless explicitly restored.
            const deletedState = existingNote.deleted ? true : (crdtMetadata?.deleted ?? false);

            await database.upsertNote({
              id: noteId,
              title: resolvedTitle,
              sdId: existingNote.sdId,
              folderId: newFolderId,
              created: existingNote.created,
              modified: crdtMetadata?.modified ?? Date.now(),
              deleted: deletedState,
              pinned: crdtMetadata?.pinned ?? existingNote.pinned,
              contentPreview: resolvedPreview,
              contentText,
            });

            // Broadcast title update to all windows (include modified for list reordering)
            const syncedModified = crdtMetadata?.modified ?? Date.now();
            for (const window of BrowserWindow.getAllWindows()) {
              window.webContents.send('note:title-updated', {
                noteId,
                title: resolvedTitle,
                modified: syncedModified,
                contentPreview: resolvedPreview,
              });
            }

            // Broadcast folder change if folderId changed (synced from another instance)
            if (folderChanged) {
              console.log(
                `[ActivitySync] Note ${noteId} folder changed: ${oldFolderId} -> ${newFolderId}`
              );
              for (const window of BrowserWindow.getAllWindows()) {
                window.webContents.send('note:moved', { noteId, oldFolderId, newFolderId });
              }
            }

            // If note wasn't originally loaded, unload it to free memory
            // Keep notes that were already open (user is editing them)
            if (!wasLoaded) {
              await crdtManager.unloadNote(noteId);
            }
          }
        }
      } catch (error) {
        console.error(`[ActivitySync] Error in reloadNote callback:`, error);
        // Debug: broadcast error
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send('test:activity-watcher-debug', {
            sdId,
            filename: 'reloadNote',
            reason: 'reload-error',
            noteId,
            error: String(error),
          });
        }
        // Re-throw the error so pollAndReload can handle it
        throw error;
      }
    },
    getLoadedNotes: () => crdtManager.getLoadedNotes(),
    checkCRDTLogExists: async (noteId: string, instanceId: string, expectedSequence: number) => {
      return crdtManager.checkCRDTLogExists(noteId, sdId, instanceId, expectedSequence);
    },
    checkNoteExists: (noteId: string) => {
      // Check if the note directory exists on disk
      // If it doesn't exist, the note was permanently deleted and we should skip syncing
      const noteDirPath = join(sdPath, 'notes', noteId);
      return Promise.resolve(existsSync(noteDirPath));
    },
    metrics: {
      recordSyncSuccess: (
        latencyMs: number,
        attempts: number,
        noteId: string,
        metricSdId: string
      ) => {
        getSyncMetrics().recordSyncSuccess(latencyMs, attempts, {
          note_id: noteId,
          sd_id: metricSdId,
        });
      },
      recordSyncFailure: (noteId: string, metricSdId: string) => {
        getSyncMetrics().recordSyncFailure({ note_id: noteId, sd_id: metricSdId });
      },
      recordSyncTimeout: (attempts: number, noteId: string, metricSdId: string) => {
        getSyncMetrics().recordSyncTimeout(attempts, { note_id: noteId, sd_id: metricSdId });
      },
      recordFullScan: (notesReloaded: number, metricSdId: string) => {
        getSyncMetrics().recordFullScan(notesReloaded, { sd_id: metricSdId });
      },
      recordActivityLogProcessed: (instanceIdAttr: string, metricSdId: string) => {
        getSyncMetrics().recordActivityLogProcessed({
          instance_id: instanceIdAttr,
          sd_id: metricSdId,
        });
      },
    },
  };
}

/**
 * Create deletion sync callbacks for a storage directory
 */
export function createDeletionSyncCallbacks(
  context: DeletionCallbackContext
): DeletionSyncCallbacks {
  const { sdId, crdtManager, database } = context;

  return {
    processRemoteDeletion: async (noteId: string) => {
      console.log(`[DeletionSync] Processing remote deletion for note ${noteId}`);

      // Check if note exists in database
      const existingNote = await database.getNote(noteId);
      if (!existingNote) {
        console.log(`[DeletionSync] Note ${noteId} already not in database`);
        return false;
      }

      // Delete from database
      await database.deleteNote(noteId);

      // Unload from CRDT manager if loaded
      if (crdtManager.getNoteDoc(noteId)) {
        await crdtManager.unloadNote(noteId);
      }

      // Broadcast to all windows
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('note:permanentDeleted', { noteId, sdId });
      }

      console.log(`[DeletionSync] Successfully processed remote deletion for note ${noteId}`);
      return true;
    },
    checkNoteExists: async (noteId: string) => {
      const note = await database.getNote(noteId);
      return note !== null;
    },
  };
}
