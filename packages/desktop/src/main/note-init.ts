/**
 * Note Initialization
 * Handles default note creation and welcome content
 */

import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import type { Database } from '@notecove/shared';
import { markdownToProsemirror, prosemirrorJsonToYXmlFragment } from '@notecove/shared';
import type { CRDTManager } from './crdt';
import * as fs from 'fs/promises';
import * as Y from 'yjs';

/**
 * Get the path to a bundled resource file
 * In development, resources are in the project's resources directory
 * In production, they're in the app's resources folder
 */
function getResourcePath(filename: string): string {
  if (is.dev) {
    // In development, resources are in packages/desktop/resources
    return join(__dirname, '..', '..', 'resources', filename);
  } else {
    // In production, resources are in the app's resources folder
    return join(process.resourcesPath, 'resources', filename);
  }
}

/**
 * Read and parse the welcome.md file, populating the Y.XmlFragment with content
 * @param fragment The Y.XmlFragment to populate
 */
export async function populateWelcomeContent(fragment: Y.XmlFragment): Promise<void> {
  try {
    const welcomePath = getResourcePath('welcome.md');
    const markdown = await fs.readFile(welcomePath, 'utf-8');
    const prosemirrorJson = markdownToProsemirror(markdown);
    prosemirrorJsonToYXmlFragment(prosemirrorJson, fragment);
    console.log('[ensureDefaultNote] Loaded welcome content from welcome.md');
  } catch (error) {
    // Fallback to hardcoded content if welcome.md can't be read
    console.warn('[ensureDefaultNote] Failed to load welcome.md, using fallback:', error);
    const heading = new Y.XmlElement('heading');
    heading.setAttribute('level', '1');
    const headingText = new Y.XmlText();
    headingText.insert(0, 'Welcome to NoteCove');
    heading.insert(0, [headingText]);
    const paragraph = new Y.XmlElement('paragraph');
    const text = new Y.XmlText();
    text.insert(0, 'Your notes, beautifully organized and always in sync.');
    paragraph.insert(0, [text]);
    fragment.insert(0, [heading, paragraph]);
  }
}

/**
 * Check if there are activity logs from other instances in the SD
 * This indicates content may be syncing from another machine
 * @param sdPath Path to the storage directory
 * @param instanceId Our instance ID (to exclude our own log)
 * @returns Array of other instance IDs that have activity logs
 */
async function getOtherInstanceActivityLogs(sdPath: string, instanceId: string): Promise<string[]> {
  const activityDir = join(sdPath, 'activity');
  try {
    const files = await fs.readdir(activityDir);
    return files
      .filter((f) => f.endsWith('.log') && f !== `${instanceId}.log`)
      .map((f) => f.replace('.log', ''));
  } catch {
    // Activity directory might not exist yet
    return [];
  }
}

/**
 * Check if there are CRDT log files from other instances in a note's logs directory
 * This indicates content from another machine has synced
 * @param logsPath Path to the note's logs directory
 * @param instanceId Our instance ID (to exclude our own logs)
 * @returns Array of other instance IDs that have CRDT log files
 */
async function getOtherInstanceCRDTLogs(logsPath: string, instanceId: string): Promise<string[]> {
  try {
    const files = await fs.readdir(logsPath);
    const otherInstances = new Set<string>();
    for (const file of files) {
      if (file.endsWith('.crdtlog')) {
        // File format: {instanceId}_{timestamp}.crdtlog
        const parts = file.replace('.crdtlog', '').split('_');
        if (parts.length >= 2) {
          const fileInstanceId = parts.slice(0, -1).join('_'); // Handle instance IDs with underscores
          if (fileInstanceId !== instanceId) {
            otherInstances.add(fileInstanceId);
          }
        }
      }
    }
    return Array.from(otherInstances);
  } catch {
    // Logs directory might not exist yet
    return [];
  }
}

/**
 * Ensure a default note exists for the user
 * @param db Database instance
 * @param crdtMgr CRDT manager instance
 * @param defaultStoragePath Path to use for the default storage directory (e.g., from TEST_STORAGE_DIR in tests)
 * @param instanceId Our instance ID (to avoid checking our own activity logs)
 * @param getPath Function to get app path (for Documents folder)
 */
