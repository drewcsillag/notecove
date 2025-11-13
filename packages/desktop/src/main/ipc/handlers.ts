/**
 * IPC Command Handlers
 *
 * Handles commands from renderer processes.
 */

/* eslint-disable @typescript-eslint/require-await */

import { ipcMain, type IpcMainInvokeEvent, BrowserWindow, dialog } from 'electron';
import * as Y from 'yjs';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { CRDTManager } from '../crdt';
import type { NoteMetadata } from './types';
import type { Database, NoteCache, UpdateManager, UUID } from '@notecove/shared';
import type { ConfigManager } from '../config/manager';
import { extractTags, extractLinks } from '@notecove/shared';
import {
  TimelineBuilder,
  StateReconstructor,
  type ActivitySession,
  type ReconstructionPoint,
} from '@notecove/shared/history';
import { getTelemetryManager } from '../telemetry/config';
import type { NoteMoveManager } from '../note-move-manager';
import type { DiagnosticsManager } from '../diagnostics-manager';
import type { BackupManager } from '../backup-manager';

export class IPCHandlers {
  constructor(
    private crdtManager: CRDTManager,
    private database: Database,
    private configManager: ConfigManager,
    private updateManager: UpdateManager,
    private noteMoveManager: NoteMoveManager,
    private diagnosticsManager: DiagnosticsManager,
    private backupManager: BackupManager,
    private createWindowFn?: (options?: { noteId?: string; minimal?: boolean }) => void,
    private onStorageDirCreated?: (sdId: string, sdPath: string) => Promise<void>
  ) {
    this.registerHandlers();
  }

