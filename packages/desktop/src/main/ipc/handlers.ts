/**
 * IPC Command Handlers
 *
 * Handles commands from renderer processes.
 */

/* eslint-disable @typescript-eslint/require-await */

import { ipcMain, type IpcMainInvokeEvent, BrowserWindow } from 'electron';
import * as Y from 'yjs';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { CRDTManager } from '../crdt';
import type { NoteMetadata } from './types';
import type { Database } from '@notecove/shared';

export class IPCHandlers {
  constructor(
    private crdtManager: CRDTManager,
    private database: Database,
    private createWindowFn?: () => void,
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

    // Folder operations
    ipcMain.handle('folder:list', this.handleListFolders.bind(this));
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

    // App state operations
    ipcMain.handle('appState:get', this.handleGetAppState.bind(this));
    ipcMain.handle('appState:set', this.handleSetAppState.bind(this));

    // Testing operations (only register if createWindowFn provided)
    if (this.createWindowFn) {
      ipcMain.handle('testing:createWindow', this.handleCreateWindow.bind(this));
    }

    // Test-only operations (only available in NODE_ENV=test)
    if (process.env['NODE_ENV'] === 'test') {
      ipcMain.handle('test:setNoteTimestamp', this.handleSetNoteTimestamp.bind(this));
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
    if (!sourceNote || sourceNote.sdId !== sourceSdId) {
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

    // Determine which ID to use for the new note
    // IMPORTANT: Always generate a new UUID for cross-SD moves
    // This ensures the deleted note remains in the source SD's Recently Deleted
    // while the new note exists in the target SD
    let targetNoteId: string = crypto.randomUUID();

    // Exception: If conflict resolution is 'replace', we can reuse the existing ID
    // because we're replacing the existing note in the target SD
    if (conflictResolution === 'replace') {
      targetNoteId = noteId;
    }

    // Copy CRDT files from source SD to target SD
    await this.copyNoteCRDTFiles(noteId, sourceSdId, targetNoteId, targetSdId);

    // Soft delete original note in source SD FIRST
    // (Must do this before creating in target to avoid conflict when targetNoteId === noteId)
    await this.database.upsertNote({
      ...sourceNote,
      deleted: true,
      modified: Date.now(),
    });
    console.log('[IPC] Soft-deleted note in source SD:', {
      noteId,
      sourceSdId,
    });

    // Create note in target SD database
    // (Do this AFTER deleting source to ensure this is the final state)
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

    // Broadcast events
    this.broadcastToAll('note:deleted', noteId); // Original deleted
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
    else if (folderId && (folderId === 'recently-deleted' || folderId.startsWith('recently-deleted:'))) {
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
    const folderTree = this.crdtManager.loadFolderTree(sdId);
    return folderTree.getActiveFolders();
  }

  private async handleGetFolder(
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string
  ): Promise<import('@notecove/shared').FolderData | null> {
    const folderTree = this.crdtManager.loadFolderTree(sdId);
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
    const folderTree = this.crdtManager.loadFolderTree(sdId);
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
    const folderTree = this.crdtManager.loadFolderTree(sdId);
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
    const folderTree = this.crdtManager.loadFolderTree(sdId);
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
    const folderTree = this.crdtManager.loadFolderTree(sdId);
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

  /**
   * Testing: Create a new window
   */
  private async handleCreateWindow(_event: IpcMainInvokeEvent): Promise<void> {
    if (this.createWindowFn) {
      this.createWindowFn();
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
    ipcMain.removeHandler('folder:list');
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

    if (this.createWindowFn) {
      ipcMain.removeHandler('testing:createWindow');
    }

    if (process.env['NODE_ENV'] === 'test') {
      ipcMain.removeHandler('test:setNoteTimestamp');
    }
  }
}
