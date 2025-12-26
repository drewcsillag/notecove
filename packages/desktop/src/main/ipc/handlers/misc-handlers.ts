/**
 * Miscellaneous Handlers
 *
 * IPC handlers for:
 * - Tag operations
 * - Link operations (backlinks, autocomplete)
 * - Mention operations
 * - User operations (current profile)
 * - Telemetry operations
 * - Storage inspector operations
 * - Tools operations (reindex)
 * - Test-only operations
 */

/* eslint-disable @typescript-eslint/require-await */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { HandlerContext } from './types';
import { AppStateKey, type NoteCache } from '@notecove/shared';
import { getTelemetryManager } from '../../telemetry/config';
import { NodeFileSystemAdapter } from '../../storage/node-fs-adapter';
import {
  StorageInspectorService,
  type SDContentsResult,
  type FileInfoResult,
  type ParsedFileResult,
  type InspectorFileType,
} from '../../storage-inspector';

// Re-export AppStateKey for use in the handlers
const AppStateKeys = {
  Username: 'username' as AppStateKey,
  UserHandle: 'userHandle' as AppStateKey,
};

/**
 * User info for @-mentions autocomplete
 */
export interface MentionUser {
  profileId: string;
  handle: string;
  name: string;
}

/**
 * Current user profile info for comment authorship
 */
export interface CurrentUserProfile {
  profileId: string;
  username: string;
  handle: string;
}

// Module-level instance for storage inspector
let storageInspectorService: StorageInspectorService;

/**
 * Initialize misc services
 */
export function initializeMiscServices(): void {
  storageInspectorService = new StorageInspectorService(new NodeFileSystemAdapter());
}

/**
 * Register all miscellaneous IPC handlers
 */
export function registerMiscHandlers(ctx: HandlerContext): void {
  // Tag operations
  ipcMain.handle('tag:getAll', handleGetAllTags(ctx));

  // Link operations
  ipcMain.handle('link:getBacklinks', handleGetBacklinks(ctx));
  ipcMain.handle('link:searchNotesForAutocomplete', handleSearchNotesForAutocomplete(ctx));

  // Mention operations
  ipcMain.handle('mention:getUsers', handleGetMentionUsers(ctx));

  // User operations
  ipcMain.handle('user:getCurrentProfile', handleGetCurrentProfile(ctx));

  // Telemetry operations
  ipcMain.handle('telemetry:getSettings', handleGetTelemetrySettings(ctx));
  ipcMain.handle('telemetry:updateSettings', handleUpdateTelemetrySettings(ctx));

  // Storage inspector operations
  ipcMain.handle('inspector:listSDContents', handleListSDContents(ctx));
  ipcMain.handle('inspector:readFileInfo', handleReadFileInfo(ctx));
  ipcMain.handle('inspector:parseFile', handleParseFile(ctx));

  // Tools operations
  ipcMain.handle('tools:reindexNotes', handleReindexNotes(ctx));

  // Theme operations (for cross-window sync)
  ipcMain.handle('theme:set', handleSetTheme(ctx));

  // Test-only operations (only available in NODE_ENV=test)
  if (process.env['NODE_ENV'] === 'test') {
    ipcMain.handle('test:setNoteTimestamp', handleSetNoteTimestamp(ctx));
    ipcMain.handle('test:getAllTags', handleTestGetAllTags(ctx));
    ipcMain.handle('test:getTagsForNote', handleTestGetTagsForNote(ctx));
    ipcMain.handle('test:getNoteById', handleTestGetNoteById(ctx));
  }
}

/**
 * Unregister all miscellaneous IPC handlers
 */