  /**
   * Broadcast an event to all renderer windows
   */
  private broadcastToAll(channel: string, ...args: unknown[]): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send(channel, ...args);
    }
  }

  /**
   * Auto-cleanup: Permanently delete notes from Recently Deleted that are older than the threshold
   * This method should be called on app startup.
   * @param thresholdDays Number of days after which deleted notes should be permanently deleted (default: 30)
   */
  async runAutoCleanup(thresholdDays = 30): Promise<void> {
    const cutoffTimestamp = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;
    const logMsg = (msg: string) => {
      console.log(msg);
      if (process.env['NODE_ENV'] === 'test') {
        // Also write to file for debugging E2E tests
        void fs
          .appendFile('/var/tmp/auto-cleanup.log', `${new Date().toISOString()} ${msg}\n`)
          .catch(() => {
            // ignore errors
          });
      }
    };

    logMsg(
      `[auto-cleanup] Starting auto-cleanup (threshold: ${thresholdDays} days, cutoff: ${cutoffTimestamp} = ${new Date(cutoffTimestamp).toISOString()})...`
    );

    try {
      // Get old deleted notes from database
      const noteIds: string[] = await this.database.autoCleanupDeletedNotes(thresholdDays);
      logMsg(
        `[auto-cleanup] Found ${noteIds.length} old notes to clean: ${JSON.stringify(noteIds)}`
      );

      if (noteIds.length > 0) {
        // Permanently delete each note (files + database entry)
        for (const noteId of noteIds) {
          try {
            logMsg(`[auto-cleanup] Permanently deleting note ${noteId}...`);
            await this.permanentlyDeleteNote(noteId, true); // Skip deleted check since we know they're deleted
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

  private registerHandlers(): void {
    // Note operations
    ipcMain.handle('note:load', this.handleLoadNote.bind(this));
    ipcMain.handle('note:unload', this.handleUnloadNote.bind(this));
    ipcMain.handle('note:getState', this.handleGetState.bind(this));
    ipcMain.handle('note:applyUpdate', this.handleApplyUpdate.bind(this));
    ipcMain.handle('note:create', this.handleCreateNote.bind(this));
    ipcMain.handle('note:delete', this.handleDeleteNote.bind(this));
    ipcMain.handle('note:restore', this.handleRestoreNote.bind(this));
    ipcMain.handle('note:permanentDelete', this.handlePermanentDeleteNote.bind(this));
    ipcMain.handle('note:duplicate', this.handleDuplicateNote.bind(this));
    ipcMain.handle('note:togglePin', this.handleTogglePinNote.bind(this));
    ipcMain.handle('note:move', this.handleMoveNote.bind(this));
    ipcMain.handle('note:moveToSD', this.handleMoveNoteToSD.bind(this));
    ipcMain.handle('note:getMetadata', this.handleGetMetadata.bind(this));
    ipcMain.handle('note:updateTitle', this.handleUpdateTitle.bind(this));
    ipcMain.handle('note:list', this.handleListNotes.bind(this));
    ipcMain.handle('note:search', this.handleSearchNotes.bind(this));
    ipcMain.handle('note:getCountForFolder', this.handleGetNoteCountForFolder.bind(this));
    ipcMain.handle('note:getAllNotesCount', this.handleGetAllNotesCount.bind(this));
    ipcMain.handle('note:getDeletedNoteCount', this.handleGetDeletedNoteCount.bind(this));
    ipcMain.handle('note:createSnapshot', this.handleCreateSnapshot.bind(this));
    ipcMain.handle('note:checkExistsInSD', this.handleCheckNoteExistsInSD.bind(this));
    ipcMain.handle('note:getInfo', this.handleGetNoteInfo.bind(this));

    // History operations
    ipcMain.handle('history:getTimeline', this.handleGetTimeline.bind(this));
    ipcMain.handle('history:getStats', this.handleGetHistoryStats.bind(this));
    ipcMain.handle('history:reconstructAt', this.handleReconstructAt.bind(this));
    ipcMain.handle('history:getSessionPreview', this.handleGetSessionPreview.bind(this));

    // Tag operations
    ipcMain.handle('tag:getAll', this.handleGetAllTags.bind(this));

    // Link operations
    ipcMain.handle('link:getBacklinks', this.handleGetBacklinks.bind(this));
    ipcMain.handle(
      'link:searchNotesForAutocomplete',
      this.handleSearchNotesForAutocomplete.bind(this)
    );

    // Folder operations
    ipcMain.handle('folder:list', this.handleListFolders.bind(this));
    ipcMain.handle('folder:listAll', this.handleListAllFolders.bind(this));
    ipcMain.handle('folder:get', this.handleGetFolder.bind(this));
    ipcMain.handle('folder:create', this.handleCreateFolder.bind(this));
    ipcMain.handle('folder:rename', this.handleRenameFolder.bind(this));
    ipcMain.handle('folder:delete', this.handleDeleteFolder.bind(this));
    ipcMain.handle('folder:move', this.handleMoveFolder.bind(this));

    // Storage Directory operations
    ipcMain.handle('sd:list', this.handleListStorageDirs.bind(this));
    ipcMain.handle('sd:create', this.handleCreateStorageDir.bind(this));
    ipcMain.handle('sd:setActive', this.handleSetActiveStorageDir.bind(this));
    ipcMain.handle('sd:getActive', this.handleGetActiveStorageDir.bind(this));
    ipcMain.handle('sd:delete', this.handleDeleteStorageDir.bind(this));
    ipcMain.handle('sd:selectPath', this.handleSelectSDPath.bind(this));
    ipcMain.handle('sd:getCloudStoragePaths', this.handleGetCloudStoragePaths.bind(this));

    // App state operations
    ipcMain.handle('appState:get', this.handleGetAppState.bind(this));
    ipcMain.handle('appState:set', this.handleSetAppState.bind(this));

    // Config operations
    ipcMain.handle('config:getDatabasePath', this.handleGetDatabasePath.bind(this));
    ipcMain.handle('config:setDatabasePath', this.handleSetDatabasePath.bind(this));

    // Telemetry operations
    ipcMain.handle('telemetry:getSettings', this.handleGetTelemetrySettings.bind(this));
    ipcMain.handle('telemetry:updateSettings', this.handleUpdateTelemetrySettings.bind(this));

    // Recovery operations
    ipcMain.handle('recovery:getStaleMoves', this.handleGetStaleMoves.bind(this));
    ipcMain.handle('recovery:takeOverMove', this.handleTakeOverMove.bind(this));
    ipcMain.handle('recovery:cancelMove', this.handleCancelMove.bind(this));

    // Diagnostics operations
    ipcMain.handle('diagnostics:getDuplicateNotes', this.handleGetDuplicateNotes.bind(this));
    ipcMain.handle('diagnostics:getOrphanedCRDTFiles', this.handleGetOrphanedCRDTFiles.bind(this));
    ipcMain.handle('diagnostics:getMissingCRDTFiles', this.handleGetMissingCRDTFiles.bind(this));
    ipcMain.handle(
      'diagnostics:getStaleMigrationLocks',
      this.handleGetStaleMigrationLocks.bind(this)
    );
    ipcMain.handle(
      'diagnostics:getOrphanedActivityLogs',
      this.handleGetOrphanedActivityLogs.bind(this)
    );
    ipcMain.handle(
      'diagnostics:removeStaleMigrationLock',
      this.handleRemoveStaleMigrationLock.bind(this)
    );
    ipcMain.handle(
      'diagnostics:cleanupOrphanedActivityLog',
      this.handleCleanupOrphanedActivityLog.bind(this)
    );
    ipcMain.handle('diagnostics:importOrphanedCRDT', this.handleImportOrphanedCRDT.bind(this));
    ipcMain.handle(
      'diagnostics:deleteMissingCRDTEntry',
      this.handleDeleteMissingCRDTEntry.bind(this)
    );
    ipcMain.handle('diagnostics:deleteDuplicateNote', this.handleDeleteDuplicateNote.bind(this));

    // Backup and restore operations
    ipcMain.handle(
      'backup:createPreOperationSnapshot',
      this.handleCreatePreOperationSnapshot.bind(this)
    );
    ipcMain.handle('backup:createManualBackup', this.handleCreateManualBackup.bind(this));
    ipcMain.handle('backup:listBackups', this.handleListBackups.bind(this));
    ipcMain.handle('backup:restoreFromBackup', this.handleRestoreFromBackup.bind(this));
    ipcMain.handle('backup:restoreFromCustomPath', this.handleRestoreFromCustomPath.bind(this));
    ipcMain.handle('backup:deleteBackup', this.handleDeleteBackup.bind(this));
    ipcMain.handle('backup:cleanupOldSnapshots', this.handleCleanupOldSnapshots.bind(this));
    ipcMain.handle('backup:setBackupDirectory', this.handleSetBackupDirectory.bind(this));
    ipcMain.handle('backup:getBackupDirectory', this.handleGetBackupDirectory.bind(this));

    // Testing operations (only register if createWindowFn provided)
    if (this.createWindowFn) {
      ipcMain.handle('testing:createWindow', this.handleCreateWindow.bind(this));
    }

    // Test-only operations (only available in NODE_ENV=test)
    if (process.env['NODE_ENV'] === 'test') {
      ipcMain.handle('test:setNoteTimestamp', this.handleSetNoteTimestamp.bind(this));
      ipcMain.handle('test:getAllTags', this.handleTestGetAllTags.bind(this));
      ipcMain.handle('test:getTagsForNote', this.handleTestGetTagsForNote.bind(this));
      ipcMain.handle('test:getNoteById', this.handleTestGetNoteById.bind(this));
    }
  }

  private async handleLoadNote(_event: IpcMainInvokeEvent, noteId: string): Promise<void> {
    // Get note from database to find its sdId
    const note = await this.database.getNote(noteId);
    const sdId = note?.sdId ?? 'default';

    await this.crdtManager.loadNote(noteId, sdId);

    // Sync CRDT metadata to SQLite cache
    const noteDoc = this.crdtManager.getNoteDoc(noteId);
    if (noteDoc) {
      const crdtMetadata = noteDoc.getMetadata();

      // Only update if note exists in cache and CRDT has initialized metadata
      if (note && crdtMetadata.id) {
        await this.database.upsertNote({
          ...note,
          folderId: crdtMetadata.folderId,
          created: crdtMetadata.created,
          modified: crdtMetadata.modified,
          deleted: crdtMetadata.deleted,
        });
      }
    }
  }

  private async handleUnloadNote(_event: IpcMainInvokeEvent, noteId: string): Promise<void> {
    await this.crdtManager.unloadNote(noteId);
  }

  private async handleCreateSnapshot(
    _event: IpcMainInvokeEvent,
    noteId: string
  ): Promise<{ success: boolean; filename?: string; error?: string }> {
    try {
      const noteDoc = this.crdtManager.getNoteDoc(noteId);
      if (!noteDoc) {
        throw new Error(`Note ${noteId} not loaded`);
      }

      const metadata = noteDoc.getMetadata();
      const sdId = metadata.sdId;

      // Build vector clock from existing update files
      const vectorClock = await this.updateManager.buildVectorClock(sdId, noteId);

      // Get full document state
      const doc = this.crdtManager.getDocument(noteId);
      if (!doc) {
        throw new Error(`Note ${noteId} document not found`);
      }
      const documentState = Y.encodeStateAsUpdate(doc);

      // Write snapshot
      const filename = await this.updateManager.writeSnapshot(
        sdId,
        noteId,
        documentState,
        vectorClock
      );

      console.log(`[IPC] Manual snapshot created for note ${noteId}: ${filename}`);
      return { success: true, filename };
    } catch (error) {
      console.error(`[IPC] Failed to create snapshot for note ${noteId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async handleGetState(_event: IpcMainInvokeEvent, noteId: string): Promise<Uint8Array> {
    const doc = this.crdtManager.getDocument(noteId);
    if (!doc) {
      throw new Error(`Note ${noteId} not loaded`);
    }
    // Encode the entire document state as an update
    return Y.encodeStateAsUpdate(doc);
  }

  private async handleApplyUpdate(
    _event: IpcMainInvokeEvent,
    noteId: string,
    update: Uint8Array
  ): Promise<void> {
    await this.crdtManager.applyUpdate(noteId, update);

    // Sync CRDT metadata back to SQLite cache
    // This ensures that metadata changes (like deleted flag) are reflected in the cache
    try {
      const noteDoc = this.crdtManager.getNoteDoc(noteId);
      if (noteDoc) {
        const crdtMetadata = noteDoc.getMetadata();
        const cachedNote = await this.database.getNote(noteId);

        if (cachedNote) {
          // Check if metadata has changed and needs to be synced to SQLite
          const metadataChanged =
            cachedNote.deleted !== crdtMetadata.deleted ||
            cachedNote.folderId !== crdtMetadata.folderId ||
            cachedNote.sdId !== crdtMetadata.sdId;

          if (metadataChanged) {
            console.log(`[IPC] Syncing CRDT metadata to SQLite cache for note ${noteId}:`, {
              deleted: crdtMetadata.deleted,
              folderId: crdtMetadata.folderId,
              sdId: crdtMetadata.sdId,
            });

            // Update SQLite cache with CRDT metadata
            await this.database.upsertNote({
              ...cachedNote,
              deleted: crdtMetadata.deleted,
              folderId: crdtMetadata.folderId,
              sdId: crdtMetadata.sdId,
              modified: crdtMetadata.modified,
            });

            // If note was deleted, broadcast delete event
            if (crdtMetadata.deleted && !cachedNote.deleted) {
              console.log(`[IPC] Broadcasting note:deleted event for synced deletion of ${noteId}`);
              this.broadcastToAll('note:deleted', noteId);
            }
            // If note was restored, broadcast restore event
            else if (!crdtMetadata.deleted && cachedNote.deleted) {
              console.log(
                `[IPC] Broadcasting note:restored event for synced restoration of ${noteId}`
              );
              // Note: There's no explicit note:restored event, so we use note:updated
              // The UI will pick up the change when it refreshes
            }
          }
        }
      }
    } catch (err) {
      console.error(`[IPC] Failed to sync CRDT metadata to SQLite for note ${noteId}:`, err);
      // Don't throw - metadata sync failure should not prevent update broadcast
    }

    // Reindex tags after applying update
    // This ensures tags are indexed even when updates come from other windows
    try {
      const note = await this.database.getNote(noteId);
      if (note) {
        const doc = this.crdtManager.getDocument(noteId);
        if (doc) {
          // Extract plain text from the document
          const content = doc.getXmlFragment('content');
          let contentText = '';

          // Simple text extraction from Y.XmlFragment
          content.forEach((item) => {
            if (item instanceof Y.XmlText) {
              contentText += String(item.toString()) + '\n';
            } else if (item instanceof Y.XmlElement) {
              // Recursively extract text from elements
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

          // Get existing tags for this note
          const existingTags = await this.database.getTagsForNote(noteId);
          const existingTagsMap = new Map(existingTags.map((t) => [t.name.toLowerCase(), t]));

          // Build a set of new tag names for O(1) lookup
          const newTagNames = new Set(tags);

          // Determine which tags to remove
          const tagsToRemove = existingTags.filter(
            (tag) => !newTagNames.has(tag.name.toLowerCase())
          );

          // Determine which tags to add
          const tagsToAdd = tags.filter((tagName) => !existingTagsMap.has(tagName));

          // Process removals
          for (const tag of tagsToRemove) {
            console.log(`[IPC] Removing tag ${tag.name} from note ${noteId}`);
            await this.database.removeTagFromNote(noteId, tag.id);
          }

          // Process additions
          for (const tagName of tagsToAdd) {
            let tag = await this.database.getTagByName(tagName);
            if (!tag) {
              console.log(`[IPC] Creating new tag: ${tagName}`);
              tag = await this.database.createTag(tagName);
            }
            console.log(`[IPC] Adding tag ${tag.name} to note ${noteId}`);
            await this.database.addTagToNote(noteId, tag.id);
          }

          // Extract and update inter-note links
          const links = extractLinks(contentText);
          console.log(
            `[IPC] Reindexing ${links.length} inter-note links after CRDT update for note ${noteId}`
          );

          // Get existing links for this note
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
          const existingLinks: UUID[] = await this.database.getLinksFromNote(noteId);
          const existingLinksSet = new Set<UUID>(existingLinks);

          // Build a set of new link IDs for O(1) lookup
          const newLinksSet = new Set<UUID>(links);

          // Determine which links to remove
          const linksToRemove: UUID[] = existingLinks.filter((linkId) => !newLinksSet.has(linkId));

          // Determine which links to add
          const linksToAdd: UUID[] = links.filter((linkId) => !existingLinksSet.has(linkId));

          // Process removals
          for (const linkId of linksToRemove) {
            console.log(`[IPC] Removing link ${noteId} -> ${linkId}`);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            await this.database.removeLink(noteId, linkId);
          }

          // Process additions
          for (const linkId of linksToAdd) {
            console.log(`[IPC] Adding link ${noteId} -> ${linkId}`);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            await this.database.addLink(noteId, linkId);
          }
        }
      }
    } catch (err) {
      console.error(
        `[IPC] Failed to reindex tags/links after CRDT update for note ${noteId}:`,
        err
      );
      // Don't throw - tag/link indexing failure should not prevent update broadcast
    }

    // Broadcast update to all other windows
    this.broadcastToAll('note:updated', noteId, update);
  }

  private async handleCreateNote(
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string | null,
    initialContent?: string
  ): Promise<string> {
    // Generate new note ID
    const noteId = crypto.randomUUID();

    // Load the note (creates empty CRDT document) with explicit sdId
    await this.crdtManager.loadNote(noteId, sdId);

    // Initialize CRDT metadata with SD and folder association
    const noteDoc = this.crdtManager.getNoteDoc(noteId);
    if (noteDoc) {
      const now = Date.now();
      noteDoc.initializeNote({
        id: noteId,
        created: now,
        modified: now,
        sdId: sdId,
        folderId: folderId,
        deleted: false,
      });
    } else {
      console.error(`[Note] Failed to get NoteDoc for ${noteId} after loading`);
    }

    // If initial content provided, apply it to the CRDT
    if (initialContent) {
      // TODO: Convert initialContent to ProseMirror structure and insert
      // For now, just create empty document
      console.log('[Note] Initial content not yet implemented:', initialContent);
    }

    // Create note cache entry in SQLite
    await this.database.upsertNote({
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

    // Broadcast note creation to all windows
    this.broadcastToAll('note:created', { sdId, noteId, folderId });

    return noteId;
  }

  private async handleDeleteNote(_event: IpcMainInvokeEvent, noteId: string): Promise<void> {
    // Get the note from cache
    const note = await this.database.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    // Update CRDT metadata to mark as deleted (soft delete)
    const noteDoc = this.crdtManager.getNoteDoc(noteId);
    if (noteDoc) {
      noteDoc.markDeleted();
    } else {
      // Note not loaded in memory, load it first with its sdId
      await this.crdtManager.loadNote(noteId, note.sdId);
      const loadedNoteDoc = this.crdtManager.getNoteDoc(noteId);
      if (loadedNoteDoc) {
        loadedNoteDoc.markDeleted();
      } else {
        console.error(`[Note] Failed to load NoteDoc for ${noteId}`);
      }
    }

    // Update SQLite cache
    await this.database.upsertNote({
      ...note,
      deleted: true,
      modified: Date.now(),
    });

    // Broadcast delete event to all windows
    this.broadcastToAll('note:deleted', noteId);
  }

  private async handleRestoreNote(_event: IpcMainInvokeEvent, noteId: string): Promise<void> {
    // Get the note from cache
    const note = await this.database.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    // Update CRDT metadata to mark as not deleted
    const noteDoc = this.crdtManager.getNoteDoc(noteId);
    if (noteDoc) {
      noteDoc.markRestored();
    } else {
      // Note not loaded in memory, load it first with its sdId
      await this.crdtManager.loadNote(noteId, note.sdId);
      const loadedNoteDoc = this.crdtManager.getNoteDoc(noteId);
      if (loadedNoteDoc) {
        loadedNoteDoc.markRestored();
      } else {
        console.error(`[Note] Failed to load NoteDoc for ${noteId}`);
      }
    }

    // Update SQLite cache
    await this.database.upsertNote({
      ...note,
      deleted: false,
      modified: Date.now(),
    });

    // Broadcast restore event to all windows
    this.broadcastToAll('note:restored', noteId);
  }

  /**
   * Internal method to permanently delete a note (used by both IPC handler and auto-cleanup)
   */
  private async permanentlyDeleteNote(noteId: string, skipDeletedCheck = false): Promise<void> {
    const logMsg = (msg: string) => {
      console.log(msg);
      if (process.env['NODE_ENV'] === 'test') {
        void fs
          .appendFile('/var/tmp/auto-cleanup.log', `${new Date().toISOString()} ${msg}\n`)
          .catch(() => {
            // ignore errors
          });
      }
    };

    try {
      logMsg(`[permanentlyDeleteNote] Starting permanent delete for note ${noteId}`);

      // Get the note from cache
      const note = await this.database.getNote(noteId);
      if (!note) {
        throw new Error(`Note ${noteId} not found`);
      }

      logMsg(`[permanentlyDeleteNote] Found note ${noteId} in SD ${note.sdId}`);

      // Note must be deleted (in Recently Deleted) before permanent delete (unless skipping check)
      if (!skipDeletedCheck && !note.deleted) {
        throw new Error(`Note ${noteId} must be soft-deleted before permanent delete`);
      }

      // Unload note from memory if loaded
      await this.crdtManager.unloadNote(noteId);
      logMsg(`[permanentlyDeleteNote] Unloaded note ${noteId} from memory`);

      // Delete CRDT files from disk
      const sd = await this.database.getStorageDir(note.sdId);
      if (!sd) {
        logMsg(
          `[permanentlyDeleteNote] WARNING: Storage directory ${note.sdId} not found, skipping file deletion`
        );
      } else {
        const noteDir = path.join(sd.path, 'notes', noteId);
        logMsg(`[permanentlyDeleteNote] Deleting note directory: ${noteDir}`);

        try {
          // Delete the entire note directory (contains updates/ and meta/ subdirs)
          await fs.rm(noteDir, { recursive: true, force: true });
          logMsg(`[permanentlyDeleteNote] Successfully deleted note directory: ${noteDir}`);
        } catch (err) {
          logMsg(
            `[permanentlyDeleteNote] ERROR: Failed to delete note directory: ${noteDir}, error: ${String(err)}`
          );
          // Continue anyway - we still want to remove from database
        }
      }

      // Delete from SQLite cache
      await this.database.deleteNote(noteId);
      logMsg(`[permanentlyDeleteNote] Deleted note ${noteId} from database`);

      // If this is the default welcome note, mark it as permanently deleted so it won't be recreated
      if (noteId === 'default-note') {
        await this.database.setState('defaultNoteDeleted', 'true');
        logMsg(`[permanentlyDeleteNote] Marked default note as permanently deleted`);
      }

      // Broadcast permanent delete event to all windows
      this.broadcastToAll('note:permanentDeleted', noteId);
      logMsg(`[permanentlyDeleteNote] Broadcast permanentDeleted event for note ${noteId}`);
    } catch (err) {
      // Log error but don't throw to prevent app crash
      logMsg(`[permanentlyDeleteNote] ERROR permanently deleting note ${noteId}: ${String(err)}`);
      throw err; // Re-throw for IPC handler, but caught in auto-cleanup
    }
  }

  private async handlePermanentDeleteNote(
    _event: IpcMainInvokeEvent,
    noteId: string
  ): Promise<void> {
    await this.permanentlyDeleteNote(noteId, false);
  }

  private async handleDuplicateNote(
    _event: IpcMainInvokeEvent,
    sourceNoteId: string
  ): Promise<string> {
    // Get the source note from cache
    const sourceNote = await this.database.getNote(sourceNoteId);
    if (!sourceNote) {
      throw new Error(`Source note ${sourceNoteId} not found`);
    }

    // Generate new note ID for the duplicate
    const newNoteId = crypto.randomUUID();

    // Load source note to get its CRDT state (if not already loaded)
    let sourceDoc = this.crdtManager.getDocument(sourceNoteId);
    const wasSourceLoaded = sourceDoc != null;

    if (!wasSourceLoaded) {
      await this.crdtManager.loadNote(sourceNoteId, sourceNote.sdId);
      sourceDoc = this.crdtManager.getDocument(sourceNoteId);
    }

    // Ensure sourceDoc is loaded
    if (!sourceDoc) {
      throw new Error(`Failed to load CRDT document for source note ${sourceNoteId}`);
    }

    // Get the full state as an update
    const sourceState = Y.encodeStateAsUpdate(sourceDoc);

    // Create new note with the same SD and folder
    await this.crdtManager.loadNote(newNoteId, sourceNote.sdId);

    // Get the new note document
    const newDoc = this.crdtManager.getDocument(newNoteId);
    if (!newDoc) {
      throw new Error(`Failed to get CRDT document for new note ${newNoteId}`);
    }

    // Apply the source note's state to the new note
    Y.applyUpdate(newDoc, sourceState);

    // Update the actual document content to include "Copy of" prefix
    // This ensures title extraction will preserve the prefix
    const contentFragment = newDoc.getXmlFragment('content');
    if (contentFragment.length > 0) {
      // Get the first element (paragraph or heading)
      const firstElement = contentFragment.get(0);
      if (firstElement instanceof Y.XmlElement) {
        // Get the first text node within the element
        const firstText = firstElement.get(0);
        if (firstText instanceof Y.XmlText) {
          // Get the current text content
          const currentText = firstText.toString() as string;
          // Only prepend if it doesn't already start with "Copy of"
          if (typeof currentText === 'string' && !currentText.startsWith('Copy of ')) {
            // Prepend "Copy of " to the text content
            firstText.insert(0, 'Copy of ');
          }
        }
      }
    }

    // Update the metadata for the duplicate
    const now = Date.now();
    const newNoteDoc = this.crdtManager.getNoteDoc(newNoteId);
    if (newNoteDoc) {
      newNoteDoc.initializeNote({
        id: newNoteId,
        created: now,
        modified: now,
        sdId: sourceNote.sdId,
        folderId: sourceNote.folderId,
        deleted: false,
      });
    }

    // Generate title for duplicate (will match the content now)
    const duplicateTitle = sourceNote.title.startsWith('Copy of ')
      ? sourceNote.title
      : `Copy of ${sourceNote.title}`;

    // Update content preview and text to include "Copy of" prefix
    const duplicateContentText = sourceNote.contentText.startsWith('Copy of ')
      ? sourceNote.contentText
      : `Copy of ${sourceNote.contentText}`;
    const duplicateContentPreview = sourceNote.contentPreview.startsWith('Copy of ')
      ? sourceNote.contentPreview
      : `Copy of ${sourceNote.contentPreview}`;

    // Create note cache entry in SQLite
    await this.database.upsertNote({
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

    // Unload source note if it wasn't loaded before
    if (!wasSourceLoaded) {
      await this.crdtManager.unloadNote(sourceNoteId);
    }

    // Broadcast note creation to all windows
    this.broadcastToAll('note:created', {
      sdId: sourceNote.sdId,
      noteId: newNoteId,
      folderId: sourceNote.folderId,
    });

    return newNoteId;
  }

  private async handleTogglePinNote(_event: IpcMainInvokeEvent, noteId: string): Promise<void> {
    // Get the note from cache
    const note = await this.database.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    // Toggle pinned status in SQLite cache only (not in CRDT)
    await this.database.upsertNote({
      ...note,
      pinned: !note.pinned,
      modified: Date.now(),
    });

    // Broadcast pin event to all windows
    this.broadcastToAll('note:pinned', { noteId, pinned: !note.pinned });
  }

  private async handleMoveNote(
    _event: IpcMainInvokeEvent,
    noteId: string,
    newFolderId: string | null
  ): Promise<void> {
    // Get the note from cache to find its current location
    const note = await this.database.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    // Update CRDT metadata with new folder
    const noteDoc = this.crdtManager.getNoteDoc(noteId);
    if (noteDoc) {
      noteDoc.updateMetadata({
        folderId: newFolderId,
        modified: Date.now(),
      });
    } else {
      // Note not loaded in memory, load it first with its sdId
      await this.crdtManager.loadNote(noteId, note.sdId);
      const loadedNoteDoc = this.crdtManager.getNoteDoc(noteId);
      if (loadedNoteDoc) {
        loadedNoteDoc.updateMetadata({
          folderId: newFolderId,
          modified: Date.now(),
        });
      } else {
        console.error(`[Note] Failed to load NoteDoc for ${noteId}`);
      }
    }

    // Update SQLite cache
    await this.database.upsertNote({
      ...note,
      folderId: newFolderId,
      modified: Date.now(),
    });

    // Broadcast move event
    this.broadcastToAll('note:moved', { noteId, oldFolderId: note.folderId, newFolderId });
  }

  /**
   * Move note to different Storage Directory (cross-SD move)
   * Phase 2.5.7.4: Cross-SD Drag & Drop
   * Phase 4.1bis.1.1: State machine for atomic moves with crash recovery
   */
  private async handleMoveNoteToSD(
    _event: IpcMainInvokeEvent,
    noteId: string,
    sourceSdId: string,
    targetSdId: string,
    targetFolderId: string | null,
    conflictResolution: 'replace' | 'keepBoth' | null
  ): Promise<void> {
    // Get source note from cache
    const sourceNote = await this.database.getNote(noteId);
    if (sourceNote?.sdId !== sourceSdId) {
      throw new Error(`Note ${noteId} not found in source SD ${sourceSdId}`);
    }

    // Check for conflicts in target SD by querying all notes in target SD
    const targetNotes = await this.database.getNotesBySd(targetSdId);
    const existingNote = targetNotes.find((n) => n.id === noteId);

    // Only consider it a conflict if the note exists and is NOT deleted
    const hasConflict = existingNote !== undefined && !existingNote.deleted;

    if (hasConflict && !conflictResolution) {
      throw new Error('Note already exists in target SD');
    }

    // Handle 'keepBoth' conflict resolution using old code path
    // TODO: Extend NoteMoveManager to support keepBoth (generating new UUID for target)
    if (hasConflict && conflictResolution === 'keepBoth') {
      return this.handleMoveNoteToSD_Legacy(
        noteId,
        sourceSdId,
        targetSdId,
        targetFolderId,
        sourceNote
      );
    }

    // Handle 'replace' conflict resolution by deleting existing note first
    if (hasConflict && conflictResolution === 'replace') {
      // Delete the existing note from target SD
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      await (this.database as any).adapter.exec('DELETE FROM notes WHERE id = ? AND sd_id = ?', [
        noteId,
        targetSdId,
      ]);
      console.log('[IPC] Deleted existing note from target SD for replace:', {
        noteId,
        targetSdId,
      });
    }

    // Use NoteMoveManager state machine for atomic move with crash recovery
    // Get SD information including UUIDs
    const sourceSD = await this.database.getStorageDir(sourceSdId);
    const targetSD = await this.database.getStorageDir(targetSdId);

    if (!sourceSD?.uuid) {
      throw new Error(`Source SD ${sourceSdId} not found or missing UUID`);
    }
    if (!targetSD?.uuid) {
      throw new Error(`Target SD ${targetSdId} not found or missing UUID`);
    }

    // Initiate the move using state machine
    const moveId = await this.noteMoveManager.initiateMove({
      noteId,
      sourceSdUuid: sourceSD.uuid,
      targetSdUuid: targetSD.uuid,
      targetFolderId,
      sourceSdPath: sourceSD.path,
      targetSdPath: targetSD.path,
      instanceId: '', // Will be filled by NoteMoveManager
    });

    // Execute the move atomically
    const result = await this.noteMoveManager.executeMove(moveId);

    if (!result.success) {
      throw new Error(result.error ?? 'Move failed');
    }

    // Broadcast consistent events for cross-SD moves
    // Use note:deleted for the source and note:created for the target
    this.broadcastToAll('note:deleted', noteId);
    this.broadcastToAll('note:created', {
      sdId: targetSdId,
      noteId: noteId,
      folderId: targetFolderId,
    });
  }

  /**
   * Legacy cross-SD move implementation for 'keepBoth' conflict resolution
   * TODO: Extend NoteMoveManager to support this case
   */
  private async handleMoveNoteToSD_Legacy(
    noteId: string,
    sourceSdId: string,
    targetSdId: string,
    targetFolderId: string | null,
    sourceNote: import('@notecove/shared').NoteCache
  ): Promise<void> {
    // Generate new UUID for the target note (keepBoth)
    const targetNoteId: string = crypto.randomUUID();

    // Copy CRDT files from source SD to target SD
    await this.copyNoteCRDTFiles(noteId, sourceSdId, targetNoteId, targetSdId);

    // Use a transaction to ensure atomicity
    // This prevents the note from existing in both SDs if the app crashes mid-move
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    await (this.database as any).adapter.exec('BEGIN TRANSACTION');

    try {
      // Create note in target SD database FIRST
      await this.database.upsertNote({
        id: targetNoteId,
        title: sourceNote.title,
        sdId: targetSdId,
        folderId: targetFolderId,
        created: sourceNote.created,
        modified: Date.now(),
        deleted: false,
        pinned: sourceNote.pinned, // Preserve metadata
        contentPreview: sourceNote.contentPreview,
        contentText: sourceNote.contentText,
      });
      console.log('[IPC] Created note in target SD:', {
        targetNoteId,
        targetSdId,
        targetFolderId,
        title: sourceNote.title,
      });

      // Delete original note from source SD
      await this.database.deleteNote(noteId);
      console.log('[IPC] Permanently deleted note from source SD:', {
        noteId,
        sourceSdId,
      });

      // Commit transaction
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      await (this.database as any).adapter.exec('COMMIT');
    } catch (err) {
      // Rollback on error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      await (this.database as any).adapter.exec('ROLLBACK');
      throw err;
    }

    // Broadcast consistent events for cross-SD moves
    // Use note:deleted for the source and note:created for the target
    this.broadcastToAll('note:deleted', noteId); // Original deleted from source
    this.broadcastToAll('note:created', {
      sdId: targetSdId,
      noteId: targetNoteId,
      folderId: targetFolderId,
    });
  }

  /**
   * Copy note CRDT files from source SD to target SD
   */
  private async copyNoteCRDTFiles(
    sourceNoteId: string,
    sourceSdId: string,
    targetNoteId: string,
    targetSdId: string
  ): Promise<void> {
    console.log('[IPC] Copying CRDT files:', {
      sourceNoteId,
      sourceSdId,
      targetNoteId,
      targetSdId,
    });

    try {
      // Get source and target SD paths from database
      const sourceSD = await this.database.getStorageDir(sourceSdId);
      const targetSD = await this.database.getStorageDir(targetSdId);

      if (!sourceSD) {
        throw new Error(`Source SD ${sourceSdId} not found`);
      }
      if (!targetSD) {
        throw new Error(`Target SD ${targetSdId} not found`);
      }

      // Construct note directory paths
      // Storage structure: <sdPath>/notes/<noteId>/
      const sourceNoteDir = path.join(sourceSD.path, 'notes', sourceNoteId);
      const targetNoteDir = path.join(targetSD.path, 'notes', targetNoteId);

      // Check if source note directory exists
      try {
        await fs.access(sourceNoteDir);
        // Directory exists, copy it recursively
        await this.copyDirectoryRecursive(sourceNoteDir, targetNoteDir);
        console.log(
          '[IPC] Successfully copied CRDT files from',
          sourceNoteDir,
          'to',
          targetNoteDir
        );
      } catch {
        console.warn(`[IPC] Source note directory not found: ${sourceNoteDir}`);
        // Note might not have CRDT files yet (newly created), this is OK
        // The note metadata will still be created in the database
        // CRDT files will be created when the note is first edited in target SD
      }
    } catch (err) {
      console.error('[IPC] Failed to copy CRDT files:', err);
      throw err;
    }
  }

  /**
   * Recursively copy a directory
   */
  private async copyDirectoryRecursive(source: string, destination: string): Promise<void> {
    // Create destination directory
    await fs.mkdir(destination, { recursive: true });

    // Read source directory contents
    const entries = await fs.readdir(source, { withFileTypes: true });

    // Copy each entry
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        // Recursively copy subdirectory
        await this.copyDirectoryRecursive(sourcePath, destPath);
      } else {
        // Copy file
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  private async handleGetMetadata(
    _event: IpcMainInvokeEvent,
    noteId: string
  ): Promise<NoteMetadata> {
    // Get note from SQLite cache for title
    const note = await this.database.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    // Try to get metadata from CRDT if loaded
    const noteDoc = this.crdtManager.getNoteDoc(noteId);
    let crdtMetadata: import('@notecove/shared').NoteMetadata | null = null;

    if (noteDoc) {
      crdtMetadata = noteDoc.getMetadata();
    } else {
      // Load note to get CRDT metadata with its sdId
      await this.crdtManager.loadNote(noteId, note.sdId);
      const loadedNoteDoc = this.crdtManager.getNoteDoc(noteId);
      if (loadedNoteDoc) {
        crdtMetadata = loadedNoteDoc.getMetadata();
      }
    }

    // Return metadata, preferring CRDT metadata for folderId
    return {
      noteId: noteId,
      title: note.title,
      folderId: crdtMetadata?.folderId ?? note.folderId ?? '',
      createdAt: crdtMetadata?.created ?? note.created,
      modifiedAt: crdtMetadata?.modified ?? note.modified,
      deleted: note.deleted,
    };
  }

  private async handleCheckNoteExistsInSD(
    _event: IpcMainInvokeEvent,
    noteId: string,
    targetSdId: string
  ): Promise<{ exists: boolean; isDeleted: boolean }> {
    // Check if note exists in the target SD
    const note = await this.database.getNote(noteId);

    // If note doesn't exist at all, or exists in a different SD
    if (note?.sdId !== targetSdId) {
      return { exists: false, isDeleted: false };
    }

    // Note exists in the target SD
    return { exists: true, isDeleted: note.deleted };
  }

  private async handleUpdateTitle(
    _event: IpcMainInvokeEvent,
    noteId: string,
    title: string,
    contentText?: string
  ): Promise<void> {
    console.log(`[IPC] handleUpdateTitle called - noteId: ${noteId}, title: "${title}"`);

    // Get existing note from database
    const note = await this.database.getNote(noteId);
    if (!note) {
      console.error(`[IPC] Note ${noteId} not found in database`);
      throw new Error(`Note ${noteId} not found`);
    }

    console.log(`[IPC] Found note in database, current title: "${note.title}"`);

    // Update title, content (if provided), and modified timestamp
    const updates: Partial<typeof note> = {
      ...note,
      title,
      modified: Date.now(),
    };

    if (contentText !== undefined) {
      updates.contentText = contentText;
      // Extract preview from content after first line (which is the title)
      // This prevents the title from appearing twice in the notes list
      const lines = contentText.split('\n');
      const contentAfterTitle = lines.slice(1).join('\n').trim();
      updates.contentPreview = contentAfterTitle.substring(0, 200);
    }

    await this.database.upsertNote(updates as typeof note);

    console.log(
      `[IPC] Title${contentText !== undefined ? ' and content' : ''} updated successfully in database`
    );

    // Extract and update tags if content was provided
    if (contentText !== undefined) {
      try {
        const tags = extractTags(contentText);
        console.log(`[IPC] Extracted ${tags.length} tags from note ${noteId}:`, tags);

        // Get existing tags for this note (single query)
        const existingTags = await this.database.getTagsForNote(noteId);
        const existingTagsMap = new Map(existingTags.map((t) => [t.name.toLowerCase(), t]));

        // Build a set of new tag names for O(1) lookup
        const newTagNames = new Set(tags);

        // Determine which tags to remove (tags that exist but aren't in new set)
        const tagsToRemove = existingTags.filter((tag) => !newTagNames.has(tag.name.toLowerCase()));

        // Determine which tags to add (tags that are new)
        const tagsToAdd = tags.filter((tagName) => !existingTagsMap.has(tagName));

        // Process removals (batch by executing sequentially but only for tags that need removal)
        for (const tag of tagsToRemove) {
          console.log(`[IPC] Removing tag ${tag.name} from note ${noteId}`);
          await this.database.removeTagFromNote(noteId, tag.id);
        }

        // Process additions
        for (const tagName of tagsToAdd) {
          // Check if tag exists in database
          let tag = await this.database.getTagByName(tagName);
          if (!tag) {
            console.log(`[IPC] Creating new tag: ${tagName}`);
            tag = await this.database.createTag(tagName);
          }
          console.log(`[IPC] Adding tag ${tag.name} to note ${noteId}`);
          await this.database.addTagToNote(noteId, tag.id);
        }

        console.log(`[IPC] Tags updated successfully for note ${noteId}`);

        // Extract and update inter-note links
        const links = extractLinks(contentText);
        console.log(`[IPC] Extracted ${links.length} inter-note links from note ${noteId}`);

        // Get existing links for this note
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const existingLinks: UUID[] = await this.database.getLinksFromNote(noteId);
        const existingLinksSet = new Set<UUID>(existingLinks);

        // Build a set of new link IDs for O(1) lookup
        const newLinksSet = new Set<UUID>(links);

        // Determine which links to remove
        const linksToRemove: UUID[] = existingLinks.filter((linkId) => !newLinksSet.has(linkId));

        // Determine which links to add
        const linksToAdd: UUID[] = links.filter((linkId) => !existingLinksSet.has(linkId));

        // Process removals
        for (const linkId of linksToRemove) {
          console.log(`[IPC] Removing link ${noteId} -> ${linkId}`);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          await this.database.removeLink(noteId, linkId);
        }

        // Process additions
        for (const linkId of linksToAdd) {
          console.log(`[IPC] Adding link ${noteId} -> ${linkId}`);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          await this.database.addLink(noteId, linkId);
        }

        console.log(`[IPC] Links updated successfully for note ${noteId}`);
      } catch (err) {
        console.error(`[IPC] Failed to update tags/links for note ${noteId}:`, err);
        // Don't throw - tag/link indexing failure should not prevent note update
      }
    }

    // Broadcast title update to all windows so they can refresh their notes list
    this.broadcastToAll('note:title-updated', { noteId, title });
  }

  private async handleListNotes(
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId?: string | null
  ): Promise<import('@notecove/shared').NoteCache[]> {
    console.log('[IPC] note:list called with:', { sdId, folderId });

    let notes: import('@notecove/shared').NoteCache[];

    // Handle "All Notes" special folder
    if (folderId && (folderId === 'all-notes' || folderId.startsWith('all-notes:'))) {
      notes = await this.database.getNotesBySd(sdId);
    }
    // Handle "Recently Deleted" special folder
    else if (
      folderId &&
      (folderId === 'recently-deleted' || folderId.startsWith('recently-deleted:'))
    ) {
      notes = await this.database.getDeletedNotes(sdId);
    }
    // If folderId is provided, filter by folder (including null for root folder)
    else if (folderId !== undefined) {
      notes = await this.database.getNotesByFolder(folderId);
    }
    // Otherwise, return all notes for the SD (backward compatibility)
    else {
      notes = await this.database.getNotesBySd(sdId);
    }

    console.log('[IPC] note:list returning', notes.length, 'notes for sdId:', sdId);
    return notes;
  }

  private async handleSearchNotes(
    _event: IpcMainInvokeEvent,
    query: string,
    limit?: number
  ): Promise<import('@notecove/shared').SearchResult[]> {
    return await this.database.searchNotes(query, limit);
  }

  private async handleGetNoteCountForFolder(
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string | null
  ): Promise<number> {
    return await this.database.getNoteCountForFolder(sdId, folderId);
  }

  private async handleGetAllNotesCount(_event: IpcMainInvokeEvent, sdId: string): Promise<number> {
    return await this.database.getAllNotesCount(sdId);
  }

  private async handleGetDeletedNoteCount(
    _event: IpcMainInvokeEvent,
    sdId: string
  ): Promise<number> {
    return await this.database.getDeletedNoteCount(sdId);
  }

  private async handleListFolders(
    _event: IpcMainInvokeEvent,
    sdId: string
  ): Promise<import('@notecove/shared').FolderData[]> {
    const folderTree = await this.crdtManager.loadFolderTree(sdId);
    return folderTree.getActiveFolders();
  }

  /**
   * List all folders from all Storage Directories
   * Used for cross-SD move dialog
   */
  private async handleListAllFolders(_event: IpcMainInvokeEvent): Promise<
    {
      sdId: string;
      sdName: string;
      folders: import('@notecove/shared').FolderData[];
    }[]
  > {
    // Get all Storage Directories
    const sds = await this.database.getAllStorageDirs();

    // Fetch folders from each SD in parallel, waiting for data to load
    const allFolders = await Promise.all(
      sds.map(async (sd) => {
        const folderTree = await this.crdtManager.loadFolderTree(sd.id);
        return {
          sdId: sd.id,
          sdName: sd.name,
          folders: folderTree.getActiveFolders(),
        };
      })
    );

    return allFolders;
  }

  private async handleGetFolder(
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string
  ): Promise<import('@notecove/shared').FolderData | null> {
    const folderTree = await this.crdtManager.loadFolderTree(sdId);
    return folderTree.getFolder(folderId);
  }

  private async handleCreateFolder(
    _event: IpcMainInvokeEvent,
    sdId: string,
    parentId: string | null,
    name: string
  ): Promise<string> {
    // Validate name
    if (!name || name.trim().length === 0) {
      throw new Error('Folder name cannot be empty');
    }

    const trimmedName = name.trim();

    // Check for name conflicts with siblings
    const folderTree = await this.crdtManager.loadFolderTree(sdId);
    const siblings =
      parentId === null ? folderTree.getRootFolders() : folderTree.getChildFolders(parentId);

    const nameConflict = siblings.some((f) => f.name.toLowerCase() === trimmedName.toLowerCase());

    if (nameConflict) {
      throw new Error(`A folder named "${trimmedName}" already exists in this location`);
    }

    // Generate new folder ID
    const folderId = crypto.randomUUID();

    // Determine order (last in the list)
    const maxOrder = siblings.reduce((max, f) => Math.max(max, f.order), -1);
    const order = maxOrder + 1;

    // Create folder data
    const folderData: import('@notecove/shared').FolderData = {
      id: folderId,
      name: trimmedName,
      parentId,
      sdId,
      order,
      deleted: false,
    };

    // Update CRDT
    folderTree.createFolder(folderData);

    // Update SQLite cache
    await this.database.upsertFolder({
      id: folderId,
      name: trimmedName,
      parentId,
      sdId,
      order,
      deleted: false,
    });

    // Broadcast folder update to all windows
    this.broadcastToAll('folder:updated', { sdId, operation: 'create', folderId });

    return folderId;
  }

  private async handleRenameFolder(
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string,
    newName: string
  ): Promise<void> {
    // Validate name
    if (!newName || newName.trim().length === 0) {
      throw new Error('Folder name cannot be empty');
    }

    const trimmedName = newName.trim();
    const folderTree = await this.crdtManager.loadFolderTree(sdId);
    const folder = folderTree.getFolder(folderId);

    if (!folder) {
      throw new Error(`Folder ${folderId} not found`);
    }

    // Check for name conflicts with siblings
    const siblings =
      folder.parentId === null
        ? folderTree.getRootFolders()
        : folderTree.getChildFolders(folder.parentId);

    const nameConflict = siblings.some(
      (f) => f.id !== folderId && f.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (nameConflict) {
      throw new Error(`A folder named "${trimmedName}" already exists in this location`);
    }

    // Update CRDT
    folderTree.updateFolder(folderId, { name: trimmedName });

    // Update SQLite cache
    await this.database.upsertFolder({
      ...folder,
      name: trimmedName,
    });

    // Broadcast folder update to all windows
    this.broadcastToAll('folder:updated', { sdId, operation: 'rename', folderId });
  }

  private async handleDeleteFolder(
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string
  ): Promise<void> {
    const folderTree = await this.crdtManager.loadFolderTree(sdId);
    const folder = folderTree.getFolder(folderId);

    if (!folder) {
      throw new Error(`Folder ${folderId} not found`);
    }

    // Soft delete in CRDT
    folderTree.deleteFolder(folderId);

    // Update SQLite cache
    await this.database.upsertFolder({
      ...folder,
      deleted: true,
    });

    // Broadcast folder update to all windows
    this.broadcastToAll('folder:updated', { sdId, operation: 'delete', folderId });
  }

  private async handleMoveFolder(
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string,
    newParentId: string | null
  ): Promise<void> {
    const folderTree = await this.crdtManager.loadFolderTree(sdId);
    const folder = folderTree.getFolder(folderId);

    if (!folder) {
      throw new Error(`Folder ${folderId} not found`);
    }

    // Prevent moving folder to be its own descendant (circular reference)
    if (newParentId !== null) {
      const isDescendant = (ancestorId: string, descendantId: string): boolean => {
        let current = folderTree.getFolder(descendantId);
        while (current) {
          if (current.id === ancestorId) {
            return true;
          }
          if (current.parentId === null) {
            break;
          }
          current = folderTree.getFolder(current.parentId);
        }
        return false;
      };

      if (isDescendant(folderId, newParentId)) {
        throw new Error('Cannot move folder to be its own descendant');
      }
    }

    // Calculate new order (append to end of siblings)
    const siblings =
      newParentId === null ? folderTree.getRootFolders() : folderTree.getChildFolders(newParentId);

    const maxOrder = siblings.reduce((max, f) => Math.max(max, f.order), -1);
    const newOrder = maxOrder + 1;

    // Update CRDT
    folderTree.updateFolder(folderId, { parentId: newParentId, order: newOrder });

    // Update SQLite cache
    await this.database.upsertFolder({
      ...folder,
      parentId: newParentId,
      order: newOrder,
    });

    // Broadcast folder update to all windows
    this.broadcastToAll('folder:updated', { sdId, operation: 'move', folderId });
  }

  private async handleGetAppState(_event: IpcMainInvokeEvent, key: string): Promise<string | null> {
    return await this.database.getState(key);
  }

  private async handleSetAppState(
    _event: IpcMainInvokeEvent,
    key: string,
    value: string
  ): Promise<void> {
    await this.database.setState(key, value);
  }

  // ============================================================================
  // Config Handlers
  // ============================================================================

  private async handleGetDatabasePath(_event: IpcMainInvokeEvent): Promise<string> {
    return await this.configManager.getDatabasePath();
  }

  private async handleSetDatabasePath(_event: IpcMainInvokeEvent, path: string): Promise<void> {
    await this.configManager.setDatabasePath(path);
  }

  // ============================================================================
  // Storage Directory Handlers
  // ============================================================================

  private async handleListStorageDirs(
    _event: IpcMainInvokeEvent
  ): Promise<{ id: string; name: string; path: string; created: number; isActive: boolean }[]> {
    return await this.database.getAllStorageDirs();
  }

  private async handleCreateStorageDir(
    _event: IpcMainInvokeEvent,
    name: string,
    path: string
  ): Promise<string> {
    // Check if SD already has an ID file (for cross-instance consistency)
    const { promises: fs } = await import('fs');
    const pathModule = await import('path');
    const idFilePath = pathModule.join(path, '.sd-id');

    let id: string;
    try {
      const idContent = await fs.readFile(idFilePath, 'utf-8');
      id = idContent.trim();
      console.log(`[SD] Found existing SD ID in ${path}: ${id}`);
    } catch {
      // File doesn't exist, create new ID
      id = crypto.randomUUID();
      try {
        await fs.writeFile(idFilePath, id, 'utf-8');
        console.log(`[SD] Created new SD ID file in ${path}: ${id}`);
      } catch (error) {
        console.error(`[SD] Failed to write SD ID file:`, error);
        // Continue anyway, we'll use the generated ID
      }
    }

    await this.database.createStorageDir(id, name, path);

    // Initialize the new SD (register with UpdateManager, set up watchers, etc.)
    if (this.onStorageDirCreated) {
      await this.onStorageDirCreated(id, path);
    }

    // Broadcast SD update to all windows
    this.broadcastToAll('sd:updated', { operation: 'create', sdId: id });

    return id;
  }

  private async handleSetActiveStorageDir(_event: IpcMainInvokeEvent, sdId: string): Promise<void> {
    await this.database.setActiveStorageDir(sdId);

    // Broadcast SD update to all windows
    this.broadcastToAll('sd:updated', { operation: 'setActive', sdId });
  }

  private async handleGetActiveStorageDir(_event: IpcMainInvokeEvent): Promise<string | null> {
    const activeSD = await this.database.getActiveStorageDir();
    return activeSD ? activeSD.id : null;
  }

  private async handleDeleteStorageDir(_event: IpcMainInvokeEvent, sdId: string): Promise<void> {
    await this.database.deleteStorageDir(sdId);

    // Broadcast SD update to all windows
    this.broadcastToAll('sd:updated', { operation: 'delete', sdId });
  }

  private async handleSelectSDPath(
    event: IpcMainInvokeEvent,
    defaultPath?: string
  ): Promise<string | null> {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return null;
    }

    const dialogOptions: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Storage Directory Location',
      buttonLabel: 'Select Folder',
    };

    // Only set defaultPath if it's provided
    if (defaultPath) {
      dialogOptions.defaultPath = defaultPath;
    }

    const result = await dialog.showOpenDialog(window, dialogOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0] ?? null;
  }

  /**
   * Get common cloud storage paths for the current platform
   * Only returns paths that actually exist on the system
   */
  private async handleGetCloudStoragePaths(
    _event: IpcMainInvokeEvent
  ): Promise<Record<string, string>> {
    const homeDir = os.homedir();
    const platform = os.platform();
    const candidatePaths: Record<string, string> = {};

    if (platform === 'darwin') {
      // macOS
      candidatePaths['iCloudDrive'] = path.join(
        homeDir,
        'Library/Mobile Documents/com~apple~CloudDocs'
      );
      candidatePaths['Dropbox'] = path.join(homeDir, 'Dropbox');
      candidatePaths['GoogleDrive'] = path.join(homeDir, 'Google Drive');
      candidatePaths['OneDrive'] = path.join(homeDir, 'OneDrive');
    } else if (platform === 'win32') {
      // Windows
      candidatePaths['iCloudDrive'] = path.join(homeDir, 'iCloudDrive');
      candidatePaths['Dropbox'] = path.join(homeDir, 'Dropbox');
      candidatePaths['GoogleDrive'] = path.join(homeDir, 'Google Drive');
      candidatePaths['OneDrive'] = path.join(homeDir, 'OneDrive');
    } else {
      // Linux
      candidatePaths['Dropbox'] = path.join(homeDir, 'Dropbox');
      candidatePaths['GoogleDrive'] = path.join(homeDir, 'Google Drive');
    }

    // Check which paths actually exist
    const existingPaths: Record<string, string> = {};
    for (const [name, dirPath] of Object.entries(candidatePaths)) {
      try {
        const stats = await fs.stat(dirPath);
        if (stats.isDirectory()) {
          existingPaths[name] = dirPath;
        }
      } catch {
        // Directory doesn't exist, skip it
      }
    }

    return existingPaths;
  }

  /**
   * Open Settings dialog
   * Broadcasts to all windows to open settings
   */
  openSettings(): void {
    this.broadcastToAll('settings:open', {});
  }

  /**
   * Testing: Create a new window
   */
  private async handleCreateWindow(
    _event: IpcMainInvokeEvent,
    options?: { noteId?: string; minimal?: boolean }
  ): Promise<void> {
    if (this.createWindowFn) {
      this.createWindowFn(options);
    }
  }

  /**
   * Test-only: Set note timestamp (for testing auto-cleanup)
   * Only available when NODE_ENV=test
   *
   * Updates both CRDT metadata and SQLite database to ensure consistency
   */
  private async handleSetNoteTimestamp(
    _event: IpcMainInvokeEvent,
    noteId: string,
    timestamp: number
  ): Promise<void> {
    if (process.env['NODE_ENV'] !== 'test') {
      throw new Error('test:setNoteTimestamp is only available in test mode');
    }

    console.log(
      `[Test Helper] Setting timestamp for note ${noteId} to ${timestamp} (${new Date(timestamp).toISOString()})`
    );

    // Get the note to find its SD
    const note = await this.database.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    console.log(
      `[Test Helper] Note ${noteId} before update - modified: ${note.modified}, deleted: ${note.deleted}`
    );

    // Load the CRDT document (or get it if already loaded)
    let noteDoc = this.crdtManager.getNoteDoc(noteId);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const wasLoaded = noteDoc !== null;
    if (!noteDoc) {
      await this.crdtManager.loadNote(noteId, note.sdId);
      noteDoc = this.crdtManager.getNoteDoc(noteId);
      if (!noteDoc) {
        throw new Error(`Failed to load CRDT for note ${noteId}`);
      }
    }

    noteDoc.updateMetadata({ modified: timestamp });

    // Manually trigger a write by applying the current state as an update
    // This ensures the update is written to disk immediately
    const fullUpdate = noteDoc.encodeStateAsUpdate();
    await this.crdtManager.applyUpdate(noteId, fullUpdate);

    // Also update the SQLite cache
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    await (this.database as any).adapter.exec('UPDATE notes SET modified = ? WHERE id = ?', [
      timestamp,
      noteId,
    ]);

    // Verify the update
    const updatedNote = await this.database.getNote(noteId);
    const updatedMetadata = noteDoc.getMetadata();

    console.log(
      `[Test Helper] After update - SQL modified: ${updatedNote?.modified}, CRDT modified: ${updatedMetadata.modified}`
    );

    if (updatedNote?.modified !== timestamp || updatedMetadata.modified !== timestamp) {
      throw new Error(
        `Timestamp update failed! Expected ${timestamp}, got SQL: ${updatedNote?.modified}, CRDT: ${updatedMetadata.modified}`
      );
    }

    // Unload the note if it wasn't loaded before (clean up)
    if (!wasLoaded) {
      await this.crdtManager.unloadNote(noteId);
    }

    console.log(`[Test Helper] Timestamp successfully set and saved for note ${noteId}`);
  }

  /**
   * Clean up all handlers
   */
  destroy(): void {
    ipcMain.removeHandler('note:load');
    ipcMain.removeHandler('note:unload');
    ipcMain.removeHandler('note:getState');
    ipcMain.removeHandler('note:applyUpdate');
    ipcMain.removeHandler('note:create');
    ipcMain.removeHandler('note:delete');
    ipcMain.removeHandler('note:move');
    ipcMain.removeHandler('note:moveToSD');
    ipcMain.removeHandler('note:getMetadata');
    ipcMain.removeHandler('note:updateTitle');
    ipcMain.removeHandler('note:list');
    ipcMain.removeHandler('tag:getAll');
    ipcMain.removeHandler('link:getBacklinks');
    ipcMain.removeHandler('link:searchNotesForAutocomplete');
    ipcMain.removeHandler('folder:list');
    ipcMain.removeHandler('folder:listAll');
    ipcMain.removeHandler('folder:get');
    ipcMain.removeHandler('folder:create');
    ipcMain.removeHandler('folder:rename');
    ipcMain.removeHandler('folder:delete');
    ipcMain.removeHandler('folder:move');
    ipcMain.removeHandler('sd:list');
    ipcMain.removeHandler('sd:create');
    ipcMain.removeHandler('sd:setActive');
    ipcMain.removeHandler('sd:getActive');
    ipcMain.removeHandler('appState:get');
    ipcMain.removeHandler('appState:set');
    ipcMain.removeHandler('config:getDatabasePath');
    ipcMain.removeHandler('config:setDatabasePath');
    ipcMain.removeHandler('recovery:getStaleMoves');
    ipcMain.removeHandler('recovery:takeOverMove');
    ipcMain.removeHandler('recovery:cancelMove');

    if (this.createWindowFn) {
      ipcMain.removeHandler('testing:createWindow');
    }

    if (process.env['NODE_ENV'] === 'test') {
      ipcMain.removeHandler('test:setNoteTimestamp');
      ipcMain.removeHandler('test:getAllTags');
      ipcMain.removeHandler('test:getTagsForNote');
      ipcMain.removeHandler('test:getNoteById');
    }
  }

  // Telemetry handlers
  private async handleGetTelemetrySettings(): Promise<{
    remoteMetricsEnabled: boolean;
    datadogApiKey?: string;
  }> {
    const telemetryManager = getTelemetryManager();
    const config = telemetryManager.getConfig();

    const result: { remoteMetricsEnabled: boolean; datadogApiKey?: string } = {
      remoteMetricsEnabled: config.remoteMetricsEnabled,
    };

    if (config.datadogApiKey !== undefined) {
      result.datadogApiKey = config.datadogApiKey;
    }

    return result;
  }

  private async handleUpdateTelemetrySettings(
    _event: IpcMainInvokeEvent,
    settings: { remoteMetricsEnabled: boolean; datadogApiKey?: string }
  ): Promise<void> {
    const telemetryManager = getTelemetryManager();

    const config: { remoteMetricsEnabled: boolean; datadogApiKey?: string } = {
      remoteMetricsEnabled: settings.remoteMetricsEnabled,
    };

    if (settings.datadogApiKey !== undefined) {
      config.datadogApiKey = settings.datadogApiKey;
    }

    await telemetryManager.updateConfig(config);

    console.log(
      `[Telemetry] Settings updated: remoteMetricsEnabled=${settings.remoteMetricsEnabled}`
    );
  }

  /**
   * Recovery: Get all stale moves (incomplete moves older than 5 minutes)
   */
  private async handleGetStaleMoves(
    _event: IpcMainInvokeEvent
  ): Promise<import('@notecove/shared').NoteMove[]> {
    return await this.noteMoveManager.getStaleMoves();
  }

  /**
   * Recovery: Take over a stuck move from another instance
   */
  private async handleTakeOverMove(
    _event: IpcMainInvokeEvent,
    moveId: string
  ): Promise<{ success: boolean; error?: string }> {
    const result = await this.noteMoveManager.takeOverMove(moveId);
    if (result.error) {
      return {
        success: result.success,
        error: result.error,
      };
    }
    return {
      success: result.success,
    };
  }

  /**
   * Recovery: Cancel a stuck move
   */
  private async handleCancelMove(
    _event: IpcMainInvokeEvent,
    moveId: string
  ): Promise<{ success: boolean; error?: string }> {
    const result = await this.noteMoveManager.cancelMove(moveId);
    if (result.error) {
      return {
        success: result.success,
        error: result.error,
      };
    }
    return {
      success: result.success,
    };
  }

  /**
   * Diagnostics: Get duplicate notes (same ID in multiple SDs)
   */
  private async handleGetDuplicateNotes(
    _event: IpcMainInvokeEvent
  ): Promise<import('../diagnostics-manager').DuplicateNote[]> {
    return await this.diagnosticsManager.detectDuplicateNotes();
  }

  /**
   * Diagnostics: Get orphaned CRDT files (filesystem files without database entries)
   */
  private async handleGetOrphanedCRDTFiles(
    _event: IpcMainInvokeEvent
  ): Promise<import('../diagnostics-manager').OrphanedCRDTFile[]> {
    return await this.diagnosticsManager.detectOrphanedCRDTFiles();
  }

  /**
   * Diagnostics: Get missing CRDT files (database entries without filesystem files)
   */
  private async handleGetMissingCRDTFiles(
    _event: IpcMainInvokeEvent
  ): Promise<import('../diagnostics-manager').MissingCRDTFile[]> {
    return await this.diagnosticsManager.detectMissingCRDTFiles();
  }

  /**
   * Diagnostics: Get stale migration locks (older than 1 hour)
   */
  private async handleGetStaleMigrationLocks(
    _event: IpcMainInvokeEvent
  ): Promise<import('../diagnostics-manager').StaleMigrationLock[]> {
    return await this.diagnosticsManager.detectStaleMigrationLocks();
  }

  /**
   * Diagnostics: Get orphaned activity logs (instances not seen in 30+ days)
   */
  private async handleGetOrphanedActivityLogs(
    _event: IpcMainInvokeEvent
  ): Promise<import('../diagnostics-manager').OrphanedActivityLog[]> {
    return await this.diagnosticsManager.detectOrphanedActivityLogs();
  }

  /**
   * Diagnostics: Remove a stale migration lock
   */
  private async handleRemoveStaleMigrationLock(
    _event: IpcMainInvokeEvent,
    sdId: number
  ): Promise<void> {
    await this.diagnosticsManager.removeStaleMigrationLock(sdId);
  }

  /**
   * Diagnostics: Clean up an orphaned activity log
   */
  private async handleCleanupOrphanedActivityLog(
    _event: IpcMainInvokeEvent,
    sdId: number,
    instanceId: string
  ): Promise<void> {
    await this.diagnosticsManager.cleanupOrphanedActivityLog(sdId, instanceId);
  }

  /**
   * Diagnostics: Import an orphaned CRDT file to the database
   */
  private async handleImportOrphanedCRDT(
    _event: IpcMainInvokeEvent,
    noteId: string,
    sdId: number
  ): Promise<void> {
    await this.diagnosticsManager.importOrphanedCRDT(noteId, sdId);
  }

  /**
   * Diagnostics: Delete a database entry for a missing CRDT file
   */
  private async handleDeleteMissingCRDTEntry(
    _event: IpcMainInvokeEvent,
    noteId: string,
    sdId: number
  ): Promise<void> {
    await this.diagnosticsManager.deleteMissingCRDTEntry(noteId, sdId);
  }

  /**
   * Diagnostics: Delete one instance of a duplicate note
   */
  private async handleDeleteDuplicateNote(
    _event: IpcMainInvokeEvent,
    noteId: string,
    sdId: number
  ): Promise<void> {
    await this.diagnosticsManager.deleteDuplicateNote(noteId, sdId);
  }

  /**
   * Backup: Create pre-operation snapshot (fast, minimal backup of affected notes)
   */
  private async handleCreatePreOperationSnapshot(
    _event: IpcMainInvokeEvent,
    sdId: string,
    noteIds: string[],
    description: string
  ): Promise<import('../backup-manager').BackupInfo> {
    return await this.backupManager.createPreOperationSnapshot(sdId, noteIds, description);
  }

  /**
   * Backup: Create manual backup (full SD backup)
   */
  private async handleCreateManualBackup(
    _event: IpcMainInvokeEvent,
    sdId: string,
    packAndSnapshot: boolean,
    description?: string,
    customBackupPath?: string
  ): Promise<import('../backup-manager').BackupInfo> {
    return await this.backupManager.createManualBackup(
      sdId,
      packAndSnapshot,
      description,
      customBackupPath
    );
  }

  /**
   * Backup: List all available backups
   */
  private handleListBackups(_event: IpcMainInvokeEvent): import('../backup-manager').BackupInfo[] {
    return this.backupManager.listBackups();
  }

  /**
   * Backup: Restore SD from backup
   */
  private async handleRestoreFromBackup(
    _event: IpcMainInvokeEvent,
    backupId: string,
    targetPath: string,
    registerAsNew: boolean
  ): Promise<{ sdId: string; sdPath: string }> {
    return await this.backupManager.restoreFromBackup(backupId, targetPath, registerAsNew);
  }

  /**
   * Backup: Restore SD from custom backup path
   */
  private async handleRestoreFromCustomPath(
    _event: IpcMainInvokeEvent,
    backupPath: string,
    targetPath: string,
    registerAsNew: boolean
  ): Promise<{ sdId: string; sdPath: string }> {
    return await this.backupManager.restoreFromCustomPath(backupPath, targetPath, registerAsNew);
  }

  /**
   * Backup: Delete a backup
   */
  private handleDeleteBackup(_event: IpcMainInvokeEvent, backupId: string): void {
    this.backupManager.deleteBackup(backupId);
  }

  /**
   * Backup: Clean up old pre-operation snapshots
   */
  private handleCleanupOldSnapshots(_event: IpcMainInvokeEvent): number {
    return this.backupManager.cleanupOldSnapshots();
  }

  /**
   * Backup: Set custom backup directory
   */
  private async handleSetBackupDirectory(
    _event: IpcMainInvokeEvent,
    customPath: string
  ): Promise<void> {
    this.backupManager.setBackupDirectory(customPath);
  }

  /**
   * Backup: Get current backup directory
   */
  private async handleGetBackupDirectory(_event: IpcMainInvokeEvent): Promise<string> {
    return this.backupManager.getBackupDirectory();
  }

  /**
   * Tag: Get all tags with note counts
   */
  private async handleGetAllTags(
    _event: IpcMainInvokeEvent
  ): Promise<{ id: string; name: string; count: number }[]> {
    return await this.database.getAllTags();
  }

  /**
   * Link: Get backlinks for a note
   */
  private async handleGetBacklinks(
    _event: IpcMainInvokeEvent,
    noteId: string
  ): Promise<NoteCache[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return await this.database.getBacklinks(noteId);
  }

  /**
   * Link: Search notes for autocomplete
   * Returns notes matching the query (title or content substring match)
   */
  private async handleSearchNotesForAutocomplete(
    _event: IpcMainInvokeEvent,
    query: string
  ): Promise<
    {
      id: string;
      title: string;
      sdId: string;
      folderId: string | null;
      folderPath: string;
      created: number;
      modified: number;
    }[]
  > {
    // For autocomplete, we want simple prefix matching on titles
    // FTS5's prefix search has issues, so we'll use simple string matching
    const allNotes = await this.database.getActiveNotes();

    let notes: NoteCache[];
    if (query.trim() === '') {
      // Empty query: return all notes
      notes = allNotes;
    } else {
      // Filter notes by title prefix (case-insensitive)
      const lowerQuery = query.toLowerCase();
      notes = allNotes.filter((note) => note.title.toLowerCase().includes(lowerQuery));
    }

    // Remove deleted notes and deduplicate
    const combinedMap = new Map<string, NoteCache>();
    notes.forEach((note) => {
      if (!note.deleted) {
        combinedMap.set(note.id, note);
      }
    });

    const results = Array.from(combinedMap.values());

    // Get folder paths for each note
    const resultsWithPaths = await Promise.all(
      results.map(async (note) => {
        let folderPath = '';
        if (note.folderId) {
          try {
            const folder = await this.database.getFolder(note.folderId);
            if (folder) {
              // For now, just use the folder name
              // TODO: Build full folder path by traversing parent folders
              folderPath = folder.name;
            }
          } catch (err) {
            console.error(`Failed to get folder path for note ${note.id}:`, err);
          }
        }

        return {
          id: note.id,
          title: note.title,
          sdId: note.sdId,
          folderId: note.folderId,
          folderPath,
          created: note.created,
          modified: note.modified,
        };
      })
    );

    // Sort by modified date (most recent first)
    return resultsWithPaths.sort((a, b) => b.modified - a.modified).slice(0, 50);
  }

  /**
   * Note: Get comprehensive note information for debugging and diagnostics
   */
  private async handleGetNoteInfo(
    _event: IpcMainInvokeEvent,
    noteId: string
  ): Promise<{
    // Basic info
    id: string;
    title: string;
    sdId: string;
    sdName: string;
    sdPath: string;
    folderId: string | null;
    folderName: string | null;
    folderPath: string | null;

    // Timestamps
    created: number;
    modified: number;

    // Tags
    tags: string[];

    // Document statistics
    characterCount: number;
    wordCount: number;
    paragraphCount: number;

    // CRDT info
    vectorClock: Record<string, number>; // Maps instance ID to highest sequence number
    documentHash: string; // SHA-256 hash of document state (first 16 chars)
    crdtUpdateCount: number; // Number of updates in the document
    noteDirPath: string; // Path to note directory
    totalFileSize: number; // Total size of all CRDT files (updates + packs + snapshots)
    snapshotCount: number; // Number of snapshot files
    packCount: number; // Number of pack files

    // Advanced info
    deleted: boolean;
    pinned: boolean;
    contentPreview: string;
  } | null> {
    // Get note from database
    const note = await this.database.getNote(noteId);
    if (!note) {
      return null;
    }

    // Get SD info
    const sd = await this.database.getStorageDir(note.sdId);
    if (!sd) {
      return null;
    }

    // Get folder info if note is in a folder
    let folderName: string | null = null;
    let folderPath: string | null = null;
    if (note.folderId) {
      const folder = await this.database.getFolder(note.folderId);
      if (folder) {
        folderName = folder.name;

        // Build full folder path by traversing up the hierarchy
        const pathParts: string[] = [folder.name];
        let currentFolder = folder;
        while (currentFolder.parentId) {
          const parentFolder = await this.database.getFolder(currentFolder.parentId);
          if (!parentFolder) break;
          pathParts.unshift(parentFolder.name);
          currentFolder = parentFolder;
        }
        folderPath = pathParts.join(' / ');
      }
    }

    // Get tags
    const tagRecords = await this.database.getTagsForNote(noteId);
    const tags = tagRecords.map((t) => t.name);

    // Check if note is already loaded - don't load it just for statistics
    // This avoids expensive CRDT loading for notes that aren't currently open
    const doc = this.crdtManager.getDocument(noteId);

    // Extract content for statistics (only if note is already loaded)
    let contentText = '';
    let paragraphCount = 0;
    let characterCount = 0;
    let wordCount = 0;

    if (doc) {
      const content = doc.getXmlFragment('content');

      content.forEach((item) => {
        if (item instanceof Y.XmlText) {
          contentText += String(item.toString()) + '\n';
          if (String(item.toString()).trim()) {
            paragraphCount++;
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
          const elemText = extractText(item);
          contentText += elemText + '\n';
          if (elemText.trim()) {
            paragraphCount++;
          }
        }
      });

      // Calculate word count and character count
      characterCount = contentText.length;
      wordCount = contentText
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length;
    }

    // Get vector clock (NoteCove's tracking of updates from other instances)
    // Build it as if we were writing a snapshot - from all update files on disk
    const vectorClock = await this.updateManager.buildVectorClock(note.sdId, noteId);

    // Get document state and create hash (only if note is loaded)
    const documentHash = doc
      ? crypto
          .createHash('sha256')
          .update(Y.encodeStateAsUpdate(doc))
          .digest('hex')
          .substring(0, 16)
      : '';

    // Get note directory path and calculate total size of all CRDT files
    const noteDir = path.join(sd.path, 'notes', noteId);
    const noteDirPath = noteDir;

    // Calculate total size of all update files, packs, and snapshots
    // Use parallel stat calls for better performance
    const [snapshots, packs, updates] = await Promise.all([
      this.updateManager.listSnapshotFiles(note.sdId, noteId),
      this.updateManager.listPackFiles(note.sdId, noteId),
      this.updateManager.listNoteUpdateFiles(note.sdId, noteId),
    ]);

    // Get update count (number of update files on disk)
    const crdtUpdateCount = updates.length;
    const snapshotCount = snapshots.length;
    const packCount = packs.length;

    // Sum up file sizes in parallel for better performance
    const snapshotSizes = await Promise.all(
      snapshots.map(async (snapshot) => {
        try {
          const snapshotPath = path.join(noteDir, 'snapshots', snapshot.filename);
          const stats = await fs.stat(snapshotPath);
          return stats.size;
        } catch {
          return 0;
        }
      })
    );

    const packSizes = await Promise.all(
      packs.map(async (pack) => {
        try {
          const packPath = path.join(noteDir, 'packs', pack.filename);
          const stats = await fs.stat(packPath);
          return stats.size;
        } catch {
          return 0;
        }
      })
    );

    const updateSizes = await Promise.all(
      updates.map(async (update) => {
        try {
          const stats = await fs.stat(update.path);
          return stats.size;
        } catch {
          return 0;
        }
      })
    );

    const totalFileSize =
      snapshotSizes.reduce((sum, size) => sum + size, 0) +
      packSizes.reduce((sum, size) => sum + size, 0) +
      updateSizes.reduce((sum, size) => sum + size, 0);

    return {
      id: noteId,
      title: note.title,
      sdId: note.sdId,
      sdName: sd.name,
      sdPath: sd.path,
      folderId: note.folderId,
      folderName,
      folderPath,
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
      packCount,
      deleted: note.deleted,
      pinned: note.pinned,
      contentPreview: note.contentPreview,
    };
  }

  // Test-only handlers
  private async handleTestGetAllTags(): Promise<{ id: string; name: string }[]> {
    const tags = await this.database.getAllTags();
    return tags.map((t) => ({ id: t.id, name: t.name }));
  }

  private async handleTestGetTagsForNote(
    _event: IpcMainInvokeEvent,
    noteId: string
  ): Promise<{ id: string; name: string }[]> {
    const tags = await this.database.getTagsForNote(noteId);
    return tags.map((t) => ({ id: t.id, name: t.name }));
  }

  private async handleTestGetNoteById(
    _event: IpcMainInvokeEvent,
    noteId: string
  ): Promise<NoteCache | null> {
    const note = await this.database.getNote(noteId);
    return note;
  }

  // ============================================================================
  // History Handlers
  // ============================================================================

  /**
   * Get timeline of editing sessions for a note
   */
  private async handleGetTimeline(
    _event: IpcMainInvokeEvent,
    noteId: string
  ): Promise<ActivitySession[]> {
    // Get note metadata to find which SD it belongs to
    const note = await this.database.getNote(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const timelineBuilder = new TimelineBuilder(this.updateManager);
    const timeline = await timelineBuilder.buildTimeline(note.sdId, noteId);

    return timeline;
  }

  /**
   * Get history statistics for a note
   */
  private async handleGetHistoryStats(
    _event: IpcMainInvokeEvent,
    noteId: string
  ): Promise<{
    totalUpdates: number;
    totalSessions: number;
    firstEdit: number | null;
    lastEdit: number | null;
    instanceCount: number;
    instances: string[];
  }> {
    const note = await this.database.getNote(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const timelineBuilder = new TimelineBuilder(this.updateManager);
    const stats = await timelineBuilder.getHistoryStats(note.sdId, noteId);

    return stats;
  }

  /**
   * Reconstruct document state at a specific point in time
   */
  private async handleReconstructAt(
    _event: IpcMainInvokeEvent,
    noteId: string,
    point: ReconstructionPoint
  ): Promise<Uint8Array> {
    const note = await this.database.getNote(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const timelineBuilder = new TimelineBuilder(this.updateManager);
    const stateReconstructor = new StateReconstructor(this.updateManager);

    // Build timeline to get all updates
    const timeline = await timelineBuilder.buildTimeline(note.sdId, noteId);
    const allUpdates = timeline.flatMap((session) => session.updates);

    // Reconstruct at the specified point
    const doc = await stateReconstructor.reconstructAt(note.sdId, noteId, allUpdates, point);

    // Return the document state as Yjs update
    return Y.encodeStateAsUpdate(doc);
  }

  /**
   * Get preview text for first and last state of a session
   */
  private async handleGetSessionPreview(
    _event: IpcMainInvokeEvent,
    noteId: string,
    sessionId: string
  ): Promise<{ firstPreview: string; lastPreview: string }> {
    const note = await this.database.getNote(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const timelineBuilder = new TimelineBuilder(this.updateManager);
    const stateReconstructor = new StateReconstructor(this.updateManager);

    // Build timeline to find the session
    const timeline = await timelineBuilder.buildTimeline(note.sdId, noteId);
    const session = timeline.find((s) => s.id === sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const allUpdates = timeline.flatMap((s) => s.updates);
    const preview = await stateReconstructor.getSessionPreview(
      note.sdId,
      noteId,
      session,
      allUpdates
    );

    return preview;
  }
}