export async function ensureDefaultNote(
  db: Database,
  crdtMgr: CRDTManager,
  defaultStoragePath: string | undefined,
  instanceId: string | undefined,
  getPath: (name: 'documents' | 'userData') => string
): Promise<void> {
  const DEFAULT_NOTE_ID = 'default-note';

  // Ensure default SD exists
  let DEFAULT_SD_ID: string;
  const existingSDs = await db.getAllStorageDirs();
  if (existingSDs.length === 0) {
    // Create default SD - use provided path or fallback to Documents folder
    const defaultPath = defaultStoragePath ?? join(getPath('documents'), 'NoteCove');
    DEFAULT_SD_ID = 'default';
    await db.createStorageDir(DEFAULT_SD_ID, 'Default', defaultPath);
    console.log('[Main] Created default SD at:', defaultPath);
  } else {
    // Use the active SD or the first one
    const activeSD = await db.getActiveStorageDir();
    DEFAULT_SD_ID = activeSD ? activeSD.id : (existingSDs[0]?.id ?? 'default');
    console.log('[Main] Using existing SD:', DEFAULT_SD_ID);
  }

  // Check if the default note exists in ANY SD (not just the default SD)
  // This is important because the note might have been moved to another SD
  const defaultNoteInAnySD = await db.getNote(DEFAULT_NOTE_ID);

  if (defaultNoteInAnySD) {
    // Default note exists somewhere, use it
    console.log(
      '[ensureDefaultNote] Found default note in SD:',
      defaultNoteInAnySD.sdId,
      '(might have been moved)'
    );

    // Load the note from CRDT to sync metadata (handles folder moves from other instances)
    await crdtMgr.loadNote(DEFAULT_NOTE_ID, defaultNoteInAnySD.sdId);
    const noteDoc = crdtMgr.getNoteDoc(DEFAULT_NOTE_ID);
    if (noteDoc) {
      const crdtMetadata = noteDoc.getMetadata();
      // Defensive fallbacks are handled in getMetadata() itself
      const folderId = crdtMetadata.folderId;
      const deleted = crdtMetadata.deleted;
      const modified = crdtMetadata.modified;
      if (folderId !== defaultNoteInAnySD.folderId || deleted !== defaultNoteInAnySD.deleted) {
        console.log('[ensureDefaultNote] Syncing CRDT metadata to database:', {
          folderId,
          deleted,
        });
        await db.upsertNote({
          ...defaultNoteInAnySD,
          folderId,
          deleted,
          modified,
        });
      }
    }

    await db.setState('selectedNoteId', DEFAULT_NOTE_ID);
    return;
  }

  // Check if other notes exist in the default SD
  const existingNotes = await db.getNotesBySd(DEFAULT_SD_ID);
  const defaultNote = existingNotes.find((note) => note.id === DEFAULT_NOTE_ID);

  if (defaultNote) {
    // Default note exists, check if it has content
    console.log('[ensureDefaultNote] Found default note, checking content');
    await crdtMgr.loadNote(DEFAULT_NOTE_ID, DEFAULT_SD_ID);
    const doc = crdtMgr.getDocument(DEFAULT_NOTE_ID);
    if (doc) {
      const content = doc.getXmlFragment('content');
      if (content.length === 0) {
        // No content, add the welcome message
        console.log('[ensureDefaultNote] Default note is empty, adding content');
        await populateWelcomeContent(content);
      }

      // Sync CRDT metadata to database (handles folder moves from other instances)
      const noteDoc = crdtMgr.getNoteDoc(DEFAULT_NOTE_ID);
      if (noteDoc) {
        const crdtMetadata = noteDoc.getMetadata();
        // Defensive fallbacks are handled in getMetadata() itself
        const folderId = crdtMetadata.folderId;
        const deleted = crdtMetadata.deleted;
        const modified = crdtMetadata.modified;
        if (folderId !== defaultNote.folderId || deleted !== defaultNote.deleted) {
          console.log('[ensureDefaultNote] Syncing CRDT metadata to database:', {
            folderId,
            deleted,
          });
          await db.upsertNote({
            ...defaultNote,
            folderId,
            deleted,
            modified,
          });
        }
      }
    }
    await db.setState('selectedNoteId', DEFAULT_NOTE_ID);
    return;
  }

  // Check if user has permanently deleted the default note
  const defaultNoteDeleted = await db.getState('defaultNoteDeleted');
  if (defaultNoteDeleted === 'true') {
    console.log('[ensureDefaultNote] Default note was permanently deleted by user, not recreating');
    // If other notes exist, select the first one
    if (existingNotes.length > 0) {
      const firstNote = existingNotes[0];
      if (firstNote) {
        console.log('[ensureDefaultNote] Selecting first available note:', firstNote.id);
        await db.setState('selectedNoteId', firstNote.id);
      }
    }
    return;
  }

  // Check if any other notes exist
  if (existingNotes.length > 0) {
    // Other notes exist, select the first one
    const firstNote = existingNotes[0];
    if (firstNote) {
      console.log(
        '[ensureDefaultNote] Found existing note:',
        firstNote.id,
        'title:',
        firstNote.title
      );
      await db.setState('selectedNoteId', firstNote.id);
    }
    return;
  }

  console.log('[ensureDefaultNote] No existing notes in database, loading from CRDT');

  // Get the SD path to check for activity logs from other instances
  const sdRecord = await db.getStorageDir(DEFAULT_SD_ID);
  const sdPath = sdRecord?.path ?? defaultStoragePath;

  // No notes exist in database, but CRDT files might exist
  // Load the note to check if it already has content from sync directory

  await crdtMgr.loadNote(DEFAULT_NOTE_ID, DEFAULT_SD_ID);

  // Get the document to check/insert initial content
  const doc = crdtMgr.getDocument(DEFAULT_NOTE_ID);
  if (doc) {
    // Check if content already exists (from sync directory)
    const content = doc.getXmlFragment('content');
    if (content.length === 0) {
      // Check if there are activity logs OR CRDT logs from other instances
      // If so, wait for content to sync before creating welcome content
      const noteLogsPath = join(sdPath ?? '', 'notes', DEFAULT_NOTE_ID, 'logs');
      const otherActivityInstances =
        sdPath && instanceId ? await getOtherInstanceActivityLogs(sdPath, instanceId) : [];
      const otherCRDTInstances =
        sdPath && instanceId ? await getOtherInstanceCRDTLogs(noteLogsPath, instanceId) : [];

      // Combine both sources of other instance detection
      const allOtherInstances = [...new Set([...otherActivityInstances, ...otherCRDTInstances])];

      if (allOtherInstances.length > 0) {
        console.log(
          `[ensureDefaultNote] Found ${allOtherInstances.length} other instance(s): ${allOtherInstances.join(', ')}`
        );
        console.log(
          `[ensureDefaultNote]   Activity logs: ${otherActivityInstances.length}, CRDT logs: ${otherCRDTInstances.length}`
        );
        console.log('[ensureDefaultNote] Waiting for content to sync from other instances...');

        // Poll for content to arrive (max 2 seconds in 200ms intervals)
        // Keep this short to avoid blocking startup - stale syncs will be handled
        // by the background sync mechanism
        const maxWaitMs = 2000;
        const pollIntervalMs = 200;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
          // Reload the note to check for new content
          await crdtMgr.loadNote(DEFAULT_NOTE_ID, DEFAULT_SD_ID);
          const reloadedDoc = crdtMgr.getDocument(DEFAULT_NOTE_ID);
          if (reloadedDoc) {
            const reloadedContent = reloadedDoc.getXmlFragment('content');
            if (reloadedContent.length > 0) {
              console.log(
                '[ensureDefaultNote] Content arrived from another instance, skipping welcome content creation'
              );
              break;
            }
          }
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }

        // Check one more time after waiting
        const finalDoc = crdtMgr.getDocument(DEFAULT_NOTE_ID);
        if (finalDoc) {
          const finalContent = finalDoc.getXmlFragment('content');
          if (finalContent.length > 0) {
            console.log('[ensureDefaultNote] Content found after waiting, using synced content');
          } else {
            console.log(
              '[ensureDefaultNote] Timeout waiting for content from other instances, creating welcome content'
            );
            // Create welcome content since nothing arrived
            await populateWelcomeContent(finalContent);
          }
        }
      } else {
        // No other instances, create welcome content immediately
        console.log('[ensureDefaultNote] CRDT is empty, adding welcome content');
        await populateWelcomeContent(content);
      }
    } else {
      console.log(
        '[ensureDefaultNote] CRDT already has content from sync directory, skipping welcome content'
      );
    }
  }

  // Create note cache entry in SQLite
  await db.upsertNote({
    id: DEFAULT_NOTE_ID,
    title: 'Welcome to NoteCove',
    sdId: DEFAULT_SD_ID,
    folderId: null,
    created: Date.now(),
    modified: Date.now(),
    deleted: false,
    pinned: false,
    contentPreview: 'Your notes, beautifully organized and always in sync.',
    contentText: 'Welcome to NoteCove Your notes, beautifully organized and always in sync.',
  });

  // Set as selected note
  await db.setState('selectedNoteId', DEFAULT_NOTE_ID);
}