export function unregisterMiscHandlers(): void {
  ipcMain.removeHandler('tag:getAll');

  ipcMain.removeHandler('link:getBacklinks');
  ipcMain.removeHandler('link:searchNotesForAutocomplete');

  ipcMain.removeHandler('mention:getUsers');

  ipcMain.removeHandler('user:getCurrentProfile');

  ipcMain.removeHandler('telemetry:getSettings');
  ipcMain.removeHandler('telemetry:updateSettings');

  ipcMain.removeHandler('inspector:listSDContents');
  ipcMain.removeHandler('inspector:readFileInfo');
  ipcMain.removeHandler('inspector:parseFile');

  ipcMain.removeHandler('tools:reindexNotes');

  ipcMain.removeHandler('theme:set');

  // Test handlers (always try to remove, safe if not registered)
  ipcMain.removeHandler('test:setNoteTimestamp');
  ipcMain.removeHandler('test:getAllTags');
  ipcMain.removeHandler('test:getTagsForNote');
  ipcMain.removeHandler('test:getNoteById');
}

// =============================================================================
// Tag Handler Factories
// =============================================================================

function handleGetAllTags(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent
  ): Promise<{ id: string; name: string; count: number }[]> => {
    return await ctx.database.getAllTags();
  };
}

// =============================================================================
// Link Handler Factories
// =============================================================================

function handleGetBacklinks(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, noteId: string): Promise<NoteCache[]> => {
    return await ctx.database.getBacklinks(noteId);
  };
}

function handleSearchNotesForAutocomplete(ctx: HandlerContext) {
  return async (
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
  > => {
    const { database } = ctx;

    // For autocomplete, we want simple prefix matching on titles
    const allNotes = await database.getActiveNotes();

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
            const folder = await database.getFolder(note.folderId);
            if (folder) {
              // For now, just use the folder name
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
  };
}

// =============================================================================
// Mention Handler Factories
// =============================================================================

function handleGetMentionUsers(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<MentionUser[]> => {
    const { database, profileId } = ctx;
    const users: MentionUser[] = [];
    const seenProfileIds = new Set<string>();

    // Current user
    const currentProfileId = profileId;
    const currentName = (await database.getState(AppStateKeys.Username)) ?? '';
    const currentHandle = (await database.getState(AppStateKeys.UserHandle)) ?? '';

    if (currentHandle) {
      users.push({
        profileId: currentProfileId,
        handle: currentHandle,
        name: currentName,
      });
      seenProfileIds.add(currentProfileId);
    }

    // Users from profile presence cache in all SDs
    try {
      const sds = await database.getAllStorageDirs();
      for (const sd of sds) {
        const presences = await database.getProfilePresenceCacheBySd(sd.id);
        for (const presence of presences) {
          // Skip current user and duplicates
          if (seenProfileIds.has(presence.profileId)) continue;
          if (!presence.user) continue;

          users.push({
            profileId: presence.profileId,
            handle: presence.user,
            name: presence.username ?? presence.user, // Fall back to handle if no name
          });
          seenProfileIds.add(presence.profileId);
        }
      }
    } catch (error) {
      console.error('[IPC] Failed to get profile presences for mentions:', error);
      // Return what we have (at least current user)
    }

    return users;
  };
}

// =============================================================================
// User Handler Factories
// =============================================================================

function handleGetCurrentProfile(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<CurrentUserProfile> => {
    const { database, profileId } = ctx;

    // Get username and handle from app state
    const username = (await database.getState(AppStateKeys.Username)) ?? '';
    const handle = (await database.getState(AppStateKeys.UserHandle)) ?? '';

    return {
      profileId,
      username,
      handle,
    };
  };
}

// =============================================================================
// Telemetry Handler Factories
// =============================================================================

function handleGetTelemetrySettings(_ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent
  ): Promise<{
    consoleMetricsEnabled: boolean;
    remoteMetricsEnabled: boolean;
    datadogApiKey?: string;
  }> => {
    const telemetryManager = getTelemetryManager();
    const config = telemetryManager.getConfig();

    const result: {
      consoleMetricsEnabled: boolean;
      remoteMetricsEnabled: boolean;
      datadogApiKey?: string;
    } = {
      consoleMetricsEnabled: config.consoleMetricsEnabled,
      remoteMetricsEnabled: config.remoteMetricsEnabled,
    };

    if (config.datadogApiKey !== undefined) {
      result.datadogApiKey = config.datadogApiKey;
    }

    return result;
  };
}

function handleUpdateTelemetrySettings(_ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    settings: {
      consoleMetricsEnabled?: boolean;
      remoteMetricsEnabled?: boolean;
      datadogApiKey?: string;
    }
  ): Promise<void> => {
    const telemetryManager = getTelemetryManager();

    const config: {
      consoleMetricsEnabled?: boolean;
      remoteMetricsEnabled?: boolean;
      datadogApiKey?: string;
    } = {};

    if (settings.consoleMetricsEnabled !== undefined) {
      config.consoleMetricsEnabled = settings.consoleMetricsEnabled;
    }
    if (settings.remoteMetricsEnabled !== undefined) {
      config.remoteMetricsEnabled = settings.remoteMetricsEnabled;
    }
    if (settings.datadogApiKey !== undefined) {
      config.datadogApiKey = settings.datadogApiKey;
    }

    await telemetryManager.updateConfig(config);

    console.log(
      `[Telemetry] Settings updated: consoleMetricsEnabled=${settings.consoleMetricsEnabled ?? 'unchanged'}, remoteMetricsEnabled=${settings.remoteMetricsEnabled ?? 'unchanged'}`
    );
  };
}

// =============================================================================
// Storage Inspector Handler Factories
// =============================================================================

function handleListSDContents(_ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, sdPath: string): Promise<SDContentsResult> => {
    return storageInspectorService.listSDContents(sdPath);
  };
}

function handleReadFileInfo(_ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdPath: string,
    relativePath: string
  ): Promise<FileInfoResult> => {
    return storageInspectorService.readFileInfo(sdPath, relativePath);
  };
}

function handleParseFile(_ctx: HandlerContext) {
  return (
    _event: IpcMainInvokeEvent,
    data: Uint8Array,
    type: InspectorFileType
  ): ParsedFileResult => {
    return storageInspectorService.parseFile(data, type);
  };
}

// =============================================================================
// Tools Handler Factories
// =============================================================================

function handleReindexNotes(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<{ success: boolean; error?: string }> => {
    const { database, broadcastToAll } = ctx;

    try {
      await database.reindexNotes((current, total) => {
        broadcastToAll('tools:reindex-progress', { current, total });
      });
      broadcastToAll('tools:reindex-complete');
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      broadcastToAll('tools:reindex-error', { error: message });
      return { success: false, error: message };
    }
  };
}

// =============================================================================
// Theme Handler Factories
// =============================================================================

/**
 * Set theme and broadcast to all windows.
 * Used by Settings dialog to ensure all windows update theme together.
 */
function handleSetTheme(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, theme: 'light' | 'dark'): Promise<void> => {
    const { database, broadcastToAll } = ctx;

    // Save to database
    await database.setState(AppStateKey.ThemeMode, theme);

    // Broadcast to all windows
    broadcastToAll('theme:changed', theme);
  };
}

// =============================================================================
// Test-Only Handler Factories
// =============================================================================

function handleSetNoteTimestamp(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    field: 'created' | 'modified' | 'deleted_at',
    timestamp: number
  ): Promise<void> => {
    const { database, crdtManager } = ctx;

    // Update in database
    const note = await database.getNote(noteId);
    if (!note) {
      throw new Error(`Note ${noteId} not found`);
    }

    if (field === 'created') {
      await database.upsertNote({ ...note, created: timestamp });
    } else if (field === 'modified') {
      await database.upsertNote({ ...note, modified: timestamp });
    } else {
      // For deleted_at, we need to update the CRDT metadata
      const noteDoc = crdtManager.getNoteDoc(noteId);
      if (noteDoc) {
        // Set deleted flag and update modified time
        noteDoc.markDeleted();
        await database.upsertNote({ ...note, deleted: true, modified: timestamp });
      }
    }
  };
}

function handleTestGetAllTags(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent
  ): Promise<{ id: string; name: string; count: number }[]> => {
    return await ctx.database.getAllTags();
  };
}

function handleTestGetTagsForNote(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string
  ): Promise<{ id: string; name: string }[]> => {
    return await ctx.database.getTagsForNote(noteId);
  };
}

function handleTestGetNoteById(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, noteId: string): Promise<NoteCache | null> => {
    return await ctx.database.getNote(noteId);
  };
}
